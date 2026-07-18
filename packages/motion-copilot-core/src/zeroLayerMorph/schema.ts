import type { Bounds } from "../frameMorph/schema";
import type { ZeroLayerDiagnosticReport } from "./diagnosticSchema";

export type ZeroLayerKind =
  | "frame"
  | "group"
  | "rect"
  | "text"
  | "vector"
  | "image"
  | "component"
  | "instance"
  | "boolean"
  | "ellipse"
  | "line"
  | "polygon"
  | "star"
  | "section"
  | "unknown";

export type ZeroLayerFill =
  | { type: "solid"; color: string; opacity?: number }
  | { type: "image"; assetId?: string; opacity?: number }
  | { type: "gradient"; css?: string; opacity?: number };

export type ZeroLayerStroke = {
  color: string;
  opacity?: number;
  width?: number;
};

export type ZeroLayerEffect = {
  type: "drop-shadow" | "inner-shadow" | "blur" | "unknown";
  css?: string;
};

export type ZeroLayerTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textCase?: "none" | "upper" | "lower" | "capitalize";
};

export type ZeroLayerAsset = {
  id: string;
  type: "svg" | "png" | "jpg" | "webp";
  url: string;
  nodeId?: string;
  width?: number;
  height?: number;
};

export type ZeroLayerNode = {
  nodeId: string;
  parentId?: string;
  name: string;
  kind: ZeroLayerKind;
  bounds: Bounds;
  opacity: number;
  visible: boolean;
  clipsContent?: boolean;
  cornerRadius?: number;
  rotation?: number;
  blendMode?: string;
  renderMode?: "dom" | "image";
  fills?: ZeroLayerFill[];
  strokes?: ZeroLayerStroke[];
  effects?: ZeroLayerEffect[];
  text?: string;
  textStyle?: ZeroLayerTextStyle;
  assetId?: string;
  children?: string[];
};

export type ZeroLayerNodeCandidate = {
  nodeId: string;
  name: string;
  kind: ZeroLayerKind;
  bounds: Bounds;
  role?: "from" | "to";
  baseName?: string;
  priority?: number;
  path?: string[];
  preview?: string;
};

export type ZeroLayerFramePair = {
  label: string;
  baseName: string;
  fromNodeId: string;
  toNodeId: string;
  fromPageName?: string;
  toPageName?: string;
  confidence: number;
  reasons: string[];
};

export type ZeroLayerFramePairCandidate = {
  nodeId: string;
  name: string;
  role: "from" | "to";
  baseName: string;
  kind: ZeroLayerKind;
  pageId?: string;
  pageName?: string;
  bounds?: Bounds;
};

export type ZeroLayerFramePairDiscovery = {
  schemaVersion: "motion-copilot.zero-layer-frame-pair-discovery.v1";
  pages: Array<{
    nodeId: string;
    name: string;
    candidateCount: number;
  }>;
  candidates: ZeroLayerFramePairCandidate[];
  pairs: ZeroLayerFramePair[];
};

export type ZeroLayerSnapshot = {
  schemaVersion: "motion-copilot.zero-layer-snapshot.v1";
  frameId: string;
  nodeId: string;
  name: string;
  width: number;
  height: number;
  screenshotUrl: string;
  assets: ZeroLayerAsset[];
  layers: ZeroLayerNode[];
};

export type ZeroLayerNodeOverride = {
  frame: "from" | "to" | "both";
  nodeId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cornerRadius?: number;
  opacity?: number;
};

export type ZeroLayerObjectKind = "status-pill" | "button" | "container";

export type ZeroLayerObject = {
  id: string;
  kind: ZeroLayerObjectKind;
  name: string;
  nodeIds: string[];
  bounds: Bounds;
  confidence: number;
};

export type ZeroLayerMotionBinding = {
  layerId: string;
  nodeId: string;
  toNodeId: string;
  fromBounds: Bounds;
  toBounds: Bounds;
  confidence: number;
  reasons: string[];
};

export type ZeroLayerMotionBindingResult = {
  bindings: ZeroLayerMotionBinding[];
  enter: ZeroLayerNode[];
  exit: ZeroLayerNode[];
  unresolved: Array<{
    fromNodeId?: string;
    toNodeId?: string;
    reason: string;
  }>;
};

export type ZeroLayerOptimizerActionCode =
  | "DOWNGRADE_LOW_CONFIDENCE_TO_FADE"
  | "KEEP_UNMATCHED_STATIC"
  | "USE_ASSET_FALLBACK_FOR_VECTOR"
  | "ADJUST_EXIT_LAYER_ORDER";

export type ZeroLayerOptimizerReport = {
  strategy: "native-layer-morph" | "safe-fade-unmatched" | "screenshot-fallback" | "manual-fix-required";
  applied: Array<{
    code: ZeroLayerOptimizerActionCode;
    message: string;
    nodeIds: string[];
  }>;
  skipped: Array<{
    code: ZeroLayerOptimizerActionCode;
    message: string;
    nodeIds: string[];
  }>;
};

export type MotionTrackKind = "morph" | "enter" | "exit" | "emphasis" | "path";

export type MotionTrackSource = "llm" | "rule" | "user";

/** 单个关键帧：offset 为轨道内归一化时间位置 [0,1]，其余为可动画属性（均可选）。 */
export type MotionKeyframe = {
  offset: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  /** 该关键帧到下一帧之间的段内缓动，缺省时由 track.physics 决定。 */
  easing?: [number, number, number, number];
};

export type MotionPhysics =
  | { type: "spring"; stiffness: number; damping: number }
  | { type: "ease"; curve: [number, number, number, number] };

/** 连续性格维度，各分量取值 [0,1]，取代 subtle/balanced/strong 三档。 */
export type MotionPersonality = {
  energy: number;
  bounce: number;
  sharpness: number;
};

/** per-layer 可持久化、可局部编辑的动效一等对象。 */
export type LayerMotionTrack = {
  layerId: string;
  nodeId: string;
  kind: MotionTrackKind;
  keyframes: MotionKeyframe[];
  physics?: MotionPhysics;
  path?: { points: Array<{ x: number; y: number }> };
  timing: { delayMs: number; durationMs: number };
  overshoot?: number;
  personality?: MotionPersonality;
  /** 标注来源，便于 UI 区分与「重新生成时保留用户改动」。 */
  source: MotionTrackSource;
};

export type MotionPlan = {
  schemaVersion: "motion-copilot.motion-plan.v1";
  tracks: LayerMotionTrack[];
  stageDurationMs: number;
};

export type ZeroLayerMorphSource = {
  kind: "zero-layer-morph";
  from: ZeroLayerSnapshot;
  to: ZeroLayerSnapshot;
  bindingResult: ZeroLayerMotionBindingResult;
  diagnosticReport?: ZeroLayerDiagnosticReport;
  optimizerReport?: ZeroLayerOptimizerReport;
  objects?: {
    from: ZeroLayerObject[];
    to: ZeroLayerObject[];
  };
  nodeOverrides?: ZeroLayerNodeOverride[];
  motionPlan?: MotionPlan;
};
