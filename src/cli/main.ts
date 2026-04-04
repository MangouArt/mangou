import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runAIGC } from "./generate";
import { runSplitGrid, scaffoldGridChildren } from "./split";
import { stitch, inferProjectRootFromCwd } from "./stitch";
import { startHttpServer } from "./server/main";

declare const Bun: any;

const isBun = typeof (globalThis as any).Bun !== "undefined";
const getAssetPath = (relative: string) => {
  return path.resolve(__dirname, relative);
};

const workspaceTemplateDir = getAssetPath("../../workspace_template");
const workspaceTemplateZip = getAssetPath("./assets/workspace_template.zip");
const mangouSkillZip = getAssetPath("../../bundled-skills/mangou.zip");

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".agents" || entry.name === "node_modules" || entry.name === ".git") continue;
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function initWorkspace({ workspaceRoot }: { workspaceRoot: string }) {
  const resolvedRoot = path.resolve(workspaceRoot);
  await fs.mkdir(resolvedRoot, { recursive: true });
  
  if (!(await fileExists(path.join(resolvedRoot, "projects.json")))) {
    console.error(`[mangou] Initializing new workspace at ${resolvedRoot}...`);
    if (await fileExists(workspaceTemplateDir)) {
      await copyDir(workspaceTemplateDir, resolvedRoot);
    }
  }
  return { workspaceRoot: resolvedRoot };
}

export function parseCliArgs(argv: string[]) {
  const flags: any = {};
  const rawPositionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
      continue;
    }
    rawPositionals.push(token);
  }

  // Handle nested commands like "workspace init"
  if (["workspace", "project", "web", "generate", "grid", "skill"].includes(rawPositionals[0]) && rawPositionals[1]) {
    return {
      commandPath: [rawPositionals[0], rawPositionals[1]],
      positionals: rawPositionals.slice(2),
      flags,
    };
  }

  return {
    commandPath: [rawPositionals[0] || "help"],
    positionals: rawPositionals.slice(1),
    flags,
  };
}

export async function main() {
  const { commandPath, positionals, flags } = parseCliArgs(process.argv.slice(2));
  const key = commandPath.join(" ");
  try {
    switch (key) {
      case "workspace init":
        return await initWorkspace({ workspaceRoot: String(flags.workspace || positionals[0] || process.cwd()) });
      case "help":
      default:
        console.log("Mangou CLI - All Unified");
        return;
    }
  } catch (err: any) {
    console.error(`[mangou] Error: ${err.message}`);
    process.exit(1);
  }
}

if (isBun ? (import.meta as any).main : require.main === module) {
  main();
}
