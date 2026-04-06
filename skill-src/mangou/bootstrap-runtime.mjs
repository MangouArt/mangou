#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = SCRIPT_DIR;
const DEFAULT_RUNTIME_URL = "https://www.mangou.art/downloads/mangou-runtime.zip";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function downloadRuntimeArchive(runtimeUrl, archivePath) {
  const response = await fetch(runtimeUrl);
  if (!response.ok) {
    throw new Error(`下载 runtime 失败：${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(archivePath, Buffer.from(arrayBuffer));
}

async function extractArchive(archivePath, extractRoot) {
  const python3Exists = await pathExists("/run/current-system/sw/bin/python3") || await pathExists("/usr/bin/python3");
  if (python3Exists) {
    const python3 = (await pathExists("/run/current-system/sw/bin/python3"))
      ? "/run/current-system/sw/bin/python3"
      : "/usr/bin/python3";
    await execFileAsync(python3, ["-m", "zipfile", "-e", archivePath, extractRoot]);
    return;
  }

  try {
    await execFileAsync("unzip", ["-oq", archivePath, "-d", extractRoot]);
    return;
  } catch {
    throw new Error("解压失败：需要 python3 或 unzip。");
  }
}

async function main() {
  const runtimeEntry = path.join(SKILL_ROOT, "src", "main.ts");
  if (await pathExists(runtimeEntry)) {
    console.log("Mangou runtime 已存在，无需重复安装。");
    return;
  }

  const runtimeUrl = process.env.MANGOU_RUNTIME_URL || DEFAULT_RUNTIME_URL;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mangou-runtime-"));
  const archivePath = path.join(tempRoot, "mangou-runtime.zip");
  const extractRoot = path.join(tempRoot, "runtime");

  try {
    console.log(`Downloading ${runtimeUrl}`);
    await downloadRuntimeArchive(runtimeUrl, archivePath);

    await ensureDir(extractRoot);
    console.log("Extracting runtime bundle...");
    await extractArchive(archivePath, extractRoot);

    console.log("Merging runtime into skill root...");
    await copyDir(extractRoot, SKILL_ROOT);

    if (!(await pathExists(runtimeEntry))) {
      throw new Error("runtime 合并后仍未找到 src/main.ts");
    }

    console.log("Mangou runtime 安装完成。");
    console.log(`Skill root: ${SKILL_ROOT}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Mangou runtime 安装失败：${message}`);
  process.exit(1);
});
