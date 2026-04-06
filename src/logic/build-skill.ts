#!/usr/bin/env bun
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { build } from 'esbuild';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_SKILL_NAME = 'mangou';
const execFileAsync = promisify(execFile);

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath: string) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function emptyDir(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await ensureDir(targetPath);
}

async function copyDir(src: string, dest: string, options: any = {}) {
  const skipNames = new Set(options.skipNames || []);
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (skipNames.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, options);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function createZipArchive(bundleRoot: string, archivePath: string) {
  await fs.rm(archivePath, { force: true });
  await execFileAsync('zip', ['-qr', archivePath, '.'], { cwd: bundleRoot });
}

async function buildRuntimeBundle(options: {
  packageRoot: string;
  outputRoot: string;
  archivePath: string;
  distSource: string;
}) {
  const { packageRoot, outputRoot, archivePath, distSource } = options;
  const runtimeRoot = `${outputRoot}-runtime`;
  await emptyDir(runtimeRoot);

  const srcSource = path.join(packageRoot, 'src');
  await copyDir(srcSource, path.join(runtimeRoot, 'src'), { skipNames: ['web'] });

  const workspaceTemplateRoot = path.join(packageRoot, 'workspace_template');
  await copyDir(workspaceTemplateRoot, path.join(runtimeRoot, 'workspace_template'), {
    skipNames: ['.agents'],
  });

  if (await pathExists(distSource)) {
    await copyDir(distSource, path.join(runtimeRoot, 'dist'));
  }

  const runtimeFiles = ['package.json', 'tsconfig.json'];
  for (const file of runtimeFiles) {
    const filePath = path.join(packageRoot, file);
    if (await pathExists(filePath)) {
      await fs.copyFile(filePath, path.join(runtimeRoot, file));
    }
  }

  await createZipArchive(runtimeRoot, archivePath);
  return runtimeRoot;
}

export interface BuildOptions {
  packageRoot?: string;
  skillName?: string;
  outputRoot?: string;
  distSource?: string;
  includeDistInSkill?: boolean;
}

export async function buildSkillBundle(options: BuildOptions = {}) {
  const {
    packageRoot = DEFAULT_PACKAGE_ROOT,
    skillName = DEFAULT_SKILL_NAME,
    outputRoot,
    distSource,
    includeDistInSkill = false,
  } = options;

  const resolvedPackageRoot = path.resolve(packageRoot);
  const skillMetadataRoot = path.join(resolvedPackageRoot, 'skill-src', skillName);
  const resolvedOutputRoot = outputRoot
    ? path.resolve(outputRoot)
    : path.join(resolvedPackageRoot, 'bundled-skills', skillName);
  const resolvedArchivePath = path.join(path.dirname(resolvedOutputRoot), `${skillName}.zip`);
  const resolvedRuntimeArchivePath = path.join(path.dirname(resolvedOutputRoot), `${skillName}-runtime.zip`);
  const resolvedDistSource = distSource
    ? path.resolve(distSource)
    : path.join(resolvedPackageRoot, 'dist');

  console.log(`[build-skill] Building bundle for "${skillName}"...`);
  console.log(`[build-skill] Package Root: ${resolvedPackageRoot}`);

  if (!(await pathExists(skillMetadataRoot))) {
    throw new Error(`Missing skill metadata: ${skillMetadataRoot}`);
  }
  const workspaceTemplateRoot = path.join(resolvedPackageRoot, 'workspace_template');
  if (!(await pathExists(workspaceTemplateRoot))) {
    throw new Error(`Missing workspace template: ${workspaceTemplateRoot}`);
  }
  if (!(await pathExists(resolvedDistSource))) {
    console.warn(`[build-skill] Warning: Missing frontend build at ${resolvedDistSource}. Creating empty dist.`);
  }

  // 1. Prepare output
  await emptyDir(resolvedOutputRoot);

  // 2. Copy metadata (SKILL.md, knowledge/)
  await copyDir(skillMetadataRoot, resolvedOutputRoot);

  // 3. Create ZIP
  console.log(`[build-skill] Archiving to ${resolvedArchivePath}...`);
  await createZipArchive(resolvedOutputRoot, resolvedArchivePath);

  let runtimeRoot: string | undefined;
  console.log(`[build-skill] Archiving unified runtime bundle to ${resolvedRuntimeArchivePath}...`);
  runtimeRoot = await buildRuntimeBundle({
    packageRoot: resolvedPackageRoot,
    outputRoot: resolvedOutputRoot,
    archivePath: resolvedRuntimeArchivePath,
    distSource: resolvedDistSource,
  });

  return {
    skillRoot: resolvedOutputRoot,
    archivePath: resolvedArchivePath,
    distRoot: runtimeRoot,
    distArchivePath: resolvedRuntimeArchivePath,
  };
}

function parseArgs(argv: string[]) {
  const args: any = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const args = parseArgs(process.argv.slice(2));
  buildSkillBundle({
    packageRoot: args.root || DEFAULT_PACKAGE_ROOT,
    skillName: args.skill || DEFAULT_SKILL_NAME,
    outputRoot: args.output,
    distSource: args.dist,
    includeDistInSkill: args['include-dist'] === true,
  })
    .then((result) => {
      console.log(JSON.stringify({ success: true, data: result }, null, 2));
    })
    .catch((error) => {
      console.error('[build-skill] Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
