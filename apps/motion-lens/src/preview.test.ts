import { describe, expect, it } from "vitest";
import type { MotionOpportunity, MotionPreviewSpec } from "@motion-lens/core";
import { previewTemplateFor, previewTimingStyle } from "./preview";

const baseOpportunity: MotionOpportunity = {
  id: "opportunity",
  elementId: "element",
  recommendationSource: "llm-opportunity",
  priority: "P1",
  score: 80,
  confidence: 0.9,
  businessGoal: "cvr",
  decisionStage: "decide",
  friction: "attention",
  strategy: "attention",
  patternId: "cta-one-shot-highlight",
  patternName: "CTA 一次性强调",
  reason: "关键按钮需要首次强调。",
  risks: [],
  recommendedParams: {
    durationMs: 220,
    easing: "decelerate",
    transform: "scale 1 -> 1.04 -> 1",
    repeat: "none"
  }
};

const baseSpec: MotionPreviewSpec = {
  opportunityId: "opportunity",
  role: "button",
  patternId: "cta-one-shot-highlight",
  title: "CTA 一次性强调",
  params: baseOpportunity.recommendedParams
};

describe("MotionLens preview mapping", () => {
  it("uses pattern-specific templates instead of only element roles", () => {
    expect(previewTemplateFor(baseSpec, baseOpportunity)).toBe("cta");
    expect(
      previewTemplateFor(
        { ...baseSpec, patternId: "button-press-success" },
        { ...baseOpportunity, patternId: "button-press-success", patternName: "按钮压感确认" }
      )
    ).toBe("press");
    expect(
      previewTemplateFor(
        { ...baseSpec, role: "sequence", patternId: "card-focus-spotlight" },
        { ...baseOpportunity, patternId: "card-focus-spotlight", patternName: "重点卡片聚焦" }
      )
    ).toBe("spotlight");
  });

  it("uses dedicated templates for knowledge-backed motion patterns", () => {
    const cases = [
      ["add-to-cart-fly", "加购飞行动效", "cart"],
      ["favorite-heartbeat", "收藏心跳反馈", "favorite"],
      ["payment-success-ceremony", "支付成功仪式感", "ceremony"],
      ["logistics-progress-motion", "物流进度推进", "progress"],
      ["empty-state-scene-motion", "缺省页场景化微动画", "empty"],
      ["rating-emotion-feedback", "评分表情反馈", "rating"],
      ["feed-interest-badge", "利益点角标轻动效", "badge"]
    ] as const;

    for (const [patternId, patternName, template] of cases) {
      expect(
        previewTemplateFor(
          { ...baseSpec, role: "sequence", patternId, title: patternName },
          { ...baseOpportunity, patternId, patternName }
        )
      ).toBe(template);
    }
  });

  it("maps timing params to bounded preview CSS variables", () => {
    const style = previewTimingStyle(
      {
        ...baseOpportunity,
        recommendedParams: {
          ...baseOpportunity.recommendedParams,
          durationMs: 120,
          delayMs: 320,
          easing: "spring",
          transform: "model supplied transform should not be injected",
          repeat: "limited"
        }
      },
      "press",
      { paused: true }
    ) as Record<string, unknown>;

    expect(style["--preview-duration"]).toBe("900ms");
    expect(style["--preview-transform"]).toBe("scale(0.96)");
    expect(style.animationDelay).toBe("320ms");
    expect(style.animationIterationCount).toBe("infinite");
    expect(style.animationPlayState).toBe("paused");
  });
});
