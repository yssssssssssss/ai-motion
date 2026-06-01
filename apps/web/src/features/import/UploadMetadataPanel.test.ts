import { describe, expect, it } from "vitest";
import { createUploadMetadata } from "./UploadMetadataPanel";

describe("createUploadMetadata", () => {
  it("preserves draft use cases and moods when metadata is prefilled", () => {
    const metadata = createUploadMetadata({
      name: " 视频转场 ",
      category: "media",
      tagsInput: "uploaded，motion",
      initialMetadata: {
        id: "video-demo",
        name: "视频转场",
        category: "media",
        tags: ["video-generated"],
        useCases: ["video-to-motion"],
        moods: ["generated"]
      },
      createId: () => "uploaded-test"
    });

    expect(metadata).toEqual({
      id: "uploaded-test",
      name: "视频转场",
      category: "media",
      tags: ["uploaded", "motion"],
      useCases: ["video-to-motion"],
      moods: ["generated"]
    });
  });
});
