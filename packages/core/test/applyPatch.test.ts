import { describe, expect, it } from "vitest";
import { applyPatchToFiles } from "../src/patch/applyPatch";
import type { MotionManifest, MotionPatch } from "../src/manifest/types";

const manifest: MotionManifest = {
  version: "1.0",
  id: "hero",
  name: "Hero",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "headline",
      label: "Headline",
      type: "text",
      default: "Original",
      status: "confirmed",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
    },
    {
      id: "accentColor",
      label: "Accent",
      type: "color",
      default: "#000000",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--accent-color" }]
    },
    {
      id: "duration",
      label: "Duration",
      type: "duration",
      default: 800,
      status: "confirmed",
      constraints: { unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
    }
  ]
};

describe("applyPatchToFiles", () => {
  it("updates html text and css variables", () => {
    const patch: MotionPatch = {
      id: "patch-1",
      sourceManifestId: "hero",
      values: { headline: "Updated", accentColor: "#ff3366" }
    };

    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<h1 data-motion="headline">Original</h1>',
        "source/style.css": ":root { --accent-color: #000000; --duration: 800ms; }"
      },
      manifest,
      patch
    });

    expect(files["source/index.html"]).toContain(">Updated<");
    expect(files["source/style.css"]).toContain("--accent-color: #ff3366");
  });

  it("keeps configured units for numeric css variables", () => {
    const patch: MotionPatch = {
      id: "patch-2",
      sourceManifestId: "hero",
      values: { duration: 1200 }
    };

    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<h1 data-motion="headline">Original</h1>',
        "source/style.css": ":root { --accent-color: #000000; --duration: 800ms; }"
      },
      manifest,
      patch
    });

    expect(files["source/style.css"]).toContain("--duration: 1200ms");
  });
});
