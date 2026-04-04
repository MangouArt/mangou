import { runAIGC } from "../../generate";
import { runSplitGrid } from "../../split";
import path from "node:path";

/**
 * Generate AIGC content for a single storyboard YAML.
 */
export async function generate(positionals: string[], flags: any) {
  const yamlPath = flags.path || positionals[0];
  if (!yamlPath) throw new Error("Storyboard YAML path is required (e.g. storyboards/shot1.yaml).");

  const type = flags.type || "image"; // Default to image
  const resolvedPath = path.resolve(process.cwd(), yamlPath);

  console.log(`[mangou] Generating ${type} for storyboard: ${yamlPath}`);
  await runAIGC({ yamlPath: resolvedPath, type });
}

/**
 * Split a parent storyboard image into NxM grid children.
 */
export async function split(positionals: string[], flags: any) {
  const yamlPath = flags.path || positionals[0];
  if (!yamlPath) throw new Error("Parent storyboard YAML path is required.");

  const resolvedPath = path.resolve(process.cwd(), yamlPath);
  console.log(`[mangou] Splitting storyboard grid: ${yamlPath}`);
  await runSplitGrid({ yamlPath: resolvedPath });
}
