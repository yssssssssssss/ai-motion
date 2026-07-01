import { computeCompositionStepWindows } from "../composition/evaluateComposition";
import { createClassicEasing, type CompositionStep, type CompositionTrack } from "../schema/document";
import { easedProgress } from "../runtime/progress";
import type { VisualMotionBinding, VisualMotionBindingResult } from "./schema";

export type VisualTimelineCssLayer = "from" | "to";

function cssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

function nodeSelector(nodeId: string): string {
  return `[data-node-id="${cssAttributeValue(nodeId)}"]`;
}

export function createVisualTimelineCss(
  result: VisualMotionBindingResult,
  progress: number,
  layer: VisualTimelineCssLayer
): string {
  const p = clampProgress(progress);
  const rules: string[] = [];

  for (const binding of result.bindings) {
    if (layer === "to") {
      rules.push(`${nodeSelector(binding.toNodeId)}{display:none!important;}`);
      continue;
    }

    const dx = binding.toBounds.x - binding.fromBounds.x;
    const dy = binding.toBounds.y - binding.fromBounds.y;
    const width = binding.fromBounds.w + (binding.toBounds.w - binding.fromBounds.w) * p;
    const height = binding.fromBounds.h + (binding.toBounds.h - binding.fromBounds.h) * p;
    rules.push(
      `${nodeSelector(binding.nodeId)}{transform:translate(${dx * p}px,${dy * p}px)!important;width:${width}px!important;height:${height}px!important;}`
    );
  }

  if (layer === "from") {
    for (const node of result.exit) {
      rules.push(
        `${nodeSelector(node.nodeId)}{opacity:${1 - p}!important;${p >= 1 ? "display:none!important;" : ""}}`
      );
    }
    for (const ignored of result.ignored ?? []) {
      rules.push(
        `${nodeSelector(ignored.nodeId)}{opacity:${1 - p}!important;${p >= 1 ? "display:none!important;" : ""}}`
      );
    }
  } else {
    for (const node of result.enter) {
      rules.push(
        `${nodeSelector(node.nodeId)}{opacity:${p}!important;${p <= 0 ? "display:none!important;" : ""}}`
      );
    }
  }

  return rules.join("\n");
}

function stepByLayerId(track: CompositionTrack): Map<string, CompositionStep> {
  const result = new Map<string, CompositionStep>();
  for (const step of track.steps) {
    if (step.layerId && !result.has(step.layerId)) result.set(step.layerId, step);
  }
  return result;
}

function visualStepProgress(
  track: CompositionTrack,
  step: CompositionStep | undefined,
  windows: Map<string, { start: number; end: number }>,
  progress: number
): "before" | "after" | number {
  if (!step || track.totalDurationMs <= 0) return clampProgress(progress);
  const window = windows.get(step.id);
  if (!window) return clampProgress(progress);
  const currentMs = clampProgress(progress) * track.totalDurationMs;
  if (currentMs < window.start) return "before";
  if (currentMs > window.end) return "after";
  return easedProgress(
    step.easing ?? createClassicEasing("decelerate"),
    (currentMs - window.start) / Math.max(1, step.durationMs)
  );
}

function bindingRule(binding: VisualMotionBinding, p: number): string {
  const dx = binding.toBounds.x - binding.fromBounds.x;
  const dy = binding.toBounds.y - binding.fromBounds.y;
  const width = binding.fromBounds.w + (binding.toBounds.w - binding.fromBounds.w) * p;
  const height = binding.fromBounds.h + (binding.toBounds.h - binding.fromBounds.h) * p;
  return `${nodeSelector(binding.nodeId)}{transform:translate(${dx * p}px,${dy * p}px)!important;width:${width}px!important;height:${height}px!important;}`;
}

export function createVisualTimelineCssForTrack(
  result: VisualMotionBindingResult,
  track: CompositionTrack,
  progress: number,
  layer: VisualTimelineCssLayer
): string {
  const byLayer = stepByLayerId(track);
  const windows = new Map(computeCompositionStepWindows(track.steps).map((item) => [item.stepId, item]));
  const rules: string[] = [];

  for (const binding of result.bindings) {
    const step = byLayer.get(binding.layerId);
    const state = visualStepProgress(track, step, windows, progress);
    if (layer === "to") {
      rules.push(`${nodeSelector(binding.toNodeId)}{display:none!important;}`);
      continue;
    }
    rules.push(bindingRule(binding, state === "before" ? 0 : state === "after" ? 1 : state));
  }

  if (layer === "from") {
    for (const node of result.exit) {
      const step = byLayer.get(`zero-visual-${node.nodeId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`);
      const state = visualStepProgress(track, step, windows, progress);
      if (state === "after") {
        rules.push(`${nodeSelector(node.nodeId)}{display:none!important;opacity:0!important;}`);
      } else {
        const p = state === "before" ? 0 : state;
        rules.push(`${nodeSelector(node.nodeId)}{opacity:${1 - p}!important;}`);
      }
    }
    for (const ignored of result.ignored ?? []) {
      const p = clampProgress(progress);
      rules.push(
        `${nodeSelector(ignored.nodeId)}{opacity:${1 - p}!important;${p >= 1 ? "display:none!important;" : ""}}`
      );
    }
  } else {
    if (clampProgress(progress) <= 0) {
      rules.push(".zero-visual-stage{display:none!important;}");
    }
    for (const node of result.enter) {
      const step = byLayer.get(`zero-visual-${node.nodeId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`);
      const state = visualStepProgress(track, step, windows, progress);
      if (state === "before") {
        rules.push(`${nodeSelector(node.nodeId)}{display:none!important;opacity:0!important;}`);
      } else {
        const p = state === "after" ? 1 : state;
        rules.push(`${nodeSelector(node.nodeId)}{opacity:${p}!important;}`);
      }
    }
  }

  return rules.join("\n");
}
