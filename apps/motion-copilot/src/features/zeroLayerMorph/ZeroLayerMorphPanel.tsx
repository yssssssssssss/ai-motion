import { useEffect, useMemo, useState } from "react";
import {
  compileZeroLayerMotionBindings,
  compileZeroLayerMotionComposition,
  createZeroLayerDiagnosticReport,
  createZeroLayerRecipeSampleReport,
  deriveZeroLayerNodeCandidates,
  deriveZeroLayerDiagnosticGate,
  applyZeroLayerMotionRecipe,
  type ZeroLayerDiagnosticReport,
  type ZeroLayerMotionBinding,
  type ZeroLayerMotionCompositionResult,
  type ZeroLayerMorphSource,
  type ZeroLayerNode,
  type ZeroLayerNodeCandidate,
  type ZeroLayerNodeOverride,
  type ZeroLayerSnapshot,
  zeroLayerMotionRecipes,
  type ZeroLayerMotionRecipeCategory,
  type ZeroLayerMotionRecipeId
} from "@motion-copilot/core";
import {
  fetchZeroLayerSnapshotResult,
  type ZeroLayerSnapshotResult,
  type ZeroLayerSnapshotSource
} from "../../services/zeroLayerClient";
import { ZeroLayerStage } from "./ZeroLayerStage";

type ZeroLayerMorphPanelProps = {
  savedSource?: ZeroLayerMorphSource;
  selectedNodeId?: string | undefined;
  onApplyComposition: (result: ZeroLayerMotionCompositionResult) => void;
  onUpdateSource: (source: ZeroLayerMorphSource) => void;
  onSelectNode?: ((nodeId: string) => void) | undefined;
};

type LayerReadInfo = {
  source: ZeroLayerSnapshotSource;
  bridge?: string;
  from: Pick<
    ZeroLayerSnapshot,
    "nodeId" | "name" | "width" | "height" | "layers" | "assets" | "screenshotUrl"
  >;
  to: Pick<ZeroLayerSnapshot, "nodeId" | "name" | "width" | "height" | "layers" | "assets" | "screenshotUrl">;
  objects: { from: number; to: number };
};

type OverrideTarget = {
  frame: "from" | "to";
  nodeId: string;
};

type CandidateFrame = "from" | "to";
type RecipeCategoryFilter = "all" | ZeroLayerMotionRecipeCategory;

const defaultFromNodeId = "32:34";
const defaultToNodeId = "32:35";
const recipeCategoryLabels: Record<RecipeCategoryFilter, string> = {
  all: "全部",
  state: "状态",
  expand: "展开",
  content: "内容",
  navigation: "导航",
  overlay: "浮层",
  list: "列表"
};

const recipeCategoryFilters = Object.keys(recipeCategoryLabels) as RecipeCategoryFilter[];

function layerReadInfo(from: ZeroLayerSnapshotResult, to: ZeroLayerSnapshotResult): LayerReadInfo {
  const bridge = from.bridge ?? to.bridge;
  return {
    source: from.source === to.source ? from.source : "custom-command",
    ...(bridge ? { bridge } : {}),
    from: from.snapshot,
    to: to.snapshot,
    objects: { from: 0, to: 0 }
  };
}

function snapshotSummary(snapshot: LayerReadInfo["from"]): string {
  return `${snapshot.name} · ${snapshot.nodeId} · ${snapshot.width}x${snapshot.height} · ${snapshot.layers.length} layers · ${snapshot.assets.length} assets`;
}

function diagnosticRiskCount(
  report: ZeroLayerDiagnosticReport,
  severity: "error" | "warning" | "info"
): number {
  return report.risks.filter((risk) => risk.severity === severity).length;
}

function diagnosticSummary(report: ZeroLayerDiagnosticReport): string {
  return `${report.read.fromLayerCount}→${report.read.toLayerCount} layers · matched ${report.matching.matched} · enter ${report.matching.enter} · exit ${report.matching.exit} · unresolved ${report.matching.unresolved}`;
}

function diagnosticMotionSummary(report: ZeroLayerDiagnosticReport): string {
  const yMotion = report.motion.matched.filter((item) => item.fromBounds.y !== item.toBounds.y).length;
  return `${report.motion.durationMs}ms · matched ${report.motion.matched.length} · enter ${report.motion.enter.length} · exit ${report.motion.exit.length} · y-motion ${yMotion}`;
}

function recipeSampleSummary(source: ZeroLayerMorphSource | undefined): {
  recipeCount: number;
  distinctSignatures: number;
  errorCount: number;
  warningCount: number;
} | undefined {
  if (!source) return undefined;
  const report = createZeroLayerRecipeSampleReport(source);
  return {
    recipeCount: report.comparison.recipeCount,
    distinctSignatures: report.comparison.distinctSignatures,
    errorCount: report.risks.filter((risk) => risk.severity === "error").length,
    warningCount: report.risks.filter((risk) => risk.severity === "warning").length
  };
}

function diagnosticGate(report: ZeroLayerDiagnosticReport) {
  return report.gate ?? deriveZeroLayerDiagnosticGate(report);
}

function diagnosticGateLabel(report: ZeroLayerDiagnosticReport): string {
  const gate = diagnosticGate(report);
  const statusLabel = gate.status === "pass" ? "可放行" : gate.status === "blocked" ? "已阻塞" : "降级生成";
  return `${statusLabel} · ${gate.strategy} · score ${gate.score}`;
}

function nodeLabel(node: ZeroLayerNode | undefined): string {
  if (!node) return "未选择";
  return `${node.text?.trim() || node.name} · ${node.nodeId}`;
}

function frameLabel(frame: "from" | "to"): string {
  return frame === "from" ? "首帧" : "尾帧";
}

function candidateSummary(candidate: ZeroLayerNodeCandidate): string {
  const { bounds } = candidate;
  return `${candidate.kind} · ${Math.round(bounds.w)}x${Math.round(bounds.h)} · ${candidate.nodeId}`;
}

function candidatePath(candidate: ZeroLayerNodeCandidate): string {
  return candidate.path?.join(" / ") ?? candidate.name;
}

function filterCandidates(
  candidates: ZeroLayerNodeCandidate[],
  query: string
): ZeroLayerNodeCandidate[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return candidates;
  return candidates.filter((candidate) => {
    const haystack = `${candidate.nodeId} ${candidate.name} ${candidate.kind} ${candidatePath(candidate)}`.toLowerCase();
    return haystack.includes(keyword);
  });
}

function selectedBinding(
  source: ZeroLayerMorphSource | undefined,
  nodeId: string | undefined
): ZeroLayerMotionBinding | undefined {
  if (!source || !nodeId) return undefined;
  return source.bindingResult.bindings.find(
    (binding) => binding.nodeId === nodeId || binding.toNodeId === nodeId
  );
}

function selectedNode(
  source: ZeroLayerMorphSource | undefined,
  nodeId: string | undefined
): ZeroLayerNode | undefined {
  if (!source || !nodeId) return undefined;
  const binding = selectedBinding(source, nodeId);
  if (binding) {
    return (
      source.from.layers.find((node) => node.nodeId === binding.nodeId) ??
      source.to.layers.find((node) => node.nodeId === binding.toNodeId)
    );
  }
  return (
    source.from.layers.find((node) => node.nodeId === nodeId) ??
    source.to.layers.find((node) => node.nodeId === nodeId)
  );
}

function overrideFor(
  source: ZeroLayerMorphSource | undefined,
  target: OverrideTarget | undefined
): ZeroLayerNodeOverride | undefined {
  if (!source || !target) return undefined;
  return source.nodeOverrides?.find(
    (override) =>
      override.nodeId === target.nodeId && (override.frame === target.frame || override.frame === "both")
  );
}

function nodeFrame(source: ZeroLayerMorphSource, nodeId: string): OverrideTarget | undefined {
  if (source.from.layers.some((node) => node.nodeId === nodeId)) return { frame: "from", nodeId };
  if (source.to.layers.some((node) => node.nodeId === nodeId)) return { frame: "to", nodeId };
  return undefined;
}

function overrideTargets(source: ZeroLayerMorphSource, nodeId: string | undefined): OverrideTarget[] {
  if (!nodeId) return [];
  const binding = selectedBinding(source, nodeId);
  if (binding) {
    return [
      { frame: "from", nodeId: binding.nodeId },
      { frame: "to", nodeId: binding.toNodeId }
    ];
  }
  const target = nodeFrame(source, nodeId);
  return target ? [target] : [];
}

function upsertOverrides(
  source: ZeroLayerMorphSource,
  nodeId: string | undefined,
  patch: Partial<Omit<ZeroLayerNodeOverride, "frame" | "nodeId">>
): ZeroLayerMorphSource {
  const targets = overrideTargets(source, nodeId);
  if (targets.length === 0) return source;
  const current = source.nodeOverrides ?? [];
  const next = current.filter(
    (override) =>
      !targets.some(
        (target) =>
          target.nodeId === override.nodeId && (target.frame === override.frame || override.frame === "both")
      )
  );
  for (const target of targets) {
    const previous = current.find(
      (override) => override.nodeId === target.nodeId && override.frame === target.frame
    );
    next.push({ ...target, ...previous, ...patch });
  }
  return { ...source, nodeOverrides: next };
}

function numberValue(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ZeroLayerMorphPanel({
  savedSource,
  selectedNodeId: selectedNodeIdProp,
  onApplyComposition,
  onUpdateSource,
  onSelectNode
}: ZeroLayerMorphPanelProps) {
  const [fromNodeId, setFromNodeId] = useState(defaultFromNodeId);
  const [toNodeId, setToNodeId] = useState(defaultToNodeId);
  const [localSelectedNodeId, setLocalSelectedNodeId] = useState<string | undefined>(
    savedSource?.bindingResult.bindings[0]?.nodeId
  );
  const [readInfo, setReadInfo] = useState<LayerReadInfo | undefined>(undefined);
  const [diagnosticReport, setDiagnosticReport] = useState<ZeroLayerDiagnosticReport | undefined>(
    savedSource?.diagnosticReport
  );
  const [candidateQuery, setCandidateQuery] = useState("");
  const [recipeCategory, setRecipeCategory] = useState<RecipeCategoryFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const selectedNodeId = selectedNodeIdProp ?? localSelectedNodeId;

  useEffect(() => {
    if (!savedSource || (selectedNodeId && selectedNode(savedSource, selectedNodeId))) return;
    setLocalSelectedNodeId(
      savedSource.bindingResult.bindings[0]?.nodeId ?? savedSource.from.layers[0]?.nodeId
    );
  }, [savedSource, selectedNodeId]);

  useEffect(() => {
    if (savedSource?.diagnosticReport) setDiagnosticReport(savedSource.diagnosticReport);
  }, [savedSource?.diagnosticReport]);

  const stageWidth = savedSource ? Math.max(savedSource.from.width, savedSource.to.width) : undefined;
  const stageHeight = savedSource ? Math.max(savedSource.from.height, savedSource.to.height) : undefined;
  const fromCandidates = useMemo(
    () => (savedSource ? deriveZeroLayerNodeCandidates(savedSource.from) : []),
    [savedSource]
  );
  const toCandidates = useMemo(
    () => (savedSource ? deriveZeroLayerNodeCandidates(savedSource.to) : []),
    [savedSource]
  );
  const visibleFromCandidates = useMemo(
    () => filterCandidates(fromCandidates, candidateQuery),
    [candidateQuery, fromCandidates]
  );
  const visibleToCandidates = useMemo(
    () => filterCandidates(toCandidates, candidateQuery),
    [candidateQuery, toCandidates]
  );
  const visibleRecipes = useMemo(
    () =>
      recipeCategory === "all"
        ? zeroLayerMotionRecipes
        : zeroLayerMotionRecipes.filter((recipe) => recipe.category === recipeCategory),
    [recipeCategory]
  );
  const binding = selectedBinding(savedSource, selectedNodeId);
  const node = selectedNode(savedSource, selectedNodeId);
  const target = savedSource && selectedNodeId ? overrideTargets(savedSource, selectedNodeId)[0] : undefined;
  const override = overrideFor(savedSource, target);
  const activeDiagnosticGate = diagnosticReport ? diagnosticGate(diagnosticReport) : undefined;
  const activeRecipeSampleSummary = useMemo(() => recipeSampleSummary(savedSource), [savedSource]);
  const geometry = useMemo(() => {
    if (!node) return undefined;
    return {
      x: override?.x ?? node.bounds.x,
      y: override?.y ?? node.bounds.y,
      width: override?.width ?? node.bounds.w,
      height: override?.height ?? node.bounds.h,
      cornerRadius: override?.cornerRadius ?? node.cornerRadius ?? 0,
      opacity: override?.opacity ?? node.opacity
    };
  }, [node, override]);

  async function generateFromZeroLayers() {
    setIsLoading(true);
    setError(undefined);
    try {
      const [fromResult, toResult] = await Promise.all([
        fetchZeroLayerSnapshotResult(fromNodeId),
        fetchZeroLayerSnapshotResult(toNodeId)
      ]);
      const bindingResult = compileZeroLayerMotionBindings(fromResult.snapshot, toResult.snapshot);
      const source = fromResult.source === toResult.source ? fromResult.source : "custom-command";
      const bridge = fromResult.bridge ?? toResult.bridge;
      const report = createZeroLayerDiagnosticReport({
        from: fromResult.snapshot,
        to: toResult.snapshot,
        bindingResult,
        source,
        ...(bridge ? { bridge } : {})
      });
      const result = compileZeroLayerMotionComposition({
        from: fromResult.snapshot,
        to: toResult.snapshot,
        bindingResult,
        diagnosticReport: report
      });
      const nextReadInfo = layerReadInfo(fromResult, toResult);
      nextReadInfo.objects = {
        from:
          result.document.visualSource?.kind === "zero-layer-morph"
            ? (result.document.visualSource.objects?.from.length ?? 0)
            : 0,
        to:
          result.document.visualSource?.kind === "zero-layer-morph"
            ? (result.document.visualSource.objects?.to.length ?? 0)
            : 0
      };
      setReadInfo(nextReadInfo);
      setDiagnosticReport(report);
      setLocalSelectedNodeId(bindingResult.bindings[0]?.nodeId ?? fromResult.snapshot.layers[0]?.nodeId);
      if (result.document.visualSource?.kind === "zero-layer-morph") {
        result.document.visualSource = {
          ...result.document.visualSource,
          diagnosticReport: report
        };
      }
      onApplyComposition(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Zero 图层读取失败");
      setDiagnosticReport(undefined);
    } finally {
      setIsLoading(false);
    }
  }

  function updateSelectedOverride(patch: Partial<Omit<ZeroLayerNodeOverride, "frame" | "nodeId">>) {
    if (!savedSource) return;
    onUpdateSource(upsertOverrides(savedSource, selectedNodeId, patch));
  }

  function applyRecipe(recipeId: ZeroLayerMotionRecipeId) {
    if (!savedSource) return;
    const result = applyZeroLayerMotionRecipe(savedSource, recipeId);
    onApplyComposition(result);
  }

  function updateNumber(field: keyof Omit<ZeroLayerNodeOverride, "frame" | "nodeId">, value: string) {
    const parsed = numberValue(value);
    if (parsed == null) return;
    updateSelectedOverride({ [field]: parsed });
  }

  function selectNode(nodeId: string) {
    setLocalSelectedNodeId(nodeId);
    onSelectNode?.(nodeId);
  }

  function useCandidate(frame: CandidateFrame, candidate: ZeroLayerNodeCandidate) {
    if (frame === "from") {
      setFromNodeId(candidate.nodeId);
    } else {
      setToNodeId(candidate.nodeId);
    }
    selectNode(candidate.nodeId);
  }

  function renderCandidateList(
    frame: CandidateFrame,
    candidates: ZeroLayerNodeCandidate[],
    currentNodeId: string
  ) {
    return (
      <div className="zero-layer-candidate-column">
        <div className="zero-layer-candidate-column-header">
          <strong>{frameLabel(frame)}候选</strong>
          <span>{candidates.length}</span>
        </div>
        <div className="zero-layer-candidate-list">
          {candidates.slice(0, 24).map((candidate) => (
            <button
              type="button"
              className={`zero-layer-candidate-button${
                currentNodeId === candidate.nodeId ? " is-selected" : ""
              }`}
              onClick={() => useCandidate(frame, candidate)}
              aria-label={`设为${frameLabel(frame)} ${candidate.name}`}
              key={`${frame}:${candidate.nodeId}`}
            >
              <strong>{candidate.name}</strong>
              <span>{candidateSummary(candidate)}</span>
              <small>{candidatePath(candidate)}</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="zero-layer-panel">
      <div className="panel-section">
        <p className="eyebrow">Zero 原生图层</p>
        <div className="field-row">
          <label className="field">
            <span>首帧 nodeId</span>
            <input
              aria-label="Zero 图层首帧 nodeId"
              value={fromNodeId}
              onChange={(event) => setFromNodeId(event.target.value)}
            />
          </label>
          <label className="field">
            <span>尾帧 nodeId</span>
            <input
              aria-label="Zero 图层尾帧 nodeId"
              value={toNodeId}
              onChange={(event) => setToNodeId(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={generateFromZeroLayers}
          disabled={isLoading}
        >
          {isLoading ? "读取中…" : "从 Zero 原生图层生成动效"}
        </button>
        {error ? <p className="frame-morph-error">{error}</p> : null}
        {readInfo ? (
          <div className="zero-layer-source-panel">
            <p>
              来源：<strong>{readInfo.source}</strong>
            </p>
            <p>首帧：{snapshotSummary(readInfo.from)}</p>
            <p>尾帧：{snapshotSummary(readInfo.to)}</p>
            <p>
              对象辅助：首帧 {readInfo.objects.from} · 尾帧 {readInfo.objects.to}
            </p>
            {readInfo.bridge ? <p>桥接：{readInfo.bridge}</p> : null}
          </div>
        ) : null}
        {savedSource ? (
          <div className="zero-layer-candidate-panel" aria-label="Zero 首尾帧候选节点">
            <div className="zero-layer-candidate-header">
              <div>
                <strong>首尾帧候选节点</strong>
                <p>从已读取的 Zero 原生图层中选择，手动 nodeId 仍可直接输入。</p>
              </div>
              <label className="field zero-layer-candidate-search">
                <span>搜索</span>
                <input
                  aria-label="搜索 Zero 候选节点"
                  value={candidateQuery}
                  onChange={(event) => setCandidateQuery(event.target.value)}
                  placeholder="名称 / nodeId / 类型"
                />
              </label>
            </div>
            <div className="zero-layer-candidate-grid">
              {renderCandidateList("from", visibleFromCandidates, fromNodeId)}
              {renderCandidateList("to", visibleToCandidates, toNodeId)}
            </div>
          </div>
        ) : null}
        {diagnosticReport ? (
          <div className="zero-layer-diagnostic-panel" aria-label="Zero 图层 harness 诊断">
            <div className="zero-layer-diagnostic-header">
              <strong>Harness 诊断</strong>
              <span>
                error {diagnosticRiskCount(diagnosticReport, "error")} · warning{" "}
                {diagnosticRiskCount(diagnosticReport, "warning")} · info{" "}
                {diagnosticRiskCount(diagnosticReport, "info")}
              </span>
            </div>
            <p>{diagnosticSummary(diagnosticReport)}</p>
            <p>motion {diagnosticMotionSummary(diagnosticReport)}</p>
            {activeDiagnosticGate ? (
              <div className={`zero-layer-gate-panel is-${activeDiagnosticGate.status}`}>
                <p>
                  <strong>质量门禁</strong> · {diagnosticGateLabel(diagnosticReport)}
                </p>
                <p>{activeDiagnosticGate.summary}</p>
                {activeDiagnosticGate.reasons.length > 0 ? (
                  <p>reasons {activeDiagnosticGate.reasons.join(" · ")}</p>
                ) : null}
                <div className="zero-layer-gate-actions">
                  {activeDiagnosticGate.actions.slice(0, 4).map((action) => (
                    <p key={action.code}>
                      <strong>{action.code}</strong> · {action.message}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {savedSource?.optimizerReport ? (
              <div className="zero-layer-gate-actions">
                <p>
                  <strong>自动优化</strong> · {savedSource.optimizerReport.strategy} · applied{" "}
                  {savedSource.optimizerReport.applied.length}
                </p>
                {savedSource.optimizerReport.applied.slice(0, 4).map((action, index) => (
                  <p key={`${action.code}:${index}`}>
                    <strong>{action.code}</strong> · {action.nodeIds.join(" → ")}
                  </p>
                ))}
              </div>
            ) : null}
            {diagnosticReport.risks.length > 0 ? (
              <div className="zero-layer-risk-list">
                {diagnosticReport.risks.slice(0, 6).map((risk, index) => (
                  <p key={`${risk.code}:${risk.nodeId ?? index}`}>
                    <strong>{risk.code}</strong>
                    {risk.nodeId ? ` · ${risk.nodeId}` : ""} · {risk.message}
                  </p>
                ))}
              </div>
            ) : (
              <p>risks none</p>
            )}
            {diagnosticReport.recommendations.length > 0 ? (
              <div className="zero-layer-recommendation-list">
                {diagnosticReport.recommendations.slice(0, 4).map((item, index) => (
                  <p key={`${item.code}:${index}`}>
                    <strong>{item.code}</strong> · {item.message}
                  </p>
                ))}
              </div>
            ) : null}
            {activeRecipeSampleSummary ? (
              <div className="zero-layer-recipe-sample-panel" aria-label="Zero 动效方案采样门禁">
                <p>
                  <strong>方案采样</strong> · {activeRecipeSampleSummary.recipeCount} recipes ·{" "}
                  {activeRecipeSampleSummary.distinctSignatures} distinct · error{" "}
                  {activeRecipeSampleSummary.errorCount} · warning {activeRecipeSampleSummary.warningCount}
                </p>
                <p>采样点 0 / 25 / 50 / 75 / 100%，用于检查尾帧还原、过程越界和方案差异。</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {savedSource ? (
        <>
          <div className="panel-section">
            <p className="eyebrow">动效方案</p>
            <div className="zero-layer-recipe-filters" aria-label="Zero 原生动效方案分类">
              {recipeCategoryFilters.map((category) => (
                <button
                  type="button"
                  className={recipeCategory === category ? "is-active" : ""}
                  onClick={() => setRecipeCategory(category)}
                  key={category}
                >
                  {recipeCategoryLabels[category]}
                </button>
              ))}
            </div>
            <div className="zero-layer-recipe-list" aria-label="Zero 原生动效方案">
              {visibleRecipes.map((recipe) => (
                <button
                  type="button"
                  className="zero-layer-recipe-button"
                  aria-label={recipe.label}
                  onClick={() => applyRecipe(recipe.id)}
                  key={recipe.id}
                >
                  <strong>
                    {recipe.label}
                    <small>{recipeCategoryLabels[recipe.category]}</small>
                  </strong>
                  <span>{recipe.summary}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <p className="eyebrow">图层预览</p>
            <div className="zero-layer-preview-grid">
              <div>
                <span>首帧</span>
                <ZeroLayerStage
                  snapshot={savedSource.from}
                  frame="from"
                  stageWidth={stageWidth}
                  stageHeight={stageHeight}
                  selectedNodeId={selectedNodeId}
                  overrides={savedSource.nodeOverrides}
                  onNodeSelect={selectNode}
                />
              </div>
              <div>
                <span>尾帧</span>
                <ZeroLayerStage
                  snapshot={savedSource.to}
                  frame="to"
                  stageWidth={stageWidth}
                  stageHeight={stageHeight}
                  selectedNodeId={selectedNodeId}
                  overrides={savedSource.nodeOverrides}
                  onNodeSelect={selectNode}
                />
              </div>
            </div>
          </div>

          {node && geometry ? (
            <div className="panel-section zero-layer-edit-panel">
              <p className="eyebrow">当前图层</p>
              <p className="empty-state">
                {nodeLabel(node)}
                {binding ? ` → ${binding.toNodeId}` : ""}
              </p>
              <div className="field-row">
                <label className="field">
                  <span>X</span>
                  <input
                    aria-label="Zero 图层 X"
                    type="number"
                    value={geometry.x}
                    onChange={(event) => updateNumber("x", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Y</span>
                  <input
                    aria-label="Zero 图层 Y"
                    type="number"
                    value={geometry.y}
                    onChange={(event) => updateNumber("y", event.target.value)}
                  />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>宽</span>
                  <input
                    aria-label="Zero 图层宽度"
                    type="number"
                    value={geometry.width}
                    onChange={(event) => updateNumber("width", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>高</span>
                  <input
                    aria-label="Zero 图层高度"
                    type="number"
                    value={geometry.height}
                    onChange={(event) => updateNumber("height", event.target.value)}
                  />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>圆角</span>
                  <input
                    aria-label="Zero 图层圆角"
                    type="number"
                    value={geometry.cornerRadius}
                    onChange={(event) => updateNumber("cornerRadius", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>透明度</span>
                  <input
                    aria-label="Zero 图层透明度"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={geometry.opacity}
                    onChange={(event) => updateNumber("opacity", event.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
