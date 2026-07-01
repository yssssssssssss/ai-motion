import { evaluateComposition } from "../composition/evaluateComposition";
import {
  createClassicEasing,
  type CompositionStep,
  type MotionDocument,
  type MotionLayer
} from "../schema/document";
import { deriveZeroLayerObjects } from "./deriveZeroLayerObjects";
import { deriveZeroLayerDiagnosticGate } from "./createZeroLayerDiagnosticReport";
import type { ZeroLayerDiagnosticReport } from "./diagnosticSchema";
import type {
  ZeroLayerMotionBinding,
  ZeroLayerMotionBindingResult,
  ZeroLayerNode,
  ZeroLayerOptimizerReport,
  ZeroLayerSnapshot
} from "./schema";

export type ZeroLayerMotionCompositionResult = {
  document: MotionDocument;
  steps: CompositionStep[];
  bindingResult: ZeroLayerMotionBindingResult;
  summary: string;
};

export type CompileZeroLayerMotionCompositionInput = {
  from: ZeroLayerSnapshot;
  to: ZeroLayerSnapshot;
  bindingResult: ZeroLayerMotionBindingResult;
  diagnosticReport?: ZeroLayerDiagnosticReport;
  durationMs?: number;
};

const presetId = "zero-layer-morph";

function safeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function layerIdFor(nodeId: string): string {
  return `zero-layer-${safeId(nodeId) || "node"}`;
}

function nodeLabel(node: ZeroLayerNode): string {
  return `${node.text?.trim() || node.name} · ${node.nodeId}`;
}

function proxyLayerForNode(node: ZeroLayerNode, opacity: number, zIndex: number): MotionLayer {
  return {
    id: layerIdFor(node.nodeId),
    name: nodeLabel(node),
    kind: node.kind === "text" ? "text" : node.kind === "image" ? "image" : "shape",
    editable: true,
    content: {
      ...(node.text ? { text: node.text } : {})
    },
    style: {
      background: "transparent",
      borderColor: "rgba(22, 119, 255, 0.4)",
      borderWidth: 1,
      opacity
    },
    layout: {
      x: node.bounds.x,
      y: node.bounds.y,
      width: node.bounds.w,
      height: node.bounds.h,
      zIndex
    }
  };
}

function proxyLayerForBinding(
  binding: ZeroLayerMotionBinding,
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot,
  zIndex: number
): MotionLayer {
  const fromNode = from.layers.find((node) => node.nodeId === binding.nodeId);
  const toNode = to.layers.find((node) => node.nodeId === binding.toNodeId);
  return {
    id: binding.layerId,
    name: `${fromNode ? nodeLabel(fromNode) : binding.nodeId} → ${toNode ? nodeLabel(toNode) : binding.toNodeId}`,
    kind: "shape",
    editable: true,
    style: {
      background: "transparent",
      borderColor: "rgba(22, 119, 255, 0.4)",
      borderWidth: 1,
      opacity: 1
    },
    layout: {
      x: binding.fromBounds.x,
      y: binding.fromBounds.y,
      width: binding.fromBounds.w,
      height: binding.fromBounds.h,
      zIndex
    }
  };
}

function matchedStep(binding: ZeroLayerMotionBinding, durationMs: number, index: number): CompositionStep {
  return {
    id: `zero-layer-match-${index}-${safeId(binding.nodeId)}-${safeId(binding.toNodeId)}`,
    presetId,
    label: "Zero 图层形变",
    target: "selected-layer",
    layerId: binding.layerId,
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: 0,
    durationMs,
    slot: "trajectory",
    initial: {
      x: 0,
      y: 0,
      width: binding.fromBounds.w,
      height: binding.fromBounds.h,
      scale: 1,
      opacity: 1,
      blur: 0,
      rotate: 0
    },
    animate: {
      x: binding.toBounds.x - binding.fromBounds.x,
      y: binding.toBounds.y - binding.fromBounds.y,
      width: binding.toBounds.w,
      height: binding.toBounds.h,
      scale: 1,
      opacity: 1,
      blur: 0,
      rotate: 0
    },
    easing: createClassicEasing("decelerate"),
    fillMode: "both"
  };
}

function enterStep(node: ZeroLayerNode, durationMs: number, index: number): CompositionStep {
  return {
    id: `zero-layer-enter-${index}-${safeId(node.nodeId)}`,
    presetId,
    label: "Zero 图层进入",
    target: "selected-layer",
    layerId: layerIdFor(node.nodeId),
    layerName: nodeLabel(node),
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: 60,
    durationMs,
    slot: "trajectory",
    initial: { x: 0, y: 0, width: node.bounds.w, height: node.bounds.h, scale: 1, opacity: 0 },
    animate: { x: 0, y: 0, width: node.bounds.w, height: node.bounds.h, scale: 1, opacity: 1 },
    easing: createClassicEasing("decelerate"),
    fillMode: "both"
  };
}

function exitStep(node: ZeroLayerNode, durationMs: number, index: number): CompositionStep {
  return {
    id: `zero-layer-exit-${index}-${safeId(node.nodeId)}`,
    presetId,
    label: "Zero 图层退出",
    target: "selected-layer",
    layerId: layerIdFor(node.nodeId),
    layerName: nodeLabel(node),
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: 0,
    durationMs: Math.max(80, Math.round(durationMs * 0.7)),
    slot: "trajectory",
    initial: { x: 0, y: 0, width: node.bounds.w, height: node.bounds.h, scale: 1, opacity: 1 },
    animate: { x: 0, y: 0, width: node.bounds.w, height: node.bounds.h, scale: 1, opacity: 0 },
    easing: createClassicEasing("accelerate"),
    fillMode: "both"
  };
}

function nodeById(snapshot: ZeroLayerSnapshot, nodeId: string): ZeroLayerNode | undefined {
  return snapshot.layers.find((node) => node.nodeId === nodeId);
}

function riskNodePairs(report: ZeroLayerDiagnosticReport | undefined): Set<string> {
  const pairs = new Set<string>();
  for (const risk of report?.risks ?? []) {
    if (risk.code !== "MATCH_LOW_CONFIDENCE" || !risk.nodeId) continue;
    for (const relatedNodeId of risk.relatedNodeIds ?? []) {
      pairs.add(`${risk.nodeId}→${relatedNodeId}`);
    }
  }
  return pairs;
}

function optimizeBindingResult(
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot,
  bindingResult: ZeroLayerMotionBindingResult,
  report: ZeroLayerDiagnosticReport | undefined
): { bindingResult: ZeroLayerMotionBindingResult; optimizerReport?: ZeroLayerOptimizerReport } {
  const gate = report ? (report.gate ?? deriveZeroLayerDiagnosticGate(report)) : undefined;
  if (!gate || gate.strategy !== "safe-fade-unmatched") return { bindingResult };
  const lowConfidencePairs = riskNodePairs(report);
  if (lowConfidencePairs.size === 0) return { bindingResult };

  const bindings: ZeroLayerMotionBinding[] = [];
  const enter: ZeroLayerNode[] = [...bindingResult.enter];
  const exit: ZeroLayerNode[] = [...bindingResult.exit];
  const applied: ZeroLayerOptimizerReport["applied"] = [];
  const skipped: ZeroLayerOptimizerReport["skipped"] = [];

  for (const binding of bindingResult.bindings) {
    if (!lowConfidencePairs.has(`${binding.nodeId}→${binding.toNodeId}`)) {
      bindings.push(binding);
      continue;
    }
    const fromNode = nodeById(from, binding.nodeId);
    const toNode = nodeById(to, binding.toNodeId);
    if (!fromNode || !toNode) {
      skipped.push({
        code: "DOWNGRADE_LOW_CONFIDENCE_TO_FADE",
        message: "Could not find both nodes for the low-confidence match.",
        nodeIds: [binding.nodeId, binding.toNodeId]
      });
      bindings.push(binding);
      continue;
    }
    exit.push(fromNode);
    enter.push(toNode);
    applied.push({
      code: "DOWNGRADE_LOW_CONFIDENCE_TO_FADE",
      message: "Converted a low-confidence geometry morph into exit/enter fades.",
      nodeIds: [binding.nodeId, binding.toNodeId]
    });
  }

  return {
    bindingResult: {
      bindings,
      enter,
      exit,
      unresolved: bindingResult.unresolved
    },
    optimizerReport: {
      strategy: gate.strategy,
      applied,
      skipped
    }
  };
}

export function compileZeroLayerMotionComposition(
  input: CompileZeroLayerMotionCompositionInput
): ZeroLayerMotionCompositionResult {
  const durationMs = input.durationMs ?? 360;
  const optimized = optimizeBindingResult(input.from, input.to, input.bindingResult, input.diagnosticReport);
  const bindingResult = optimized.bindingResult;
  const layers: MotionLayer[] = [];
  const steps: CompositionStep[] = [];
  const seen = new Set<string>();
  const toOrder = new Map(input.to.layers.map((node, index) => [node.nodeId, index] as const));
  const fromOrder = new Map(input.from.layers.map((node, index) => [node.nodeId, index] as const));
  const fromOffset = input.to.layers.length;

  function addLayer(layer: MotionLayer): void {
    if (seen.has(layer.id)) return;
    seen.add(layer.id);
    layers.push(layer);
  }

  for (const binding of bindingResult.bindings) {
    addLayer(proxyLayerForBinding(binding, input.from, input.to, toOrder.get(binding.toNodeId) ?? 0));
    steps.push(matchedStep(binding, durationMs, steps.length));
  }
  for (const node of bindingResult.exit) {
    addLayer(proxyLayerForNode(node, 1, fromOffset + (fromOrder.get(node.nodeId) ?? 0)));
    steps.push(exitStep(node, durationMs, steps.length));
  }
  for (const node of bindingResult.enter) {
    addLayer(proxyLayerForNode(node, 0, toOrder.get(node.nodeId) ?? 0));
    steps.push(enterStep(node, durationMs, steps.length));
  }

  const composition = evaluateComposition(steps);
  const document: MotionDocument = {
    version: "0.1",
    stage: {
      mode: "custom",
      width: Math.max(input.from.width, input.to.width),
      height: Math.max(input.from.height, input.to.height),
      background: "transparent",
      backgroundFit: "fill",
      backgroundPosition: "center"
    },
    elements: [
      {
        id: "primary",
        name: `${input.from.name} → ${input.to.name}`,
        role: "background",
        size: "medium",
        initial: { opacity: 0 },
        animate: { opacity: 0 }
      }
    ],
    layers,
    ...(steps[0]?.layerId ? { selectedLayerId: steps[0].layerId } : {}),
    appliedPresets: [],
    presetResolutions: [],
    timeline: {
      trigger: "load",
      direction: "move-inside",
      durationMs: composition.totalDurationMs || durationMs,
      delayMs: 0,
      easing: createClassicEasing("decelerate"),
      repeat: "none"
    },
    guidelineSuggestions: [],
    composition,
    visualSource: {
      kind: "zero-layer-morph",
      from: input.from,
      to: input.to,
      bindingResult,
      ...(input.diagnosticReport ? { diagnosticReport: input.diagnosticReport } : {}),
      ...(optimized.optimizerReport ? { optimizerReport: optimized.optimizerReport } : {}),
      objects: {
        from: deriveZeroLayerObjects(input.from),
        to: deriveZeroLayerObjects(input.to)
      }
    }
  };

  return {
    document,
    steps,
    bindingResult,
    summary: `Zero 图层首尾帧动效：${steps.length} 个图层片段，${composition.totalDurationMs || durationMs}ms`
  };
}
