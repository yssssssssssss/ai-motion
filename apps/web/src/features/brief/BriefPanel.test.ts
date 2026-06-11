import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefPanel, parsedChips } from "./BriefPanel";
import { type BriefParseResult } from "@motion-tool/core";

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
    onGenerate: () => {},
    onGenerateAtomicMotion: () => {},
    atomicMotionPanel: null
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

  it("renders recommendation, controlled generation, and atomic motion tabs above the content area", () => {
    const html = renderToStaticMarkup(createElement(BriefPanel, baseProps));

    expect(html).toContain("智能推荐");
    expect(html).toContain("自然语义生成");
    expect(html).toContain("原子动效参数");
    expect(html).toContain('aria-label="动效需求模式"');
    expect(html).toContain("discovery-panel is-recommend-mode");
    expect(html).toContain("生成推荐");
  });

  it("switches button copy and status copy in controlled generation mode", () => {
    const idleHtml = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        mode: "generate"
      })
    );
    const loadingHtml = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        mode: "generate",
        isLoading: true,
        generationStatus: "正在基于 Top 3 候选和规范生成..."
      })
    );

    expect(idleHtml).toContain("自然语义生成动效组件");
    expect(idleHtml).toContain("discovery-panel is-generate-mode");
    expect(idleHtml).toContain("background-gradient-animation is-active");
    expect(idleHtml).toContain("生成新组件");
    expect(idleHtml).not.toContain("atomic-motion-button");
    expect(loadingHtml).not.toContain("text-flipping-board");
    expect(loadingHtml).not.toContain("aurora-background-layer");
    expect(loadingHtml).toContain("正在生成...");
    expect(loadingHtml).toContain("正在基于 Top 3 候选和规范生成...");
    expect(loadingHtml).not.toContain('aria-label="生成理解结果"');
    expect(loadingHtml).not.toContain("已理解");
    expect(loadingHtml).not.toContain("页面转场");
    expect(loadingHtml).not.toContain("排除 按钮");
  });

  it("renders the ethereal shadow background only for atomic motion mode", () => {
    const generateHtml = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        mode: "generate"
      })
    );
    const atomicHtml = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        mode: "atomic",
        atomicMotionPanel: createElement("section", { "aria-label": "原子动效配置" })
      })
    );

    expect(generateHtml).not.toContain("ethereal-shadow-background");
    expect(atomicHtml).toContain('aria-hidden="true"');
    expect(atomicHtml).toContain("ethereal-shadow-background");
    expect(atomicHtml).toContain("ethereal-shadow-filter");
    expect(atomicHtml).toContain("ethereal-shadow-noise");
    expect(atomicHtml).toContain("<animate");
    expect(atomicHtml).toContain('attributeName="baseFrequency"');
    expect(atomicHtml).toContain('attributeName="scale"');
  });

  it("replaces the prompt input with embedded atomic motion parameters in atomic mode", () => {
    const html = renderToStaticMarkup(
      createElement(BriefPanel, {
        ...baseProps,
        mode: "atomic",
        atomicMotionPanel: createElement(
          "section",
          { "aria-label": "原子动效配置" },
          "弹窗反馈 · 中型尺寸"
        )
      })
    );

    expect(html).toContain("原子动效参数");
    expect(html).toContain("discovery-panel is-atomic-mode");
    expect(html).toContain("brief-content-region is-atomic-content");
    expect(html).toContain("弹窗反馈 · 中型尺寸");
    expect(html).toContain("生成原子草稿");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("生成推荐");
    expect(html).not.toContain("生成新组件");
  });
});
