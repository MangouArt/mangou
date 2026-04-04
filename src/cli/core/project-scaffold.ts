import fs from "node:fs/promises";
import path from "node:path";

/**
 * Initialize a new project directory structure.
 * This is a pure physical scaffolding operation.
 */
export async function initializeProjectStructure(projectRoot: string, script: string = '') {
  // Ensure base directories exist
  const dirs = [
    'asset_defs/chars',
    'asset_defs/scenes',
    'asset_defs/props',
    'storyboards',
    'assets/images',
    'assets/videos'
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(projectRoot, dir), { recursive: true });
  }

  // Seed with a default storyboard if it doesn't exist
  const mainShotPath = path.join(projectRoot, 'storyboards/main-shot.yaml');
  try {
    await fs.access(mainShotPath);
  } catch {
    await fs.writeFile(mainShotPath, `
meta:
  id: main-shot
  version: "1.0"
content:
  sequence: 1
  title: Default Shot
  story: ${script || 'A new beginning.'}
  scene: A cinematic landscape.
tasks:
  image:
    provider: bltai
    params:
      model: flux.1-schnell
      prompt: A cinematic landscape.
`);
  }
}
