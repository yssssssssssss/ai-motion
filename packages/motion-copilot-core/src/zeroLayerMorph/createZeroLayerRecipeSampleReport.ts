import type { Bounds } from "../frameMorph/schema";
import type { CompositionStep } from "../schema/document";
import { fillMotionPlanGeometryFromComposition, motionPlanPlaybackDurationMs } from "./compileMotionPlan";
import { layerIdForNode } from "./layerId";
import { sampleMotionPlan, type SampledMotionPlanTrack } from "./motionPlanRuntime";
import {
  adaptZeroLayerRecipeParameters,
  type ZeroLayerRecipeAdaptedParameters
} from "./adaptZeroLayerRecipeParameters";
import { evaluateZeroMotionSalience } from "./zeroMotionSalience";
import { buildZeroMotionSpec, type ZeroMotionSpec } from "./zeroMotionSpec";
import type {
  MotionPlan,
  MotionKeyframe,
  ZeroLayerMotionBinding,
  ZeroLayerMotionBindingResult,
  ZeroLayerMorphSource
} from "./schema";
import {
  applyZeroLayerMotionRecipe,
  zeroLayerMotionRecipes,
  type ZeroLayerMotionRecipeId
} from "./zeroLayerMotionRecipes";
import {
  getZeroLayerRecipeManifest,
  validateZeroLayerRecipeManifestRegistry,
  type ZeroLayerRecipeManifestValidation
} from "./zeroLayerRecipeManifests";
import { createZeroMotionOrderPlan, orderItemForStep } from "./zeroMotionOrdering";
import { zeroLayerExpressionStrategyForStep } from "./zeroLayerExpressionStrategies";
import {
  resolveZeroLayerNodeOverride,
  sampleZeroLayerSkinMix,
  zeroLayerAppearanceDiffers
} from "./zeroLayerAppearance";

export type ZeroLayerRecipeSampleRiskCode =
  | "MATCHED_CORRIDOR_OVERFLOW"
  | "TAIL_FRAME_MISMATCH"
  | "RECIPE_MANIFEST_INVALID"
  | "RECIPE_MANIFEST_EXPRESSION_MISSING"
  | "RECIPE_MANIFEST_SAFETY_MISSING"
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

function numberFrame(
  state: MotionKeyframe | undefined,
  key: Exclude<keyof MotionKeyframe, "offset" | "easing">,
  fallback: number
): number {
  const value = state?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boundsFromMotionPlan(base: Bounds, state: SampledMotionPlanTrack["state"]): Bounds {
  return {
    x: base.x + (state.x ?? 0),
    y: base.y + (state.y ?? 0),
    w: state.width ?? base.w,
    h: state.height ?? base.h
  };
}

function bindingByLayerId(
  source: ZeroLayerMorphSource,
  bindingResult: ZeroLayerMotionBindingResult
): Map<string, ZeroLayerMotionBinding> {
  const result = new Map<string, ZeroLayerMotionBinding>();
  for (const binding of bindingResult.bindings) {
    const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    result.set(binding.layerId, {
      ...binding,
      fromBounds: fromNode
        ? resolveZeroLayerNodeOverride(fromNode, source.nodeOverrides, "from").bounds
        : binding.fromBounds,
      toBounds: toNode
        ? resolveZeroLayerNodeOverride(toNode, source.nodeOverrides, "to").bounds
        : binding.toBounds
    });
  }
  return result;
}

function baseBoundsForLayer(
  source: ZeroLayerMorphSource,
  bindingResult: ZeroLayerMotionBindingResult,
  layerId: string
): { bounds: Bounds; nodeId?: string; toNodeId?: string } | undefined {
  const binding = bindingByLayerId(source, bindingResult).get(layerId);
  if (binding) return { bounds: binding.fromBounds, nodeId: binding.nodeId, toNodeId: binding.toNodeId };

  const enterNode = bindingResult.enter.find((node) => layerIdForNode(node) === layerId);
  if (enterNode) {
    return {
      bounds: resolveZeroLayerNodeOverride(enterNode, source.nodeOverrides, "to").bounds,
      nodeId: enterNode.nodeId
    };
  }

  const exitNode = bindingResult.exit.find((node) => layerIdForNode(node) === layerId);
  if (exitNode) {
    return {
      bounds: resolveZeroLayerNodeOverride(exitNode, source.nodeOverrides, "from").bounds,
      nodeId: exitNode.nodeId
    };
  }

  const sourceNode =
    source.from.layers.find((node) => layerIdForNode(node) === layerId) ??
    source.to.layers.find((node) => layerIdForNode(node) === layerId);
  if (!sourceNode) return undefined;
  const frame = source.from.layers.includes(sourceNode) ? "from" : "to";
  return {
    bounds: resolveZeroLayerNodeOverride(sourceNode, source.nodeOverrides, frame).bounds,
    nodeId: sourceNode.nodeId
  };
}

function nodeOpacity(source: ZeroLayerMorphSource, frame: "from" | "to", nodeId: string | undefined): number {
  if (!nodeId) return 1;
  const snapshot = frame === "from" ? source.from : source.to;
  const node = snapshot.layers.find((item) => item.nodeId === nodeId);
  return node ? resolveZeroLayerNodeOverride(node, source.nodeOverrides, frame).opacity : 1;
}

function opacityBaseForSample(
  source: ZeroLayerMorphSource,
  bindingResult: ZeroLayerMotionBindingResult,
  sample: SampledMotionPlanTrack
): number {
  const binding = bindingByLayerId(source, bindingResult).get(sample.layerId);
  if (binding) {
    const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    const fromOpacity = nodeOpacity(source, "from", binding.nodeId);
    const toOpacity = nodeOpacity(source, "to", binding.toNodeId);
    if (!fromNode || !toNode) return fromOpacity + (toOpacity - fromOpacity) * sample.progress;
    const fromAssets = new Map(source.from.assets.map((asset) => [asset.id, asset]));
    const toAssets = new Map(source.to.assets.map((asset) => [asset.id, asset]));
    if (!zeroLayerAppearanceDiffers(fromNode, toNode, fromAssets, toAssets)) {
      return fromOpacity + (toOpacity - fromOpacity) * sample.progress;
    }
    const mix = sampleZeroLayerSkinMix(sample.progress);
    const fromAlpha = fromOpacity * mix.from;
    const toAlpha = toOpacity * mix.to;
    return toAlpha + fromAlpha * (1 - toAlpha);
  }
  const enter = bindingResult.enter.find((node) => layerIdForNode(node) === sample.layerId);
  if (enter) return nodeOpacity(source, "to", enter.nodeId);
  const exit = bindingResult.exit.find((node) => layerIdForNode(node) === sample.layerId);
  return nodeOpacity(source, "from", exit?.nodeId);
}

function layerTypeForId(
  bindingResult: ZeroLayerMotionBindingResult,
  layerId: string
): ZeroLayerRecipeStepSample["type"] {
  if (bindingResult.bindings.some((binding) => binding.layerId === layerId)) return "matched";
  if (bindingResult.enter.some((node) => layerIdForNode(node) === layerId)) return "enter";
  if (bindingResult.exit.some((node) => layerIdForNode(node) === layerId)) return "exit";
  return "unknown";
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

function manifestValidationRisk(issue: ZeroLayerRecipeManifestValidation): ZeroLayerRecipeSampleRisk {
  const code =
    issue.code === "MANIFEST_EXPRESSION_STRATEGY_UNKNOWN"
      ? "RECIPE_MANIFEST_EXPRESSION_MISSING"
      : issue.code === "MANIFEST_SAFETY_POLICY_INVALID"
        ? "RECIPE_MANIFEST_SAFETY_MISSING"
        : "RECIPE_MANIFEST_INVALID";
  return {
    code,
    severity: issue.severity,
    ...(issue.recipeId ? { recipeId: issue.recipeId } : {}),
    message: issue.message
  };
}

function manifestExpressionRisk(
  recipeId: ZeroLayerMotionRecipeId,
  signature: ZeroLayerRecipeMotionSignature,
  source: ZeroLayerMorphSource
): ZeroLayerRecipeSampleRisk | undefined {
  if (source.bindingResult.bindings.length === 0) return undefined;
  const manifest = getZeroLayerRecipeManifest(recipeId);
  if (!manifest) {
    return {
      code: "RECIPE_MANIFEST_INVALID",
      severity: "error",
      recipeId,
      message: `${recipeId} has no Zero native recipe manifest.`
    };
  }
  const declared = new Set(manifest.expressionStrategies);
  const sampled = new Set(signature.expressionStrategies);
  const hasDeclaredStrategy = [...declared].some((strategyId) => sampled.has(strategyId));
  if (hasDeclaredStrategy) return undefined;
  return {
    code: "RECIPE_MANIFEST_EXPRESSION_MISSING",
    severity: "error",
    recipeId,
    message: `${recipeId} sampled strategies ${signature.expressionStrategies.join(", ")} do not match its manifest declarations.`
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
  const resultSource =
    result.document.visualSource?.kind === "zero-layer-morph" ? result.document.visualSource : source;
  const persistedMotionPlan = resultSource.motionPlan;
  if (!persistedMotionPlan) throw new Error(`${recipeId} did not compile a MotionPlan.`);
  const motionPlan = fillMotionPlanGeometryFromComposition(
    persistedMotionPlan,
    result.document.composition,
    resultSource
  );
  const label = zeroLayerMotionRecipes.find((recipe) => recipe.id === recipeId)?.label ?? recipeId;
  const durationMs = motionPlanPlaybackDurationMs(motionPlan, result.document.composition);
  const salience = evaluateZeroMotionSalience({
    spec,
    motionPlan,
    steps: result.steps,
    adaptedParameters
  });
  const orderPlan = createZeroMotionOrderPlan(resultSource, result.steps, spec);
  const bindingsByLayerId = bindingByLayerId(resultSource, result.bindingResult);
  const stepByLayerId = new Map(
    result.steps
      .filter((step): step is CompositionStep & { layerId: string } => Boolean(step.layerId))
      .map((step) => [step.layerId, step])
  );
  const risks: ZeroLayerRecipeSampleRisk[] = [];
  const samples = samplePoints.map((progress) => {
    const timeMs = durationMs * progress;
    const steps = sampleMotionPlan(motionPlan, timeMs)
      .map((sample) => {
        const base = baseBoundsForLayer(resultSource, result.bindingResult, sample.layerId);
        if (!base) return undefined;
        const step = stepByLayerId.get(sample.layerId);
        const sampled: ZeroLayerRecipeStepSample = {
          stepId: step?.id ?? `motion-plan-${sample.layerId}`,
          layerId: sample.layerId,
          type: layerTypeForId(result.bindingResult, sample.layerId),
          ...(base.nodeId ? { nodeId: base.nodeId } : {}),
          ...(base.toNodeId ? { toNodeId: base.toNodeId } : {}),
          bounds: boundsFromMotionPlan(base.bounds, sample.state),
          opacity:
            opacityBaseForSample(resultSource, result.bindingResult, sample) * (sample.state.opacity ?? 1)
        };
        const binding = bindingsByLayerId.get(sample.layerId);
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

  risks.push(...orderRisks(recipeId, result.steps, orderPlan, motionPlan));
  const signature = recipeMotionSignature(recipeId, result.steps, motionPlan);
  const expressionRisk = manifestExpressionRisk(recipeId, signature, resultSource);
  if (expressionRisk) risks.push(expressionRisk);
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

function stepStart(step: CompositionStep, motionPlan: MotionPlan): number {
  if (!step.layerId) return 0;
  return motionPlan.tracks.find((track) => track.layerId === step.layerId)?.timing.delayMs ?? 0;
}

function minStepStart(
  steps: CompositionStep[],
  predicate: (step: CompositionStep) => boolean,
  motionPlan: MotionPlan
): number | undefined {
  const starts = steps.filter(predicate).map((step) => stepStart(step, motionPlan));
  return starts.length > 0 ? Math.min(...starts) : undefined;
}

function maxStepStart(
  steps: CompositionStep[],
  predicate: (step: CompositionStep) => boolean,
  motionPlan: MotionPlan
): number | undefined {
  const starts = steps.filter(predicate).map((step) => stepStart(step, motionPlan));
  return starts.length > 0 ? Math.max(...starts) : undefined;
}

function orderRisks(
  recipeId: ZeroLayerMotionRecipeId,
  steps: CompositionStep[],
  orderPlan: ReturnType<typeof createZeroMotionOrderPlan>,
  motionPlan: MotionPlan
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
  const containerStart = minStepStart(steps, isContainer, motionPlan);
  const contentStart = minStepStart(steps, isContent, motionPlan);
  if (containerStart != null && contentStart != null && contentStart < containerStart) {
    risks.push({
      code: "CONTENT_BEFORE_CONTAINER",
      severity: "warning",
      recipeId,
      message: `${recipeId} starts content before foundation or structure layers.`
    });
  }

  const lastExit = maxStepStart(steps, (step) => step.id.startsWith("zero-layer-exit"), motionPlan);
  const firstEnter = minStepStart(steps, (step) => step.id.startsWith("zero-layer-enter"), motionPlan);
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
    (step) => orderItemForStep(orderPlan, step)?.role === "mask",
    motionPlan
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
    (step) => orderItemForStep(orderPlan, step)?.group === "decorative",
    motionPlan
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
  return [
    recipe.durationMs,
    ...recipe.samples.flatMap((sample) => [
      `p${Math.round(sample.progress * 1000)}`,
      ...sample.steps
        .map((step) =>
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
        .sort()
    ])
  ].join("|");
}

function motionAxis(dxCount: number, dyCount: number): ZeroLayerRecipeMotionSignature["dominantAxis"] {
  if (dxCount === 0 && dyCount === 0) return "none";
  if (dxCount > 0 && dyCount > 0) return "mixed";
  return dxCount > 0 ? "x" : "y";
}

function recipeMotionSignature(
  recipeId: ZeroLayerMotionRecipeId,
  steps: CompositionStep[],
  motionPlan: MotionPlan
): ZeroLayerRecipeMotionSignature {
  let geometryStepCount = 0;
  let fadeOnlyStepCount = 0;
  let enterTransformCount = 0;
  let clipRevealCount = 0;
  let dxCount = 0;
  let dyCount = 0;
  const delays = motionPlan.tracks.map((track) => track.timing.delayMs);
  const expressionStrategies = [...new Set(steps.map((step) => zeroLayerExpressionStrategyForStep(step).id))];
  const durationBucket =
    motionPlan.tracks.length > 0
      ? Math.round(
          motionPlan.tracks.reduce((sum, track) => sum + track.timing.durationMs, 0) /
            motionPlan.tracks.length /
            40
        ) * 40
      : 0;
  const phaseSet = new Set(delays);

  for (const track of motionPlan.tracks) {
    const initial = track.keyframes[0];
    const animate = track.keyframes.at(-1);
    const ix = numberFrame(initial, "x", 0);
    const iy = numberFrame(initial, "y", 0);
    const ax = numberFrame(animate, "x", ix);
    const ay = numberFrame(animate, "y", iy);
    const iw = numberFrame(initial, "width", 0);
    const ih = numberFrame(initial, "height", 0);
    const aw = numberFrame(animate, "width", iw);
    const ah = numberFrame(animate, "height", ih);
    const initialScale = numberFrame(initial, "scale", 1);
    const animateScale = numberFrame(animate, "scale", initialScale);
    const io = numberFrame(initial, "opacity", 1);
    const ao = numberFrame(animate, "opacity", io);
    const hasGeometry =
      !sameNumber(ix, ax) ||
      !sameNumber(iy, ay) ||
      !sameNumber(iw, aw) ||
      !sameNumber(ih, ah) ||
      !sameNumber(initialScale, animateScale);
    const hasOpacity = !sameNumber(io, ao);
    if (hasGeometry) geometryStepCount += 1;
    if (!hasGeometry && hasOpacity) fadeOnlyStepCount += 1;
    if (
      track.kind === "enter" &&
      (!sameNumber(ix, ax) || !sameNumber(iy, ay) || !sameNumber(initialScale, animateScale))
    ) {
      enterTransformCount += 1;
    }
    if (track.kind === "enter" && ((iw > 0 && aw / iw > 1.45) || (ih > 0 && ah / ih > 1.45))) {
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
  const snapshotSignatures = new Set(recipes.map(recipeSnapshotSignature));
  const risks = [
    ...validateZeroLayerRecipeManifestRegistry().map(manifestValidationRisk),
    ...recipes.flatMap((recipe) => recipe.risks)
  ];
  if (snapshotSignatures.size < recipes.length) {
    risks.push({
      code: "RECIPE_DIFF_TOO_SMALL",
      severity: "warning",
      message: `${recipes.length - snapshotSignatures.size + 1} Zero native recipes produce highly similar sampled motion.`
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
      distinctSignatures: snapshotSignatures.size
    }
  };
}
