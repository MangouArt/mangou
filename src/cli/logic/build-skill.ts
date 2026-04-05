#!/usr/bin/env bun
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { build } from 'esbuild';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const DEFAULT_SKILL_NAME = 'mangou';
const execFileAsync = promisify(execFile);
const RUNTIME_SCRIPT_FILES = [
  'aigc-provider-template',
  'aigc-provider-bltai',
  'aigc-provider-kie',
  'aigc-provider-registry',
  'aigc-runner',
  'agent-generate',
  'agent-stitch',
  'bltai-lib',
  'http-server',
  'http-server.ts',
  'mangou',
  'project-scaffold',
  'register-alias.ts',
  'split-grid',
  'tasks-jsonl',
  'web-control',
];
const RAW_SCRIPT_FILES = new Set([
  'aigc-provider-template',
  'aigc-provider-bltai',
  'aigc-provider-kie',
  'mangou',
]);

async function writeExecutableScript(targetPath, content) {
  const normalized = String(content).replace(/^(#![^\n]*\n)+/, '');
  await fs.writeFile(targetPath, `#!/usr/bin/env bun\n${normalized}`);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function emptyDir(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await ensureDir(targetPath);
}

async function copyDir(src, dest, options = {}) {
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

async function createZipArchive(bundleRoot, archivePath) {
  await fs.rm(archivePath, { force: true });
  await execFileAsync('zip', ['-qr', archivePath, '.'], { cwd: bundleRoot });
}

export async function buildSkillBundle({
  packageRoot = DEFAULT_PACKAGE_ROOT,
  skillName = DEFAULT_SKILL_NAME,
  outputRoot,
  distSource,
} = {}) {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const skillSourceRoot = path.join(resolvedPackageRoot, 'skill-src', skillName);
  const workspaceTemplateRoot = path.join(resolvedPackageRoot, 'workspace_template');
  const resolvedOutputRoot = outputRoot
    ? path.resolve(outputRoot)
    : path.join(resolvedPackageRoot, 'bundled-skills', skillName);
  const resolvedArchivePath = path.join(path.dirname(resolvedOutputRoot), `${skillName}.zip`);
  const resolvedDistSource = distSource
    ? path.resolve(distSource)
    : path.join(resolvedPackageRoot, 'dist');

  if (!(await pathExists(skillSourceRoot))) {
    throw new Error(`Missing skill source: ${skillSourceRoot}`);
  }
  if (!(await pathExists(workspaceTemplateRoot))) {
    throw new Error(`Missing workspace template: ${workspaceTemplateRoot}`);
  }
  if (!(await pathExists(resolvedDistSource))) {
    throw new Error(`Missing frontend build: ${resolvedDistSource}. Run npm run build first.`);
  }

  await emptyDir(resolvedOutputRoot);
  await copyDir(skillSourceRoot, resolvedOutputRoot);
  await copyDir(workspaceTemplateRoot, path.join(resolvedOutputRoot, 'workspace_template'), {
    skipNames: ['.agents'],
  });
  await copyDir(resolvedDistSource, path.join(resolvedOutputRoot, 'dist'));
  // Skip bundling legacy scripts for Bun-based lightweight distribution

  await createZipArchive(resolvedOutputRoot, resolvedArchivePath);

  return {
    skillRoot: resolvedOutputRoot,
    archivePath: resolvedArchivePath,
  };
}

function parseArgs(argv) {
  const args = {};
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
  })
    .then((result) => {
      console.log(JSON.stringify({ success: true, data: result }, null, 2));
    })
    .catch((error) => {
      console.error('[build-skill] Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
