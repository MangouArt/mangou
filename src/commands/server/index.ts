import { startHttpServer } from "../../server/server";
import path from "node:path";
import fs from "node:fs/promises";

/**
 * Start the readonly mirror server (SSE).
 */
export async function start(positionals: string[], flags: any) {
  const port = parseInt(flags.port || positionals[0] || "3000", 10);
  
  // Use --workspace or --data-root flags if provided, otherwise default to CWD
  let dataRoot = flags.workspace || flags.dataRoot || process.cwd();
  
  // Intelligence: If dataRoot does not contain /projects but a /projects subfolder exists, use that
  try {
    const projectsPath = path.join(dataRoot, "projects");
    const stats = await fs.stat(projectsPath);
    if (stats.isDirectory()) {
      dataRoot = projectsPath;
    }
  } catch (e) {
    // projects/ subfolder doesn't exist or is not a directory, stick with dataRoot
  }

  // Validate dataRoot exists
  try {
    const stats = await fs.stat(dataRoot);
    if (!stats.isDirectory()) {
      throw new Error(`Data root "${dataRoot}" is not a directory.`);
    }
  } catch (e: any) {
    throw new Error(`Invalid data root: ${dataRoot}. ${e.message}`);
  }

  console.log(`[mangou] Starting readonly mirror server on port ${port}...`);
  console.log(`[mangou] Data Root: ${dataRoot}`);

  await startHttpServer({
    appRoot: process.cwd(),
    dataRoot: dataRoot,
    port: port
  });
}
