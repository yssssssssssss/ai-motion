import type {
  CreateRestorationReportInput,
  FrameElementMatchResult,
  FrameSnapshot,
  RestorationIssue,
  RestorationMetric,
  RestorationReport,
  UserBindingOverride,
  VisualMotionBindingResult,
  ZeroVisualSnapshot
} from "./schema";

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function computeInputHash(from: ZeroVisualSnapshot | FrameSnapshot, to: ZeroVisualSnapshot | FrameSnapshot): string {
  const fromDigest = snapshotDigest(from);
  const toDigest = snapshotDigest(to);
  return hashString(fromDigest + "|" + toDigest);
}

function snapshotDigest(snap: ZeroVisualSnapshot | FrameSnapshot): string {
  if ("elements" in snap) {
    const elParts = snap.elements.map(
      (el) => `${el.nodeId}:${el.kind}:${el.x},${el.y},${el.w},${el.h}:${el.text ?? ""}:${el.style?.background ?? ""}:${el.style?.radius ?? ""}`
    );
    return `${snap.frameId}:${snap.name}:${snap.elements.length}:${elParts.join(";")}`;
  }
  const nodeParts = snap.nodes.map(
    (n) => `${n.nodeId}:${n.kind}:${n.bounds.x},${n.bounds.y},${n.bounds.w},${n.bounds.h}:${n.text ?? ""}`
  );
  const htmlHash = hashString(snap.html ?? "");
  const cssHash = hashString(snap.css ?? "");
  const assetHash = hashString(snap.assets.map((a) => `${a.nodeId ?? a.id}:${a.url}`).join(";"));
  return `${snap.frameId}:${snap.name}:${snap.nodes.length}:h${htmlHash}:c${cssHash}:a${assetHash}:${nodeParts.join(";")}`;
}

function computeBindingHash(bindings: VisualMotionBindingResult | FrameElementMatchResult, userOverrides?: UserBindingOverride[]): string {
  let base: string;
  if ("bindings" in bindings) {
    const keys = bindings.bindings.map((b) => `${b.nodeId}-${b.toNodeId}:${b.confidence}`).join(",");
    const ignoredKeys = (bindings.ignored ?? []).map((item) => `${item.nodeId}:${item.reason}`).join(",");
    base =
      keys +
      `:e${bindings.enter.length}:x${bindings.exit.length}:i(${ignoredKeys}):u${bindings.unresolved.length}`;
  } else {
    const keys = bindings.matches.map((m) => `${m.fromKey}-${m.toKey}:${m.confidence}`).join(",");
    base = keys + `:e${bindings.enter.length}:x${bindings.exit.length}:u${bindings.unresolved.length}`;
  }
  if (userOverrides && userOverrides.length > 0) {
    const overridePart = userOverrides.map((o) => `${o.fromNodeId}:${o.action}:${o.toNodeId ?? ""}`).join(",");
    base += `:ov(${overridePart})`;
  }
  return hashString(base);
}

function isFrameSnapshot(snap: ZeroVisualSnapshot | FrameSnapshot): snap is FrameSnapshot {
  return "elements" in snap;
}

function isVisualBindingResult(b: VisualMotionBindingResult | FrameElementMatchResult): b is VisualMotionBindingResult {
  return "bindings" in b;
}

function computeNodeCoverage(
  from: ZeroVisualSnapshot | FrameSnapshot,
  to: ZeroVisualSnapshot | FrameSnapshot,
  bindings: VisualMotionBindingResult | FrameElementMatchResult,
  issues: RestorationIssue[]
): RestorationMetric {
  const fromCount = isFrameSnapshot(from)
    ? from.elements.length
    : from.nodes.filter((node) => node.kind !== "group").length;
  const toCount = isFrameSnapshot(to)
    ? to.elements.length
    : to.nodes.filter((node) => node.kind !== "group").length;
  const totalNodes = Math.max(fromCount, toCount, 1);

  let value: number;
  if (isVisualBindingResult(bindings)) {
    const fromCovered = bindings.bindings.length + bindings.exit.length + (bindings.ignored?.length ?? 0);
    const toCovered = bindings.bindings.length + bindings.enter.length;
    value = Math.min(100, Math.round(((fromCovered / Math.max(fromCount, 1)) + (toCovered / Math.max(toCount, 1))) * 50));
  } else {
    const fromCovered = bindings.matches.length + bindings.exit.length;
    const toCovered = bindings.matches.length + bindings.enter.length;
    value = Math.min(100, Math.round(((fromCovered / Math.max(fromCount, 1)) + (toCovered / Math.max(toCount, 1))) * 50));
  }

  const unresolvedCount = isVisualBindingResult(bindings)
    ? bindings.unresolved.length
    : bindings.unresolved.length;

  if (unresolvedCount > 0) {
    const unresolvedItems = isVisualBindingResult(bindings) ? bindings.unresolved : bindings.unresolved;
    for (const u of unresolvedItems) {
      const nodeId = "fromNodeId" in u ? u.fromNodeId : ("fromKey" in u ? u.fromKey : undefined);
      const fallbackId = "toNodeId" in u ? u.toNodeId : ("toKey" in u ? u.toKey : undefined);
      issues.push({
        id: `node-unresolved-${nodeId ?? fallbackId ?? "unknown"}`,
        severity: unresolvedCount > totalNodes * 0.2 ? "error" : "warning",
        source: "conversion-lost",
        category: "node",
        ...(nodeId ? { nodeId } : {}),
        title: "节点未进入绑定链路",
        reason: u.reason,
        suggestion: "检查节点是否被正确识别，或手动指定匹配关系"
      });
    }
  }

  const status = value >= 90 ? "ok" : value >= 70 ? "warning" : "error";
  return { value, status, weight: 30 };
}

function computeStyleCoverage(
  from: ZeroVisualSnapshot | FrameSnapshot,
  _to: ZeroVisualSnapshot | FrameSnapshot,
  issues: RestorationIssue[]
): RestorationMetric {
  if (!isFrameSnapshot(from)) {
    const unknownTokens = "unknownStyleTokens" in from ? (from.unknownStyleTokens ?? []) : [];
    if (unknownTokens.length === 0) return { value: null, status: "not-applicable", weight: 25 };

    let totalTokenCount = 0;
    for (const entry of unknownTokens) {
      totalTokenCount += entry.tokens.length;
      for (const token of entry.tokens.slice(0, 3)) {
        issues.push({
          id: `style-unknown-token-${entry.nodeId ?? "root"}-${token}`,
          severity: "warning",
          source: "conversion-lost",
          category: "style",
          ...(entry.nodeId ? { nodeId: entry.nodeId } : {}),
          title: `未识别样式 token: ${token}`,
          reason: "该 Tailwind class 未进入样式白名单，渲染时将丢失",
          suggestion: "如影响视觉保真度，可向 styleFromClassToken 白名单补充此 token"
        });
      }
    }
    const value = Math.max(0, Math.min(100, 100 - totalTokenCount * 2));
    const status = value >= 90 ? "ok" : value >= 70 ? "warning" : "error";
    return { value, status, weight: 25 };
  }

  const styleFields = ["background", "radius", "borderColor", "boxShadow", "fontFamily"] as const;
  let totalChecks = 0;
  let issueCount = 0;

  for (const el of from.elements) {
    if (el.kind === "vector") {
      totalChecks++;
      if (!el.style?.background) {
        issueCount++;
        issues.push({
          id: `style-svg-bg-${el.key}`,
          severity: "error",
          source: "conversion-lost",
          category: "style",
          nodeId: el.nodeId,
          field: "background",
          title: `SVG/矢量背景可能丢失: ${el.name}`,
          reason: "矢量类型节点在低保真路径中无法直接渲染其填充",
          suggestion: "保留为 asset 背景或转成可编辑 rect"
        });
      }
    }

    if (!el.style) continue;
    for (const field of styleFields) {
      if (el.style[field] === undefined) continue;
      totalChecks++;
      if (field === "radius" && el.style.radius && el.style.radius > 0 && !el.style.background) {
        issueCount++;
        issues.push({
          id: `style-radius-no-bg-${el.key}`,
          severity: "warning",
          source: "conversion-lost",
          category: "style",
          nodeId: el.nodeId,
          field: "radius",
          title: `圆角节点缺少背景: ${el.name}`,
          reason: "有 radius 但无 background，渲染时圆角不可见",
          suggestion: "补充背景色或确认为透明容器"
        });
      }
    }
  }

  if (totalChecks === 0) return { value: null, status: "not-applicable", weight: 25 };

  const value = Math.round(((totalChecks - issueCount) / totalChecks) * 100);
  const status = value >= 90 ? "ok" : value >= 70 ? "warning" : "error";
  return { value, status, weight: 25 };
}

function computeLayerOrderConfidence(
  from: ZeroVisualSnapshot | FrameSnapshot,
  bindings: VisualMotionBindingResult | FrameElementMatchResult,
  issues: RestorationIssue[]
): RestorationMetric {
  if (!isVisualBindingResult(bindings)) {
    if (!isFrameSnapshot(from)) return { value: null, status: "unknown", weight: 20 };
    return { value: 85, status: "ok", weight: 20 };
  }

  const sorted = [...bindings.bindings].sort(
    (a, b) => (a.fromBounds.y - b.fromBounds.y) || (a.fromBounds.x - b.fromBounds.x)
  );

  let inversions = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    if (current.toBounds.y > next.toBounds.y + next.toBounds.h) {
      inversions++;
    }
  }

  if (inversions > 0) {
    issues.push({
      id: "layer-order-inversion",
      severity: inversions > 3 ? "error" : "warning",
      source: "conversion-lost",
      category: "layer-order",
      title: `图层顺序存在 ${inversions} 处倒置`,
      reason: "首帧节点视觉顺序与尾帧绑定目标不一致",
      suggestion: "检查 zIndex 分配或手动调整图层顺序"
    });
  }

  const total = Math.max(sorted.length - 1, 1);
  const value = Math.round(((total - inversions) / total) * 100);
  const status = value >= 90 ? "ok" : value >= 70 ? "warning" : "error";
  return { value, status, weight: 20 };
}

function computeMatchConfidence(
  bindings: VisualMotionBindingResult | FrameElementMatchResult,
  issues: RestorationIssue[]
): RestorationMetric {
  const confidences: number[] = isVisualBindingResult(bindings)
    ? bindings.bindings.map((b) => b.confidence)
    : bindings.matches.map((m) => m.confidence);

  if (confidences.length === 0) {
    issues.push({
      id: "match-empty",
      severity: "warning",
      source: "input-missing",
      category: "match",
      title: "无匹配结果",
      reason: "绑定结果为空，无法判断匹配质量",
      suggestion: "确认首尾帧是否有可匹配节点"
    });
    return { value: null, status: "unknown", weight: 15 };
  }

  const lowConfidence = confidences.filter((c) => c < 60);
  for (const _c of lowConfidence.slice(0, 5)) {
    const binding = isVisualBindingResult(bindings)
      ? bindings.bindings.find((b) => b.confidence === _c)
      : bindings.matches.find((m) => m.confidence === _c);
    if (binding) {
      const nodeId = "nodeId" in binding ? binding.nodeId : ("fromKey" in binding ? binding.fromKey : undefined);
      issues.push({
        id: `match-low-${nodeId ?? "unknown"}`,
        severity: _c < 40 ? "error" : "warning",
        source: "conversion-lost",
        category: "match",
        ...(nodeId ? { nodeId } : {}),
        title: `低置信度匹配 (${_c}%)`,
        reason: "匹配分数过低，可能为误配",
        suggestion: "检查匹配原因或手动修正"
      });
    }
  }

  const avg = Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length);
  const value = Math.min(100, avg);
  const status = value >= 75 ? "ok" : value >= 55 ? "warning" : "error";
  return { value, status, weight: 15 };
}

function computeVisualRisk(
  from: ZeroVisualSnapshot | FrameSnapshot,
  to: ZeroVisualSnapshot | FrameSnapshot,
  issues: RestorationIssue[]
): RestorationMetric {
  let riskCount = 0;

  if (isFrameSnapshot(from) && !from.screenshotUrl) {
    riskCount++;
    issues.push({
      id: "risk-no-screenshot-from",
      severity: "warning",
      source: "input-missing",
      category: "asset",
      title: "首帧缺少截图",
      reason: "无 screenshotUrl，高保真预览不可用",
      suggestion: "重新从 Zero 导入以获取截图"
    });
  }

  if (isFrameSnapshot(to) && !to.screenshotUrl) {
    riskCount++;
    issues.push({
      id: "risk-no-screenshot-to",
      severity: "warning",
      source: "input-missing",
      category: "asset",
      title: "尾帧缺少截图",
      reason: "无 screenshotUrl，高保真预览不可用",
      suggestion: "重新从 Zero 导入以获取截图"
    });
  }

  if (!isFrameSnapshot(from) && !from.html) {
    riskCount++;
    issues.push({
      id: "risk-no-html-from",
      severity: "error",
      source: "input-missing",
      category: "asset",
      title: "首帧缺少 HTML",
      reason: "ZeroVisualSnapshot 无 html 内容，无法渲染高保真预览",
      suggestion: "重新从 Zero 读取完整快照"
    });
  }

  if (!isFrameSnapshot(to) && !("html" in to && to.html)) {
    riskCount++;
    issues.push({
      id: "risk-no-html-to",
      severity: "error",
      source: "input-missing",
      category: "asset",
      title: "尾帧缺少 HTML",
      reason: "ZeroVisualSnapshot 无 html 内容，无法渲染高保真预览",
      suggestion: "重新从 Zero 读取完整快照"
    });
  }

  const value = Math.max(0, 100 - riskCount * 25);
  const status = value >= 80 ? "ok" : value >= 50 ? "warning" : "error";
  return { value, status, weight: 10 };
}

function applyIssueCaps(metrics: RestorationReport["metrics"], issues: RestorationIssue[]): void {
  const categoryToMetric: Record<string, keyof RestorationReport["metrics"]> = {
    node: "nodeCoverage",
    style: "styleCoverage",
    "layer-order": "layerOrderConfidence",
    match: "matchConfidence",
    asset: "visualRisk",
    export: "visualRisk"
  };

  for (const issue of issues) {
    const metricKey = categoryToMetric[issue.category];
    if (!metricKey) continue;
    const metric = metrics[metricKey];
    if (metric.value === null) continue;

    if (issue.severity === "error") {
      metric.value = Math.min(metric.value, 60);
      metric.status = "error";
    } else if (issue.severity === "warning" && metric.status !== "error") {
      metric.value = Math.min(metric.value, 85);
      if (metric.status === "ok") metric.status = "warning";
    }
  }
}

function computeScore(metrics: RestorationReport["metrics"]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const metric of Object.values(metrics)) {
    if (metric.status === "unknown" || metric.status === "not-applicable" || metric.value === null) continue;
    weightedSum += metric.value * metric.weight;
    totalWeight += metric.weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function generateSummary(metrics: RestorationReport["metrics"], issues: RestorationIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  if (errors === 0 && warnings === 0) return "还原质量良好，无关键问题。";
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} 个错误`);
  if (warnings > 0) parts.push(`${warnings} 个警告`);
  return `还原存在 ${parts.join("、")}，需要关注。`;
}

export function createRestorationReport(input: CreateRestorationReportInput): RestorationReport {
  const { from, to, bindings, userOverrides } = input;
  const issues: RestorationIssue[] = [];

  const nodeCoverage = computeNodeCoverage(from, to, bindings, issues);
  const styleCoverage = computeStyleCoverage(from, to, issues);
  const layerOrderConfidence = computeLayerOrderConfidence(from, bindings, issues);
  const matchConfidence = computeMatchConfidence(bindings, issues);
  const visualRisk = computeVisualRisk(from, to, issues);

  const metrics = { nodeCoverage, styleCoverage, layerOrderConfidence, matchConfidence, visualRisk };

  applyIssueCaps(metrics, issues);

  const score = computeScore(metrics);
  const summary = generateSummary(metrics, issues);

  return {
    score,
    summary,
    generatedAt: new Date().toISOString(),
    inputHash: computeInputHash(from, to),
    bindingHash: computeBindingHash(bindings, userOverrides),
    metrics,
    issues
  };
}
