import type { EasingSpec } from "../schema/document";

export type FrameElementKind = "group" | "rect" | "text" | "vector" | "image";

export type FrameElementStyle = {
  background?: string;
  color?: string;
  borderColor?: string;
  boxShadow?: string;
  fontFamily?: string;
  textDecoration?: string;
  radius?: number;
  borderWidth?: number;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
};

export type FrameElement = {
  key: string;
  nodeId: string;
  parentKey?: string;
  name: string;
  kind: FrameElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  zIndex: number;
  text?: string;
  assetUrl?: string;
  style?: FrameElementStyle;
};

export type FrameSnapshot = {
  schemaVersion: "motion-copilot.frame-snapshot.v1";
  frameId: string;
  name: string;
  width: number;
  height: number;
  screenshotUrl?: string;
  elements: FrameElement[];
};

export type MorphState = {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  radius?: number;
  background?: string;
  color?: string;
  text?: string;
  assetUrl?: string;
  borderColor?: string;
  borderWidth?: number;
  boxShadow?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number;
  textDecoration?: string;
};

export type MorphTrack = {
  id: string;
  role: "matched" | "enter" | "exit";
  from?: MorphState;
  to?: MorphState;
  timing?: {
    delayMs?: number;
    durationMs?: number;
    easing?: EasingSpec;
  };
};

export type MorphIssue = {
  id: string;
  severity: "info" | "suggestion" | "warning";
  title: string;
  reason: string;
  elementKey?: string;
};

export type MorphPlan = {
  schemaVersion: "motion-copilot.frame-morph.v1";
  fromFrameId: string;
  toFrameId: string;
  durationMs: number;
  easing: EasingSpec;
  tracks: MorphTrack[];
  issues: MorphIssue[];
};

export type FrameElementMatch = {
  fromKey: string;
  toKey: string;
  confidence: number;
  reasons: string[];
};

export type FrameElementUnresolved = {
  fromKey?: string;
  toKey?: string;
  reason: string;
};

export type FrameElementMatchResult = {
  matches: FrameElementMatch[];
  enter: string[];
  exit: string[];
  unresolved: FrameElementUnresolved[];
};

export type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ZeroVisualAsset = {
  id: string;
  type: "svg" | "png" | "jpg" | "webp" | "group";
  url: string;
  nodeId?: string;
  width?: number;
  height?: number;
};

export type ZeroVisualNode = {
  nodeId: string;
  name: string;
  kind: FrameElementKind;
  bounds: Bounds;
  text?: string;
  assetId?: string;
};

export type ZeroVisualSnapshot = {
  schemaVersion: "motion-copilot.zero-visual-snapshot.v1";
  frameId: string;
  nodeId: string;
  name: string;
  width: number;
  height: number;
  screenshotUrl: string;
  html: string;
  css: string;
  assets: ZeroVisualAsset[];
  nodes: ZeroVisualNode[];
  unknownStyleTokens?: Array<{ nodeId?: string; tokens: string[] }>;
};

export type ZeroVisualNodeOverride = {
  nodeId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  opacity?: number;
};

export type VisualMotionBinding = {
  layerId: string;
  nodeId: string;
  toNodeId: string;
  source: "html-node" | "svg-asset" | "png-asset" | "group-asset";
  fromBounds: Bounds;
  toBounds: Bounds;
  confidence: number;
  reasons: string[];
};

export type VisualMotionBindingResult = {
  bindings: VisualMotionBinding[];
  enter: ZeroVisualNode[];
  exit: ZeroVisualNode[];
  ignored?: Array<{
    nodeId: string;
    reason: string;
  }>;
  unresolved: Array<{
    fromNodeId?: string;
    toNodeId?: string;
    reason: string;
  }>;
};

export type VisualMotionIntent = {
  durationMs: number;
  easing: EasingSpec;
  staggerMs: number;
  enter: {
    opacityFrom: number;
    translateY: number;
    delayMs: number;
  };
  exit: {
    opacityTo: number;
    translateY: number;
    delayMs: number;
  };
};

// --- Restoration Report ---

export type RestorationMetricStatus = "ok" | "warning" | "error" | "unknown" | "not-applicable";

export type RestorationMetric = {
  value: number | null;
  status: RestorationMetricStatus;
  weight: number;
};

export type RestorationIssueSeverity = "info" | "warning" | "error";
export type RestorationIssueSource = "input-missing" | "conversion-lost" | "render-risk" | "user-change";
export type RestorationIssueCategory = "node" | "style" | "layer-order" | "match" | "asset" | "export";

export type RestorationIssue = {
  id: string;
  severity: RestorationIssueSeverity;
  source: RestorationIssueSource;
  category: RestorationIssueCategory;
  nodeId?: string;
  layerId?: string;
  field?: string;
  title: string;
  reason: string;
  suggestion: string;
};

export type RestorationReport = {
  score: number;
  summary: string;
  generatedAt: string;
  inputHash: string;
  bindingHash: string;
  metrics: {
    nodeCoverage: RestorationMetric;
    styleCoverage: RestorationMetric;
    layerOrderConfidence: RestorationMetric;
    matchConfidence: RestorationMetric;
    visualRisk: RestorationMetric;
  };
  issues: RestorationIssue[];
};

export type CreateRestorationReportInput = {
  from: ZeroVisualSnapshot | FrameSnapshot;
  to: ZeroVisualSnapshot | FrameSnapshot;
  bindings: VisualMotionBindingResult | FrameElementMatchResult;
  userOverrides?: UserBindingOverride[];
};

// --- User Binding Override ---

export type UserBindingOverrideAction = "matched" | "enter" | "exit" | "ignore";

export type UserBindingOverride = {
  fromNodeId: string;
  toNodeId?: string;
  action: UserBindingOverrideAction;
};

// --- Report Cache ---

export type VisualCompositionReportCache = {
  report: RestorationReport;
  inputHash: string;
  bindingHash: string;
  generatedAt: string;
};

// --- Frame Object Model ---

export type FrameObjectKind = "button" | "status-pill" | "label-group" | "container" | "text" | "asset" | "unknown";

export type FrameObject = {
  id: string;
  kind: FrameObjectKind;
  name: string;
  nodeIds: string[];
  bounds: Bounds;
  children: FrameObject[];
  confidence: number;
};

export type FrameObjectModel = {
  frameId: string;
  objects: FrameObject[];
  unresolvedNodeIds: string[];
};
