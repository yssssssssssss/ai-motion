import { describe, expect, it } from "vitest";
import type { MotionBlueprint } from "@motion-lens/core";
import { reviewReportHtml } from "./report";

const blueprint: MotionBlueprint = {
  version: "0.1",
  source: {
    kind: "image",
    id: "upload",
    name: "设计稿.png",
    width: 1000,
    height: 800
  },
  context: {
    pageType: "commerce",
    goalText: "提升主按钮转化",
    inferredGoal: "cvr"
  },
  elements: [
    {
      id: "cta",
      kind: "button",
      label: "立即购买",
      bounds: { x: 700, y: 640, width: 180, height: 56 },
      confidence: 0.95,
      visualWeight: 0.6,
      interactiveLikelihood: 1
    },
    {
      id: "decor",
      kind: "content",
      label: "氛围插画",
      bounds: { x: 40, y: 60, width: 240, height: 180 },
      confidence: 0.7,
      visualWeight: 0.4,
      interactiveLikelihood: 0.1
    }
  ],
  opportunities: [
    {
      id: "cta-highlight",
      elementId: "cta",
      recommendationSource: "llm-opportunity",
      priority: "P0",
      score: 88,
      confidence: 0.92,
      businessGoal: "cvr",
      decisionStage: "decide",
      friction: "attention",
      strategy: "attention",
      patternId: "cta-one-shot-highlight",
      patternName: "CTA 一次性强调",
      reason: "主按钮处于关键转化路径。",
      reviewEvidence: {
        whyThisMotion: "主按钮位于转化收口，轻量强调能帮助用户识别下一步。",
        whyNotAlternatives: "不使用飞行动效，因为当前不是加购场景；不使用仪式感，因为尚未完成支付。",
        noMotionAssessment: "可以不动，但会降低首屏关键行动入口的可见性。",
        differentiation: "同屏其他内容保持静态，只让主按钮获得一次性强调。",
        trigger: "首屏进入后播放一次。"
      },
      risks: ["不要循环播放。"],
      recommendedParams: {
        durationMs: 220,
        easing: "decelerate",
        transform: "scale 1 -> 1.04 -> 1",
        repeat: "none"
      },
      alternativeRecommendations: [
        {
          patternId: "button-press-feedback",
          patternName: "按钮压感确认",
          reason: "如果主按钮已经足够醒目，可把动效放到点击确认反馈。",
          recommendedParams: {
            durationMs: 160,
            easing: "spring",
            transform: "scale(0.98)",
            repeat: "none"
          },
          risks: ["不要替代主路径可见性。"]
        }
      ],
      knowledgeRefs: [
        {
          id: "principle-motion-value",
          title: "动效价值三分法",
          source: "动效设计规范系统（ing~）",
          pageRange: "1"
        }
      ]
    }
  ],
  diagnostics: {
    warnings: ["质量门：示例诊断。"],
    analysisMode: "hybrid",
    noMotionSuggestions: [
      {
        elementId: "decor",
        label: "氛围插画",
        reason: "装饰内容不承担明确任务。",
        recommendation: "no-motion",
        risks: ["避免为了动而动。"]
      }
    ]
  }
};

describe("MotionLens review report", () => {
  it("exports summary, markers, risk groups, no-motion suggestions and print styles", () => {
    const html = reviewReportHtml(blueprint, {
      source: { name: "设计稿.png" },
      dataUrl: "data:image/png;base64,abc"
    });

    expect(html).toContain("机会点明细");
    expect(html).toContain("AI 原生推荐");
    expect(html).toContain("风险汇总");
    expect(html).toContain("不建议动效区域");
    expect(html).toContain("诊断信息");
    expect(html).toContain("质量门：示例诊断。");
    expect(html).toContain("评审依据");
    expect(html).toContain("为什么不是其他动效");
    expect(html).toContain("首屏进入后播放一次。");
    expect(html).toContain("备选：按钮压感确认");
    expect(html).toContain("如果主按钮已经足够醒目");
    expect(html).toContain("@media print");
    expect(html).toContain("left:70%");
    expect(html).toContain("动效价值三分法 / 1");
  });
});
