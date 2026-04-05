#!/usr/bin/env bun
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_SKILL_NAME = 'mangou';

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

type ResetWorkspaceOptions = {
  packageRoot?: string;
  workspaceRoot?: string;
  skillName?: string;
};

export async function resetTestWorkspace({
  packageRoot = DEFAULT_PACKAGE_ROOT,
  workspaceRoot,
  skillName = DEFAULT_SKILL_NAME,
}: ResetWorkspaceOptions = {}) {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const resolvedWorkspaceRoot = workspaceRoot
    ? path.resolve(workspaceRoot)
    : path.join(resolvedPackageRoot, 'workspace');
  const bundledSkillRoot = path.join(resolvedPackageRoot, 'bundled-skills', skillName);

  if (!(await pathExists(bundledSkillRoot))) {
    throw new Error(`Missing bundled skill: ${bundledSkillRoot}. Run npm run build:skill first.`);
  }

  await fs.rm(resolvedWorkspaceRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(resolvedWorkspaceRoot, '.agent', 'skills'), { recursive: true });

  const installedSkillRoot = path.join(resolvedWorkspaceRoot, '.agent', 'skills', skillName);
  await copyDir(bundledSkillRoot, installedSkillRoot);

  return {
    workspaceRoot: resolvedWorkspaceRoot,
    installedSkillRoot,
  };
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
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
  resetTestWorkspace({
    packageRoot: typeof args.root === 'string' ? args.root : DEFAULT_PACKAGE_ROOT,
    workspaceRoot: typeof args.workspace === 'string' ? args.workspace : undefined,
    skillName: typeof args.skill === 'string' ? args.skill : DEFAULT_SKILL_NAME,
  })
    .then((result) => {
      console.log(JSON.stringify({ success: true, data: result }, null, 2));
    })
    .catch((error) => {
      console.error('[reset-test-workspace] Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
