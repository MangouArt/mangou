import { describe, expect, it } from "vitest";
import { resolveProjectMediaUrl } from "../../src/web/lib/project-media";

describe("project media urls", () => {
  it("rewrites project-relative asset paths to the VFS endpoint", () => {
    expect(resolveProjectMediaUrl("wandering-earth-ending", "assets/images/s1.png")).toBe(
      "/api/vfs?projectId=wandering-earth-ending&path=assets%2Fimages%2Fs1.png",
    );
  });

  it("keeps absolute remote urls unchanged", () => {
    expect(resolveProjectMediaUrl("demo", "https://cdn.example.com/s1.png")).toBe(
      "https://cdn.example.com/s1.png",
    );
  });

  it("keeps empty values empty", () => {
    expect(resolveProjectMediaUrl("demo", null)).toBeNull();
    expect(resolveProjectMediaUrl("demo", "")).toBe("");
  });
});
