import type { MotionBlueprint, MotionOpportunity } from "@motion-lens/core";

export type ReviewFlag = {
  label: string;
  reason: string;
};

export function reviewFlagsForOpportunity(
  blueprint: MotionBlueprint,
  opportunity: MotionOpportunity
): ReviewFlag[] {
  const flags: ReviewFlag[] = [];

  if (opportunity.recommendationSource !== "llm-opportunity") {
    flags.push({
      label: "需复核",
      reason: "当前结果不是 AI 原生推荐。"
    });
  }
  if (!opportunity.reviewEvidence) {
    flags.push({
      label: "缺少解释",
      reason: "缺少模型评审依据。"
    });
  }
  if (
    blueprint.diagnostics.analysisMode === "hybrid" &&
    (!opportunity.knowledgeRefs || opportunity.knowledgeRefs.length === 0)
  ) {
    flags.push({
      label: "缺少知识依据",
      reason: "未关联可追溯的动效知识引用。"
    });
  }
  if (blueprint.diagnostics.warnings.some((warning) => warning.includes("相同推荐动效"))) {
    flags.push({
      label: "同质化风险",
      reason: "多个机会点可能使用了模板化推荐。"
    });
  }
  if (opportunity.confidence < 0.55) {
    flags.push({
      label: "低置信",
      reason: "模型置信度偏低。"
    });
  }

  return flags;
}
