import fs from "node:fs/promises";
import path from "node:path";
import { stitch as runStitch } from "../../stitch";

/**
 * Initialize a new project directory structure.
 */
export async function init(positionals: string[], flags: any) {
  const name = flags.name || positionals[0];
  if (!name) throw new Error("Project name is required. Use --name [name] or positional arg.");

  const projectRoot = path.join(process.cwd(), "projects", name);
  console.log(`[mangou] Initializing project: ${name} at ${projectRoot}`);

  const dirs = [
    "storyboards",
    "asset_defs/chars",
    "asset_defs/scenes",
    "asset_defs/props",
    "assets/images",
    "assets/videos"
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(projectRoot, dir), { recursive: true });
  }

  // Create project.json
  const projectMeta = {
    id: name,
    name: name,
    created_at: new Date().toISOString()
  };
  await fs.writeFile(path.join(projectRoot, "project.json"), JSON.stringify(projectMeta, null, 2));

  console.log(`[mangou] Project "${name}" initialized successfully.`);
}

/**
 * Stitch all storyboard videos into a final movie.
 */
export async function stitch(positionals: string[], flags: any) {
  const projectId = flags.id || positionals[0];
  if (!projectId) throw new Error("Project ID is required.");

  const projectRoot = path.join(process.cwd(), "projects", projectId);
  await runStitch(projectRoot);
}
