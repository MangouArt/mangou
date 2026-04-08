import { describe, expect, it, vi } from "vitest";
import { JIEKOU_PROVIDER } from "../../src/logic/aigc-provider-jiekou";

describe("JieKou AI Provider", () => {
  it("buildPayload maps stable YAML video fields to JieKou Seedance 2.0 request fields", () => {
    const payload = JIEKOU_PROVIDER.buildPayload("videos", {
      model: "seedance-2.0",
      prompt: "camera push in",
      reference_images: ["https://example.com/grid.png"],
      first_frame_url: "https://example.com/first.png",
      last_frame_url: "https://example.com/last.png",
      generate_audio: true,
      return_last_frame: true,
      ratio: "16:9",
    });

    expect(payload).toEqual({
      model: "seedance-2.0",
      prompt: "camera push in",
      fast: false,
      seed: -1,
      image: "https://example.com/first.png",
      last_image: "https://example.com/last.png",
      ratio: "16:9",
      duration: 5,
      resolution: "720p",
      watermark: false,
      web_search: false,
      generate_audio: true,
      reference_images: ["https://example.com/grid.png"],
      reference_videos: undefined,
      reference_audios: undefined,
      return_last_frame: true,
    });
  });

  it("submit converts data URLs in Seedance media fields to bare base64 before posting", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ task_id: "task-123" }),
    });

    await JIEKOU_PROVIDER.submit({
      baseUrl: "https://api.jiekou.ai",
      apiKey: "test-key",
      scope: "videos",
      payload: {
        model: "seedance-2.0",
        image: "data:image/png;base64,Zmlyc3Q=",
        last_image: "data:image/png;base64,bGFzdA==",
        reference_images: [
          "data:image/png;base64,Z3JpZA==",
          "https://example.com/remote.png",
        ],
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.jiekou.ai/v3/async/seedance-2.0",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          image: "Zmlyc3Q=",
          last_image: "bGFzdA==",
          reference_images: ["Z3JpZA==", "https://example.com/remote.png"],
        }),
      }),
    );
  });

  it("poll queries the official async result endpoint and returns success payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          task_id: "task-123",
          status: "TASK_STATUS_SUCCEED",
        },
        videos: [{ video_url: "https://example.com/video.mp4" }],
        images: [{ image_url: "https://example.com/last-frame.png" }],
        audios: [{ audio_url: "https://example.com/audio.wav" }],
      }),
    });

    const result = await JIEKOU_PROVIDER.poll({
      baseUrl: "https://api.jiekou.ai",
      apiKey: "test-key",
      taskId: "task-123",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.jiekou.ai/v3/async/task-result?task_id=task-123",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
      },
    );
    expect(result.videos[0].video_url).toBe("https://example.com/video.mp4");
    expect(result.images[0].image_url).toBe("https://example.com/last-frame.png");
    expect(result.audios[0].audio_url).toBe("https://example.com/audio.wav");
  });
});
