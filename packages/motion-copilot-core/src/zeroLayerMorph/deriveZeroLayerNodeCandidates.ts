import type { ZeroLayerKind, ZeroLayerNode, ZeroLayerNodeCandidate, ZeroLayerSnapshot } from "./schema";

export type ZeroLayerFrameRole = "from" | "to";

type FrameRoleSuffix = {
  suffix: string;
  role: ZeroLayerFrameRole;
};

export const zeroLayerFrameRoleSuffixes: FrameRoleSuffix[] = [
  { suffix: "-首帧", role: "from" },
  { suffix: "-尾帧", role: "to" }
];

export type ZeroLayerFrameRoleParseResult = {
  role: ZeroLayerFrameRole;
  baseName: string;
  suffix: string;
};

function candidateLabel(node: ZeroLayerNode): string {
  const text = node.text?.trim();
  return text ? `${node.name} · ${text}` : node.name;
}

function normalizeBaseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function parseZeroLayerFrameRole(name: string): ZeroLayerFrameRoleParseResult | undefined {
  const trimmed = name.trim();
  for (const item of zeroLayerFrameRoleSuffixes) {
    if (!trimmed.toLowerCase().endsWith(item.suffix.toLowerCase())) continue;
    const baseName = normalizeBaseName(trimmed.slice(0, -item.suffix.length));
    if (!baseName) return undefined;
    return { role: item.role, baseName, suffix: item.suffix };
  }
  return undefined;
}

function nodePath(node: ZeroLayerNode, nodeById: Map<string, ZeroLayerNode>, snapshotName: string): string[] {
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

function kindPriority(kind: ZeroLayerKind): number {
  if (kind === "frame") return 0;
  if (kind === "group" || kind === "component" || kind === "instance") return 1;
  if (kind === "rect" || kind === "image") return 2;
  if (kind === "text" || kind === "vector" || kind === "ellipse") return 4;
  return 3;
}

function candidatePriority(node: ZeroLayerNode, rootNodeId: string): number {
  if (node.nodeId === rootNodeId) return -100;
  const role = parseZeroLayerFrameRole(node.name);
  return (role ? -20 : 0) + kindPriority(node.kind);
}

export function deriveZeroLayerNodeCandidates(snapshot: ZeroLayerSnapshot): ZeroLayerNodeCandidate[] {
  const nodeById = new Map(snapshot.layers.map((node) => [node.nodeId, node]));

  return snapshot.layers
    .filter(isSelectableNode)
    .map((node) => ({
      ...(() => {
        const frameRole = parseZeroLayerFrameRole(node.name);
        return {
          nodeId: node.nodeId,
          name: candidateLabel(node),
          kind: node.kind,
          bounds: node.bounds,
          ...(frameRole ? { role: frameRole.role, baseName: frameRole.baseName } : {}),
          priority: candidatePriority(node, snapshot.nodeId),
          path: nodePath(node, nodeById, snapshot.name)
        };
      })()
    }))
    .sort((a, b) => {
      return (
        (a.priority ?? 0) - (b.priority ?? 0) ||
        a.bounds.y - b.bounds.y ||
        a.bounds.x - b.bounds.x ||
        a.name.localeCompare(b.name)
      );
    });
}
