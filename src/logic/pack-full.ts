#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

async function packFull() {
  const pkg = JSON.parse(await fs.readFile("package.json", "utf-8"));
  const filesToPack = pkg.files || [];
  const outputZip = "mangou-full.zip";

  console.log(`[pack-full] Packing files: ${filesToPack.join(", ")} into ${outputZip}...`);

  // 使用 zip 命令打包 (确保排除 node_modules 等)
  const args = ["-r", outputZip, ...filesToPack];
  const proc = spawnSync("zip", args);

  if (proc.status !== 0) {
    console.error(`[pack-full] Failed: ${proc.stderr.toString()}`);
    process.exit(1);
  }

  console.log(`[pack-full] Successfully created ${outputZip}`);
}

packFull().catch(err => {
  console.error(err);
  process.exit(1);
});
