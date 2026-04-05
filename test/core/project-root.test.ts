import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inferProjectRoot } from "../../src/core/project-root";

describe("project root inference", () => {
  it("prefers the nearest ancestor with project.json instead of stopping at projects/", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mangou-project-root-"));
    const workspaceRoot = path.join(tempRoot, "workspace");
    const projectRoot = path.join(workspaceRoot, "projects", "demo-project");
    const yamlPath = path.join(projectRoot, "storyboards", "shot-01.yaml");

    await fs.mkdir(path.dirname(yamlPath), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "project.json"), JSON.stringify({ id: "demo-project" }));
    await fs.writeFile(yamlPath, "meta:\n  id: shot-01\n");

    await expect(inferProjectRoot(yamlPath)).resolves.toBe(projectRoot);

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("fails fast when no ancestor contains project.json", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mangou-project-root-missing-"));
    const yamlPath = path.join(tempRoot, "projects", "demo-project", "storyboards", "shot-01.yaml");

    await fs.mkdir(path.dirname(yamlPath), { recursive: true });
    await fs.writeFile(yamlPath, "meta:\n  id: shot-01\n");

    await expect(inferProjectRoot(yamlPath)).rejects.toThrow(/project\.json/);

    await fs.rm(tempRoot, { recursive: true, force: true });
  });
});
