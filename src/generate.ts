import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { loadDotEnv, resolveProviderEnv } from "./logic/bltai-lib";
import { getAIGCProvider } from "./logic/aigc-provider-registry";
import { appendTaskEvent } from "./core/tasks";
import {
  fileExists,
  log,
  materializeOutputs,
} from "./logic/generation/utils";

/**
 * Core Generation Logic (Action & Backfill)
 */
export async function runAIGC({ yamlPath, type }: { yamlPath: string; type: "image" | "video" }) {
  // 1. Load environment and project context
  await loadDotEnv();
  const absoluteYamlPath = path.resolve(process.cwd(), yamlPath);
  const projectRoot = await inferProjectRoot(absoluteYamlPath);
  const relYamlPath = path.relative(projectRoot, absoluteYamlPath);

  if (!(await fileExists(absoluteYamlPath))) {
    throw new Error(`YAML not found: ${absoluteYamlPath}`);
  }

  // 2. Read and parse YAML
  const raw = await fs.readFile(absoluteYamlPath, "utf-8");
  const doc = yaml.load(raw) as any;
  if (!doc || !doc.tasks?.[type]) {
    throw new Error(`No ${type} task defined in ${relYamlPath}`);
  }

  const taskConfig = doc.tasks[type];
  const providerId = taskConfig.provider || process.env.MANGOU_AIGC_PROVIDER;
  if (!providerId) {
    throw new Error(`Provider not specified for ${type} task in ${relYamlPath}`);
  }

  const provider = getAIGCProvider(providerId);
  const { apiKey, baseUrl } = resolveProviderEnv(provider, process.env, {});
  if (!apiKey) {
    throw new Error(`API Key missing for provider: ${providerId}. Check your .env file.`);
  }

  // 3. Resolve dynamic parameters (References & Local Paths)
  const params = JSON.parse(JSON.stringify(taskConfig.params)); // Deep clone
  
  // Resolve images (Sugar: YAML paths -> Image paths, Local paths -> Base64)
  if (params.images && Array.isArray(params.images)) {
    const resolvedImages = [];
    for (const input of params.images) {
      if (typeof input === "string") {
        if (input.endsWith(".yaml")) {
          // Resolve Asset YAML reference
          const resolvedImg = await resolveAssetImage(projectRoot, input);
          if (resolvedImg) resolvedImages.push(resolvedImg);
        } else if (await isLocalImage(projectRoot, input)) {
          // Encode local image to Base64
          const b64 = await encodeLocalImage(projectRoot, input);
          if (b64) resolvedImages.push(b64);
        } else {
          resolvedImages.push(input);
        }
      } else {
        resolvedImages.push(input);
      }
    }
    params.images = resolvedImages;
  }

  // 4. Submit and Poll
  const scope = provider.scopes?.[type] || (type === "image" ? "images" : "videos");
  const payload = provider.buildPayload(scope, params);
  
  log(`[mangou] Submitting ${type} task via ${providerId}...`);
  const submitResult = await provider.submit({
    baseUrl, apiKey, scope, payload,
    projectRoot, yamlPath: relYamlPath,
    projectId: path.basename(projectRoot)
  });

  const taskId = typeof submitResult === "string" ? submitResult : "unknown";
  
  // Update YAML status to running
  await updateYaml(absoluteYamlPath, {
    [`tasks.${type}.latest`]: { status: "running", task_id: taskId, updated_at: new Date().toISOString() }
  });

  log(`[mangou] Task ${taskId} is running. Polling for results...`);
  const result = await provider.poll({
    baseUrl, apiKey, scope, taskId,
    projectRoot, yamlPath: relYamlPath,
    projectId: path.basename(projectRoot)
  });

  // 5. Materialize outputs and Backfill
  const outputs = provider.extractOutputs(scope, result);
  const localOutputs = await materializeOutputs(projectRoot, relYamlPath, type, taskId, outputs);
  const primaryOutput = localOutputs[0] || "";

  await updateYaml(absoluteYamlPath, {
    [`tasks.${type}.latest`]: {
      status: "completed",
      output: primaryOutput,
      task_id: taskId,
      updated_at: new Date().toISOString()
    }
  });

  // 6. Audit Log
  await appendTaskEvent(projectRoot, {
    id: taskId,
    type: `${type}_generate`,
    status: "success",
    target: relYamlPath,
    output: primaryOutput,
    timestamp: Date.now()
  });

  log(`[mangou] Successfully generated ${type}: ${primaryOutput}`);
}

/**
 * Helpers
 */

async function inferProjectRoot(yamlPath: string): Promise<string> {
  let curr = path.dirname(yamlPath);
  while (curr !== path.dirname(curr)) {
    if (curr.endsWith("projects") || await fileExists(path.join(curr, "project.json"))) {
      return curr;
    }
    const projectsDir = path.join(curr, "projects");
    if (await fileExists(projectsDir)) {
      const rel = path.relative(projectsDir, yamlPath);
      const topDir = rel.split(path.sep)[0];
      return path.join(projectsDir, topDir);
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

async function resolveAssetImage(projectRoot: string, yamlRelPath: string): Promise<string | null> {
  const absPath = path.resolve(projectRoot, yamlRelPath);
  if (!(await fileExists(absPath))) return null;
  const raw = await fs.readFile(absPath, "utf-8");
  const doc = yaml.load(raw) as any;
  return doc?.tasks?.image?.latest?.output || null;
}

async function isLocalImage(projectRoot: string, imgPath: string): Promise<boolean> {
  if (imgPath.startsWith("http") || imgPath.startsWith("data:")) return false;
  return await fileExists(path.resolve(projectRoot, imgPath));
}

async function encodeLocalImage(projectRoot: string, imgPath: string): Promise<string | null> {
  const absPath = path.resolve(projectRoot, imgPath);
  const data = await fs.readFile(absPath);
  const ext = path.extname(absPath).slice(1) || "png";
  return `data:image/${ext};base64,${data.toString("base64")}`;
}

async function updateYaml(yamlPath: string, updates: Record<string, any>) {
  const raw = await fs.readFile(yamlPath, "utf-8");
  const doc = yaml.load(raw) as any;
  
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split(".");
    let curr = doc;
    for (let i = 0; i < parts.length - 1; i++) {
      curr[parts[i]] = curr[parts[i]] || {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
  }

  await fs.writeFile(yamlPath, yaml.dump(doc, { lineWidth: -1, noRefs: true }));
}
