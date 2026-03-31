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

async function inferContext(absoluteYamlPath) {
  const normalized = path.resolve(absoluteYamlPath);
  const segments = normalized.split(path.sep).filter(Boolean);
  const projectsIndex = segments.lastIndexOf('projects');
  const projectId = projectsIndex >= 0 ? segments[projectsIndex + 1] : '';
  if (!projectId) throw new Error('Cannot infer project context from YAML path');

  const projectsRoot = segments.slice(0, projectsIndex + 1).join(path.sep);
  const projectRoot = path.join(`${path.sep}${projectsRoot}`, projectId);

  return { projectId, projectRoot };
}

async function main() {
  const args = process.argv.slice(2);
  const parentYamlArg = args[0];
  const gridArgIndex = args.indexOf('--grid');
  const gridStr = gridArgIndex !== -1 ? args[gridArgIndex + 1] : '2x2';
  const targetsArgIndex = args.indexOf('--targets');
  const targetsStr = targetsArgIndex !== -1 ? args[targetsArgIndex + 1] : '';

  if (!parentYamlArg) {
    console.error('Usage: node split-grid.mjs <parent-yaml> --grid NxM [--targets yaml1,yaml2,...]');
    process.exit(1);
  }

  const { projectRoot } = await inferContext(path.resolve(process.cwd(), parentYamlArg));
  const { cols, rows } = parseGrid(gridStr);
  const parentYamlRaw = await fs.readFile(parentYamlArg, 'utf-8');
  const parentDoc = yaml.load(parentYamlRaw);
  const parentImagePathRelative = parentDoc?.tasks?.image?.latest?.output;
  if (!parentImagePathRelative) throw new Error(`Parent YAML ${parentYamlArg} has no tasks.image.latest.output`);

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

  const targetYamlPaths = targetsStr ? targetsStr.split(',').map((s) => s.trim()) : [];
  for (let i = 0; i < Math.min(subImagesPaths.length, targetYamlPaths.length); i += 1) {
    const targetYaml = targetYamlPaths[i];
    const subPath = subImagesPaths[i];
    const absTargetYaml = path.resolve(process.cwd(), targetYaml);

    try {
      const raw = await fs.readFile(absTargetYaml, 'utf-8');
      const doc = yaml.load(raw);

      if (!doc.tasks) doc.tasks = {};
      if (!doc.tasks.image) doc.tasks.image = {};
      if (!doc.tasks.image.latest) doc.tasks.image.latest = {};

      doc.tasks.image.latest.status = 'success';
      doc.tasks.image.latest.output = subPath;
      doc.tasks.image.latest.updated_at = new Date().toISOString();

      await fs.writeFile(absTargetYaml, yaml.dump(doc), 'utf-8');
      log(`Back-filled ${targetYaml} with ${subPath}`);
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
