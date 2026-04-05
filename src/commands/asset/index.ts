import { runAIGC } from "../../generate";
import path from "node:path";

/**
 * Generate AIGC content for an asset definition YAML.
 */
export async function generate(positionals: string[], flags: any) {
  const yamlPath = flags.path || positionals[0];
  if (!yamlPath) throw new Error("Asset YAML path is required (e.g. asset_defs/chars/hero.yaml).");

  const resolvedPath = path.resolve(process.cwd(), yamlPath);
  console.log(`[mangou] Generating image for asset: ${yamlPath}`);
  
  // Asset generation is always image-based for now.
  await runAIGC({ yamlPath: resolvedPath, type: "image" });
}
