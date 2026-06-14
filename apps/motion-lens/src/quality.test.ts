import { describe, expect, it } from "vitest";
import type { MotionBlueprint, MotionOpportunity } from "@motion-lens/core";
import { evaluateMotionBlueprintQuality, withQualityDiagnostics } from "./quality";

const baseOpportunity: MotionOpportunity = {
  id: "opportunity-1",
  elementId: "element-1",
  recommendationSource: "llm-opportunity",
  priority: "P1",
  score: 80,
  confidence: 0.9,
  businessGoal: "cvr",
  decisionStage: "decide",
  friction: "attention",
  strategy: "attention",
  patternId: "same-pattern",
  patternName: "统一强调",
  reason: "模型给出的建议。",
  risks: [],
  recommendedParams: {
    durationMs: 220,
    easing: "decelerate",
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

const blueprint: MotionBlueprint = {
  version: "0.1",
  source: {
    kind: "image",
    id: "upload",
    name: "upload.png",
    width: 1200,
    height: 800
  },
  context: {
    pageType: "commerce",
    goalText: "提升转化",
    inferredGoal: "cvr"
  },
  elements: [
    {
      id: "element-1",
      kind: "button",
      label: "主按钮",
      bounds: { x: 1, y: 1, width: 100, height: 40 },
      confidence: 0.9,
      visualWeight: 0.5,
      interactiveLikelihood: 1
    }
  ],
  opportunities: [baseOpportunity],
  diagnostics: {
    warnings: [],
    noMotionSuggestions: [],
    analysisMode: "hybrid"
  }
};

describe("MotionLens quality gates", () => {
  it("does not flag a focused knowledge-backed opportunity", () => {
    expect(evaluateMotionBlueprintQuality(blueprint)).toEqual([]);
  });

  it("flags homogeneous, looping, missing-ref and out-of-range recommendations", () => {
    const riskyBlueprint: MotionBlueprint = {
      ...blueprint,
      opportunities: [0, 1, 2].map((index) => ({
        ...baseOpportunity,
        id: `opportunity-${index}`,
        elementId: `element-${index}`,
        confidence: index === 2 ? 0.4 : 0.9,
        recommendedParams: {
          ...baseOpportunity.recommendedParams,
          durationMs: index === 1 ? 720 : 220,
          repeat: index === 0 ? "loop" : "none"
        },
        knowledgeRefs: []
      }))
    };

    expect(evaluateMotionBlueprintQuality(riskyBlueprint).map((issue) => issue.code)).toEqual([
      "homogeneous-pattern",
      "missing-knowledge-ref",
      "looping-attention",
      "duration-out-of-range",
      "low-confidence"
    ]);

    const withDiagnostics = withQualityDiagnostics(riskyBlueprint);
    expect(withDiagnostics.diagnostics.warnings.join("\n")).toContain("质量门");
  });
});
