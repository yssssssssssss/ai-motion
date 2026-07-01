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
  path?: string[];
  preview?: string;
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
};
