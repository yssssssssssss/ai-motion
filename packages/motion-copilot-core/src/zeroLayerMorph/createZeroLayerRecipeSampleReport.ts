import type { Bounds } from "../frameMorph/schema";
import type { CompositionStep, MotionState } from "../schema/document";
import {
  adaptZeroLayerRecipeParameters,
  type ZeroLayerRecipeAdaptedParameters
} from "./adaptZeroLayerRecipeParameters";
import { evaluateZeroMotionSalience } from "./zeroMotionSalience";
import { buildZeroMotionSpec, type ZeroMotionSpec } from "./zeroMotionSpec";
import type { ZeroLayerMotionBinding, ZeroLayerMotionBindingResult, ZeroLayerMorphSource } from "./schema";
import {
  applyZeroLayerMotionRecipe,
  zeroLayerMotionRecipes,
  type ZeroLayerMotionRecipeId
} from "./zeroLayerMotionRecipes";
import { createZeroMotionOrderPlan, orderItemForStep } from "./zeroMotionOrdering";
import { zeroLayerExpressionStrategyForStep } from "./zeroLayerExpressionStrategies";

export type ZeroLayerRecipeSampleRiskCode =
  | "MATCHED_CORRIDOR_OVERFLOW"
  | "TAIL_FRAME_MISMATCH"
  | "RECIPE_DIFF_TOO_SMALL"
  | "RECIPE_TOO_FADE_ONLY"
  | "CONTENT_BEFORE_CONTAINER"
  | "ENTER_BEFORE_EXIT"
  | "MASK_AFTER_CONTENT"
  | "DECORATIVE_TOO_EARLY"
  | "ROLE_ORDER_UNKNOWN";

export type ZeroLayerRecipeSampleRisk = {
  code: ZeroLayerRecipeSampleRiskCode;
  severity: "warning" | "error";
  recipeId?: ZeroLayerMotionRecipeId;
  stepId?: string;
  nodeId?: string;
  message: string;
};

export type ZeroLayerRecipeStepSample = {
  stepId: string;
  layerId: string;
  type: "matched" | "enter" | "exit" | "unknown";
  nodeId?: string;
  toNodeId?: string;
  bounds: Bounds;
  opacity: number;
};

export type ZeroLayerRecipeProgressSample = {
  progress: number;
  timeMs: number;
  steps: ZeroLayerRecipeStepSample[];
};

export type ZeroLayerRecipeSampleResult = {
  recipeId: ZeroLayerMotionRecipeId;
  label: string;
  durationMs: number;
  adaptedParameters?: ZeroLayerRecipeAdaptedParameters;
  salienceScore?: number;
  signature: ZeroLayerRecipeMotionSignature;
  samples: ZeroLayerRecipeProgressSample[];
  risks: ZeroLayerRecipeSampleRisk[];
};

export type ZeroLayerRecipeMotionSignature = {
  recipeId: ZeroLayerMotionRecipeId;
  geometryStepCount: number;
  fadeOnlyStepCount: number;
  enterTransformCount: number;
  clipRevealCount: number;
  staggerSpreadMs: number;
  dominantAxis: "x" | "y" | "mixed" | "none";
  phaseCount: number;
  expressionStrategies: string[];
  signatureKey: string;
};

export type ZeroLayerRecipeSampleReport = {
  schemaVersion: "motion-copilot.zero-layer-recipe-samples.v1";
  samplePoints: number[];
  recipes: ZeroLayerRecipeSampleResult[];
  risks: ZeroLayerRecipeSampleRisk[];
  comparison: {
    recipeCount: number;
    distinctSignatures: number;
  };
};

const defaultSamplePoints = [0, 0.25, 0.5, 0.75, 1];
const epsilon = 0.001;

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function numberState(state: MotionState | undefined, key: keyof MotionState, fallback: number): number {
  const value = state?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boundsAt(base: Bounds, step: CompositionStep, progress: number): Bounds {
  const motionProgress = motionProgressAt(step, progress);
  const fromX = numberState(step.initial, "x", 0);
  const fromY = numberState(step.initial, "y", 0);
  const fromWidth = numberState(step.initial, "width", base.w);
  const fromHeight = numberState(step.initial, "height", base.h);
  const toX = numberState(step.animate, "x", fromX);
  const toY = numberState(step.animate, "y", fromY);
  const toWidth = numberState(step.animate, "width", fromWidth);
  const toHeight = numberState(step.animate, "height", fromHeight);

  return {
    x: base.x + lerp(fromX, toX, motionProgress),
    y: base.y + lerp(fromY, toY, motionProgress),
    w: lerp(fromWidth, toWidth, motionProgress),
    h: lerp(fromHeight, toHeight, motionProgress)
  };
}

function opacityAt(step: CompositionStep, progress: number): number {
  if (step.id.startsWith("zero-layer-match")) {
    return expressionOpacityAt(step, progress);
  }
  const from = numberState(step.initial, "opacity", 1);
  const to = numberState(step.animate, "opacity", from);
  return lerp(from, to, progress);
}

function motionProgressAt(step: CompositionStep, progress: number): number {
  if (!step.id.startsWith("zero-layer-match")) return progress;
  const strategy = zeroLayerExpressionStrategyForStep(step);
  const percent = clamp(progress) * 100;
  const stops = [...strategy.stops].sort((a, b) => a.percent - b.percent);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return progress;
  if (percent <= first.percent) return first.progress;
  if (percent >= last.percent) return last.progress;
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const next = stops[index]!;
    if (percent > next.percent) continue;
    const span = Math.max(1, next.percent - previous.percent);
    return lerp(previous.progress, next.progress, (percent - previous.percent) / span);
  }
  return last.progress;
}

function expressionOpacityAt(step: CompositionStep, progress: number): number {
  const strategy = zeroLayerExpressionStrategyForStep(step);
  const percent = clamp(progress) * 100;
  const stops = [...strategy.stops].sort((a, b) => a.percent - b.percent);
  const opacityForStop = (stop: (typeof stops)[number]) =>
    stop.opacity ?? lerp(numberState(step.initial, "opacity", 1), numberState(step.animate, "opacity", 1), stop.progress);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return opacityAt({ ...step, id: "" }, progress);
  if (percent <= first.percent) return opacityForStop(first);
  if (percent >= last.percent) return opacityForStop(last);
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const next = stops[index]!;
    if (percent > next.percent) continue;
    const span = Math.max(1, next.percent - previous.percent);
    return lerp(opacityForStop(previous), opacityForStop(next), (percent - previous.percent) / span);
  }
  return opacityForStop(last);
}

function layerType(step: CompositionStep): ZeroLayerRecipeStepSample["type"] {
  if (step.id.startsWith("zero-layer-match")) return "matched";
  if (step.id.startsWith("zero-layer-enter")) return "enter";
  if (step.id.startsWith("zero-layer-exit")) return "exit";
  return "unknown";
}

function bindingByLayerId(bindingResult: ZeroLayerMotionBindingResult): Map<string, ZeroLayerMotionBinding> {
  return new Map(bindingResult.bindings.map((binding) => [binding.layerId, binding]));
}

function baseBoundsForStep(
  source: ZeroLayerMorphSource,
  bindingResult: ZeroLayerMotionBindingResult,
  step: CompositionStep
): { bounds: Bounds; nodeId?: string; toNodeId?: string } | undefined {
  if (!step.layerId) return undefined;
  const binding = bindingByLayerId(bindingResult).get(step.layerId);
  if (binding) return { bounds: binding.fromBounds, nodeId: binding.nodeId, toNodeId: binding.toNodeId };

  const enterNode = bindingResult.enter.find(
    (node) => `zero-layer-${safeNodeId(node.nodeId)}` === step.layerId
  );
  if (enterNode) return { bounds: enterNode.bounds, nodeId: enterNode.nodeId };

  const exitNode = bindingResult.exit.find(
    (node) => `zero-layer-${safeNodeId(node.nodeId)}` === step.layerId
  );
  if (exitNode) return { bounds: exitNode.bounds, nodeId: exitNode.nodeId };

  const sourceNode =
    source.from.layers.find((node) => `zero-layer-${safeNodeId(node.nodeId)}` === step.layerId) ??
    source.to.layers.find((node) => `zero-layer-${safeNodeId(node.nodeId)}` === step.layerId);
  return sourceNode ? { bounds: sourceNode.bounds, nodeId: sourceNode.nodeId } : undefined;
}

function safeNodeId(nodeId: string): string {
  return nodeId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function localProgress(step: CompositionStep, timeMs: number): number {
  return clamp((timeMs - (step.delayMs ?? 0)) / Math.max(1, step.durationMs));
}

function within(value: number, min: number, max: number): boolean {
  return value >= min - epsilon && value <= max + epsilon;
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= epsilon;
}

function corridorRisk(
  recipeId: ZeroLayerMotionRecipeId,
  step: ZeroLayerRecipeStepSample,
  binding: ZeroLayerMotionBinding
): ZeroLayerRecipeSampleRisk | undefined {
  const minX = Math.min(binding.fromBounds.x, binding.toBounds.x);
  const maxX = Math.max(binding.fromBounds.x, binding.toBounds.x);
  const minY = Math.min(binding.fromBounds.y, binding.toBounds.y);
  const maxY = Math.max(binding.fromBounds.y, binding.toBounds.y);
  const minWidth = Math.min(binding.fromBounds.w, binding.toBounds.w);
  const maxWidth = Math.max(binding.fromBounds.w, binding.toBounds.w);
  const minHeight = Math.min(binding.fromBounds.h, binding.toBounds.h);
  const maxHeight = Math.max(binding.fromBounds.h, binding.toBounds.h);
  if (
    within(step.bounds.x, minX, maxX) &&
    within(step.bounds.y, minY, maxY) &&
    within(step.bounds.w, minWidth, maxWidth) &&
    within(step.bounds.h, minHeight, maxHeight)
  ) {
    return undefined;
  }
  return {
    code: "MATCHED_CORRIDOR_OVERFLOW",
    severity: "error",
    recipeId,
    stepId: step.stepId,
    nodeId: binding.nodeId,
    message: `${recipeId} moves ${binding.nodeId} outside the first-to-tail corridor.`
  };
}

function tailRisk(
  recipeId: ZeroLayerMotionRecipeId,
  step: ZeroLayerRecipeStepSample,
  binding: ZeroLayerMotionBinding
): ZeroLayerRecipeSampleRisk | undefined {
  if (
    sameNumber(step.bounds.x, binding.toBounds.x) &&
    sameNumber(step.bounds.y, binding.toBounds.y) &&
    sameNumber(step.bounds.w, binding.toBounds.w) &&
    sameNumber(step.bounds.h, binding.toBounds.h)
  ) {
    return undefined;
  }
  return {
    code: "TAIL_FRAME_MISMATCH",
    severity: "error",
    recipeId,
    stepId: step.stepId,
    nodeId: binding.nodeId,
    message: `${recipeId} does not resolve ${binding.nodeId} to the exact Zero tail frame.`
  };
}

function sampleRecipe(
  source: ZeroLayerMorphSource,
  recipeId: ZeroLayerMotionRecipeId,
  samplePoints: number[],
  spec: ZeroMotionSpec
): ZeroLayerRecipeSampleResult {
  const adaptedParameters = adaptZeroLayerRecipeParameters(spec, recipeId);
  const result = applyZeroLayerMotionRecipe(source, recipeId, { spec, adaptedParameters });
  const label = zeroLayerMotionRecipes.find((recipe) => recipe.id === recipeId)?.label ?? recipeId;
  const durationMs = result.document.composition?.totalDurationMs ?? result.document.timeline.durationMs;
  const salience = evaluateZeroMotionSalience({ spec, steps: result.steps, adaptedParameters });
  const orderPlan = createZeroMotionOrderPlan(source, result.steps, spec);
  const bindingsByLayerId = bindingByLayerId(result.bindingResult);
  const risks: ZeroLayerRecipeSampleRisk[] = [];
  const samples = samplePoints.map((progress) => {
    const timeMs = durationMs * progress;
    const steps = result.steps
      .map((step) => {
        if (!step.layerId) return undefined;
        const base = baseBoundsForStep(source, result.bindingResult, step);
        if (!base) return undefined;
        const sampled: ZeroLayerRecipeStepSample = {
          stepId: step.id,
          layerId: step.layerId,
          type: layerType(step),
          ...(base.nodeId ? { nodeId: base.nodeId } : {}),
          ...(base.toNodeId ? { toNodeId: base.toNodeId } : {}),
          bounds: boundsAt(base.bounds, step, localProgress(step, timeMs)),
          opacity: opacityAt(step, localProgress(step, timeMs))
        };
        const binding = bindingsByLayerId.get(step.layerId);
        if (binding) {
          const corridor = corridorRisk(recipeId, sampled, binding);
          if (corridor) risks.push(corridor);
          if (progress === 1) {
            const tail = tailRisk(recipeId, sampled, binding);
            if (tail) risks.push(tail);
          }
        }
        return sampled;
      })
      .filter((step): step is ZeroLayerRecipeStepSample => Boolean(step));
    return { progress, timeMs, steps };
  });

  risks.push(...orderRisks(recipeId, result.steps, orderPlan));
  const signature = recipeMotionSignature(recipeId, result.steps);
  return {
    recipeId,
    label,
    durationMs,
    adaptedParameters,
    salienceScore: salience.score,
    signature,
    samples,
    risks
  };
}

function stepStart(step: CompositionStep): number {
  return step.delayMs ?? 0;
}

function minStepStart(steps: CompositionStep[], predicate: (step: CompositionStep) => boolean): number | undefined {
  const starts = steps.filter(predicate).map(stepStart);
  return starts.length > 0 ? Math.min(...starts) : undefined;
}

function maxStepStart(steps: CompositionStep[], predicate: (step: CompositionStep) => boolean): number | undefined {
  const starts = steps.filter(predicate).map(stepStart);
  return starts.length > 0 ? Math.max(...starts) : undefined;
}

function orderRisks(
  recipeId: ZeroLayerMotionRecipeId,
  steps: CompositionStep[],
  orderPlan: ReturnType<typeof createZeroMotionOrderPlan>
): ZeroLayerRecipeSampleRisk[] {
  const risks: ZeroLayerRecipeSampleRisk[] = [];
  const isContainer = (step: CompositionStep) => {
    const item = orderItemForStep(orderPlan, step);
    return item?.group === "foundation" || item?.group === "structure";
  };
  const isContent = (step: CompositionStep) => {
    const item = orderItemForStep(orderPlan, step);
    return item?.group === "enter-content" || item?.group === "emphasis";
  };
  const containerStart = minStepStart(steps, isContainer);
  const contentStart = minStepStart(steps, isContent);
  if (containerStart != null && contentStart != null && contentStart < containerStart) {
    risks.push({
      code: "CONTENT_BEFORE_CONTAINER",
      severity: "warning",
      recipeId,
      message: `${recipeId} starts content before foundation or structure layers.`
    });
  }

  const lastExit = maxStepStart(steps, (step) => step.id.startsWith("zero-layer-exit"));
  const firstEnter = minStepStart(steps, (step) => step.id.startsWith("zero-layer-enter"));
  if (lastExit != null && firstEnter != null && firstEnter < lastExit) {
    risks.push({
      code: "ENTER_BEFORE_EXIT",
      severity: "warning",
      recipeId,
      message: `${recipeId} starts entering layers before exiting layers have begun leaving.`
    });
  }

  const firstMask = minStepStart(
    steps,
    (step) => orderItemForStep(orderPlan, step)?.role === "mask"
  );
  if (firstMask != null && contentStart != null && firstMask > contentStart) {
    risks.push({
      code: "MASK_AFTER_CONTENT",
      severity: "warning",
      recipeId,
      message: `${recipeId} starts mask layers after content layers.`
    });
  }

  const firstDecorative = minStepStart(
    steps,
    (step) => orderItemForStep(orderPlan, step)?.group === "decorative"
  );
  if (firstDecorative != null && contentStart != null && firstDecorative < contentStart) {
    risks.push({
      code: "DECORATIVE_TOO_EARLY",
      severity: "warning",
      recipeId,
      message: `${recipeId} starts decorative layers before content layers.`
    });
  }

  const unknown = orderPlan.items.filter((item) => item.role === "unknown" && item.confidence < 40);
  if (unknown.length > 0) {
    risks.push({
      code: "ROLE_ORDER_UNKNOWN",
      severity: "warning",
      recipeId,
      message: `${recipeId} has ${unknown.length} low-confidence role assignments in the order plan.`
    });
  }
  return risks;
}

function recipeSnapshotSignature(recipe: ZeroLayerRecipeSampleResult): string {
  const mid = recipe.samples.find((sample) => sample.progress === 0.5) ?? recipe.samples[0];
  return [
    recipe.durationMs,
    recipe.adaptedParameters?.summary ?? "",
    ...(mid?.steps ?? []).map((step) =>
      [
        step.type,
        step.layerId,
        Math.round(step.bounds.x),
        Math.round(step.bounds.y),
        Math.round(step.bounds.w),
        Math.round(step.bounds.h),
        Math.round(step.opacity * 100)
      ].join(":")
    )
  ].join("|");
}

function motionAxis(dxCount: number, dyCount: number): ZeroLayerRecipeMotionSignature["dominantAxis"] {
  if (dxCount === 0 && dyCount === 0) return "none";
  if (dxCount > 0 && dyCount > 0) return "mixed";
  return dxCount > 0 ? "x" : "y";
}

function recipeMotionSignature(
  recipeId: ZeroLayerMotionRecipeId,
  steps: CompositionStep[]
): ZeroLayerRecipeMotionSignature {
  let geometryStepCount = 0;
  let fadeOnlyStepCount = 0;
  let enterTransformCount = 0;
  let clipRevealCount = 0;
  let dxCount = 0;
  let dyCount = 0;
  const delays = steps.map((step) => step.delayMs ?? 0);
  const expressionStrategies = [...new Set(steps.map((step) => zeroLayerExpressionStrategyForStep(step).id))];
  const durationBucket =
    steps.length > 0
      ? Math.round(
          (steps.reduce((sum, step) => sum + step.durationMs, 0) / Math.max(1, steps.length)) / 40
        ) * 40
      : 0;
  const phaseSet = new Set(delays);

  for (const step of steps) {
    const ix = numberState(step.initial, "x", 0);
    const iy = numberState(step.initial, "y", 0);
    const ax = numberState(step.animate, "x", ix);
    const ay = numberState(step.animate, "y", iy);
    const iw = numberState(step.initial, "width", 0);
    const ih = numberState(step.initial, "height", 0);
    const aw = numberState(step.animate, "width", iw);
    const ah = numberState(step.animate, "height", ih);
    const is = numberState(step.initial, "scale", 1);
    const as = numberState(step.animate, "scale", is);
    const io = numberState(step.initial, "opacity", 1);
    const ao = numberState(step.animate, "opacity", io);
    const hasGeometry =
      !sameNumber(ix, ax) ||
      !sameNumber(iy, ay) ||
      !sameNumber(iw, aw) ||
      !sameNumber(ih, ah) ||
      !sameNumber(is, as);
    const hasOpacity = !sameNumber(io, ao);
    if (hasGeometry) geometryStepCount += 1;
    if (!hasGeometry && hasOpacity) fadeOnlyStepCount += 1;
    if (
      step.id.startsWith("zero-layer-enter") &&
      (!sameNumber(ix, ax) || !sameNumber(iy, ay) || !sameNumber(is, as))
    ) {
      enterTransformCount += 1;
    }
    if (
      step.id.startsWith("zero-layer-enter") &&
      ((iw > 0 && aw / iw > 1.45) || (ih > 0 && ah / ih > 1.45))
    ) {
      clipRevealCount += 1;
    }
    if (!sameNumber(ix, ax)) dxCount += 1;
    if (!sameNumber(iy, ay) || !sameNumber(ih, ah)) dyCount += 1;
  }

  const staggerSpreadMs = delays.length > 0 ? Math.max(...delays) - Math.min(...delays) : 0;
  const dominantAxis = motionAxis(dxCount, dyCount);
  const phaseCount = phaseSet.size;
  const signatureKey = [
    dominantAxis,
    `g${geometryStepCount}`,
    `f${fadeOnlyStepCount}`,
    `et${enterTransformCount}`,
    `cr${clipRevealCount}`,
    `ss${Math.round(staggerSpreadMs / 20) * 20}`,
    `p${phaseCount}`,
    `d${durationBucket}`,
    `x${expressionStrategies.join("+")}`
  ].join("-");

  return {
    recipeId,
    geometryStepCount,
    fadeOnlyStepCount,
    enterTransformCount,
    clipRevealCount,
    staggerSpreadMs,
    dominantAxis,
    phaseCount,
    expressionStrategies,
    signatureKey
  };
}

export function createZeroLayerRecipeSampleReport(
  source: ZeroLayerMorphSource,
  options: { recipeIds?: ZeroLayerMotionRecipeId[]; samplePoints?: number[] } = {}
): ZeroLayerRecipeSampleReport {
  const samplePoints = options.samplePoints ?? defaultSamplePoints;
  const recipeIds = options.recipeIds ?? zeroLayerMotionRecipes.map((recipe) => recipe.id);
  const spec = buildZeroMotionSpec(source);
  const recipes = recipeIds.map((recipeId) => sampleRecipe(source, recipeId, samplePoints, spec));
  const signatures = new Set(recipes.map((recipe) => recipe.signature.signatureKey));
  const snapshotSignatures = new Set(recipes.map(recipeSnapshotSignature));
  const risks = recipes.flatMap((recipe) => recipe.risks);
  if (signatures.size < recipes.length || snapshotSignatures.size < recipes.length) {
    risks.push({
      code: "RECIPE_DIFF_TOO_SMALL",
      severity: "warning",
      message: `${recipes.length - Math.min(signatures.size, snapshotSignatures.size) + 1} Zero native recipes produce highly similar motion signatures or middle-frame samples.`
    });
  }
  const topRecipes = recipes.slice(0, Math.min(3, recipes.length));
  const transformedEnterCount = topRecipes.filter(
    (recipe) => recipe.signature.enterTransformCount > 0
  ).length;
  if (topRecipes.length >= 3 && transformedEnterCount < 2) {
    risks.push({
      code: "RECIPE_TOO_FADE_ONLY",
      severity: "warning",
      message: "Top Zero native recipes rely too heavily on fade-only enter motion."
    });
  }

  return {
    schemaVersion: "motion-copilot.zero-layer-recipe-samples.v1",
    samplePoints,
    recipes,
    risks,
    comparison: {
      recipeCount: recipes.length,
      distinctSignatures: signatures.size
    }
  };
}
