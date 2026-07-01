import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildFrameObjectModel,
  compileMorphPlan,
  compileFrameMorphComposition,
  compileVisualMotionComposition,
  compileVisualMotionBindings,
  compileVisualMotionIntent,
  createClassicEasing,
  createRestorationReport,
  createSpringEasing,
  createVisualTimelineCss,
  createZeroVisualNodeOverrideCss,
  evaluateMorphPlan,
  exportMorphHtml,
  exportMorphJson,
  exportVisualCompositionHtml,
  inlineZeroVisualAssets,
  matchFrameElements,
  normalizeFrameSnapshot,
  type EasingSpec,
  type FrameElement,
  type FrameElementMatch,
  type FrameElementMatchResult,
  type FrameObject,
  type FrameObjectModel,
  type FrameSnapshot,
  type FrameMorphCompositionResult,
  type MorphPlan,
  type MorphState,
  type RestorationReport,
  type UserBindingOverride,
  type VisualCompositionSource,
  type VisualMotionCompositionResult,
  type VisualMotionBindingResult,
  type ZeroVisualNodeOverride,
  type ZeroVisualSnapshot
} from "@motion-copilot/core";
import { fetchZeroFrameSnapshot } from "../../services/zeroFrameClient";
import {
  fetchZeroVisualSnapshotResult,
  type ZeroVisualSnapshotResult,
  type ZeroVisualSnapshotSource
} from "../../services/zeroVisualClient";
import { VisualStage } from "../visualStage/VisualStage";

type PreviewMode = "from" | "to" | "overlay" | "morph";
type VisualPreviewMode = "from" | "to" | "overlay" | "motion";
type PairSelection = { fromKey?: string; toKey?: string };
type FrameMorphPanelProps = {
  onApplyComposition: (result: FrameMorphCompositionResult) => void;
  onApplyVisualComposition: (result: VisualMotionCompositionResult) => void;
  savedVisualSource?: VisualCompositionSource;
  onConvertToLayer?: (layer: {
    name: string;
    kind: "text" | "shape";
    bounds: { x: number; y: number; w: number; h: number };
    text?: string;
    style?: Record<string, unknown>;
  }) => void;
  mode?: "all" | "visual" | "legacy";
};

type VisualReadInfo = {
  source: ZeroVisualSnapshotSource;
  bridge?: string;
  from: Pick<ZeroVisualSnapshot, "nodeId" | "name" | "width" | "height" | "nodes" | "assets" | "screenshotUrl">;
  to: Pick<ZeroVisualSnapshot, "nodeId" | "name" | "width" | "height" | "nodes" | "assets" | "screenshotUrl">;
};

const easingOptions: Array<{ value: "decelerate" | "standard" | "spring"; label: string }> = [
  { value: "decelerate", label: "减速" },
  { value: "standard", label: "标准" },
  { value: "spring", label: "弹性" }
];

function easingFromValue(value: "decelerate" | "standard" | "spring"): EasingSpec {
  if (value === "spring") return createSpringEasing();
  return createClassicEasing(value);
}

function parseSnapshotJson(value: string): FrameSnapshot {
  return normalizeFrameSnapshot(JSON.parse(value));
}

function readFile(file: File | undefined, onLoad: (value: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result === "string") onLoad(reader.result);
  });
  reader.readAsText(file);
}

function elementSummary(element: FrameElement | undefined): string {
  if (!element) return "未选择";
  return `${element.text ?? element.name} · ${element.nodeId} · ${Math.round(element.x)},${Math.round(element.y)} ${Math.round(element.w)}x${Math.round(element.h)}`;
}

function elementDetail(element: FrameElement | undefined): string {
  if (!element) return "missing";
  return `${element.key} · ${element.nodeId} · ${element.name}${element.text ? ` · ${element.text}` : ""} · ${Math.round(element.x)},${Math.round(element.y)} ${Math.round(element.w)}x${Math.round(element.h)}`;
}

function visualReadInfo(from: ZeroVisualSnapshotResult, to: ZeroVisualSnapshotResult): VisualReadInfo {
  const bridge = from.bridge ?? to.bridge;
  return {
    source: from.source === to.source ? from.source : "custom-command",
    ...(bridge ? { bridge } : {}),
    from: from.snapshot,
    to: to.snapshot
  };
}

function visualFrameSummary(frame: VisualReadInfo["from"]): string {
  return `${frame.name} · ${frame.nodeId} · ${frame.width}x${frame.height} · ${frame.nodes.length} nodes · ${frame.assets.length} assets`;
}

function visualScreenshotStatus(screenshotUrl: string | undefined): string {
  if (!screenshotUrl) return "未提供";
  const kb = Math.round(screenshotUrl.length / 1024);
  return `已就绪 · ${kb} KB`;
}

function stateStyle(state: MorphState): React.CSSProperties {
  const style: React.CSSProperties = {
    left: state.x,
    top: state.y,
    width: state.w,
    height: state.h,
    opacity: state.opacity,
    borderRadius: state.radius,
    background: state.background ?? "transparent",
    color: state.color ?? "#1f2328"
  };
  if (state.borderColor) {
    style.borderColor = state.borderColor;
    style.borderStyle = "solid";
    style.borderWidth = state.borderWidth ?? 1;
  } else if (typeof state.borderWidth === "number") {
    style.borderWidth = state.borderWidth;
  }
  if (state.boxShadow) style.boxShadow = state.boxShadow;
  if (typeof state.fontSize === "number") style.fontSize = state.fontSize;
  if (typeof state.fontWeight === "number") style.fontWeight = state.fontWeight;
  if (state.fontFamily) style.fontFamily = state.fontFamily;
  if (typeof state.lineHeight === "number") style.lineHeight = state.lineHeight;
  if (state.textDecoration) style.textDecoration = state.textDecoration;
  return style;
}

function interpolate(from: MorphState, to: MorphState, progress: number): MorphState {
  const p = Math.min(1, Math.max(0, progress));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  const state: MorphState = {
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    w: lerp(from.w, to.w),
    h: lerp(from.h, to.h),
    opacity: lerp(from.opacity, to.opacity)
  };
  if (typeof from.radius === "number" || typeof to.radius === "number")
    state.radius = lerp(from.radius ?? 0, to.radius ?? 0);
  const background = p < 0.5 ? from.background : to.background;
  if (background) state.background = background;
  const color = p < 0.5 ? from.color : to.color;
  if (color) state.color = color;
  const text = p < 0.5 ? from.text : to.text;
  if (text) state.text = text;
  const assetUrl = p < 0.5 ? from.assetUrl : to.assetUrl;
  if (assetUrl) state.assetUrl = assetUrl;
  const borderColor = p < 0.5 ? from.borderColor : to.borderColor;
  if (borderColor) state.borderColor = borderColor;
  if (typeof from.borderWidth === "number" || typeof to.borderWidth === "number")
    state.borderWidth = lerp(from.borderWidth ?? 0, to.borderWidth ?? 0);
  const boxShadow = p < 0.5 ? from.boxShadow : to.boxShadow;
  if (boxShadow) state.boxShadow = boxShadow;
  if (typeof from.fontSize === "number" || typeof to.fontSize === "number")
    state.fontSize = lerp(from.fontSize ?? to.fontSize ?? 0, to.fontSize ?? from.fontSize ?? 0);
  if (typeof from.fontWeight === "number" || typeof to.fontWeight === "number")
    state.fontWeight = lerp(from.fontWeight ?? to.fontWeight ?? 400, to.fontWeight ?? from.fontWeight ?? 400);
  const fontFamily = p < 0.5 ? from.fontFamily : to.fontFamily;
  if (fontFamily) state.fontFamily = fontFamily;
  if (typeof from.lineHeight === "number" || typeof to.lineHeight === "number")
    state.lineHeight = lerp(from.lineHeight ?? to.lineHeight ?? 1, to.lineHeight ?? from.lineHeight ?? 1);
  const textDecoration = p < 0.5 ? from.textDecoration : to.textDecoration;
  if (textDecoration) state.textDecoration = textDecoration;
  return state;
}

function renderStateLayer(
  state: MorphState,
  key: string,
  className: string,
  onClick?: () => void
): React.ReactNode {
  return (
    <button type="button" className={className} style={stateStyle(state)} onClick={onClick} key={key}>
      {state.assetUrl ? <img src={state.assetUrl} alt="" /> : <span>{state.text}</span>}
    </button>
  );
}

function renderFrameLayer(
  element: FrameElement,
  selected: boolean,
  className: string,
  onClick: () => void
): React.ReactNode {
  return (
    <button
      type="button"
      className={`${className}${selected ? " is-selected" : ""}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        opacity: element.opacity,
        borderRadius: element.style?.radius,
        background: element.style?.background ?? "transparent",
        color: element.style?.color ?? "#1f2328",
        zIndex: element.zIndex
      }}
      onClick={onClick}
      key={element.key}
    >
      {element.assetUrl ? <img src={element.assetUrl} alt="" /> : <span>{element.text}</span>}
    </button>
  );
}

function applyManualPair(
  result: FrameElementMatchResult,
  pair: Required<PairSelection>
): FrameElementMatchResult {
  const matches = result.matches.filter(
    (match) => match.fromKey !== pair.fromKey && match.toKey !== pair.toKey
  );
  const manual: FrameElementMatch = {
    fromKey: pair.fromKey,
    toKey: pair.toKey,
    confidence: 100,
    reasons: ["manual"]
  };
  return {
    matches: [manual, ...matches],
    enter: result.enter.filter((key) => key !== pair.toKey),
    exit: result.exit.filter((key) => key !== pair.fromKey),
    unresolved: result.unresolved.filter((item) => item.fromKey !== pair.fromKey && item.toKey !== pair.toKey)
  };
}

function applyExclude(result: FrameElementMatchResult, key: string): FrameElementMatchResult {
  return {
    matches: result.matches.filter((match) => match.fromKey !== key && match.toKey !== key),
    enter: result.enter.filter((item) => item !== key),
    exit: result.exit.filter((item) => item !== key),
    unresolved: result.unresolved.filter((item) => item.fromKey !== key && item.toKey !== key)
  };
}

function withoutKey(result: FrameElementMatchResult, key: string): FrameElementMatchResult {
  return {
    matches: result.matches.filter((match) => match.fromKey !== key && match.toKey !== key),
    enter: result.enter.filter((item) => item !== key),
    exit: result.exit.filter((item) => item !== key),
    unresolved: result.unresolved.filter((item) => item.fromKey !== key && item.toKey !== key)
  };
}

function forceEnter(result: FrameElementMatchResult, key: string): FrameElementMatchResult {
  const previousMatch = result.matches.find((match) => match.toKey === key);
  const next = withoutKey(result, key);
  const enter = next.enter.includes(key) ? next.enter : [key, ...next.enter];
  const exit =
    previousMatch && !next.exit.includes(previousMatch.fromKey)
      ? [previousMatch.fromKey, ...next.exit]
      : next.exit;
  return { ...next, enter, exit };
}

function forceExit(result: FrameElementMatchResult, key: string): FrameElementMatchResult {
  const previousMatch = result.matches.find((match) => match.fromKey === key);
  const next = withoutKey(result, key);
  const exit = next.exit.includes(key) ? next.exit : [key, ...next.exit];
  const enter =
    previousMatch && !next.enter.includes(previousMatch.toKey)
      ? [previousMatch.toKey, ...next.enter]
      : next.enter;
  return { ...next, enter, exit };
}

function groupCounts(result: FrameElementMatchResult | undefined): string {
  if (!result) return "未生成";
  return `matched ${result.matches.length} / enter ${result.enter.length} / exit ${result.exit.length} / unresolved ${result.unresolved.length}`;
}

const OBJECT_KIND_LABELS: Record<string, string> = {
  text: "文本",
  container: "容器",
  asset: "素材",
  button: "按钮",
  "status-pill": "状态标签",
  "label-group": "标签组",
  unknown: "未知"
};

function objectBindingStatus(
  obj: FrameObject,
  bindingResult: VisualMotionBindingResult | undefined
): "matched" | "enter" | "exit" | "unresolved" | "none" {
  if (!bindingResult) return "none";
  const primaryNode = obj.nodeIds[0];
  if (!primaryNode) return "none";
  if (bindingResult.bindings.some((b) => b.nodeId === primaryNode)) return "matched";
  if (bindingResult.enter.some((n) => n.nodeId === primaryNode)) return "enter";
  if (bindingResult.exit.some((n) => n.nodeId === primaryNode)) return "exit";
  if (bindingResult.unresolved.some((u) => u.fromNodeId === primaryNode || u.toNodeId === primaryNode))
    return "unresolved";
  return "none";
}

function ObjectRow({
  object,
  depth,
  selectedNodeId,
  onSelect,
  bindingResult,
  onConvert
}: {
  object: FrameObject;
  depth: number;
  selectedNodeId: string | undefined;
  onSelect: (nodeId: string | undefined) => void;
  bindingResult: VisualMotionBindingResult | undefined;
  onConvert?: (obj: FrameObject) => void;
}) {
  const primaryNode = object.nodeIds[0];
  const isSelected = primaryNode ? primaryNode === selectedNodeId : false;
  const status = objectBindingStatus(object, bindingResult);
  const kindLabel = OBJECT_KIND_LABELS[object.kind] ?? object.kind;
  const canConvert = object.kind === "text" || (object.kind === "container" && object.children.length === 0);

  return (
    <>
      <div className={`object-row${isSelected ? " is-selected" : ""}`} style={{ paddingLeft: 6 + depth * 12 }}>
        <button type="button" className="object-row-main" onClick={() => onSelect(primaryNode)}>
          <span className={`object-kind-badge is-${object.kind}`}>{kindLabel}</span>
          <span className="object-name">{object.name}</span>
          {status !== "none" ? <span className={`object-status is-${status}`}>{status}</span> : null}
        </button>
        {canConvert && onConvert ? (
          <button type="button" className="object-convert-btn" title="转为可编辑图层" onClick={() => onConvert(object)}>
            编
          </button>
        ) : null}
      </div>
      {object.children.map((child) => (
        <ObjectRow
          key={child.id}
          object={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          bindingResult={bindingResult}
          {...(onConvert ? { onConvert } : {})}
        />
      ))}
    </>
  );
}

function applyOverridesToBinding(
  base: VisualMotionBindingResult,
  overrides: UserBindingOverride[],
  fromSnap?: ZeroVisualSnapshot,
  toSnap?: ZeroVisualSnapshot
): VisualMotionBindingResult {
  let bindings = [...base.bindings];
  let enter = [...base.enter];
  let exit = [...base.exit];
  let unresolved = [...base.unresolved];

  for (const override of overrides) {
    const { fromNodeId, toNodeId, action } = override;
    bindings = bindings.filter((b) => b.nodeId !== fromNodeId);
    enter = enter.filter((n) => n.nodeId !== fromNodeId && n.nodeId !== toNodeId);
    exit = exit.filter((n) => n.nodeId !== fromNodeId);
    unresolved = unresolved.filter((u) => u.fromNodeId !== fromNodeId && u.toNodeId !== fromNodeId);

    if (action === "matched" && toNodeId) {
      const fromNode = fromSnap?.nodes.find((n) => n.nodeId === fromNodeId);
      const toNode = toSnap?.nodes.find((n) => n.nodeId === toNodeId);
      const fromBounds = fromNode?.bounds ?? base.bindings.find((b) => b.nodeId === fromNodeId)?.fromBounds ?? { x: 0, y: 0, w: 0, h: 0 };
      const toBounds = toNode?.bounds ?? base.bindings.find((b) => b.toNodeId === toNodeId)?.toBounds ?? { x: 0, y: 0, w: 0, h: 0 };
      bindings.push({
        layerId: `manual-${fromNodeId}`,
        nodeId: fromNodeId,
        toNodeId,
        source: "html-node",
        fromBounds,
        toBounds,
        confidence: 100,
        reasons: ["manual-override"]
      });
      enter = enter.filter((n) => n.nodeId !== toNodeId);
      unresolved = unresolved.filter((u) => u.toNodeId !== toNodeId);
    } else if (action === "enter") {
      const matchedToNodeId = base.bindings.find((b) => b.nodeId === fromNodeId)?.toNodeId;
      const node = toSnap?.nodes.find((n) => n.nodeId === (matchedToNodeId ?? fromNodeId));
      if (node) {
        enter.push(node);
      }
    } else if (action === "exit") {
      const node = fromSnap?.nodes.find((n) => n.nodeId === fromNodeId) ?? toSnap?.nodes.find((n) => n.nodeId === fromNodeId);
      if (node) {
        exit.push(node);
      }
    }
  }

  return { bindings, enter, exit, unresolved };
}

function nodeForOverride(
  nodeId: string,
  fromSnap: ZeroVisualSnapshot | undefined,
  toSnap: ZeroVisualSnapshot | undefined
) {
  return fromSnap?.nodes.find((node) => node.nodeId === nodeId) ?? toSnap?.nodes.find((node) => node.nodeId === nodeId);
}

function overrideForNode(
  nodeId: string,
  overrides: ZeroVisualNodeOverride[],
  fromSnap: ZeroVisualSnapshot | undefined,
  toSnap: ZeroVisualSnapshot | undefined
): ZeroVisualNodeOverride | undefined {
  const node = nodeForOverride(nodeId, fromSnap, toSnap);
  if (!node) return undefined;
  const existing = overrides.find((override) => override.nodeId === nodeId);
  const result: ZeroVisualNodeOverride = {
    nodeId,
    x: existing?.x ?? node.bounds.x,
    y: existing?.y ?? node.bounds.y,
    width: existing?.width ?? node.bounds.w,
    height: existing?.height ?? node.bounds.h,
    opacity: existing?.opacity ?? 1
  };
  if (existing?.radius !== undefined) result.radius = existing.radius;
  return result;
}

function upsertNodeOverride(
  overrides: ZeroVisualNodeOverride[],
  next: ZeroVisualNodeOverride
): ZeroVisualNodeOverride[] {
  const rest = overrides.filter((override) => override.nodeId !== next.nodeId);
  return [...rest, next];
}

function overrideNumberValue(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function FrameMorphPanel({
  onApplyComposition,
  onApplyVisualComposition,
  savedVisualSource,
  onConvertToLayer,
  mode = "all"
}: FrameMorphPanelProps) {
  const [fromNodeId, setFromNodeId] = useState("28:19");
  const [toNodeId, setToNodeId] = useState("28:2");
  const [motionPrompt, setMotionPrompt] = useState(
    "胶囊宽度丝滑展开，状态文字错峰淡入，按钮跟随移动，整体有轻微弹性"
  );
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromFrame, setFromFrame] = useState<FrameSnapshot | undefined>(undefined);
  const [toFrame, setToFrame] = useState<FrameSnapshot | undefined>(undefined);
  const [matchResult, setMatchResult] = useState<FrameElementMatchResult | undefined>(undefined);
  const [plan, setPlan] = useState<MorphPlan | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("from");
  const [progress, setProgress] = useState(0);
  const [durationMs, setDurationMs] = useState(320);
  const [easing, setEasing] = useState<"decelerate" | "standard" | "spring">("spring");
  const [selection, setSelection] = useState<PairSelection>({});
  const [query, setQuery] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReadingZero, setIsReadingZero] = useState(false);
  const [fromVisualFrame, setFromVisualFrame] = useState<ZeroVisualSnapshot | undefined>(undefined);
  const [toVisualFrame, setToVisualFrame] = useState<ZeroVisualSnapshot | undefined>(undefined);
  const [visualPreviewMode, setVisualPreviewMode] = useState<VisualPreviewMode>("from");
  const [visualNodeId, setVisualNodeId] = useState<string | undefined>(undefined);
  const [visualBindingResult, setVisualBindingResult] = useState<VisualMotionBindingResult | undefined>(
    undefined
  );
  const [visualProgress, setVisualProgress] = useState(0);
  const [isVisualPlaying, setIsVisualPlaying] = useState(false);
  const [isReadingVisualZero, setIsReadingVisualZero] = useState(false);
  const [visualError, setVisualError] = useState<string | undefined>(undefined);
  const [visualReadMeta, setVisualReadMeta] = useState<VisualReadInfo | undefined>(undefined);
  const [restorationReport, setRestorationReport] = useState<RestorationReport | undefined>(undefined);
  const [reportStale, setReportStale] = useState(false);
  const [userOverrides, setUserOverrides] = useState<UserBindingOverride[]>([]);
  const [nodeOverrides, setNodeOverrides] = useState<ZeroVisualNodeOverride[]>([]);
  const [manualMatchFrom, setManualMatchFrom] = useState<string | undefined>(undefined);
  const playTimerRef = useRef<number | undefined>(undefined);
  const visualPlayTimerRef = useRef<number | undefined>(undefined);

  const fromObjectModel = useMemo<FrameObjectModel | undefined>(
    () => (fromVisualFrame ? buildFrameObjectModel(fromVisualFrame) : undefined),
    [fromVisualFrame]
  );

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current || !savedVisualSource || savedVisualSource.kind !== "zero-visual-morph") return;
    hasRestoredRef.current = true;
    const fromSnap = savedVisualSource.from as ZeroVisualSnapshot;
    const toSnap = savedVisualSource.to as ZeroVisualSnapshot;
    setFromVisualFrame(fromSnap);
    setToVisualFrame(toSnap);
    setVisualPreviewMode("from");
    const freshBindings = compileVisualMotionBindings(fromSnap, toSnap);
    const overrides = savedVisualSource.userBindingOverrides ?? [];
    const merged = overrides.length > 0 ? applyOverridesToBinding(freshBindings, overrides, fromSnap, toSnap) : freshBindings;
    setVisualBindingResult(merged);
    setUserOverrides(overrides);
    setNodeOverrides(savedVisualSource.nodeOverrides ?? []);
    if (savedVisualSource.restorationReportCache) {
      const cache = savedVisualSource.restorationReportCache;
      const currentReport = createRestorationReport({ from: fromSnap, to: toSnap, bindings: merged, ...(overrides.length > 0 ? { userOverrides: overrides } : {}) });
      if (cache.inputHash === currentReport.inputHash && cache.bindingHash === currentReport.bindingHash) {
        setRestorationReport(cache.report);
        setReportStale(false);
      } else {
        setRestorationReport(cache.report);
        setReportStale(true);
      }
    }
  }, [savedVisualSource]);

  const fromByKey = useMemo(
    () => new Map(fromFrame?.elements.map((element) => [element.key, element]) ?? []),
    [fromFrame]
  );
  const toByKey = useMemo(
    () => new Map(toFrame?.elements.map((element) => [element.key, element]) ?? []),
    [toFrame]
  );
  const planIssues = useMemo(
    () =>
      plan
        ? evaluateMorphPlan(plan, {
            ...(fromFrame ? { from: fromFrame } : {}),
            ...(toFrame ? { to: toFrame } : {})
          })
        : [],
    [fromFrame, plan, toFrame]
  );
  const frameWidth = Math.max(fromFrame?.width ?? 1, toFrame?.width ?? 1);
  const frameHeight = Math.max(fromFrame?.height ?? 1, toFrame?.height ?? 1);
  const visualFrameWidth = Math.max(fromVisualFrame?.width ?? 1, toVisualFrame?.width ?? 1);
  const visualFrameHeight = Math.max(fromVisualFrame?.height ?? 1, toVisualFrame?.height ?? 1);
  const filteredFrom = (fromFrame?.elements ?? []).filter((element) =>
    `${element.key} ${element.nodeId} ${element.name} ${element.text ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const filteredTo = (toFrame?.elements ?? []).filter((element) =>
    `${element.key} ${element.nodeId} ${element.name} ${element.text ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const selectedVisualOverride = visualNodeId
    ? overrideForNode(visualNodeId, nodeOverrides, fromVisualFrame, toVisualFrame)
    : undefined;
  const fromVisualOverrideCss = createZeroVisualNodeOverrideCss(nodeOverrides, fromVisualFrame?.nodes);
  const toVisualOverrideCss = createZeroVisualNodeOverrideCss(nodeOverrides, toVisualFrame?.nodes);
  const showLegacy = mode !== "visual";
  const showVisual = mode !== "legacy";

  const visualExportHtml = useMemo(() => {
    if (!fromVisualFrame || !toVisualFrame || !visualBindingResult) return undefined;
    const intent = compileVisualMotionIntent(motionPrompt);
    const result = compileVisualMotionComposition({ from: fromVisualFrame, to: toVisualFrame, bindingResult: visualBindingResult, intent });
    if (result.document.visualSource?.kind === "zero-visual-morph") {
      if (nodeOverrides.length > 0) result.document.visualSource.nodeOverrides = nodeOverrides;
      if (restorationReport) {
        result.document.visualSource.restorationReportCache = {
          report: restorationReport,
          inputHash: restorationReport.inputHash,
          bindingHash: restorationReport.bindingHash,
          generatedAt: restorationReport.generatedAt
        };
      }
    }
    return exportVisualCompositionHtml(result.document, result.document.composition!);
  }, [fromVisualFrame, toVisualFrame, visualBindingResult, motionPrompt, nodeOverrides, restorationReport]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    playTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(1, current + 16 / Math.max(1, durationMs));
        if (next >= 1) setIsPlaying(false);
        return next;
      });
    }, 16);
    return () => {
      if (playTimerRef.current != null) window.clearInterval(playTimerRef.current);
      playTimerRef.current = undefined;
    };
  }, [durationMs, isPlaying]);

  useEffect(() => {
    if (!isVisualPlaying) return undefined;
    visualPlayTimerRef.current = window.setInterval(() => {
      setVisualProgress((current) => {
        const next = Math.min(1, current + 16 / Math.max(1, durationMs));
        if (next >= 1) setIsVisualPlaying(false);
        return next;
      });
    }, 16);
    return () => {
      if (visualPlayTimerRef.current != null) window.clearInterval(visualPlayTimerRef.current);
      visualPlayTimerRef.current = undefined;
    };
  }, [durationMs, isVisualPlaying]);

  function loadSnapshot(kind: "from" | "to") {
    try {
      const snapshot = parseSnapshotJson(kind === "from" ? fromText : toText);
      if (kind === "from") setFromFrame(snapshot);
      else setToFrame(snapshot);
      setError(undefined);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "帧 JSON 无法识别");
    }
  }

  function generatePlan(nextResult = matchResult) {
    if (!fromFrame || !toFrame) {
      setError("请先导入起始帧和结束帧 JSON。");
      return;
    }
    const baseResult = nextResult ?? matchFrameElements(fromFrame, toFrame);
    const nextPlan = compileMorphPlan({
      from: fromFrame,
      to: toFrame,
      durationMs,
      easing: easingFromValue(easing),
      matches: baseResult
    });
    setMatchResult(baseResult);
    setPlan(nextPlan);
    setPreviewMode("morph");
    setProgress(0);
    setIsPlaying(false);
    setError(undefined);
  }

  async function readZeroFramesAndApply() {
    const startNode = fromNodeId.trim();
    const endNode = toNodeId.trim();
    if (!startNode || !endNode) {
      setError("请填写 Zero 起始帧和结束帧 nodeId。");
      return;
    }
    setIsReadingZero(true);
    setError(undefined);
    try {
      const [from, to] = await Promise.all([
        fetchZeroFrameSnapshot(startNode),
        fetchZeroFrameSnapshot(endNode)
      ]);
      const matches = matchFrameElements(from, to);
      const nextPlan = compileMorphPlan({
        from,
        to,
        durationMs,
        easing: easingFromValue(easing),
        matches
      });
      const composition = compileFrameMorphComposition({
        from,
        to,
        prompt: motionPrompt,
        matches
      });
      setFromFrame(from);
      setToFrame(to);
      setFromText(JSON.stringify(from, null, 2));
      setToText(JSON.stringify(to, null, 2));
      setMatchResult(matches);
      setPlan(nextPlan);
      setPreviewMode("morph");
      setProgress(0);
      setIsPlaying(false);
      onApplyComposition(composition);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Zero 首尾帧读取失败。");
    } finally {
      setIsReadingZero(false);
    }
  }

  function confirmManualMatch(toNodeId: string) {
    if (!manualMatchFrom) return;
    applyVisualOverride({ fromNodeId: manualMatchFrom, toNodeId, action: "matched" });
    setManualMatchFrom(undefined);
  }

  function applyVisualOverride(override: UserBindingOverride) {
    const next = [...userOverrides.filter((o) => o.fromNodeId !== override.fromNodeId), override];
    setUserOverrides(next);
    if (!fromVisualFrame || !toVisualFrame) return;
    const freshBinding = compileVisualMotionBindings(fromVisualFrame, toVisualFrame);
    const merged = applyOverridesToBinding(freshBinding, next, fromVisualFrame, toVisualFrame);
    setVisualBindingResult(merged);
    setReportStale(true);
    const intent = compileVisualMotionIntent(motionPrompt);
    const visualComposition = compileVisualMotionComposition({
      from: fromVisualFrame,
      to: toVisualFrame,
      bindingResult: merged,
      intent
    });
    if (visualComposition.document.visualSource?.kind === "zero-visual-morph") {
      visualComposition.document.visualSource.userBindingOverrides = next;
      if (nodeOverrides.length > 0) visualComposition.document.visualSource.nodeOverrides = nodeOverrides;
    }
    onApplyVisualComposition(visualComposition);
  }

  function refreshRestorationReport() {
    if (!fromVisualFrame || !toVisualFrame || !visualBindingResult) return;
    const fresh = createRestorationReport({
      from: fromVisualFrame,
      to: toVisualFrame,
      bindings: visualBindingResult,
      ...(userOverrides.length > 0 ? { userOverrides } : {})
    });
    setRestorationReport(fresh);
    setReportStale(false);
    const intent = compileVisualMotionIntent(motionPrompt);
    const visualComposition = compileVisualMotionComposition({
      from: fromVisualFrame,
      to: toVisualFrame,
      bindingResult: visualBindingResult,
      intent
    });
    if (visualComposition.document.visualSource?.kind === "zero-visual-morph") {
      visualComposition.document.visualSource.restorationReportCache = {
        report: fresh,
        inputHash: fresh.inputHash,
        bindingHash: fresh.bindingHash,
        generatedAt: fresh.generatedAt
      };
      if (userOverrides.length > 0) {
        visualComposition.document.visualSource.userBindingOverrides = userOverrides;
      }
      if (nodeOverrides.length > 0) {
        visualComposition.document.visualSource.nodeOverrides = nodeOverrides;
      }
    }
    onApplyVisualComposition(visualComposition);
  }

  function updateSelectedNodeOverride(patch: Partial<ZeroVisualNodeOverride>): void {
    if (!visualNodeId || !fromVisualFrame || !toVisualFrame || !visualBindingResult) return;
    const current = overrideForNode(visualNodeId, nodeOverrides, fromVisualFrame, toVisualFrame);
    if (!current) return;
    const nextOverride = { ...current, ...patch, nodeId: visualNodeId };
    const nextOverrides = upsertNodeOverride(nodeOverrides, nextOverride);
    setNodeOverrides(nextOverrides);
    setReportStale(true);
    const intent = compileVisualMotionIntent(motionPrompt);
    const visualComposition = compileVisualMotionComposition({
      from: fromVisualFrame,
      to: toVisualFrame,
      bindingResult: visualBindingResult,
      intent
    });
    if (visualComposition.document.visualSource?.kind === "zero-visual-morph") {
      if (userOverrides.length > 0) {
        visualComposition.document.visualSource.userBindingOverrides = userOverrides;
      }
      visualComposition.document.visualSource.nodeOverrides = nextOverrides;
    }
    onApplyVisualComposition(visualComposition);
  }

  async function readZeroVisualFrames() {
    const startNode = fromNodeId.trim();
    const endNode = toNodeId.trim();
    if (!startNode || !endNode) {
      setVisualError("请填写 Zero 起始帧和结束帧 nodeId。");
      return;
    }
    setIsReadingVisualZero(true);
    setVisualError(undefined);
    try {
      const [fromResult, toResult] = await Promise.all([
        fetchZeroVisualSnapshotResult(startNode),
        fetchZeroVisualSnapshotResult(endNode)
      ]);
      const [fromInlined, toInlined] = await Promise.all([
        inlineZeroVisualAssets(fromResult.snapshot),
        inlineZeroVisualAssets(toResult.snapshot)
      ]);
      const from = fromInlined.snapshot;
      const to = toInlined.snapshot;
      const bindingResult = compileVisualMotionBindings(from, to);
      const intent = compileVisualMotionIntent(motionPrompt);
      const visualComposition = compileVisualMotionComposition({
        from,
        to,
        bindingResult,
        intent
      });
      setFromVisualFrame(from);
      setToVisualFrame(to);
      setVisualBindingResult(bindingResult);
      setNodeOverrides([]);
      setDurationMs(intent.durationMs);
      setEasing(
        intent.easing.type === "spring"
          ? "spring"
          : intent.easing.preset === "standard"
            ? "standard"
            : "decelerate"
      );
      setVisualPreviewMode("from");
      setVisualProgress(0);
      setIsVisualPlaying(false);
      setVisualNodeId(undefined);
      setVisualReadMeta(visualReadInfo(fromResult, toResult));
      const report = createRestorationReport({ from, to, bindings: bindingResult });
      setRestorationReport(report);
      setReportStale(false);
      if (visualComposition.document.visualSource?.kind === "zero-visual-morph") {
        visualComposition.document.visualSource.restorationReportCache = {
          report,
          inputHash: report.inputHash,
          bindingHash: report.bindingHash,
          generatedAt: report.generatedAt
        };
      }
      onApplyVisualComposition(visualComposition);
    } catch (nextError) {
      setVisualError(nextError instanceof Error ? nextError.message : "Zero 高保真首尾帧读取失败。");
    } finally {
      setIsReadingVisualZero(false);
    }
  }

  function addManualPair() {
    if (!selection.fromKey || !selection.toKey || !fromFrame || !toFrame) return;
    const base = matchResult ?? matchFrameElements(fromFrame, toFrame);
    const next = applyManualPair(base, { fromKey: selection.fromKey, toKey: selection.toKey });
    setSelection({});
    generatePlan(next);
  }

  function excludeElement(key: string) {
    if (!fromFrame || !toFrame) return;
    const base = matchResult ?? matchFrameElements(fromFrame, toFrame);
    generatePlan(applyExclude(base, key));
  }

  function markEnter(key: string) {
    if (!fromFrame || !toFrame) return;
    const base = matchResult ?? matchFrameElements(fromFrame, toFrame);
    generatePlan(forceEnter(base, key));
  }

  function markExit(key: string) {
    if (!fromFrame || !toFrame) return;
    const base = matchResult ?? matchFrameElements(fromFrame, toFrame);
    generatePlan(forceExit(base, key));
  }

  function renderPreviewLayers() {
    if (previewMode === "morph" && plan) {
      return plan.tracks.map((track) => {
        const from = track.from ?? track.to;
        const to = track.to ?? track.from;
        if (!from || !to) return null;
        return renderStateLayer(
          interpolate(from, to, progress),
          track.id,
          `frame-morph-layer is-${track.role}`
        );
      });
    }
    if (previewMode === "to") {
      return (toFrame?.elements ?? []).map((element) =>
        renderFrameLayer(element, selection.toKey === element.key, "frame-morph-layer", () =>
          setSelection((current) => ({ ...current, toKey: element.key }))
        )
      );
    }
    if (previewMode === "overlay") {
      return [
        ...(fromFrame?.elements ?? []).map((element) =>
          renderFrameLayer(element, false, "frame-morph-layer is-ghost-from", () =>
            setSelection((current) => ({ ...current, fromKey: element.key }))
          )
        ),
        ...(toFrame?.elements ?? []).map((element) =>
          renderFrameLayer(element, false, "frame-morph-layer is-ghost-to", () =>
            setSelection((current) => ({ ...current, toKey: element.key }))
          )
        )
      ];
    }
    return (fromFrame?.elements ?? []).map((element) =>
      renderFrameLayer(element, selection.fromKey === element.key, "frame-morph-layer", () =>
        setSelection((current) => ({ ...current, fromKey: element.key }))
      )
    );
  }

  return (
    <section className="frame-morph-panel">
      {showLegacy ? (
      <div className="panel-section">
        <p className="eyebrow">帧间过渡</p>
        <label className="field">
          <span>动效描述</span>
          <textarea
            aria-label="帧间动效描述"
            value={motionPrompt}
            onChange={(event) => setMotionPrompt(event.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>起始 Zero nodeId</span>
            <input
              aria-label="起始 Zero nodeId"
              value={fromNodeId}
              onChange={(event) => setFromNodeId(event.target.value)}
            />
          </label>
          <label className="field">
            <span>结束 Zero nodeId</span>
            <input
              aria-label="结束 Zero nodeId"
              value={toNodeId}
              onChange={(event) => setToNodeId(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="primary-action"
          disabled={isReadingZero}
          onClick={() => void readZeroFramesAndApply()}
        >
          {isReadingZero ? "读取 legacy Zero 中…" : "从 Zero 读取 legacy 低保真时间线"}
        </button>
        <p className="empty-state">
          该入口只用于调试 FrameSnapshot 旧链路，会把 Zero 节点重绘成 MotionLayer，不作为高保真交付路径。
        </p>
        {error ? <p className="frame-morph-error">{error}</p> : null}
      </div>
      ) : null}

      {showVisual ? (
      <div className="panel-section">
        <p className="eyebrow">高保真预览</p>
        <button
          type="button"
          className="primary-action"
          disabled={isReadingVisualZero}
          onClick={() => void readZeroVisualFrames()}
        >
          {isReadingVisualZero ? "读取 Zero 高保真帧中…" : "从 Zero 读取并生成高保真时间线"}
        </button>
        <p className="empty-state">
          该预览读取 ZeroVisualSnapshot，使用隔离 iframe 渲染
          HTML/CSS/assets；截图只作为验收参考，不作为画布背景。
        </p>
        {visualError ? <p className="frame-morph-error">{visualError}</p> : null}
        {visualReadMeta ? (
          <div className="zero-visual-source-panel" aria-label="Zero 高保真读取状态">
            <p>
              来源：<strong>{visualReadMeta.source}</strong>
            </p>
            <p>首帧：{visualFrameSummary(visualReadMeta.from)}</p>
            <p>尾帧：{visualFrameSummary(visualReadMeta.to)}</p>
            <p>首帧截图：{visualScreenshotStatus(visualReadMeta.from.screenshotUrl)}</p>
            <p>尾帧截图：{visualScreenshotStatus(visualReadMeta.to.screenshotUrl)}</p>
            {visualReadMeta.bridge ? <p>bridge：{visualReadMeta.bridge}</p> : null}
          </div>
        ) : null}
        {fromVisualFrame && toVisualFrame ? (
          <>
            <div className="frame-morph-preview-toolbar">
              {(["from", "to", "overlay", "motion"] as const).map((mode) => (
                <button
                  type="button"
                  className={visualPreviewMode === mode ? "is-active" : ""}
                  onClick={() => setVisualPreviewMode(mode)}
                  key={mode}
                >
                  {mode === "from" ? "首帧" : mode === "to" ? "尾帧" : mode === "overlay" ? "叠加" : "播放"}
                </button>
              ))}
            </div>
            <div
              className={`zero-visual-stage-wrap is-${visualPreviewMode}`}
              style={{ width: visualFrameWidth, height: visualFrameHeight }}
            >
              {visualPreviewMode === "from" ? (
                <VisualStage
                  snapshot={fromVisualFrame}
                  highlightedNodeId={visualNodeId}
                  overrideCss={fromVisualOverrideCss}
                  stageWidth={visualFrameWidth}
                  stageHeight={visualFrameHeight}
                  onNodeSelect={setVisualNodeId}
                />
              ) : null}
              {visualPreviewMode === "to" ? (
                <VisualStage
                  snapshot={toVisualFrame}
                  highlightedNodeId={visualNodeId}
                  overrideCss={toVisualOverrideCss}
                  stageWidth={visualFrameWidth}
                  stageHeight={visualFrameHeight}
                  onNodeSelect={setVisualNodeId}
                />
              ) : null}
              {visualPreviewMode === "overlay" ? (
                <>
                  <div className="zero-visual-overlay-layer is-from">
                    <VisualStage
                      snapshot={fromVisualFrame}
                      highlightedNodeId={visualNodeId}
                      overrideCss={fromVisualOverrideCss}
                      stageWidth={visualFrameWidth}
                      stageHeight={visualFrameHeight}
                      onNodeSelect={setVisualNodeId}
                    />
                  </div>
                  <div className="zero-visual-overlay-layer is-to">
                    <VisualStage
                      snapshot={toVisualFrame}
                      highlightedNodeId={visualNodeId}
                      overrideCss={toVisualOverrideCss}
                      stageWidth={visualFrameWidth}
                      stageHeight={visualFrameHeight}
                      onNodeSelect={setVisualNodeId}
                    />
                  </div>
                </>
              ) : null}
              {visualPreviewMode === "motion" && visualBindingResult ? (
                <>
                  <div className="zero-visual-overlay-layer is-from">
                    <VisualStage
                      snapshot={fromVisualFrame}
                      highlightedNodeId={visualNodeId}
                      overrideCss={fromVisualOverrideCss}
                      stageWidth={visualFrameWidth}
                      stageHeight={visualFrameHeight}
                      motionCss={createVisualTimelineCss(visualBindingResult, visualProgress, "from")}
                      onNodeSelect={setVisualNodeId}
                    />
                  </div>
                  <div className="zero-visual-overlay-layer is-to">
                    <VisualStage
                      snapshot={toVisualFrame}
                      highlightedNodeId={visualNodeId}
                      overrideCss={toVisualOverrideCss}
                      stageWidth={visualFrameWidth}
                      stageHeight={visualFrameHeight}
                      motionCss={createVisualTimelineCss(visualBindingResult, visualProgress, "to")}
                      onNodeSelect={setVisualNodeId}
                    />
                  </div>
                </>
              ) : null}
            </div>
            <input
              aria-label="高保真预览播放进度"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={visualProgress}
              onChange={(event) => {
                setVisualPreviewMode("motion");
                setVisualProgress(Number(event.target.value));
              }}
            />
            <div className="asset-actions">
              <button
                type="button"
                className="small-action"
                disabled={!visualBindingResult}
                onClick={() => {
                  setVisualPreviewMode("motion");
                  setIsVisualPlaying((current) => !current);
                }}
              >
                {isVisualPlaying ? "暂停高保真预览" : "播放高保真预览"}
              </button>
              <button
                type="button"
                className="small-action"
                disabled={!visualBindingResult}
                onClick={() => {
                  setVisualPreviewMode("motion");
                  setIsVisualPlaying(false);
                  setVisualProgress(0);
                }}
              >
                高保真归零
              </button>
            </div>
            <p className="empty-state">
              当前节点：
              {visualNodeId ?? "未选择"}
            </p>
            {selectedVisualOverride ? (
              <div className="zero-node-edit-panel">
                <p className="eyebrow">高保真节点</p>
                <div className="field-row">
                  <label className="field">
                    <span>X</span>
                    <input
                      aria-label="高保真节点 X"
                      type="number"
                      value={selectedVisualOverride.x ?? 0}
                      onChange={(event) =>
                        updateSelectedNodeOverride({
                          x: overrideNumberValue(event.target.value, selectedVisualOverride.x ?? 0)
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Y</span>
                    <input
                      aria-label="高保真节点 Y"
                      type="number"
                      value={selectedVisualOverride.y ?? 0}
                      onChange={(event) =>
                        updateSelectedNodeOverride({
                          y: overrideNumberValue(event.target.value, selectedVisualOverride.y ?? 0)
                        })
                      }
                    />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>宽</span>
                    <input
                      aria-label="高保真节点宽度"
                      type="number"
                      min={1}
                      value={selectedVisualOverride.width ?? 1}
                      onChange={(event) =>
                        updateSelectedNodeOverride({
                          width: Math.max(
                            1,
                            overrideNumberValue(event.target.value, selectedVisualOverride.width ?? 1)
                          )
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>高</span>
                    <input
                      aria-label="高保真节点高度"
                      type="number"
                      min={1}
                      value={selectedVisualOverride.height ?? 1}
                      onChange={(event) =>
                        updateSelectedNodeOverride({
                          height: Math.max(
                            1,
                            overrideNumberValue(event.target.value, selectedVisualOverride.height ?? 1)
                          )
                        })
                      }
                    />
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>圆角</span>
                    <input
                      aria-label="高保真节点圆角"
                      type="number"
                      min={0}
                      value={selectedVisualOverride.radius ?? 0}
                      onChange={(event) =>
                        updateSelectedNodeOverride({
                          radius: Math.max(
                            0,
                            overrideNumberValue(event.target.value, selectedVisualOverride.radius ?? 0)
                          )
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>透明度</span>
                    <input
                      aria-label="高保真节点透明度"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedVisualOverride.opacity ?? 1}
                      onChange={(event) =>
                        updateSelectedNodeOverride({
                          opacity: Math.min(
                            1,
                            Math.max(0, overrideNumberValue(event.target.value, selectedVisualOverride.opacity ?? 1))
                          )
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}
            {visualBindingResult ? (
              <div className="zero-visual-binding-panel">
                <p className="eyebrow">
                  匹配关系 · matched {visualBindingResult.bindings.length} / enter{" "}
                  {visualBindingResult.enter.length} / exit {visualBindingResult.exit.length} / unresolved{" "}
                  {visualBindingResult.unresolved.length}
                </p>
                {manualMatchFrom ? (
                  <div className="manual-match-hint">
                    <span>选择目标节点完成匹配: {manualMatchFrom} →</span>
                    <button type="button" className="small-action" onClick={() => setManualMatchFrom(undefined)}>
                      取消
                    </button>
                  </div>
                ) : null}
                <div className="zero-visual-binding-list">
                  {visualBindingResult.bindings.map((binding) => (
                    <div
                      className={`binding-row${visualNodeId === binding.nodeId ? " is-selected" : ""}${binding.confidence < 60 ? " is-low-confidence" : ""}`}
                      key={binding.layerId}
                    >
                      <button
                        type="button"
                        className="binding-main"
                        onClick={() => setVisualNodeId(binding.nodeId)}
                      >
                        <span className="binding-badge is-matched">matched</span>
                        <span className="binding-detail">
                          {binding.nodeId} → {binding.toNodeId}
                        </span>
                        <span className="binding-confidence">{binding.confidence}%</span>
                      </button>
                      <div className="binding-actions">
                        <button
                          type="button"
                          title="设为 enter"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: binding.nodeId, action: "enter" })
                          }
                        >
                          E
                        </button>
                        <button
                          type="button"
                          title="设为 exit"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: binding.nodeId, action: "exit" })
                          }
                        >
                          X
                        </button>
                        <button
                          type="button"
                          title="忽略"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: binding.nodeId, action: "ignore" })
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {visualBindingResult.enter.map((node) => (
                    <div
                      className={`binding-row${visualNodeId === node.nodeId ? " is-selected" : ""}${manualMatchFrom ? " is-match-target" : ""}`}
                      key={`enter:${node.nodeId}`}
                    >
                      <button
                        type="button"
                        className="binding-main"
                        onClick={() => {
                          if (manualMatchFrom) {
                            confirmManualMatch(node.nodeId);
                          } else {
                            setVisualPreviewMode("to");
                            setVisualNodeId(node.nodeId);
                          }
                        }}
                      >
                        <span className="binding-badge is-enter">enter</span>
                        <span className="binding-detail">
                          {node.nodeId} · {node.text ?? node.name}
                        </span>
                        {manualMatchFrom ? <span className="binding-badge is-matched">← 点击配对</span> : null}
                      </button>
                      <div className="binding-actions">
                        <button
                          type="button"
                          title="设为 exit"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: node.nodeId, action: "exit" })
                          }
                        >
                          X
                        </button>
                        <button
                          type="button"
                          title="忽略"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: node.nodeId, action: "ignore" })
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {visualBindingResult.exit.map((node) => (
                    <div
                      className={`binding-row${visualNodeId === node.nodeId ? " is-selected" : ""}`}
                      key={`exit:${node.nodeId}`}
                    >
                      <button
                        type="button"
                        className="binding-main"
                        onClick={() => {
                          setVisualPreviewMode("from");
                          setVisualNodeId(node.nodeId);
                        }}
                      >
                        <span className="binding-badge is-exit">exit</span>
                        <span className="binding-detail">
                          {node.nodeId} · {node.text ?? node.name}
                        </span>
                      </button>
                      <div className="binding-actions">
                        <button
                          type="button"
                          title="手动匹配"
                          onClick={() => setManualMatchFrom(node.nodeId)}
                        >
                          M
                        </button>
                        <button
                          type="button"
                          title="设为 enter"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: node.nodeId, action: "enter" })
                          }
                        >
                          E
                        </button>
                        <button
                          type="button"
                          title="忽略"
                          onClick={() =>
                            applyVisualOverride({ fromNodeId: node.nodeId, action: "ignore" })
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {visualBindingResult.unresolved.map((item) => (
                    <div
                      className="binding-row is-unresolved"
                      key={`unresolved:${item.fromNodeId ?? "none"}:${item.toNodeId ?? "none"}`}
                    >
                      <button
                        type="button"
                        className="binding-main"
                        onClick={() => setVisualNodeId(item.fromNodeId ?? item.toNodeId)}
                      >
                        <span className="binding-badge is-unresolved">待确认</span>
                        <span className="binding-detail">
                          {item.fromNodeId ?? "-"} → {item.toNodeId ?? "-"}
                        </span>
                        <span className="binding-reason">{item.reason}</span>
                      </button>
                      <div className="binding-actions">
                        {item.fromNodeId ? (
                          <button
                            type="button"
                            title="手动匹配"
                            onClick={() => setManualMatchFrom(item.fromNodeId!)}
                          >
                            M
                          </button>
                        ) : null}
                        {item.fromNodeId ? (
                          <button
                            type="button"
                            title="设为 exit"
                            onClick={() =>
                              applyVisualOverride({ fromNodeId: item.fromNodeId!, action: "exit" })
                            }
                          >
                            X
                          </button>
                        ) : null}
                        {item.fromNodeId ? (
                          <button
                            type="button"
                            title="忽略"
                            onClick={() =>
                              applyVisualOverride({ fromNodeId: item.fromNodeId!, action: "ignore" })
                            }
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {userOverrides.length > 0 ? (
                  <p className="override-count">手动修正: {userOverrides.length} 条</p>
                ) : null}
              </div>
            ) : null}
            {fromObjectModel && fromObjectModel.objects.length > 0 ? (
              <div className="object-model-panel">
                <p className="eyebrow">
                  对象层 · {fromObjectModel.objects.length} 个顶层对象
                  {fromObjectModel.unresolvedNodeIds.length > 0
                    ? ` · ${fromObjectModel.unresolvedNodeIds.length} 未归类`
                    : ""}
                </p>
                <div className="object-model-list">
                  {fromObjectModel.objects.map((obj) => (
                    <ObjectRow
                      key={obj.id}
                      object={obj}
                      depth={0}
                      selectedNodeId={visualNodeId}
                      onSelect={setVisualNodeId}
                      bindingResult={visualBindingResult}
                      {...(onConvertToLayer
                        ? {
                            onConvert: (target: FrameObject) => {
                              onConvertToLayer({
                                name: target.name,
                                kind: target.kind === "text" ? "text" : "shape",
                                bounds: target.bounds,
                                ...(target.kind === "text" ? { text: target.name } : {})
                              });
                            }
                          }
                        : {})}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {restorationReport ? (
              <div className="restoration-report-panel" aria-label="还原质量报告">
                <p className="eyebrow">还原质量{reportStale ? " (已过期)" : ""}</p>
                <button type="button" className="small-action" onClick={refreshRestorationReport}>
                  {reportStale ? "重新计算报告" : "刷新报告"}
                </button>
                <div className="restoration-issue-summary">
                  <span className="issue-count is-error">
                    {restorationReport.issues.filter((i) => i.severity === "error").length} 错误
                  </span>
                  <span className="issue-count is-warning">
                    {restorationReport.issues.filter((i) => i.severity === "warning").length} 警告
                  </span>
                  <span className="issue-count is-info">
                    {restorationReport.issues.filter((i) => i.severity === "info").length} 提示
                  </span>
                </div>
                <details className="restoration-score-detail">
                  <summary>总分 {restorationReport.score} · {restorationReport.summary}</summary>
                  <div className="restoration-metrics">
                    {Object.entries(restorationReport.metrics).map(([key, metric]) => (
                      <p key={key} className={`is-${metric.status}`}>
                        {key === "nodeCoverage" ? "节点覆盖" : key === "styleCoverage" ? "样式覆盖" : key === "layerOrderConfidence" ? "层级顺序" : key === "matchConfidence" ? "匹配置信" : "视觉风险"}
                        ：{metric.value !== null ? `${metric.value}%` : metric.status} (权重 {metric.weight})
                      </p>
                    ))}
                  </div>
                </details>
                {restorationReport.issues.length > 0 ? (
                  <div className="restoration-issue-list">
                    {restorationReport.issues.slice(0, 20).map((issue) => (
                      <button
                        type="button"
                        className={`restoration-issue is-${issue.severity}`}
                        onClick={() => {
                          if (issue.nodeId) setVisualNodeId(issue.nodeId);
                        }}
                        key={issue.id}
                      >
                        <span className="issue-severity">{issue.severity}</span>
                        <span className="issue-title">{issue.title}</span>
                        <span className="issue-suggestion">{issue.suggestion}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">无关键问题，还原质量良好。</p>
                )}
              </div>
            ) : !fromVisualFrame && !toVisualFrame ? (
              <p className="empty-state">读取 Zero 首尾帧后将生成还原质量报告。</p>
            ) : !fromVisualFrame || !toVisualFrame ? (
              <p className="empty-state">缺少首帧或尾帧数据，无法生成报告。</p>
            ) : null}
          </>
        ) : null}
      </div>
      ) : null}

      {showLegacy ? (
      <details className="panel-section">
        <summary>高级调试：导入 legacy FrameSnapshot JSON（低保真）</summary>
        <p className="empty-state">
          这里只用于排查旧快照契约，不是正常 Zero/MCP 工作流。正常使用请点击上方“从 Zero 读取并生成高保真时间线”。
        </p>
        <div className="frame-morph-import-grid">
          <label className="field">
            <span>起始帧 JSON</span>
            <textarea
              aria-label="起始帧 JSON"
              value={fromText}
              onChange={(event) => setFromText(event.target.value)}
            />
            <input
              aria-label="导入起始帧 JSON"
              type="file"
              accept="application/json,.json"
              onChange={(event) => readFile(event.target.files?.[0], setFromText)}
            />
            <button type="button" className="small-action" onClick={() => loadSnapshot("from")}>
              读取起始帧
            </button>
          </label>
          <label className="field">
            <span>结束帧 JSON</span>
            <textarea
              aria-label="结束帧 JSON"
              value={toText}
              onChange={(event) => setToText(event.target.value)}
            />
            <input
              aria-label="导入结束帧 JSON"
              type="file"
              accept="application/json,.json"
              onChange={(event) => readFile(event.target.files?.[0], setToText)}
            />
            <button type="button" className="small-action" onClick={() => loadSnapshot("to")}>
              读取结束帧
            </button>
          </label>
        </div>
        <p className="empty-state">
          起始：
          {fromFrame
            ? `${fromFrame.name} (${fromFrame.frameId}) · ${fromFrame.width}x${fromFrame.height} · ${fromFrame.elements.length} 元素`
            : "未导入"}
        </p>
        <p className="empty-state">
          结束：
          {toFrame
            ? `${toFrame.name} (${toFrame.frameId}) · ${toFrame.width}x${toFrame.height} · ${toFrame.elements.length} 元素`
            : "未导入"}
        </p>
      </details>
      ) : null}

      {showLegacy ? (
      <div className="panel-section">
        <div className="field-row">
          <label className="field">
            <span>时长 ms</span>
            <input
              aria-label="帧间过渡时长"
              type="number"
              min="1"
              value={durationMs}
              onChange={(event) => setDurationMs(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>缓动</span>
            <select
              aria-label="帧间过渡缓动"
              value={easing}
              onChange={(event) => setEasing(event.target.value as typeof easing)}
            >
              {easingOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="small-action"
          disabled={!fromFrame || !toFrame}
          onClick={() => generatePlan()}
        >
          调试：根据 JSON 生成预览
        </button>
        <p className="empty-state">配对结果：{groupCounts(matchResult)}</p>
      </div>
      ) : null}

      {showLegacy ? (
      <div className="panel-section">
        <div className="frame-morph-preview-toolbar">
          {(["from", "to", "overlay", "morph"] as const).map((mode) => (
            <button
              type="button"
              className={previewMode === mode ? "is-active" : ""}
              onClick={() => setPreviewMode(mode)}
              key={mode}
            >
              {mode === "from" ? "首帧" : mode === "to" ? "尾帧" : mode === "overlay" ? "叠加" : "播放"}
            </button>
          ))}
        </div>
        <div
          className="frame-morph-stage"
          style={{ width: frameWidth, height: frameHeight }}
          data-preview-mode={previewMode}
        >
          {previewMode === "from" && fromFrame?.screenshotUrl ? (
            <img src={fromFrame.screenshotUrl} alt="" />
          ) : null}
          {previewMode === "to" && toFrame?.screenshotUrl ? <img src={toFrame.screenshotUrl} alt="" /> : null}
          {renderPreviewLayers()}
        </div>
        <input
          aria-label="帧间过渡播放进度"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
        />
        <div className="asset-actions">
          <button
            type="button"
            className="small-action"
            disabled={!plan}
            onClick={() => {
              setPreviewMode("morph");
              setIsPlaying((current) => !current);
            }}
          >
            {isPlaying ? "暂停" : "播放"}
          </button>
          <button
            type="button"
            className="small-action"
            disabled={!plan}
            onClick={() => {
              setIsPlaying(false);
              setProgress(0);
              setPreviewMode("morph");
            }}
          >
            归零
          </button>
        </div>
      </div>
      ) : null}

      {showLegacy ? (
      <div className="panel-section">
        <p className="eyebrow">配对检查</p>
        <input
          className="frame-morph-search"
          type="text"
          placeholder="搜索 key / nodeId / text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="selected-layer-readout">
          <strong>{elementSummary(selection.fromKey ? fromByKey.get(selection.fromKey) : undefined)}</strong>
          <span>{elementSummary(selection.toKey ? toByKey.get(selection.toKey) : undefined)}</span>
        </div>
        <div className="asset-actions">
          <button
            type="button"
            className="small-action"
            disabled={!selection.fromKey || !selection.toKey}
            onClick={addManualPair}
          >
            建立配对
          </button>
          <button
            type="button"
            className="small-action"
            disabled={!selection.fromKey && !selection.toKey}
            onClick={() => {
              if (selection.fromKey) excludeElement(selection.fromKey);
              if (selection.toKey) excludeElement(selection.toKey);
              setSelection({});
            }}
          >
            排除选中
          </button>
          <button
            type="button"
            className="small-action"
            disabled={!selection.toKey}
            onClick={() => {
              if (selection.toKey) markEnter(selection.toKey);
              setSelection((current) => (current.fromKey ? { fromKey: current.fromKey } : {}));
            }}
          >
            设为进入
          </button>
          <button
            type="button"
            className="small-action"
            disabled={!selection.fromKey}
            onClick={() => {
              if (selection.fromKey) markExit(selection.fromKey);
              setSelection((current) => (current.toKey ? { toKey: current.toKey } : {}));
            }}
          >
            设为退出
          </button>
        </div>
        <div className="frame-morph-pair-grid">
          <div>
            <strong>首帧元素</strong>
            {filteredFrom.slice(0, 24).map((element) => (
              <button
                type="button"
                className={selection.fromKey === element.key ? "is-selected" : ""}
                onClick={() => setSelection((current) => ({ ...current, fromKey: element.key }))}
                key={element.key}
              >
                {elementSummary(element)}
              </button>
            ))}
          </div>
          <div>
            <strong>尾帧元素</strong>
            {filteredTo.slice(0, 24).map((element) => (
              <button
                type="button"
                className={selection.toKey === element.key ? "is-selected" : ""}
                onClick={() => setSelection((current) => ({ ...current, toKey: element.key }))}
                key={element.key}
              >
                {elementSummary(element)}
              </button>
            ))}
          </div>
        </div>
        {matchResult ? (
          <div className="frame-morph-match-list">
            <strong>matched</strong>
            {matchResult.matches.slice(0, 12).map((match) => (
              <p key={`${match.fromKey}-${match.toKey}`}>
                matched · confidence {match.confidence} · {elementDetail(fromByKey.get(match.fromKey))} →
                {elementDetail(toByKey.get(match.toKey))}
              </p>
            ))}
            <strong>enter</strong>
            {matchResult.enter.slice(0, 8).map((key) => (
              <p key={`enter-${key}`}>enter · {elementDetail(toByKey.get(key))}</p>
            ))}
            <strong>exit</strong>
            {matchResult.exit.slice(0, 8).map((key) => (
              <p key={`exit-${key}`}>exit · {elementDetail(fromByKey.get(key))}</p>
            ))}
            <strong>unresolved</strong>
            {matchResult.unresolved.slice(0, 8).map((item, index) => (
              <p key={`${item.fromKey}-${item.toKey}-${index}`}>
                unresolved · {item.reason} · {item.fromKey ? elementDetail(fromByKey.get(item.fromKey)) : ""}
                {item.toKey ? ` → ${elementDetail(toByKey.get(item.toKey))}` : ""}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}

      <div className="panel-section">
        <p className="eyebrow">导出</p>
        <div className="asset-actions">
          <a
            className="small-action link-action"
            aria-disabled={!plan}
            href={
              plan ? `data:application/json;charset=utf-8,${encodeURIComponent(exportMorphJson(plan))}` : "#"
            }
            download="morph-plan.json"
          >
            下载 Morph JSON
          </a>
          <a
            className="small-action link-action"
            aria-disabled={!plan}
            href={plan ? `data:text/html;charset=utf-8,${encodeURIComponent(exportMorphHtml(plan))}` : "#"}
            download="morph-preview.html"
          >
            下载 Morph HTML
          </a>
          {visualExportHtml ? (
            <a
              className="small-action link-action"
              href={`data:text/html;charset=utf-8,${encodeURIComponent(visualExportHtml)}`}
              download="zero-visual-morph-export.html"
            >
              下载高保真 HTML
            </a>
          ) : null}
        </div>
        {planIssues.length > 0 ? (
          <div className="frame-morph-match-list">
            {planIssues.slice(0, 10).map((issue) => (
              <p key={issue.id}>
                {issue.severity} · {issue.title} · {issue.reason}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
