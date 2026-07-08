import type { ZeroLayerDiagnosticReport } from "./diagnosticSchema";
import type { ZeroLayerRecipeSampleReport } from "./createZeroLayerRecipeSampleReport";
import type { ZeroMotionSalienceReport } from "./zeroMotionSalience";
import type { ZeroMotionFailureType, ZeroMotionSpec } from "./zeroMotionSpec";
import type { ZeroLayerRecipeRecommendationResult } from "./zeroLayerRecipeRecommender";
import type { ZeroLayerMotionRecipeId } from "./zeroLayerMotionRecipes";

export type ZeroMotionRepairAdvice = {
  schemaVersion: "motion-copilot.zero-motion-repair-advice.v1";
  summary: string;
  actions: Array<{
    id: string;
    type: "change-recipe" | "increase-salience" | "confirm-binding" | "simplify-motion" | "keep-safe";
    label: string;
    description: string;
    recipeId?: ZeroLayerMotionRecipeId;
  }>;
  userFacingMessage: string;
  failures: ZeroMotionFailureType[];
};

function hasSampleRisk(report: ZeroLayerRecipeSampleReport | undefined, code: string): boolean {
  return Boolean(report?.risks.some((risk) => risk.code === code));
}

export function createZeroMotionRepairAdvice(input: {
  spec: ZeroMotionSpec;
  recommendation?: ZeroLayerRecipeRecommendationResult;
  salience?: ZeroMotionSalienceReport;
  diagnosticReport?: ZeroLayerDiagnosticReport;
  sampleReport?: ZeroLayerRecipeSampleReport;
}): ZeroMotionRepairAdvice {
  const failures = new Set<ZeroMotionFailureType>(input.spec.risks);
  if (input.salience?.diagnosis === "too-subtle") failures.add("under-motion");
  if (hasSampleRisk(input.sampleReport, "RECIPE_DIFF_TOO_SMALL")) failures.add("recipe-diff-too-small");
  if (hasSampleRisk(input.sampleReport, "TAIL_FRAME_MISMATCH")) failures.add("tail-mismatch");
  if (hasSampleRisk(input.sampleReport, "MATCHED_CORRIDOR_OVERFLOW")) failures.add("corridor-overflow");
  if ((input.diagnosticReport?.matching.lowConfidence.length ?? 0) > 0) failures.add("low-confidence-match");

  const actions: ZeroMotionRepairAdvice["actions"] = [];
  if (failures.has("tail-mismatch") || failures.has("corridor-overflow")) {
    actions.push({
      id: "use-safe-smooth-morph",
      type: "keep-safe",
      label: "切换为稳妥形变",
      description: "当前方案触发硬性门禁，建议先使用丝滑形变保证尾帧和空间约束。",
      recipeId: "smooth-morph"
    });
  }
  if (failures.has("under-motion") || failures.has("recipe-diff-too-small")) {
    const candidate = input.recommendation?.candidates.find((item) => item.recipeId === "content-stagger") ??
      input.recommendation?.candidates.find((item) => item.recipeId === "mask-reveal");
    actions.push({
      id: "increase-motion-salience",
      type: "increase-salience",
      label: "增强变化感",
      description: "当前动效可用但体感偏弱，建议使用内容错峰或遮罩揭示增强新增内容的出现节奏。",
      recipeId: candidate?.recipeId ?? "content-stagger"
    });
  }
  if (failures.has("low-confidence-match")) {
    actions.push({
      id: "confirm-layer-binding",
      type: "confirm-binding",
      label: "确认图层配对",
      description: "存在低置信图层匹配，建议检查首尾帧中名称相似或位置相近的图层是否对应。"
    });
  }
  if (failures.has("motion-too-complex")) {
    actions.push({
      id: "simplify-motion",
      type: "simplify-motion",
      label: "先使用克制方案",
      description: "当前首尾帧变化较复杂，建议先用丝滑形变或焦点引导，再逐步增强。",
      recipeId: input.recommendation?.selectedRecipeId ?? "smooth-morph"
    });
  }
  if (actions.length === 0 && input.recommendation?.selectedRecipeId) {
    actions.push({
      id: "apply-recommended-recipe",
      type: "change-recipe",
      label: "应用推荐方案",
      description: input.recommendation.summary,
      recipeId: input.recommendation.selectedRecipeId
    });
  }

  const failureList = [...failures];
  const summary =
    failureList.length > 0
      ? `发现 ${failureList.length} 个可优化点：${failureList.join("、")}`
      : "当前推荐方案未发现明显风险。";
  const userFacingMessage =
    failureList.length > 0
      ? actions[0]?.description ?? "当前动效存在可优化点，建议先查看推荐动作。"
      : input.recommendation?.summary ?? "当前动效可以直接预览和导出。";

  return {
    schemaVersion: "motion-copilot.zero-motion-repair-advice.v1",
    summary,
    actions,
    userFacingMessage,
    failures: failureList
  };
}
