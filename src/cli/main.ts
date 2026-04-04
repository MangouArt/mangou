import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { runAIGC } from "./generate";
import { runSplitGrid, scaffoldGridChildren } from "./split";
import { stitch, inferProjectRootFromCwd } from "./stitch";

declare const Bun: any;

// Asset resolution (Runtime-agnostic)
const isBun = typeof (globalThis as any).Bun !== "undefined";
const getAssetPath = (relative: string) => {
  // In development/test, use relative to __dirname
  // In Bun build, we might need different logic, but for now this is safe for both
  return path.resolve(__dirname, relative);
};

const workspaceTemplateZip = getAssetPath("./assets/workspace_template.zip");
const mangouSkillZip = getAssetPath("../../bundled-skills/mangou.zip");

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
  const tempPath = path.join(require("node:os").tmpdir(), `mangou-temp-${crypto.randomUUID()}.zip`);
  try {
    const data = await fs.readFile(zipPath);
    await fs.writeFile(tempPath, data);
    
    const { spawnSync } = require("node:child_process");
    const proc = spawnSync("unzip", ["-o", tempPath, "-d", targetDir]);
    if (proc.status !== 0) {
      throw new Error(`Failed to unzip: ${proc.stderr?.toString()}`);
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
      
      case "project create": {
        const workspaceRoot = String(flags.workspace || positionals[1] || process.cwd());
        const projectId = String(flags.project || positionals[0] || "");
        const projectName = String(flags.name || projectId || "new-project");
        const description = String(flags.description || "");
        
        const result = await createProject({
          workspaceRoot,
          projectId,
          name: projectName,
          description,
        });
        console.log(JSON.stringify({ success: true, data: result }, null, 2));
        return;
      }

      case "project scaffold": {
        const gridYamlPath = String(flags.grid || positionals[0] || "");
        const projectRoot = String(flags.projectRoot || "");
        const result = await scaffoldGridChildren({
          gridYamlPath,
          projectRoot,
        });
        console.log(JSON.stringify({ success: true, data: result }, null, 2));
        return;
      }

      case "web start": {
        const workspaceRoot = String(flags.workspace || positionals[0] || process.cwd());
        const port = Number(flags.port || 3000);
        const result = await startWebServer({ workspaceRoot, port });
        console.log(JSON.stringify({ success: true, data: result }, null, 2));
        return;
      }

      case "web stop": {
        const workspaceRoot = String(flags.workspace || positionals[0] || process.cwd());
        const result = await stopWebServer({ workspaceRoot });
        console.log(JSON.stringify({ success: true, data: result }, null, 2));
        return;
      }

      case "web status": {
        const workspaceRoot = String(flags.workspace || positionals[0] || process.cwd());
        const result = await getWebStatus({ workspaceRoot });
        console.log(JSON.stringify({ success: true, data: result }, null, 2));
        return;
      }
      
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
  mangou project create --project <id> [--name <name>] [--workspace <path>]
  mangou project scaffold --grid <master_yaml>
  mangou generate image|video <yaml>
  mangou grid split <yaml> [--grid NxM]
  mangou stitch [projectRoot] [--output <filename>]
  mangou web start|stop|status [--workspace <path>] [--port <number>]
        `);
        return;
    }
  } catch (error: any) {
    console.error(`[mangou] Error: ${error.message}`);
    process.exit(1);
  }
}

// --- Helpers migrated from web-control.mjs ---

async function readNumberFile(filePath: string) {
  try {
    const raw = (await fs.readFile(filePath, "utf-8")).trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number | null) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const RUNTIME_DIR = ".mangou";
const PID_FILE = "server.pid";
const PORT_FILE = "server.port";

function resolveRuntimePath(workspaceRoot: string, filename: string) {
  return path.join(workspaceRoot, RUNTIME_DIR, filename);
}

export async function getWebStatus({ workspaceRoot }: { workspaceRoot: string }) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const pid = await readNumberFile(resolveRuntimePath(resolvedRoot, PID_FILE));
  const port = await readNumberFile(resolveRuntimePath(resolvedRoot, PORT_FILE));

  if (!pid || !isProcessRunning(pid)) {
    return { status: "stopped", pid: null, port: port ?? null };
  }

  return {
    status: "running",
    pid,
    port,
    url: `http://127.0.0.1:${port}`,
  };
}

export async function startWebServer({ workspaceRoot, port = 3000 }: { workspaceRoot: string; port?: number }) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const current = await getWebStatus({ workspaceRoot: resolvedRoot });
  if (current.status === "running") return { ...current, reused: true };

  const { spawn } = require("node:child_process");
  const logPath = resolveRuntimePath(resolvedRoot, "server.log");
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  
  const fd = require("node:fs").openSync(logPath, "a");
  
  // In Bun, we still use node:child_process for detached spawning of the background server
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/http-server.ts"], {
    detached: true,
    stdio: ["ignore", fd, fd],
    env: {
      ...process.env,
      MANGOU_HOME: resolvedRoot,
      MANGOU_WEB_PORT: String(port),
    }
  });

  child.unref();

  await fs.writeFile(resolveRuntimePath(resolvedRoot, PID_FILE), String(child.pid));
  await fs.writeFile(resolveRuntimePath(resolvedRoot, PORT_FILE), String(port));

  return { status: "running", pid: child.pid, port, url: `http://127.0.0.1:${port}` };
}

export async function stopWebServer({ workspaceRoot }: { workspaceRoot: string }) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const status = await getWebStatus({ workspaceRoot: resolvedRoot });
  if (status.status !== "running" || !status.pid) return { stopped: false };

  try {
    process.kill(status.pid, "SIGTERM");
    await fs.unlink(resolveRuntimePath(resolvedRoot, PID_FILE)).catch(() => {});
    return { stopped: true };
  } catch {
    return { stopped: false };
  }
}

export async function createProject({ workspaceRoot, projectId, name, description = "" }: any) {
  const resolvedRoot = path.resolve(workspaceRoot);
  const safeId = projectId.replace(/[^a-z0-9]+/g, "-").toLowerCase();
  const projectDir = path.join(resolvedRoot, "projects", safeId);

  await fs.mkdir(path.join(projectDir, "storyboards"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "asset_defs", "chars"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "asset_defs", "scenes"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "asset_defs", "props"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "assets", "images"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "assets", "videos"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "tasks.jsonl"), "", { flag: "a" });

  const metadata = { id: safeId, name: name || safeId, description, createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(projectDir, "project.json"), JSON.stringify(metadata, null, 2));

  // Update projects.json index
  const indexPath = path.join(resolvedRoot, "projects.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
  index.projects = index.projects.filter((p: any) => p.id !== safeId);
  index.projects.push({ id: safeId, name: metadata.name, createdAt: metadata.createdAt });
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

  return { id: safeId, projectRoot: projectDir };
}

if (isBun ? (import.meta as any).main : require.main === module) {
  main();
}
