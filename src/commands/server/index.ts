import { fileURLToPath } from "node:url";
import { startHttpServer } from "../../server/server";
import path from "node:path";
import fs from "node:fs/promises";

const COMMAND_ROOT = path.dirname(fileURLToPath(import.meta.url));

export function resolveServerAppRoot() {
  return path.resolve(COMMAND_ROOT, "../../..");
}

export async function resolveServerDataRoot(inputRoot?: string) {
  let dataRoot = path.resolve(inputRoot || process.cwd());

  try {
    const projectsPath = path.join(dataRoot, "projects");
    const stats = await fs.stat(projectsPath);
    if (stats.isDirectory()) {
      dataRoot = projectsPath;
    }
  } catch {
    // projects/ subfolder doesn't exist or is not a directory, stick with dataRoot
  }

  const stats = await fs.stat(dataRoot);
  if (!stats.isDirectory()) {
    throw new Error(`Data root "${dataRoot}" is not a directory.`);
  }

  return dataRoot;
}

/**
 * Start the readonly mirror server (SSE).
 */
export async function start(positionals: string[], flags: any) {
  const port = parseInt(flags.port || positionals[0] || "3000", 10);

  try {
    const dataRoot = await resolveServerDataRoot(flags.workspace || flags.dataRoot);
    const appRoot = resolveServerAppRoot();

    console.log(`[mangou] Starting readonly mirror server on port ${port}...`);
    console.log(`[mangou] App Root: ${appRoot}`);
    console.log(`[mangou] Data Root: ${dataRoot}`);

    await startHttpServer({
      appRoot,
      dataRoot,
      port,
    });
  } catch (e: any) {
    throw new Error(`Invalid data root: ${flags.workspace || flags.dataRoot || process.cwd()}. ${e.message}`);
  }
}
