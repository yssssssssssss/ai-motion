import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  appMotionPresets,
  applyDocumentPatch,
  applyAppMotionPreset,
  clampProgress,
  computeCompositionStepWindows,
  compileIntent,
  createClassicEasing,
  createDefaultDocument,
  createSpringEasing,
  easedProgress,
  evaluateComposition,
  evaluateGuidelines,
  exportCompositionHtml,
  exportHtmlCss,
  exportStandaloneHtml,
  layerById,
  primaryElement,
  selectedLayer,
  type AppMotionPresetTarget,
  type AppMotionPresetDefinition,
  type AppMotionPresetId,
  type ClassicEasingPreset,
  type CompositionStep,
  type CompositionTrack,
  type EasingSpec,
  type GuidelineSuggestion,
  type ImageFit,
  type ImagePosition,
  type LayerMotionPreset,
  type MotionDocument,
  type MotionDocumentPatch,
  type MotionLayer,
  type MotionLayerKind,
  type MotionSize,
  type MotionState,
  type SuggestionStatus
} from "@motion-copilot/core";

const defaultPrompt = "做一个中型弹窗，弹性一点出现";
const loopIntervalMs = 500;
const workspaceStorageKey = "motion-copilot-workspace";
const projectSchemaVersion = "0.2";
const sizes: Array<{ value: MotionSize; label: string }> = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" }
];
const easingOptions: Array<{ value: ClassicEasingPreset | "spring"; label: string }> = [
  { value: "decelerate", label: "减速" },
  { value: "accelerate", label: "加速" },
  { value: "standard", label: "标准" },
  { value: "sharp", label: "利落" },
  { value: "spring", label: "弹性" }
];
type MotionStateField = keyof MotionState;
type CompositionStepPatch = Partial<
  Pick<CompositionStep, "delayMs" | "durationMs" | "timing" | "initial" | "animate" | "easing">
>;
type LayerLayoutPatch = Partial<NonNullable<MotionLayer["layout"]>>;
type CompositionLaneTarget = Pick<CompositionStep, "target" | "layerId" | "layerName">;
type CompositionLaneDropTarget = CompositionLaneTarget & { startMs?: number };
type PresetLibraryTabId = "recommended" | "combo" | AppMotionPresetDefinition["scene"];
type CompositionPresetCombo = {
  id: string;
  label: string;
  summary: string;
  presetIds: AppMotionPresetId[];
};
type SavedWorkspace = {
  schemaVersion?: string;
  document: MotionDocument;
  compositionSteps?: CompositionStep[];
  hasStarted?: boolean;
  prompt?: string;
  presetTarget?: AppMotionPresetTarget;
};
type SupportedCreateLayerKind = Extract<MotionLayerKind, "text" | "image">;
type ImageDimensions = { width: number; height: number };
type LayerLayout = NonNullable<MotionLayer["layout"]>;
const compositionMotionFields: Array<{
  field: MotionStateField;
  label: string;
  step: string;
  min?: number;
  max?: number;
}> = [
  { field: "x", label: "X", step: "1" },
  { field: "y", label: "Y", step: "1" },
  { field: "scale", label: "缩放", step: "0.01", min: 0 },
  { field: "opacity", label: "透明度", step: "0.05", min: 0, max: 1 },
  { field: "blur", label: "模糊", step: "1", min: 0 },
  { field: "rotate", label: "旋转", step: "1" }
];
const baseMotionState: Required<MotionState> = {
  x: 0,
  y: 0,
  scale: 1,
  opacity: 1,
  blur: 0,
  rotate: 0
};
const styleTokens: Array<{ label: string; description: string; patch: MotionDocumentPatch }> = [
  {
    label: "克制",
    description: "标准曲线 · 220ms · 微小位移(10px) · 适合工具类/信息密集场景",
    patch: {
      element: {
        initial: { y: 10, scale: 0.98, opacity: 0, blur: 0 },
        animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
      },
      timeline: { durationMs: 220, easing: createClassicEasing("standard") }
    }
  },
  {
    label: "快速",
    description: "利落曲线 · 160ms · 干脆到位 · 适合操作反馈/微交互",
    patch: { timeline: { durationMs: 160, easing: createClassicEasing("sharp") } }
  },
  {
    label: "Q弹",
    description: "弹簧缓动 · 280ms · 回弹感 · 适合卡片/弹窗/情感化场景",
    patch: {
      element: { initial: { y: 16, scale: 0.94, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { durationMs: 280, easing: createSpringEasing() }
    }
  },
  {
    label: "丝滑",
    description: "减速曲线 · 260ms · 柔和渐入 · 适合内容展示/阅读场景",
    patch: {
      element: { initial: { y: 14, scale: 0.98, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { durationMs: 260, easing: createClassicEasing("decelerate") }
    }
  },
  {
    label: "强表现",
    description: "高弹簧 · 340ms · 大位移+模糊 · 适合品牌展示/首屏动效",
    patch: {
      element: {
        initial: { y: 32, scale: 0.92, opacity: 0, blur: 2 },
        animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
      },
      timeline: { durationMs: 340, easing: createSpringEasing({ stiffness: 260, damping: 16 }) }
    }
  }
];
const appMotionSceneLabels: Record<AppMotionPresetDefinition["scene"], string> = {
  "page-transition": "页面转场",
  "navigation-push": "前后导航",
  "navigation-pop": "临时退场",
  "tab-switch": "横向切换",
  modal: "弹窗反馈",
  "toast-feedback": "轻提示",
  "button-feedback": "按钮反馈",
  "skeleton-loading": "骨架屏",
  "list-sequence": "出现时序",
  "bottom-sheet": "底部面板",
  "pull-refresh": "下拉刷新",
  "search-expand": "搜索展开",
  "card-expand": "卡片展开",
  "micro-feedback": "微反馈",
  "form-feedback": "表单反馈",
  "loading-state": "加载状态",
  "empty-state": "空状态",
  overlay: "浮层遮罩"
};
const appMotionPresetGroups: Array<{
  label: string;
  scene: AppMotionPresetDefinition["scene"];
  presetIds: AppMotionPresetId[];
}> = [
  {
    label: "页面转场",
    scene: "page-transition",
    presetIds: ["enter-screen", "exit-final", "container-transform"]
  },
  { label: "导航切换", scene: "navigation-push", presetIds: ["navigation-push", "exit-temporary"] },
  { label: "横向切换", scene: "tab-switch", presetIds: ["move-inside", "horizontal-switch"] },
  { label: "弹窗反馈", scene: "modal", presetIds: ["modal-feedback"] },
  { label: "底部面板", scene: "bottom-sheet", presetIds: ["bottom-sheet-up", "bottom-sheet-down"] },
  { label: "浮层遮罩", scene: "overlay", presetIds: ["overlay-fade-in", "overlay-fade-out"] },
  { label: "卡片展开", scene: "card-expand", presetIds: ["card-expand-detail"] },
  { label: "搜索展开", scene: "search-expand", presetIds: ["search-expand"] },
  { label: "下拉刷新", scene: "pull-refresh", presetIds: ["pull-refresh"] },
  { label: "微反馈", scene: "micro-feedback", presetIds: ["like-bounce"] },
  { label: "表单反馈", scene: "form-feedback", presetIds: ["form-error-shake"] },
  { label: "加载状态", scene: "loading-state", presetIds: ["loading-to-success"] },
  { label: "空状态", scene: "empty-state", presetIds: ["empty-state-appear"] },
  { label: "加载骨架", scene: "skeleton-loading", presetIds: ["skeleton-loading"] },
  { label: "列表时序", scene: "list-sequence", presetIds: ["list-stagger"] }
];
const presetLibraryTabs: Array<{ id: PresetLibraryTabId; label: string }> = [
  { id: "recommended", label: "推荐" },
  { id: "combo", label: "组合" },
  { id: "page-transition", label: "转场" },
  { id: "navigation-push", label: "导航" },
  { id: "tab-switch", label: "横向" },
  { id: "modal", label: "弹窗" },
  { id: "bottom-sheet", label: "底板" },
  { id: "overlay", label: "遮罩" },
  { id: "card-expand", label: "卡片" },
  { id: "micro-feedback", label: "反馈" },
  { id: "loading-state", label: "加载" },
  { id: "skeleton-loading", label: "骨架" },
  { id: "list-sequence", label: "列表" }
];
const appMotionPresetById = new Map(appMotionPresets.map((preset) => [preset.id, preset]));
const compositionPresetCombos: CompositionPresetCombo[] = [
  {
    id: "modal-enter-combo",
    label: "弹窗进场组合",
    summary: "遮罩浮现 + 弹窗反馈，用于移动端弹层打开。",
    presetIds: ["overlay-fade-in", "modal-feedback"]
  },
  {
    id: "bottom-sheet-combo",
    label: "底部面板组合",
    summary: "遮罩浮现 + 面板升起，适合操作面板。",
    presetIds: ["overlay-fade-in", "bottom-sheet-up"]
  },
  {
    id: "tab-switch-combo",
    label: "Tab 切换组合",
    summary: "指示器移动 + 内容横向切换。",
    presetIds: ["move-inside", "horizontal-switch"]
  },
  {
    id: "loading-success-combo",
    label: "加载转成功组合",
    summary: "骨架稳定加载后转为成功反馈。",
    presetIds: ["skeleton-loading", "loading-to-success"]
  }
];
const recommendedPresetIdsByLayerKind: Partial<Record<MotionLayerKind, AppMotionPresetId[]>> = {
  group: ["enter-screen", "container-transform", "move-inside", "overlay-fade-in"],
  image: ["enter-screen", "container-transform", "card-expand-detail", "move-inside"],
  text: ["enter-screen", "list-stagger", "empty-state-appear", "move-inside"],
  button: ["like-bounce", "modal-feedback", "form-error-shake", "loading-to-success"],
  icon: ["like-bounce", "move-inside", "enter-screen", "loading-to-success"],
  shape: ["enter-screen", "container-transform", "move-inside", "overlay-fade-in", "overlay-fade-out"]
};
const fitOptions: Array<{ value: ImageFit; label: string }> = [
  { value: "cover", label: "填充裁切" },
  { value: "contain", label: "完整包含" },
  { value: "fill", label: "拉伸铺满" }
];
const positionOptions: Array<{ value: ImagePosition; label: string }> = [
  { value: "center", label: "居中" },
  { value: "top", label: "顶部" },
  { value: "bottom", label: "底部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" }
];
const stagePresetOptions: Array<{
  value: string;
  label: string;
  stage: Pick<MotionDocument["stage"], "mode" | "width" | "height">;
}> = [
  { value: "iphone-15", label: "iPhone 15 · 393 × 852", stage: { mode: "mobile", width: 393, height: 852 } },
  { value: "iphone-se", label: "iPhone SE · 375 × 667", stage: { mode: "mobile", width: 375, height: 667 } },
  { value: "android-360", label: "Android 360 · 360 × 800", stage: { mode: "mobile", width: 360, height: 800 } },
  { value: "android-412", label: "Android 412 · 412 × 915", stage: { mode: "mobile", width: 412, height: 915 } },
  { value: "iphone-14", label: "iPhone 14 · 390 × 844", stage: { mode: "mobile", width: 390, height: 844 } },
  { value: "web-1440", label: "Web 1440 · 1440 × 900", stage: { mode: "web", width: 1440, height: 900 } }
];
const motionOptions: Array<{ value: LayerMotionPreset; label: string }> = [
  { value: "none", label: "无" },
  { value: "fade", label: "淡入" },
  { value: "lift", label: "上浮" },
  { value: "slide-left", label: "左滑入" },
  { value: "slide-right", label: "右滑入" },
  { value: "zoom", label: "缩放入" }
];

function createBlankDocument(): MotionDocument {
  return withGuidelines(
    applyDocumentPatch(createDefaultDocument("background"), {
      element: {
        initial: { opacity: 0, y: 0, scale: 1, blur: 0 },
        animate: { opacity: 0, y: 0, scale: 1, blur: 0 }
      },
      layer: { id: "bg-layer", hidden: true }
    })
  );
}

function createExampleDocument(): MotionDocument {
  return withGuidelines(
    applyDocumentPatch(createDefaultDocument("modal"), compileIntent({ prompt: defaultPrompt }))
  );
}

function styleForLayer(layer: MotionLayer | undefined): React.CSSProperties {
  return {
    ...(layer?.style?.background ? { backgroundColor: layer.style.background } : {}),
    ...(layer?.style?.color ? { color: layer.style.color } : {}),
    ...(typeof layer?.style?.radius === "number" ? { borderRadius: layer.style.radius } : {}),
    ...(typeof layer?.style?.opacity === "number" ? { opacity: layer.style.opacity } : {}),
    ...(typeof layer?.style?.fontSize === "number" ? { fontSize: layer.style.fontSize } : {}),
    ...(typeof layer?.style?.fontWeight === "number" ? { fontWeight: layer.style.fontWeight } : {}),
    ...(typeof layer?.style?.lineHeight === "number" ? { lineHeight: layer.style.lineHeight } : {}),
    ...(layer?.style?.textAlign ? { textAlign: layer.style.textAlign } : {})
  };
}

function imageStyle(layer: MotionLayer | undefined): React.CSSProperties {
  return {
    objectFit: layer?.style?.fit ?? "cover",
    objectPosition: layer?.style?.position ?? "center"
  };
}

function tokenDescription(token: (typeof styleTokens)[number]): string {
  return token.description;
}

function stageStyle(document: MotionDocument): React.CSSProperties {
  return {
    "--stage-width": document.stage.width,
    "--stage-height": document.stage.height,
    "--stage-ratio": document.stage.width / document.stage.height,
    "--stage-width-px": `${document.stage.width}px`,
    backgroundColor: document.stage.background
  } as React.CSSProperties;
}

function layerMotionClass(layer: MotionLayer): string {
  const preset = layer.motion?.preset;
  return preset && preset !== "none" ? `motion-${preset}` : "";
}

function layerMotionStyle(layer: MotionLayer): React.CSSProperties {
  return layer.motion
    ? {
        animationDuration: `${layer.motion.durationMs}ms`,
        animationDelay: `${layer.motion.delayMs}ms`
      }
    : {};
}

function appliedPresetTargetLabel(preset: MotionDocument["appliedPresets"][number]): string {
  return preset.target === "selected-layer"
    ? `图层：${preset.layerName ?? preset.layerId ?? "未命名"}`
    : "图层：未绑定";
}

function easingValue(easing: EasingSpec): ClassicEasingPreset | "spring" {
  return easing.type === "spring" ? "spring" : easing.preset;
}

function easingFromValue(value: ClassicEasingPreset | "spring"): EasingSpec {
  return value === "spring" ? createSpringEasing() : createClassicEasing(value);
}

/** 贝塞尔控制点映射（用于曲线可视化） */
const easingControlPoints: Record<ClassicEasingPreset | "spring", [number, number, number, number]> = {
  decelerate: [0.18, 0.86, 0.22, 1],
  accelerate: [0.4, 0, 1, 1],
  standard: [0.35, 0, 0.25, 1],
  sharp: [0.25, 0.8, 0.35, 1],
  spring: [0.34, 1.56, 0.64, 1]
};

function EasingCurvePreview({ easing }: { easing: ClassicEasingPreset | "spring" }) {
  const [x1, y1, x2, y2] = easingControlPoints[easing];
  // SVG 坐标系：左下为起点(0,1)，右上为终点(1,0)
  const w = 48;
  const h = 36;
  const pad = 4;
  const sx = (v: number) => pad + v * (w - pad * 2);
  const sy = (v: number) => h - pad - v * (h - pad * 2);

  return (
    <svg className="easing-curve-preview" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path
        d={`M ${sx(0)} ${sy(0)} C ${sx(x1)} ${sy(y1)}, ${sx(x2)} ${sy(y2)}, ${sx(1)} ${sy(1)}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1={sx(0)}
        y1={sy(0)}
        x2={sx(0)}
        y2={sy(1)}
        stroke="var(--hairline)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <line
        x1={sx(0)}
        y1={sy(0)}
        x2={sx(1)}
        y2={sy(0)}
        stroke="var(--hairline)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

function readDataUrl(file: File | undefined): Promise<string | undefined> {
  if (!file) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : undefined);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function readImageDimensions(src: string): Promise<ImageDimensions | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolve(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : undefined
      );
    });
    image.addEventListener("error", () => resolve(undefined));
    image.src = src;
  });
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampLayerLayout(document: MotionDocument, layout: LayerLayout): LayerLayout {
  const width = clampNumber(Math.round(layout.width), 32, document.stage.width);
  const height = clampNumber(Math.round(layout.height), 32, document.stage.height);
  return {
    ...layout,
    x: clampNumber(Math.round(layout.x), 0, Math.max(0, document.stage.width - width)),
    y: clampNumber(Math.round(layout.y), 0, Math.max(0, document.stage.height - height)),
    width,
    height
  };
}

function fitImageLayout(document: MotionDocument, dimensions: ImageDimensions | undefined): LayerLayout {
  const sourceWidth = dimensions?.width ?? 260;
  const sourceHeight = dimensions?.height ?? 180;
  const maxWidth = Math.max(80, Math.round(document.stage.width * 0.72));
  const maxHeight = Math.max(80, Math.round(document.stage.height * 0.46));
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(32, Math.round(sourceWidth * scale));
  const height = Math.max(32, Math.round(sourceHeight * scale));
  return clampLayerLayout(document, {
    x: Math.round((document.stage.width - width) / 2),
    y: Math.round((document.stage.height - height) / 2),
    width,
    height,
    zIndex: Math.max(30, ...document.layers.map((layer) => layer.layout?.zIndex ?? 0)) + 1,
    aspectLocked: true
  });
}

function cloneLayerForCopy(layer: MotionLayer, suffix: string): MotionLayer {
  return {
    ...structuredClone(layer),
    id: `${layer.id}-${suffix}`
  };
}

function shiftedLayerLayout(document: MotionDocument, layout: LayerLayout, offset: number): LayerLayout {
  return clampLayerLayout(document, {
    ...layout,
    x: layout.x + offset,
    y: layout.y + offset,
    zIndex: Math.max(30, ...document.layers.map((item) => item.layout?.zIndex ?? 0)) + 1
  });
}

function readSavedWorkspace(): SavedWorkspace | undefined {
  try {
    const value = globalThis.localStorage?.getItem(workspaceStorageKey);
    if (!value) return undefined;
    const saved = JSON.parse(value) as Partial<SavedWorkspace>;
    if (saved.schemaVersion && saved.schemaVersion !== projectSchemaVersion) return undefined;
    if (saved.document?.version !== "0.1") return undefined;
    return normalizeSavedWorkspace(saved as SavedWorkspace);
  } catch {
    return undefined;
  }
}

function isUnsupportedFreeLayer(layer: MotionLayer): boolean {
  return Boolean(layer.layout && (layer.kind === "shape" || layer.kind === "button"));
}

function normalizeMotionDocument(document: MotionDocument): MotionDocument {
  const layers = document.layers.filter((layer) => !isUnsupportedFreeLayer(layer));
  const selectedLayerId =
    document.selectedLayerId && layers.some((layer) => layer.id === document.selectedLayerId)
      ? document.selectedLayerId
      : layers.find((layer) => layer.editable)?.id;
  const removedLayerIds = new Set(document.layers.filter(isUnsupportedFreeLayer).map((layer) => layer.id));
  const { selectedLayerId: _selectedLayerId, composition, ...rest } = document;
  return {
    ...rest,
    layers,
    ...(selectedLayerId ? { selectedLayerId } : {}),
    ...(composition
      ? {
          composition: {
            ...composition,
            steps: composition.steps.filter((step) => !step.layerId || !removedLayerIds.has(step.layerId))
          }
        }
      : {})
  };
}

function normalizeSavedWorkspace(workspace: SavedWorkspace): SavedWorkspace {
  const document = normalizeMotionDocument(workspace.document);
  const existingLayerIds = new Set(document.layers.map((layer) => layer.id));
  return {
    ...workspace,
    document,
    compositionSteps: (workspace.compositionSteps ?? document.composition?.steps ?? []).filter(
      (step) => !step.layerId || existingLayerIds.has(step.layerId)
    )
  };
}

function orderedEditableLayers(document: MotionDocument): MotionLayer[] {
  return document.layers
    .filter((layer) => layer.editable)
    .sort((left, right) => (left.layout?.zIndex ?? -1) - (right.layout?.zIndex ?? -1));
}

function sampleValue(
  start: number | undefined,
  end: number | undefined,
  progress: number,
  fallback: number
): number {
  const from = typeof start === "number" ? start : fallback;
  const to = typeof end === "number" ? end : fallback;
  return from + (to - from) * progress;
}

function sampleState(initial: MotionState, animate: MotionState, progress: number): Required<MotionState> {
  return {
    x: sampleValue(initial.x, animate.x, progress, 0),
    y: sampleValue(initial.y, animate.y, progress, 0),
    scale: sampleValue(initial.scale, animate.scale, progress, 1),
    opacity: sampleValue(initial.opacity, animate.opacity, progress, 1),
    blur: sampleValue(initial.blur, animate.blur, progress, 0),
    rotate: sampleValue(initial.rotate, animate.rotate, progress, 0)
  };
}

function compositionStepMotion(
  document: MotionDocument,
  step: CompositionStep
): { initial: Required<MotionState>; animate: Required<MotionState>; easing: EasingSpec } | undefined {
  const preset = appMotionPresetById.get(step.presetId as AppMotionPresetId);
  if (!preset) return undefined;
  const patch = preset.apply(document);
  return {
    initial: { ...baseMotionState, ...(patch.element?.initial ?? {}), ...(step.initial ?? {}) },
    animate: { ...baseMotionState, ...(patch.element?.animate ?? {}), ...(step.animate ?? {}) },
    easing: step.easing ?? patch.timeline?.easing ?? document.timeline.easing
  };
}

function transformForState(state: Required<MotionState>, prefix = ""): string {
  return `${prefix}translate(${state.x}px, ${state.y}px) scale(${state.scale}) rotate(${state.rotate}deg)`;
}

function compositionStepState(
  document: MotionDocument,
  step: CompositionStep,
  progress: number
): Required<MotionState> | undefined {
  const motion = compositionStepMotion(document, step);
  if (!motion) return undefined;
  const eased = easedProgress(motion.easing, clampProgress(progress));
  return sampleState(motion.initial, motion.animate, eased);
}

function activeCompositionStep(
  track: CompositionTrack,
  playhead: number,
  target: AppMotionPresetTarget,
  layerId?: string
): { step: CompositionStep; progress: number } | undefined {
  if (track.totalDurationMs <= 0) return undefined;
  const currentMs = clampProgress(playhead) * track.totalDurationMs;
  const windows = computeCompositionStepWindows(track.steps);
  let active: { step: CompositionStep; progress: number } | undefined;

  for (const window of windows) {
    if (currentMs < window.start || currentMs > window.end) continue;
    const step = track.steps.find((item) => item.id === window.stepId);
    if (!step || step.target !== target) continue;
    if (target === "selected-layer" && step.layerId !== layerId) continue;
    const duration = Math.max(1, step.durationMs);
    active = { step, progress: (currentMs - window.start) / duration };
  }

  return active;
}

function activeCompositionStepIds(track: CompositionTrack, playhead: number): Set<string> {
  const activeIds = new Set<string>();
  if (track.totalDurationMs <= 0) return activeIds;
  const currentMs = clampProgress(playhead) * track.totalDurationMs;
  for (const window of computeCompositionStepWindows(track.steps)) {
    if (currentMs >= window.start && currentMs <= window.end) activeIds.add(window.stepId);
  }
  return activeIds;
}

function activeCompositionStepsByTarget(
  track: CompositionTrack | undefined,
  playhead: number
): Map<string, { step: CompositionStep; progress: number }> {
  const result = new Map<string, { step: CompositionStep; progress: number }>();
  if (!track || track.totalDurationMs <= 0) return result;
  const currentMs = clampProgress(playhead) * track.totalDurationMs;
  const stepById = new Map(track.steps.map((step) => [step.id, step]));
  for (const window of computeCompositionStepWindows(track.steps)) {
    if (currentMs < window.start || currentMs > window.end) continue;
    const step = stepById.get(window.stepId);
    if (!step) continue;
    const key = step.target === "selected-layer" ? `layer:${step.layerId ?? ""}` : "target:primary";
    result.set(key, { step, progress: (currentMs - window.start) / Math.max(1, step.durationMs) });
  }
  return result;
}

function compositionLayerStyle(
  document: MotionDocument,
  activeSteps: Map<string, { step: CompositionStep; progress: number }>,
  layer: MotionLayer | undefined
): React.CSSProperties {
  if (!layer) return {};
  const active = activeSteps.get(`layer:${layer.id}`);
  const state = active ? compositionStepState(document, active.step, active.progress) : undefined;
  return state
    ? { transform: transformForState(state), opacity: state.opacity, filter: `blur(${state.blur}px)` }
    : {};
}

function targetProgress(document: MotionDocument, playhead: number): number {
  const eased = easedProgress(document.timeline.easing, playhead);
  if (primaryElement(document).role !== "button") return eased;
  return playhead <= 0.5
    ? easedProgress(document.timeline.easing, playhead * 2)
    : easedProgress(document.timeline.easing, (1 - playhead) * 2);
}

function withGuidelines(document: MotionDocument): MotionDocument {
  return { ...document, guidelineSuggestions: evaluateGuidelines(document) };
}

function addLayer(document: MotionDocument, kind: MotionLayerKind): MotionLayer {
  const id = `user-${kind}-${Date.now().toString(36)}`;
  const width = kind === "button" ? 180 : kind === "shape" ? 220 : 260;
  const height = kind === "text" ? 68 : kind === "button" ? 52 : kind === "shape" ? 120 : 180;
  const layout = {
    x: Math.round((document.stage.width - width) / 2),
    y: Math.round((document.stage.height - height) / 2),
    width,
    height,
    zIndex: Math.max(30, ...document.layers.map((layer) => layer.layout?.zIndex ?? 0)) + 1,
    ...(kind === "image" ? { aspectLocked: true } : {})
  };

  if (kind === "button") {
    return {
      id,
      name: "自定义按钮",
      kind,
      editable: true,
      content: { text: "立即行动" },
      style: { background: "#1f7a63", color: "#ffffff", radius: 8 },
      layout
    };
  }
  if (kind === "shape") {
    return {
      id,
      name: "自定义形状",
      kind,
      editable: true,
      style: { background: "#dce7f5", radius: 16, opacity: 1 },
      layout
    };
  }
  if (kind === "image") {
    return {
      id,
      name: "前景图片",
      kind,
      editable: true,
      content: { alt: "前景图片" },
      style: { background: "#d8e8e0", radius: 12, fit: "cover", position: "center" },
      layout
    };
  }
  return {
    id,
    name: "自定义文本",
    kind: "text",
    editable: true,
    content: { text: "双击右侧面板编辑文案" },
    style: { color: "#1f2328", fontSize: 13, fontWeight: 500, lineHeight: 1, textAlign: "center" },
    layout
  };
}

function CanvasPreview({
  document,
  isEmpty,
  compositionTrack,
  suggestions,
  playhead,
  isPlaying,
  isLooping,
  interactionMode,
  onInteractionModeChange,
  onPlay,
  onPause,
  onToggleLoop,
  onReset,
  onSeek,
  onCreateBlank,
  onLoadExample,
  onSelect,
  onMoveLayer
}: {
  document: MotionDocument;
  isEmpty: boolean;
  compositionTrack?: CompositionTrack;
  suggestions: GuidelineSuggestion[];
  playhead: number;
  isPlaying: boolean;
  isLooping: boolean;
  interactionMode: "playback" | "gesture";
  onInteractionModeChange: (mode: "playback" | "gesture") => void;
  onPlay: () => void;
  onPause: () => void;
  onToggleLoop: () => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  onCreateBlank: () => void;
  onLoadExample: () => void;
  onSelect: (layerId: string) => void;
  onMoveLayer: (layerId: string, layout: LayerLayoutPatch) => void;
}) {
  const element = primaryElement(document);
  const activeSteps = useMemo(
    () => activeCompositionStepsByTarget(compositionTrack, playhead),
    [compositionTrack, playhead]
  );
  const baseSampled = sampleState(element.initial, element.animate, targetProgress(document, playhead));
  const activeTargetStep = activeSteps.get("target:primary");
  const compositionSampled = activeTargetStep
    ? compositionStepState(document, activeTargetStep.step, activeTargetStep.progress)
    : undefined;
  const sampled = compositionSampled ?? baseSampled;
  const previewDurationMs =
    compositionTrack && compositionTrack.steps.length > 0
      ? compositionTrack.totalDurationMs
      : document.timeline.durationMs;
  const title = layerById(document, "modal-title");
  const body = layerById(document, "modal-body");
  const image = layerById(document, "modal-image");
  const secondary = layerById(document, "modal-secondary");
  const primary = layerById(document, "modal-primary");
  const freeLayers = document.layers
    .filter((layer) => layer.layout && !layer.hidden)
    .sort((left, right) => (left.layout?.zIndex ?? 0) - (right.layout?.zIndex ?? 0));

  // 手势交互状态
  const [gestureOffset, setGestureOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [gestureAnimating, setGestureAnimating] = useState(false);
  const [gestureHint, setGestureHint] = useState("");
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const layerDrag = useRef<{
    id: string;
    kind: "pointer" | "mouse";
    pointerId?: number;
    startClientX: number;
    startClientY: number;
    startLayout: NonNullable<MotionLayer["layout"]>;
    stageRect: DOMRect;
  } | null>(null);
  const layerResize = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startLayout: NonNullable<MotionLayer["layout"]>;
    stageRect: DOMRect;
  } | null>(null);
  const [draggingLayerId, setDraggingLayerId] = useState<string | undefined>(undefined);
  const [resizingLayerId, setResizingLayerId] = useState<string | undefined>(undefined);
  const targetRef = useRef<HTMLDivElement>(null);

  function detectGestureType(
    dx: number,
    dy: number
  ): "tap" | "swipe-down" | "swipe-up" | "swipe-left" | "swipe-right" {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 8 && absDy < 8) return "tap";
    if (absDy > absDx) return dy > 0 ? "swipe-down" : "swipe-up";
    return dx > 0 ? "swipe-right" : "swipe-left";
  }

  function onGesturePointerDown(event: React.PointerEvent) {
    if (interactionMode !== "gesture") return;
    pointerStart.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    setGestureAnimating(false);
    setGestureHint("");
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onGesturePointerMove(event: React.PointerEvent) {
    if (interactionMode !== "gesture" || !pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    // 跟手：位移跟随鼠标但做阻尼衰减
    const dampFactor = 0.6;
    setGestureOffset({ x: dx * dampFactor, y: dy * dampFactor });
    const type = detectGestureType(dx, dy);
    const hints: Record<string, string> = {
      tap: "",
      "swipe-down": "↓ 下拉",
      "swipe-up": "↑ 上滑",
      "swipe-left": "← 左滑",
      "swipe-right": "→ 右滑"
    };
    setGestureHint(hints[type] ?? "");
  }

  function onGesturePointerUp() {
    if (interactionMode !== "gesture" || !pointerStart.current) return;
    pointerStart.current = null;

    // 松手后播放回弹动画
    setGestureAnimating(true);
    setGestureOffset({ x: 0, y: 0 });
    setGestureHint("");

    // 触发对应 preset 动效播放
    onReset();
    setTimeout(() => onPlay(), 16);

    // 动画结束后清除 animating 状态
    setTimeout(() => setGestureAnimating(false), previewDurationMs + 50);
  }

  function stopLayerDrag() {
    window.removeEventListener("pointermove", handlePointerLayerDragMove);
    window.removeEventListener("pointerup", handlePointerLayerDragEnd);
    window.removeEventListener("mousemove", handleMouseLayerDragMove);
    window.removeEventListener("mouseup", handleMouseLayerDragEnd);
    layerDrag.current = null;
    setDraggingLayerId(undefined);
  }

  function stopLayerResize() {
    window.removeEventListener("pointermove", handleLayerResizeMove);
    window.removeEventListener("pointerup", handleLayerResizeEnd);
    layerResize.current = null;
    setResizingLayerId(undefined);
  }

  function beginLayerDrag(
    kind: "pointer" | "mouse",
    event: {
      clientX: number;
      clientY: number;
      currentTarget: HTMLButtonElement;
      target: EventTarget;
      preventDefault(): void;
      stopPropagation(): void;
      pointerId?: number;
    },
    layer: MotionLayer
  ) {
    if (!layer.layout || layer.locked) return;
    if (layerDrag.current) return;
    if (event.target instanceof HTMLElement && event.target.closest(".free-layer-resize-handle")) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(layer.id);
    const stage = event.currentTarget.closest<HTMLElement>(".artboard-stage");
    if (!stage) return;
    if (kind === "pointer" && typeof event.pointerId === "number") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    layerDrag.current = {
      id: layer.id,
      kind,
      ...(typeof event.pointerId === "number" ? { pointerId: event.pointerId } : {}),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayout: layer.layout,
      stageRect: stage.getBoundingClientRect()
    };
    setDraggingLayerId(layer.id);
    if (kind === "pointer") {
      window.addEventListener("pointermove", handlePointerLayerDragMove);
      window.addEventListener("pointerup", handlePointerLayerDragEnd);
    } else {
      window.addEventListener("mousemove", handleMouseLayerDragMove);
      window.addEventListener("mouseup", handleMouseLayerDragEnd);
    }
  }

  function beginLayerResize(event: React.PointerEvent<HTMLSpanElement>, layer: MotionLayer) {
    if (!layer.layout || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(layer.id);
    const stage = event.currentTarget.closest<HTMLElement>(".artboard-stage");
    if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    layerResize.current = {
      id: layer.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayout: layer.layout,
      stageRect: stage.getBoundingClientRect()
    };
    setResizingLayerId(layer.id);
    window.addEventListener("pointermove", handleLayerResizeMove);
    window.addEventListener("pointerup", handleLayerResizeEnd);
  }

  function updateLayerDrag(event: { clientX: number; clientY: number }, layer: MotionLayer) {
    const drag = layerDrag.current;
    if (!drag || drag.id !== layer.id || !layer.layout) return;
    const dx = ((event.clientX - drag.startClientX) / drag.stageRect.width) * document.stage.width;
    const dy = ((event.clientY - drag.startClientY) / drag.stageRect.height) * document.stage.height;
    const maxX = Math.max(0, document.stage.width - drag.startLayout.width);
    const maxY = Math.max(0, document.stage.height - drag.startLayout.height);
    onMoveLayer(layer.id, {
      x: Math.round(Math.min(maxX, Math.max(0, drag.startLayout.x + dx))),
      y: Math.round(Math.min(maxY, Math.max(0, drag.startLayout.y + dy)))
    });
  }

  function endLayerDrag(
    kind: "pointer" | "mouse",
    event: { preventDefault(): void; stopPropagation(): void; pointerId?: number },
    layer: MotionLayer
  ) {
    const drag = layerDrag.current;
    if (!drag || drag.id !== layer.id || drag.kind !== kind) return;
    event.preventDefault();
    event.stopPropagation();
    stopLayerDrag();
  }

  function handlePointerLayerDragMove(event: PointerEvent) {
    const drag = layerDrag.current;
    if (
      !drag ||
      drag.kind !== "pointer" ||
      (typeof drag.pointerId === "number" && drag.pointerId !== event.pointerId)
    )
      return;
    const layer = layerById(document, drag.id);
    if (layer) updateLayerDrag(event, layer);
  }

  function handlePointerLayerDragEnd(event: PointerEvent) {
    const drag = layerDrag.current;
    if (
      !drag ||
      drag.kind !== "pointer" ||
      (typeof drag.pointerId === "number" && drag.pointerId !== event.pointerId)
    )
      return;
    stopLayerDrag();
  }

  function handleMouseLayerDragMove(event: MouseEvent) {
    const drag = layerDrag.current;
    if (!drag || drag.kind !== "mouse") return;
    const layer = layerById(document, drag.id);
    if (layer) updateLayerDrag(event, layer);
  }

  function handleMouseLayerDragEnd() {
    const drag = layerDrag.current;
    if (!drag || drag.kind !== "mouse") return;
    stopLayerDrag();
  }

  function updateLayerResize(event: PointerEvent, layer: MotionLayer) {
    const resize = layerResize.current;
    if (!resize || resize.id !== layer.id || !layer.layout) return;
    const dx = ((event.clientX - resize.startClientX) / resize.stageRect.width) * document.stage.width;
    const dy = ((event.clientY - resize.startClientY) / resize.stageRect.height) * document.stage.height;
    const maxWidth = Math.max(32, document.stage.width - resize.startLayout.x);
    const maxHeight = Math.max(32, document.stage.height - resize.startLayout.y);
    let width = Math.min(maxWidth, Math.max(32, Math.round(resize.startLayout.width + dx)));
    let height = Math.min(maxHeight, Math.max(32, Math.round(resize.startLayout.height + dy)));

    if (resize.startLayout.aspectLocked) {
      const ratio = resize.startLayout.width / Math.max(1, resize.startLayout.height);
      if (Math.abs(dx) >= Math.abs(dy)) {
        height = Math.round(width / ratio);
      } else {
        width = Math.round(height * ratio);
      }
      if (width > maxWidth) {
        width = maxWidth;
        height = Math.round(width / ratio);
      }
      if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(height * ratio);
      }
    }

    onMoveLayer(layer.id, { width, height });
  }

  function handleLayerResizeMove(event: PointerEvent) {
    const resize = layerResize.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const layer = layerById(document, resize.id);
    if (layer) updateLayerResize(event, layer);
  }

  function handleLayerResizeEnd(event: PointerEvent) {
    const resize = layerResize.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    stopLayerResize();
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerLayerDragMove);
      window.removeEventListener("pointerup", handlePointerLayerDragEnd);
      window.removeEventListener("mousemove", handleMouseLayerDragMove);
      window.removeEventListener("mouseup", handleMouseLayerDragEnd);
      window.removeEventListener("pointermove", handleLayerResizeMove);
      window.removeEventListener("pointerup", handleLayerResizeEnd);
    };
    // The listeners are registered imperatively only during active drag/resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 手势模式下的 motion-target transform
  const gestureTransform =
    interactionMode === "gesture"
      ? `translate(-50%, -50%) translate(${gestureOffset.x}px, ${gestureOffset.y}px) scale(${gestureAnimating ? sampled.scale : 1}) rotate(${gestureAnimating ? sampled.rotate : 0}deg)`
      : transformForState(sampled, "translate(-50%, -50%) ");

  const gestureOpacity =
    interactionMode === "gesture" ? (gestureAnimating ? sampled.opacity : 1) : sampled.opacity;

  const gestureTransition = gestureAnimating
    ? `transform ${previewDurationMs}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${previewDurationMs}ms ease-out`
    : interactionMode === "gesture"
      ? "none"
      : undefined;

  return (
    <section className="stage-shell">
      <header className="stage-header">
        <div>
          <p className="eyebrow">实时画布</p>
          <h2>
            {element.role} / {element.size} / {previewDurationMs}ms
          </h2>
        </div>
        <div className="transport-controls">
          <div className="mode-switch" role="group" aria-label="预览模式">
            <button
              type="button"
              className={interactionMode === "playback" ? "is-active" : ""}
              onClick={() => onInteractionModeChange("playback")}
            >
              播放
            </button>
            <button
              type="button"
              className={interactionMode === "gesture" ? "is-active" : ""}
              onClick={() => onInteractionModeChange("gesture")}
            >
              手势
            </button>
          </div>
          {interactionMode === "playback" ? (
            <>
              {isPlaying ? (
                <button type="button" onClick={onPause}>
                  暂停
                </button>
              ) : (
                <button type="button" onClick={onPlay}>
                  播放
                </button>
              )}
              <button type="button" className={isLooping ? "is-active" : ""} onClick={onToggleLoop}>
                循环
              </button>
              <button type="button" onClick={onReset}>
                归零
              </button>
            </>
          ) : (
            <span className="gesture-mode-hint">拖拽 / 点击目标触发动效</span>
          )}
        </div>
      </header>
      <div className="canvas-wrap">
        <div className={`artboard-stage artboard-${document.stage.mode}`} style={stageStyle(document)}>
          {document.stage.mode === "mobile" ? (
            <>
              <div className="safe-area safe-area-top" />
              <div className="safe-area safe-area-bottom" />
            </>
          ) : null}
          {document.stage.backgroundImage ? (
            <img
              className="artboard-background-image"
              src={document.stage.backgroundImage}
              alt={document.stage.backgroundAlt ?? ""}
              style={{
                objectFit: document.stage.backgroundFit ?? "cover",
                objectPosition: document.stage.backgroundPosition ?? "center"
              }}
            />
          ) : null}
          {isEmpty ? (
            <div className="canvas-empty-state">
              <strong>从空白画布开始</strong>
              <span>先创建画布和图层，再把规范动效添加到时间轴。</span>
              <div className="canvas-empty-actions">
                <button type="button" className="primary-action" onClick={onCreateBlank}>
                  新建空白
                </button>
                <button type="button" className="small-action" onClick={onLoadExample}>
                  加载示例
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={targetRef}
              className={`motion-target target-${element.role}${interactionMode === "gesture" ? " gesture-interactive" : ""}`}
              style={{
                transform: gestureTransform,
                opacity: gestureOpacity,
                filter: `blur(${interactionMode === "gesture" ? (gestureAnimating ? sampled.blur : 0) : sampled.blur}px)`,
                transition: gestureTransition
              }}
              onPointerDown={onGesturePointerDown}
              onPointerMove={onGesturePointerMove}
              onPointerUp={onGesturePointerUp}
            >
              {element.role === "modal" ? (
                <>
                  <span className="modal-handle" />
                  {!image?.hidden ? (
                    <button
                      type="button"
                      className={`modal-image-slot layer-hit ${image ? layerMotionClass(image) : ""} ${image?.id === document.selectedLayerId ? "is-selected" : ""}`}
                      style={{
                        ...styleForLayer(image),
                        ...(image ? layerMotionStyle(image) : {}),
                        ...compositionLayerStyle(document, activeSteps, image)
                      }}
                      onClick={() => image && onSelect(image.id)}
                    >
                      {image?.content?.src ? (
                        <img
                          src={image.content.src}
                          alt={image.content.alt ?? ""}
                          style={imageStyle(image)}
                        />
                      ) : (
                        "图片位"
                      )}
                    </button>
                  ) : null}
                  {!title?.hidden ? (
                    <button
                      type="button"
                      className={`modal-title layer-hit ${title ? layerMotionClass(title) : ""} ${title?.id === document.selectedLayerId ? "is-selected" : ""}`}
                      style={{
                        ...styleForLayer(title),
                        ...(title ? layerMotionStyle(title) : {}),
                        ...compositionLayerStyle(document, activeSteps, title)
                      }}
                      onClick={() => title && onSelect(title.id)}
                    >
                      {title?.content?.text}
                    </button>
                  ) : null}
                  {!body?.hidden ? (
                    <button
                      type="button"
                      className={`modal-text layer-hit ${body ? layerMotionClass(body) : ""} ${body?.id === document.selectedLayerId ? "is-selected" : ""}`}
                      style={{
                        ...styleForLayer(body),
                        ...(body ? layerMotionStyle(body) : {}),
                        ...compositionLayerStyle(document, activeSteps, body)
                      }}
                      onClick={() => body && onSelect(body.id)}
                    >
                      {body?.content?.text}
                    </button>
                  ) : null}
                  <span className="modal-actions">
                    {!secondary?.hidden ? (
                      <button
                        type="button"
                        className={`modal-secondary layer-hit ${secondary ? layerMotionClass(secondary) : ""} ${secondary?.id === document.selectedLayerId ? "is-selected" : ""}`}
                        style={{
                          ...styleForLayer(secondary),
                          ...(secondary ? layerMotionStyle(secondary) : {}),
                          ...compositionLayerStyle(document, activeSteps, secondary)
                        }}
                        onClick={() => secondary && onSelect(secondary.id)}
                      >
                        {secondary?.content?.text}
                      </button>
                    ) : null}
                    {!primary?.hidden ? (
                      <button
                        type="button"
                        className={`modal-primary layer-hit ${primary ? layerMotionClass(primary) : ""} ${primary?.id === document.selectedLayerId ? "is-selected" : ""}`}
                        style={{
                          ...styleForLayer(primary),
                          ...(primary ? layerMotionStyle(primary) : {}),
                          ...compositionLayerStyle(document, activeSteps, primary)
                        }}
                        onClick={() => primary && onSelect(primary.id)}
                      >
                        {primary?.content?.text}
                      </button>
                    ) : null}
                  </span>
                </>
              ) : (
                <strong>{element.role === "toast" ? "操作已完成" : "立即查看"}</strong>
              )}
            </div>
          )}
          {freeLayers.map((layer) => (
            <button
              type="button"
              className={`free-layer free-layer-${layer.kind} ${layer.id === document.selectedLayerId ? "is-selected" : ""} ${draggingLayerId === layer.id ? "is-dragging" : ""} ${resizingLayerId === layer.id ? "is-resizing" : ""} ${layerMotionClass(layer)}`}
              style={{
                left: `${((layer.layout?.x ?? 0) / document.stage.width) * 100}%`,
                top: `${((layer.layout?.y ?? 0) / document.stage.height) * 100}%`,
                width: `${((layer.layout?.width ?? 120) / document.stage.width) * 100}%`,
                height: `${((layer.layout?.height ?? 80) / document.stage.height) * 100}%`,
                zIndex: layer.layout?.zIndex ?? 1,
                animationDuration: `${layer.motion?.durationMs ?? 220}ms`,
                animationDelay: `${layer.motion?.delayMs ?? 0}ms`,
                ...layerMotionStyle(layer),
                ...compositionLayerStyle(document, activeSteps, layer),
                ...styleForLayer(layer)
              }}
              onPointerDown={(event) => beginLayerDrag("pointer", event, layer)}
              onMouseDown={(event) => beginLayerDrag("mouse", event, layer)}
              onPointerUp={(event) => endLayerDrag("pointer", event, layer)}
              onPointerCancel={(event) => endLayerDrag("pointer", event, layer)}
              onMouseUp={(event) => endLayerDrag("mouse", event, layer)}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(layer.id);
              }}
              key={layer.id}
            >
              {layer.kind === "image" && layer.content?.src ? (
                <img src={layer.content.src} alt={layer.content.alt ?? ""} style={imageStyle(layer)} />
              ) : (
                (layer.content?.text ?? (layer.kind === "image" ? "图片" : ""))
              )}
              {layer.id === document.selectedLayerId ? (
                <span
                  className="free-layer-resize-handle"
                  role="presentation"
                  onPointerDown={(event) => beginLayerResize(event, layer)}
                />
              ) : null}
            </button>
          ))}
          {suggestions.length > 0 ? (
            <div className="canvas-hints">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  type="button"
                  onClick={() =>
                    globalThis.document
                      .getElementById(`suggestion-${suggestion.id}`)
                      ?.scrollIntoView({ block: "center" })
                  }
                  key={suggestion.id}
                >
                  {suggestion.title}
                </button>
              ))}
            </div>
          ) : null}
          {interactionMode === "gesture" && gestureHint ? (
            <div className="gesture-overlay-hint">{gestureHint}</div>
          ) : null}
        </div>
        {interactionMode === "playback" ? (
          <label className="seek-control">
            <span>{Math.round(playhead * 100)}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(playhead * 100)}
              onChange={(event) => onSeek(Number(event.target.value) / 100)}
            />
          </label>
        ) : (
          <div className="gesture-status-bar">
            <span>手势交互模式</span>
            <span>{gestureAnimating ? "动画播放中…" : "等待操作"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

const timelineColors = [
  "#1f7a63",
  "#0f5c8a",
  "#b35900",
  "#6f42c1",
  "#d73a49",
  "#22863a",
  "#005cc5",
  "#735c0f"
];
const minTimelineWidthPx = 760;
const pxPerTimelineMs = 0.72;
const minCompositionHeight = 220;
const maxCompositionHeight = 520;
const defaultCompositionHeight = 320;
const stepCardWidthPx = 220;
const timelineTickMs = 250;
const timelineSnapThresholdMs = 30;

function groupedCompositionSteps(
  steps: CompositionStep[]
): Array<Array<{ step: CompositionStep; index: number }>> {
  const groups: Array<Array<{ step: CompositionStep; index: number }>> = [];
  steps.forEach((step, index) => {
    const previousGroup = groups[groups.length - 1];
    if (step.timing === "parallel" && previousGroup) {
      previousGroup.push({ step, index });
      return;
    }
    groups.push([{ step, index }]);
  });
  return groups;
}

function compositionLaneKey(step: CompositionLaneTarget): string {
  return step.target === "selected-layer"
    ? `layer:${step.layerId ?? step.layerName ?? "unknown"}`
    : "target:primary";
}

function compositionLaneLabel(step: CompositionLaneTarget): string {
  return step.target === "selected-layer" ? (step.layerName ?? "图层") : "未绑定图层";
}

function compositionLaneHint(step: CompositionLaneTarget): string {
  return step.target === "selected-layer" ? "图层轨道" : "兼容旧数据";
}

function CompositionTimeline({
  steps,
  totalMs,
  activeStepIds
}: {
  steps: CompositionStep[];
  totalMs: number;
  activeStepIds: Set<string>;
}) {
  if (totalMs <= 0) return null;

  const windows = computeCompositionStepWindows(steps);
  const groupByStepId = new Map<string, { color: string; label: string }>();
  const groups = groupedCompositionSteps(steps);

  groups.forEach((group, groupIndex) => {
    const groupInfo = {
      color: timelineColors[groupIndex % timelineColors.length]!,
      label: group.map(({ step }) => step.label).join("+")
    };
    for (const { step } of group) groupByStepId.set(step.id, groupInfo);
  });

  const segments = windows.map((window, index) => {
    const step = steps.find((item) => item.id === window.stepId)!;
    const group = groupByStepId.get(step.id);
    return {
      id: step.id,
      label: group?.label ?? step.label,
      start: window.start,
      end: window.end,
      color: group?.color ?? timelineColors[index % timelineColors.length]!
    };
  });

  return (
    <div className="composition-timeline">
      <div className="timeline-scale" aria-hidden="true">
        {Array.from({ length: Math.max(1, Math.ceil(totalMs / timelineTickMs) + 1) }, (_, index) => {
          const tick = index * timelineTickMs;
          const left = totalMs > 0 ? Math.min(100, (tick / totalMs) * 100) : 0;
          return (
            <div className="timeline-scale-tick" key={tick} style={{ left: `${left}%` }}>
              <span>{tick}ms</span>
            </div>
          );
        })}
      </div>
      <div className="timeline-ruler">
        {segments.map((seg) => (
          <div
            className={activeStepIds.has(seg.id) ? "timeline-segment is-active" : "timeline-segment"}
            key={seg.id}
            title={`${seg.label} ${seg.start}ms → ${seg.end}ms`}
            style={{
              left: `${(seg.start / totalMs) * 100}%`,
              width: `${((seg.end - seg.start) / totalMs) * 100}%`,
              backgroundColor: seg.color
            }}
          >
            <span>{seg.label}</span>
          </div>
        ))}
      </div>
      <div className="timeline-labels">
        <span>0ms</span>
        <span>{Math.round(totalMs / 2)}ms</span>
        <span>{totalMs}ms</span>
      </div>
    </div>
  );
}

function absoluteStartForStep(steps: CompositionStep[], stepId: string): number {
  const windows = computeCompositionStepWindows(steps);
  return windows.find((window) => window.stepId === stepId)?.start ?? 0;
}

function updateStepStart(steps: CompositionStep[], stepId: string, nextStartMs: number): CompositionStep[] {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index < 0) return steps;

  const nextStart = Math.max(0, Math.round(nextStartMs));
  if (index === 0) {
    return steps.map((step) => (step.id === stepId ? { ...step, delayMs: nextStart } : step));
  }

  const previousWindows = computeCompositionStepWindows(steps.slice(0, index));
  const previous = previousWindows[previousWindows.length - 1];
  if (!previous) return steps;

  const timing = nextStart >= previous.end ? "sequential" : "parallel";
  const base = timing === "sequential" ? previous.end : previous.start;

  return steps.map((step, stepIndex) =>
    step.id === stepId
      ? {
          ...step,
          ...(stepIndex > 0 ? { timing } : {}),
          delayMs: Math.max(0, nextStart - base)
        }
      : step
  );
}

function CompositionPanel({
  steps,
  layers,
  track,
  activeStepIds,
  selectedStepId,
  compositionHeight,
  onSelectStep,
  onCompositionHeightChange,
  onToggleTiming,
  onReorderStep,
  onMoveStepToLane,
  onRemove,
  onApply,
  onClear
}: {
  steps: CompositionStep[];
  layers: MotionLayer[];
  track: CompositionTrack;
  activeStepIds: Set<string>;
  selectedStepId: string | undefined;
  compositionHeight: number;
  onSelectStep: (stepId: string) => void;
  onCompositionHeightChange: (height: number) => void;
  onToggleTiming: (stepId: string) => void;
  onReorderStep: (sourceStepId: string, targetStepId: string, placement: "before" | "after") => void;
  onMoveStepToLane: (stepId: string, target: CompositionLaneDropTarget) => void;
  onRemove: (stepId: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const [dragTarget, setDragTarget] = useState<{ stepId: string; placement: "before" | "after" } | undefined>(
    undefined
  );
  const [laneDropTarget, setLaneDropTarget] = useState<CompositionLaneDropTarget | undefined>(undefined);
  const [snapLineMs, setSnapLineMs] = useState<number | undefined>(undefined);
  const [collapsedLaneKeys, setCollapsedLaneKeys] = useState<Set<string>>(() => new Set());
  const dragTargetRef = useRef<{ stepId: string; placement: "before" | "after" } | undefined>(undefined);
  const laneDropTargetRef = useRef<CompositionLaneDropTarget | undefined>(undefined);
  const pointerDragRef = useRef<
    | {
        sourceStepId: string;
        startX: number;
        startY: number;
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
        moved: boolean;
      }
    | undefined
  >(undefined);
  const [dragSourceStepId, setDragSourceStepId] = useState<string | undefined>(undefined);
  const [dragGhost, setDragGhost] = useState<
    | {
        stepId: string;
        clientX: number;
        clientY: number;
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
      }
    | undefined
  >(undefined);
  const suppressClickRef = useRef(false);
  const mouseDragCleanupRef = useRef<(() => void) | undefined>(undefined);
  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);
  const displaySteps = dragSourceStepId ? steps.filter((step) => step.id !== dragSourceStepId) : steps;
  const displayWindows = computeCompositionStepWindows(displaySteps);
  const stepWindows = useMemo(() => computeCompositionStepWindows(steps), [steps]);
  const stepWindowById = useMemo(() => new Map(stepWindows.map((window) => [window.stepId, window])), [stepWindows]);
  const snapMarkersByStepId = useMemo(() => {
    const markers = new Map<string, number[]>();
    for (const step of steps) {
      markers.set(
        step.id,
        stepWindows.filter((window) => window.stepId !== step.id).flatMap((window) => [window.start, window.end])
      );
    }
    return markers;
  }, [stepWindows, steps]);
  const timelineWidth = Math.max(
    minTimelineWidthPx,
    Math.ceil(Math.max(track.totalDurationMs, 1) * pxPerTimelineMs + stepCardWidthPx)
  );
  const laneTargets: CompositionLaneTarget[] = [
    { target: "target" },
    ...layers
      .filter((layer) => layer.editable)
      .map((layer) => ({ target: "selected-layer" as const, layerId: layer.id, layerName: layer.name }))
  ];
  const lanes = laneTargets.map((target) => {
    const layer = target.target === "selected-layer" && target.layerId ? layers.find((item) => item.id === target.layerId) : undefined;
    return {
      key: compositionLaneKey(target),
      label: compositionLaneLabel(target),
      hint: compositionLaneHint(target),
      status: target.target === "selected-layer" ? `${layer?.hidden ? "隐藏" : "显示"} · ${layer?.locked ? "锁定" : "可编辑"}` : "旧数据",
      target,
      items: [] as Array<{ step: CompositionStep; index: number; start: number; end: number }>
    };
  });

  displaySteps.forEach((step, index) => {
    const key = compositionLaneKey(step);
    let lane = lanes.find((item) => item.key === key);
	      if (!lane) {
	        lane = {
	          key,
	          label: compositionLaneLabel(step),
	          hint: compositionLaneHint(step),
            status: "已失效图层",
	          target: {
	            target: step.target,
	            ...(step.layerId ? { layerId: step.layerId } : {}),
	            ...(step.layerName ? { layerName: step.layerName } : {})
	          },
        items: []
      };
      lanes.push(lane);
    }
    const window = displayWindows[index];
    lane.items.push({
      step,
      index: steps.findIndex((item) => item.id === step.id),
      start: window?.start ?? 0,
      end: window?.end ?? step.durationMs
    });
  });
  const draggingStep = dragSourceStepId ? steps.find((step) => step.id === dragSourceStepId) : undefined;
  const draggingStepIndex = dragSourceStepId ? steps.findIndex((step) => step.id === dragSourceStepId) : -1;

	  useEffect(
    () => () => {
      mouseDragCleanupRef.current?.();
      resizeCleanupRef.current?.();
    },
    []
	  );

  function toggleLaneCollapsed(laneKey: string) {
    setCollapsedLaneKeys((current) => {
      const next = new Set(current);
      if (next.has(laneKey)) next.delete(laneKey);
      else next.add(laneKey);
      return next;
    });
  }

  function isInteractiveDragTarget(target: EventTarget): boolean {
    return target instanceof HTMLElement && Boolean(target.closest("button,input,select,textarea,a"));
  }

  function onResizePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = compositionHeight;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    resizeCleanupRef.current?.();

    function onPointerMove(moveEvent: PointerEvent) {
      const nextHeight = Math.min(
        maxCompositionHeight,
        Math.max(minCompositionHeight, startHeight + startY - moveEvent.clientY)
      );
      onCompositionHeightChange(nextHeight);
    }

    function onPointerUp() {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = undefined;
    }

    globalThis.document.addEventListener("pointermove", onPointerMove);
    globalThis.document.addEventListener("pointerup", onPointerUp, { once: true });
    resizeCleanupRef.current = () => {
      globalThis.document.removeEventListener("pointermove", onPointerMove);
      globalThis.document.removeEventListener("pointerup", onPointerUp);
    };
  }

  function targetStepFromPoint(
    clientX: number,
    clientY: number
  ): { stepId: string; placement: "before" | "after" } | undefined {
    const element = globalThis.document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>(".composition-step");
    const stepId = element?.dataset.stepId;
    if (!element || !stepId) return undefined;
    const rect = element.getBoundingClientRect();
    return {
      stepId,
      placement: clientX < rect.left + rect.width / 2 ? "before" : "after"
    };
  }

  function setCurrentDragTarget(nextTarget: { stepId: string; placement: "before" | "after" } | undefined) {
    dragTargetRef.current = nextTarget;
    setDragTarget(nextTarget);
  }

  function snapTimelineMs(rawMs: number, sourceStepId: string): { startMs: number; snapMs?: number } {
    const markers = snapMarkersByStepId.get(sourceStepId) ?? [];
    let nearest: number | undefined;
    let nearestDistance = timelineSnapThresholdMs + 1;
    for (const marker of markers) {
      const distance = Math.abs(marker - rawMs);
      if (distance < nearestDistance) {
        nearest = marker;
        nearestDistance = distance;
      }
    }
    return nearest !== undefined && nearestDistance <= timelineSnapThresholdMs
      ? { startMs: nearest, snapMs: nearest }
      : { startMs: Math.max(0, Math.round(rawMs)) };
  }

  function setCurrentLaneDropTarget(nextTarget: CompositionLaneDropTarget | undefined) {
    laneDropTargetRef.current = nextTarget;
    setLaneDropTarget(nextTarget);
  }

  function laneTargetFromPoint(
    clientX: number,
    clientY: number,
    sourceStepId: string,
    offsetX: number
  ): CompositionLaneDropTarget | undefined {
    const element = globalThis.document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>(".composition-lane-canvas");
    const lane = element?.closest<HTMLElement>(".composition-lane");
    if (!lane?.dataset.target) return undefined;
    const rect = element?.getBoundingClientRect();
    const left = rect ? Math.max(0, clientX - rect.left - offsetX) : 0;
    const snapped = snapTimelineMs(left / pxPerTimelineMs, sourceStepId);
    setSnapLineMs(snapped.snapMs);
    return {
      target: lane.dataset.target as AppMotionPresetTarget,
      ...(lane.dataset.layerId ? { layerId: lane.dataset.layerId } : {}),
      ...(lane.dataset.layerName ? { layerName: lane.dataset.layerName } : {}),
      startMs: snapped.startMs
    };
  }

  function startStepDrag(stepId: string, clientX: number, clientY: number, rect: DOMRect) {
    pointerDragRef.current = {
      sourceStepId: stepId,
      startX: clientX,
      startY: clientY,
      width: rect.width,
      height: rect.height,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
      moved: false
    };
    suppressClickRef.current = false;
  }

  function updateStepDrag(clientX: number, clientY: number) {
    const drag = pointerDragRef.current;
    if (!drag) return false;
    const moved = Math.abs(clientX - drag.startX) + Math.abs(clientY - drag.startY) > 6;
    if (!moved && !drag.moved) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragSourceStepId(drag.sourceStepId);
      setDragGhost({
        stepId: drag.sourceStepId,
        clientX,
        clientY,
        width: drag.width,
        height: drag.height,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY
      });
    }
    suppressClickRef.current = true;
    const sourceStep = steps.find((step) => step.id === drag.sourceStepId);
    const sourceLaneKey = sourceStep ? compositionLaneKey(sourceStep) : "target:primary";
    const nextTarget = targetStepFromPoint(clientX, clientY);
    const targetStep = nextTarget ? steps.find((step) => step.id === nextTarget.stepId) : undefined;
    const targetLaneKey = targetStep ? compositionLaneKey(targetStep) : undefined;
    const nextLaneTarget = laneTargetFromPoint(clientX, clientY, drag.sourceStepId, drag.offsetX);
    setCurrentDragTarget(nextTarget && targetLaneKey !== sourceLaneKey ? nextTarget : undefined);
    setCurrentLaneDropTarget(nextLaneTarget);
    if (!nextLaneTarget) setSnapLineMs(undefined);
    setDragGhost((current) => (current ? { ...current, clientX, clientY } : current));
    return true;
  }

  function finishStepDrag(clientX: number, clientY: number) {
    const drag = pointerDragRef.current;
    pointerDragRef.current = undefined;
    const finalTarget = targetStepFromPoint(clientX, clientY) ?? dragTargetRef.current;
    if (drag?.moved && laneDropTargetRef.current) {
      onMoveStepToLane(drag.sourceStepId, laneDropTargetRef.current);
    } else if (drag?.moved && finalTarget && finalTarget.stepId !== drag.sourceStepId) {
      onReorderStep(drag.sourceStepId, finalTarget.stepId, finalTarget.placement);
    }
    setCurrentDragTarget(undefined);
    setCurrentLaneDropTarget(undefined);
    setSnapLineMs(undefined);
    setDragSourceStepId(undefined);
    setDragGhost(undefined);
  }

  function onStepPointerDown(event: React.PointerEvent<HTMLDivElement>, stepId: string) {
    if (event.button !== 0 || isInteractiveDragTarget(event.target)) return;
    startStepDrag(stepId, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onStepPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (updateStepDrag(event.clientX, event.clientY)) event.preventDefault();
  }

  function onStepPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    finishStepDrag(event.clientX, event.clientY);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onStepMouseDown(event: React.MouseEvent<HTMLDivElement>, stepId: string) {
    if (event.button !== 0 || isInteractiveDragTarget(event.target)) return;
    startStepDrag(stepId, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    mouseDragCleanupRef.current?.();

    function onMouseMove(moveEvent: MouseEvent) {
      if (updateStepDrag(moveEvent.clientX, moveEvent.clientY)) moveEvent.preventDefault();
    }

    function onMouseUp(upEvent: MouseEvent) {
      finishStepDrag(upEvent.clientX, upEvent.clientY);
      mouseDragCleanupRef.current?.();
      mouseDragCleanupRef.current = undefined;
    }

    globalThis.document.addEventListener("mousemove", onMouseMove);
    globalThis.document.addEventListener("mouseup", onMouseUp, { once: true });
    mouseDragCleanupRef.current = () => {
      globalThis.document.removeEventListener("mousemove", onMouseMove);
      globalThis.document.removeEventListener("mouseup", onMouseUp);
    };
  }

  function onStepClick(event: React.MouseEvent<HTMLDivElement>, stepId: string) {
    if (suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
      return;
    }
    onSelectStep(stepId);
  }

  function cancelStepDrag() {
    pointerDragRef.current = undefined;
    setCurrentDragTarget(undefined);
    setCurrentLaneDropTarget(undefined);
    setSnapLineMs(undefined);
    setDragSourceStepId(undefined);
    setDragGhost(undefined);
  }

  function renderStepCard(
    step: CompositionStep,
    index: number,
    options: { ghost?: boolean; style?: React.CSSProperties } = {}
  ) {
    const stepWindow = stepWindowById.get(step.id);
    return (
      <div
        className={[
          "composition-step",
          activeStepIds.has(step.id) ? "is-active" : "",
          step.id === selectedStepId ? "is-selected" : "",
          dragTarget?.stepId === step.id ? `drop-${dragTarget.placement}` : "",
          options.ghost ? "is-ghost" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        style={options.style}
        role={options.ghost ? undefined : "button"}
        tabIndex={options.ghost ? undefined : 0}
        title={options.ghost ? undefined : "左右拖拽调整顺序"}
        data-step-id={step.id}
        onClick={options.ghost ? undefined : (event) => onStepClick(event, step.id)}
        onMouseDown={options.ghost ? undefined : (event) => onStepMouseDown(event, step.id)}
        onPointerDown={options.ghost ? undefined : (event) => onStepPointerDown(event, step.id)}
        onPointerMove={options.ghost ? undefined : onStepPointerMove}
        onPointerUp={options.ghost ? undefined : onStepPointerUp}
        onPointerCancel={options.ghost ? undefined : cancelStepDrag}
        onKeyDown={
          options.ghost
            ? undefined
            : (event) => {
                if (event.key === "Enter" || event.key === " ") onSelectStep(step.id);
              }
        }
      >
        <div className="step-header">
          <span className="step-index">{index + 1}</span>
          <strong>{step.label}</strong>
          <span className="step-target">{step.target === "selected-layer" ? "图层" : "未绑定图层"}</span>
        </div>
        <div className="step-meta">
          <button
            type="button"
            className={`step-timing ${step.timing}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleTiming(step.id);
            }}
            disabled={index === 0}
          >
            {step.timing === "sequential" ? "串行" : "并行于上一段"}
          </button>
          <span className="step-start">开始 {stepWindow?.start ?? 0}ms</span>
          <span className="step-duration">时长 {step.durationMs}ms</span>
        </div>
        {stepWindow ? (
          <div className="step-window">
            {stepWindow.start}ms - {stepWindow.end}ms
          </div>
        ) : null}
        <div className="step-actions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(step.id);
            }}
          >
            删除
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="composition-panel">
      <button
        type="button"
        aria-label="调整编排区域高度"
        className="composition-resize-handle"
        onPointerDown={onResizePointerDown}
      />
      <header className="composition-panel-header">
        <div>
          <p className="eyebrow">编排</p>
          <h2>多图层时间轴</h2>
        </div>
        <span className="composition-duration">{track.totalDurationMs}ms</span>
      </header>

      {steps.length === 0 ? (
        <p className="composition-empty">点击左侧 preset 右侧 + 号，将动效添加到这里。</p>
      ) : (
        <>
          <CompositionTimeline steps={steps} totalMs={track.totalDurationMs} activeStepIds={activeStepIds} />
          <div className="composition-track">
            <div className="composition-lane-board" style={{ minWidth: `${timelineWidth}px` }}>
              {lanes.map((lane) => {
                const isCollapsed = collapsedLaneKeys.has(lane.key);
                return (
                <div
                  className={
                    [
                      "composition-lane",
                      laneDropTarget && compositionLaneKey(laneDropTarget) === lane.key ? "is-drop-target" : "",
                      isCollapsed ? "is-collapsed" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                  data-layer-id={lane.target.layerId}
                  data-layer-name={lane.target.layerName}
                  data-target={lane.target.target}
                  key={lane.key}
                >
                  <div className="composition-lane-label">
                    <button
                      type="button"
                      aria-label={`${isCollapsed ? "展开" : "折叠"}轨道 ${lane.label}`}
                      onClick={() => toggleLaneCollapsed(lane.key)}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                    <div>
                      <strong>{lane.label}</strong>
                      <span>{lane.hint}</span>
                      <small>{lane.status}</small>
                    </div>
                  </div>
                  {isCollapsed ? (
                    <div className="composition-lane-collapsed">{lane.items.length} 个片段</div>
                  ) : (
                    <div className="composition-lane-canvas">
                    {laneDropTarget &&
                    compositionLaneKey(laneDropTarget) === lane.key &&
                    typeof laneDropTarget.startMs === "number" ? (
                      <div
                        className="timeline-drop-guide"
                        style={{ left: `${Math.round(laneDropTarget.startMs * pxPerTimelineMs)}px` }}
                      />
                    ) : null}
                    {snapLineMs !== undefined ? (
                      <div
                        className="timeline-snap-guide"
                        style={{ left: `${Math.round(snapLineMs * pxPerTimelineMs)}px` }}
                      />
                    ) : null}
                    {lane.items.map(({ step, index, start }) => {
                      const left = Math.max(0, Math.round(start * pxPerTimelineMs));
                      return (
                        <Fragment key={step.id}>
                          {renderStepCard(step, index, {
                            style: { left: `${left}px`, width: `${stepCardWidthPx}px` }
                          })}
                        </Fragment>
                      );
                    })}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
          {dragGhost && draggingStep ? (
            <div
              className="composition-step-ghost"
              style={{
                left: `${dragGhost.clientX - dragGhost.offsetX}px`,
                top: `${dragGhost.clientY - dragGhost.offsetY}px`,
                width: `${dragGhost.width}px`,
                height: `${dragGhost.height}px`
              }}
            >
              {renderStepCard(draggingStep, draggingStepIndex, { ghost: true })}
            </div>
          ) : null}
        </>
      )}

      {track.issues.length > 0 ? (
        <div className="composition-issues">
          {track.issues.map((issue) => (
            <div className={`composition-issue issue-${issue.severity}`} key={issue.id}>
              <strong>{issue.title}</strong>
              <p>{issue.reason}</p>
            </div>
          ))}
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div className="composition-actions">
          <button type="button" className="small-action" onClick={onApply}>
            应用到文档
          </button>
          <button type="button" className="small-action" onClick={onClear}>
            清空轨道
          </button>
          <a
            className="small-action link-action"
            href={`data:text/html;charset=utf-8,${encodeURIComponent(exportCompositionHtml(track))}`}
            download="motion-composition-export.html"
          >
            下载组合 HTML
          </a>
        </div>
      ) : null}
    </section>
  );
}

function GuidelineLibrary() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const filtered = appMotionPresets.filter((preset) => {
    if (!q) return true;
    return (
      preset.label.toLowerCase().includes(q) ||
      preset.summary.toLowerCase().includes(q) ||
      preset.guideline.toLowerCase().includes(q) ||
      appMotionSceneLabels[preset.scene].includes(q) ||
      preset.slot.includes(q)
    );
  });

  return (
    <div className="guideline-library">
      <input
        className="preset-search"
        type="text"
        placeholder="搜索规范…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="guideline-list">
        {filtered.length === 0 ? <p className="empty-state">未找到匹配的规范。</p> : null}
        {filtered.map((preset) => (
          <details className="guideline-card" key={preset.id}>
            <summary>
              <strong>{preset.label}</strong>
              <span className="guideline-scene-tag">{appMotionSceneLabels[preset.scene]}</span>
            </summary>
            <div className="guideline-card-body">
              <p className="guideline-summary">{preset.summary}</p>
              <p className="guideline-constraint">{presetConstraintLabel(preset, createBlankDocument())}</p>
              <dl className="guideline-meta">
                <dt>规范定义</dt>
                <dd>{preset.guideline}</dd>
                <dt>场景</dt>
                <dd>{appMotionSceneLabels[preset.scene]}</dd>
                <dt>槽位</dt>
                <dd>{preset.slot}</dd>
                <dt>不适用场景</dt>
                <dd>{guidelineContraindication(preset)}</dd>
              </dl>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function guidelineContraindication(preset: AppMotionPresetDefinition): string {
  if (preset.id === "skeleton-loading") return "有位移或回弹的场景";
  if (preset.id === "like-bounce") return "大面积容器、弹窗进场";
  if (preset.id === "form-error-shake") return "全局提示、非错误状态";
  if (preset.id === "overlay-fade-in" || preset.id === "overlay-fade-out")
    return "内容主体动效（仅用于遮罩层）";
  if (preset.id === "pull-refresh") return "非手势触发的加载场景";
  if (preset.id === "bottom-sheet-up" || preset.id === "bottom-sheet-down") return "非底部锚定的弹层";
  if (preset.id === "list-stagger") return "单个元素进场（需 3+ 子项）";
  if (preset.scene === "page-transition" && preset.id === "exit-final") return "临时退场（用户可能返回）";
  if (preset.scene === "modal") return "轻量 Toast 提示";
  return "暂无特别限制";
}

function presetConstraintLabel(preset: AppMotionPresetDefinition, document: MotionDocument): string {
  const timeline = preset.apply(document).timeline;
  const easing = timeline?.easing?.type === "spring" ? "弹性" : "非弹性";
  return `${preset.slot} · ${timeline?.durationMs ?? 240}ms · ${easing}`;
}

function Inspector({
  document,
  compositionTrack,
  selectedCompositionStep,
  selectedCompositionStepIndex,
  selectedCompositionStepStartMs,
  suggestions,
  activeTab,
  onTabChange,
  onPatch,
  onUpdateCompositionStep,
  onUpdateCompositionStepStart,
  onResetCompositionStepMotion,
  onLoad,
  onApplySuggestion,
  onIgnoreSuggestion
}: {
  document: MotionDocument;
  compositionTrack: CompositionTrack;
  selectedCompositionStep: CompositionStep | undefined;
  selectedCompositionStepIndex: number;
  selectedCompositionStepStartMs: number;
  suggestions: GuidelineSuggestion[];
  activeTab: "property" | "guideline";
  onTabChange: (tab: "property" | "guideline") => void;
  onPatch: (patch: MotionDocumentPatch) => void;
  onUpdateCompositionStep: (stepId: string, patch: CompositionStepPatch) => void;
  onUpdateCompositionStepStart: (stepId: string, startMs: number) => void;
  onResetCompositionStepMotion: (stepId: string) => void;
  onLoad: (document: MotionDocument) => void;
  onApplySuggestion: (suggestion: GuidelineSuggestion) => void;
  onIgnoreSuggestion: (suggestion: GuidelineSuggestion) => void;
}) {
  const element = primaryElement(document);
  const layer = selectedLayer(document);
  const documentWithComposition = useMemo(
    () => ({ ...document, composition: compositionTrack }),
    [document, compositionTrack]
  );
  const output = useMemo(() => exportHtmlCss(document), [document]);
  const standaloneHtml = useMemo(() => exportStandaloneHtml(document), [document]);
  const selectedStepMotion = selectedCompositionStep
    ? compositionStepMotion(document, selectedCompositionStep)
    : undefined;
  const selectedStagePreset =
    stagePresetOptions.find(
      (option) =>
        option.stage.mode === document.stage.mode &&
        option.stage.width === document.stage.width &&
        option.stage.height === document.stage.height
    )?.value ?? "custom";

  function patchLayer(patch: NonNullable<MotionDocumentPatch["layer"]>) {
    onPatch({ selectedLayerId: patch.id, layer: patch });
  }

  function patchLayerLayout(patch: LayerLayoutPatch) {
    if (!layer?.layout) return;
    patchLayer({ id: layer.id, layout: clampLayerLayout(document, { ...layer.layout, ...patch }) });
  }

  function patchInitial(field: keyof MotionState, value: number) {
    onPatch({ element: { initial: { [field]: value } } });
  }

  function patchAnimate(field: keyof MotionState, value: number) {
    onPatch({ element: { animate: { [field]: value } } });
  }

  function patchCompositionState(phase: "initial" | "animate", field: MotionStateField, value: number) {
    if (!selectedCompositionStep) return;
    onUpdateCompositionStep(selectedCompositionStep.id, { [phase]: { [field]: value } });
  }

  function loadProject(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const value = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(value) as MotionDocument | SavedWorkspace;
        if ("document" in parsed && parsed.document) onLoad(parsed.document);
        else onLoad(parsed as MotionDocument);
      } catch {
        window.alert("项目文件无法识别，请检查 JSON 是否完整。");
      }
    });
    reader.readAsText(file);
  }

  async function uploadBackground(file: File | undefined) {
    const src = await readDataUrl(file);
    if (src) onPatch({ stage: { backgroundImage: src, backgroundAlt: file?.name ?? "背景图" } });
  }

  async function uploadLayerImage(file: File | undefined) {
    if (!layer) return;
    const src = await readDataUrl(file);
    if (!src) return;
    const dimensions = await readImageDimensions(src);
    const layout = layer.layout
      ? {
          ...clampLayerLayout(document, {
            ...fitImageLayout(document, dimensions),
            x: layer.layout.x,
            y: layer.layout.y,
            ...(typeof layer.layout.zIndex === "number" ? { zIndex: layer.layout.zIndex } : {})
          }),
          aspectLocked: true
        }
      : undefined;
    patchLayer({
      id: layer.id,
      content: { src, alt: file?.name ?? layer.name },
      style: { background: "transparent" },
      ...(layout ? { layout } : {})
    });
  }

  return (
    <aside className="inspector-shell">
      <header className="inspector-header">
        <div>
          <p className="eyebrow">参数面板</p>
          <h2>动效文档</h2>
        </div>
      </header>
      <nav className="panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "property"}
          className={activeTab === "property" ? "is-active" : ""}
          onClick={() => onTabChange("property")}
        >
          属性
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "guideline"}
          className={activeTab === "guideline" ? "is-active" : ""}
          onClick={() => onTabChange("guideline")}
        >
          规范
        </button>
      </nav>
      <div className="inspector-scroll">
        {activeTab === "property" ? (
          <>
            <section className="panel-section">
              <p className="eyebrow">项目文件</p>
              <div className="asset-actions">
                <a
                  className="small-action link-action"
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(documentWithComposition, null, 2))}`}
                  download="motion-copilot-project.json"
                >
                  导出项目
                </a>
                <label className="small-action file-action">
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => loadProject(event.target.files?.[0])}
                  />
                  <span>导入项目</span>
                </label>
              </div>
            </section>

            <section className="panel-section">
              <p className="eyebrow">画布与素材</p>
              <label className="field">
                <span>画布尺寸</span>
                <select
                  aria-label="画布尺寸"
                  value={selectedStagePreset}
                  onChange={(event) => {
                    const option = stagePresetOptions.find((item) => item.value === event.target.value);
                    if (option) onPatch({ stage: option.stage });
                  }}
                >
                  <option value="custom">自定义尺寸</option>
                  {stagePresetOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-row">
                <label className="field">
                  <span>宽度</span>
                  <input
                    type="number"
                    value={document.stage.width}
                    onChange={(event) =>
                      onPatch({ stage: { mode: "custom", width: Number(event.target.value) } })
                    }
                  />
                </label>
                <label className="field">
                  <span>高度</span>
                  <input
                    type="number"
                    value={document.stage.height}
                    onChange={(event) =>
                      onPatch({ stage: { mode: "custom", height: Number(event.target.value) } })
                    }
                  />
                </label>
              </div>
              <label className="field">
                <span>背景色</span>
                <input
                  type="color"
                  value={document.stage.background}
                  onChange={(event) => onPatch({ stage: { background: event.target.value } })}
                />
              </label>
              <div className="asset-actions">
                <label className="small-action file-action">
                  <input
                    aria-label="上传背景图"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(event) => void uploadBackground(event.target.files?.[0])}
                  />
                  <span>上传背景图</span>
                </label>
                <button
                  type="button"
                  className="small-action"
                  onClick={() => onPatch({ stage: { backgroundImage: "", backgroundAlt: "" } })}
                >
                  清除背景图
                </button>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>背景适配</span>
                  <select
                    value={document.stage.backgroundFit ?? "cover"}
                    onChange={(event) =>
                      onPatch({ stage: { backgroundFit: event.target.value as ImageFit } })
                    }
                  >
                    {fitOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>背景焦点</span>
                  <select
                    value={document.stage.backgroundPosition ?? "center"}
                    onChange={(event) =>
                      onPatch({ stage: { backgroundPosition: event.target.value as ImagePosition } })
                    }
                  >
                    {positionOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="panel-section">
              <p className="eyebrow">动效参数</p>
              <div className="field-row">
                <label className="field">
                  <span>时长 ms</span>
                  <input
                    type="number"
                    min="0"
                    value={document.timeline.durationMs}
                    onChange={(event) => onPatch({ timeline: { durationMs: Number(event.target.value) } })}
                  />
                </label>
                <label className="field">
                  <span>延迟 ms</span>
                  <input
                    type="number"
                    min="0"
                    value={document.timeline.delayMs}
                    onChange={(event) => onPatch({ timeline: { delayMs: Number(event.target.value) } })}
                  />
                </label>
              </div>
              <div className="easing-field-row">
                <label className="field">
                  <span>缓动</span>
                  <select
                    value={easingValue(document.timeline.easing)}
                    onChange={(event) =>
                      onPatch({
                        timeline: {
                          easing: easingFromValue(event.target.value as ClassicEasingPreset | "spring")
                        }
                      })
                    }
                  >
                    {easingOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <EasingCurvePreview easing={easingValue(document.timeline.easing)} />
              </div>
              <div className="state-grid">
                <span />
                <strong>起始</strong>
                <strong>结束</strong>
                {(["y", "scale", "opacity", "blur"] as const).map((field) => (
                  <Fragment key={field}>
                    <span key={`${field}-label`}>{field}</span>
                    <input
                      key={`${field}-initial`}
                      type="number"
                      step={field === "scale" || field === "opacity" ? "0.01" : "1"}
                      value={element.initial[field] ?? (field === "scale" || field === "opacity" ? 1 : 0)}
                      onChange={(event) => patchInitial(field, Number(event.target.value))}
                    />
                    <input
                      key={`${field}-animate`}
                      type="number"
                      step={field === "scale" || field === "opacity" ? "0.01" : "1"}
                      value={element.animate[field] ?? (field === "scale" || field === "opacity" ? 1 : 0)}
                      onChange={(event) => patchAnimate(field, Number(event.target.value))}
                    />
                  </Fragment>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <p className="eyebrow">编排片段参数</p>
              {selectedCompositionStep ? (
                <>
                  <div className="selected-layer-readout">
                    <strong>{selectedCompositionStep.label}</strong>
                    <span>
                      {selectedCompositionStep.target === "selected-layer"
                        ? (selectedCompositionStep.layerName ?? "图层")
                        : "未绑定图层"}
                    </span>
                  </div>
                  <div className="field-row">
                    <label className="field">
                      <span>开始时间 ms</span>
                      <input
                        aria-label="片段开始时间 ms"
                        type="number"
                        min="0"
                        step="10"
                        value={selectedCompositionStepStartMs}
                        onChange={(event) =>
                          onUpdateCompositionStepStart(selectedCompositionStep.id, Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>片段时长 ms</span>
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={selectedCompositionStep.durationMs}
                        onChange={(event) =>
                          onUpdateCompositionStep(selectedCompositionStep.id, {
                            durationMs: Math.max(1, Number(event.target.value))
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>编排关系</span>
                    <select
                      value={selectedCompositionStep.timing}
                      disabled={selectedCompositionStepIndex <= 0}
                      onChange={(event) =>
                        onUpdateCompositionStep(selectedCompositionStep.id, {
                          timing: event.target.value as CompositionStep["timing"]
                        })
                      }
                    >
                      <option value="sequential">串行：上一段结束后</option>
                      <option value="parallel">并行：上一段开始后</option>
                    </select>
                  </label>
                  {selectedStepMotion ? (
                    <>
                      <div className="easing-field-row">
                        <label className="field">
                          <span>片段缓动</span>
                          <select
                            value={easingValue(selectedStepMotion.easing)}
                            onChange={(event) =>
                              onUpdateCompositionStep(selectedCompositionStep.id, {
                                easing: easingFromValue(event.target.value as ClassicEasingPreset | "spring")
                              })
                            }
                          >
                            {easingOptions.map((option) => (
                              <option value={option.value} key={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <EasingCurvePreview easing={easingValue(selectedStepMotion.easing)} />
                      </div>
                      <div className="composition-state-fields">
                        {compositionMotionFields.map(({ field, label, step, min, max }) => (
                          <div className="field-row" key={field}>
                            <label className="field">
                              <span>起始 {label}</span>
                              <input
                                aria-label={`起始 ${label}`}
                                type="number"
                                step={step}
                                min={min}
                                max={max}
                                value={selectedStepMotion.initial[field]}
                                onChange={(event) =>
                                  patchCompositionState("initial", field, Number(event.target.value))
                                }
                              />
                            </label>
                            <label className="field">
                              <span>结束 {label}</span>
                              <input
                                aria-label={`结束 ${label}`}
                                type="number"
                                step={step}
                                min={min}
                                max={max}
                                value={selectedStepMotion.animate[field]}
                                onChange={(event) =>
                                  patchCompositionState("animate", field, Number(event.target.value))
                                }
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="small-action"
                        onClick={() => onResetCompositionStepMotion(selectedCompositionStep.id)}
                      >
                        恢复预设默认值
                      </button>
                    </>
                  ) : null}
                  <p className="empty-state">
                    这里控制的是当前选中的编排片段。开始时间会写入时间轴；系统内部会根据串行或并行关系自动换算。
                  </p>
                </>
              ) : (
                <p className="empty-state">
                  在底部编排轨道中选择一个动效片段后，可以单独调整它的开始时间、时长、串并行关系、起止状态和缓动。
                </p>
              )}
            </section>

            <section className="panel-section">
              <p className="eyebrow">已应用动效</p>
              {(document.appliedPresets ?? []).length === 0 ? (
                <p className="empty-state">还没有应用 App 规范动效。</p>
              ) : null}
              {(document.appliedPresets ?? []).map((preset) => {
                const definition = appMotionPresetById.get(preset.id as AppMotionPresetId);
                return (
                  <div
                    className="preset-stack-row"
                    key={`${preset.target ?? "target"}-${preset.layerId ?? "target"}-${preset.slot}-${preset.id}`}
                  >
                    <div className="preset-stack-header">
                      <strong>{preset.label}</strong>
                      <span>{appliedPresetTargetLabel(preset)}</span>
                    </div>
                    {definition ? (
                      <div className="preset-guideline-detail">
                        <p className="guideline-summary">{definition.summary}</p>
                        <dl className="guideline-meta">
                          <dt>规范定义</dt>
                          <dd>{definition.guideline}</dd>
                          <dt>适用场景</dt>
                          <dd>{appMotionSceneLabels[definition.scene]}</dd>
                          <dt>槽位</dt>
                          <dd>{definition.slot}</dd>
                        </dl>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>

            <section className="panel-section">
              <p className="eyebrow">规范修正</p>
              {(document.presetResolutions ?? []).length === 0 ? (
                <p className="empty-state">当前组合没有触发自动修正。</p>
              ) : null}
              {(document.presetResolutions ?? []).map((resolution) => (
                <article className="preset-resolution" key={`${resolution.id}-${resolution.presetId}`}>
                  <div className="suggestion-title">
                    <strong>{resolution.title}</strong>
                    <span>{resolution.action}</span>
                  </div>
                  <p>{resolution.reason}</p>
                </article>
              ))}
            </section>

            {layer ? (
              <section className="panel-section">
                <p className="eyebrow">内容与动效</p>
                <div className="selected-layer-readout">
                  <strong>{layer.name}</strong>
                  <span>{layer.kind}</span>
                </div>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={!layer.hidden}
                    onChange={(event) => patchLayer({ id: layer.id, hidden: !event.target.checked })}
                  />
                  <span>显示图层</span>
                </label>
                {layer.content?.text !== undefined ? (
                  <label className="field">
                    <span>文案</span>
                    <textarea
                      className="compact-textarea"
                      value={layer.content.text}
                      onChange={(event) =>
                        patchLayer({ id: layer.id, content: { text: event.target.value } })
                      }
                    />
                  </label>
                ) : null}
                {layer.layout ? (
                  <>
                    <div className="field-row">
                      <label className="field">
                        <span>X</span>
                        <input
                          type="number"
                          value={layer.layout.x}
                          onChange={(event) => patchLayerLayout({ x: Number(event.target.value) })}
                        />
                      </label>
                      <label className="field">
                        <span>Y</span>
                        <input
                          type="number"
                          value={layer.layout.y}
                          onChange={(event) => patchLayerLayout({ y: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>宽</span>
                        <input
                          type="number"
                          value={layer.layout.width}
                          onChange={(event) => patchLayerLayout({ width: Number(event.target.value) })}
                        />
                      </label>
                      <label className="field">
                        <span>高</span>
                        <input
                          type="number"
                          value={layer.layout.height}
                          onChange={(event) => patchLayerLayout({ height: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>透明度</span>
                        <input
                          aria-label="图层透明度"
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={layer.style?.opacity ?? 1}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, style: { opacity: Number(event.target.value) } })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>圆角</span>
                        <input
                          aria-label="图层圆角"
                          type="number"
                          min="0"
                          step="1"
                          value={layer.style?.radius ?? 0}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, style: { radius: Number(event.target.value) } })
                          }
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>前景色</span>
                        <input
                          type="color"
                          value={layer.style?.color ?? "#1f2328"}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, style: { color: event.target.value } })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>背景色</span>
                        <input
                          type="color"
                          value={layer.style?.background ?? "#ffffff"}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, style: { background: event.target.value } })
                          }
                        />
                      </label>
                    </div>
                    {layer.kind === "text" ? (
                      <>
                        <div className="field-row">
                          <label className="field">
                            <span>字号</span>
                            <input
                              aria-label="文本字号"
                              type="number"
                              min="8"
                              max="96"
                              step="1"
                              value={layer.style?.fontSize ?? 13}
                              onChange={(event) =>
                                patchLayer({ id: layer.id, style: { fontSize: Number(event.target.value) } })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>字重</span>
                            <select
                              aria-label="文本字重"
                              value={String(layer.style?.fontWeight ?? 500)}
                              onChange={(event) =>
                                patchLayer({
                                  id: layer.id,
                                  style: { fontWeight: Number(event.target.value) }
                                })
                              }
                            >
                              <option value="400">常规</option>
                              <option value="500">中等</option>
                              <option value="700">加粗</option>
                              <option value="800">强调</option>
                            </select>
                          </label>
                        </div>
                        <div className="field-row">
                          <label className="field">
                            <span>行高</span>
                            <input
                              aria-label="文本行高"
                              type="number"
                              min="0.8"
                              max="3"
                              step="0.1"
                              value={layer.style?.lineHeight ?? 1}
                              onChange={(event) =>
                                patchLayer({
                                  id: layer.id,
                                  style: { lineHeight: Number(event.target.value) }
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>对齐</span>
                            <select
                              aria-label="文本对齐"
                              value={layer.style?.textAlign ?? "center"}
                              onChange={(event) =>
                                patchLayer({
                                  id: layer.id,
                                  style: { textAlign: event.target.value as "left" | "center" | "right" }
                                })
                              }
                            >
                              <option value="left">左对齐</option>
                              <option value="center">居中</option>
                              <option value="right">右对齐</option>
                            </select>
                          </label>
                        </div>
                      </>
                    ) : null}
                    {layer.kind === "image" ? (
                      <div className="field-row">
                        <label className="field">
                          <span>图片适配</span>
                          <select
                            aria-label="图片适配"
                            value={layer.style?.fit ?? "cover"}
                            onChange={(event) =>
                              patchLayer({ id: layer.id, style: { fit: event.target.value as ImageFit } })
                            }
                          >
                            {fitOptions.map((option) => (
                              <option value={option.value} key={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>图片焦点</span>
                          <select
                            aria-label="图片焦点"
                            value={layer.style?.position ?? "center"}
                            onChange={(event) =>
                              patchLayer({
                                id: layer.id,
                                style: { position: event.target.value as ImagePosition }
                              })
                            }
                          >
                            {positionOptions.map((option) => (
                              <option value={option.value} key={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                    <label className="field">
                      <span>图层动效</span>
                      <select
                        value={layer.motion?.preset ?? "none"}
                        onChange={(event) =>
                          patchLayer({
                            id: layer.id,
                            motion: { preset: event.target.value as LayerMotionPreset }
                          })
                        }
                      >
                        {motionOptions.map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                {layer.kind === "image" ? (
                  <div className="asset-actions">
                    <label className="small-action file-action">
                      <input
                        aria-label="上传图层图片"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => void uploadLayerImage(event.target.files?.[0])}
                      />
                      <span>上传图片</span>
                    </label>
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => patchLayer({ id: layer.id, content: { src: "" } })}
                    >
                      清除图片
                    </button>
                  </div>
                ) : null}
                {layer.layout ? (
                  <div className="field-row">
                    <label className="field">
                      <span>图层时长</span>
                      <input
                        type="number"
                        min="0"
                        value={layer.motion?.durationMs ?? 220}
                        onChange={(event) =>
                          patchLayer({ id: layer.id, motion: { durationMs: Number(event.target.value) } })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>图层延迟</span>
                      <input
                        type="number"
                        min="0"
                        value={layer.motion?.delayMs ?? 0}
                        onChange={(event) =>
                          patchLayer({ id: layer.id, motion: { delayMs: Number(event.target.value) } })
                        }
                      />
                    </label>
                  </div>
                ) : null}
                {layer.layout ? (
                  <>
                    <div className="field-row">
                      <label className="field">
                        <span>入场方向</span>
                        <select
                          value={layer.motion?.direction ?? ""}
                          onChange={(event) =>
                            patchLayer({
                              id: layer.id,
                              motion: {
                                direction: (event.target.value ||
                                  undefined) as MotionLayer["motion"] extends { direction?: infer D }
                                  ? D
                                  : never
                              }
                            })
                          }
                        >
                          <option value="">默认</option>
                          <option value="up">上</option>
                          <option value="down">下</option>
                          <option value="left">左</option>
                          <option value="right">右</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>位移距离</span>
                        <input
                          type="number"
                          min="0"
                          step="2"
                          value={layer.motion?.distance ?? 18}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, motion: { distance: Number(event.target.value) } })
                          }
                        />
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>缩放起始</span>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.01"
                          value={layer.motion?.scaleFrom ?? 1}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, motion: { scaleFrom: Number(event.target.value) } })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>缓动</span>
                        <select
                          value={
                            layer.motion?.easing
                              ? layer.motion.easing.type === "spring"
                                ? "spring"
                                : layer.motion.easing.preset
                              : "decelerate"
                          }
                          onChange={(event) =>
                            patchLayer({
                              id: layer.id,
                              motion: {
                                easing: easingFromValue(event.target.value as ClassicEasingPreset | "spring")
                              }
                            })
                          }
                        >
                          {easingOptions.map((option) => (
                            <option value={option.value} key={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>透明度起始</span>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={layer.motion?.opacityFrom ?? 0}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, motion: { opacityFrom: Number(event.target.value) } })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>透明度结束</span>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={layer.motion?.opacityTo ?? 1}
                          onChange={(event) =>
                            patchLayer({ id: layer.id, motion: { opacityTo: Number(event.target.value) } })
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}
          </>
        ) : (
          <>
            <section className="panel-section">
              <p className="eyebrow">规范建议</p>
              {suggestions.length === 0 ? <p className="empty-state">当前参数没有明显风险。</p> : null}
              {suggestions.map((suggestion) => (
                <article
                  className={`suggestion suggestion-${suggestion.severity}`}
                  id={`suggestion-${suggestion.id}`}
                  key={suggestion.id}
                >
                  <div className="suggestion-title">
                    <strong>{suggestion.title}</strong>
                    <span>{suggestion.status === "applied" ? "已应用" : suggestion.severity}</span>
                  </div>
                  <p>{suggestion.reason}</p>
                  <div className="suggestion-actions">
                    <button
                      type="button"
                      disabled={!suggestion.suggestedPatch}
                      onClick={() => onApplySuggestion(suggestion)}
                    >
                      应用建议
                    </button>
                    <button type="button" onClick={() => onIgnoreSuggestion(suggestion)}>
                      忽略
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <section className="panel-section">
              <p className="eyebrow">规范库</p>
              <GuidelineLibrary />
            </section>

            <section className="panel-section">
              <p className="eyebrow">导出代码</p>
              <div className="asset-actions">
                <a
                  className="small-action link-action"
                  href={`data:text/html;charset=utf-8,${encodeURIComponent(standaloneHtml)}`}
                  download="motion-copilot-export.html"
                >
                  下载完整 HTML
                </a>
              </div>
              <textarea
                className="export-output"
                readOnly
                spellCheck={false}
                value={`${output.html}\n\n<style>\n${output.css}\n</style>`}
              />
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

export function App() {
  const [savedWorkspace] = useState(readSavedWorkspace);
  const [motionDocument, setMotionDocument] = useState(() =>
    withGuidelines(savedWorkspace?.document ?? createBlankDocument())
  );
  const [prompt, setPrompt] = useState(savedWorkspace?.prompt ?? defaultPrompt);
  const [hasStarted, setHasStarted] = useState(savedWorkspace?.hasStarted ?? false);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState<Record<string, SuggestionStatus>>({});
  const [presetTarget, setPresetTarget] = useState<AppMotionPresetTarget>(
    savedWorkspace?.presetTarget === "target" ? "selected-layer" : (savedWorkspace?.presetTarget ?? "selected-layer")
  );
  const [compositionSteps, setCompositionSteps] = useState<CompositionStep[]>(
    savedWorkspace?.compositionSteps ?? savedWorkspace?.document.composition?.steps ?? []
  );
  const [selectedCompositionStepId, setSelectedCompositionStepId] = useState<string | undefined>(undefined);
  const [presetFilter, setPresetFilter] = useState("");
  const [activePresetTab, setActivePresetTab] = useState<PresetLibraryTabId>("recommended");
  const [interactionMode, setInteractionMode] = useState<"playback" | "gesture">("playback");
  const [rightTab, setRightTab] = useState<"property" | "guideline">("property");
  const [projectNotice, setProjectNotice] = useState<string | undefined>(
    savedWorkspace?.hasStarted ? "已恢复上次自动保存的项目" : undefined
  );
  const [compositionHeight, setCompositionHeight] = useState(defaultCompositionHeight);
  const [draggingLayerListId, setDraggingLayerListId] = useState<string | undefined>(undefined);
  const [layerListDropTargetId, setLayerListDropTargetId] = useState<string | undefined>(undefined);
  const [layerListGhost, setLayerListGhost] = useState<
    | {
        layerId: string;
        clientX: number;
        clientY: number;
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
      }
    | undefined
  >(undefined);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !globalThis.localStorage?.getItem("mc-onboarded")
  );
  const animationRef = useRef<number | undefined>(undefined);
  const loopTimeoutRef = useRef<number | undefined>(undefined);
  const playheadRef = useRef(0);
  const layerListDragRef = useRef<
    | {
        layerId: string;
        pointerId: number;
        startX: number;
        startY: number;
        width: number;
        height: number;
        offsetX: number;
        offsetY: number;
        moved: boolean;
      }
    | undefined
  >(undefined);
  const storageSaveRef = useRef<number | undefined>(undefined);

  const compositionTrack: CompositionTrack = useMemo(
    () => evaluateComposition(compositionSteps),
    [compositionSteps]
  );

  function clearLoopTimer() {
    if (loopTimeoutRef.current) {
      window.clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = undefined;
    }
  }

  function patchDocument(
    patch: MotionDocumentPatch,
    options: { resetPreview?: boolean; emptyBase?: "blank" | "example"; evaluateGuidelines?: boolean } = {}
  ) {
    setMotionDocument((current) => {
      const emptyBase = options.emptyBase === "blank" ? createBlankDocument() : createExampleDocument();
      const next = applyDocumentPatch(hasStarted ? current : emptyBase, patch);
      return options.evaluateGuidelines === false
        ? { ...next, guidelineSuggestions: current.guidelineSuggestions }
        : withGuidelines(next);
    });
    setHasStarted(true);
    if (options.resetPreview ?? true) {
      clearLoopTimer();
      setPlayhead(0);
      setIsPlaying(false);
    }
  }

  function createLayer(kind: SupportedCreateLayerKind) {
    patchDocument(
      { addLayer: addLayer(hasStarted ? motionDocument : createBlankDocument(), kind) },
      { resetPreview: false, emptyBase: "blank" }
    );
    setPresetTarget("selected-layer");
    setRightTab("property");
  }

  async function importImageLayer(file: File | undefined) {
    const src = await readDataUrl(file);
    if (!src) return;
    const baseDocument = hasStarted ? motionDocument : createBlankDocument();
    const dimensions = await readImageDimensions(src);
    const layer = addLayer(baseDocument, "image");
    patchDocument(
      {
        addLayer: {
          ...layer,
          name: file?.name ? file.name.replace(/\.[^.]+$/, "") : layer.name,
          content: { ...layer.content, src, alt: file?.name ?? layer.name },
          style: { ...layer.style, background: "transparent" },
          layout: fitImageLayout(baseDocument, dimensions)
        }
      },
      { resetPreview: false, emptyBase: "blank" }
    );
    setPresetTarget("selected-layer");
    setRightTab("property");
  }

  function moveLayer(layerId: string, layout: LayerLayoutPatch) {
    const layer = layerById(motionDocument, layerId);
    const nextLayout = layer?.layout
      ? clampLayerLayout(motionDocument, { ...layer.layout, ...layout })
      : layout;
    patchDocument(
      { selectedLayerId: layerId, layer: { id: layerId, layout: nextLayout } },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
  }

  function renameLayer(layerId: string, name: string) {
    patchDocument(
      { selectedLayerId: layerId, layer: { id: layerId, name } },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
  }

  function removeLayer(layerId: string) {
    setCompositionSteps((current) => current.filter((step) => step.layerId !== layerId));
    setSelectedCompositionStepId((current) => {
      const selectedStep = compositionSteps.find((step) => step.id === current);
      return selectedStep?.layerId === layerId ? undefined : current;
    });
    patchDocument(
      { removeLayerId: layerId },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
  }

  function duplicateLayer(layerId: string) {
    const source = layerById(motionDocument, layerId);
    if (!source) return;
    const suffix = Date.now().toString(36);
    const copiedLayer = cloneLayerForCopy(source, suffix);
    const { layout: _layout, ...copiedLayerBase } = copiedLayer;
    patchDocument(
      {
        addLayer: {
          ...copiedLayerBase,
          name: `${source.name} 副本`,
          ...(source.layout ? { layout: shiftedLayerLayout(motionDocument, source.layout, 18) } : {})
        }
      },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
    setPresetTarget("selected-layer");
    setRightTab("property");
  }

  function toggleLayerLocked(layer: MotionLayer) {
    patchDocument(
      { selectedLayerId: layer.id, layer: { id: layer.id, locked: !layer.locked } },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
  }

  function toggleLayerHidden(layer: MotionLayer) {
    patchDocument(
      { selectedLayerId: layer.id, layer: { id: layer.id, hidden: !layer.hidden } },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
  }

  function reorderLayer(layerId: string, action: "forward" | "backward" | "front" | "back") {
    patchDocument(
      { selectedLayerId: layerId, reorderLayer: { id: layerId, action } },
      { resetPreview: false, emptyBase: "blank", evaluateGuidelines: false }
    );
  }

  function reorderLayerToTarget(sourceLayerId: string, targetLayerId: string) {
    if (sourceLayerId === targetLayerId) return;
    setMotionDocument((current) => {
      const document = normalizeMotionDocument(current);
      const orderedLayers = orderedEditableLayers(document).filter((layer) => layer.layout);
      const sourceIndex = orderedLayers.findIndex((layer) => layer.id === sourceLayerId);
      const targetIndex = orderedLayers.findIndex((layer) => layer.id === targetLayerId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const nextOrdered = [...orderedLayers];
      const [source] = nextOrdered.splice(sourceIndex, 1);
      if (!source) return current;
      const targetIndexAfterRemoval = nextOrdered.findIndex((layer) => layer.id === targetLayerId);
      nextOrdered.splice(Math.max(0, targetIndexAfterRemoval), 0, source);
      const zIndexById = new Map(nextOrdered.map((layer, index) => [layer.id, 31 + index]));
      return withGuidelines({
        ...document,
        selectedLayerId: sourceLayerId,
        layers: document.layers.map((layer) => {
          const zIndex = zIndexById.get(layer.id);
          return typeof zIndex === "number" && layer.layout
            ? { ...layer, layout: { ...layer.layout, zIndex } }
            : layer;
        })
      });
    });
    setHasStarted(true);
    setPresetTarget("selected-layer");
    setRightTab("property");
  }

  function cleanupLayerListDrag() {
    window.removeEventListener("pointermove", handleLayerListDragMove);
    window.removeEventListener("pointerup", handleLayerListDragEnd);
    window.removeEventListener("pointercancel", handleLayerListDragEnd);
    layerListDragRef.current = undefined;
    setDraggingLayerListId(undefined);
    setLayerListDropTargetId(undefined);
    setLayerListGhost(undefined);
  }

  function beginLayerListDrag(event: React.PointerEvent<HTMLSpanElement>, layer: MotionLayer) {
    if (motionDocument.selectedLayerId !== layer.id || !layer.layout || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.closest<HTMLElement>(".command-layer-row")?.getBoundingClientRect();
    if (!rect) return;
    layerListDragRef.current = {
      layerId: layer.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    setDraggingLayerListId(layer.id);
    window.addEventListener("pointermove", handleLayerListDragMove);
    window.addEventListener("pointerup", handleLayerListDragEnd);
    window.addEventListener("pointercancel", handleLayerListDragEnd);
  }

  function updateLayerListDrag(event: PointerEvent) {
    const drag = layerListDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 4;
    if (!moved && !drag.moved) return;
    if (!drag.moved) {
      drag.moved = true;
      setLayerListGhost({
        layerId: drag.layerId,
        clientX: event.clientX,
        clientY: event.clientY,
        width: drag.width,
        height: drag.height,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY
      });
    } else {
      setLayerListGhost((current) =>
        current ? { ...current, clientX: event.clientX, clientY: event.clientY } : current
      );
    }
    const target = globalThis.document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".command-layer-row");
    const targetLayerId = target?.dataset.layerId;
    setLayerListDropTargetId(targetLayerId && targetLayerId !== drag.layerId ? targetLayerId : undefined);
  }

  function handleLayerListDragMove(event: PointerEvent) {
    updateLayerListDrag(event);
  }

  function handleLayerListDragEnd(event: PointerEvent) {
    const drag = layerListDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = globalThis.document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".command-layer-row");
    const targetLayerId = target?.dataset.layerId;
    if (drag.moved && targetLayerId) reorderLayerToTarget(drag.layerId, targetLayerId);
    cleanupLayerListDrag();
  }

  function applyPreset(presetId: AppMotionPresetId) {
    setMotionDocument((current) =>
      withGuidelines(
        applyAppMotionPreset(hasStarted ? current : createExampleDocument(), presetId, {
          target: presetTarget
        })
      )
    );
    setHasStarted(true);
    clearLoopTimer();
    setPlayhead(0);
    setIsPlaying(false);
  }

  function addToComposition(presetId: AppMotionPresetId) {
    const preset = appMotionPresetById.get(presetId);
    if (!preset) return;
    const baseDocument = hasStarted ? motionDocument : createExampleDocument();
    const layer = presetTarget === "selected-layer" ? selectedLayer(baseDocument) : undefined;
    const step: CompositionStep = {
      id: `step-${Date.now().toString(36)}`,
      presetId: preset.id,
      label: preset.label,
      target: presetTarget,
      ...(layer ? { layerId: layer.id, layerName: layer.name } : {}),
      timing: "sequential",
      delayMs: 0,
      durationMs: preset.apply(baseDocument).timeline?.durationMs ?? 240,
      slot: preset.slot
    };
    if (!hasStarted) setMotionDocument(baseDocument);
    setCompositionSteps((current) => [...current, step]);
    setSelectedCompositionStepId(step.id);
    setHasStarted(true);
  }

  function addComboToComposition(combo: CompositionPresetCombo) {
    const baseDocument = hasStarted ? motionDocument : createExampleDocument();
    const layer = presetTarget === "selected-layer" ? selectedLayer(baseDocument) : undefined;
    const createdAt = Date.now().toString(36);
    const steps = combo.presetIds
      .map((presetId, index): CompositionStep | undefined => {
        const preset = appMotionPresetById.get(presetId);
        if (!preset) return undefined;
        return {
          id: `step-${createdAt}-${index}`,
          presetId: preset.id,
          label: preset.label,
          target: presetTarget,
          ...(layer ? { layerId: layer.id, layerName: layer.name } : {}),
          timing: index === 0 ? "sequential" : "parallel",
          delayMs: index === 0 ? 0 : 80,
          durationMs: preset.apply(baseDocument).timeline?.durationMs ?? 240,
          slot: preset.slot
        };
      })
      .filter((step): step is CompositionStep => Boolean(step));
    if (steps.length === 0) return;
    if (!hasStarted) setMotionDocument(baseDocument);
    setCompositionSteps((current) => [...current, ...steps]);
    setSelectedCompositionStepId(steps[0]?.id);
    setHasStarted(true);
  }

  function removeCompositionStep(stepId: string) {
    setCompositionSteps((current) => {
      const next = current.filter((s) => s.id !== stepId);
      if (selectedCompositionStepId === stepId) setSelectedCompositionStepId(next[0]?.id);
      return next;
    });
  }

  function toggleStepTiming(stepId: string) {
    setCompositionSteps((current) =>
      current.map((s) =>
        s.id === stepId ? { ...s, timing: s.timing === "sequential" ? "parallel" : "sequential" } : s
      )
    );
  }

  function updateCompositionStep(stepId: string, patch: CompositionStepPatch) {
    setCompositionSteps((current) =>
      current.map((step, index) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          ...(typeof patch.delayMs === "number" ? { delayMs: Math.max(0, patch.delayMs) } : {}),
          ...(typeof patch.durationMs === "number" ? { durationMs: Math.max(1, patch.durationMs) } : {}),
          ...(patch.timing && index > 0 ? { timing: patch.timing } : {}),
          ...(patch.initial ? { initial: { ...(step.initial ?? {}), ...patch.initial } } : {}),
          ...(patch.animate ? { animate: { ...(step.animate ?? {}), ...patch.animate } } : {}),
          ...(patch.easing ? { easing: patch.easing } : {})
        };
      })
    );
  }

  function updateCompositionStepStart(stepId: string, startMs: number) {
    setCompositionSteps((current) => updateStepStart(current, stepId, startMs));
  }

  function resetCompositionStepMotion(stepId: string) {
    setCompositionSteps((current) =>
      current.map((step) => {
        if (step.id !== stepId) return step;
        const { initial: _initial, animate: _animate, easing: _easing, ...rest } = step;
        return rest;
      })
    );
  }

  function reorderStep(sourceStepId: string, targetStepId: string, placement: "before" | "after") {
    setCompositionSteps((current) => {
      const sourceIndex = current.findIndex((step) => step.id === sourceStepId);
      const targetIndex = current.findIndex((step) => step.id === targetStepId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;

      const source = current[sourceIndex]!;
      const withoutSource = current.filter((step) => step.id !== sourceStepId);
      const targetIndexAfterRemoval = withoutSource.findIndex((step) => step.id === targetStepId);
      const insertIndex = placement === "before" ? targetIndexAfterRemoval : targetIndexAfterRemoval + 1;
      const next = [...withoutSource];
      next.splice(insertIndex, 0, source);
      return next.map((step, index) =>
        index === 0 && step.timing === "parallel" ? { ...step, timing: "sequential" } : step
      );
    });
  }

  function moveStepToLane(stepId: string, target: CompositionLaneDropTarget) {
    setCompositionSteps((current) => {
      const sourceIndex = current.findIndex((step) => step.id === stepId);
      if (sourceIndex < 0) return current;

      const source = current[sourceIndex]!;
      const sourceLaneKey = compositionLaneKey(source);
      const targetLaneKey = compositionLaneKey(target);
      if (sourceLaneKey === targetLaneKey) {
        if (typeof target.startMs !== "number") return current;
        return updateStepStart(current, stepId, target.startMs);
      }
      const withoutSource = current.filter((step) => step.id !== stepId);
      const lastLaneIndex = withoutSource.reduce((lastIndex, step, index) => {
        return compositionLaneKey(step) === targetLaneKey ? index : lastIndex;
      }, -1);
      const insertIndex = lastLaneIndex >= 0 ? lastLaneIndex + 1 : withoutSource.length;
      const moved: CompositionStep = {
        ...source,
        target: target.target,
        ...(target.layerId ? { layerId: target.layerId } : {}),
        ...(target.layerName ? { layerName: target.layerName } : {})
      };

      if (target.target === "target") {
        delete moved.layerId;
        delete moved.layerName;
      }

      const next = [...withoutSource];
      next.splice(insertIndex, 0, moved);
      const windows = computeCompositionStepWindows(next);
      return next.map((step, index) => {
        if (index === 0) return { ...step, timing: "sequential" };
        if (step.id === stepId) {
          const previous = windows[index - 1];
          if (!previous || typeof target.startMs !== "number") {
            return lastLaneIndex >= 0 ? { ...step, timing: "parallel", delayMs: 0 } : step;
          }
          const timing = target.startMs >= previous.end ? "sequential" : "parallel";
          const base = timing === "sequential" ? previous.end : previous.start;
          return { ...step, timing, delayMs: Math.max(0, target.startMs - base) };
        }
        return step;
      });
    });
  }

  function applyCompositionToDocument() {
    setMotionDocument((current) => {
      let doc = current;
      for (const step of compositionSteps) {
        const target: AppMotionPresetTarget = step.target;
        if (target === "selected-layer" && step.layerId) {
          doc = { ...doc, selectedLayerId: step.layerId };
        }
        doc = withGuidelines(applyAppMotionPreset(doc, step.presetId as AppMotionPresetId, { target }));
      }
      return { ...doc, composition: compositionTrack };
    });
    clearLoopTimer();
    setPlayhead(0);
    setIsPlaying(false);
  }

  function clearComposition() {
    clearLoopTimer();
    setCompositionSteps([]);
    setSelectedCompositionStepId(undefined);
  }

  function createBlankProject() {
    setMotionDocument(createBlankDocument());
    setPrompt("");
    setCompositionSteps([]);
    setSelectedCompositionStepId(undefined);
    setPresetTarget("selected-layer");
    setHasStarted(true);
    setSuggestionStatus({});
    clearLoopTimer();
    setPlayhead(0);
    setIsPlaying(false);
    setProjectNotice("已新建空白项目");
  }

  function loadExampleProject() {
    setMotionDocument(createExampleDocument());
    setPrompt(defaultPrompt);
    setCompositionSteps([]);
    setSelectedCompositionStepId(undefined);
    setPresetTarget("selected-layer");
    setHasStarted(true);
    setSuggestionStatus({});
    clearLoopTimer();
    setPlayhead(0);
    setIsPlaying(false);
    setProjectNotice("已加载示例项目");
  }

  function loadDocument(document: MotionDocument) {
    const normalizedDocument = normalizeMotionDocument(document);
    setMotionDocument(withGuidelines(normalizedDocument));
    setHasStarted(true);
    setSuggestionStatus({});
    setCompositionSteps(normalizedDocument.composition?.steps ?? []);
    setSelectedCompositionStepId(normalizedDocument.composition?.steps[0]?.id);
    clearLoopTimer();
    setPlayhead(0);
    setIsPlaying(false);
    setProjectNotice("已导入项目文件");
  }

  function clearSavedProject() {
    globalThis.localStorage?.removeItem(workspaceStorageKey);
    setProjectNotice("已清除本地自动保存");
  }

  function applySuggestion(suggestion: GuidelineSuggestion) {
    if (suggestion.suggestedPatch) patchDocument(suggestion.suggestedPatch);
    setSuggestionStatus((current) => ({ ...current, [suggestion.id]: "applied" }));
  }

  function ignoreSuggestion(suggestion: GuidelineSuggestion) {
    setSuggestionStatus((current) => ({ ...current, [suggestion.id]: "ignored" }));
  }

  function playPreview() {
    clearLoopTimer();
    setIsPlaying(true);
  }

  function pausePreview() {
    clearLoopTimer();
    setIsPlaying(false);
  }

  function toggleLoop() {
    clearLoopTimer();
    setIsLooping((current) => !current);
  }

  function resetPreview() {
    clearLoopTimer();
    setPlayhead(0);
    setIsPlaying(false);
  }

  function seek(progress: number) {
    clearLoopTimer();
    setPlayhead(clampProgress(progress));
    setIsPlaying(false);
  }

  const suggestions = useMemo(
    () =>
      motionDocument.guidelineSuggestions
        .map((suggestion) => ({
          ...suggestion,
          status: suggestionStatus[suggestion.id] ?? suggestion.status
        }))
        .filter((suggestion) => suggestion.status !== "ignored"),
    [motionDocument, suggestionStatus]
  );
  const selectedPresetLayer = selectedLayer(motionDocument);
  const previewDurationMs =
    compositionTrack.steps.length > 0
      ? Math.max(1, compositionTrack.totalDurationMs)
      : Math.max(1, motionDocument.timeline.durationMs);
  const activeStepIdsValue =
    compositionTrack.steps.length > 0
      ? activeCompositionStepIds(compositionTrack, playhead)
      : new Set<string>();
  const selectedCompositionStep = compositionSteps.find((step) => step.id === selectedCompositionStepId);
  const selectedCompositionStepIndex = selectedCompositionStep
    ? compositionSteps.findIndex((step) => step.id === selectedCompositionStep.id)
    : -1;
  const selectedCompositionStepStartMs = selectedCompositionStep
    ? absoluteStartForStep(compositionSteps, selectedCompositionStep.id)
    : 0;
  const editableLayers = orderedEditableLayers(motionDocument);
  const presetQuery = presetFilter.trim().toLowerCase();
  const recommendedPresetIds =
    selectedPresetLayer && recommendedPresetIdsByLayerKind[selectedPresetLayer.kind]
      ? recommendedPresetIdsByLayerKind[selectedPresetLayer.kind]!
      : (["enter-screen", "container-transform", "move-inside", "loading-to-success"] satisfies AppMotionPresetId[]);
  const activePresetGroup = appMotionPresetGroups.find((group) => group.scene === activePresetTab);
  const activeCategoryPresets =
    activePresetTab === "recommended"
      ? recommendedPresetIds.map((presetId) => appMotionPresetById.get(presetId)).filter((preset): preset is AppMotionPresetDefinition => Boolean(preset))
      : activePresetGroup
        ? activePresetGroup.presetIds
            .map((presetId) => appMotionPresetById.get(presetId))
            .filter((preset): preset is AppMotionPresetDefinition => Boolean(preset))
        : [];
  const visiblePresetCombos = presetQuery
    ? compositionPresetCombos.filter((combo) => {
        const comboText = [
          combo.label,
          combo.summary,
          ...combo.presetIds.map((presetId) => appMotionPresetById.get(presetId)?.label ?? "")
        ]
          .join(" ")
          .toLowerCase();
        return comboText.includes(presetQuery);
      })
    : activePresetTab === "combo"
      ? compositionPresetCombos
      : activePresetTab === "recommended"
        ? compositionPresetCombos.slice(0, 2)
        : [];
  const visibleAppMotionPresets = presetQuery
    ? appMotionPresets.filter((preset) => {
        const group = appMotionPresetGroups.find((item) => item.scene === preset.scene);
        const presetText = [
          preset.label,
          preset.summary,
          preset.guideline,
          preset.slot,
          appMotionSceneLabels[preset.scene],
          group?.label ?? ""
        ]
          .join(" ")
          .toLowerCase();
        return presetText.includes(presetQuery);
      })
    : activeCategoryPresets;
  const presetLibraryTitle = presetQuery
    ? "搜索结果"
    : activePresetTab === "recommended"
      ? "当前图层推荐"
      : activePresetTab === "combo"
        ? "组合预设"
        : (activePresetGroup?.label ?? "动效预设");
  const presetLibrarySubtitle = presetQuery
    ? "跨全部规范动效与组合预设匹配"
    : activePresetTab === "recommended"
      ? selectedPresetLayer
        ? `基于 ${selectedPresetLayer.name} 推荐`
        : "选择图层后会更精准"
      : activePresetTab === "combo"
        ? "一键添加多段原子动效"
        : (activePresetGroup ? appMotionSceneLabels[activePresetGroup.scene] : "规范动效");

  useEffect(() => {
    if (storageSaveRef.current) {
      window.clearTimeout(storageSaveRef.current);
      storageSaveRef.current = undefined;
    }
    try {
      if (!hasStarted) {
        globalThis.localStorage?.removeItem(workspaceStorageKey);
        return;
      }
      storageSaveRef.current = window.setTimeout(() => {
        try {
          const snapshot: SavedWorkspace = {
            schemaVersion: projectSchemaVersion,
            document: { ...motionDocument, composition: compositionTrack },
            compositionSteps,
            hasStarted,
            prompt,
            presetTarget
          };
          globalThis.localStorage?.setItem(workspaceStorageKey, JSON.stringify(snapshot));
        } catch {
          // 自动保存不能影响创作主流程。
        }
      }, 250);
    } catch {
      // 自动保存不能影响创作主流程。
    }
    return () => {
      if (storageSaveRef.current) window.clearTimeout(storageSaveRef.current);
    };
  }, [compositionSteps, compositionTrack, hasStarted, motionDocument, presetTarget, prompt]);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const duration = previewDurationMs;
    const startProgress = playheadRef.current >= 1 ? 0 : playheadRef.current;
    const startedAt = performance.now() - startProgress * duration;

    function tick(now: number) {
      const next = clampProgress((now - startedAt) / duration);
      setPlayhead(next);
      if (next >= 1) {
        if (isLooping) {
          setPlayhead(1);
          setIsPlaying(false);
          loopTimeoutRef.current = window.setTimeout(() => {
            setPlayhead(0);
            setIsPlaying(true);
          }, loopIntervalMs);
        } else {
          setIsPlaying(false);
        }
        return;
      }
      animationRef.current = requestAnimationFrame(tick);
    }

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isLooping, isPlaying, previewDurationMs]);

  useEffect(() => clearLoopTimer, []);

  return (
    <main className="motion-copilot-app">
      {showOnboarding ? (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <h2>欢迎使用 Motion Copilot</h2>
            <ol className="onboarding-steps">
              <li>
                <strong>描述动效</strong> — 用自然语言描述你想要的动效，点击"生成"
              </li>
              <li>
                <strong>选择预设</strong> — 从规范动效库中选择场景化动效方案
              </li>
              <li>
                <strong>调参预览</strong> — 在右侧面板微调参数，画布实时响应
              </li>
              <li>
                <strong>组合编排</strong> — 在画布下方横向轨道组合多段动效
              </li>
              <li>
                <strong>手势体验</strong> — 切换画布为"手势"模式，拖拽触发动效
              </li>
              <li>
                <strong>导出代码</strong> — 满意后导出 CSS/HTML 代码
              </li>
            </ol>
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setShowOnboarding(false);
                globalThis.localStorage?.setItem("mc-onboarded", "1");
              }}
            >
              开始使用
            </button>
          </div>
        </div>
      ) : null}
      <aside className="command-shell">
        <header className="brand-header">
          <h1>Motion Copilot</h1>
          <span className="live-indicator" />
        </header>
        <div className="command-scroll">
          <section className="command-section">
            <p className="eyebrow">项目</p>
            <div className="project-action-row">
              <button type="button" className="primary-action" onClick={createBlankProject}>
                新建空白
              </button>
              <button type="button" className="asset-create-button" onClick={loadExampleProject}>
                加载示例
              </button>
            </div>
            <div className="project-status">
              <strong>本地自动保存</strong>
              <span>{projectNotice ?? "修改后会自动保存到当前浏览器"}</span>
              <button type="button" onClick={clearSavedProject}>
                清除自动保存
              </button>
            </div>
          </section>
          <section className="command-section">
            <p className="eyebrow">动效描述</p>
            <textarea
              className="prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              type="button"
              className="primary-action"
              onClick={() => patchDocument(compileIntent({ prompt, base: motionDocument }))}
            >
              生成动效
            </button>
          </section>
          <section className="command-section">
            <p className="eyebrow">图层素材</p>
            <div className="layer-create-grid">
              <label className="asset-create-button file-action">
                <input
                  aria-label="导入图片图层"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void importImageLayer(event.target.files?.[0])}
                />
                <span>导入图片</span>
              </label>
              <button type="button" className="asset-create-button" onClick={() => createLayer("text")}>
                新增文本
              </button>
            </div>
            <div className="command-layer-list">
              {editableLayers.length === 0 ? <p className="dark-empty-state">还没有可编辑图层。</p> : null}
              {editableLayers.map((layer) => (
                <div
                  className={[
                    "command-layer-row",
                    layer.id === motionDocument.selectedLayerId ? "is-active" : "",
                    draggingLayerListId === layer.id ? "is-dragging" : "",
                    layerListDropTargetId === layer.id ? "is-drop-target" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-layer-id={layer.id}
                  onClick={() =>
                    patchDocument({ selectedLayerId: layer.id }, { resetPreview: false, emptyBase: "blank" })
                  }
                  key={layer.id}
                >
                  {layer.layout ? (
                    <span
                      className="command-layer-drag-handle"
                      aria-hidden="true"
                      onPointerDown={(event) => beginLayerListDrag(event, layer)}
                    >
                      ↕
                    </span>
                  ) : (
                    <span className="command-layer-drag-spacer" aria-hidden="true" />
                  )}
                  <input
                    aria-label={`重命名图层 ${layer.name}`}
                    value={layer.name}
                    draggable={false}
                    onFocus={() =>
                      patchDocument(
                        { selectedLayerId: layer.id },
                        { resetPreview: false, emptyBase: "blank" }
                      )
                    }
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => renameLayer(layer.id, event.target.value)}
                  />
                  <div className="command-layer-meta">
                    <small>
                      {layer.kind === "image" && layer.content?.src ? "图片" : layer.kind}
                      {layer.hidden ? " · 隐藏" : ""}
                      {layer.locked ? " · 锁定" : ""}
                    </small>
                    <div className="command-layer-actions" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`${layer.hidden ? "显示" : "隐藏"}图层 ${layer.name}`}
                        onClick={() => toggleLayerHidden(layer)}
                      >
                        {layer.hidden ? "显" : "隐"}
                      </button>
                      <button
                        type="button"
                        aria-label={`${layer.locked ? "解锁" : "锁定"}图层 ${layer.name}`}
                        onClick={() => toggleLayerLocked(layer)}
                      >
                        {layer.locked ? "解" : "锁"}
                      </button>
                      <button
                        type="button"
                        aria-label={`图层上移 ${layer.name}`}
                        disabled={!layer.layout || layer.locked}
                        onClick={() => reorderLayer(layer.id, "forward")}
                      >
                        前
                      </button>
                      <button
                        type="button"
                        aria-label={`图层下移 ${layer.name}`}
                        disabled={!layer.layout || layer.locked}
                        onClick={() => reorderLayer(layer.id, "backward")}
                      >
                        后
                      </button>
                      <button
                        type="button"
                        aria-label={`图层置顶 ${layer.name}`}
                        disabled={!layer.layout || layer.locked}
                        onClick={() => reorderLayer(layer.id, "front")}
                      >
                        顶
                      </button>
                      <button
                        type="button"
                        aria-label={`图层置底 ${layer.name}`}
                        disabled={!layer.layout || layer.locked}
                        onClick={() => reorderLayer(layer.id, "back")}
                      >
                        底
                      </button>
                      <button
                        type="button"
                        aria-label={`复制图层 ${layer.name}`}
                        onClick={() => duplicateLayer(layer.id)}
                      >
                        复
                      </button>
                      <button
                        type="button"
                        aria-label={`删除图层 ${layer.name}`}
                        onClick={() => removeLayer(layer.id)}
                      >
                        删
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {layerListGhost
                ? (() => {
                    const layer = editableLayers.find((item) => item.id === layerListGhost.layerId);
                    if (!layer) return null;
                    return (
                      <div
                        className="command-layer-row command-layer-row-ghost"
                        style={{
                          left: layerListGhost.clientX - layerListGhost.offsetX,
                          top: layerListGhost.clientY - layerListGhost.offsetY,
                          width: layerListGhost.width,
                          height: layerListGhost.height
                        }}
                      >
                        <span className="command-layer-drag-handle" aria-hidden="true">
                          ↕
                        </span>
                        <span>{layer.name}</span>
                        <small>{layer.kind === "image" && layer.content?.src ? "图片" : layer.kind}</small>
                      </div>
                    );
                  })()
                : null}
            </div>
          </section>
          <section className="command-section">
            <p className="eyebrow">风格</p>
            <div className="token-grid">
              {styleTokens.map((token) => (
                <button
                  type="button"
                  className="token-button"
                  title={tokenDescription(token)}
                  onClick={() => patchDocument(token.patch)}
                  key={token.label}
                >
                  {token.label}
                </button>
              ))}
            </div>
          </section>
          <section className="command-section">
            <p className="eyebrow">App 规范动效</p>
            <input
              className="preset-search"
              type="text"
              placeholder="搜索动效…"
              value={presetFilter}
              onChange={(event) => setPresetFilter(event.target.value)}
            />
            <p className="scope-hint">
              当前图层：{selectedPresetLayer?.name ?? "未选择"}
            </p>
            <div className="preset-tabs" role="tablist" aria-label="动效分类">
              {presetLibraryTabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={!presetQuery && activePresetTab === tab.id}
                  className={!presetQuery && activePresetTab === tab.id ? "is-active" : ""}
                  onClick={() => setActivePresetTab(tab.id)}
                  key={tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="preset-groups">
              <div className="preset-group">
                <div className="preset-group-title">
                  <strong>{presetLibraryTitle}</strong>
                  <span>{presetLibrarySubtitle}</span>
                </div>
                <div className="preset-list">
                  {visiblePresetCombos.map((combo) => (
                    <div className="preset-item" key={combo.id}>
                      <button type="button" className="preset-apply" onClick={() => addComboToComposition(combo)}>
                        <span>组合</span>
                        <strong>{combo.label}</strong>
                        <small>{combo.summary}</small>
                      </button>
                    </div>
                  ))}
                  {visibleAppMotionPresets.map((preset) => (
                    <div className="preset-item" key={preset.id}>
                      <button type="button" className="preset-apply" onClick={() => applyPreset(preset.id)}>
                        <span>{appMotionSceneLabels[preset.scene]}</span>
                        <strong>{preset.label}</strong>
                        <small>{preset.summary}</small>
                        <small>{presetConstraintLabel(preset, motionDocument)}</small>
                      </button>
                      <button
                        type="button"
                        className="preset-add-track"
                        title="添加到时间轴"
                        onClick={() => addToComposition(preset.id)}
                      >
                        +
                      </button>
                    </div>
                  ))}
                  {visiblePresetCombos.length === 0 && visibleAppMotionPresets.length === 0 ? (
                    <p className="empty-state">未找到匹配的动效。</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>
      </aside>
      <section
        className="workspace-shell"
        style={{ "--composition-row-height": `${compositionHeight}px` } as React.CSSProperties}
      >
        <CanvasPreview
          document={motionDocument}
          isEmpty={!hasStarted}
          compositionTrack={compositionTrack}
          suggestions={suggestions}
          playhead={playhead}
          isPlaying={isPlaying}
          isLooping={isLooping}
          interactionMode={interactionMode}
          onInteractionModeChange={setInteractionMode}
          onPlay={playPreview}
          onPause={pausePreview}
          onToggleLoop={toggleLoop}
          onReset={resetPreview}
          onSeek={seek}
          onCreateBlank={createBlankProject}
          onLoadExample={loadExampleProject}
          onSelect={(layerId) => patchDocument({ selectedLayerId: layerId }, { resetPreview: false })}
          onMoveLayer={moveLayer}
        />
        <CompositionPanel
          steps={compositionSteps}
          layers={motionDocument.layers}
          track={compositionTrack}
          activeStepIds={activeStepIdsValue}
          selectedStepId={selectedCompositionStepId}
          compositionHeight={compositionHeight}
          onSelectStep={setSelectedCompositionStepId}
          onCompositionHeightChange={setCompositionHeight}
          onToggleTiming={toggleStepTiming}
          onReorderStep={reorderStep}
          onMoveStepToLane={moveStepToLane}
          onRemove={removeCompositionStep}
          onApply={applyCompositionToDocument}
          onClear={clearComposition}
        />
      </section>
      <Inspector
        document={motionDocument}
        compositionTrack={compositionTrack}
        selectedCompositionStep={selectedCompositionStep}
        selectedCompositionStepIndex={selectedCompositionStepIndex}
        selectedCompositionStepStartMs={selectedCompositionStepStartMs}
        suggestions={suggestions}
        activeTab={rightTab}
        onTabChange={setRightTab}
        onPatch={patchDocument}
        onUpdateCompositionStep={updateCompositionStep}
        onUpdateCompositionStepStart={updateCompositionStepStart}
        onResetCompositionStepMotion={resetCompositionStepMotion}
        onLoad={loadDocument}
        onApplySuggestion={applySuggestion}
        onIgnoreSuggestion={ignoreSuggestion}
      />
    </main>
  );
}
