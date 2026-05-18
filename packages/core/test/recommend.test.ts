import { describe, expect, it } from "vitest";
import { recommendComponents } from "../src/orchestrator/recommend";
import { createFallbackBriefIntent } from "../src/orchestrator/briefIntent";
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

  it("ranks components from parsed brief intent", () => {
    const results = recommendComponents({
      intent: {
        query: "workeasy hover button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover"],
        sources: ["workeasy"],
        keywords: ["save", "cta"],
        confidence: 0.9
      },
      components,
      limit: 3
    });

    expect(results[0]?.componentId).toBe("magnetic-button");
    expect(results[0]?.reason).toContain("parsed brief intent");
  });

  it("creates a fallback intent from raw brief text", () => {
    const intent = createFallbackBriefIntent("WorkEasy hover button with tech style");

    expect(intent.query).toBe("WorkEasy hover button with tech style");
    expect(intent.componentKinds).toContain("button");
    expect(intent.motionStyles).toContain("hover");
    expect(intent.sources).toContain("workeasy");
    expect(intent.keywords).toContain("tech");
  });

  it("handles empty parsed intent without crashing", () => {
    const results = recommendComponents({
      intent: {
        query: "",
        categories: [],
        componentKinds: [],
        motionStyles: [],
        sources: [],
        keywords: [],
        confidence: 0
      },
      components,
      limit: 2
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.reason).toBe("Included as a fallback candidate.");
  });
});
