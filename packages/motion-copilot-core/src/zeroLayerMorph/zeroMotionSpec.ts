import type { Bounds } from "../frameMorph/schema";
import type { ZeroLayerMorphSource, ZeroLayerNode } from "./schema";
import {
  classifyZeroMotionScene,
  type ZeroMotionSceneClassification,
  type ZeroMotionSceneType
} from "./zeroMotionSceneClassifier";

export type ZeroMotionFailureType =
  | "under-motion"
  | "recipe-diff-too-small"
  | "tail-mismatch"
  | "corridor-overflow"
  | "low-confidence-match"
  | "motion-too-complex"
  | "low-visual-hierarchy-change"
  | "recipe-runtime-error";

export type ZeroMotionSpec = {
  schemaVersion: "motion-copilot.zero-motion-spec.v1";
  source: {
    fromNodeId: string;
    toNodeId: string;
    fromName: string;
    toName: string;
    fromSize: { width: number; height: number };
    toSize: { width: number; height: number };
  };
  topology: {
    matchedCount: number;
    enterCount: number;
    exitCount: number;
    unresolvedCount: number;
    lowConfidenceCount: number;
    dominantLayerId?: string;
  };
  deltas: {
    stageWidthDelta: number;
    stageHeightDelta: number;
    dominantDx: number;
    dominantDy: number;
    dominantWidthDelta: number;
    dominantHeightDelta: number;
    dominantAreaDeltaRatio: number;
    averageMoveDistance: number;
    enterExitRatio: number;
    xMotionCount: number;
    yMotionCount: number;
    textChangeCount: number;
    enterAreaRatio: number;
  };
  scene: ZeroMotionSceneClassification;
  risks: ZeroMotionFailureType[];
  summary: string;
};

export type { ZeroMotionSceneClassification, ZeroMotionSceneType };

function area(bounds: Bounds): number {
  return Math.max(0, bounds.w) * Math.max(0, bounds.h);
}

function distance(from: Bounds, to: Bounds): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function nodeById(nodes: ZeroLayerNode[], nodeId: string): ZeroLayerNode | undefined {
  return nodes.find((node) => node.nodeId === nodeId);
}

function dominantBinding(source: ZeroLayerMorphSource) {
  const bindings = source.bindingResult.bindings.filter(
    (binding) => binding.nodeId !== source.from.nodeId && binding.toNodeId !== source.to.nodeId
  );
  const candidates = bindings.length > 0 ? bindings : source.bindingResult.bindings;
  return candidates.reduce<(typeof candidates)[number] | undefined>((best, binding) => {
    const score = Math.max(area(binding.fromBounds), area(binding.toBounds));
    const bestScore = best ? Math.max(area(best.fromBounds), area(best.toBounds)) : -1;
    return score > bestScore ? binding : best;
  }, undefined);
}

function textChangeCount(source: ZeroLayerMorphSource): number {
  return source.bindingResult.bindings.filter((binding) => {
    const fromNode = nodeById(source.from.layers, binding.nodeId);
    const toNode = nodeById(source.to.layers, binding.toNodeId);
    return (
      fromNode?.kind === "text" && toNode?.kind === "text" && (fromNode.text ?? "") !== (toNode.text ?? "")
    );
  }).length;
}

function lowConfidenceCount(source: ZeroLayerMorphSource): number {
  const fromBindings = source.bindingResult.bindings.filter((binding) => binding.confidence < 70).length;
  const fromDiagnostic = source.diagnosticReport?.matching.lowConfidence.length ?? 0;
  const fromUnresolved = source.bindingResult.unresolved.filter((item) =>
    item.reason.toLowerCase().includes("confidence")
  ).length;
  return Math.max(fromBindings, fromDiagnostic, fromUnresolved);
}

function enterAreaRatio(source: ZeroLayerMorphSource): number {
  const total = Math.max(1, source.to.width * source.to.height);
  const entered = source.bindingResult.enter.reduce((sum, node) => sum + area(node.bounds), 0);
  return Math.min(1, entered / total);
}

function risksFor(source: ZeroLayerMorphSource, averageMoveDistance: number): ZeroMotionFailureType[] {
  const risks = new Set<ZeroMotionFailureType>();
  if (lowConfidenceCount(source) > 0) risks.add("low-confidence-match");
  if (source.bindingResult.unresolved.length > 0) risks.add("motion-too-complex");
  if (averageMoveDistance < 6 && source.bindingResult.enter.length + source.bindingResult.exit.length === 0) {
    risks.add("under-motion");
  }
  for (const risk of source.diagnosticReport?.risks ?? []) {
    if (risk.code === "MATCH_LOW_CONFIDENCE") risks.add("low-confidence-match");
    if (risk.severity === "error") risks.add("motion-too-complex");
  }
  return [...risks];
}

function summaryFor(
  scene: ZeroMotionSceneClassification,
  spec: Omit<ZeroMotionSpec, "scene" | "summary" | "risks">
): string {
  return [
    `系统判断当前更接近${scene.type}`,
    `matched ${spec.topology.matchedCount}`,
    `enter ${spec.topology.enterCount}`,
    `exit ${spec.topology.exitCount}`
  ].join(" · ");
}

export function buildZeroMotionSpec(source: ZeroLayerMorphSource): ZeroMotionSpec {
  const dominant = dominantBinding(source);
  const dominantFrom = dominant?.fromBounds ?? { x: 0, y: 0, w: source.from.width, h: source.from.height };
  const dominantTo = dominant?.toBounds ?? { x: 0, y: 0, w: source.to.width, h: source.to.height };
  const matchedCount = source.bindingResult.bindings.length;
  const moveDistances = source.bindingResult.bindings.map((binding) =>
    distance(binding.fromBounds, binding.toBounds)
  );
  const averageMoveDistance =
    moveDistances.length > 0 ? moveDistances.reduce((sum, item) => sum + item, 0) / moveDistances.length : 0;
  const xMotionCount = source.bindingResult.bindings.filter(
    (binding) => Math.abs(binding.toBounds.x - binding.fromBounds.x) >= 4
  ).length;
  const yMotionCount = source.bindingResult.bindings.filter(
    (binding) => Math.abs(binding.toBounds.y - binding.fromBounds.y) >= 4
  ).length;

  const base = {
    schemaVersion: "motion-copilot.zero-motion-spec.v1" as const,
    source: {
      fromNodeId: source.from.nodeId,
      toNodeId: source.to.nodeId,
      fromName: source.from.name,
      toName: source.to.name,
      fromSize: { width: source.from.width, height: source.from.height },
      toSize: { width: source.to.width, height: source.to.height }
    },
    topology: {
      matchedCount,
      enterCount: source.bindingResult.enter.length,
      exitCount: source.bindingResult.exit.length,
      unresolvedCount: source.bindingResult.unresolved.length,
      lowConfidenceCount: lowConfidenceCount(source),
      ...(dominant?.layerId ? { dominantLayerId: dominant.layerId } : {})
    },
    deltas: {
      stageWidthDelta: source.to.width - source.from.width,
      stageHeightDelta: source.to.height - source.from.height,
      dominantDx: dominantTo.x - dominantFrom.x,
      dominantDy: dominantTo.y - dominantFrom.y,
      dominantWidthDelta: dominantTo.w - dominantFrom.w,
      dominantHeightDelta: dominantTo.h - dominantFrom.h,
      dominantAreaDeltaRatio: (area(dominantTo) - area(dominantFrom)) / Math.max(1, area(dominantFrom)),
      averageMoveDistance,
      enterExitRatio:
        (source.bindingResult.enter.length + source.bindingResult.exit.length) / Math.max(1, matchedCount),
      xMotionCount,
      yMotionCount,
      textChangeCount: textChangeCount(source),
      enterAreaRatio: enterAreaRatio(source)
    }
  };
  const scene = classifyZeroMotionScene({
    matchedCount: base.topology.matchedCount,
    enterCount: base.topology.enterCount,
    exitCount: base.topology.exitCount,
    unresolvedCount: base.topology.unresolvedCount,
    lowConfidenceCount: base.topology.lowConfidenceCount,
    stageWidthDelta: base.deltas.stageWidthDelta,
    stageHeightDelta: base.deltas.stageHeightDelta,
    dominantWidthDelta: base.deltas.dominantWidthDelta,
    dominantHeightDelta: base.deltas.dominantHeightDelta,
    dominantAreaDeltaRatio: base.deltas.dominantAreaDeltaRatio,
    averageMoveDistance: base.deltas.averageMoveDistance,
    xMotionCount: base.deltas.xMotionCount,
    yMotionCount: base.deltas.yMotionCount,
    textChangeCount: base.deltas.textChangeCount,
    enterAreaRatio: base.deltas.enterAreaRatio
  });
  return {
    ...base,
    scene,
    risks: risksFor(source, averageMoveDistance),
    summary: summaryFor(scene, base)
  };
}
