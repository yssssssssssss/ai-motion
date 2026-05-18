import { describe, expect, it } from "vitest";
import { recommendComponents } from "../src/orchestrator/recommend";
import type { MotionComponent } from "../src/library/componentLibrary";

const components = [
  {
    id: "hero-text-reveal",
    name: "Hero Text Reveal",
    category: "text",
    tags: ["hero", "text", "saas"],
    useCases: ["landing-page"],
    moods: ["subtle"],
    manifest: { id: "hero-text-reveal", presets: [] }
  },
  {
    id: "magnetic-button",
    name: "Magnetic Button",
    category: "interaction",
    tags: ["button", "hover"],
    useCases: ["cta"],
    moods: ["expressive"],
    manifest: { id: "magnetic-button", presets: [] }
  }
] as unknown as MotionComponent[];

describe("recommendComponents", () => {
  it("ranks components by matching brief terms", () => {
    const results = recommendComponents({ brief: "subtle saas hero text", components, limit: 3 });

    expect(results[0]?.componentId).toBe("hero-text-reveal");
    expect(results[0]?.initialPatch.id).toBe("hero-text-reveal-initial");
  });
});
