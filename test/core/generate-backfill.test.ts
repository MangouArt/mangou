import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { runAIGC } from "../../src/generate";
import * as registry from "../../src/logic/aigc-provider-registry";

describe("AIGC Generate & Backfill", () => {
  const projectRoot = path.join(process.cwd(), "projects/test-backfill");
  const yamlPath = path.join(projectRoot, "storyboards/shot1.yaml");

  beforeEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(path.dirname(yamlPath), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "project.json"), JSON.stringify({ id: "test-backfill" }));
    
    // Mock global fetch for downloadFile
    global.fetch = Object.assign(vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from("fake-image-content")),
    }), { preconnect: vi.fn() }) as typeof fetch;
  });

  it("runAIGC: reads params from YAML, calls provider, and backfills result to YAML", async () => {
    // 1. Setup a source YAML
    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        image: {
          provider: "mock-provider",
          params: { prompt: "A robotic cat" }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    // 2. Mock the Provider
    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { image: "images" },
      buildPayload: (_s: any, p: any) => p,
      submit: vi.fn().mockResolvedValue("task-123"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.png" } }),
      extractOutputs: () => ["https://example.com/cat.png"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    // 3. Run the generation
    await runAIGC({ yamlPath, type: "image" });

    // 4. Verify YAML was updated
    const updatedRaw = await fs.readFile(yamlPath, "utf-8");
    const updatedDoc = yaml.load(updatedRaw) as any;

    expect(updatedDoc.tasks.image.latest.status).toBe("completed");
    expect(updatedDoc.tasks.image.latest.output).toContain("shot1-task-123");
  });

  it("runAIGC: resolves local image references from params.image", async () => {
    await fs.mkdir(path.join(projectRoot, "assets/images"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "assets/images/reference.png"), "ref-image");

    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        image: {
          provider: "mock-provider",
          params: { prompt: "Use reference", image: ["assets/images/reference.png"] }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { image: "images" },
      buildPayload: vi.fn((_s: any, p: any) => p),
      submit: vi.fn().mockResolvedValue("task-234"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.png" } }),
      extractOutputs: () => ["https://example.com/cat.png"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await runAIGC({ yamlPath, type: "image" });

    expect(mockProvider.buildPayload).toHaveBeenCalledWith(
      "images",
      expect.objectContaining({
        image: [expect.stringMatching(/^data:image\/png;base64,/)],
      }),
    );
  });

  it("runAIGC: rejects missing localized outputs before writing audit logs", async () => {
    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        image: {
          provider: "mock-provider",
          params: { prompt: "Broken output" }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { image: "images" },
      buildPayload: (_s: any, p: any) => p,
      submit: vi.fn().mockResolvedValue("task-404"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "assets/images/missing.png" } }),
      extractOutputs: () => ["assets/images/missing.png"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await expect(runAIGC({ yamlPath, type: "image" })).rejects.toThrow(/Materialized output not found/);
    await expect(fs.access(path.join(projectRoot, "tasks.jsonl"))).rejects.toBeDefined();
  });
});
