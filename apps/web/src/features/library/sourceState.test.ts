import { describe, expect, it } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { hasRenderableSource } from "./sourceState";

function makeComponent(entryContent: string): MotionComponent {
  return {
    id: "component",
    name: "Component",
    category: "interaction",
    tags: [],
    useCases: [],
    moods: [],
    manifest: {
      version: "1.0",
      id: "component",
      name: "Component",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    },
    source: {
      id: "component",
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [{ path: "source/index.html", content: entryContent, kind: "html" }]
    }
  };
}

describe("hasRenderableSource", () => {
  it("treats placeholder source records as not loaded", () => {
    expect(hasRenderableSource(makeComponent(""))).toBe(false);
    expect(hasRenderableSource(makeComponent("   "))).toBe(false);
  });

  it("accepts source records with real entry markup", () => {
    expect(hasRenderableSource(makeComponent("<main data-motion-root></main>"))).toBe(true);
  });
});
