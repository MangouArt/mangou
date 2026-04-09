import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(updatedDoc.tasks.image.latest.remote_status).toBe("completed");
    expect(updatedDoc.tasks.image.latest.backfill_status).toBe("completed");
    expect(updatedDoc.tasks.image.latest.output).toContain("shot1-task-123");
  });

  it("runAIGC: retries transient 404 downloads before backfilling outputs", async () => {
    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        video: {
          provider: "mock-provider",
          params: { prompt: "A robotic cat", model: "seedance-2.0-fast-reference-to-video" }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    let attempts = 0;
    global.fetch = Object.assign(vi.fn().mockImplementation(async () => {
      attempts += 1;
      if (attempts < 3) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
        };
      }

      return {
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from("fake-video-content")),
      };
    }), { preconnect: vi.fn() }) as typeof fetch;
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: any) => {
      fn();
      return 0 as any;
    }) as typeof setTimeout);

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { video: "videos" },
      buildPayload: (_s: any, p: any) => p,
      submit: vi.fn().mockResolvedValue("task-777"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.mp4" } }),
      extractOutputs: () => ["https://example.com/cat.mp4"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await runAIGC({ yamlPath, type: "video" });

    expect(attempts).toBe(3);
    const updatedRaw = await fs.readFile(yamlPath, "utf-8");
    const updatedDoc = yaml.load(updatedRaw) as any;
    expect(updatedDoc.tasks.video.latest.status).toBe("completed");
    expect(updatedDoc.tasks.video.latest.backfill_status).toBe("completed");
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

  it("runAIGC: resolves local image references from exact KIE image and video fields", async () => {
    await fs.mkdir(path.join(projectRoot, "assets/images"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "assets/images/reference.png"), "ref-image");
    await fs.writeFile(path.join(projectRoot, "assets/images/first.png"), "first-image");

    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        image: {
          provider: "mock-provider",
          params: {
            prompt: "Use KIE exact fields",
            image_input: ["assets/images/reference.png"],
            image_urls: ["assets/images/reference.png"],
            reference_image_urls: ["assets/images/reference.png"],
            first_frame_url: "assets/images/first.png",
          }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { image: "images" },
      buildPayload: vi.fn((_s: any, p: any) => p),
      submit: vi.fn().mockResolvedValue("task-235"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.png" } }),
      extractOutputs: () => ["https://example.com/cat.png"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await runAIGC({ yamlPath, type: "image" });

    expect(mockProvider.buildPayload).toHaveBeenCalledWith(
      "images",
      expect.objectContaining({
        image_input: [expect.stringMatching(/^data:image\/png;base64,/)],
        image_urls: [expect.stringMatching(/^data:image\/png;base64,/)],
        reference_image_urls: [expect.stringMatching(/^data:image\/png;base64,/)],
        first_frame_url: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    );
  });

  it("runAIGC: resolves local image references from jiekou reference_images", async () => {
    await fs.mkdir(path.join(projectRoot, "assets/images"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "assets/images/grid-mother.png"), "grid-image");
    await fs.writeFile(path.join(projectRoot, "assets/images/first.png"), "first-image");

    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        video: {
          provider: "mock-provider",
          params: {
            prompt: "Use jiekou exact fields",
            model: "seedance-2.0",
            reference_images: ["assets/images/grid-mother.png"],
            first_frame_url: "assets/images/first.png",
          }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { video: "videos" },
      buildPayload: vi.fn((_s: any, p: any) => p),
      submit: vi.fn().mockResolvedValue("task-236"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.mp4" } }),
      extractOutputs: () => ["https://example.com/cat.mp4"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await runAIGC({ yamlPath, type: "video" });

    expect(mockProvider.buildPayload).toHaveBeenCalledWith(
      "videos",
      expect.objectContaining({
        reference_images: [expect.stringMatching(/^data:image\/png;base64,/)],
        first_frame_url: expect.stringMatching(/^data:image\/png;base64,/),
      }),
    );
  });

  it("runAIGC: resolves local image references from jiekou subjects images", async () => {
    await fs.mkdir(path.join(projectRoot, "assets/images"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "assets/images/hero.png"), "hero-image");
    await fs.writeFile(path.join(projectRoot, "assets/images/hero-2.png"), "hero-image-2");

    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        video: {
          provider: "mock-provider",
          params: {
            prompt: "Use vidu subjects",
            model: "viduq2-pro-fast",
            subjects: [
              {
                name: "hero",
                images: ["assets/images/hero.png", "assets/images/hero-2.png"],
              },
            ],
          }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { video: "videos" },
      buildPayload: vi.fn((_s: any, p: any) => p),
      submit: vi.fn().mockResolvedValue("task-237"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.mp4" } }),
      extractOutputs: () => ["https://example.com/cat.mp4"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await runAIGC({ yamlPath, type: "video" });

    expect(mockProvider.buildPayload).toHaveBeenCalledWith(
      "videos",
      expect.objectContaining({
        subjects: [
          expect.objectContaining({
            images: [
              expect.stringMatching(/^data:image\/png;base64,/),
              expect.stringMatching(/^data:image\/png;base64,/),
            ],
          }),
        ],
      }),
    );
  });

  it("runAIGC: resolves local image references from wan reference_image and first_frame", async () => {
    await fs.mkdir(path.join(projectRoot, "assets/images"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "assets/images/ref.png"), "ref-image");
    await fs.writeFile(path.join(projectRoot, "assets/images/first.png"), "first-image");

    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        video: {
          provider: "mock-provider",
          params: {
            prompt: "Use wan exact fields",
            model: "wan/2-7-r2v",
            reference_image: ["assets/images/ref.png"],
            first_frame: "assets/images/first.png",
          }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { video: "videos" },
      buildPayload: vi.fn((_s: any, p: any) => p),
      submit: vi.fn().mockResolvedValue("task-238"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/cat.mp4" } }),
      extractOutputs: () => ["https://example.com/cat.mp4"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await runAIGC({ yamlPath, type: "video" });

    expect(mockProvider.buildPayload).toHaveBeenCalledWith(
      "videos",
      expect.objectContaining({
        reference_image: [expect.stringMatching(/^data:image\/png;base64,/)],
        first_frame: expect.stringMatching(/^data:image\/png;base64,/),
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
    const tasksRaw = await fs.readFile(path.join(projectRoot, "tasks.jsonl"), "utf-8");
    const events = tasksRaw.trim().split("\n").map((line) => JSON.parse(line));
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-404",
          type: "image_generate",
          status: "completed",
          event: "remote_completed",
        }),
        expect.objectContaining({
          id: "task-404:materialize",
          type: "image_materialize",
          status: "failed",
          event: "backfill_failed",
        }),
      ]),
    );
  });

  it("runAIGC: records remote completion even when local download backfill fails", async () => {
    const sourceDoc = {
      meta: { id: "shot1" },
      tasks: {
        video: {
          provider: "mock-provider",
          params: { prompt: "Broken download", model: "seedance-2.0-fast-reference-to-video" }
        }
      }
    };
    await fs.writeFile(yamlPath, yaml.dump(sourceDoc));

    global.fetch = Object.assign(vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    }), { preconnect: vi.fn() }) as typeof fetch;
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: any) => {
      fn();
      return 0 as any;
    }) as typeof setTimeout);

    const mockProvider = {
      id: "mock-provider",
      env: { apiKey: "MOCK_KEY", baseUrl: "MOCK_BASE", defaultBaseUrl: "https://api.mock.ai" },
      scopes: { video: "videos" },
      buildPayload: (_s: any, p: any) => p,
      submit: vi.fn().mockResolvedValue("task-888"),
      poll: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { url: "https://example.com/broken.mp4" } }),
      extractOutputs: () => ["https://example.com/broken.mp4"],
    };
    vi.spyOn(registry, "getAIGCProvider").mockReturnValue(mockProvider as any);
    process.env.MOCK_KEY = "dummy";

    await expect(runAIGC({ yamlPath, type: "video" })).rejects.toThrow(/Failed to download/);

    const updatedRaw = await fs.readFile(yamlPath, "utf-8");
    const updatedDoc = yaml.load(updatedRaw) as any;
    expect(updatedDoc.tasks.video.latest.status).toBe("running");
    expect(updatedDoc.tasks.video.latest.remote_status).toBe("completed");
    expect(updatedDoc.tasks.video.latest.backfill_status).toBe("failed");
    expect(updatedDoc.tasks.video.latest.remote_outputs).toEqual(["https://example.com/broken.mp4"]);

    const tasksRaw = await fs.readFile(path.join(projectRoot, "tasks.jsonl"), "utf-8");
    const events = tasksRaw.trim().split("\n").map((line) => JSON.parse(line));
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task-888",
          type: "video_generate",
          status: "completed",
          event: "remote_completed",
        }),
        expect.objectContaining({
          id: "task-888:materialize",
          type: "video_materialize",
          status: "failed",
          event: "backfill_failed",
        }),
      ]),
    );
  });
});
