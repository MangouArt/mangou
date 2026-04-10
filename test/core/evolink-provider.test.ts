import { describe, expect, it, vi } from "vitest";
import { EVOLINK_PROVIDER } from "../../src/logic/aigc-provider-evolink";

describe("EvoLink AI Provider", () => {
  it("buildPayload supports gemini-3.1-flash-image-preview image generation", () => {
    const payload = EVOLINK_PROVIDER.buildPayload("images", {
      model: "gemini-3.1-flash-image-preview",
      prompt: "一只猫在草地上玩耍",
      size: "16:9",
      quality: "2K",
      image_urls: ["https://example.com/image1.png"],
      model_params: {
        web_search: true,
        thinking_level: "high",
      },
      callback_url: "https://example.com/webhooks/image-task-completed",
    });

    expect(payload).toEqual({
      model: "gemini-3.1-flash-image-preview",
      prompt: "一只猫在草地上玩耍",
      size: "16:9",
      quality: "2K",
      image_urls: ["https://example.com/image1.png"],
      model_params: {
        web_search: true,
        thinking_level: "high",
      },
      callback_url: "https://example.com/webhooks/image-task-completed",
    });
  });

  it("buildPayload rejects invalid evolink image parameters", () => {
    expect(() =>
      EVOLINK_PROVIDER.buildPayload("images", {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "invalid image model",
      }),
    ).toThrow(/图片模型只支持/);

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("images", {
        model: "gemini-3.1-flash-image-preview",
        prompt: "x".repeat(2001),
      }),
    ).toThrow(/prompt.*2000/);

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("images", {
        model: "gemini-3.1-flash-image-preview",
        prompt: "invalid size",
        size: "2:1",
      }),
    ).toThrow(/size/);

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("images", {
        model: "gemini-3.1-flash-image-preview",
        prompt: "invalid quality",
        quality: "8K",
      }),
    ).toThrow(/quality/);

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("images", {
        model: "gemini-3.1-flash-image-preview",
        prompt: "invalid thinking",
        model_params: {
          thinking_level: "max",
        },
      }),
    ).toThrow(/thinking_level/);
  });

  it("buildPayload supports text-to-video models with official model_params", () => {
    const payload: any = EVOLINK_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0-fast-text-to-video",
      prompt: "城市日落延时摄影，金色光线洒满天际线",
      duration: 5,
      quality: "720p",
      aspect_ratio: "21:9",
      generate_audio: true,
      model_params: {
        web_search: true,
      },
      callback_url: "https://example.com/webhooks/evolink",
    });

    expect(payload).toEqual({
      model: "seedance-2.0-fast-text-to-video",
      prompt: "城市日落延时摄影，金色光线洒满天际线",
      duration: 5,
      quality: "720p",
      aspect_ratio: "21:9",
      generate_audio: true,
      model_params: {
        web_search: true,
      },
      callback_url: "https://example.com/webhooks/evolink",
    });

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-text-to-video",
        prompt: "invalid",
        image_urls: ["https://example.com/ref.png"],
      }),
    ).toThrow(/text-to-video 不接受 image_urls、video_urls 或 audio_urls/);
  });

  it("buildPayload supports image-to-video models and enforces 1-2 images", () => {
    const payload: any = EVOLINK_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0-image-to-video",
      prompt: "镜头缓缓推进，花瓣随风飘落",
      image_urls: ["https://example.com/first.png", "https://example.com/last.png"],
      duration: 5,
      aspect_ratio: "adaptive",
    });

    expect(payload.image_urls).toEqual([
      "https://example.com/first.png",
      "https://example.com/last.png",
    ]);
    expect(payload.aspect_ratio).toBe("adaptive");

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-fast-image-to-video",
        prompt: "missing image",
        image_urls: [],
      }),
    ).toThrow(/image-to-video 必须提供 1 到 2 张 image_urls/);

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-fast-image-to-video",
        prompt: "too many images",
        image_urls: [
          "https://example.com/1.png",
          "https://example.com/2.png",
          "https://example.com/3.png",
        ],
      }),
    ).toThrow(/image-to-video 必须提供 1 到 2 张 image_urls/);
  });

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

  it("buildPayload allows data URLs for local image, video, and audio references", () => {
    const payload: any = EVOLINK_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0-fast-reference-to-video",
      prompt: "Test local image upload path",
      image_urls: ["data:image/png;base64,ZmFrZQ=="],
      video_urls: ["data:video/mp4;base64,ZmFrZQ=="],
      audio_urls: ["data:audio/mpeg;base64,ZmFrZQ=="],
    });

    expect(payload.image_urls).toEqual(["data:image/png;base64,ZmFrZQ=="]);
    expect(payload.video_urls).toEqual(["data:video/mp4;base64,ZmFrZQ=="]);
    expect(payload.audio_urls).toEqual(["data:audio/mpeg;base64,ZmFrZQ=="]);
  });

  it("buildPayload rejects model_params for non-text models and invalid callback urls", () => {
    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-reference-to-video",
        prompt: "invalid model params",
        image_urls: ["https://example.com/ref.png"],
        model_params: { web_search: true },
      }),
    ).toThrow(/model_params 目前只适用于 Seedance 2.0 text-to-video 模型/);

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-reference-to-video",
        prompt: "invalid callback",
        image_urls: ["https://example.com/ref.png"],
        callback_url: "http://localhost/callback",
      }),
    ).toThrow(/callback_url 只接受 HTTPS URL/);
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

    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "Test aspect ratio",
        image_urls: ["https://example.com/ref.png"],
        aspect_ratio: "2:1",
      }),
    ).toThrow(/aspect_ratio/);
  });

  it("buildPayload accepts official duration range up to 15 seconds", () => {
    const payload: any = EVOLINK_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0-fast-reference-to-video",
      prompt: "Test full-length duration",
      image_urls: ["https://example.com/ref.png"],
      duration: 15,
      quality: "480p",
    });

    expect(payload.duration).toBe(15);
    expect(() =>
      EVOLINK_PROVIDER.buildPayload("videos", {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "Too long",
        image_urls: ["https://example.com/ref.png"],
        duration: 16,
      }),
    ).toThrow(/duration.*4 到 15/);
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

  it("submit posts image generations to the official endpoint and uploads local image urls first", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            file_url: "https://files.evolink.ai/mangou-uploads/reference.png",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "task-image-123" }),
      });

    const taskId = await EVOLINK_PROVIDER.submit({
      baseUrl: "https://api.evolink.ai",
      apiKey: "test-key",
      scope: "images",
      payload: {
        model: "gemini-3.1-flash-image-preview",
        prompt: "一只猫在草地上玩耍",
        size: "16:9",
        quality: "2K",
        image_urls: ["data:image/png;base64,ZmFrZQ=="],
        model_params: {
          web_search: true,
          thinking_level: "auto",
        },
      },
      fetchImpl,
    });

    expect(taskId).toBe("task-image-123");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.evolink.ai/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image-preview",
          prompt: "一只猫在草地上玩耍",
          size: "16:9",
          quality: "2K",
          image_urls: ["https://files.evolink.ai/mangou-uploads/reference.png"],
          model_params: {
            web_search: true,
            thinking_level: "auto",
          },
        }),
      },
    );
  });

  it("submit uploads data url video_urls and audio_urls before generation", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            file_url: "https://files.evolink.ai/mangou-uploads/image.png",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            file_url: "https://files.evolink.ai/mangou-uploads/ref.mp4",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            file_url: "https://files.evolink.ai/mangou-uploads/bgm.mp3",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "task-unified-456" }),
      });

    await EVOLINK_PROVIDER.submit({
      baseUrl: "https://api.evolink.ai",
      apiKey: "test-key",
      scope: "videos",
      payload: {
        model: "seedance-2.0-fast-reference-to-video",
        prompt: "camera push in",
        image_urls: ["data:image/png;base64,ZmFrZQ=="],
        video_urls: ["data:video/mp4;base64,ZmFrZQ=="],
        audio_urls: ["data:audio/mpeg;base64,ZmFrZQ=="],
        duration: 8,
        quality: "720p",
        aspect_ratio: "16:9",
        generate_audio: true,
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
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
          image_urls: ["https://files.evolink.ai/mangou-uploads/image.png"],
          video_urls: ["https://files.evolink.ai/mangou-uploads/ref.mp4"],
          audio_urls: ["https://files.evolink.ai/mangou-uploads/bgm.mp3"],
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

  it("extractOutputs reads image urls from unified image task results", () => {
    const result = {
      status: "completed",
      results: [
        { url: "https://example.com/image-1.png" },
        { image_url: "https://example.com/image-2.png" },
      ],
    };

    expect(EVOLINK_PROVIDER.extractOutputs("images", result)).toEqual([
      "https://example.com/image-1.png",
      "https://example.com/image-2.png",
    ]);
  });
});
