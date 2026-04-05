import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveServerAppRoot, resolveServerDataRoot } from "../../src/commands/server";

describe("server start path resolution", () => {
  let tempRoot = "";

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mangou-server-start-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("resolves appRoot from the CLI module instead of process.cwd()", () => {
    vi.spyOn(process, "cwd").mockReturnValue(tempRoot);

    const appRoot = resolveServerAppRoot();
    const expectedAppRoot = path.resolve(
      path.dirname(fileURLToPath(new URL("../../src/commands/server/index.ts", import.meta.url))),
      "../../..",
    );

    expect(appRoot).toBe(expectedAppRoot);
  });

  it("normalizes workspace input to an absolute projects root", async () => {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const projectsRoot = path.join(workspaceRoot, "projects");
    await fs.mkdir(projectsRoot, { recursive: true });

    const relativeWorkspace = path.relative(process.cwd(), workspaceRoot);
    const dataRoot = await resolveServerDataRoot(relativeWorkspace);

    expect(dataRoot).toBe(projectsRoot);
    expect(path.isAbsolute(dataRoot)).toBe(true);
  });
});
