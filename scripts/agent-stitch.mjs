import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'js-yaml';
import { listLatestTasks } from './tasks-jsonl.mjs';

const execAsync = promisify(exec);

export function inferProjectIdFromCwd() {
  const cwd = path.resolve(process.cwd());
  const marker = `${path.sep}projects${path.sep}`;
  const index = cwd.lastIndexOf(marker);
  if (index === -1) return null;
  const rest = cwd.slice(index + marker.length);
  const [projectId] = rest.split(path.sep);
  return projectId || null;
}

export function inferProjectRootFromCwd() {
  const cwd = path.resolve(process.cwd());
  const marker = `${path.sep}projects${path.sep}`;
  const index = cwd.lastIndexOf(marker);
  if (index === -1) return null;
  const projectId = inferProjectIdFromCwd();
  if (!projectId) return null;
  return cwd.slice(0, index + marker.length + projectId.length);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function stitch(projectRoot, outputName = 'output.mp4') {
  if (!projectRoot) throw new Error('projectRoot is required');
  
  const tasks = await listLatestTasks(projectRoot);
  const storyboardsDir = path.join(projectRoot, 'storyboards');
  
  // 1. Get all storyboard YAMLs in sequence
  let yamlFiles = [];
  try {
    yamlFiles = (await fs.readdir(storyboardsDir))
      .filter(f => f.endsWith('.yaml'))
      .sort();
  } catch (err) {
    throw new Error(`Failed to read storyboards directory: ${err.message}`);
  }

  const videoPaths = [];
  for (const file of yamlFiles) {
    const yamlPath = `storyboards/${file}`;
    // Find the latest successful video task for this YAML
    const task = tasks.find(t => t.ref?.yamlPath === yamlPath && t.type === 'video' && t.status === 'completed');
    if (task && task.output) {
        // Output might be a string (relative path) or an object with files array
        const output = typeof task.output === 'string' ? task.output : (task.output.files?.[0] || task.output.urls?.[0]);
        if (output && !output.startsWith('http')) {
          videoPaths.push(output);
        }
    }
  }

  if (videoPaths.length === 0) {
    throw new Error('No completed video tasks found for the storyboards in this project.');
  }

  const outputDir = path.join(projectRoot, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputName);

  // 2. Create concat list for ffmpeg
  const listPath = path.join(outputDir, 'concat_list.txt');
  const listContent = videoPaths
    .map(p => `file '${path.resolve(projectRoot, p)}'`)
    .join('\n');
  
  await fs.writeFile(listPath, listContent);

  // 3. Execute FFmpeg
  console.error(`[mangou] Stitching ${videoPaths.length} videos into ${outputPath}...`);
  try {
    const command = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -y "${outputPath}"`;
    await execAsync(command);
    return outputPath;
  } catch (error) {
    throw new Error(`FFmpeg stitch failed: ${error.message}`);
  } finally {
    await fs.unlink(listPath).catch(() => {});
  }
}

export async function main() {
  const [projectIdArg] = process.argv.slice(2);
  const projectRoot = inferProjectRootFromCwd();

  if (!projectRoot) {
    console.error('Usage: node agent-stitch.mjs (run inside a project directory)');
    process.exit(1);
  }

  const outputPath = await stitch(projectRoot);
  console.log(JSON.stringify({ success: true, url: outputPath, path: outputPath }, null, 2));
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error('[mangou] Stitch Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
