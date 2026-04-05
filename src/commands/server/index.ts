import { startHttpServer } from "../../server/server";
import path from "node:path";

/**
 * Start the readonly mirror server (SSE).
 */
export async function start(positionals: string[], flags: any) {
  const port = parseInt(flags.port || positionals[0] || "3000", 10);
  const dataRoot = path.join(process.cwd(), "projects");

  console.log(`[mangou] Starting readonly mirror server on port ${port}...`);
  console.log(`[mangou] Watching for changes in: ${dataRoot}`);

  await startHttpServer({
    appRoot: process.cwd(),
    dataRoot: dataRoot,
    port: port
  });
}
