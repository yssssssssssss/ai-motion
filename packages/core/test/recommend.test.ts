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
          content:
            ".button { background: linear-gradient(90deg, #6B36FA, #3544EB); transition: transform 300ms; } .button:hover { transform: scale(1.08); box-shadow: 0 0 20px #8F55FD; }"
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
    expect(results[0]?.matches).toEqual(expect.arrayContaining(["按钮", "悬停", "紫色", "转化入口"]));
    expect(results[0]?.matches).not.toEqual(expect.arrayContaining(["hover", "CTA"]));
  });

  it("does not treat natural-language component kind phrases as impossible hard filters", () => {
    const results = recommendComponents({
      intent: {
        query: "我想要一个适合软件服务首页的文字入场动效",
        semanticQuery: "适合 SaaS 首页首屏标题的文字入场动效，平滑淡入并上滑出现",
        categories: ["text animation", "entrance animation", "homepage hero"],
        componentKinds: ["animated headline"],
        motionStyles: ["fade in", "slide up", "smooth easing"],
        sources: [],
        keywords: ["SaaS", "首页首屏", "标题动效"],
        softPreferences: ["软件服务首页", "文字入场", "干净简洁"],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.92
      },
      components,
      limit: 2
    });

    expect(results[0]?.componentId).toBe("hero-text-reveal");
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
    expect(results[0]?.matches).toEqual(
      expect.arrayContaining(["活动页", "转化入口", "紫色", "按钮", "悬停"])
    );
    expect(results[0]?.matches).not.toEqual(expect.arrayContaining(["CTA", "hover"]));
  });

  it("honors source and kind filters before scoring broad text matches", () => {
    const importedCard = {
      id: "uploaded-card",
      name: "Uploaded Product Card",
      category: "layout",
      tags: ["card"],
      useCases: ["landing-page"],
      moods: ["subtle"],
      manifest: { id: "uploaded-card", params: [], presets: [] },
      source: {
        origin: "imported",
        files: [
          { kind: "html", content: '<article class="card">商品信息</article>' },
          { kind: "css", content: ".card { background: #ffffff; transition: transform 200ms; }" }
        ]
      }
    } as unknown as MotionComponent;
    const nativeCard = {
      ...importedCard,
      id: "native-card",
      name: "Native Product Card",
      source: { origin: "builtin", files: importedCard.source.files }
    } as unknown as MotionComponent;

    const results = recommendComponents({
      intent: {
        query: "上传的卡片动效",
        semanticQuery: "uploaded card motion",
        categories: ["layout"],
        componentKinds: ["card"],
        motionStyles: [],
        sources: ["uploaded"],
        keywords: [],
        softPreferences: ["上传", "卡片"],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      },
      components: [nativeCard, importedCard],
      limit: 2
    });

    expect(results[0]?.componentId).toBe("uploaded-card");
  });

  it("keeps hard constraints ahead of generic keyword score", () => {
    const purpleButton = components[1] as MotionComponent;
    const plainButton = {
      ...purpleButton,
      id: "plain-button",
      name: "Plain Button",
      source: {
        files: [
          {
            kind: "css",
            content:
              ".button { background: #111827; transition: transform 300ms; } .button:hover { transform: scale(1.03); }"
          },
          { kind: "html", content: "<button>Start campaign</button>" }
        ]
      }
    } as unknown as MotionComponent;

    const results = recommendComponents({
      intent: {
        query: "紫色按钮",
        semanticQuery: "purple button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: [],
        sources: [],
        keywords: [],
        softPreferences: ["按钮"],
        hardConstraints: ["紫色"],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      },
      components: [plainButton, purpleButton],
      limit: 2
    });

    expect(results[0]?.componentId).toBe("magnetic-button");
    expect(results[0]?.missing).toBeUndefined();
  });

  it("does not fall back to the wrong component role when the requested role is explicit", () => {
    const results = recommendComponents({
      intent: {
        query: "我需要一个活动页卡片动效",
        semanticQuery: "campaign card motion",
        categories: ["layout"],
        componentKinds: ["card"],
        motionStyles: [],
        sources: [],
        keywords: [],
        softPreferences: ["活动页"],
        hardConstraints: ["卡片"],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      },
      components,
      limit: 2
    });

    expect(results).toEqual([]);
  });

  it("returns no result when strict visual and scene requirements are absent", () => {
    const results = recommendComponents({
      intent: {
        query: "直播间礼物雨粒子爆炸背景",
        semanticQuery: "live streaming gift rain particle explosion background",
        categories: ["background"],
        componentKinds: [],
        motionStyles: [],
        sources: [],
        keywords: [],
        softPreferences: ["直播间", "礼物雨", "粒子", "爆炸"],
        hardConstraints: ["背景", "粒子"],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      },
      components,
      limit: 2
    });

    expect(results).toEqual([]);
  });
});
