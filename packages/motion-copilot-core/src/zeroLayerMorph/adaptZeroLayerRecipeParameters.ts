import type { CompositionStep } from "../schema/document";
import { getZeroLayerRecipeManifest, type ZeroLayerRecipeManifest } from "./zeroLayerRecipeManifests";
import {
  zeroLayerExpressionStrategyById,
  type ZeroLayerExpressionStrategyId
} from "./zeroLayerExpressionStrategies";
import type { ZeroLayerMotionRecipeId } from "./zeroLayerMotionRecipes";
import type { ZeroMotionOrderPlan } from "./zeroMotionOrdering";
import type { ZeroMotionSpec } from "./zeroMotionSpec";

export type ZeroLayerRecipeAdaptedParameters = {
  durationMs: number;
  easing: "standard" | "decelerate" | "accelerate" | "sharp";
  staggerMs: number;
  maskAxis: "x" | "y" | "none";
  offsetPx: number;
  enterOffsetX: number;
  enterOffsetY: number;
  clipFromRatio: number;
  transformOrigin: "center center" | "top center" | "left center" | "bottom center";
  containerPhaseRatio: number;
  itemStaggerStrategy: "spatial" | "together" | "none";
  scaleFrom: number;
  scaleTo: number;
  opacityFrom: number;
  opacityTo: number;
  overshootRatio: number;
  emphasisLevel: "subtle" | "balanced" | "strong";
  primaryExpressionStrategyId: ZeroLayerExpressionStrategyId;
  enterExpressionStrategyId: ZeroLayerExpressionStrategyId;
  manifestIntensity: ZeroLayerRecipeManifest["restraint"]["intensity"];
  summary: string;
  reasons: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function mainAxis(spec: ZeroMotionSpec): "x" | "y" | "none" {
  const x =
    Math.abs(spec.deltas.stageWidthDelta) +
    Math.abs(spec.deltas.dominantWidthDelta) +
    spec.deltas.xMotionCount * 8;
  const y =
    Math.abs(spec.deltas.stageHeightDelta) +
    Math.abs(spec.deltas.dominantHeightDelta) +
    spec.deltas.yMotionCount * 8;
  if (Math.max(x, y) < 8) return "none";
  return x >= y ? "x" : "y";
}

function emphasis(spec: ZeroMotionSpec): ZeroLayerRecipeAdaptedParameters["emphasisLevel"] {
  const changedLayers = spec.topology.enterCount + spec.topology.exitCount + spec.topology.matchedCount;
  const area = Math.abs(spec.deltas.dominantAreaDeltaRatio);
  if (
    spec.deltas.averageMoveDistance < 8 &&
    area < 0.12 &&
    spec.topology.enterCount + spec.topology.exitCount === 0
  ) {
    return "subtle";
  }
  if (spec.deltas.averageMoveDistance < 8 && area < 0.12 && changedLayers <= 3) return "subtle";
  if (
    spec.topology.enterCount + spec.topology.exitCount >= 4 ||
    area > 0.8 ||
    spec.deltas.averageMoveDistance > 80
  ) {
    return "strong";
  }
  return "balanced";
}

function corridorOffsetLimit(spec: ZeroMotionSpec): number {
  const width = Math.max(Math.abs(spec.deltas.stageWidthDelta), Math.abs(spec.deltas.dominantWidthDelta));
  const height = Math.max(Math.abs(spec.deltas.stageHeightDelta), Math.abs(spec.deltas.dominantHeightDelta));
  const axisLimit = mainAxis(spec) === "y" ? height : width;
  return clamp(Math.max(8, axisLimit * 0.3), 8, 56);
}

function isDropdownLike(spec: ZeroMotionSpec): boolean {
  return (
    spec.deltas.stageHeightDelta >= 48 && spec.topology.enterCount >= 3 && spec.deltas.enterAreaRatio >= 0.28
  );
}

function durationFor(recipeId: ZeroLayerMotionRecipeId, spec: ZeroMotionSpec): number {
  let base = 380;
  if (recipeId === "status-switch") base = 260;
  if (recipeId === "content-stagger") base = 420;
  if (recipeId === "mask-reveal") base = 460;
  if (recipeId === "anchored-popover") base = 480;
  if (recipeId === "dropdown-reveal") base = 500;
  if (recipeId === "focus-guide") base = 430;
  if (recipeId === "axis-expand") base = 440;
  if (recipeId === "tab-indicator-slide") base = 360;
  if (recipeId === "card-expand-reveal") base = 520;
  if (recipeId === "list-insert-push") base = 560;
  if (recipeId === "bottom-sheet-rise") base = 540;
  if (recipeId === "content-replace") base = 420;
  if (recipeId === "spring-expand") base = 520;
  const enterExitBonus = Math.min(160, (spec.topology.enterCount + spec.topology.exitCount) * 18);
  const distanceBonus = Math.min(120, spec.deltas.averageMoveDistance * 0.8);
  return clamp(base + enterExitBonus + distanceBonus, 220, 760);
}

function primaryManifestStrategy(recipeId: ZeroLayerMotionRecipeId): ZeroLayerExpressionStrategyId {
  return getZeroLayerRecipeManifest(recipeId)?.expressionStrategies[0] ?? "linear-morph";
}

function manifestIntensity(
  recipeId: ZeroLayerMotionRecipeId
): ZeroLayerRecipeManifest["restraint"]["intensity"] {
  return getZeroLayerRecipeManifest(recipeId)?.restraint.intensity ?? "balanced";
}

function strategyOffset(
  recipeId: ZeroLayerMotionRecipeId,
  fallback: { x: number; y: number },
  offsetPx: number
): { x: number; y: number } {
  const runtime = zeroLayerExpressionStrategyById(primaryManifestStrategy(recipeId))?.runtime;
  if (!runtime || runtime.enterOffsetAxis === "none") return fallback;
  const direction = runtime.enterOffsetDirection ?? -1;
  const amount = Math.max(6, Math.min(offsetPx, 48));
  if (runtime.enterOffsetAxis === "x") return { x: direction * amount, y: 0 };
  if (runtime.enterOffsetAxis === "y") return { x: 0, y: direction * amount };
  return fallback;
}

function staggerFor(recipeId: ZeroLayerMotionRecipeId, spec: ZeroMotionSpec): number {
  if (recipeId === "status-switch") return spec.deltas.averageMoveDistance < 8 ? 24 : 36;
  if (recipeId === "dropdown-reveal") return mainAxis(spec) === "y" ? 58 : 46;
  if (recipeId === "tab-indicator-slide") return 28;
  if (recipeId === "card-expand-reveal") return 56;
  if (recipeId === "list-insert-push") return 48;
  if (recipeId === "bottom-sheet-rise") return 44;
  if (recipeId === "content-replace") return 42;
  if (recipeId === "anchored-popover") return 38;
  if (recipeId === "content-stagger" || recipeId === "list-reorder")
    return clamp(36 + spec.topology.enterCount * 4, 32, 72);
  if (recipeId === "mask-reveal") return mainAxis(spec) === "y" ? 54 : 42;
  if (recipeId === "container-first") return 64;
  return 44;
}

export function adaptZeroLayerRecipeParameters(
  spec: ZeroMotionSpec,
  recipeId: ZeroLayerMotionRecipeId
): ZeroLayerRecipeAdaptedParameters {
  const axis = mainAxis(spec);
  const level = emphasis(spec);
  const strategyId = primaryManifestStrategy(recipeId);
  const strategyRuntime = zeroLayerExpressionStrategyById(strategyId)?.runtime;
  const intensity = manifestIntensity(recipeId);
  const offsetPx =
    level === "subtle"
      ? 8
      : level === "strong"
        ? corridorOffsetLimit(spec)
        : clamp(corridorOffsetLimit(spec) * 0.72, 8, 40);
  const staggerMs = staggerFor(recipeId, spec);
  const durationMs = durationFor(recipeId, spec);
  const easing =
    recipeId === "spring-expand" ||
    recipeId === "mask-reveal" ||
    recipeId === "dropdown-reveal" ||
    recipeId === "anchored-popover" ||
    recipeId === "bottom-sheet-rise" ||
    recipeId === "card-expand-reveal"
      ? "sharp"
      : recipeId === "status-switch"
        ? "standard"
        : "decelerate";
  const reasons = [
    axis === "x" ? "首尾帧主要沿横向变化" : axis === "y" ? "首尾帧主要沿纵向变化" : "首尾帧几何变化较小",
    `enter ${spec.topology.enterCount} / exit ${spec.topology.exitCount}`,
    `显著性目标 ${level}`
  ];
  const dropdownLike = isDropdownLike(spec);
  const isDropdownRecipe = recipeId === "dropdown-reveal";
  const isPopoverRecipe = recipeId === "anchored-popover";
  const isRevealRecipe =
    recipeId === "mask-reveal" ||
    recipeId === "axis-expand" ||
    recipeId === "card-expand-reveal" ||
    recipeId === "bottom-sheet-rise";
  const verticalReveal = axis === "y" || (dropdownLike && isDropdownRecipe);
  const dropdownOffsetY = -Math.min(offsetPx, Math.max(8, Math.abs(spec.deltas.stageHeightDelta) * 0.18));
  const enterOffsetY = isDropdownRecipe ? dropdownOffsetY : isPopoverRecipe ? -Math.min(offsetPx, 14) : 0;
  const enterOffsetX =
    axis === "x" && !dropdownLike && recipeId !== "status-switch" && !isPopoverRecipe
      ? -Math.min(offsetPx, Math.max(8, Math.abs(spec.deltas.stageWidthDelta) * 0.18))
      : 0;
  const strategyEnterOffset = strategyOffset(recipeId, { x: enterOffsetX, y: enterOffsetY }, offsetPx);
  const clipFromRatio =
    isRevealRecipe || isDropdownRecipe ? (verticalReveal ? (isDropdownRecipe ? 0.08 : 0.24) : 0.32) : 1;
  const containerPhaseRatio =
    recipeId === "container-first"
      ? 0.58
      : recipeId === "card-expand-reveal"
        ? 0.5
        : recipeId === "bottom-sheet-rise"
          ? 0.44
          : recipeId === "dropdown-reveal"
            ? 0.46
            : recipeId === "mask-reveal" || recipeId === "axis-expand"
              ? 0.42
              : 0;
  const itemStaggerStrategy =
    recipeId === "content-stagger" || recipeId === "list-reorder" || isDropdownRecipe
      ? "spatial"
      : recipeId === "list-insert-push" || recipeId === "content-replace"
        ? "spatial"
        : recipeId === "smooth-morph"
          ? "none"
          : "together";

  return {
    durationMs,
    easing,
    staggerMs: Math.round(staggerMs * (strategyRuntime?.staggerMultiplier ?? 1)),
    maskAxis: isRevealRecipe || isDropdownRecipe ? (verticalReveal ? "y" : axis) : "none",
    offsetPx,
    enterOffsetX: strategyEnterOffset.x,
    enterOffsetY: strategyEnterOffset.y,
    clipFromRatio: strategyRuntime?.clipFromRatio ?? clipFromRatio,
    transformOrigin:
      strategyRuntime?.transformOrigin ??
      (isDropdownRecipe || (isRevealRecipe && verticalReveal) || isPopoverRecipe
        ? "top center"
        : axis === "x"
          ? "left center"
          : "center center"),
    containerPhaseRatio,
    itemStaggerStrategy,
    scaleFrom:
      strategyRuntime?.enterScale ??
      (intensity === "subtle" || level === "subtle" ? 0.99 : intensity === "strong" ? 0.94 : 0.96),
    scaleTo: 1,
    opacityFrom: level === "subtle" ? 0.72 : 0,
    opacityTo: 1,
    overshootRatio: 0,
    emphasisLevel: level,
    primaryExpressionStrategyId: strategyId,
    enterExpressionStrategyId: strategyId,
    manifestIntensity: intensity,
    summary: `${axis === "x" ? "X 轴" : axis === "y" ? "Y 轴" : "弱几何"} / ${durationMs}ms / 错峰 ${staggerMs}ms / ${level}${
      isDropdownRecipe && dropdownLike ? " / 下拉展开" : ""
    }`,
    reasons
  };
}

function spatialOrder(step: CompositionStep): number {
  const text = step.layerId ?? step.id;
  let hash = 0;
  for (const char of text) hash = (hash + char.charCodeAt(0)) % 97;
  return hash;
}

function isEnter(step: CompositionStep): boolean {
  return step.id.startsWith("zero-layer-enter");
}

function isExit(step: CompositionStep): boolean {
  return step.id.startsWith("zero-layer-exit");
}

function withTransformOrigin(
  step: CompositionStep,
  transformOrigin: ZeroLayerRecipeAdaptedParameters["transformOrigin"],
  expressionStrategyId?: ZeroLayerExpressionStrategyId
): CompositionStep {
  return {
    ...step,
    metadata: {
      ...step.metadata,
      zeroLayerTransformOrigin: step.metadata?.zeroLayerTransformOrigin ?? transformOrigin,
      ...(expressionStrategyId ? { zeroLayerExpressionStrategy: expressionStrategyId } : {})
    }
  };
}

function withExpressionStrategy(
  step: CompositionStep,
  expressionStrategyId: ZeroLayerExpressionStrategyId
): CompositionStep {
  return {
    ...step,
    metadata: {
      ...step.metadata,
      zeroLayerExpressionStrategy: step.metadata?.zeroLayerExpressionStrategy ?? expressionStrategyId
    }
  };
}

export function applyZeroLayerRecipeAdaptedParameters(
  steps: CompositionStep[],
  params: ZeroLayerRecipeAdaptedParameters,
  options: { orderPlan?: ZeroMotionOrderPlan } = {}
): CompositionStep[] {
  return steps.map((step, index) => {
    const orderItem = step.layerId
      ? options.orderPlan?.items.find((item) => item.layerId === step.layerId)
      : undefined;
    const order = orderItem ? orderItem.order : Math.min(index, spatialOrder(step));
    const spatialDelay = params.itemStaggerStrategy === "spatial" ? order * params.staggerMs : index * 8;
    const delayMs = step.id.startsWith("zero-layer-match")
      ? Math.min(orderItem?.delayMs ?? step.delayMs ?? 0, params.staggerMs)
      : Math.min(orderItem?.delayMs ?? spatialDelay, 280);
    const durationMs =
      isEnter(step) || isExit(step) ? Math.max(140, Math.round(params.durationMs * 0.46)) : params.durationMs;
    if (isEnter(step)) {
      const hasRecipeGeometry =
        (step.initial?.width != null &&
          step.animate?.width != null &&
          Math.abs(step.initial.width - step.animate.width) > 0.5) ||
        (step.initial?.height != null &&
          step.animate?.height != null &&
          Math.abs(step.initial.height - step.animate.height) > 0.5);
      const axisPatch = hasRecipeGeometry
        ? {}
        : params.maskAxis === "x"
          ? { width: Math.max(1, (step.animate?.width ?? step.initial?.width ?? 1) * params.clipFromRatio) }
          : params.maskAxis === "y"
            ? {
                height: Math.max(
                  1,
                  (step.animate?.height ?? step.initial?.height ?? 1) * params.clipFromRatio
                )
              }
            : {};
      return withTransformOrigin(
        {
          ...step,
          delayMs,
          durationMs,
          initial: {
            ...step.initial,
            ...axisPatch,
            x: (step.initial?.x ?? 0) + params.enterOffsetX,
            y: (step.initial?.y ?? 0) + params.enterOffsetY,
            scale: params.scaleFrom,
            opacity: params.opacityFrom
          },
          animate: {
            ...step.animate,
            x: step.animate?.x ?? 0,
            y: step.animate?.y ?? 0,
            scale: params.scaleTo,
            opacity: params.opacityTo
          }
        },
        params.transformOrigin,
        params.enterExpressionStrategyId
      );
    }
    if (isExit(step)) {
      return withTransformOrigin(
        {
          ...step,
          delayMs: Math.max(0, Math.round(delayMs * 0.45)),
          durationMs,
          initial: { ...step.initial, scale: 1, opacity: 1 },
          animate: { ...step.animate, scale: params.scaleFrom, opacity: 0 }
        },
        params.transformOrigin,
        params.enterExpressionStrategyId
      );
    }
    return withExpressionStrategy(
      {
        ...step,
        delayMs: Math.round(
          delayMs *
            (zeroLayerExpressionStrategyById(params.primaryExpressionStrategyId)?.runtime
              ?.matchedDelayMultiplier ?? 1)
        ),
        durationMs
      },
      params.primaryExpressionStrategyId
    );
  });
}
