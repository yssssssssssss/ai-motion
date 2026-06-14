import { describe, expect, it } from "vitest";
import type { MotionBlueprint, MotionOpportunity } from "@motion-lens/core";
import { reviewFlagsForOpportunity } from "./reviewFlags";

const baseOpportunity: MotionOpportunity = {
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
    whyNotAlternatives: "不使用飞行动效，因为当前不是加购场景。",
    noMotionAssessment: "可以不动，但会降低入口可见性。",
    differentiation: "同屏其他内容保持静态。",
    trigger: "首屏进入后播放一次。"
  },
  risks: [],
  recommendedParams: {
    durationMs: 220,
    easing: "decelerate",
    transform: "scale 1 -> 1.04 -> 1",
    repeat: "none"
  },
  knowledgeRefs: [
    {
      id: "principle-motion-value",
      title: "动效价值三分法",
      source: "动效设计规范系统（ing~）",
      pageRange: "1"
    }
  ]
};

function blueprintWith(opportunity: MotionOpportunity): MotionBlueprint {
  return {
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
      goalText: "提升转化",
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
      }
    ],
    opportunities: [opportunity],
    diagnostics: {
      warnings: [],
      analysisMode: "hybrid",
      noMotionSuggestions: []
    }
  };
}

describe("review opportunity flags", () => {
  it("does not flag a complete llm recommendation", () => {
    expect(reviewFlagsForOpportunity(blueprintWith(baseOpportunity), baseOpportunity)).toEqual([]);
  });

  it("flags fallback source, missing evidence, missing knowledge, homogeneous warning and low confidence", () => {
    const { reviewEvidence: _reviewEvidence, ...opportunityWithoutEvidence } = baseOpportunity;
    const opportunity: MotionOpportunity = {
      ...opportunityWithoutEvidence,
      recommendationSource: "local-fallback",
      confidence: 0.4,
      knowledgeRefs: []
    };
    const blueprint = {
      ...blueprintWith(opportunity),
      diagnostics: {
        warnings: ["质量门：多个不同元素使用了相同推荐动效，请复核是否存在模板化推荐。"],
        analysisMode: "hybrid" as const,
        noMotionSuggestions: []
      }
    };

    expect(reviewFlagsForOpportunity(blueprint, opportunity).map((flag) => flag.label)).toEqual([
      "需复核",
      "缺少解释",
      "缺少知识依据",
      "同质化风险",
      "低置信"
    ]);
  });
});
