import { useEffect, useMemo, useState } from "react";
import {
  compileZeroLayerMotionBindings,
  compileZeroLayerMotionComposition,
  createZeroLayerDiagnosticReport,
  createZeroLayerRecipeSampleReport,
  classifyZeroLayerRoles,
  createZeroMotionOrderPlan,
  buildZeroMotionSpec,
  createZeroMotionRepairAdvice,
  deriveZeroLayerDiagnosticGate,
  evaluateZeroMotionSalience,
  applyZeroLayerMotionRecipe,
  recommendZeroLayerRecipes,
  getZeroLayerRecipeManifest,
  type ZeroLayerDiagnosticReport,
  type ZeroLayerFramePair,
  type ZeroLayerMotionBinding,
  type ZeroLayerMotionCompositionResult,
  type ZeroLayerFramePairDiscovery,
  type ZeroLayerMorphSource,
  type ZeroLayerNode,
  type ZeroLayerNodeOverride,
  type ZeroLayerSnapshot,
  type ZeroMotionOrderPlan,
  zeroLayerExpressionStrategies,
  zeroLayerMotionRecipes,
  type ZeroLayerMotionRecipeCategory,
  type ZeroLayerMotionRecipeId
} from "@motion-copilot/core";
import {
  fetchZeroLayerSnapshotResult,
  type ZeroLayerSnapshotResult,
  type ZeroLayerSnapshotSource
} from "../../services/zeroLayerClient";
import { fetchZeroLayerFramePairDiscovery } from "../../services/zeroLayerFramePairClient";
import { ZeroLayerStage } from "./ZeroLayerStage";
import { MotionPlanEditor } from "./MotionPlanEditor";

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

type RecipeCategoryFilter = "all" | ZeroLayerMotionRecipeCategory;

type FramePairInput = {
  fromNodeId: string;
  toNodeId: string;
};

const defaultFromNodeId = "";
const defaultToNodeId = "";
const recipeCategoryLabels: Record<RecipeCategoryFilter, string> = {
  all: "全部",
  state: "状态",
  expand: "展开",
  content: "内容",
  navigation: "导航",
  overlay: "浮层",
  list: "列表",
  transition: "转场"
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

function recipeSampleSummary(source: ZeroLayerMorphSource | undefined):
  | {
      recipeCount: number;
      distinctSignatures: number;
      errorCount: number;
      warningCount: number;
    }
  | undefined {
  if (!source) return undefined;
  const report = createZeroLayerRecipeSampleReport(source);
  return {
    recipeCount: report.comparison.recipeCount,
    distinctSignatures: report.comparison.distinctSignatures,
    errorCount: report.risks.filter((risk) => risk.severity === "error").length,
    warningCount: report.risks.filter((risk) => risk.severity === "warning").length
  };
}

function roleSummary(source: ZeroLayerMorphSource | undefined): string | undefined {
  if (!source) return undefined;
  const roles = classifyZeroLayerRoles(source);
  const allRoles = [...roles.from, ...roles.to];
  const count = (role: string) => allRoles.filter((item) => item.role === role).length;
  return [
    `容器 ${count("root-container") + count("surface") + count("background")}`,
    `内容 ${count("content-text")}`,
    `进入 ${source.bindingResult.enter.length}`,
    `退出 ${source.bindingResult.exit.length}`,
    `未知 ${count("unknown")}`
  ].join(" · ");
}

function orderGroupLabel(group: keyof ZeroMotionOrderPlan["groups"]): string {
  if (group === "foundation") return "基础层";
  if (group === "structure") return "结构层";
  if (group === "exit-content") return "退出内容";
  if (group === "enter-content") return "进入内容";
  if (group === "emphasis") return "强调层";
  return "装饰层";
}

function recipeOrderStrategy(recipeId: ZeroLayerMotionRecipeId): string {
  if (recipeId === "container-first") return "容器先行 / 内容跟随";
  if (recipeId === "content-stagger") return "阅读顺序 / 内容错峰";
  if (recipeId === "axis-expand") return "主轴展开 / 结构优先";
  if (recipeId === "tab-indicator-slide") return "指示器先动 / 内容替换";
  if (recipeId === "card-expand-reveal") return "容器展开 / 裁切揭示";
  if (recipeId === "list-insert-push") return "列表推开 / 新项补位";
  if (recipeId === "bottom-sheet-rise") return "蒙层先行 / 面板上升";
  if (recipeId === "content-replace") return "旧内容退出 / 新内容补入";
  if (recipeId === "dropdown-reveal") return "触发区稳定 / 下拉揭示";
  if (recipeId === "mask-reveal") return "遮罩揭示 / 内容后入";
  return "确定性首尾帧编排";
}

function recipeExpressionSummary(strategyIds: readonly string[]): string {
  return strategyIds
    .map((strategyId) => zeroLayerExpressionStrategies.find((strategy) => strategy.id === strategyId)?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 2)
    .join(" / ");
}

function recipeRestraintLabel(intensity: "subtle" | "balanced" | "strong"): string {
  if (intensity === "strong") return "强表现";
  if (intensity === "balanced") return "均衡";
  return "稳妥";
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

function pagePairCount(discovery: ZeroLayerFramePairDiscovery, pageName: string): number {
  return discovery.pairs.filter((pair) => pair.fromPageName === pageName || pair.toPageName === pageName)
    .length;
}

function framePairKey(pair: FramePairInput): string {
  return `${pair.fromNodeId}->${pair.toNodeId}`;
}

type LocalTargetCandidate = {
  nodeId: string;
  label: string;
  summary: string;
  phase: "matched" | "enter" | "exit";
  searchText: string;
};

const targetPhaseLabels: Record<LocalTargetCandidate["phase"], string> = {
  matched: "形变",
  enter: "进入",
  exit: "离开"
};

function targetNodeLabel(node: ZeroLayerNode): string {
  return node.text?.trim() || node.name;
}

function targetSearchText(node: ZeroLayerNode, extra = ""): string {
  return `${node.name} ${node.text ?? ""} ${node.nodeId} ${node.kind} ${extra}`;
}

function localTargetCandidates(source: ZeroLayerMorphSource | undefined): LocalTargetCandidate[] {
  if (!source) return [];
  const fromById = new Map(source.from.layers.map((node) => [node.nodeId, node]));
  const toById = new Map(source.to.layers.map((node) => [node.nodeId, node]));
  const matched = source.bindingResult.bindings
    .filter((binding) => {
      const from = fromById.get(binding.nodeId);
      const to = toById.get(binding.toNodeId);
      return from && to && binding.nodeId !== source.from.nodeId;
    })
    .map((binding) => {
      const from = fromById.get(binding.nodeId)!;
      return {
        nodeId: binding.nodeId,
        label: targetNodeLabel(from),
        summary: `${from.kind} · ${binding.nodeId} → ${binding.toNodeId}`,
        phase: "matched" as const,
        searchText: targetSearchText(from, binding.toNodeId)
      };
    });
  const enter = source.bindingResult.enter.map((node) => ({
    nodeId: node.nodeId,
    label: targetNodeLabel(node),
    summary: `${node.kind} · 仅尾帧 · ${node.nodeId}`,
    phase: "enter" as const,
    searchText: targetSearchText(node)
  }));
  const exit = source.bindingResult.exit
    .filter((node) => node.nodeId !== source.from.nodeId)
    .map((node) => ({
      nodeId: node.nodeId,
      label: targetNodeLabel(node),
      summary: `${node.kind} · 仅首帧 · ${node.nodeId}`,
      phase: "exit" as const,
      searchText: targetSearchText(node)
    }));
  return [...matched, ...enter, ...exit];
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
  const [isDiscoveringPairs, setIsDiscoveringPairs] = useState(false);
  const [fileDiscovery, setFileDiscovery] = useState<ZeroLayerFramePairDiscovery | undefined>(undefined);
  const [selectedPairKey, setSelectedPairKey] = useState<string | undefined>(undefined);
  const [activeRecipeId, setActiveRecipeId] = useState<ZeroLayerMotionRecipeId | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const selectedNodeId = selectedNodeIdProp ?? localSelectedNodeId;
  const localTargets = useMemo(() => localTargetCandidates(savedSource), [savedSource]);
  const visibleLocalTargets = useMemo(() => {
    const keyword = candidateQuery.trim().toLowerCase();
    if (!keyword) return localTargets;
    return localTargets.filter((target) =>
      `${target.label} ${target.summary} ${target.phase} ${target.searchText}`.toLowerCase().includes(keyword)
    );
  }, [candidateQuery, localTargets]);

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
  const activeMotionSpec = useMemo(
    () => (savedSource ? buildZeroMotionSpec(savedSource) : undefined),
    [savedSource]
  );
  const activeRecipeRecommendation = useMemo(
    () => (activeMotionSpec ? recommendZeroLayerRecipes(activeMotionSpec) : undefined),
    [activeMotionSpec]
  );
  const activeEvaluatedRecipeId = activeRecipeId ?? activeRecipeRecommendation?.selectedRecipeId;
  const activeRecommendedRecipeResult = useMemo(() => {
    if (!savedSource || !activeEvaluatedRecipeId) return undefined;
    return applyZeroLayerMotionRecipe(savedSource, activeEvaluatedRecipeId, {
      ...(activeMotionSpec ? { spec: activeMotionSpec } : {})
    });
  }, [activeEvaluatedRecipeId, activeMotionSpec, savedSource]);
  const activeRoleSummary = useMemo(() => roleSummary(savedSource), [savedSource]);
  const activeOrderPlan = useMemo(() => {
    if (!savedSource || !activeRecommendedRecipeResult?.steps) return undefined;
    return createZeroMotionOrderPlan(savedSource, activeRecommendedRecipeResult.steps, activeMotionSpec);
  }, [activeMotionSpec, activeRecommendedRecipeResult?.steps, savedSource]);
  const activeRecommendedParameters = activeRecipeRecommendation?.candidates.find(
    (candidate) => candidate.recipeId === activeEvaluatedRecipeId
  )?.adaptedParameters;
  const activeMotionSalience = useMemo(
    () =>
      activeMotionSpec
        ? evaluateZeroMotionSalience({
            spec: activeMotionSpec,
            ...(activeRecommendedRecipeResult?.steps ? { steps: activeRecommendedRecipeResult.steps } : {}),
            ...(activeRecommendedParameters ? { adaptedParameters: activeRecommendedParameters } : {})
          })
        : undefined,
    [activeMotionSpec, activeRecommendedParameters, activeRecommendedRecipeResult?.steps]
  );
  const activeRepairAdvice = useMemo(
    () =>
      activeMotionSpec
        ? createZeroMotionRepairAdvice({
            spec: activeMotionSpec,
            ...(activeRecipeRecommendation ? { recommendation: activeRecipeRecommendation } : {}),
            ...(activeMotionSalience ? { salience: activeMotionSalience } : {}),
            ...(diagnosticReport ? { diagnosticReport } : {})
          })
        : undefined,
    [activeMotionSpec, activeRecipeRecommendation, activeMotionSalience, diagnosticReport]
  );
  const activeDiagnosticGate = diagnosticReport ? diagnosticGate(diagnosticReport) : undefined;
  const activeRecipeSampleSummary = useMemo(() => recipeSampleSummary(savedSource), [savedSource]);
  const activeRepairActions = activeRepairAdvice?.failures.length
    ? activeRepairAdvice.actions.filter((action) => action.type !== "change-recipe")
    : [];
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

  async function generateFromZeroLayers(input?: FramePairInput) {
    const nextFromNodeId = (input?.fromNodeId ?? fromNodeId).trim();
    const nextToNodeId = (input?.toNodeId ?? toNodeId).trim();
    if (!nextFromNodeId || !nextToNodeId) {
      setError("请先发现文件首尾帧，或在高级模式填写首帧和尾帧 nodeId。");
      return;
    }
    setIsLoading(true);
    setError(undefined);
    try {
      const [fromResult, toResult] = await Promise.all([
        fetchZeroLayerSnapshotResult(nextFromNodeId),
        fetchZeroLayerSnapshotResult(nextToNodeId)
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
      const recipeSource: ZeroLayerMorphSource = {
        kind: "zero-layer-morph",
        from: fromResult.snapshot,
        to: toResult.snapshot,
        bindingResult,
        diagnosticReport: report
      };
      const spec = buildZeroMotionSpec(recipeSource);
      const recommendation = recommendZeroLayerRecipes(spec);
      const appliedRecipeId = recommendation.selectedRecipeId;
      const result = appliedRecipeId
        ? applyZeroLayerMotionRecipe(recipeSource, appliedRecipeId, { spec })
        : compileZeroLayerMotionComposition({
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
      setActiveRecipeId(appliedRecipeId);
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

  async function discoverFileFramePairs() {
    setIsDiscoveringPairs(true);
    setError(undefined);
    try {
      const result = await fetchZeroLayerFramePairDiscovery();
      setFileDiscovery(result.discovery);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Zero 文件级首尾帧发现失败");
      setFileDiscovery(undefined);
    } finally {
      setIsDiscoveringPairs(false);
    }
  }

  function updateSelectedOverride(patch: Partial<Omit<ZeroLayerNodeOverride, "frame" | "nodeId">>) {
    if (!savedSource) return;
    onUpdateSource(upsertOverrides(savedSource, selectedNodeId, patch));
  }

  function applyRecipe(recipeId: ZeroLayerMotionRecipeId) {
    if (!savedSource) return;
    const result = applyZeroLayerMotionRecipe(savedSource, recipeId, {
      ...(activeMotionSpec ? { spec: activeMotionSpec } : {})
    });
    setActiveRecipeId(recipeId);
    onApplyComposition(result);
  }

  function applyFramePair(pair: ZeroLayerFramePair) {
    setFromNodeId(pair.fromNodeId);
    setToNodeId(pair.toNodeId);
    setSelectedPairKey(framePairKey(pair));
    selectNode(pair.fromNodeId);
    void generateFromZeroLayers({ fromNodeId: pair.fromNodeId, toNodeId: pair.toNodeId });
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

  return (
    <section className="zero-layer-panel">
      <div className="panel-section">
        <p className="eyebrow">Zero 原生图层</p>
        <div className="zero-layer-workflow">
          <button
            type="button"
            className="primary-action"
            onClick={discoverFileFramePairs}
            disabled={isDiscoveringPairs}
          >
            {isDiscoveringPairs ? "发现中…" : "发现文件首尾帧"}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => void generateFromZeroLayers()}
            disabled={isLoading}
          >
            {isLoading ? "读取中…" : "生成首尾帧动效"}
          </button>
        </div>
        {error ? <p className="frame-morph-error">{error}</p> : null}
        {fileDiscovery ? (
          <div className="zero-layer-file-pair-panel" aria-label="Zero 文件级首尾帧发现">
            <div className="zero-layer-file-pair-header">
              <strong>文件级首尾帧</strong>
              <span>
                {fileDiscovery.pairs.length} 组 · {fileDiscovery.candidates.length} 个候选 ·{" "}
                {fileDiscovery.pages.length} 页
              </span>
            </div>
            {fileDiscovery.pairs.length > 0 ? (
              <div className="zero-layer-frame-pair-list">
                {fileDiscovery.pairs.slice(0, 8).map((pair) => (
                  <button
                    type="button"
                    className={selectedPairKey === framePairKey(pair) ? "is-selected" : undefined}
                    onClick={() => applyFramePair(pair)}
                    aria-label={`使用文件级首尾帧 ${pair.label}`}
                    key={`file:${pair.fromNodeId}:${pair.toNodeId}`}
                  >
                    <strong>{pair.label}</strong>
                    <span>
                      {pair.fromPageName ?? "未知页面"} / {pair.fromNodeId} → {pair.toPageName ?? "未知页面"}{" "}
                      / {pair.toNodeId}
                    </span>
                    <small>文件级命名匹配 · confidence {pair.confidence}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="zero-layer-frame-pair-empty">
                当前文件没有发现以 -首帧 / -尾帧 结尾的 frame、group、component 或 instance。
              </p>
            )}
            <div className="zero-layer-page-status" aria-label="Zero 文件页面扫描状态">
              {fileDiscovery.pages.map((page) => (
                <span key={page.nodeId}>
                  {page.name}: {pagePairCount(fileDiscovery, page.name)} 组
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <details className="zero-layer-advanced-panel">
          <summary>手动输入 / 高级模式</summary>
          <div className="field-row">
            <label className="field">
              <span>首帧 nodeId</span>
              <input
                aria-label="Zero 图层首帧 nodeId"
                value={fromNodeId}
                onChange={(event) => setFromNodeId(event.target.value)}
                placeholder="例如 28:19"
              />
            </label>
            <label className="field">
              <span>尾帧 nodeId</span>
              <input
                aria-label="Zero 图层尾帧 nodeId"
                value={toNodeId}
                onChange={(event) => setToNodeId(event.target.value)}
                placeholder="例如 28:2"
              />
            </label>
          </div>
        </details>
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
          <details className="zero-layer-candidate-panel" aria-label="Zero 目标图层选择">
            <summary>目标图层选择</summary>
            <div className="zero-layer-candidate-header">
              <div>
                <strong>局部动效目标图层</strong>
                <p>仅在需要对子图层做局部动效时使用，默认按首尾帧整体生成。</p>
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
            <div className="zero-layer-target-list" aria-label="Zero 局部动效目标图层">
              {visibleLocalTargets.length > 0 ? (
                visibleLocalTargets.slice(0, 36).map((target) => (
                  <button
                    type="button"
                    className={`zero-layer-target-button${
                      selectedNodeId === target.nodeId ? " is-selected" : ""
                    }`}
                    onClick={() => selectNode(target.nodeId)}
                    aria-label={`选择局部动效目标 ${target.label}`}
                    key={`${target.phase}:${target.nodeId}`}
                  >
                    <strong>
                      {target.label}
                      <em>{targetPhaseLabels[target.phase]}</em>
                    </strong>
                    <span>{target.summary}</span>
                  </button>
                ))
              ) : (
                <p className="zero-layer-frame-pair-empty">当前首尾帧没有可单独选择的局部动效目标。</p>
              )}
            </div>
          </details>
        ) : null}
        {savedSource ? (
          <MotionPlanEditor source={savedSource} selectedNodeId={selectedNodeId} onChange={onUpdateSource} />
        ) : null}
        {diagnosticReport ? (
          <details className="zero-layer-diagnostic-panel" aria-label="Zero 图层 harness 诊断">
            <summary className="zero-layer-diagnostic-header">
              <strong>Harness 诊断</strong>
              <span>
                error {diagnosticRiskCount(diagnosticReport, "error")} · warning{" "}
                {diagnosticRiskCount(diagnosticReport, "warning")} · info{" "}
                {diagnosticRiskCount(diagnosticReport, "info")}
              </span>
            </summary>
            <p>
              质量门禁和调试信息，主要用于判断图层匹配、尾帧还原和动效采样是否可靠；普通使用不需要逐条确认。
            </p>
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
          </details>
        ) : null}
      </div>

      {savedSource ? (
        <>
          {activeMotionSpec && activeRecipeRecommendation ? (
            <div className="panel-section zero-layer-smart-panel" aria-label="Zero 智能推荐">
              <div className="zero-layer-smart-header">
                <div>
                  <p className="eyebrow">智能推荐</p>
                  <strong>
                    {activeMotionSpec.scene.type} · 置信度{" "}
                    {Math.round(activeMotionSpec.scene.confidence * 100)}% ·{" "}
                    {activeRecipeRecommendation.interactionPattern.label}
                  </strong>
                </div>
                {activeRecipeRecommendation.selectedRecipeId ? (
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => applyRecipe(activeRecipeRecommendation.selectedRecipeId!)}
                  >
                    应用推荐方案
                  </button>
                ) : null}
              </div>
              <div className="zero-layer-smart-reasons">
                {activeRecipeRecommendation.interactionPattern.reasons.slice(0, 2).map((reason) => (
                  <p key={`pattern-${reason}`}>{reason}</p>
                ))}
                {activeMotionSpec.scene.reasons.slice(0, 3).map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
              {activeRoleSummary || activeOrderPlan ? (
                <div className="zero-layer-order-summary" aria-label="Zero 图层角色与动效顺序">
                  {activeRoleSummary ? (
                    <p>
                      <strong>角色识别</strong>
                      <span>{activeRoleSummary}</span>
                    </p>
                  ) : null}
                  {activeOrderPlan ? (
                    <div>
                      <strong>动效顺序</strong>
                      {Object.entries(activeOrderPlan.groups)
                        .filter(([, items]) => items.length > 0)
                        .slice(0, 5)
                        .map(([group, items]) => (
                          <span key={group}>
                            {orderGroupLabel(group as keyof ZeroMotionOrderPlan["groups"])}：
                            {items
                              .slice(0, 3)
                              .map((item) => item.name)
                              .join(" / ")}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="zero-layer-recommendation-cards">
                {activeRecipeRecommendation.candidates.map((candidate, index) => {
                  const recipe = zeroLayerMotionRecipes.find((item) => item.id === candidate.recipeId);
                  const manifest = getZeroLayerRecipeManifest(candidate.recipeId);
                  const isRecommended = candidate.recipeId === activeRecipeRecommendation.selectedRecipeId;
                  const isActiveRecipe = activeEvaluatedRecipeId === candidate.recipeId;
                  const expressionSummary = manifest
                    ? recipeExpressionSummary(manifest.expressionStrategies)
                    : "";
                  return (
                    <button
                      type="button"
                      className={`zero-layer-recommendation-card${
                        isRecommended ? " is-recommended" : ""
                      }${isActiveRecipe ? " is-selected" : ""}`}
                      onClick={() => applyRecipe(candidate.recipeId)}
                      aria-label={`应用推荐动效 ${recipe?.label ?? candidate.recipeId}`}
                      aria-pressed={isActiveRecipe}
                      key={candidate.recipeId}
                    >
                      <strong>
                        {recipe?.label ?? candidate.recipeId}
                        <span className="zero-layer-recipe-badges">
                          {manifest ? (
                            <small>{recipeRestraintLabel(manifest.restraint.intensity)}</small>
                          ) : null}
                          <small>
                            {isActiveRecipe
                              ? "已选择"
                              : isRecommended || index === 0
                                ? "推荐"
                                : `score ${candidate.score}`}
                          </small>
                        </span>
                      </strong>
                      <span className="zero-layer-manifest-line">
                        <b>适合</b>
                        {manifest?.bestFor.slice(0, 2).join("；") ?? candidate.reasons.slice(0, 2).join("；")}
                      </span>
                      {manifest ? (
                        <span className="zero-layer-manifest-line">
                          <b>真机看点</b>
                          {manifest.mobileGuidance.expectedFeel}
                        </span>
                      ) : null}
                      <span className="zero-layer-pattern-badge">
                        {recipeOrderStrategy(candidate.recipeId)}
                      </span>
                      {expressionSummary ? (
                        <span className="zero-layer-expression-label">策略：{expressionSummary}</span>
                      ) : null}
                      <span className="zero-layer-adapted-params">{candidate.adaptedParameters.summary}</span>
                      {manifest?.avoidWhen[0] ? (
                        <em>
                          <b>不建议</b>
                          {manifest.avoidWhen[0]}
                        </em>
                      ) : candidate.warnings[0] ? (
                        <em>{candidate.warnings[0]}</em>
                      ) : null}
                      {!manifest?.avoidWhen[0] && !candidate.warnings[0] && candidate.score < 55 ? (
                        <em>该方案偏保守，动效差异可能较弱。</em>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {activeMotionSalience ? (
                <details className="zero-layer-quality-details">
                  <summary>
                    <strong>动效质量提示</strong>
                    <span>
                      显著度 {activeMotionSalience.score} ·{" "}
                      {activeRepairActions.length > 0 ? `${activeRepairActions.length} 条建议` : "无需处理"}
                    </span>
                  </summary>
                  <div className={`zero-layer-salience is-${activeMotionSalience.diagnosis}`}>
                    <p>
                      <strong>动效显著度</strong>用于判断当前方案是否有足够可感知变化，不会直接改变画布。
                    </p>
                    <p>
                      {activeMotionSalience.diagnosis} · score {activeMotionSalience.score}
                    </p>
                    {activeMotionSalience.evidence.slice(0, 2).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                  {activeRepairAdvice && activeRepairActions.length > 0 ? (
                    <div className="zero-layer-repair-advice">
                      <p>
                        <strong>修复建议</strong>
                        只在低置信匹配、体感过弱或空间风险时出现，用于辅助选择更稳妥的方案。
                      </p>
                      <p>{activeRepairAdvice.userFacingMessage}</p>
                      <div>
                        {activeRepairActions.slice(0, 3).map((action) => (
                          <button
                            type="button"
                            onClick={() => (action.recipeId ? applyRecipe(action.recipeId) : undefined)}
                            disabled={!action.recipeId}
                            key={action.id}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </details>
              ) : null}
            </div>
          ) : null}

          <div className="panel-section">
            <p className="eyebrow">更多动效方案</p>
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
                  className={`zero-layer-recipe-button${activeRecipeId === recipe.id ? " is-selected" : ""}`}
                  aria-label={recipe.label}
                  aria-pressed={activeRecipeId === recipe.id}
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
