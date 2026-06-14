import type { MotionBlueprint, MotionOpportunity } from "@motion-lens/core";

export type BlueprintQualityIssue = {
  severity: "warning";
  code:
    | "homogeneous-pattern"
    | "missing-knowledge-ref"
    | "looping-attention"
    | "duration-out-of-range"
    | "low-confidence";
  message: string;
};

export function withQualityDiagnostics(blueprint: MotionBlueprint): MotionBlueprint {
  const issues = evaluateMotionBlueprintQuality(blueprint);
  if (issues.length === 0) return blueprint;

  const warnings = [...blueprint.diagnostics.warnings];
  for (const issue of issues) {
    if (!warnings.includes(issue.message)) warnings.push(issue.message);
  }

  return {
    ...blueprint,
    diagnostics: {
      ...blueprint.diagnostics,
      warnings
    }
  };
}

export function evaluateMotionBlueprintQuality(blueprint: MotionBlueprint): BlueprintQualityIssue[] {
  const issues: BlueprintQualityIssue[] = [];
  const opportunities = blueprint.opportunities;

  if (hasHomogeneousPattern(opportunities)) {
    issues.push({
      severity: "warning",
      code: "homogeneous-pattern",
      message: "质量门：多个不同元素使用了相同推荐动效，请复核是否存在模板化推荐。"
    });
  }

  const missingKnowledgeCount = opportunities.filter(
    (opportunity) =>
      opportunity.confidence >= 0.7 &&
      blueprint.diagnostics.analysisMode === "hybrid" &&
      (!opportunity.knowledgeRefs || opportunity.knowledgeRefs.length === 0)
  ).length;
  if (missingKnowledgeCount > 0) {
    issues.push({
      severity: "warning",
      code: "missing-knowledge-ref",
      message: `质量门：${missingKnowledgeCount} 个高置信机会点缺少知识依据，请补充引用或降级为人工建议。`
    });
  }

  if (opportunities.some(isLoopingAttentionMotion)) {
    issues.push({
      severity: "warning",
      code: "looping-attention",
      message: "质量门：发现循环播放的强调类动效，建议改为首次进入或用户触发后播放一次。"
    });
  }

  const durationOutOfRangeCount = opportunities.filter((opportunity) => {
    const duration = opportunity.recommendedParams.durationMs;
    return duration < 80 || duration > 600;
  }).length;
  if (durationOutOfRangeCount > 0) {
    issues.push({
      severity: "warning",
      code: "duration-out-of-range",
      message: `质量门：${durationOutOfRangeCount} 个机会点的推荐时长超出 80-600ms 常规评审范围。`
    });
  }

  const lowConfidenceCount = opportunities.filter((opportunity) => opportunity.confidence < 0.55).length;
  if (lowConfidenceCount > 0) {
    issues.push({
      severity: "warning",
      code: "low-confidence",
      message: `质量门：${lowConfidenceCount} 个机会点置信度偏低，建议人工复核或重新分析。`
    });
  }

  return issues;
}

function hasHomogeneousPattern(opportunities: MotionOpportunity[]): boolean {
  if (opportunities.length < 3) return false;
  const elementIds = new Set(opportunities.map((opportunity) => opportunity.elementId));
  if (elementIds.size < 3) return false;
  const patternKeys = new Set(
    opportunities.map((opportunity) => `${opportunity.patternId}::${opportunity.patternName}`)
  );
  return patternKeys.size === 1;
}

function isLoopingAttentionMotion(opportunity: MotionOpportunity): boolean {
  const text = `${opportunity.patternId} ${opportunity.patternName} ${opportunity.strategy}`.toLowerCase();
  const isAttention = opportunity.strategy === "attention" || text.includes("cta") || text.includes("强调");
  return isAttention && opportunity.recommendedParams.repeat === "loop";
}
