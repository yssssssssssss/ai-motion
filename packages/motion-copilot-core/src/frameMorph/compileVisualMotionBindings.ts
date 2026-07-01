import type {
  VisualMotionBinding,
  VisualMotionBindingResult,
  ZeroVisualAsset,
  ZeroVisualNode,
  ZeroVisualSnapshot
} from "./schema";

const MIN_CONFIDENCE = 58;

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function centerDistance(a: ZeroVisualNode, b: ZeroVisualNode): number {
  const ax = a.bounds.x + a.bounds.w / 2;
  const ay = a.bounds.y + a.bounds.h / 2;
  const bx = b.bounds.x + b.bounds.w / 2;
  const by = b.bounds.y + b.bounds.h / 2;
  return Math.hypot(ax - bx, ay - by);
}

function sourceFor(
  node: ZeroVisualNode,
  assets: Map<string, ZeroVisualAsset>
): VisualMotionBinding["source"] {
  const asset = node.assetId ? assets.get(node.assetId) : undefined;
  if (asset?.type === "svg") return "svg-asset";
  if (asset && ["png", "jpg", "webp"].includes(asset.type)) return "png-asset";
  if (asset?.type === "group" || node.kind === "group") return "group-asset";
  return "html-node";
}

function layerIdFor(node: ZeroVisualNode): string {
  return `zero-visual-${node.nodeId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function scorePair(from: ZeroVisualNode, to: ZeroVisualNode): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const fromText = normalized(from.text);
  const toText = normalized(to.text);

  if (from.kind === "text" && to.kind === "text" && fromText && toText && fromText !== toText) {
    return { score: 0, reasons: ["different-text"] };
  }

  if (from.nodeId === to.nodeId) {
    score += 100;
    reasons.push("same-node-id");
  }
  if (from.kind === to.kind) {
    score += 18;
    reasons.push("same-kind");
  }
  if (fromText && fromText === toText) {
    score += 35;
    reasons.push("same-text");
  }
  if (normalized(from.name) && normalized(from.name) === normalized(to.name)) {
    score += 24;
    reasons.push("same-name");
  }

  const distance = centerDistance(from, to);
  if (distance <= 96) {
    score += Math.max(0, 22 - distance / 8);
    reasons.push("near-bounds");
  }

  const widthDelta = Math.abs(from.bounds.w - to.bounds.w);
  const heightDelta = Math.abs(from.bounds.h - to.bounds.h);
  if (widthDelta <= Math.max(24, from.bounds.w * 0.5) && heightDelta <= Math.max(16, from.bounds.h * 0.5)) {
    score += 12;
    reasons.push("similar-size");
  }

  if (isLikelyPillBackground(from, to)) {
    score += 18;
    reasons.push("pill-background");
  }

  return { score: Math.min(100, score), reasons };
}

function isLikelyPillBackground(from: ZeroVisualNode, to: ZeroVisualNode): boolean {
  if (from.kind !== to.kind) return false;
  if (from.kind !== "rect" && from.kind !== "vector") return false;
  const heightDelta = Math.abs(from.bounds.h - to.bounds.h);
  const yDelta = Math.abs(from.bounds.y - to.bounds.y);
  const fromWide = from.bounds.w >= from.bounds.h * 2;
  const toWide = to.bounds.w >= to.bounds.h * 2;
  return fromWide && toWide && from.bounds.h <= 48 && to.bounds.h <= 48 && heightDelta <= 4 && yDelta <= 4;
}

function isPureNumberText(node: ZeroVisualNode): boolean {
  return node.kind === "text" && /^\d+$/.test((node.text ?? "").trim());
}

function statusTargetForNumber(numberText: string, toNodes: ZeroVisualNode[]): ZeroVisualNode | undefined {
  return toNodes.find((node) => {
    const text = node.text?.trim();
    return Boolean(text && text.includes(numberText) && /待确认|已接受|已拒绝|接受|拒绝|确认/.test(text));
  });
}

function nearbyNumberTextNode(node: ZeroVisualNode, fromNodes: ZeroVisualNode[]): ZeroVisualNode | undefined {
  const cy = node.bounds.y + node.bounds.h / 2;
  return fromNodes.find((candidate) => {
    if (!isPureNumberText(candidate)) return false;
    const candidateCy = candidate.bounds.y + candidate.bounds.h / 2;
    const xGap = Math.abs(candidate.bounds.x - (node.bounds.x + node.bounds.w));
    return Math.abs(candidateCy - cy) <= 10 && xGap <= 24;
  });
}

function isCollapsedStatusFragment(
  node: ZeroVisualNode,
  fromNodes: ZeroVisualNode[],
  toNodes: ZeroVisualNode[]
): boolean {
  if (isPureNumberText(node)) {
    return Boolean(statusTargetForNumber(node.text?.trim() ?? "", toNodes));
  }
  if (node.kind !== "vector" || node.bounds.w > 16 || node.bounds.h > 16) return false;
  const numberNode = nearbyNumberTextNode(node, fromNodes);
  return Boolean(numberNode?.text && statusTargetForNumber(numberNode.text.trim(), toNodes));
}

export function compileVisualMotionBindings(
  from: ZeroVisualSnapshot,
  to: ZeroVisualSnapshot
): VisualMotionBindingResult {
  const fromNodes = from.nodes.filter((node) => node.kind !== "group");
  const toNodes = to.nodes.filter((node) => node.kind !== "group");
  const toCandidates = new Set(toNodes.map((node) => node.nodeId));
  const assets = new Map([...from.assets, ...to.assets].map((asset) => [asset.id, asset]));
  const bindings: VisualMotionBinding[] = [];
  const ignored: NonNullable<VisualMotionBindingResult["ignored"]> = [];
  const unresolved: VisualMotionBindingResult["unresolved"] = [];

  for (const fromNode of fromNodes) {
    let best: { node: ZeroVisualNode; score: number; reasons: string[] } | undefined;
    for (const toNode of toNodes) {
      if (!toCandidates.has(toNode.nodeId)) continue;
      const next = scorePair(fromNode, toNode);
      if (!best || next.score > best.score) {
        best = { node: toNode, score: next.score, reasons: next.reasons };
      }
    }

    if (!best || best.score < MIN_CONFIDENCE) {
      if (isCollapsedStatusFragment(fromNode, fromNodes, toNodes)) {
        ignored.push({
          nodeId: fromNode.nodeId,
          reason: "collapsed-status-fragment"
        });
        continue;
      }
      const unresolvedItem: VisualMotionBindingResult["unresolved"][number] = {
        fromNodeId: fromNode.nodeId,
        reason: best ? `low confidence ${Math.round(best.score)}` : "no candidate"
      };
      if (best) unresolvedItem.toNodeId = best.node.nodeId;
      unresolved.push(unresolvedItem);
      continue;
    }

    toCandidates.delete(best.node.nodeId);
    bindings.push({
      layerId: layerIdFor(fromNode),
      nodeId: fromNode.nodeId,
      toNodeId: best.node.nodeId,
      source: sourceFor(fromNode, assets),
      fromBounds: fromNode.bounds,
      toBounds: best.node.bounds,
      confidence: Math.round(best.score),
      reasons: best.reasons
    });
  }

  const boundFrom = new Set(bindings.map((binding) => binding.nodeId));
  const ignoredFrom = new Set(ignored.map((item) => item.nodeId));
  return {
    bindings,
    enter: toNodes.filter((node) => toCandidates.has(node.nodeId)),
    exit: fromNodes.filter((node) => !boundFrom.has(node.nodeId) && !ignoredFrom.has(node.nodeId)),
    ignored,
    unresolved
  };
}
