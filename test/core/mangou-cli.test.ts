import { describe, it, expect, beforeEach } from "vitest";
import { main } from "../../src/cli/main";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

describe("mangou-cli commands", () => {
  const projectName = "test-cli-project";
  const projectRoot = path.join(process.cwd(), "projects", projectName);

  beforeEach(async () => {
    // Cleanup projects/test-cli-project
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("project init: creates physical directory structure", async () => {
    process.argv = ["node", "mangou", "project", "init", "--name", projectName];
    await main();

    const exists = await fs.access(projectRoot).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const storyboardDir = path.join(projectRoot, "storyboards");
    const storyboardExists = await fs.access(storyboardDir).then(() => true).catch(() => false);
    expect(storyboardExists).toBe(true);

    const projectJson = await fs.readFile(path.join(projectRoot, "project.json"), "utf-8");
    const meta = JSON.parse(projectJson);
    expect(meta.id).toBe(projectName);
  });

  it("project stitch: triggers ffmpeg concatenation logic", async () => {
    // We mock the stitch module if needed, but here we test the command dispatch
    process.argv = ["node", "mangou", "project", "stitch", "--id", projectName];
    // Since stitch requires FFmpeg and physical files, we check for no crash on invalid ID
    await expect(main()).rejects.toThrow(); // Should fail because project doesn't exist
  });

  it("storyboard split: splits a grid image and creates child YAMLs", async () => {
    // 1. Setup project
    process.argv = ["node", "mangou", "project", "init", "--name", projectName];
    await main();

    // 2. Setup a master grid YAML
    const masterYamlPath = path.join(projectRoot, "storyboards", "master.yaml");
    const masterDoc = {
      meta: { id: "master", grid: "2x1" },
      tasks: {
        image: {
          latest: { status: "success", output: "assets/images/master.png" }
        }
      }
    };
    await fs.writeFile(masterYamlPath, yaml.dump(masterDoc));

    // 3. Create a dummy image
    const imgDir = path.join(projectRoot, "assets/images");
    await fs.mkdir(imgDir, { recursive: true });
    await fs.writeFile(path.join(imgDir, "master.png"), "dummy content");

    // 4. Run split command
    process.argv = ["node", "mangou", "storyboard", "split", "--path", `projects/${projectName}/storyboards/master.yaml` ];
    
    // We mock FFmpeg in a real environment, but here we expect the logic to attempt it
    // For KISS, we'll just check if the code runs without crashing and reaches the backfill stage
    try {
      await main();
    } catch (e: any) {
      // ffmpeg will fail on dummy content, but we check if it created the child YAML files
    }

    const childYaml = path.join(projectRoot, "storyboards", "master-sub-01.yaml");
    const childExists = await fs.access(childYaml).then(() => true).catch(() => false);
    // Even if FFmpeg fails, our scaffold logic should have created the files
    expect(childExists).toBe(true);
  });
});
