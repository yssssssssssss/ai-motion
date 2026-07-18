import type { ZeroMotionSpec, ZeroMotionSceneType } from "./zeroMotionSpec";
import {
  adaptZeroLayerRecipeParameters,
  type ZeroLayerRecipeAdaptedParameters
} from "./adaptZeroLayerRecipeParameters";
import {
  classifyZeroMotionInteractionPattern,
  type ZeroMotionInteractionPattern
} from "./zeroMotionInteractionPattern";
import { zeroLayerRecipeManifests, type ZeroLayerRecipeManifest } from "./zeroLayerRecipeManifests";
import type { ZeroLayerMotionRecipeId } from "./zeroLayerMotionRecipes";

export type ZeroLayerRecipeRecommendation = {
  recipeId: ZeroLayerMotionRecipeId;
  score: number;
  reasons: string[];
  warnings: string[];
  adaptedParameters: ZeroLayerRecipeAdaptedParameters;
};

export type ZeroLayerRecipeRecommendationResult = {
  schemaVersion: "motion-copilot.zero-layer-recipe-recommendation.v1";
  sceneType: ZeroMotionSceneType;
  candidates: ZeroLayerRecipeRecommendation[];
  selectedRecipeId?: ZeroLayerMotionRecipeId;
  interactionPattern: ZeroMotionInteractionPattern;
  summary: string;
};

function recipeLabel(recipeId: ZeroLayerMotionRecipeId): string {
  return zeroLayerRecipeManifests.find((recipe) => recipe.id === recipeId)?.label ?? recipeId;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreManifest(
  manifest: ZeroLayerRecipeManifest,
  spec: ZeroMotionSpec,
  pattern: ZeroMotionInteractionPattern
): ZeroLayerRecipeRecommendation {
  const recipeId = manifest.id;
  const capability = manifest.capabilities;
  const sceneMatches = manifest.sceneTypes.includes(spec.scene.type);
  let score = sceneMatches ? 62 : 30;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (sceneMatches) {
    reasons.push(`适合${spec.scene.type}场景：${manifest.bestFor[0] ?? manifest.summary}`);
  } else if (manifest.avoidWhen.length > 0) {
    warnings.push(`不建议：${manifest.avoidWhen[0]}`);
  }
  if (
    (spec.scene.type === "horizontal-expand" || spec.scene.type === "vertical-expand") &&
    (recipeId === "container-first" ||
      recipeId === "axis-expand" ||
      (spec.scene.type === "vertical-expand" && recipeId === "dropdown-reveal"))
  ) {
    score += recipeId === "container-first" ? 18 : recipeId === "dropdown-reveal" ? 16 : 14;
    reasons.push("主容器尺寸变化明显，优先保持容器形变节奏");
  }
  if (spec.scene.type === "tab-switch" && recipeId === "tab-indicator-slide") {
    score += 30;
    reasons.push("Tab 状态切换适合先移动高亮/指示器，再替换内容");
  }
  if (spec.scene.type === "card-enter" && recipeId === "card-expand-reveal") {
    score += 28;
    reasons.push("卡片出现或展开适合容器揭示节奏");
  }
  if (spec.scene.type === "list-reorder" && recipeId === "list-insert-push") {
    score += 30;
    reasons.push("列表变化适合用推开补位表达空间关系");
  }
  if (spec.scene.type === "modal-enter" && recipeId === "bottom-sheet-rise") {
    score += spec.deltas.dominantDy >= 0 ? 24 : 18;
    reasons.push("浮层出现适合使用蒙层和面板分阶段进入");
  }
  if (spec.deltas.textChangeCount > 0 && recipeId === "content-replace") {
    score += 24;
    reasons.push("检测到文案变化，适合旧内容先退、新内容补入");
  }
  if (pattern.type === "dropdown-reveal" && recipeId === "dropdown-reveal") {
    score += 58;
    reasons.push(pattern.reasons[0] ?? "尾帧出现下拉内容，优先使用下拉展开空间策略");
  }
  if (
    pattern.type === "dropdown-reveal" &&
    recipeId !== "dropdown-reveal" &&
    recipeId !== "anchored-popover"
  ) {
    score -= 26;
    warnings.push("检测到下拉结构，该方案不作为首选。");
  }
  if (pattern.type === "anchored-popover" && recipeId === "anchored-popover") {
    score += 18;
    reasons.push("新增浮层与触发区相邻，适合锚点浮层进入");
  }
  if (pattern.type === "cascade-items" && recipeId === "content-stagger") {
    score += spec.scene.type === "list-reorder" ? 6 : 18;
    reasons.push("多项内容变化明显，优先使用错峰节奏");
  }
  if (spec.scene.type === "card-enter" && (recipeId === "mask-reveal" || recipeId === "card-expand-reveal")) {
    score += 8;
    reasons.push("新增卡片适合通过遮罩揭示增强空间感");
  }
  if (
    spec.scene.type === "modal-enter" &&
    spec.topology.enterCount >= 3 &&
    recipeId === "anchored-popover" &&
    pattern.type !== "dropdown-reveal"
  ) {
    score += 16;
    reasons.push("新增浮层与触发区相邻，适合锚点浮层进入");
  }
  if (capability.handlesEnterExit && spec.topology.enterCount + spec.topology.exitCount > 0) {
    score += 12;
    reasons.push("可以处理新增和离开图层");
  }
  if (capability.handlesReorder && spec.deltas.yMotionCount >= 3) {
    score += 18;
    reasons.push("多图层纵向移动明显，适合重排节奏");
  }
  if (
    capability.handlesSubtleMotion &&
    spec.deltas.averageMoveDistance < 10 &&
    spec.topology.enterCount + spec.topology.exitCount === 0
  ) {
    score += 14;
    reasons.push("首尾帧位移较小，可通过内容节奏增强变化感");
  }
  if (
    capability.safeFallback &&
    (spec.scene.type === "unknown" || spec.risks.includes("low-confidence-match"))
  ) {
    score += 22;
    reasons.push("当前匹配或场景不够明确，优先保持稳妥形变");
  }
  if (spec.risks.includes("low-confidence-match") && !capability.safeFallback) {
    score -= 10;
    warnings.push("存在低置信匹配，建议预览后确认图层配对");
  }
  if (
    spec.scene.type === "complex-state-change" &&
    recipeId !== "smooth-morph" &&
    recipeId !== "focus-guide"
  ) {
    score -= 8;
    warnings.push("当前变化较复杂，单一强表现方案可能不稳定");
  }
  if (spec.risks.length > 0) {
    for (const warning of manifest.avoidWhen.slice(0, 2)) {
      const message = `不建议：${warning}`;
      if (!warnings.includes(message)) warnings.push(message);
    }
  }
  if (reasons.length === 0) reasons.push(`${recipeLabel(recipeId)}可作为备选探索方案`);

  return {
    recipeId,
    score: clampScore(score),
    reasons,
    warnings,
    adaptedParameters: adaptZeroLayerRecipeParameters(spec, recipeId)
  };
}

export function recommendZeroLayerRecipes(
  spec: ZeroMotionSpec,
  options: { limit?: number; sceneOverride?: ZeroMotionSceneType } = {}
): ZeroLayerRecipeRecommendationResult {
  const effectiveSpec =
    options.sceneOverride && options.sceneOverride !== spec.scene.type
      ? { ...spec, scene: { ...spec.scene, type: options.sceneOverride } }
      : spec;
  const limit = options.limit ?? 3;
  const interactionPattern = classifyZeroMotionInteractionPattern(effectiveSpec);
  const candidates = zeroLayerRecipeManifests
    .map((manifest) => scoreManifest(manifest, effectiveSpec, interactionPattern))
    .sort((left, right) => right.score - left.score || left.recipeId.localeCompare(right.recipeId))
    .slice(0, Math.max(1, limit));
  const selectedRecipeId = candidates[0]?.recipeId;
  return {
    schemaVersion: "motion-copilot.zero-layer-recipe-recommendation.v1",
    sceneType: effectiveSpec.scene.type,
    candidates,
    ...(selectedRecipeId ? { selectedRecipeId } : {}),
    interactionPattern,
    summary: selectedRecipeId
      ? `系统判断当前是 ${effectiveSpec.scene.type} / ${interactionPattern.label}，优先推荐「${recipeLabel(selectedRecipeId)}」。`
      : `系统判断当前是 ${effectiveSpec.scene.type} / ${interactionPattern.label}，暂无明确推荐。`
  };
}
