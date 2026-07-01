import { createClassicEasing, type EasingSpec } from "../schema/document";
import { matchFrameElements } from "./matchElements";
import type {
  FrameElement,
  FrameElementMatchResult,
  FrameSnapshot,
  MorphPlan,
  MorphState,
  MorphTrack
} from "./schema";

export type CompileMorphPlanInput = {
  from: FrameSnapshot;
  to: FrameSnapshot;
  durationMs?: number;
  easing?: EasingSpec;
  matches?: FrameElementMatchResult;
};

function stateForElement(element: FrameElement): MorphState {
  return {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    opacity: element.opacity,
    ...(typeof element.style?.radius === "number" ? { radius: element.style.radius } : {}),
    ...(element.style?.background ? { background: element.style.background } : {}),
    ...(element.style?.color ? { color: element.style.color } : {}),
    ...(element.text ? { text: element.text } : {}),
    ...(element.assetUrl ? { assetUrl: element.assetUrl } : {}),
    ...(element.style?.borderColor ? { borderColor: element.style.borderColor } : {}),
    ...(typeof element.style?.borderWidth === "number" ? { borderWidth: element.style.borderWidth } : {}),
    ...(element.style?.boxShadow ? { boxShadow: element.style.boxShadow } : {}),
    ...(typeof element.style?.fontSize === "number" ? { fontSize: element.style.fontSize } : {}),
    ...(typeof element.style?.fontWeight === "number" ? { fontWeight: element.style.fontWeight } : {}),
    ...(element.style?.fontFamily ? { fontFamily: element.style.fontFamily } : {}),
    ...(typeof element.style?.lineHeight === "number" ? { lineHeight: element.style.lineHeight } : {}),
    ...(element.style?.textDecoration ? { textDecoration: element.style.textDecoration } : {})
  };
}

function enterFromState(to: MorphState): MorphState {
  return { ...to, y: to.y + Math.min(8, Math.max(2, to.h * 0.25)), opacity: 0 };
}

function exitToState(from: MorphState): MorphState {
  const insetX = from.w * 0.025;
  const insetY = from.h * 0.025;
  return {
    ...from,
    x: from.x + insetX,
    y: from.y + insetY,
    w: Math.max(0, from.w - insetX * 2),
    h: Math.max(0, from.h - insetY * 2),
    opacity: 0
  };
}

function trackId(role: MorphTrack["role"], key: string): string {
  return `${role}:${key}`;
}

export function compileMorphPlan(input: CompileMorphPlanInput): MorphPlan {
  const matches = input.matches ?? matchFrameElements(input.from, input.to);
  const fromByKey = new Map(input.from.elements.map((element) => [element.key, element]));
  const toByKey = new Map(input.to.elements.map((element) => [element.key, element]));
  const tracks: MorphTrack[] = [];

  for (const match of matches.matches) {
    const fromElement = fromByKey.get(match.fromKey);
    const toElement = toByKey.get(match.toKey);
    if (!fromElement || !toElement) continue;
    tracks.push({
      id: trackId("matched", `${match.fromKey}->${match.toKey}`),
      role: "matched",
      from: stateForElement(fromElement),
      to: stateForElement(toElement)
    });
  }

  for (const key of matches.enter) {
    const element = toByKey.get(key);
    if (!element) continue;
    const to = stateForElement(element);
    tracks.push({ id: trackId("enter", key), role: "enter", from: enterFromState(to), to });
  }

  for (const key of matches.exit) {
    const element = fromByKey.get(key);
    if (!element) continue;
    const from = stateForElement(element);
    tracks.push({ id: trackId("exit", key), role: "exit", from, to: exitToState(from) });
  }

  return {
    schemaVersion: "motion-copilot.frame-morph.v1",
    fromFrameId: input.from.frameId,
    toFrameId: input.to.frameId,
    durationMs: Math.max(1, Math.round(input.durationMs ?? 320)),
    easing: input.easing ?? createClassicEasing("decelerate"),
    tracks,
    issues: [
      ...matches.unresolved.map((item, index) => ({
        id: `unresolved-${index + 1}`,
        severity: "suggestion" as const,
        title: "低置信度配对",
        reason: item.reason,
        ...(item.fromKey ? { elementKey: item.fromKey } : item.toKey ? { elementKey: item.toKey } : {})
      }))
    ]
  };
}
