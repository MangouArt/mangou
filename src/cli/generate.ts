import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import { loadDotEnv, resolveProviderEnv } from "../../scripts/bltai-lib.mjs";
import { getAIGCProvider } from "../../scripts/aigc-provider-registry.mjs";
import { appendTaskEvent } from "../../scripts/tasks-jsonl.mjs";
import {
  ensureArray,
  fileExists,
  log,
  materializeOutputs,
  resolveResumeTaskId,
} from "../../scripts/generation/utils.mjs";
import { inferContext } from "../../scripts/generation/context.mjs";
import { collectRefImageInputs, resolveImageInput } from "../../scripts/generation/input-resolver.mjs";
import { updateYamlProjection } from "../../scripts/generation/projection.mjs";

async function readWorkspaceConfig(workspaceRoot: string) {
  const configPath = path.join(workspaceRoot, "config.json");
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function getProviderConfig(config: any, providerId: string) {
  if (!config || typeof config !== "object") return {};
  const direct = config?.[providerId];
  if (direct && typeof direct === "object") {
    return {
      apiKey: typeof direct.apiKey === "string" ? direct.apiKey : "",
      baseUrl: typeof direct.baseUrl === "string" ? direct.baseUrl : "",
    };
  }
  const nested = config?.providers?.[providerId];
  if (nested && typeof nested === "object") {
    return {
      apiKey: typeof nested.apiKey === "string" ? nested.apiKey : "",
      baseUrl: typeof nested.baseUrl === "string" ? nested.baseUrl : "",
    };
  }
  return {};
}

async function upsertTask(projectRoot: string, id: string, payload: any) {
  try {
    return await appendTaskEvent(projectRoot, {
      ...payload,
      id,
    });
  } catch (err: any) {
    log(`Warning: failed to append task event: ${err.message}`);
  }
}

function isTimeoutError(error: any) {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout/i.test(message);
}

function parseGenerationArgs(argv: string[]) {
  const args: any = {
    _raw: [],
    projectRoot: "",
    workspaceRoot: "",
    debug: false,
    provider: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--project-root" || arg === "--project") {
      args.projectRoot = argv[i + 1];
      i += 1;
    } else if (arg === "--workspace-root" || arg === "--workspace") {
      args.workspaceRoot = argv[i + 1];
      i += 1;
    } else if (arg === "--provider") {
      args.provider = argv[i + 1];
      i += 1;
    } else if (arg === "--debug") {
      args.debug = true;
    } else {
      args._raw.push(arg);
    }
  }
  return args;
}

function validateTask(doc: any, docIndex: number, taskType: string, providerId: string) {
  const id = doc.meta?.id || `(索引 ${docIndex})`;
  
  if (!doc.meta?.id) {
    throw new Error(`YAML 错误: 文档索引 ${docIndex} 缺失 'meta.id'。每个分镜任务必须有唯一的 ID。`);
  }
  
  const task = doc.tasks?.[taskType];
  if (!task) {
    throw new Error(`YAML 错误 (ID ${id}): 缺失 'tasks.${taskType}' 任务定义。`);
  }
  
  if (!task.params || typeof task.params !== "object") {
    throw new Error(`YAML 错误 (ID ${id}): 'tasks.${taskType}.params' 必须是一个对象且包含必要参数。`);
  }

  if (providerId === "bltai" || providerId === "kie") {
    if (!task.params.model) {
      throw new Error(`YAML 错误 (ID ${id}): 使用 ${providerId} 时必须指定 'model' 参数。请检查 tasks.${taskType}.params.model。`);
    }
  }

  if (!task.params.prompt && taskType === "image") {
    throw new Error(`YAML 错误 (ID ${id}): 任务缺失 'prompt' 描述。`);
  }
}

export async function runAIGC(provider: any, argv: string[] = process.argv.slice(2)) {
  await loadDotEnv();

  const args = parseGenerationArgs(argv);
  const yamlArg = args._raw[0];
  const type = args._raw[1];
  const { debug, projectRoot: overrideProjectRoot, workspaceRoot: overrideWorkspaceRoot, provider: cliProviderId } = args;

  if (!yamlArg || !type || !["image", "video"].includes(type)) {
    throw new Error("Usage: mangou generate image|video <yaml-path> [--project-root <path>] [--workspace-root <path>] [--provider <id>] [--debug]");
  }

  const absoluteYamlPath = path.resolve(process.cwd(), yamlArg);
  
  if (!(await fileExists(absoluteYamlPath))) {
    throw new Error(`无法找到 YAML 文件。尝试访问路径: ${absoluteYamlPath}`);
  }

  const context = await inferContext(absoluteYamlPath, {
    projectRoot: overrideProjectRoot,
    workspaceRoot: overrideWorkspaceRoot,
  });
  const { workspaceRoot, projectId, projectRoot, yamlPath } = context;
  
  const raw = await fs.readFile(absoluteYamlPath, "utf-8");
  const docs = yaml.loadAll(raw).filter(Boolean) as any[];

  if (docs.length === 0) {
    throw new Error(`No documents found in ${yamlArg}`);
  }

  log(`Processing ${docs.length} documents in ${yamlArg}`);

  for (let docIndex = 0; docIndex < docs.length; docIndex += 1) {
    const doc = docs[docIndex];
    if (docs.length > 1) {
      log(`--- Document ${docIndex + 1}/${docs.length} ---`);
    }

    const providerId = 
      cliProviderId || 
      doc.tasks?.[type]?.provider || 
      process.env.MANGOU_AIGC_PROVIDER;

    const id = doc.meta?.id || `(索引 ${docIndex})`;
    if (!providerId) {
      throw new Error(`YAML 错误 (ID ${id}): 未指定 AIGC 供应商 (provider)。`);
    }

    try {
      validateTask(doc, docIndex, type, providerId);
    } catch (validatorError: any) {
      log(`[Doc ${docIndex}] Validation Error: ${validatorError.message}`);
      await updateYamlProjection({
        projectRoot,
        yamlPath,
        taskType: type,
        status: "failed",
        error: validatorError.message,
        docIndex,
      });
      continue;
    }

    const taskConfig = doc.tasks[type];
    const providerToUse = provider || getAIGCProvider(providerId);
    const workspaceConfig = await readWorkspaceConfig(workspaceRoot);
    const { apiKey, baseUrl } = resolveProviderEnv(
      providerToUse,
      process.env,
      getProviderConfig(workspaceConfig, providerToUse.id)
    );
    if (!apiKey) {
      throw new Error(`Missing ${providerToUse.env.apiKey}`);
    }
    const isStoryboard = yamlPath.startsWith("storyboards/");
    const params = { ...taskConfig.params };
    const scope = providerToUse.scopes?.[type] || (type === "image" ? "images" : "videos");
    const refs = ensureArray(doc?.refs);
    const refImages = type === "image" ? await collectRefImageInputs(projectRoot, refs) : [];

    function resolveTemplateVar(value: any) {
      if (typeof value !== "string") return value;
      return value.replace(/\{\{(tasks\.[^}]+)\}\}/g, (_match, dotPath) => {
        const parts = dotPath.split(".");
        let current = doc;
        for (const part of parts) {
          if (current == null || typeof current !== "object") return "";
          current = current[part];
        }
        return typeof current === "string" ? current : "";
      });
    }

    const rawImages = [
      ...ensureArray(params.images),
      ...(params.image_url ? [resolveTemplateVar(params.image_url)] : []),
      ...(params.image ? [resolveTemplateVar(params.image)] : []),
      ...refImages,
    ];

    if (type === "video" && rawImages.filter(Boolean).length === 0) {
      const imageOutput = doc?.tasks?.image?.latest?.output;
      if (imageOutput && typeof imageOutput === "string") {
        rawImages.push(imageOutput);
      }
    }

    const uniqueImages = Array.from(new Set(rawImages.filter(Boolean)));
    const resolvedImages = [];
    for (const input of uniqueImages) {
      resolvedImages.push(await resolveImageInput(workspaceRoot, projectId, projectRoot, input, isStoryboard));
    }

    if (resolvedImages.length > 0) {
      params.images = resolvedImages.filter(Boolean);
      delete params.image_url;
      delete params.image;
    }

    const payload = providerToUse.buildPayload(scope, params);
    const localTaskId = crypto.randomUUID();
    let upstreamTaskId = resolveResumeTaskId(taskConfig);
    const resuming = Boolean(upstreamTaskId);
    let submitResult;

    if (!resuming) {
      try {
        await upsertTask(projectRoot, localTaskId, {
          id: localTaskId,
          type,
          status: "processing",
          provider: providerToUse.id,
          input: params,
          ref: { yamlPath, taskType: type },
          worker: "mangou",
          event: "submitted",
        });
      } catch {
        // best effort
      }
    }

    try {
      if (!resuming) {
        log(`Submitting ${type} task`, { projectId, yamlPath, provider: providerToUse.id });
        submitResult = await providerToUse.submit({
          baseUrl,
          apiKey,
          scope,
          payload,
          workspaceRoot,
          projectId,
          projectRoot,
          yamlPath,
        });
        upstreamTaskId = typeof submitResult === "string" ? submitResult : localTaskId;

        try {
          await upsertTask(projectRoot, localTaskId, {
            upstreamTaskId,
            type,
            status: "processing",
            provider: providerToUse.id,
            input: params,
            ref: { yamlPath, taskType: type },
            worker: "mangou",
            event: "accepted",
          });
        } catch {
          // best effort
        }

        await updateYamlProjection({
          projectRoot,
          taskId: upstreamTaskId,
          upstreamTaskId,
          status: "processing",
          output: null,
          yamlPath,
          taskType: type,
          error: null,
          docIndex,
        });
      } else {
        log(`Resuming ${type} task`, { projectId, yamlPath, upstreamTaskId });
      }

      const result = await providerToUse.poll({
        baseUrl,
        apiKey,
        scope,
        taskId: submitResult ?? upstreamTaskId,
        timeoutMs: 30 * 60 * 1000,
        debug,
        workspaceRoot,
        projectId,
        projectRoot,
        yamlPath,
      });
      const outputs = providerToUse.extractOutputs(scope, result);
      const finalOutputs = await materializeOutputs(projectRoot, yamlPath, type, upstreamTaskId, outputs);
      const primaryOutput = finalOutputs[0] || "";

      try {
        await upsertTask(projectRoot, localTaskId, {
          upstreamTaskId,
          type,
          status: "success",
          provider: providerToUse.id,
          input: params,
          output: { urls: finalOutputs },
          ref: { yamlPath, taskType: type },
          worker: "mangou",
          event: "completed",
        });
      } catch {
        // best effort
      }

      await updateYamlProjection({
        projectRoot,
        taskId: upstreamTaskId,
        upstreamTaskId,
        status: "completed",
        output: primaryOutput,
        yamlPath,
        taskType: type,
        error: null,
        docIndex,
      });

      log(`Completed ${type} task`, { taskId: upstreamTaskId, output: primaryOutput });
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      const timeout = isTimeoutError(error);
      const taskStatus = timeout ? "processing" : "failed";
      const event = timeout ? "timeout" : "failed";

      try {
        await upsertTask(projectRoot, localTaskId, {
          upstreamTaskId,
          type,
          status: taskStatus,
          provider: providerToUse.id,
          input: params,
          ref: { yamlPath, taskType: type },
          error: { message },
          worker: "mangou",
          event,
        }).catch(() => null);
      } catch {
        // best effort
      }

      await updateYamlProjection({
        projectRoot,
        taskId: upstreamTaskId ?? null,
        upstreamTaskId: upstreamTaskId ?? null,
        status: taskStatus,
        output: null,
        yamlPath,
        taskType: type,
        error: message,
        docIndex,
      }).catch(() => null);

      if (docs.length === 1) throw error;
      log(`Error in document ${docIndex + 1}: ${message}`);
    }
  }

  log("All documents processed");
}
