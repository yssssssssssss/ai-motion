export type MotionRole =
  | "modal"
  | "toast"
  | "button"
  | "nav"
  | "fab"
  | "tab-bar"
  | "card"
  | "list"
  | "background";
export type MotionSize = "small" | "medium" | "large";
export type MotionTrigger = "load" | "click" | "hover" | "gesture";
export type MotionDirection = "enter" | "exit-final" | "move-inside" | "exit-temporary";
export type ClassicEasingPreset = "decelerate" | "accelerate" | "standard" | "sharp";
export type MotionLayerKind = "group" | "text" | "image" | "icon" | "shape" | "button";
export type MotionIconName = "info" | "check" | "arrow";
export type StageMode = "mobile" | "web" | "custom";
export type LayerOrderAction = "forward" | "backward" | "front" | "back";
export type ImageFit = "cover" | "contain" | "fill";
export type ImagePosition = "center" | "top" | "bottom" | "left" | "right";
export type LayerMotionPreset = "none" | "fade" | "lift" | "slide-left" | "slide-right" | "zoom";
export type SuggestionSeverity = "info" | "suggestion" | "warning";
export type SuggestionStatus = "open" | "applied" | "ignored";
export type AppMotionPresetSlot = "trajectory" | "scene" | "feedback" | "sequence" | "visual";
export type AppMotionPresetTarget = "target" | "selected-layer";

/**
 * Z 轴三层模型（规范 §2.1）
 * - top: 顶层悬浮控件（导航栏、Tab栏、悬浮按钮）→ 稳定、高阻尼、无回弹
 * - middle: 中层核心操作层（卡片、列表、弹窗面板）→ 丰富、低阻尼、可回弹
 * - bottom: 底层容器氛围层（背景、品牌纹理、骨架屏）→ 联动、跟随、不独立运动
 */
export type MotionZLevel = "top" | "middle" | "bottom";

/**
 * 根据 MotionRole 推断 Z 轴层级
 */
export function zLevelForRole(role: MotionRole): MotionZLevel {
  if (role === "nav" || role === "fab" || role === "tab-bar") return "top";
  if (role === "background") return "bottom";
  // modal, toast, button, card, list → 中层核心操作层
  return "middle";
}

/**
 * 层级对应的弹簧策略
 */
export function springStrategyForZLevel(level: MotionZLevel): {
  allowBounce: boolean;
  dampingRange: [number, number];
} {
  if (level === "top") return { allowBounce: false, dampingRange: [24, 40] };
  if (level === "bottom") return { allowBounce: false, dampingRange: [20, 30] };
  // 中层：允许回弹，低阻尼
  return { allowBounce: true, dampingRange: [12, 22] };
}

export type AppliedMotionPreset = {
  id: string;
  label: string;
  slot: AppMotionPresetSlot;
  target?: AppMotionPresetTarget;
  layerId?: string;
  layerName?: string;
  source: "app-guideline";
};

export type MotionPresetResolution = {
  id: string;
  presetId: string;
  action: "applied" | "replaced" | "adjusted";
  title: string;
  reason: string;
};

export type StageSpec = {
  mode: StageMode;
  width: number;
  height: number;
  background: string;
  backgroundImage?: string;
  backgroundAlt?: string;
  backgroundFit?: ImageFit;
  backgroundPosition?: ImagePosition;
  showSafeArea?: boolean;
};

export type MotionState = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  opacity?: number;
  blur?: number;
  rotate?: number;
};

export type MotionElement = {
  id: string;
  name: string;
  role: MotionRole;
  size: MotionSize;
  initial: MotionState;
  animate: MotionState;
};

export type MotionLayerContent = {
  text?: string;
  src?: string;
  alt?: string;
  icon?: MotionIconName;
};

export type MotionLayerStyle = {
  color?: string;
  background?: string;
  borderColor?: string;
  boxShadow?: string;
  fontFamily?: string;
  textDecoration?: string;
  radius?: number;
  borderWidth?: number;
  opacity?: number;
  fit?: ImageFit;
  position?: ImagePosition;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
};

export type MotionLayerLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  aspectLocked?: boolean;
};

export type LayerMotionDirection = "up" | "down" | "left" | "right";

export type MotionLayerMotion = {
  preset: LayerMotionPreset;
  durationMs: number;
  delayMs: number;
  /** 入场/出场方向 */
  direction?: LayerMotionDirection;
  /** 位移距离（px） */
  distance?: number;
  /** 缩放起始值，默认 1 */
  scaleFrom?: number;
  /** 透明度起始值，默认 0 */
  opacityFrom?: number;
  /** 透明度结束值，默认 1 */
  opacityTo?: number;
  /** 图层级缓动 */
  easing?: EasingSpec;
};

export type MotionLayer = {
  id: string;
  name: string;
  kind: MotionLayerKind;
  parentId?: string;
  editable: boolean;
  hidden?: boolean;
  locked?: boolean;
  content?: MotionLayerContent;
  style?: MotionLayerStyle;
  layout?: MotionLayerLayout;
  motion?: MotionLayerMotion;
};

export type ClassicEasingSpec = {
  type: "classic";
  preset: ClassicEasingPreset;
  css: string;
};

export type SpringEasingSpec = {
  type: "spring";
  stiffness: number;
  damping: number;
  mass: number;
  /** 初始速度（规范 §3 "继承手势速度"），可选，默认 0 */
  velocity?: number;
  cssFallback: string;
};

export type EasingSpec = ClassicEasingSpec | SpringEasingSpec;

export type MotionTimeline = {
  trigger: MotionTrigger;
  direction: MotionDirection;
  durationMs: number;
  delayMs: number;
  easing: EasingSpec;
  repeat: "none" | "loop";
};

export type MotionDocumentPatch = {
  stage?: Partial<StageSpec>;
  selectedLayerId?: string;
  appliedPresets?: AppliedMotionPreset[];
  presetResolutions?: MotionPresetResolution[];
  element?: {
    id?: string;
    name?: string;
    role?: MotionRole;
    size?: MotionSize;
    initial?: Partial<MotionState>;
    animate?: Partial<MotionState>;
  };
  layer?: {
    id: string;
    name?: string;
    hidden?: boolean;
    locked?: boolean;
    content?: Partial<MotionLayerContent>;
    style?: Partial<MotionLayerStyle>;
    layout?: Partial<MotionLayerLayout>;
    motion?: Partial<MotionLayerMotion>;
  };
  addLayer?: MotionLayer;
  removeLayerId?: string;
  reorderLayer?: {
    id: string;
    action: LayerOrderAction;
  };
  timeline?: Partial<MotionTimeline>;
};

export type GuidelineSuggestion = {
  id: string;
  target: {
    elementId?: string;
    field: string;
  };
  severity: SuggestionSeverity;
  title: string;
  reason: string;
  suggestedPatch?: MotionDocumentPatch;
  status: SuggestionStatus;
};

export type MotionDocument = {
  version: "0.1";
  stage: StageSpec;
  elements: MotionElement[];
  layers: MotionLayer[];
  selectedLayerId?: string;
  appliedPresets: AppliedMotionPreset[];
  presetResolutions: MotionPresetResolution[];
  timeline: MotionTimeline;
  guidelineSuggestions: GuidelineSuggestion[];
  /** 组合轨道（可选，启用组合编排模式时存在） */
  composition?: CompositionTrack;
  /** 高保真视觉源（可选，ZeroVisualSnapshot 路径导出时使用） */
  visualSource?: VisualCompositionSource;
};

export const classicEasingCss: Record<ClassicEasingPreset, string> = {
  decelerate: "cubic-bezier(0.18, 0.86, 0.22, 1)",
  accelerate: "cubic-bezier(0.4, 0, 1, 1)",
  standard: "cubic-bezier(0.35, 0, 0.25, 1)",
  sharp: "cubic-bezier(0.25, 0.8, 0.35, 1)"
};

export const springCssFallback = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export function createClassicEasing(preset: ClassicEasingPreset): ClassicEasingSpec {
  return { type: "classic", preset, css: classicEasingCss[preset] };
}

export function createSpringEasing(
  input: Partial<Omit<SpringEasingSpec, "type" | "cssFallback">> = {}
): SpringEasingSpec {
  return {
    type: "spring",
    stiffness: input.stiffness ?? 220,
    damping: input.damping ?? 18,
    mass: input.mass ?? 1,
    ...(input.velocity != null ? { velocity: input.velocity } : {}),
    cssFallback: springCssFallback
  };
}

export function easingCss(easing: EasingSpec): string {
  return easing.type === "classic" ? easing.css : easing.cssFallback;
}

export function primaryElement(document: MotionDocument): MotionElement {
  const element = document.elements[0];
  if (!element) throw new Error("MotionDocument must contain one primary element.");
  return element;
}

export function layerById(document: MotionDocument, layerId: string): MotionLayer | undefined {
  return document.layers.find((layer) => layer.id === layerId);
}

export function selectedLayer(document: MotionDocument): MotionLayer | undefined {
  return document.selectedLayerId ? layerById(document, document.selectedLayerId) : undefined;
}

export function durationRangeForSize(size: MotionSize): { min: number; max: number; recommended: number } {
  if (size === "small") return { min: 100, max: 200, recommended: 150 };
  if (size === "large") return { min: 300, max: 400, recommended: 350 };
  return { min: 200, max: 300, recommended: 250 };
}

// ─── 组合轨道 ───────────────────────────────────────────────

export type CompositionTiming = "sequential" | "parallel";

export type CompositionStep = {
  id: string;
  /** 引用的 preset ID */
  presetId: string;
  /** preset 显示名称（冗余，便于 UI 展示） */
  label: string;
  /** 作用对象 */
  target: AppMotionPresetTarget;
  /** 如果 target 为 selected-layer，指定图层 ID */
  layerId?: string;
  /** 图层名称（冗余展示） */
  layerName?: string;
  /** 与前一个 step 的时序关系 */
  timing: CompositionTiming;
  /** 相对延迟（ms），串行时相对于前一个结束，并行时相对于前一个开始 */
  delayMs: number;
  /** 该 step 时长（ms） */
  durationMs: number;
  /** 所属 slot */
  slot: AppMotionPresetSlot;
  /** 覆盖该片段的起始状态；未填写字段沿用 preset 默认值 */
  initial?: MotionState;
  /** 覆盖该片段的结束状态；未填写字段沿用 preset 默认值 */
  animate?: MotionState;
  /** 覆盖该片段的缓动；未填写时沿用 preset 默认值 */
  easing?: EasingSpec;
  /** 片段窗口外是否保持起止状态，用于帧间过渡这类布局 morph */
  fillMode?: "none" | "forwards" | "both";
};

export type CompositionIssue = {
  id: string;
  stepId: string;
  severity: SuggestionSeverity;
  title: string;
  reason: string;
};

export type CompositionStepWindow = {
  stepId: string;
  start: number;
  end: number;
};

export type CompositionTrack = {
  steps: CompositionStep[];
  /** 校验问题列表 */
  issues: CompositionIssue[];
  /** 计算出的总时长（ms） */
  totalDurationMs: number;
};

export type VisualCompositionSnapshotSource = {
  schemaVersion: "motion-copilot.zero-visual-snapshot.v1";
  frameId: string;
  nodeId: string;
  name: string;
  width: number;
  height: number;
  screenshotUrl: string;
  html: string;
  css: string;
  assets: Array<{
    id: string;
    type: "svg" | "png" | "jpg" | "webp" | "group";
    url: string;
    nodeId?: string;
    width?: number;
    height?: number;
  }>;
  nodes: Array<{
    nodeId: string;
    name: string;
    kind: MotionLayerKind | "rect" | "vector";
    bounds: { x: number; y: number; w: number; h: number };
    text?: string;
    assetId?: string;
  }>;
};

export type VisualCompositionBindingSource = {
  bindings: Array<{
    layerId: string;
    nodeId: string;
    toNodeId: string;
    fromBounds: { x: number; y: number; w: number; h: number };
    toBounds: { x: number; y: number; w: number; h: number };
  }>;
  enter: Array<{ nodeId: string }>;
  exit: Array<{ nodeId: string }>;
  ignored?: Array<{ nodeId: string; reason: string }>;
};

export type ZeroVisualCompositionSource = {
  kind: "zero-visual-morph";
  from: VisualCompositionSnapshotSource;
  to: VisualCompositionSnapshotSource;
  bindingResult: VisualCompositionBindingSource;
  userBindingOverrides?: import("../frameMorph/schema").UserBindingOverride[];
  nodeOverrides?: import("../frameMorph/schema").ZeroVisualNodeOverride[];
  restorationReportCache?: import("../frameMorph/schema").VisualCompositionReportCache;
};

export type VisualCompositionSource =
  | ZeroVisualCompositionSource
  | import("../zeroLayerMorph/schema").ZeroLayerMorphSource;
