import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { appendTaskEvent } from "./core/tasks";
import { fileExists, log } from "./logic/generation/utils";
import { inferProjectRoot } from "./core/project-root";

/**
 * Split a parent image into NxM grid and backfill into YAMLs.
 */
export async function runSplitGrid({ yamlPath, projectRoot: overrideProjectRoot }: { yamlPath: string; projectRoot?: string }) {
  const absoluteYamlPath = path.resolve(process.cwd(), yamlPath);
  const projectRoot = overrideProjectRoot ? path.resolve(overrideProjectRoot) : await inferProjectRoot(absoluteYamlPath);
  const relYamlPath = path.relative(projectRoot, absoluteYamlPath).split(path.sep).join("/");

  if (!(await fileExists(absoluteYamlPath))) {
    throw new Error(`Parent YAML not found: ${absoluteYamlPath}`);
  }

  // 1. Read parent YAML
  const raw = await fs.readFile(absoluteYamlPath, "utf-8");
  const doc = yaml.load(raw) as any;
  const parentId = doc.meta?.id || path.basename(yamlPath, ".yaml");
  const gridStr = doc.meta?.grid || "2x2";
  const { cols, rows } = parseGrid(gridStr);

  const parentImagePathRel = doc.tasks?.image?.latest?.output;
  if (!parentImagePathRel) {
    throw new Error(`Parent YAML ${relYamlPath} missing image output to split.`);
  }
  const parentImagePath = path.resolve(projectRoot, parentImagePathRel);

  // 2. Physical split via FFmpeg
  log(`[mangou] Splitting ${parentImagePathRel} into ${gridStr}...`);
  const dimensions = await getImageDimensions(parentImagePath);
  const subWidth = Math.floor(dimensions.width / cols);
  const subHeight = Math.floor(dimensions.height / rows);
  const parentBase = path.basename(parentImagePath, path.extname(parentImagePath));
  
  const subImages: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = r * cols + c + 1;
      const subFilename = `${parentBase}-sub-${String(index).padStart(2, "0")}.png`;
      const subRelPath = path.posix.join("assets", "images", subFilename);
      const subAbsPath = path.resolve(projectRoot, subRelPath);

      await cropImage(parentImagePath, subAbsPath, c * subWidth, r * subHeight, subWidth, subHeight);
      subImages.push(subRelPath);
    }
  }

  // 3. Find and Map child YAMLs
  const storyboardsDir = path.dirname(absoluteYamlPath);
  const files = await fs.readdir(storyboardsDir);
  const childMap = new Map<number, string>();
  for (const file of files) {
    if (file.endsWith(".yaml") && file !== path.basename(absoluteYamlPath)) {
      const filePath = path.join(storyboardsDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const cdoc = yaml.load(content) as any;
        if (cdoc?.meta?.parent === parentId) {
          const idx = Number(cdoc.meta?.grid_index);
          if (!isNaN(idx)) childMap.set(idx, filePath);
        }
      } catch {}
    }
  }

  // 4. Backfill into children
  for (let i = 0; i < subImages.length; i++) {
    const index = i + 1;
    let childAbsPath = childMap.get(index);
    if (!childAbsPath) {
      const childFilename = `${parentId}-sub-${String(index).padStart(2, "0")}.yaml`;
      childAbsPath = path.join(storyboardsDir, childFilename);
    }

    const subPath = subImages[i];
    const childRelPath = path.relative(projectRoot, childAbsPath).split(path.sep).join("/");
    let childDoc: any;
    if (await fileExists(childAbsPath)) {
      const childRaw = await fs.readFile(childAbsPath, "utf-8");
      childDoc = yaml.load(childRaw) || {};
    } else {
      childDoc = {
        meta: { id: path.basename(childAbsPath, ".yaml"), parent: parentId, grid_index: index },
        content: { title: `${doc.content?.title || parentId} (Part ${index})`, sequence: (doc.content?.sequence || 0) + index },
        tasks: {},
        refs: {}
      };
    }

    if (!childDoc.tasks) childDoc.tasks = {};
    if (!childDoc.tasks.image) childDoc.tasks.image = {};
    childDoc.tasks.image.latest = { status: "success", output: subPath, updated_at: new Date().toISOString() };

    await fs.writeFile(childAbsPath, yaml.dump(childDoc, { lineWidth: -1, noRefs: true }));
    
    // Log audit event for each child backfill
    await appendTaskEvent(projectRoot, {
      id: `split-${parentId}-${index}-${Date.now()}`,
      type: "image",
      status: "success",
      provider: "grid-split",
      input: { parent: relYamlPath, index },
      target: childRelPath,
      ref: { yamlPath: childRelPath, taskType: "image" },
      output: subPath,
      timestamp: Date.now()
    });
  }

  // 5. Update parent YAML
  if (!doc.tasks.split) doc.tasks.split = {};
  doc.tasks.split.latest = { status: "completed", outputs: subImages, updated_at: new Date().toISOString() };
  await fs.writeFile(absoluteYamlPath, yaml.dump(doc, { lineWidth: -1, noRefs: true }));

  log(`[mangou] Grid split completed for ${parentId}`);
  return { outputs: subImages };
}

/**
 * Scaffolding helper for projects (exported for tests)
 */
export async function scaffoldGridChildren({ gridYamlPath, projectRoot }: { gridYamlPath: string; projectRoot?: string }) {
  await runSplitGrid({ yamlPath: gridYamlPath, projectRoot });
}

/**
 * Helpers
 */

function parseGrid(gridStr: string) {
  const [cols, rows] = gridStr.toLowerCase().split("x").map(Number);
  if (isNaN(cols) || isNaN(rows)) throw new Error(`Invalid grid format: ${gridStr}`);
  return { cols, rows };
}

async function getImageDimensions(imagePath: string) {
  const proc = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", imagePath]);
  const stdout = proc.stdout.toString().trim();
  if (!stdout) return { width: 1024, height: 1024 };
  const [width, height] = stdout.split("x").map(Number);
  return { width, height };
}

async function cropImage(input: string, output: string, x: number, y: number, w: number, h: number) {
  spawnSync("ffmpeg", ["-i", input, "-vf", `crop=${w}:${h}:${x}:${y}`, "-y", output]);
}
