import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import yaml from 'js-yaml';
import { listLatestTasks } from './tasks-jsonl.mjs';

const execAsync = promisify(exec);
const DEFAULT_IMAGE_SEGMENT_DURATION_SECONDS = 4;

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

function extractOutputPath(output) {
  const candidate = typeof output === 'string'
    ? output
    : output?.files?.[0] || output?.urls?.[0] || '';
  if (!candidate || typeof candidate !== 'string' || candidate.startsWith('http')) {
    return '';
  }
  return candidate;
}

function isSuccessfulStatus(status) {
  return status === 'success' || status === 'completed';
}

function parseDurationSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*s?$/i);
    if (match) {
      return Number(match[1]);
    }
  }
  return DEFAULT_IMAGE_SEGMENT_DURATION_SECONDS;
}

async function readStoryboardDoc(storyboardsDir, filename) {
  const raw = await fs.readFile(path.join(storyboardsDir, filename), 'utf-8');
  const docs = yaml.loadAll(raw).filter(Boolean);
  return docs[0] || null;
}

function findLatestOutput(tasks, yamlPath, type) {
  const task = tasks.find(
    (item) =>
      item.ref?.yamlPath === yamlPath &&
      item.type === type &&
      isSuccessfulStatus(item.status)
  );
  return task ? extractOutputPath(task.output) : '';
}

async function createImageSegment({
  projectRoot,
  outputDir,
  imagePath,
  durationSeconds,
  index,
}) {
  const segmentPath = path.join(outputDir, `.stitch-segment-${String(index + 1).padStart(3, '0')}.mp4`);
  const command = [
    'ffmpeg',
    '-loop', '1',
    '-i', `"${path.resolve(projectRoot, imagePath)}"`,
    '-t', String(durationSeconds),
    '-vf', '"scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p"',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-y', `"${segmentPath}"`,
  ].join(' ');
  await execAsync(command);
  return segmentPath;
}

async function collectStoryboardSegments(projectRoot, tasks) {
  const storyboardsDir = path.join(projectRoot, 'storyboards');
  let yamlFiles = [];
  try {
    yamlFiles = (await fs.readdir(storyboardsDir))
      .filter((name) => name.endsWith('.yaml'))
      .sort();
  } catch (err) {
    throw new Error(`Failed to read storyboards directory: ${err.message}`);
  }

  const segments = [];
  for (const file of yamlFiles) {
    const yamlPath = `storyboards/${file}`;
    const doc = await readStoryboardDoc(storyboardsDir, file);
    const videoPath = findLatestOutput(tasks, yamlPath, 'video');
    if (videoPath) {
      segments.push({ mode: 'video', path: videoPath, yamlPath });
      continue;
    }

    const imagePath =
      findLatestOutput(tasks, yamlPath, 'image') ||
      extractOutputPath(doc?.tasks?.image?.latest?.output);
    if (!imagePath) {
      continue;
    }

    segments.push({
      mode: 'image',
      path: imagePath,
      yamlPath,
      durationSeconds: parseDurationSeconds(doc?.content?.duration),
    });
  }

  return segments;
}

export async function stitch(projectRoot, outputName = 'output.mp4') {
  if (!projectRoot) throw new Error('projectRoot is required');

  const tasks = await listLatestTasks(projectRoot);
  const segments = await collectStoryboardSegments(projectRoot, tasks);
  if (segments.length === 0) {
    throw new Error('No completed video tasks found for the storyboards in this project.');
  }

  const outputDir = path.join(projectRoot, 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputName);

  const materializedSegments = [];
  try {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.mode === 'video') {
        materializedSegments.push(path.resolve(projectRoot, segment.path));
        continue;
      }
      const clipPath = await createImageSegment({
        projectRoot,
        outputDir,
        imagePath: segment.path,
        durationSeconds: segment.durationSeconds,
        index,
      });
      materializedSegments.push(clipPath);
    }

    const listPath = path.join(outputDir, 'concat_list.txt');
    const listContent = materializedSegments
      .map((segmentPath) => `file '${segmentPath}'`)
      .join('\n');
    await fs.writeFile(listPath, listContent);

    console.error(`[mangou] Stitching ${materializedSegments.length} segments into ${outputPath}...`);
    try {
      const command = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -y "${outputPath}"`;
      await execAsync(command);
      return outputPath;
    } finally {
      await fs.unlink(listPath).catch(() => {});
    }
  } finally {
    await Promise.all(
      materializedSegments
        .filter((segmentPath) => path.basename(segmentPath).startsWith('.stitch-segment-'))
        .map((segmentPath) => fs.unlink(segmentPath).catch(() => {}))
    );
  }
}

export async function main() {
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
