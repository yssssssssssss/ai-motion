import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefPanel, generationUnderstandingChips, parsedChips } from "./BriefPanel";
import { parseSemanticGenerationIntent, type BriefParseResult } from "@motion-tool/core";

describe("parsedChips", () => {
  it("deduplicates and localizes parsed terms before rendering chips", () => {
    const result: BriefParseResult = {
      mode: "llm",
      message: "LLM parsed",
      intent: {
        query: "button",
        semanticQuery: "workeasy hover cta button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover", "button"],
        sources: ["workeasy"],
        keywords: ["button", "cta"],
        softPreferences: ["紫色", "cta"],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      }
    };

    expect(parsedChips(result)).toEqual(["按钮", "悬停", "工作易", "转化入口", "紫色"]);
  });
});

describe("generationUnderstandingChips", () => {
  it("summarizes natural generation intent without requiring structured user input", () => {
    const intent = parseSemanticGenerationIntent(
      "基于前后进场代码动效，做一个更快一点的版本，进入距离短一点，泛白弱一点，不要生成按钮"
    );

    expect(generationUnderstandingChips(intent)).toEqual(
      expect.arrayContaining(["页面转场", "前后进场代码动效", "位移", "淡入", "排除 生成按钮"])
    );
  });

  it("summarizes mobile page layer entrance intent without showing button fallback", () => {
    const intent = parseSemanticGenerationIntent("做一个移动端页面，需要前景图层以缩放效果入场");
    const chips = generationUnderstandingChips(intent);

    expect(intent.role).toBe("mobile-page");
    expect(chips).toEqual(expect.arrayContaining(["移动端页面", "缩放", "入场"]));
    expect(chips).not.toContain("按钮");
  });
});

describe("BriefPanel", () => {
  const baseProps = {
    brief: "文字入场动效",
    parseResult: null,
    isLoading: false,
    isDisabled: false,
    mode: "recommend" as const,
    onBriefChange: () => {},
    onModeChange: () => {},
    onRecommend: () => {},
    onGenerate: () => {}
  };

  it("disables recommendation while the component library is still loading", () => {
    const html = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        isDisabled: true,
        mode: "recommend"
      })
    );

    expect(html).toContain("组件库加载中...");
    expect(html).toContain('disabled=""');
  });

  it("renders recommendation and controlled generation tabs above the input", () => {
    const html = renderToStaticMarkup(createElement(BriefPanel, baseProps));

    expect(html).toContain("智能推荐");
    expect(html).toContain("自然语义生成");
    expect(html).toContain('aria-label="动效需求模式"');
    expect(html).toContain("discovery-panel is-recommend-mode");
    expect(html).toContain("生成推荐");
  });

  it("switches button copy and status copy in controlled generation mode", () => {
    const generationIntent = parseSemanticGenerationIntent("不要按钮，我要一个页面前后切换的进场动效");
    const html = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        mode: "generate",
        isLoading: true,
        generationIntent,
        generationStatus: "正在基于 Top 3 候选和规范生成..."
      })
    );

    expect(html).toContain("自然语义生成动效组件");
    expect(html).toContain("discovery-panel is-generate-mode");
    expect(html).toContain("background-gradient-animation is-active");
    expect(html).not.toContain("text-flipping-board");
    expect(html).not.toContain("aurora-background-layer");
    expect(html).toContain("正在生成...");
    expect(html).toContain("正在基于 Top 3 候选和规范生成...");
    expect(html).toContain('aria-label="生成理解结果"');
    expect(html).toContain("已理解");
    expect(html).toContain("页面转场");
    expect(html).toContain("排除 按钮");
  });
});
