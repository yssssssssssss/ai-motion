import { evaluateComposition } from "../composition/evaluateComposition";
import {
  createClassicEasing,
  type CompositionStep,
  type MotionDocument,
  type MotionLayer
} from "../schema/document";
import type {
  VisualMotionBinding,
  VisualMotionBindingResult,
  VisualMotionIntent,
  ZeroVisualNode,
  ZeroVisualSnapshot
} from "./schema";

export type VisualMotionCompositionResult = {
  document: MotionDocument;
  steps: CompositionStep[];
  intent: VisualMotionIntent;
  bindingResult: VisualMotionBindingResult;
  summary: string;
};

export type CompileVisualMotionCompositionInput = {
  from: ZeroVisualSnapshot;
  to: ZeroVisualSnapshot;
  bindingResult: VisualMotionBindingResult;
  intent: VisualMotionIntent;
};

const visualMorphPresetId = "zero-visual-morph";

function safeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function visualLayerId(nodeId: string): string {
  return `zero-visual-${safeId(nodeId) || "node"}`;
}

function nodeLabel(node: ZeroVisualNode): string {
  return `${node.text ?? node.name} · ${node.nodeId}`;
}

function proxyLayerName(node: ZeroVisualNode): string {
  return node.text?.trim() || node.name;
}

function bindingLabel(binding: VisualMotionBinding, from: ZeroVisualSnapshot, to: ZeroVisualSnapshot): string {
  const fromNode = from.nodes.find((node) => node.nodeId === binding.nodeId);
  const toNode = to.nodes.find((node) => node.nodeId === binding.toNodeId);
  const fromLabel = fromNode ? nodeLabel(fromNode) : binding.nodeId;
  const toLabel = toNode ? nodeLabel(toNode) : binding.toNodeId;
  return `${fromLabel} → ${toLabel}`;
}

function proxyLayerForNode(node: ZeroVisualNode, opacity: number, zIndex: number): MotionLayer {
  return {
    id: visualLayerId(node.nodeId),
    name: proxyLayerName(node),
    kind: node.kind === "text" ? "text" : node.kind === "image" ? "image" : "shape",
    editable: true,
    content: {
      ...(node.text ? { text: node.text } : {})
    },
    style: {
      background: "transparent",
      color: "transparent",
      borderColor: "rgba(44, 92, 255, 0.35)",
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
  binding: VisualMotionBinding,
  from: ZeroVisualSnapshot,
  to: ZeroVisualSnapshot,
  zIndex: number
): MotionLayer {
  return {
    id: visualLayerId(binding.nodeId),
    name: bindingLabel(binding, from, to),
    kind: "shape",
    editable: true,
    style: {
      background: "transparent",
      borderColor: "rgba(44, 92, 255, 0.35)",
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

function matchedStep(
  binding: VisualMotionBinding,
  intent: VisualMotionIntent,
  index: number,
  from: ZeroVisualSnapshot,
  to: ZeroVisualSnapshot
): CompositionStep {
  return {
    id: `zero-visual-match-${index}-${safeId(binding.nodeId)}-${safeId(binding.toNodeId)}`,
    presetId: visualMorphPresetId,
    label: "高保真形变",
    target: "selected-layer",
    layerId: visualLayerId(binding.nodeId),
    layerName: bindingLabel(binding, from, to),
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: 0,
    durationMs: intent.durationMs,
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
    easing: intent.easing,
    fillMode: "both"
  };
}

function enterStep(node: ZeroVisualNode, intent: VisualMotionIntent, index: number, enterIndex: number): CompositionStep {
  return {
    id: `zero-visual-enter-${index}-${safeId(node.nodeId)}`,
    presetId: visualMorphPresetId,
    label: "高保真进入",
    target: "selected-layer",
    layerId: visualLayerId(node.nodeId),
    layerName: nodeLabel(node),
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: intent.staggerMs > 0 ? enterIndex * intent.staggerMs : intent.enter.delayMs,
    durationMs: intent.durationMs,
    slot: "trajectory",
    initial: {
      x: 0,
      y: intent.enter.translateY,
      width: node.bounds.w,
      height: node.bounds.h,
      scale: 1,
      opacity: intent.enter.opacityFrom,
      blur: 0,
      rotate: 0
    },
    animate: {
      x: 0,
      y: 0,
      width: node.bounds.w,
      height: node.bounds.h,
      scale: 1,
      opacity: 1,
      blur: 0,
      rotate: 0
    },
    easing: intent.easing,
    fillMode: "both"
  };
}

function exitStep(node: ZeroVisualNode, intent: VisualMotionIntent, index: number): CompositionStep {
  return {
    id: `zero-visual-exit-${index}-${safeId(node.nodeId)}`,
    presetId: visualMorphPresetId,
    label: "高保真退出",
    target: "selected-layer",
    layerId: visualLayerId(node.nodeId),
    layerName: nodeLabel(node),
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: intent.exit.delayMs,
    durationMs: Math.max(80, Math.round(intent.durationMs * 0.7)),
    slot: "trajectory",
    initial: {
      x: 0,
      y: 0,
      width: node.bounds.w,
      height: node.bounds.h,
      scale: 1,
      opacity: 1,
      blur: 0,
      rotate: 0
    },
    animate: {
      x: 0,
      y: intent.exit.translateY,
      width: node.bounds.w,
      height: node.bounds.h,
      scale: 0.98,
      opacity: intent.exit.opacityTo,
      blur: 0,
      rotate: 0
    },
    easing: createClassicEasing("accelerate"),
    fillMode: "both"
  };
}

function summaryForIntent(intent: VisualMotionIntent): string {
  const easing = intent.easing.type === "spring" ? "弹性" : intent.easing.preset;
  const stagger = intent.staggerMs > 0 ? "，带错峰" : "";
  return `Zero 高保真帧间过渡：${intent.durationMs}ms，${easing}${stagger}`;
}

export function compileVisualMotionComposition(
  input: CompileVisualMotionCompositionInput
): VisualMotionCompositionResult {
  const layers: MotionLayer[] = [];
  const steps: CompositionStep[] = [];
  const seenLayerIds = new Set<string>();

  const toOrder = new Map(input.to.nodes.map((node, index) => [node.nodeId, index] as const));
  const fromOrder = new Map(input.from.nodes.map((node, index) => [node.nodeId, index] as const));
  const toOffset = input.to.nodes.length;

  function zIndexForToNode(nodeId: string): number {
    return toOrder.get(nodeId) ?? toOffset;
  }
  function zIndexForFromOnlyNode(nodeId: string): number {
    return toOffset + (fromOrder.get(nodeId) ?? 0);
  }

  function addLayer(layer: MotionLayer): void {
    if (seenLayerIds.has(layer.id)) return;
    seenLayerIds.add(layer.id);
    layers.push(layer);
  }

  for (const binding of input.bindingResult.bindings) {
    addLayer(proxyLayerForBinding(binding, input.from, input.to, zIndexForToNode(binding.toNodeId)));
    steps.push(matchedStep(binding, input.intent, steps.length, input.from, input.to));
  }
  for (const node of input.bindingResult.exit) {
    addLayer(proxyLayerForNode(node, 1, zIndexForFromOnlyNode(node.nodeId)));
    steps.push(exitStep(node, input.intent, steps.length));
  }
  for (const [enterIndex, node] of input.bindingResult.enter.entries()) {
    addLayer(proxyLayerForNode(node, 0, zIndexForToNode(node.nodeId)));
    steps.push(enterStep(node, input.intent, steps.length, enterIndex));
  }

  const composition = evaluateComposition(steps);
  const summary = summaryForIntent(input.intent);
  const selectedLayerId = steps[0]?.layerId;
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
    ...(selectedLayerId ? { selectedLayerId } : {}),
    appliedPresets: [],
    presetResolutions: [],
    timeline: {
      trigger: "load",
      direction: "move-inside",
      durationMs: composition.totalDurationMs || input.intent.durationMs,
      delayMs: 0,
      easing: input.intent.easing,
      repeat: "none"
    },
    guidelineSuggestions: [],
    composition,
    visualSource: {
      kind: "zero-visual-morph",
      from: input.from,
      to: input.to,
      bindingResult: input.bindingResult
    }
  };

  return {
    document,
    steps,
    intent: input.intent,
    bindingResult: input.bindingResult,
    summary
  };
}
