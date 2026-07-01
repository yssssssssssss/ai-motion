import type { FrameElement, FrameElementMatch, FrameElementMatchResult, FrameSnapshot } from "./schema";

const minConfidence = 45;

function textKey(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function nameKey(value: string): string {
  return value.trim().toLowerCase();
}

function centerDistance(left: FrameElement, right: FrameElement): number {
  const leftX = left.x + left.w / 2;
  const leftY = left.y + left.h / 2;
  const rightX = right.x + right.w / 2;
  const rightY = right.y + right.h / 2;
  return Math.hypot(leftX - rightX, leftY - rightY);
}

function sizeSimilarity(left: FrameElement, right: FrameElement): number {
  const widthBase = Math.max(left.w, right.w, 1);
  const heightBase = Math.max(left.h, right.h, 1);
  const widthScore = 1 - Math.min(1, Math.abs(left.w - right.w) / widthBase);
  const heightScore = 1 - Math.min(1, Math.abs(left.h - right.h) / heightBase);
  return (widthScore + heightScore) / 2;
}

function proximityScore(
  left: FrameElement,
  right: FrameElement,
  frameWidth: number,
  frameHeight: number
): number {
  const diagonal = Math.max(1, Math.hypot(frameWidth, frameHeight));
  return 1 - Math.min(1, centerDistance(left, right) / diagonal);
}

function scorePair(
  from: FrameElement,
  to: FrameElement,
  fromIndex: number,
  toIndex: number,
  frameWidth: number,
  frameHeight: number
): FrameElementMatch | undefined {
  if (from.kind !== to.kind) return undefined;

  let confidence = 0;
  const reasons: string[] = ["kind"];

  if (from.key === to.key) {
    confidence += 70;
    reasons.push("key");
  }

  const fromText = textKey(from.text);
  const toText = textKey(to.text);
  if (fromText && toText && fromText === toText) {
    confidence += 34;
    reasons.push("text");
  }

  if (nameKey(from.name) === nameKey(to.name)) {
    confidence += 12;
    reasons.push("name");
  }

  if (from.parentKey && to.parentKey && from.parentKey === to.parentKey) {
    confidence += 10;
    reasons.push("parent");
  }

  const sizeScore = sizeSimilarity(from, to);
  if (sizeScore > 0.55) {
    confidence += Math.round(sizeScore * 14);
    reasons.push("size");
  }

  const proximity = proximityScore(from, to, frameWidth, frameHeight);
  if (proximity > 0.55) {
    confidence += Math.round(proximity * 14);
    reasons.push("bounds");
  }

  const orderDelta = Math.abs(fromIndex - toIndex);
  if (orderDelta <= 2) {
    confidence += 6 - orderDelta * 2;
    reasons.push("order");
  }

  if (confidence <= 0) return undefined;
  return {
    fromKey: from.key,
    toKey: to.key,
    confidence: Math.min(100, confidence),
    reasons
  };
}

export function matchFrameElements(from: FrameSnapshot, to: FrameSnapshot): FrameElementMatchResult {
  const candidates: FrameElementMatch[] = [];

  from.elements.forEach((fromElement, fromIndex) => {
    to.elements.forEach((toElement, toIndex) => {
      const candidate = scorePair(
        fromElement,
        toElement,
        fromIndex,
        toIndex,
        Math.max(from.width, to.width),
        Math.max(from.height, to.height)
      );
      if (candidate) candidates.push(candidate);
    });
  });

  candidates.sort((left, right) => right.confidence - left.confidence);

  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();
  const matches: FrameElementMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.confidence < minConfidence) continue;
    if (usedFrom.has(candidate.fromKey) || usedTo.has(candidate.toKey)) continue;
    usedFrom.add(candidate.fromKey);
    usedTo.add(candidate.toKey);
    matches.push(candidate);
  }

  const enter = to.elements.filter((element) => !usedTo.has(element.key)).map((element) => element.key);
  const exit = from.elements.filter((element) => !usedFrom.has(element.key)).map((element) => element.key);

  const unresolved: FrameElementMatchResult["unresolved"] = [];
  for (const candidate of candidates) {
    if (candidate.confidence >= minConfidence) continue;
    if (!usedFrom.has(candidate.fromKey) && !usedTo.has(candidate.toKey)) {
      unresolved.push({
        fromKey: candidate.fromKey,
        toKey: candidate.toKey,
        reason: `low-confidence:${candidate.confidence}`
      });
    }
  }

  return { matches, enter, exit, unresolved };
}
