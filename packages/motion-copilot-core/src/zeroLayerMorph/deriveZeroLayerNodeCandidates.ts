import type { ZeroLayerNode, ZeroLayerNodeCandidate, ZeroLayerSnapshot } from "./schema";

function candidateLabel(node: ZeroLayerNode): string {
  const text = node.text?.trim();
  return text ? `${node.name} · ${text}` : node.name;
}

function nodePath(
  node: ZeroLayerNode,
  nodeById: Map<string, ZeroLayerNode>,
  snapshotName: string
): string[] {
  const path: string[] = [candidateLabel(node)];
  const seen = new Set<string>([node.nodeId]);
  let current = node.parentId ? nodeById.get(node.parentId) : undefined;

  while (current && !seen.has(current.nodeId)) {
    path.unshift(candidateLabel(current));
    seen.add(current.nodeId);
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }

  if (path[0] !== snapshotName) path.unshift(snapshotName);
  return path;
}

function isSelectableNode(node: ZeroLayerNode): boolean {
  return node.visible && node.opacity > 0 && node.bounds.w > 0 && node.bounds.h > 0;
}

export function deriveZeroLayerNodeCandidates(snapshot: ZeroLayerSnapshot): ZeroLayerNodeCandidate[] {
  const nodeById = new Map(snapshot.layers.map((node) => [node.nodeId, node]));

  return snapshot.layers
    .filter(isSelectableNode)
    .map((node) => ({
      nodeId: node.nodeId,
      name: candidateLabel(node),
      kind: node.kind,
      bounds: node.bounds,
      path: nodePath(node, nodeById, snapshot.name)
    }))
    .sort((a, b) => {
      if (a.nodeId === snapshot.nodeId) return -1;
      if (b.nodeId === snapshot.nodeId) return 1;
      return a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x || a.name.localeCompare(b.name);
    });
}

