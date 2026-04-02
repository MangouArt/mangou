#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.error('[split-grid] Error: "sharp" module not found. This script requires "sharp" to perform image splitting.');
  console.error('[split-grid] Please run "npm install sharp" in the mangou directory to fix this.');
  process.exit(1);
}

function log(...args) {
  console.error('[split-grid]', ...args);
}

function getExplicitGridIndex(doc) {
  const raw = doc?.meta?.grid_index;
  if (raw == null || raw === '') return null;
  const index = Number(raw);
  if (!Number.isInteger(index) || index <= 0) {
    throw new Error(`Invalid meta.grid_index: ${raw}`);
  }
  return index;
}

function parseGrid(gridStr) {
  const [cols, rows] = gridStr.toLowerCase().split('x').map(Number);
  if (isNaN(cols) || isNaN(rows)) throw new Error(`Invalid grid format: ${gridStr}. Use NxM (e.g., 2x2)`);
  return { cols, rows };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function inferContext(absoluteYamlPath, overrides = {}) {
  const normalized = path.resolve(absoluteYamlPath);

  if (overrides.projectRoot) {
    const projectRoot = path.resolve(overrides.projectRoot);
    const workspaceRoot = overrides.workspaceRoot ? path.resolve(overrides.workspaceRoot) : path.dirname(path.dirname(projectRoot));
    const projectId = path.basename(projectRoot);
    return { workspaceRoot, projectId, projectRoot };
  }

  const segments = normalized.split(path.sep).filter(Boolean);
  const projectsIndex = segments.lastIndexOf('projects');

  // Attempt to infer standard workspace structure (workspace/projects/id/...)
  if (projectsIndex >= 1 && segments.length > projectsIndex + 1) {
    const projectId = segments[projectsIndex + 1];
    const projectsSegments = segments.slice(0, projectsIndex + 1);
    const projectsRoot = `${path.sep}${projectsSegments.join(path.sep)}`;
    const workspaceRoot = path.dirname(projectsRoot);
    const projectRoot = path.join(projectsRoot, projectId);

    // Verify workspace marker for confidence
    const hasWorkspaceMarker = (
        (await fileExists(path.join(workspaceRoot, 'projects.json'))) ||
        (await fileExists(path.join(workspaceRoot, 'config.json'))) ||
        (await fileExists(path.join(workspaceRoot, '.mangou')))
      );
      
    if (hasWorkspaceMarker) {
        return { workspaceRoot, projectId, projectRoot };
    }
  }

  // PORTABLE FALLBACK:
  const portableProjectRoot = path.dirname(normalized);
  const portableProjectId = path.basename(portableProjectRoot);

  return {
    workspaceRoot: process.cwd(),
    projectId: portableProjectId,
    projectRoot: portableProjectRoot,
  };
}

export async function runSplitGrid(args = process.argv.slice(2)) {
  const parentYamlArg = args.find(a => !a.startsWith('--'));
  
  const gridArgIndex = args.indexOf('--grid');
  const gridStr = gridArgIndex !== -1 ? args[gridArgIndex + 1] : '2x2';
  
  const targetsArgIndex = args.indexOf('--targets');
  const targetsStr = targetsArgIndex !== -1 ? args[targetsArgIndex + 1] : '';

  const projectRootArgIndex = args.indexOf('--project-root');
  const overrideProjectRoot = projectRootArgIndex !== -1 ? args[projectRootArgIndex + 1] : '';

  const workspaceRootArgIndex = args.indexOf('--workspace-root');
  const overrideWorkspaceRoot = workspaceRootArgIndex !== -1 ? args[workspaceRootArgIndex + 1] : '';

  if (!parentYamlArg) {
    console.error('Usage: node split-grid.mjs <parent-yaml> [--grid NxM] [--targets yaml1,yaml2,...] [--project-root <path>] [--workspace-root <path>]');
    process.exit(1);
  }

  const absoluteParentYamlPath = path.resolve(process.cwd(), parentYamlArg);
  
  if (!(await fileExists(absoluteParentYamlPath))) {
    console.error(`Error: Cannot find parent YAML at ${absoluteParentYamlPath}`);
    console.error(`Please ensure the path is relative to your CWD: ${process.cwd()}`);
    process.exit(1);
  }

  const { projectRoot } = await inferContext(absoluteParentYamlPath, {
    projectRoot: overrideProjectRoot,
    workspaceRoot: overrideWorkspaceRoot,
  });

  const parentYamlRaw = await fs.readFile(absoluteParentYamlPath, 'utf-8');
  const parentDocs = yaml.loadAll(parentYamlRaw).filter(Boolean);
  const parentDoc = parentDocs[0];
  
  if (!parentDoc) throw new Error(`Parent YAML ${parentYamlArg} is empty or invalid`);

  // Grid resolution strategy:
  // 1. Explicit CLI argument --grid NxM
  // 2. YAML meta.grid: "NxM"
  // 3. Default 2x2

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

  const image = sharp(parentImagePath);
  const metadata = await image.metadata();
  const subWidth = Math.floor((metadata.width || 0) / cols);
  const subHeight = Math.floor((metadata.height || 0) / rows);

  const subImagesPaths = [];
  const parentBase = path.basename(parentImagePath, path.extname(parentImagePath));

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const index = r * cols + c + 1;
      const subFilename = `${parentBase}-sub-${String(index).padStart(2, '0')}.png`;
      const subRelativePath = path.posix.join('assets', 'images', subFilename);
      const subAbsolutePath = path.join(projectRoot, subRelativePath);

      await image
        .clone()
        .extract({
          left: c * subWidth,
          top: r * subHeight,
          width: subWidth,
          height: subHeight,
        })
        .toFile(subAbsolutePath);

      subImagesPaths.push(subRelativePath);
      log(`Generated sub-image ${index}: ${subRelativePath}`);
    }
  }

  // 1. 指定的 targets
  let targetYamlPaths = targetsStr ? targetsStr.split(',').map((s) => s.trim()) : [];
  
  const parentId = parentDoc.meta?.id || parentBase;

  // 2. 自动搜索关联的子分镜文件 (独立文件模式)
  if (targetYamlPaths.length === 0) {
      const storyboardDir = path.dirname(absoluteParentYamlPath);
      const files = await fs.readdir(storyboardDir);
      
      const siblingYamls = [];
      for (const file of files) {
          if (file.endsWith('.yaml') && file !== path.basename(absoluteParentYamlPath)) {
              const filePath = path.join(storyboardDir, file);
              try {
                  const content = await fs.readFile(filePath, 'utf-8');
                  const docs = yaml.loadAll(content).filter(Boolean);
                  const doc = docs[0];
                  if (doc?.meta?.parent === parentId) {
                      siblingYamls.push({ 
                        path: filePath, 
                        sequence: Number(doc.content?.sequence || doc.meta?.sequence || 0),
                        id: doc.meta?.id || file
                      });
                  }
              } catch (e) { /* 忽略损坏的 YAML */ }
          }
      }
      
      if (siblingYamls.length > 0) {
          // 按序号排序，序号相同按 ID 字母序
          siblingYamls.sort((a, b) => (a.sequence - b.sequence) || a.id.localeCompare(b.id));
          targetYamlPaths = siblingYamls.map(y => y.path);
          log(`自动发现 ${targetYamlPaths.length} 个子分镜文件，归属于父 ID: ${parentId}`);
      }
  }

  // 3. 回退到多文档模式 (Multi-doc in same file)
  if (targetYamlPaths.length === 0 && parentDocs.length > 1) {
    targetYamlPaths = [parentYamlArg];
    log(`未发现独立子分镜文件，回退到单文件多文档回填模式。`);
  }

  const totalSubImages = subImagesPaths.length;
  const targetDocs = [];
  const claimedSubImageIndexes = new Set();

  for (const targetYaml of targetYamlPaths) {
    const absTargetYaml = path.isAbsolute(targetYaml) ? targetYaml : path.resolve(process.cwd(), targetYaml);
    if (!(await fileExists(absTargetYaml))) {
      console.warn(`[Warning] 找不到回填目标文件: ${absTargetYaml}。跳过。`);
      continue;
    }

    const raw = await fs.readFile(absTargetYaml, 'utf-8');
    const docs = yaml.loadAll(raw).filter(Boolean);
    const assignments = new Array(docs.length).fill(null);

    for (let docIdx = 0; docIdx < docs.length; docIdx += 1) {
      const doc = docs[docIdx];
      const explicitGridIndex = getExplicitGridIndex(doc);
      if (explicitGridIndex == null) continue;
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

      for (let docIdx = 0; docIdx < state.docs.length; docIdx += 1) {
        const assignedIndex = state.assignments[docIdx];
        if (assignedIndex == null || assignedIndex >= totalSubImages) continue;

        const doc = state.docs[docIdx];
        const subPath = subImagesPaths[assignedIndex];

        if (!doc.tasks) doc.tasks = {};
        if (!doc.tasks.image) doc.tasks.image = {};
        if (!doc.tasks.image.latest) doc.tasks.image.latest = {};

        doc.tasks.image.latest.status = 'success';
        doc.tasks.image.latest.output = subPath;
        doc.tasks.image.latest.updated_at = new Date().toISOString();
        
        // 确保建立父子关系锚点
        if (!doc.meta) doc.meta = {};
        if (!doc.meta.parent) doc.meta.parent = parentId;

        changed = true;
        log(`已成功回填 ${path.basename(state.targetYaml)} (doc ${docIdx}): ${subPath}`);
      }

      if (changed) {
        const updatedYaml = state.docs.map((doc) =>
          yaml.dump(doc, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false })
        ).join('---\n');
        await fs.writeFile(state.absTargetYaml, updatedYaml, 'utf-8');
      }
    } catch (error) {
      log(`[ERROR] 回填 ${state.targetYaml} 失败 (逻辑继续执行): ${error.message}`);
    }
  }

  console.log(JSON.stringify({ success: true, outputs: subImagesPaths }, null, 2));
  return { outputs: subImagesPaths };
}

async function main() {
  await runSplitGrid(process.argv.slice(2));
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error('[split-grid] Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
