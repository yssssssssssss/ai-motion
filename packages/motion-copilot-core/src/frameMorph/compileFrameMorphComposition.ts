import {
  createClassicEasing,
  createSpringEasing,
  type CompositionStep,
  type EasingSpec,
  type MotionDocument,
  type MotionLayer,
  type MotionLayerKind,
  type MotionState
} from "../schema/document";
import { evaluateComposition } from "../composition/evaluateComposition";
import { matchFrameElements } from "./matchElements";
import type { FrameElement, FrameElementMatchResult, FrameSnapshot, MorphIssue } from "./schema";

export type FrameMorphCompositionIntent = {
  durationMs: number;
  easing: EasingSpec;
  staggerMs: number;
  summary: string;
};

export type FrameMorphCompositionResult = {
  document: MotionDocument;
  steps: CompositionStep[];
  issues: MorphIssue[];
  intent: FrameMorphCompositionIntent;
  matches: FrameElementMatchResult;
};

export type CompileFrameMorphCompositionInput = {
  from: FrameSnapshot;
  to: FrameSnapshot;
  prompt: string;
  matches?: FrameElementMatchResult;
};

const frameMorphPresetId = "frame-morph-layout";

function safeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function layerIdFor(key: string): string {
  return `zero-${safeId(key) || "layer"}`;
}

function kindForElement(element: FrameElement): MotionLayerKind {
  if (element.kind === "text") return "text";
  if (element.kind === "image") return "image";
  if (element.kind === "group") return "group";
  return "shape";
}

function readableLayerName(element: FrameElement): string {
  if (element.text?.trim()) return element.text.trim();
  const key = element.key.toLowerCase();
  if (key.includes("continue-assign-bg")) return "继续指派按钮背景";
  if (key.includes("assign-bg")) return "指派区域背景";
  if (key.includes("status-pill")) return "状态胶囊背景";
  if (key.includes("generate-prd-bg")) return "生成PRD按钮背景";
  if (key.includes("invite-architect-bg")) return "邀请主架构按钮背景";
  if (key.includes("status-pending-dot")) return "待确认圆点";
  if (key.includes("status-accepted-dot")) return "已接受圆点";
  if (key.includes("status-rejected-dot")) return "已拒绝圆点";
  return element.name;
}

function fallbackStyleForElement(
  element: FrameElement,
  options: { preserveVectorBackgroundFallback: boolean }
): NonNullable<MotionLayer["style"]> {
  const style: NonNullable<MotionLayer["style"]> = {
    ...(element.style?.background ? { background: element.style.background } : {}),
    ...(element.style?.color ? { color: element.style.color } : {}),
    ...(element.style?.borderColor ? { borderColor: element.style.borderColor } : {}),
    ...(element.style?.boxShadow ? { boxShadow: element.style.boxShadow } : {}),
    ...(element.style?.fontFamily ? { fontFamily: element.style.fontFamily } : {}),
    ...(element.style?.textDecoration ? { textDecoration: element.style.textDecoration } : {}),
    ...(typeof element.style?.radius === "number" ? { radius: element.style.radius } : {}),
    ...(typeof element.style?.borderWidth === "number" ? { borderWidth: element.style.borderWidth } : {}),
    ...(typeof element.style?.fontSize === "number" ? { fontSize: element.style.fontSize } : {}),
    ...(typeof element.style?.fontWeight === "number" ? { fontWeight: element.style.fontWeight } : {}),
    ...(typeof element.style?.lineHeight === "number" ? { lineHeight: element.style.lineHeight } : {}),
    opacity: element.opacity,
    ...(element.kind === "image" ? { fit: "fill" as const, position: "center" as const } : {})
  };

  if (element.kind === "vector" && !style.background) {
    if (element.key.includes("status-pending-dot")) style.background = "#cdab18";
    else if (element.key.includes("status-accepted-dot")) style.background = "#09ae28";
    else if (element.key.includes("status-rejected-dot")) style.background = "#ff3434";
    else if (options.preserveVectorBackgroundFallback && element.key.endsWith("-bg")) {
      style.background = "#ffffff";
    }
  }
  if (options.preserveVectorBackgroundFallback && element.kind === "vector" && element.key.endsWith("-bg")) {
    if (typeof style.radius !== "number") style.radius = Math.round(element.h / 2);
    if (!style.boxShadow) style.boxShadow = "0 2px 8px rgba(20, 30, 44, 0.14)";
  }
  if (element.kind === "vector" && element.name.includes("圆形") && typeof style.radius !== "number") {
    style.radius = 999;
  }

  return style;
}

function isRenderableElement(element: FrameElement): boolean {
  if (element.kind === "group") {
    return Boolean(
      element.text ||
        element.assetUrl ||
        element.style?.background ||
        element.style?.borderColor ||
        element.style?.boxShadow
    );
  }
  return true;
}

function layerForElement(
  element: FrameElement,
  options: { opacity?: number; preserveVectorBackgroundFallback: boolean }
): MotionLayer {
  const style = fallbackStyleForElement(element, {
    preserveVectorBackgroundFallback: options.preserveVectorBackgroundFallback
  });
  return {
    id: layerIdFor(element.key),
    name: readableLayerName(element),
    kind: kindForElement(element),
    editable: true,
    ...(element.parentKey ? { parentId: layerIdFor(element.parentKey) } : {}),
    content: {
      ...(element.text ? { text: element.text } : {}),
      ...(element.assetUrl ? { src: element.assetUrl, alt: element.name } : {})
    },
    style: { ...style, opacity: options.opacity ?? element.opacity },
    layout: {
      x: element.x,
      y: element.y,
      width: element.w,
      height: element.h,
      zIndex: element.zIndex
    }
  };
}

function intentFromPrompt(prompt: string): FrameMorphCompositionIntent {
  const text = prompt.trim().toLowerCase();
  const slow = /慢|柔和|丝滑|smooth|slow/.test(text);
  const fast = /快|快速|利落|sharp|fast/.test(text);
  const spring = /弹|弹跳|回弹|spring|bounce|q弹/.test(text);
  const stagger = /错峰|依次|逐个|先后|stagger|sequence/.test(text);

  const durationMs = fast ? 180 : slow ? 420 : spring ? 360 : 320;
  const easing = spring
    ? createSpringEasing({ stiffness: 240, damping: /弹跳|bounce/.test(text) ? 14 : 18 })
    : createClassicEasing(fast ? "sharp" : slow ? "standard" : "decelerate");
  return {
    durationMs,
    easing,
    staggerMs: stagger ? 45 : 0,
    summary: `${spring ? "弹性" : fast ? "快速" : slow ? "丝滑" : "减速"}帧间过渡${stagger ? "，元素错峰进入" : "，元素同步变化"}`
  };
}

function baseState(): MotionState {
  return { x: 0, y: 0, width: 0, height: 0, scale: 1, opacity: 1, blur: 0, rotate: 0 };
}

function matchedStep(
  from: FrameElement,
  to: FrameElement,
  intent: FrameMorphCompositionIntent,
  index: number
): CompositionStep {
  return {
    id: `frame-morph-${index}-${safeId(from.key)}-${safeId(to.key)}`,
    presetId: frameMorphPresetId,
    label: "帧间形变",
    target: "selected-layer",
    layerId: layerIdFor(from.key),
    layerName: from.name,
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: 0,
    durationMs: intent.durationMs,
    slot: "trajectory",
    initial: { ...baseState(), width: from.w, height: from.h, opacity: from.opacity },
    animate: {
      x: to.x - from.x,
      y: to.y - from.y,
      width: to.w,
      height: to.h,
      scale: 1,
      opacity: to.opacity,
      blur: 0,
      rotate: 0
    },
    easing: intent.easing,
    fillMode: "both"
  };
}

function enterStep(
  element: FrameElement,
  intent: FrameMorphCompositionIntent,
  index: number,
  enterIndex: number
): CompositionStep {
  return {
    id: `frame-enter-${index}-${safeId(element.key)}`,
    presetId: frameMorphPresetId,
    label: "帧间进入",
    target: "selected-layer",
    layerId: layerIdFor(element.key),
    layerName: element.name,
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: intent.staggerMs ? (enterIndex === 0 ? 80 : intent.staggerMs) : 0,
    durationMs: intent.durationMs,
    slot: "trajectory",
    initial: {
      ...baseState(),
      y: Math.min(8, Math.max(2, element.h * 0.25)),
      width: element.w,
      height: element.h,
      opacity: 0
    },
    animate: { ...baseState(), width: element.w, height: element.h, opacity: element.opacity },
    easing: intent.easing,
    fillMode: "both"
  };
}

function exitStep(
  element: FrameElement,
  intent: FrameMorphCompositionIntent,
  index: number
): CompositionStep {
  return {
    id: `frame-exit-${index}-${safeId(element.key)}`,
    presetId: frameMorphPresetId,
    label: "帧间退出",
    target: "selected-layer",
    layerId: layerIdFor(element.key),
    layerName: element.name,
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: 0,
    durationMs: Math.max(80, Math.round(intent.durationMs * 0.7)),
    slot: "trajectory",
    initial: { ...baseState(), width: element.w, height: element.h, opacity: element.opacity },
    animate: { ...baseState(), width: element.w, height: element.h, scale: 0.98, opacity: 0 },
    easing: createClassicEasing("accelerate"),
    fillMode: "both"
  };
}

function unresolvedIssues(matches: FrameElementMatchResult): MorphIssue[] {
  return matches.unresolved.map((item, index) => ({
    id: `unresolved-${index + 1}`,
    severity: "suggestion",
    title: "低置信度配对",
    reason: item.reason,
    ...(item.fromKey ? { elementKey: item.fromKey } : item.toKey ? { elementKey: item.toKey } : {})
  }));
}

export function compileFrameMorphComposition(
  input: CompileFrameMorphCompositionInput
): FrameMorphCompositionResult {
  const intent = intentFromPrompt(input.prompt);
  const matches = input.matches ?? matchFrameElements(input.from, input.to);
  const fromByKey = new Map(input.from.elements.map((element) => [element.key, element]));
  const toByKey = new Map(input.to.elements.map((element) => [element.key, element]));
  const layers: MotionLayer[] = [];
  const steps: CompositionStep[] = [];

  for (const match of matches.matches) {
    const from = fromByKey.get(match.fromKey);
    const to = toByKey.get(match.toKey);
    if (!from || !to) continue;
    if (!isRenderableElement(from) || !isRenderableElement(to)) continue;
    layers.push(layerForElement(from, { preserveVectorBackgroundFallback: true }));
    steps.push(matchedStep(from, to, intent, steps.length));
  }

  for (const key of matches.exit) {
    const element = fromByKey.get(key);
    if (!element) continue;
    if (!isRenderableElement(element)) continue;
    layers.push(layerForElement(element, { preserveVectorBackgroundFallback: true }));
    steps.push(exitStep(element, intent, steps.length));
  }

  for (const [enterIndex, key] of matches.enter.entries()) {
    const element = toByKey.get(key);
    if (!element) continue;
    if (!isRenderableElement(element)) continue;
    layers.push(
      layerForElement(element, {
        opacity: 0,
        preserveVectorBackgroundFallback: true
      })
    );
    steps.push(enterStep(element, intent, steps.length, enterIndex));
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
    layers: layers.sort((left, right) => (left.layout?.zIndex ?? 0) - (right.layout?.zIndex ?? 0)),
    appliedPresets: [],
    presetResolutions: [],
    timeline: {
      trigger: "load",
      direction: "move-inside",
      durationMs: composition.totalDurationMs || intent.durationMs,
      delayMs: 0,
      easing: intent.easing,
      repeat: "none"
    },
    guidelineSuggestions: [],
    composition
  };

  return {
    document,
    steps,
    issues: unresolvedIssues(matches),
    intent,
    matches
  };
}
