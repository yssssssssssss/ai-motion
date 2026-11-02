import type { ZeroMotionSpec, ZeroMotionSceneType } from "./zeroMotionSpec";
import {
  adaptZeroLayerRecipeParameters,
  type ZeroLayerRecipeAdaptedParameters
} from "./adaptZeroLayerRecipeParameters";
import { fillMotionPlanGeometryFromComposition } from "./compileMotionPlan";
import { layerIdForNode } from "./layerId";
import { sampleMotionPlan } from "./motionPlanRuntime";
import {
  classifyZeroMotionInteractionPattern,
  type ZeroMotionInteractionPattern
} from "./zeroMotionInteractionPattern";
import { zeroLayerRecipeManifests, type ZeroLayerRecipeManifest } from "./zeroLayerRecipeManifests";
import type { MotionKeyframe, MotionPlan, ZeroLayerMorphSource, ZeroLayerNode } from "./schema";
import {
  applyZeroLayerMotionRecipe,
  zeroLayerDiagnosticGateForSource,
  zeroLayerNativeRecipeBlockReason,
  type ZeroLayerMotionRecipeId
} from "./zeroLayerMotionRecipes";
import { resolveZeroLayerNodeOverride } from "./zeroLayerAppearance";

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

export type ZeroLayerSourceAwareRecommendationOptions = {
  limit?: number;
  sceneOverride?: ZeroMotionSceneType;
};

type EvaluatedRecommendation = {
  recommendation: ZeroLayerRecipeRecommendation;
  manifest: ZeroLayerRecipeManifest;
  motionPlan: MotionPlan;
};

const trajectorySampleProgress = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const minimumTrajectoryDistance = 0.04;
const sameFamilyPenalty = 24;

function recommendationMode(
  source: ZeroLayerMorphSource,
  spec: ZeroMotionSpec
): "native" | "safe-fallback" | "blocked" {
  const gate = zeroLayerDiagnosticGateForSource(source);
  if (zeroLayerNativeRecipeBlockReason(source)) return "blocked";
  if (
    gate?.strategy === "safe-fade-unmatched" ||
    spec.risks.includes("low-confidence-match") ||
    spec.topology.lowConfidenceCount > 0
  ) {
    return "safe-fallback";
  }
  return "native";
}

function hasVisiblePaint(node: ZeroLayerNode | undefined): node is ZeroLayerNode {
  if (!node || !node.visible || node.opacity <= 0.01) return false;
  if (node.kind === "image" || node.kind === "text" || node.assetId || node.renderMode === "image") {
    return true;
  }
  if (node.fills?.some((fill) => (fill.opacity ?? 1) > 0.01)) return true;
  if (node.strokes?.some((stroke) => (stroke.opacity ?? 1) > 0.01 && (stroke.width ?? 1) > 0)) {
    return true;
  }
  return Boolean(node.effects?.length);
}

function nodeArea(node: ZeroLayerNode | undefined): number {
  return hasVisiblePaint(node) ? Math.max(0, node.bounds.w) * Math.max(0, node.bounds.h) : 0;
}

function visibleAreaByLayer(source: ZeroLayerMorphSource): Map<string, number> {
  const areas = new Map<string, number>();
  for (const binding of source.bindingResult.bindings) {
    const rawFromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const rawToNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    const fromNode = rawFromNode
      ? resolveZeroLayerNodeOverride(rawFromNode, source.nodeOverrides, "from")
      : undefined;
    const toNode = rawToNode
      ? resolveZeroLayerNodeOverride(rawToNode, source.nodeOverrides, "to")
      : undefined;
    areas.set(binding.layerId, Math.max(nodeArea(fromNode), nodeArea(toNode)));
  }
  for (const node of source.bindingResult.enter) {
    areas.set(layerIdForNode(node), nodeArea(resolveZeroLayerNodeOverride(node, source.nodeOverrides, "to")));
  }
  for (const node of source.bindingResult.exit) {
    areas.set(
      layerIdForNode(node),
      nodeArea(resolveZeroLayerNodeOverride(node, source.nodeOverrides, "from"))
    );
  }
  return areas;
}

function stateDistance(
  left: Omit<MotionKeyframe, "offset" | "easing">,
  right: Omit<MotionKeyframe, "offset" | "easing">,
  stageWidth: number,
  stageHeight: number
): number {
  const dimensions: Array<{
    key: keyof Omit<MotionKeyframe, "offset" | "easing">;
    fallback: number;
    scale: number;
  }> = [
    { key: "x", fallback: 0, scale: stageWidth },
    { key: "y", fallback: 0, scale: stageHeight },
    { key: "width", fallback: 0, scale: stageWidth },
    { key: "height", fallback: 0, scale: stageHeight },
    { key: "scale", fallback: 1, scale: 1 },
    { key: "rotation", fallback: 0, scale: 180 },
    { key: "opacity", fallback: 1, scale: 1 }
  ];
  let total = 0;
  for (const dimension of dimensions) {
    const leftValue = left[dimension.key];
    const rightValue = right[dimension.key];
    if (leftValue == null && rightValue == null) continue;
    total +=
      Math.abs((leftValue ?? dimension.fallback) - (rightValue ?? dimension.fallback)) / dimension.scale;
  }
  return total;
}

function trajectoryDistance(
  left: MotionPlan,
  right: MotionPlan,
  source: ZeroLayerMorphSource,
  areaByLayer: Map<string, number>
): number {
  const stageWidth = Math.max(1, source.from.width, source.to.width);
  const stageHeight = Math.max(1, source.from.height, source.to.height);
  const stageArea = stageWidth * stageHeight;
  let total = 0;
  let sampled = 0;
  for (const progress of trajectorySampleProgress) {
    const leftByLayer = new Map(
      sampleMotionPlan(left, left.stageDurationMs * progress).map((track) => [track.layerId, track.state])
    );
    const rightByLayer = new Map(
      sampleMotionPlan(right, right.stageDurationMs * progress).map((track) => [track.layerId, track.state])
    );
    let weightedDistance = 0;
    let visibleWeight = 0;
    for (const layerId of new Set([...leftByLayer.keys(), ...rightByLayer.keys()])) {
      const area = areaByLayer.get(layerId) ?? 0;
      if (area <= 0) continue;
      const weight = Math.min(1, area / stageArea);
      weightedDistance +=
        stateDistance(
          leftByLayer.get(layerId) ?? {},
          rightByLayer.get(layerId) ?? {},
          stageWidth,
          stageHeight
        ) * weight;
      visibleWeight += weight;
    }
    if (visibleWeight <= 0) continue;
    total += weightedDistance / visibleWeight;
    sampled += 1;
  }
  return sampled > 0 ? total / sampled : 0;
}

function evaluateRecommendations(
  source: ZeroLayerMorphSource,
  spec: ZeroMotionSpec,
  candidates: ZeroLayerRecipeRecommendation[]
): EvaluatedRecommendation[] {
  return candidates.flatMap((recommendation) => {
    const manifest = zeroLayerRecipeManifests.find((item) => item.id === recommendation.recipeId);
    if (!manifest) return [];
    try {
      const result = applyZeroLayerMotionRecipe(source, recommendation.recipeId, {
        spec,
        adaptedParameters: recommendation.adaptedParameters
      });
      const visualSource = result.document.visualSource;
      if (visualSource?.kind !== "zero-layer-morph" || !visualSource.motionPlan?.tracks.length) return [];
      return [
        {
          recommendation,
          manifest,
          motionPlan: fillMotionPlanGeometryFromComposition(
            visualSource.motionPlan,
            result.document.composition,
            visualSource
          )
        }
      ];
    } catch {
      return [];
    }
  });
}

function selectDistinctRecommendations(
  source: ZeroLayerMorphSource,
  evaluated: EvaluatedRecommendation[],
  limit: number
): ZeroLayerRecipeRecommendation[] {
  const first = evaluated[0];
  if (!first) return [];
  const areaByLayer = visibleAreaByLayer(source);
  if (![...areaByLayer.values()].some((area) => area > 0)) return [];
  const selected = [first];
  const remaining = evaluated.slice(1);
  while (selected.length < limit && remaining.length > 0) {
    let best: { index: number; candidate: EvaluatedRecommendation; selectionScore: number } | undefined;
    for (const [index, candidate] of remaining.entries()) {
      const minimumDistance = Math.min(
        ...selected.map((item) =>
          trajectoryDistance(candidate.motionPlan, item.motionPlan, source, areaByLayer)
        )
      );
      if (minimumDistance < minimumTrajectoryDistance) continue;
      const repeatsFamily = selected.some(
        (item) =>
          item.manifest.category === candidate.manifest.category &&
          item.manifest.intent === candidate.manifest.intent
      );
      const selectionScore =
        candidate.recommendation.score + minimumDistance * 100 - (repeatsFamily ? sameFamilyPenalty : 0);
      if (!best || selectionScore > best.selectionScore) {
        best = { index, candidate, selectionScore };
      }
    }
    if (!best) break;
    selected.push(best.candidate);
    remaining.splice(best.index, 1);
  }
  return selected.map((item) => item.recommendation);
}

function resultWithCandidates(
  result: ZeroLayerRecipeRecommendationResult,
  candidates: ZeroLayerRecipeRecommendation[],
  summary = result.summary
): ZeroLayerRecipeRecommendationResult {
  const { selectedRecipeId: _selectedRecipeId, ...resultWithoutSelection } = result;
  return {
    ...resultWithoutSelection,
    candidates,
    ...(candidates[0] ? { selectedRecipeId: candidates[0].recipeId } : {}),
    summary
  };
}

/**
 * Recommends against the concrete Zero source. Risky sources are deliberately
 * narrowed to manifest-declared safe fallbacks instead of filling the panel
 * with strong recipes that cannot be trusted against degraded bindings.
 */
export function recommendZeroLayerRecipesForSource(
  source: ZeroLayerMorphSource,
  spec: ZeroMotionSpec,
  options: ZeroLayerSourceAwareRecommendationOptions = {}
): ZeroLayerRecipeRecommendationResult {
  const limit = Math.min(3, Math.max(1, options.limit ?? 3));
  const mode = recommendationMode(source, spec);
  const safeOnly = mode === "safe-fallback";
  const relevance = recommendZeroLayerRecipes(spec, {
    limit: safeOnly ? zeroLayerRecipeManifests.length : 8,
    ...(options.sceneOverride ? { sceneOverride: options.sceneOverride } : {})
  });
  if (mode === "blocked") {
    return resultWithCandidates(
      relevance,
      [],
      "当前 Zero 诊断门禁禁止原生图层动效，请先修复源数据或改用截图兜底。"
    );
  }
  const candidatePool = safeOnly
    ? relevance.candidates.filter((candidate) =>
        zeroLayerRecipeManifests.some(
          (manifest) => manifest.id === candidate.recipeId && manifest.capabilities.safeFallback
        )
      )
    : relevance.candidates;
  const candidates = selectDistinctRecommendations(
    source,
    evaluateRecommendations(source, spec, candidatePool),
    limit
  );
  const summary = safeOnly
    ? candidates[0]
      ? `当前匹配置信度不足，仅推荐安全兜底「${recipeLabel(candidates[0].recipeId)}」。`
      : "当前匹配置信度不足，暂无可安全应用的动效方案。"
    : candidates.length < limit
      ? `${relevance.summary} 已按实际轨迹去除近似方案。`
      : relevance.summary;
  return resultWithCandidates(relevance, candidates, summary);
}
