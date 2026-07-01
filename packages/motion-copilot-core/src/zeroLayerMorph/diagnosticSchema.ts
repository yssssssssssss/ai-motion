import type { Bounds } from "../frameMorph/schema";

export type ZeroLayerDiagnosticSource =
  | "real-zero-mcp-http"
  | "fixture"
  | "zero-layer-bridge"
  | "custom-command"
  | "unknown";

export type ZeroLayerDiagnosticSeverity = "info" | "warning" | "error";

export type ZeroLayerDiagnosticRiskCode =
  | "MCP_RETURN_INVALID"
  | "LAYER_INCOMPLETE"
  | "COORDINATE_NORMALIZATION"
  | "STYLE_UNSUPPORTED"
  | "VECTOR_APPROXIMATION"
  | "MATCH_LOW_CONFIDENCE"
  | "LAYER_ORDER_OCCLUSION"
  | "PREVIEW_SELECTION_ARTIFACT"
  | "MOTION_PLAN_TOO_BASIC"
  | "ZERO_NAMING_WEAK";

export type ZeroLayerStyleCapabilityStatus = "supported" | "partial" | "unsupported" | "absent";

export type ZeroLayerStyleCapability = {
  capability:
    | "solid-fill"
    | "gradient-fill"
    | "image-fill"
    | "stroke"
    | "corner-radius"
    | "shadow"
    | "blur"
    | "text-style"
    | "vector"
    | "mask"
    | "rotation";
  status: ZeroLayerStyleCapabilityStatus;
  count: number;
  nodeIds: string[];
};

export type ZeroLayerDiagnosticRisk = {
  code: ZeroLayerDiagnosticRiskCode;
  severity: ZeroLayerDiagnosticSeverity;
  message: string;
  nodeId?: string;
  relatedNodeIds?: string[];
};

export type ZeroLayerDiagnosticRecommendation = {
  code:
    | "CHECK_ZERO_MCP_SOURCE"
    | "FIX_COORDINATE_NORMALIZATION"
    | "ADD_STYLE_RENDERER_SUPPORT"
    | "ADJUST_EXIT_LAYER_ORDER"
    | "IMPROVE_ZERO_LAYER_NAMING"
    | "REVIEW_LOW_CONFIDENCE_MATCH";
  message: string;
  nodeIds?: string[];
};

export type ZeroLayerDiagnosticGateStatus = "pass" | "degraded" | "blocked";

export type ZeroLayerDiagnosticStrategy =
  | "native-layer-morph"
  | "safe-fade-unmatched"
  | "screenshot-fallback"
  | "manual-fix-required";

export type ZeroLayerDiagnosticAction = {
  code:
    | "BLOCK_GENERATION"
    | "RUN_SCREENSHOT_GATE"
    | "DOWNGRADE_LOW_CONFIDENCE_TO_FADE"
    | "USE_ASSET_FALLBACK_FOR_VECTOR"
    | "KEEP_UNMATCHED_STATIC"
    | "REVIEW_ZERO_SOURCE";
  message: string;
  targetNodeIds?: string[];
};

export type ZeroLayerDiagnosticGate = {
  status: ZeroLayerDiagnosticGateStatus;
  pass: boolean;
  strategy: ZeroLayerDiagnosticStrategy;
  score: number;
  summary: string;
  reasons: string[];
  actions: ZeroLayerDiagnosticAction[];
};

export type ZeroLayerDiagnosticMotionItem = {
  type: "matched" | "enter" | "exit";
  nodeId: string;
  toNodeId?: string;
  layerId: string;
  durationMs: number;
  delayMs: number;
  easing: string;
  fromBounds: Bounds;
  toBounds: Bounds;
  opacity: { from: number; to: number };
};

export type ZeroLayerDiagnosticReport = {
  schemaVersion: "motion-copilot.zero-layer-diagnostic.v1";
  read: {
    source: ZeroLayerDiagnosticSource;
    bridge?: string;
    fromNodeId: string;
    toNodeId: string;
    fromName: string;
    toName: string;
    fromLayerCount: number;
    toLayerCount: number;
    fromSize: { width: number; height: number };
    toSize: { width: number; height: number };
  };
  matching: {
    matched: number;
    enter: number;
    exit: number;
    unresolved: number;
    lowConfidence: Array<{
      fromNodeId?: string;
      toNodeId?: string;
      reason: string;
    }>;
  };
  motion: {
    durationMs: number;
    matched: ZeroLayerDiagnosticMotionItem[];
    enter: ZeroLayerDiagnosticMotionItem[];
    exit: ZeroLayerDiagnosticMotionItem[];
  };
  geometry: ZeroLayerDiagnosticRisk[];
  styleCapabilities: ZeroLayerStyleCapability[];
  risks: ZeroLayerDiagnosticRisk[];
  recommendations: ZeroLayerDiagnosticRecommendation[];
  gate: ZeroLayerDiagnosticGate;
};
