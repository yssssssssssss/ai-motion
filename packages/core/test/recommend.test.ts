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
    manifest: { id: "hero-text-reveal", params: [], presets: [] },
    source: { files: [] }
  },
  {
    id: "magnetic-button",
    name: "Magnetic Button",
    category: "interaction",
    tags: ["button", "hover"],
    useCases: ["cta"],
    moods: ["expressive"],
    manifest: { id: "magnetic-button", params: [], presets: [] },
    source: {
      files: [
        {
          kind: "css",
          content: ".button { background: linear-gradient(90deg, #6B36FA, #3544EB); transition: transform 300ms; } .button:hover { transform: scale(1.08); box-shadow: 0 0 20px #8F55FD; }"
        },
        { kind: "html", content: "<button>Start campaign</button>" }
      ]
    }
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
        semanticQuery: "workeasy hover cta button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover"],
        sources: ["workeasy"],
        keywords: ["save", "cta"],
        softPreferences: ["活动页", "紫色", "hover", "CTA"],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      },
      components,
      limit: 3
    });

    expect(results[0]?.componentId).toBe("magnetic-button");
    expect(results[0]?.reason).toContain("命中");
    expect(results[0]?.matches).toEqual(expect.arrayContaining(["按钮", "hover", "紫色", "CTA"]));
  });

  it("creates a fallback intent from raw brief text", () => {
    const intent = createFallbackBriefIntent("WorkEasy hover button with tech style");

    expect(intent.query).toBe("WorkEasy hover button with tech style");
    expect(intent.componentKinds).toContain("button");
    expect(intent.motionStyles).toContain("hover");
    expect(intent.sources).toContain("workeasy");
    expect(intent.keywords).toContain("tech");
    expect(intent.semanticQuery).toBe("WorkEasy hover button with tech style");
    expect(intent.softPreferences).toEqual(expect.arrayContaining(["button", "hover", "workeasy", "tech"]));
  });

  it("handles empty parsed intent without crashing", () => {
    const results = recommendComponents({
      intent: {
        query: "",
        semanticQuery: "",
        categories: [],
        componentKinds: [],
        motionStyles: [],
        sources: [],
        keywords: [],
        softPreferences: [],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0
      },
      components,
      limit: 2
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.reason).toBe("作为兜底候选展示。");
  });

  it("uses search profiles to rank natural language component needs", () => {
    const results = recommendComponents({
      intent: {
        query: "我想要一个适合活动页的紫色按钮 hover 动效",
        semanticQuery: "适合活动页 CTA 的紫蓝色按钮 hover 动效，带缩放和发光反馈",
        categories: [],
        componentKinds: [],
        motionStyles: [],
        sources: [],
        keywords: [],
        softPreferences: ["活动页", "CTA", "紫色", "按钮", "hover", "发光"],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.92
      },
      components,
      limit: 2
    });

    expect(results[0]?.componentId).toBe("magnetic-button");
    expect(results[0]?.matches).toEqual(expect.arrayContaining(["活动页", "CTA", "紫色", "按钮", "hover"]));
  });
});
