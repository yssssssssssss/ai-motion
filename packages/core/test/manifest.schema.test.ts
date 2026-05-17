import { describe, expect, it } from "vitest";
import { motionManifestSchema } from "../src/manifest/schema";

describe("motionManifestSchema", () => {
  it("accepts a minimal confirmed HTML manifest", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "hero-text-reveal",
      name: "Hero Text Reveal",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "headline",
          label: "Headline",
          type: "text",
          default: "Build faster",
          status: "confirmed",
          targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported parameter types", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "bad",
      name: "Bad",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "timeline",
          label: "Timeline",
          type: "keyframe-editor",
          default: [],
          status: "confirmed",
          targets: []
        }
      ]
    });

    expect(result.success).toBe(false);
  });
});
