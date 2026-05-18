import { describe, expect, it } from "vitest";
import { loadMotionComponentFromFiles } from "../src/library/componentLibrary";

describe("loadMotionComponentFromFiles", () => {
  it("loads metadata, manifest, and source files", () => {
    const component = loadMotionComponentFromFiles({
      "metadata.json": JSON.stringify({
        id: "hero-text-reveal",
        name: "Hero Text Reveal",
        category: "text",
        tags: ["hero", "text"],
        useCases: ["landing-page"],
        moods: ["subtle"]
      }),
      "motion.manifest.json": JSON.stringify({
        version: "1.0",
        id: "hero-text-reveal",
        name: "Hero Text Reveal",
        sourceKind: "builtin-component",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: []
      }),
      "source/index.html": "<h1>Hello</h1>",
      "source/style.css": ":root{}",
      "source/script.js": ""
    });

    expect(component.id).toBe("hero-text-reveal");
    expect(component.source.files).toHaveLength(3);
    expect(component.manifest.sourceKind).toBe("builtin-component");
  });
});
