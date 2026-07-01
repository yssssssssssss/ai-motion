import type { Bounds } from "../frameMorph/schema";
import type { CompositionStep, MotionState } from "../schema/document";
import type { ZeroLayerMotionBinding, ZeroLayerMotionBindingResult, ZeroLayerMorphSource } from "./schema";
import {
  applyZeroLayerMotionRecipe,
  zeroLayerMotionRecipes,
  type ZeroLayerMotionRecipeId
} from "./zeroLayerMotionRecipes";

export type ZeroLayerRecipeSampleRiskCode =
  | "MATCHED_CORRIDOR_OVERFLOW"
  | "TAIL_FRAME_MISMATCH"
  | "RECIPE_DIFF_TOO_SMALL";

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
  samples: ZeroLayerRecipeProgressSample[];
  risks: ZeroLayerRecipeSampleRisk[];
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
  const fromX = numberState(step.initial, "x", 0);
  const fromY = numberState(step.initial, "y", 0);
  const fromWidth = numberState(step.initial, "width", base.w);
  const fromHeight = numberState(step.initial, "height", base.h);
  const toX = numberState(step.animate, "x", fromX);
  const toY = numberState(step.animate, "y", fromY);
  const toWidth = numberState(step.animate, "width", fromWidth);
  const toHeight = numberState(step.animate, "height", fromHeight);

  return {
    x: base.x + lerp(fromX, toX, progress),
    y: base.y + lerp(fromY, toY, progress),
    w: lerp(fromWidth, toWidth, progress),
    h: lerp(fromHeight, toHeight, progress)
  };
}

function opacityAt(step: CompositionStep, progress: number): number {
  const from = numberState(step.initial, "opacity", 1);
  const to = numberState(step.animate, "opacity", from);
  return lerp(from, to, progress);
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

  const enterNode = bindingResult.enter.find((node) => `zero-layer-${safeNodeId(node.nodeId)}` === step.layerId);
  if (enterNode) return { bounds: enterNode.bounds, nodeId: enterNode.nodeId };

  const exitNode = bindingResult.exit.find((node) => `zero-layer-${safeNodeId(node.nodeId)}` === step.layerId);
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
  samplePoints: number[]
): ZeroLayerRecipeSampleResult {
  const result = applyZeroLayerMotionRecipe(source, recipeId);
  const label = zeroLayerMotionRecipes.find((recipe) => recipe.id === recipeId)?.label ?? recipeId;
  const durationMs = result.document.composition?.totalDurationMs ?? result.document.timeline.durationMs;
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

  return { recipeId, label, durationMs, samples, risks };
}

function recipeSignature(recipe: ZeroLayerRecipeSampleResult): string {
  const mid = recipe.samples.find((sample) => sample.progress === 0.5) ?? recipe.samples[0];
  return [
    recipe.durationMs,
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

export function createZeroLayerRecipeSampleReport(
  source: ZeroLayerMorphSource,
  options: { recipeIds?: ZeroLayerMotionRecipeId[]; samplePoints?: number[] } = {}
): ZeroLayerRecipeSampleReport {
  const samplePoints = options.samplePoints ?? defaultSamplePoints;
  const recipeIds = options.recipeIds ?? zeroLayerMotionRecipes.map((recipe) => recipe.id);
  const recipes = recipeIds.map((recipeId) => sampleRecipe(source, recipeId, samplePoints));
  const signatures = new Set(recipes.map(recipeSignature));
  const risks = recipes.flatMap((recipe) => recipe.risks);
  if (signatures.size < recipes.length) {
    risks.push({
      code: "RECIPE_DIFF_TOO_SMALL",
      severity: "warning",
      message: `${recipes.length - signatures.size + 1} Zero native recipes produce highly similar middle-frame samples.`
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
