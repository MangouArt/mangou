#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import sharp from 'sharp';

function log(...args) {
  console.error('[split-grid]', ...args);
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

async function main() {
  const args = process.argv.slice(2);
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
    console.error('Usage: node split-grid.mjs <parent-yaml> --grid NxM [--targets yaml1,yaml2,...] [--project-root <path>] [--workspace-root <path>]');
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

  const { cols, rows } = parseGrid(gridStr);
  const parentYamlRaw = await fs.readFile(absoluteParentYamlPath, 'utf-8');
  const parentDocs = yaml.loadAll(parentYamlRaw).filter(Boolean);
  const parentDoc = parentDocs[0];
  
  const parentImagePathRelative = parentDoc?.tasks?.image?.latest?.output;
  if (!parentImagePathRelative) throw new Error(`Parent YAML ${parentYamlArg} has no tasks.image.latest.output in first document`);

  const parentImagePath = path.join(projectRoot, parentImagePathRelative);
  log(`Processing parent image: ${parentImagePath}`);

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

  // Back-filling logic
  let targetYamlPaths = targetsStr ? targetsStr.split(',').map((s) => s.trim()) : [];
  
  // If no targets provided, but parent is multi-doc, use parent as target
  if (targetYamlPaths.length === 0 && parentDocs.length > 1) {
    targetYamlPaths = [parentYamlArg];
  }

  let subImageIndex = 0;
  for (const targetYaml of targetYamlPaths) {
    if (subImageIndex >= subImagesPaths.length) break;

    const absTargetYaml = path.resolve(process.cwd(), targetYaml);
    if (!(await fileExists(absTargetYaml))) {
      console.warn(`[Warning] 找不到回填目标文件: ${absTargetYaml}\n请确保路径相对于 CWD 正确。跳过此文件的回填。`);
      continue;
    }

    try {
      const raw = await fs.readFile(absTargetYaml, 'utf-8');
      const docs = yaml.loadAll(raw).filter(Boolean);
      let changed = false;

      for (let docIdx = 0; docIdx < docs.length; docIdx += 1) {
        if (subImageIndex >= subImagesPaths.length) break;
        
        const doc = docs[docIdx];
        const subPath = subImagesPaths[subImageIndex];

        if (!doc.tasks) doc.tasks = {};
        if (!doc.tasks.image) doc.tasks.image = {};
        if (!doc.tasks.image.latest) doc.tasks.image.latest = {};

        doc.tasks.image.latest.status = 'success';
        doc.tasks.image.latest.output = subPath;
        doc.tasks.image.latest.updated_at = new Date().toISOString();
        
        subImageIndex += 1;
        changed = true;
        log(`Back-filled ${targetYaml} (doc ${docIdx}) with ${subPath}`);
      }

      if (changed) {
        const updatedYaml = docs.map(d => yaml.dump(d, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false })).join('---\n');
        await fs.writeFile(absTargetYaml, updatedYaml, 'utf-8');
      }
    } catch (error) {
      log(`Error back-filling ${targetYaml}: ${error.message}`);
    }
  }

  console.log(JSON.stringify({ success: true, outputs: subImagesPaths }, null, 2));
}

main().catch((error) => {
  console.error('[split-grid] Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
