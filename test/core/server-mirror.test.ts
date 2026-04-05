import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { createProjectManager, getProjectUIData } from "../../src/server/server";

describe("Readonly Mirror Server", () => {
  let tempRoot = "";
  let workspaceRoot = "";
  let dataRoot = "";
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mangou-server-test-"));
    workspaceRoot = path.join(tempRoot, "workspace");
    dataRoot = path.join(workspaceRoot, "projects");

    const projectRoot = path.join(dataRoot, "demo-mirror");
    await fs.mkdir(path.join(projectRoot, "asset_defs/chars"), { recursive: true });
    await fs.mkdir(path.join(projectRoot, "asset_defs/scenes"), { recursive: true });
    await fs.mkdir(path.join(projectRoot, "asset_defs/props"), { recursive: true });
    await fs.mkdir(path.join(projectRoot, "storyboards"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "tasks.jsonl"), "", "utf-8");
    await fs.writeFile(
      path.join(projectRoot, "project.json"),
      JSON.stringify({
        id: "demo-mirror",
        name: "Demo Mirror",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      }),
      "utf-8",
    );

    await fs.writeFile(
      path.join(projectRoot, "asset_defs/chars/duxiu.yaml"),
      yaml.dump({
        meta: { id: "duxiu", type: "character" },
        content: { name: "杜休", description: "Miner" },
        tasks: { image: { latest: { status: "completed", output: "assets/images/duxiu.png" } } },
      }),
      "utf-8",
    );

    await fs.writeFile(
      path.join(projectRoot, "storyboards/shot1.yaml"),
      yaml.dump({
        meta: { id: "shot1" },
        content: { title: "Entry", sequence: 1, story: "进入矿区" },
        tasks: { image: { latest: { status: "completed", output: "assets/images/shot1.png" } } },
        refs: { characters: ["duxiu"] },
      }),
      "utf-8",
    );
  });

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("resolves projects and snapshots from the same custom workspace root", async () => {
    const projectManager = createProjectManager(dataRoot);
    await projectManager.init();

    const [projects, snapshot] = await Promise.all([
      projectManager.listProjects(),
      getProjectUIData(path.join(dataRoot, "demo-mirror"), "demo-mirror"),
    ]);

    expect(projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "demo-mirror",
          name: "Demo Mirror",
        }),
      ]),
    );

    expect(snapshot.storyboards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "shot1",
          sequence_number: 1,
          image_url: "assets/images/shot1.png",
        }),
      ]),
    );

    expect(snapshot.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "duxiu",
          image_url: "assets/images/duxiu.png",
        }),
      ]),
    );
  });
});
