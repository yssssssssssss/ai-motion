import { deriveZeroLayerNodeCandidates } from "./deriveZeroLayerNodeCandidates";
import type { ZeroLayerFramePair, ZeroLayerNodeCandidate, ZeroLayerSnapshot } from "./schema";

function normalizedBaseName(candidate: ZeroLayerNodeCandidate): string {
  return (candidate.baseName ?? candidate.name).trim().toLowerCase();
}

function normalizeStateBaseName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "").replace(/[-_]/g, "");
  const stripped = normalized
    .replace(/(收起|展开|折叠|默认|选中|未选中|已选中|打开|关闭|开启|收缩)(状态|态)?/g, "")
    .replace(/(前|后)(状态|态)/g, "")
    .replace(/状态/g, "");
  return stripped || normalized;
}

function area(candidate: ZeroLayerNodeCandidate): number {
  return candidate.bounds.w * candidate.bounds.h;
}

function strongestCandidate(candidates: ZeroLayerNodeCandidate[]): ZeroLayerNodeCandidate | undefined {
  return [...candidates].sort(
    (left, right) => (left.priority ?? 0) - (right.priority ?? 0) || area(right) - area(left)
  )[0];
}

function groupByBaseName(candidates: ZeroLayerNodeCandidate[]): Map<string, ZeroLayerNodeCandidate[]> {
  const grouped = new Map<string, ZeroLayerNodeCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.role || !candidate.baseName) continue;
    const key = normalizedBaseName(candidate);
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }
  return grouped;
}

function groupByStateBaseName(candidates: ZeroLayerNodeCandidate[]): Map<string, ZeroLayerNodeCandidate[]> {
  const grouped = new Map<string, ZeroLayerNodeCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.role || !candidate.baseName) continue;
    const key = normalizeStateBaseName(candidate.baseName);
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }
  return grouped;
}

function createPair(
  input: {
    fromCandidate: ZeroLayerNodeCandidate;
    toCandidate: ZeroLayerNodeCandidate;
    baseName: string;
    confidence: number;
    reason: string;
  },
  extraReasons: string[] = []
): ZeroLayerFramePair {
  return {
    label:
      input.baseName ||
      input.fromCandidate.baseName ||
      input.toCandidate.baseName ||
      input.fromCandidate.name,
    baseName: input.baseName,
    fromNodeId: input.fromCandidate.nodeId,
    toNodeId: input.toCandidate.nodeId,
    confidence: input.confidence,
    reasons: [input.reason, `${input.fromCandidate.name} -> ${input.toCandidate.name}`, ...extraReasons]
  };
}

export function deriveZeroLayerFramePairs(
  fromSnapshot: ZeroLayerSnapshot,
  toSnapshot: ZeroLayerSnapshot
): ZeroLayerFramePair[] {
  const fromCandidates = deriveZeroLayerNodeCandidates(fromSnapshot).filter(
    (candidate) => candidate.role === "from"
  );
  const toCandidates = deriveZeroLayerNodeCandidates(toSnapshot).filter(
    (candidate) => candidate.role === "to"
  );
  const fromGroups = groupByBaseName(fromCandidates);
  const toGroups = groupByBaseName(toCandidates);
  const pairs: ZeroLayerFramePair[] = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();

  for (const [baseName, fromGroup] of fromGroups) {
    const toGroup = toGroups.get(baseName);
    if (!toGroup?.length) continue;
    const fromCandidate = strongestCandidate(fromGroup);
    const toCandidate = strongestCandidate(toGroup);
    if (!fromCandidate || !toCandidate) continue;
    const duplicatePenalty = fromGroup.length > 1 || toGroup.length > 1 ? 16 : 0;
    pairs.push(
      createPair(
        {
          fromCandidate,
          toCandidate,
          baseName: fromCandidate.baseName ?? toCandidate.baseName ?? baseName,
          confidence: Math.max(60, 96 - duplicatePenalty),
          reason: "命名协议匹配"
        },
        duplicatePenalty ? ["存在同名候选，已按优先级和面积选择"] : []
      )
    );
    usedFrom.add(fromCandidate.nodeId);
    usedTo.add(toCandidate.nodeId);
  }

  const looseFromGroups = groupByStateBaseName(
    fromCandidates.filter((candidate) => !usedFrom.has(candidate.nodeId))
  );
  const looseToGroups = groupByStateBaseName(
    toCandidates.filter((candidate) => !usedTo.has(candidate.nodeId))
  );
  for (const [baseName, fromGroup] of looseFromGroups) {
    if (!baseName || baseName.length < 2) continue;
    const toGroup = looseToGroups.get(baseName);
    if (!toGroup?.length) continue;
    const fromCandidate = strongestCandidate(fromGroup);
    const toCandidate = strongestCandidate(toGroup);
    if (!fromCandidate || !toCandidate) continue;
    pairs.push(
      createPair({
        fromCandidate,
        toCandidate,
        baseName,
        confidence: 84,
        reason: "状态词归一化匹配"
      })
    );
    usedFrom.add(fromCandidate.nodeId);
    usedTo.add(toCandidate.nodeId);
  }

  const remainingFrom = fromCandidates.filter((candidate) => !usedFrom.has(candidate.nodeId));
  const remainingTo = toCandidates.filter((candidate) => !usedTo.has(candidate.nodeId));
  if (remainingFrom.length === 1 && remainingTo.length === 1) {
    const fromCandidate = remainingFrom[0]!;
    const toCandidate = remainingTo[0]!;
    pairs.push(
      createPair({
        fromCandidate,
        toCandidate,
        baseName: fromCandidate.baseName ?? toCandidate.baseName ?? "唯一首尾帧",
        confidence: 78,
        reason: "唯一首尾帧兜底匹配"
      })
    );
  }

  return pairs.sort(
    (left, right) => right.confidence - left.confidence || left.label.localeCompare(right.label)
  );
}
