import type { Bounds } from "../frameMorph/schema";
import type { ZeroLayerNode, ZeroLayerObject, ZeroLayerSnapshot } from "./schema";

function unionBounds(nodes: ZeroLayerNode[]): Bounds {
  const left = Math.min(...nodes.map((node) => node.bounds.x));
  const top = Math.min(...nodes.map((node) => node.bounds.y));
  const right = Math.max(...nodes.map((node) => node.bounds.x + node.bounds.w));
  const bottom = Math.max(...nodes.map((node) => node.bounds.y + node.bounds.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function solidFill(node: ZeroLayerNode): string | undefined {
  const fill = node.fills?.find((item) => item.type === "solid");
  return fill?.type === "solid" ? fill.color.toLowerCase() : undefined;
}

function childrenOf(snapshot: ZeroLayerSnapshot, node: ZeroLayerNode): ZeroLayerNode[] {
  const byId = new Map(snapshot.layers.map((layer) => [layer.nodeId, layer]));
  return (node.children ?? [])
    .map((nodeId) => byId.get(nodeId))
    .filter((child): child is ZeroLayerNode => Boolean(child));
}

function objectFromNode(
  snapshot: ZeroLayerSnapshot,
  node: ZeroLayerNode,
  index: number
): ZeroLayerObject | undefined {
  const directChildren = childrenOf(snapshot, node);
  const groupNodes = node.kind === "group" || node.kind === "frame" ? directChildren : [node];
  const rounded = groupNodes.find(
    (child) => child.kind === "rect" && child.cornerRadius != null && child.cornerRadius > 0
  );
  if (!rounded) return undefined;
  const roundedCornerRadius = rounded.cornerRadius ?? 0;

  const textChildren = groupNodes.filter((child) => child.kind === "text");
  const hasMarker = groupNodes.some((child) => child.kind === "ellipse" || child.kind === "vector");
  const nodeIds =
    node.kind === "group" || node.kind === "frame"
      ? [node.nodeId, ...groupNodes.map((child) => child.nodeId)]
      : [node.nodeId];
  const bounds = unionBounds(groupNodes.length > 0 ? groupNodes : [node]);
  const name = textChildren.map((child) => child.text?.trim()).find(Boolean) ?? node.name;
  const fill = solidFill(rounded);

  if (fill === "#000000" && textChildren.length > 0) {
    return {
      id: `${snapshot.nodeId}:button:${index}`,
      kind: "button",
      name,
      nodeIds,
      bounds,
      confidence: 88
    };
  }

  const looksLikeStandalonePill =
    node.kind === "rect" &&
    (node.name.includes("胶囊") ||
      roundedCornerRadius >= rounded.bounds.h / 2 ||
      rounded.bounds.w / Math.max(1, rounded.bounds.h) >= 3);
  if (roundedCornerRadius >= Math.min(rounded.bounds.h / 2, 12) || hasMarker || textChildren.length > 0) {
    if (node.kind === "rect" && !looksLikeStandalonePill) return undefined;
    return {
      id: `${snapshot.nodeId}:status-pill:${index}`,
      kind: "status-pill",
      name: node.name.includes("矩形") ? "状态胶囊" : node.name,
      nodeIds: node.kind === "rect" ? [node.nodeId] : nodeIds,
      bounds,
      confidence: node.kind === "rect" ? 72 : 84
    };
  }

  return undefined;
}

export function deriveZeroLayerObjects(snapshot: ZeroLayerSnapshot): ZeroLayerObject[] {
  const objects: ZeroLayerObject[] = [];
  const root = snapshot.layers.find((layer) => layer.nodeId === snapshot.nodeId);
  if (root) {
    objects.push({
      id: `${snapshot.nodeId}:container:root`,
      kind: "container",
      name: root.name,
      nodeIds: [root.nodeId],
      bounds: root.bounds,
      confidence: 100
    });
  }

  snapshot.layers.forEach((node, index) => {
    if (!node.visible || node.nodeId === snapshot.nodeId) return;
    const object = objectFromNode(snapshot, node, index);
    if (object) objects.push(object);
  });

  return objects;
}
