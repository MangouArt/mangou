import { describe, expect, it, vi } from "vitest";
import { EVOLINK_PROVIDER } from "../../src/logic/aigc-provider-evolink";

describe("EvoLink AI Provider", () => {
  it("buildPayload maps seedance-2.0-fast-reference-to-video fields to the official request body", () => {
    const payload = EVOLINK_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0-fast-reference-to-video",
      prompt: "Use video 1 camera movement throughout and use audio 1 as background music.",
      image_urls: ["https://example.com/ref-1.png", "https://example.com/ref-2.png"],
      video_urls: ["https://example.com/ref.mp4"],
      audio_urls: ["https://example.com/bgm.mp3"],
      duration: 10,
      quality: "720p",
      aspect_ratio: "16:9",
      generate_audio: true,
    });

    expect(payload).toEqual({
      model: "seedance-2.0-fast-reference-to-video",
      prompt: "Use video 1 camera movement throughout and use audio 1 as background music.",
      image_urls: ["https://example.com/ref-1.png", "https://example.com/ref-2.png"],
      video_urls: ["https://example.com/ref.mp4"],
      audio_urls: ["https://example.com/bgm.mp3"],
      duration: 10,
      quality: "720p",
      aspect_ratio: "16:9",
      generate_audio: true,
    });
  });

  it("buildPayload allows data URLs for image_urls but still rejects non-http media references", () => {
    const payload = EVOLINK_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0-fast-reference-to-video",
      prompt: "Test local image upload path",
      image_urls: ["data:image/png;base64,ZmFrZQ=="],
    });

    expect(payload.image_urls).toEqual(["data:image/png;base64,ZmFrZQ=="]);
    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "Test relative video",
        video_urls: ["assets/videos/ref.mp4"],
      }),
    ).toThrow(/video_urls.*http\/https URL/);
  });

  it("buildPayload rejects unsupported quality values", () => {
    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "Test quality",
        image_urls: ["https://example.com/ref.png"],
        quality: "1080p",
      }),
    ).toThrow(/quality.*480p.*720p/);
  });

  it("submit posts to the official videos generations endpoint and reads task id from id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            file_url: "https://files.evolink.ai/mangou-uploads/upload.png",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "task-unified-123" }),
      });

    await EVOLINK_PROVIDER.submit({
      baseUrl: "https://api.evolink.ai",
      apiKey: "test-key",
      scope: "videos",
      payload: {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "camera push in",
        image_urls: ["data:image/png;base64,ZmFrZQ=="],
        duration: 8,
        quality: "720p",
        aspect_ratio: "16:9",
        generate_audio: true,
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://files-api.evolink.ai/api/v1/files/upload/stream",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
        },
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.evolink.ai/v1/videos/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "seedance-2.0-fast-reference-to-video",
          prompt: "camera push in",
          image_urls: ["https://files.evolink.ai/mangou-uploads/upload.png"],
          duration: 8,
          quality: "720p",
          aspect_ratio: "16:9",
          generate_audio: true,
        }),
      },
    );
  });

  it("poll queries the official task detail endpoint and extractOutputs reads results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "task-unified-123",
        status: "completed",
        results: ["https://example.com/video.mp4"],
      }),
    });

    const result = await EVOLINK_PROVIDER.poll({
      baseUrl: "https://api.evolink.ai",
      apiKey: "test-key",
      taskId: "task-unified-123",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.evolink.ai/v1/tasks/task-unified-123",
      {
        headers: {
          Authorization: "Bearer test-key",
        },
      },
    );
    expect(EVOLINK_PROVIDER.extractOutputs("videos", result)).toEqual(["https://example.com/video.mp4"]);
  });
});
