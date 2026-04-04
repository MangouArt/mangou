import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { appendTaskEvent } from "./core/tasks";

function log(...args: any[]) {
  console.error("[split-grid]", ...args);
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildChildDoc(masterDoc: any, parentId: string, index: number) {
  const content = masterDoc?.content || {};
  const sequenceBase = Number(content.sequence || 0);
  const titleBase = String(content.title || parentId).trim() || parentId;

  return {
    meta: {
      id: `${parentId}-sub-${String(index).padStart(2, '0')}`,
      version: masterDoc?.meta?.version || '1.0',
      parent: parentId,
      grid_index: index,
    },
    content: {
      sequence: sequenceBase + index,
      title: `${titleBase} 子镜 ${String(index).padStart(2, '0')}`,
      story: String(content.story || ''),
      action: '',
      scene: String(content.scene || ''),
      duration: content.duration || '4s',
      characters: Array.isArray(content.characters) ? content.characters : [],
    },
    tasks: {},
    refs: {},
  };
}

export async function scaffoldGridChildren({
  gridYamlPath,
  projectRoot = '',
  workspaceRoot = '',
}: {
  gridYamlPath: string;
  projectRoot?: string;
  workspaceRoot?: string;
}) {
  const absoluteGridYamlPath = path.resolve(process.cwd(), gridYamlPath);
  if (!(await fileExists(absoluteGridYamlPath))) {
    throw new Error(`Cannot find grid master YAML: ${absoluteGridYamlPath}`);
  }

  const context = await inferContext(absoluteGridYamlPath, {
    projectRoot,
    workspaceRoot,
  });
  const resolvedProjectRoot = context.projectRoot;

  const raw = await fs.readFile(absoluteGridYamlPath, 'utf-8');
  const docs = (yaml as any).loadAll(raw).filter(Boolean);
  const masterDoc = docs[0];
  if (!masterDoc) {
    throw new Error(`Grid master YAML is empty: ${gridYamlPath}`);
  }

  const parentId = masterDoc?.meta?.id;
  if (!parentId) {
    throw new Error(`Grid master YAML missing meta.id: ${gridYamlPath}`);
  }

  const gridValue = masterDoc?.meta?.grid;
  if (!gridValue) {
    throw new Error(`Grid master YAML missing meta.grid: ${gridYamlPath}`);
  }

  const { cols, rows } = parseGrid(gridValue);
  const total = cols * rows;
  const storyboardsDir = path.dirname(absoluteGridYamlPath);
  const created = [];

  for (let index = 1; index <= total; index += 1) {
    const filename = `${parentId}-sub-${String(index).padStart(2, '0')}.yaml`;
    const absoluteChildPath = path.join(storyboardsDir, filename);
    if (await fileExists(absoluteChildPath)) {
      // Skip instead of error to be idempotent
      continue;
    }

    const childDoc = buildChildDoc(masterDoc, parentId, index);
    const serialized = yaml.dump(childDoc, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
    await fs.writeFile(absoluteChildPath, serialized, 'utf-8');
    created.push(path.relative(resolvedProjectRoot, absoluteChildPath).split(path.sep).join('/'));
  }

  return {
    parentId,
    grid: `${cols}x${rows}`,
    created,
  };
}

async function getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  const proc = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=s=x:p=0",
    imagePath
  ]);
  
  if (proc.status !== 0) {
    throw new Error(`ffprobe failed: ${proc.stderr?.toString()}`);
  }
  
  const output = proc.stdout.toString().trim();
  const [width, height] = output.split("x").map(Number);
  if (isNaN(width) || isNaN(height)) {
    throw new Error(`Invalid ffprobe output: ${output}`);
  }
  return { width, height };
}

async function cropImage(
  inputPath: string,
  outputPath: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const proc = spawnSync("ffmpeg", [
    "-i", inputPath,
    "-vf", `crop=${w}:${h}:${x}:${y}`,
    "-y",
    outputPath
  ]);
  
  if (proc.status !== 0) {
    throw new Error(`ffmpeg crop failed: ${proc.stderr?.toString()}`);
  }
}

function parseGrid(gridStr: string) {
  const [cols, rows] = gridStr.toLowerCase().split("x").map(Number);
  if (isNaN(cols) || isNaN(rows)) throw new Error(`Invalid grid format: ${gridStr}. Use NxM (e.g., 2x2)`);
  return { cols, rows };
}

function toPosixRelative(projectRoot: string, targetPath: string) {
  return path.relative(projectRoot, targetPath).split(path.sep).join("/");
}

async function inferContext(absoluteYamlPath: string, overrides: any = {}) {
  const normalized = path.resolve(absoluteYamlPath);

  if (overrides.projectRoot) {
    const projectRoot = path.resolve(overrides.projectRoot);
    const workspaceRoot = overrides.workspaceRoot ? path.resolve(overrides.workspaceRoot) : path.dirname(path.dirname(projectRoot));
    const projectId = path.basename(projectRoot);
    return { workspaceRoot, projectId, projectRoot };
  }

  const segments = normalized.split(path.sep).filter(Boolean);
  const projectsIndex = segments.lastIndexOf("projects");

  if (projectsIndex >= 1 && segments.length > projectsIndex + 1) {
    const projectId = segments[projectsIndex + 1];
    const projectsSegments = segments.slice(0, projectsIndex + 1);
    const projectsRoot = `${path.sep}${projectsSegments.join(path.sep)}`;
    const workspaceRoot = path.dirname(projectsRoot);
    const projectRoot = path.join(projectsRoot, projectId);

    const hasWorkspaceMarker = (
        (await fileExists(path.join(workspaceRoot, "projects.json"))) ||
        (await fileExists(path.join(workspaceRoot, "config.json"))) ||
        (await fileExists(path.join(workspaceRoot, ".mangou")))
      );
      
    if (hasWorkspaceMarker) {
        return { workspaceRoot, projectId, projectRoot };
    }
  }

  const portableProjectRoot = path.dirname(normalized);
  const portableProjectId = path.basename(portableProjectRoot);

  return {
    workspaceRoot: process.cwd(),
    projectId: portableProjectId,
    projectRoot: portableProjectRoot,
  };
}

export async function runSplitGrid(args: string[] = process.argv.slice(2)) {
  const parentYamlArg = args.find(a => !a.startsWith("--"));
  
  const gridArgIndex = args.indexOf("--grid");
  const gridStr = gridArgIndex !== -1 ? args[gridArgIndex + 1] : "2x2";
  
  const targetsArgIndex = args.indexOf("--targets");
  const targetsStr = targetsArgIndex !== -1 ? args[targetsArgIndex + 1] : "";

  const projectRootArgIndex = args.indexOf("--project-root");
  const overrideProjectRoot = projectRootArgIndex !== -1 ? args[projectRootArgIndex + 1] : "";

  const workspaceRootArgIndex = args.indexOf("--workspace-root");
  const overrideWorkspaceRoot = workspaceRootArgIndex !== -1 ? args[workspaceRootArgIndex + 1] : "";

  if (!parentYamlArg) {
    throw new Error("Usage: mangou grid split <parent-yaml> [--grid NxM] [--targets yaml1,yaml2,...] [--project-root <path>] [--workspace-root <path>]");
  }

  const absoluteParentYamlPath = path.resolve(process.cwd(), parentYamlArg);
  
  if (!(await fileExists(absoluteParentYamlPath))) {
    throw new Error(`Error: Cannot find parent YAML at ${absoluteParentYamlPath}`);
  }

  const { projectRoot } = await inferContext(absoluteParentYamlPath, {
    projectRoot: overrideProjectRoot,
    workspaceRoot: overrideWorkspaceRoot,
  });

  const parentYamlRaw = await fs.readFile(absoluteParentYamlPath, "utf-8");
  const parentDocs = (yaml as any).loadAll(parentYamlRaw).filter(Boolean) as any[];
  const parentDoc = parentDocs[0];
  
  if (!parentDoc) throw new Error(`Parent YAML ${parentYamlArg} is empty or invalid`);

  let gridToUse = gridStr;
  if (gridArgIndex === -1 && parentDoc.meta?.grid) {
    gridToUse = parentDoc.meta.grid;
    log(`Using grid ${gridToUse} from YAML meta.grid`);
  }

  const { cols, rows } = parseGrid(gridToUse);

  const parentImagePathRelative = parentDoc?.tasks?.image?.latest?.output;
  if (!parentImagePathRelative) throw new Error(`Parent YAML ${parentYamlArg} has no tasks.image.latest.output in first document`);

  const parentImagePath = path.join(projectRoot, parentImagePathRelative);
  log(`Processing parent image: ${parentImagePath} (Grid: ${cols}x${rows})`);

  const dimensions = await getImageDimensions(parentImagePath);
  const subWidth = Math.floor(dimensions.width / cols);
  const subHeight = Math.floor(dimensions.height / rows);

  const subImagesPaths: string[] = [];
  const parentBase = path.basename(parentImagePath, path.extname(parentImagePath));

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c + 1;
      const subFilename = `${parentBase}-sub-${String(index).padStart(2, "0")}.png`;
      const subRelativePath = path.posix.join("assets", "images", subFilename);
      const subAbsolutePath = path.join(projectRoot, subRelativePath);

      await cropImage(
        parentImagePath,
        subAbsolutePath,
        c * subWidth,
        r * subHeight,
        subWidth,
        subHeight
      );

      subImagesPaths.push(subRelativePath);
      log(`Generated sub-image ${index}: ${subRelativePath}`);
    }
  }

  const parentId = parentDoc.meta?.id || parentBase;
  let targetYamlPaths = targetsStr ? targetsStr.split(",").map((s) => s.trim()) : [];
  
  if (targetYamlPaths.length === 0) {
      const storyboardDir = path.dirname(absoluteParentYamlPath);
      const files = await fs.readdir(storyboardDir);
      
      const siblingYamls = [];
      for (const file of files) {
          if (file.endsWith(".yaml") && file !== path.basename(absoluteParentYamlPath)) {
              const filePath = path.join(storyboardDir, file);
              try {
                  const content = await fs.readFile(filePath, "utf-8");
                  const docs = (yaml as any).loadAll(content).filter(Boolean) as any[];
                  const doc = docs[0];
                  if (doc?.meta?.parent === parentId) {
                      siblingYamls.push({ 
                        path: filePath, 
                        sequence: Number(doc.content?.sequence || doc.meta?.sequence || 0),
                        id: doc.meta?.id || file
                      });
                  }
              } catch (error: any) {
                  log(`[ERROR] Failed to parse target YAML during sibling discovery: ${filePath} (${error.message})`);
              }
          }
      }
      
      if (siblingYamls.length > 0) {
          siblingYamls.sort((a, b) => (a.sequence - b.sequence) || a.id.localeCompare(b.id));
          targetYamlPaths = siblingYamls.map(y => y.path);
          log(`自动发现 ${targetYamlPaths.length} 个子分镜文件，归属于父 ID: ${parentId}`);
      }
  }

  if (targetYamlPaths.length === 0 && parentDocs.length > 1) {
    targetYamlPaths = [parentYamlArg];
    log(`未发现独立子分镜文件，回退到单文件多文档回填模式。`);
  }

  const totalSubImages = subImagesPaths.length;
  const targetDocs: any[] = [];
  const claimedSubImageIndexes = new Set<number>();

  for (const targetYaml of targetYamlPaths) {
    const absTargetYaml = path.isAbsolute(targetYaml) ? targetYaml : path.resolve(process.cwd(), targetYaml);
    if (!(await fileExists(absTargetYaml))) {
      console.warn(`[Warning] 找不到回填目标文件: ${absTargetYaml}。跳过。`);
      continue;
    }

    let raw;
    let docs;
    try {
      raw = await fs.readFile(absTargetYaml, "utf-8");
      docs = (yaml as any).loadAll(raw).filter(Boolean) as any[];
    } catch (error: any) {
      log(`[ERROR] Failed to parse target YAML: ${absTargetYaml} (${error.message})`);
      continue;
    }
    const assignments = new Array(docs.length).fill(null);

    for (let docIdx = 0; docIdx < docs.length; docIdx += 1) {
      const doc = docs[docIdx];
      const rawIdx = doc?.meta?.grid_index;
      if (rawIdx == null || rawIdx === "") continue;
      const explicitGridIndex = Number(rawIdx);
      
      if (explicitGridIndex > totalSubImages) {
        throw new Error(`meta.grid_index ${explicitGridIndex} 超出宫格范围 ${totalSubImages}`);
      }
      const zeroBasedIndex = explicitGridIndex - 1;
      if (claimedSubImageIndexes.has(zeroBasedIndex)) {
        throw new Error(`重复的 meta.grid_index: ${explicitGridIndex}`);
      }
      claimedSubImageIndexes.add(zeroBasedIndex);
      assignments[docIdx] = zeroBasedIndex;
    }

    targetDocs.push({ targetYaml, absTargetYaml, docs, assignments });
  }

  let nextSequentialIndex = 0;
  for (const state of targetDocs) {
    for (let docIdx = 0; docIdx < state.docs.length; docIdx += 1) {
      if (state.assignments[docIdx] != null) continue;
      while (claimedSubImageIndexes.has(nextSequentialIndex)) {
        nextSequentialIndex += 1;
      }
      if (nextSequentialIndex >= totalSubImages) break;
      state.assignments[docIdx] = nextSequentialIndex;
      claimedSubImageIndexes.add(nextSequentialIndex);
      nextSequentialIndex += 1;
    }
  }

  for (const state of targetDocs) {
    try {
      let changed = false;
      const targetYamlPath = toPosixRelative(projectRoot, state.absTargetYaml);
      const parentYamlPath = toPosixRelative(projectRoot, absoluteParentYamlPath);
      const taskEvents: any[] = [];

      for (let docIdx = 0; docIdx < state.docs.length; docIdx += 1) {
        const assignedIndex = state.assignments[docIdx];
        if (assignedIndex == null || assignedIndex >= totalSubImages) continue;

        const doc = state.docs[docIdx];
        const subPath = subImagesPaths[assignedIndex];

        if (!doc.tasks) doc.tasks = {};
        if (!doc.tasks.image) doc.tasks.image = {};
        if (!doc.tasks.image.latest) doc.tasks.image.latest = {};

        doc.tasks.image.latest.status = "success";
        doc.tasks.image.latest.output = subPath;
        doc.tasks.image.latest.updated_at = new Date().toISOString();
        
        if (!doc.meta) doc.meta = {};
        if (!doc.meta.parent) doc.meta.parent = parentId;

        changed = true;
        log(`已成功回填 ${path.basename(state.targetYaml)} (doc ${docIdx}): ${subPath}`);
        taskEvents.push({
          type: "image",
          status: "success",
          provider: "grid-split",
          input: {
            parentYamlPath,
            gridIndex: assignedIndex + 1,
            docIndex: docIdx,
          },
          output: {
            files: [subPath],
          },
          ref: {
            yamlPath: targetYamlPath,
            taskType: "image",
          },
          worker: "mangou",
          event: "grid-split",
        });
      }

      if (changed) {
        const updatedYaml = state.docs.map((doc: any) =>
          yaml.dump(doc, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false })
        ).join("---\n");
        await fs.writeFile(state.absTargetYaml, updatedYaml, "utf-8");
        for (const taskEvent of taskEvents) {
          await appendTaskEvent(projectRoot, taskEvent);
        }
      }
    } catch (error: any) {
      log(`[ERROR] 回填 ${state.targetYaml} 失败 (逻辑继续执行): ${error.message}`);
    }
  }

  return { outputs: subImagesPaths };
}
