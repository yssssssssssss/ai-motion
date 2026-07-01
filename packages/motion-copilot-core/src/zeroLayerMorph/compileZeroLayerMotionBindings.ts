import type {
  ZeroLayerMotionBinding,
  ZeroLayerMotionBindingResult,
  ZeroLayerNode,
  ZeroLayerSnapshot
} from "./schema";

const MIN_CONFIDENCE = 56;

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function layerIdFor(nodeId: string): string {
  return `zero-layer-${safeId(nodeId) || "node"}`;
}

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function centerDistance(a: ZeroLayerNode, b: ZeroLayerNode): number {
  return Math.hypot(
    a.bounds.x + a.bounds.w / 2 - (b.bounds.x + b.bounds.w / 2),
    a.bounds.y + a.bounds.h / 2 - (b.bounds.y + b.bounds.h / 2)
  );
}

function isAnimatableLayer(snapshot: ZeroLayerSnapshot, node: ZeroLayerNode): boolean {
  if (!node.visible) return false;
  if (node.nodeId === snapshot.nodeId) return false;
  if (node.kind === "group" || node.kind === "section") return false;
  return node.bounds.w > 0 && node.bounds.h > 0;
}

function rootLayer(snapshot: ZeroLayerSnapshot): ZeroLayerNode | undefined {
  return snapshot.layers.find((layer) => layer.nodeId === snapshot.nodeId && layer.visible);
}

function scorePair(from: ZeroLayerNode, to: ZeroLayerNode): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (from.nodeId === to.nodeId) {
    score += 100;
    reasons.push("same-node-id");
  }
  if (from.kind === to.kind) {
    score += 16;
    reasons.push("same-kind");
  }
  if (normalized(from.name) && normalized(from.name) === normalized(to.name)) {
    score += 24;
    reasons.push("same-name");
  }
  if (normalized(from.text) && normalized(from.text) === normalized(to.text)) {
    score += 24;
    reasons.push("same-text");
  }

  const distance = centerDistance(from, to);
  if (distance <= 96) {
    score += Math.max(0, 20 - distance / 8);
    reasons.push("near-bounds");
  }

  const widthDelta = Math.abs(from.bounds.w - to.bounds.w);
  const heightDelta = Math.abs(from.bounds.h - to.bounds.h);
  if (widthDelta <= Math.max(24, from.bounds.w * 0.75) && heightDelta <= Math.max(16, from.bounds.h * 0.75)) {
    score += 10;
    reasons.push("compatible-size");
  }

  return { score: Math.min(100, score), reasons };
}

export function compileZeroLayerMotionBindings(
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot
): ZeroLayerMotionBindingResult {
  const fromLayers = from.layers.filter((layer) => isAnimatableLayer(from, layer));
  const toLayers = to.layers.filter((layer) => isAnimatableLayer(to, layer));
  const toCandidates = new Set(toLayers.map((layer) => layer.nodeId));
  const bindings: ZeroLayerMotionBinding[] = [];
  const unresolved: ZeroLayerMotionBindingResult["unresolved"] = [];
  const fromRoot = rootLayer(from);
  const toRoot = rootLayer(to);

  if (fromRoot && toRoot) {
    bindings.push({
      layerId: layerIdFor(fromRoot.nodeId),
      nodeId: fromRoot.nodeId,
      toNodeId: toRoot.nodeId,
      fromBounds: fromRoot.bounds,
      toBounds: toRoot.bounds,
      confidence: 100,
      reasons: ["root-frame"]
    });
  }

  for (const fromLayer of fromLayers) {
    let best: { layer: ZeroLayerNode; score: number; reasons: string[] } | undefined;
    for (const toLayer of toLayers) {
      if (!toCandidates.has(toLayer.nodeId)) continue;
      const next = scorePair(fromLayer, toLayer);
      if (!best || next.score > best.score) {
        best = { layer: toLayer, score: next.score, reasons: next.reasons };
      }
    }

    if (!best || best.score < MIN_CONFIDENCE) {
      unresolved.push({
        fromNodeId: fromLayer.nodeId,
        ...(best ? { toNodeId: best.layer.nodeId } : {}),
        reason: best ? `low confidence ${Math.round(best.score)}` : "no candidate"
      });
      continue;
    }

    toCandidates.delete(best.layer.nodeId);
    bindings.push({
      layerId: layerIdFor(fromLayer.nodeId),
      nodeId: fromLayer.nodeId,
      toNodeId: best.layer.nodeId,
      fromBounds: fromLayer.bounds,
      toBounds: best.layer.bounds,
      confidence: Math.round(best.score),
      reasons: best.reasons
    });
  }

  const boundFrom = new Set(bindings.map((binding) => binding.nodeId));
  return {
    bindings,
    enter: toLayers.filter((layer) => toCandidates.has(layer.nodeId)),
    exit: fromLayers.filter((layer) => !boundFrom.has(layer.nodeId)),
    unresolved
  };
}
