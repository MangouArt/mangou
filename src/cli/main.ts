import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runAIGC } from "./generate";
import { runSplitGrid } from "./split";
import { stitch, inferProjectRootFromCwd } from "./stitch";

declare const Bun: any;

// Asset embedding (Bun logic)
// These will be available as paths in the compiled binary
// @ts-ignore
import workspaceTemplateZip from "./assets/workspace_template.zip" with { type: "file" };
// @ts-ignore
import mangoAigcZip from "../../bundled-skills/mango-aigc.zip" with { type: "file" };
// @ts-ignore
import mangouSkillZip from "../../bundled-skills/mangou.zip" with { type: "file" };

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function parseFlagValue(argv: string[], index: number) {
  const next = argv[index + 1];
  if (!next || next.startsWith("--")) {
    return { value: true, nextIndex: index };
  }
  return { value: next, nextIndex: index + 1 };
}

export function parseCliArgs(argv: string[]) {
  const flags: any = {};
  const rawPositionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = toCamelCase(token.slice(2));
      const { value, nextIndex } = parseFlagValue(argv, i);
      flags[key] = value;
      i = nextIndex;
      continue;
    }
    rawPositionals.push(token);
  }

  const first = rawPositionals[0];
  const second = rawPositionals[1];

  if (["workspace", "project", "web", "generate", "grid", "skill"].includes(first) && second) {
    return {
      commandPath: [first, second],
      positionals: rawPositionals.slice(2),
      flags,
    };
  }

  return {
    commandPath: [first || "help"],
    positionals: rawPositionals.slice(1),
    flags,
  };
}

async function unzipAsset(zipPath: string, targetDir: string) {
  const tempPath = `/tmp/mangou-temp-${crypto.randomUUID()}.zip`;
  try {
    const file = Bun.file(zipPath);
    await Bun.write(tempPath, file);
    
    // @ts-ignore
    const { spawnSync } = require("bun");
    const proc = spawnSync(["unzip", "-o", tempPath, "-d", targetDir]);
    if (!proc.success) {
      throw new Error(`Failed to unzip: ${proc.stderr.toString()}`);
    }
  } finally {
    await fs.unlink(tempPath).catch(() => {});
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
    await unzipAsset(workspaceTemplateZip, resolvedRoot);
  } else {
    console.error(`[mangou] Workspace already exists at ${resolvedRoot}. Updating skills...`);
  }
  
  // Always update/refresh skills in .agents/skills
  const skillsDir = path.join(resolvedRoot, ".agents", "skills");
  await fs.mkdir(skillsDir, { recursive: true });
  
  await unzipAsset(mangoAigcZip, path.join(skillsDir, "mango-aigc"));
  await unzipAsset(mangouSkillZip, path.join(skillsDir, "mangou"));

  console.error(`[mangou] Workspace ready.`);
  return { workspaceRoot: resolvedRoot };
}

export async function main() {
  const argv = process.argv.slice(2);
  const { commandPath, positionals, flags } = parseCliArgs(argv);
  const key = commandPath.join(" ");

  try {
    switch (key) {
      case "workspace init":
        return await initWorkspace({
          workspaceRoot: String(flags.workspace || positionals[0] || process.cwd()),
        });
      
      case "generate image":
      case "generate video":
        return await runAIGC(undefined, argv);
      
      case "grid split":
        return await runSplitGrid(argv);
      
      case "stitch": {
        const projectRoot = positionals[0] ? path.resolve(String(positionals[0])) : inferProjectRootFromCwd();
        if (!projectRoot) throw new Error("Could not infer project root. Run inside a project or specify path.");
        const outputPath = await stitch(projectRoot, flags.output as string);
        console.log(JSON.stringify({ success: true, url: outputPath, path: outputPath }, null, 2));
        return;
      }

      case "help":
      default:
        console.log(`
Mangou AI Studio CLI (Bun Edition)

Usage:
  mangou workspace init [--workspace <path>]
  mangou project create --project <id>
  mangou generate image|video <yaml>
  mangou grid split <yaml> [--grid NxM]
  mangou stitch [projectRoot] [--output <filename>]
        `);
        return;
    }
  } catch (error: any) {
    console.error(`[mangou] Error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
