import type { Bounds } from "../frameMorph/schema";
import { compileZeroLayerMotionBindings } from "./compileZeroLayerMotionBindings";
import { compileZeroLayerMotionComposition } from "./compileZeroLayerMotionComposition";
import type { ZeroLayerMotionBindingResult, ZeroLayerNode, ZeroLayerSnapshot } from "./schema";
import type {
  ZeroLayerDiagnosticMotionItem,
  ZeroLayerDiagnosticGate,
  ZeroLayerDiagnosticRecommendation,
  ZeroLayerDiagnosticReport,
  ZeroLayerDiagnosticRisk,
  ZeroLayerDiagnosticSource,
  ZeroLayerStyleCapability
} from "./diagnosticSchema";

export type CreateZeroLayerDiagnosticReportInput = {
  from: ZeroLayerSnapshot;
  to: ZeroLayerSnapshot;
  bindingResult?: ZeroLayerMotionBindingResult;
  source?: ZeroLayerDiagnosticSource;
  bridge?: string;
  durationMs?: number;
};

const schemaVersion = "motion-copilot.zero-layer-diagnostic.v1";
const lowConfidenceBindingThreshold = 64;

function layerIdForNode(nodeId: string): string {
  return `zero-layer-${nodeId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "node"}`;
}

function easingName(value: unknown): string {
  if (value && typeof value === "object" && "preset" in value && typeof value.preset === "string") {
    return value.preset;
  }
  return "unknown";
}

function sameBounds(bounds: Bounds): Bounds {
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

function geometryRisks(snapshot: ZeroLayerSnapshot, frame: "from" | "to"): ZeroLayerDiagnosticRisk[] {
  const risks: ZeroLayerDiagnosticRisk[] = [];
  for (const node of snapshot.layers) {
    const { x, y, w, h } = node.bounds;
    if (![x, y, w, h].every(Number.isFinite) || w < 0 || h < 0) {
      risks.push({
        code: "COORDINATE_NORMALIZATION",
        severity: "error",
        nodeId: node.nodeId,
        message: `${frame} layer ${node.nodeId} has invalid bounds.`
      });
      continue;
    }
    if (node.nodeId !== snapshot.nodeId && (x > snapshot.width * 2 || y > snapshot.height * 2)) {
      risks.push({
        code: "COORDINATE_NORMALIZATION",
        severity: "warning",
        nodeId: node.nodeId,
        message: `${frame} layer ${node.nodeId} is far outside the root bounds; check coordinate normalization.`
      });
    }
  }
  return risks;
}

function capability(
  capabilityName: ZeroLayerStyleCapability["capability"],
  status: ZeroLayerStyleCapability["status"],
  nodes: ZeroLayerNode[]
): ZeroLayerStyleCapability {
  return {
    capability: capabilityName,
    status,
    count: nodes.length,
    nodeIds: nodes.map((node) => node.nodeId)
  };
}

function styleCapabilities(from: ZeroLayerSnapshot, to: ZeroLayerSnapshot): ZeroLayerStyleCapability[] {
  const nodes = [...from.layers, ...to.layers];
  const solid = nodes.filter((node) => node.fills?.some((fill) => fill.type === "solid"));
  const gradient = nodes.filter((node) => node.fills?.some((fill) => fill.type === "gradient"));
  const image = nodes.filter(
    (node) => node.fills?.some((fill) => fill.type === "image") || node.kind === "image"
  );
  const stroke = nodes.filter((node) => node.strokes && node.strokes.length > 0);
  const radius = nodes.filter((node) => node.cornerRadius != null);
  const shadow = nodes.filter((node) =>
    node.effects?.some((effect) => effect.type === "drop-shadow" || effect.type === "inner-shadow")
  );
  const blur = nodes.filter((node) => node.effects?.some((effect) => effect.type === "blur"));
  const text = nodes.filter((node) => node.kind === "text" && node.textStyle);
  const vector = nodes.filter(
    (node) =>
      node.kind === "vector" || node.kind === "boolean" || node.kind === "polygon" || node.kind === "star"
  );

  return [
    capability("solid-fill", solid.length > 0 ? "supported" : "absent", solid),
    capability("gradient-fill", gradient.length > 0 ? "partial" : "absent", gradient),
    capability("image-fill", image.length > 0 ? "partial" : "absent", image),
    capability("stroke", stroke.length > 0 ? "supported" : "absent", stroke),
    capability("corner-radius", radius.length > 0 ? "supported" : "absent", radius),
    capability("shadow", shadow.length > 0 ? "supported" : "absent", shadow),
    capability("blur", blur.length > 0 ? "partial" : "absent", blur),
    capability("text-style", text.length > 0 ? "supported" : "absent", text),
    capability("vector", vector.length > 0 ? "partial" : "absent", vector),
    capability("mask", "unsupported", []),
    capability("rotation", "unsupported", [])
  ];
}

function styleRisks(capabilities: ZeroLayerStyleCapability[]): ZeroLayerDiagnosticRisk[] {
  return capabilities
    .filter((item) => item.count > 0 && (item.status === "partial" || item.status === "unsupported"))
    .map((item) => ({
      code: item.capability === "vector" ? "VECTOR_APPROXIMATION" : "STYLE_UNSUPPORTED",
      severity: "warning",
      relatedNodeIds: item.nodeIds,
      message: `${item.capability} is ${item.status}; visual restoration may be approximate.`
    }));
}

function descendantIds(snapshot: ZeroLayerSnapshot, nodeId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const node of snapshot.layers) {
    if (!node.parentId) continue;
    childrenByParent.set(node.parentId, [...(childrenByParent.get(node.parentId) ?? []), node.nodeId]);
  }
  const result = new Set<string>();
  const stack = [...(childrenByParent.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (result.has(next)) continue;
    result.add(next);
    stack.push(...(childrenByParent.get(next) ?? []));
  }
  return result;
}

function occlusionRisks(
  from: ZeroLayerSnapshot,
  bindingResult: ZeroLayerMotionBindingResult
): ZeroLayerDiagnosticRisk[] {
  const boundFrom = new Set(bindingResult.bindings.map((binding) => binding.nodeId));
  const risks: ZeroLayerDiagnosticRisk[] = [];
  for (const exitNode of bindingResult.exit) {
    if (!exitNode.fills?.some((fill) => fill.type === "solid")) continue;
    const descendants = descendantIds(from, exitNode.nodeId);
    const matchedDescendants = [...descendants].filter((id) => boundFrom.has(id));
    if (matchedDescendants.length === 0) continue;
    risks.push({
      code: "LAYER_ORDER_OCCLUSION",
      severity: "warning",
      nodeId: exitNode.nodeId,
      relatedNodeIds: matchedDescendants,
      message: `Exiting parent layer ${exitNode.nodeId} can cover matched child layers: ${matchedDescendants.join(", ")}.`
    });
  }
  return risks;
}

function recommendationForRisk(risk: ZeroLayerDiagnosticRisk): ZeroLayerDiagnosticRecommendation | undefined {
  const withNodeIds = (
    recommendation: Omit<ZeroLayerDiagnosticRecommendation, "nodeIds">,
    nodeIds: Array<string | undefined>
  ): ZeroLayerDiagnosticRecommendation => {
    const filtered = nodeIds.filter((value): value is string => Boolean(value));
    return {
      ...recommendation,
      ...(filtered.length > 0 ? { nodeIds: filtered } : {})
    };
  };

  if (risk.code === "LAYER_ORDER_OCCLUSION") {
    return withNodeIds(
      {
        code: "ADJUST_EXIT_LAYER_ORDER",
        message: "Render exiting parent containers behind matched child layers."
      },
      [risk.nodeId, ...(risk.relatedNodeIds ?? [])]
    );
  }
  if (risk.code === "COORDINATE_NORMALIZATION") {
    return withNodeIds(
      {
        code: "FIX_COORDINATE_NORMALIZATION",
        message: "Prefer absolute bounding boxes when converting Zero coordinates."
      },
      [risk.nodeId]
    );
  }
  if (risk.code === "STYLE_UNSUPPORTED" || risk.code === "VECTOR_APPROXIMATION") {
    return withNodeIds(
      {
        code: "ADD_STYLE_RENDERER_SUPPORT",
        message: "Add renderer support or asset export for unsupported Zero styles."
      },
      risk.relatedNodeIds ?? []
    );
  }
  if (risk.code === "MATCH_LOW_CONFIDENCE") {
    return withNodeIds(
      {
        code: "REVIEW_LOW_CONFIDENCE_MATCH",
        message: "Review low-confidence layer matches or improve Zero layer naming."
      },
      [risk.nodeId, ...(risk.relatedNodeIds ?? [])]
    );
  }
  if (risk.code === "ZERO_NAMING_WEAK") {
    return withNodeIds(
      {
        code: "IMPROVE_ZERO_LAYER_NAMING",
        message: "Use stable motion:* names for reusable Zero component parts."
      },
      [risk.nodeId]
    );
  }
  return undefined;
}

function lowConfidenceRisk(
  item: ZeroLayerMotionBindingResult["unresolved"][number]
): ZeroLayerDiagnosticRisk {
  return {
    code: "MATCH_LOW_CONFIDENCE",
    severity: "warning",
    ...(item.fromNodeId ? { nodeId: item.fromNodeId } : {}),
    ...(item.toNodeId ? { relatedNodeIds: [item.toNodeId] } : {}),
    message: item.reason
  };
}

function lowConfidenceBindingRisks(
  bindingResult: ZeroLayerMotionBindingResult
): ZeroLayerDiagnosticRisk[] {
  return bindingResult.bindings
    .filter((binding) => binding.confidence < lowConfidenceBindingThreshold)
    .map((binding) => ({
      code: "MATCH_LOW_CONFIDENCE",
      severity: "warning",
      nodeId: binding.nodeId,
      relatedNodeIds: [binding.toNodeId],
      message: `low confidence ${binding.confidence}`
    }));
}

function motionItems(
  result: ReturnType<typeof compileZeroLayerMotionComposition>,
  bindingResult: ZeroLayerMotionBindingResult
): ZeroLayerDiagnosticReport["motion"] {
  const byLayerId = new Map(result.steps.map((step) => [step.layerId ?? "", step]));
  const matched: ZeroLayerDiagnosticMotionItem[] = bindingResult.bindings.map((binding) => {
    const step = byLayerId.get(binding.layerId);
    return {
      type: "matched",
      nodeId: binding.nodeId,
      toNodeId: binding.toNodeId,
      layerId: binding.layerId,
      durationMs: step?.durationMs ?? 0,
      delayMs: step?.delayMs ?? 0,
      easing: easingName(step?.easing),
      fromBounds: sameBounds(binding.fromBounds),
      toBounds: sameBounds(binding.toBounds),
      opacity: { from: 1, to: 1 }
    };
  });
  const enter: ZeroLayerDiagnosticMotionItem[] = bindingResult.enter.map((node) => {
    const layerId = layerIdForNode(node.nodeId);
    const step = byLayerId.get(layerId);
    return {
      type: "enter",
      nodeId: node.nodeId,
      layerId,
      durationMs: step?.durationMs ?? 0,
      delayMs: step?.delayMs ?? 0,
      easing: easingName(step?.easing),
      fromBounds: sameBounds(node.bounds),
      toBounds: sameBounds(node.bounds),
      opacity: { from: 0, to: 1 }
    };
  });
  const exit: ZeroLayerDiagnosticMotionItem[] = bindingResult.exit.map((node) => {
    const layerId = layerIdForNode(node.nodeId);
    const step = byLayerId.get(layerId);
    return {
      type: "exit",
      nodeId: node.nodeId,
      layerId,
      durationMs: step?.durationMs ?? 0,
      delayMs: step?.delayMs ?? 0,
      easing: easingName(step?.easing),
      fromBounds: sameBounds(node.bounds),
      toBounds: sameBounds(node.bounds),
      opacity: { from: 1, to: 0 }
    };
  });

  return {
    durationMs: result.document.timeline.durationMs,
    matched,
    enter,
    exit
  };
}

function weakNamingRisks(snapshot: ZeroLayerSnapshot, frame: "from" | "to"): ZeroLayerDiagnosticRisk[] {
  const weakNames = new Set(["text", "content"]);
  return snapshot.layers
    .filter((node) => weakNames.has(node.name.trim().toLowerCase()) || /^组\s*\d+$/u.test(node.name.trim()))
    .slice(0, 20)
    .map((node) => ({
      code: "ZERO_NAMING_WEAK",
      severity: "info",
      nodeId: node.nodeId,
      message: `${frame} layer ${node.nodeId} uses a generic name "${node.name}".`
    }));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function riskNodeIds(risks: ZeroLayerDiagnosticRisk[], code: ZeroLayerDiagnosticRisk["code"]): string[] {
  return unique(
    risks
      .filter((risk) => risk.code === code)
      .flatMap((risk) => [risk.nodeId, ...(risk.relatedNodeIds ?? [])])
      .filter((value): value is string => Boolean(value))
  );
}

export function deriveZeroLayerDiagnosticGate(
  report: Omit<ZeroLayerDiagnosticReport, "gate"> | ZeroLayerDiagnosticReport
): ZeroLayerDiagnosticGate {
  const errorCount = report.risks.filter((risk) => risk.severity === "error").length;
  const warningCount = report.risks.filter((risk) => risk.severity === "warning").length;
  const totalLayers = Math.max(1, report.read.fromLayerCount + report.read.toLayerCount);
  const unresolvedRatio = report.matching.unresolved / Math.max(1, report.matching.matched + report.matching.unresolved);
  const layerDeltaRatio = Math.abs(report.read.fromLayerCount - report.read.toLayerCount) / totalLayers;
  const vectorNodeIds = riskNodeIds(report.risks, "VECTOR_APPROXIMATION");
  const lowConfidenceNodeIds = riskNodeIds(report.risks, "MATCH_LOW_CONFIDENCE");
  const reasons: string[] = [];
  const actions: ZeroLayerDiagnosticGate["actions"] = [];

  if (errorCount > 0) {
    reasons.push(`error-risks:${errorCount}`);
    actions.push({
      code: "BLOCK_GENERATION",
      message: "Fix error-level Zero layer read or geometry issues before generating motion."
    });
  }
  if (report.read.fromLayerCount === 0 || report.read.toLayerCount === 0) {
    reasons.push("empty-frame-layer-read");
    actions.push({
      code: "REVIEW_ZERO_SOURCE",
      message: "One frame has no readable layers; verify the selected Zero node is a component/frame."
    });
  }
  if (report.matching.unresolved > 0) {
    reasons.push(`unresolved-layers:${report.matching.unresolved}`);
    actions.push({
      code: "KEEP_UNMATCHED_STATIC",
      message: "Keep unresolved layers static or use enter/exit fade instead of morphing them.",
      targetNodeIds: lowConfidenceNodeIds
    });
  }
  if (lowConfidenceNodeIds.length > 0) {
    reasons.push(`low-confidence:${lowConfidenceNodeIds.length}`);
    actions.push({
      code: "DOWNGRADE_LOW_CONFIDENCE_TO_FADE",
      message: "Do not use geometry morph for low-confidence matches; degrade them to opacity transitions.",
      targetNodeIds: lowConfidenceNodeIds
    });
  }
  if (vectorNodeIds.length > 0) {
    reasons.push(`unsupported-style:vector:${vectorNodeIds.length}`);
    actions.push({
      code: "USE_ASSET_FALLBACK_FOR_VECTOR",
      message: "Render vector-heavy layers from exported assets before claiming high-fidelity restoration.",
      targetNodeIds: vectorNodeIds
    });
  }
  if (layerDeltaRatio > 0.35) {
    reasons.push(`layer-count-delta:${Math.round(layerDeltaRatio * 100)}%`);
  }

  const rawScore =
    100 -
    errorCount * 35 -
    warningCount * 8 -
    report.matching.unresolved * 10 -
    Math.round(unresolvedRatio * 25) -
    Math.round(layerDeltaRatio * 20);
  const score = Math.max(0, Math.min(100, rawScore));
  const status: ZeroLayerDiagnosticGate["status"] =
    errorCount > 0 || report.read.fromLayerCount === 0 || report.read.toLayerCount === 0
      ? "blocked"
      : reasons.length > 0 || score < 85
        ? "degraded"
        : "pass";
  const strategy: ZeroLayerDiagnosticGate["strategy"] =
    status === "blocked"
      ? "manual-fix-required"
      : vectorNodeIds.length > 0 && score < 55
        ? "screenshot-fallback"
        : status === "degraded"
          ? "safe-fade-unmatched"
          : "native-layer-morph";

  actions.push({
    code: "RUN_SCREENSHOT_GATE",
    message: "Verify exported first and last frames with the screenshot pixel gate before release."
  });

  const summary =
    status === "pass"
      ? "Zero native layer motion is eligible for direct generation."
      : status === "blocked"
        ? "Zero native layer motion is blocked until source or geometry errors are fixed."
        : "Zero native layer motion should be generated in degraded mode with risky morphs disabled.";

  return {
    status,
    pass: status === "pass",
    strategy,
    score,
    summary,
    reasons: unique(reasons),
    actions
  };
}

export function createZeroLayerDiagnosticReport(
  input: CreateZeroLayerDiagnosticReportInput
): ZeroLayerDiagnosticReport {
  const bindingResult = input.bindingResult ?? compileZeroLayerMotionBindings(input.from, input.to);
  const compositionResult = compileZeroLayerMotionComposition({
    from: input.from,
    to: input.to,
    bindingResult,
    ...(input.durationMs ? { durationMs: input.durationMs } : {})
  });
  const capabilities = styleCapabilities(input.from, input.to);
  const geometry = [...geometryRisks(input.from, "from"), ...geometryRisks(input.to, "to")];
  const risks: ZeroLayerDiagnosticRisk[] = [
    ...geometry,
    ...styleRisks(capabilities),
    ...occlusionRisks(input.from, bindingResult),
    ...lowConfidenceBindingRisks(bindingResult),
    ...bindingResult.unresolved.map(lowConfidenceRisk),
    ...weakNamingRisks(input.from, "from"),
    ...weakNamingRisks(input.to, "to")
  ];
  const recommendations = risks
    .map(recommendationForRisk)
    .filter((item): item is ZeroLayerDiagnosticRecommendation => Boolean(item));

  const reportWithoutGate: Omit<ZeroLayerDiagnosticReport, "gate"> = {
    schemaVersion,
    read: {
      source: input.source ?? "unknown",
      ...(input.bridge ? { bridge: input.bridge } : {}),
      fromNodeId: input.from.nodeId,
      toNodeId: input.to.nodeId,
      fromName: input.from.name,
      toName: input.to.name,
      fromLayerCount: input.from.layers.length,
      toLayerCount: input.to.layers.length,
      fromSize: { width: input.from.width, height: input.from.height },
      toSize: { width: input.to.width, height: input.to.height }
    },
    matching: {
      matched: bindingResult.bindings.length,
      enter: bindingResult.enter.length,
      exit: bindingResult.exit.length,
      unresolved: bindingResult.unresolved.length,
      lowConfidence: bindingResult.unresolved
    },
    motion: motionItems(compositionResult, bindingResult),
    geometry,
    styleCapabilities: capabilities,
    risks,
    recommendations
  };

  return {
    ...reportWithoutGate,
    gate: deriveZeroLayerDiagnosticGate(reportWithoutGate)
  };
}
