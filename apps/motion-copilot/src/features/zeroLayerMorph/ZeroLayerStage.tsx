import type { CSSProperties, ReactNode } from "react";
import {
  computeCompositionStepWindows,
  easedProgress,
  type CompositionStep,
  type CompositionTrack,
  ZeroLayerAsset,
  ZeroLayerMotionBindingResult,
  ZeroLayerNode,
  ZeroLayerNodeOverride,
  ZeroLayerSnapshot
} from "@motion-copilot/core";

type RenderFrame = "from" | "to";

type LayerRenderItem = {
  key: string;
  node: ZeroLayerNode;
  frame: RenderFrame;
  zIndex: number;
  transform?: string | undefined;
  opacityMultiplier?: number | undefined;
};

type ZeroLayerStageProps = {
  snapshot: ZeroLayerSnapshot;
  frame: RenderFrame;
  stageWidth?: number | undefined;
  stageHeight?: number | undefined;
  selectedNodeId?: string | undefined;
  overrides?: ZeroLayerNodeOverride[] | undefined;
  onNodeSelect?: ((nodeId: string) => void) | undefined;
};

type ZeroLayerMotionStageProps = {
  from: ZeroLayerSnapshot;
  to: ZeroLayerSnapshot;
  bindingResult: ZeroLayerMotionBindingResult;
  progress: number;
  compositionTrack?: CompositionTrack | undefined;
  stageWidth?: number | undefined;
  stageHeight?: number | undefined;
  selectedNodeId?: string | undefined;
  overrides?: ZeroLayerNodeOverride[] | undefined;
  onNodeSelect?: ((nodeId: string) => void) | undefined;
};

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function solidColor(color: string, opacity: number | undefined): string {
  if (opacity == null || opacity >= 1) return color;
  if (opacity <= 0) return "transparent";
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1]!;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function assetMap(snapshot: ZeroLayerSnapshot): Map<string, ZeroLayerAsset> {
  return new Map(snapshot.assets.map((asset) => [asset.id, asset]));
}

function overrideFor(
  nodeId: string,
  overrides: ZeroLayerNodeOverride[] | undefined,
  frame: RenderFrame
): ZeroLayerNodeOverride | undefined {
  return overrides?.find(
    (override) => override.nodeId === nodeId && (override.frame === frame || override.frame === "both")
  );
}

function resolveNode(
  node: ZeroLayerNode,
  overrides: ZeroLayerNodeOverride[] | undefined,
  frame: RenderFrame
): ZeroLayerNode {
  const override = overrideFor(node.nodeId, overrides, frame);
  if (!override) return node;
  return {
    ...node,
    bounds: {
      x: override.x ?? node.bounds.x,
      y: override.y ?? node.bounds.y,
      w: override.width ?? node.bounds.w,
      h: override.height ?? node.bounds.h
    },
    opacity: override.opacity ?? node.opacity,
    ...(override.cornerRadius != null ? { cornerRadius: override.cornerRadius } : {})
  };
}

function fillStyle(node: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>): CSSProperties {
  const fill = node.fills?.[0];
  if (!fill) return {};
  if (node.kind === "text" && fill.type === "solid") {
    return { color: solidColor(fill.color, fill.opacity) };
  }
  if (fill.type === "solid") return { background: solidColor(fill.color, fill.opacity) };
  if (fill.type === "gradient" && fill.css) return { background: fill.css };
  if (fill.type === "image" && fill.assetId) {
    const asset = assets.get(fill.assetId);
    if (asset) return { background: `url("${asset.url}") center / cover no-repeat` };
  }
  return {};
}

function strokeStyle(node: ZeroLayerNode): CSSProperties {
  const stroke = node.strokes?.[0];
  if (!stroke) return {};
  return {
    borderColor: solidColor(stroke.color, stroke.opacity),
    borderStyle: "solid",
    borderWidth: stroke.width ?? 1
  };
}

function effectStyle(node: ZeroLayerNode): CSSProperties {
  const style: CSSProperties = {};
  for (const effect of node.effects ?? []) {
    const css = effect.css?.trim();
    if (!css) continue;
    if (css.startsWith("box-shadow:")) {
      style.boxShadow = css.slice("box-shadow:".length).trim();
    } else if (css.startsWith("filter:")) {
      style.filter = css.slice("filter:".length).trim();
    }
  }
  return style;
}

function layerStyle(
  item: LayerRenderItem,
  assets: Map<string, ZeroLayerAsset>
): CSSProperties {
  const node = item.node;
  const opacity = node.opacity * (item.opacityMultiplier ?? 1);
  return {
    position: "absolute",
    left: node.bounds.x,
    top: node.bounds.y,
    width: node.bounds.w,
    height: node.bounds.h,
    zIndex: item.zIndex,
    opacity,
    transform: item.transform,
    overflow: node.clipsContent ? "hidden" : undefined,
    borderRadius: node.kind === "ellipse" ? "50%" : node.cornerRadius,
    boxSizing: "border-box",
    padding: 0,
    margin: 0,
    display: node.kind === "text" ? "flex" : "block",
    alignItems: node.kind === "text" ? "center" : undefined,
    textAlign: node.textStyle?.textAlign,
    fontFamily: node.textStyle?.fontFamily,
    fontSize: node.textStyle?.fontSize,
    fontWeight: node.textStyle?.fontWeight,
    lineHeight: node.textStyle?.lineHeight ? `${node.textStyle.lineHeight}px` : undefined,
    ...fillStyle(node, assets),
    ...strokeStyle(node),
    ...effectStyle(node)
  };
}

function renderLayer(
  item: LayerRenderItem,
  assets: Map<string, ZeroLayerAsset>,
  selectedNodeId: string | undefined,
  onNodeSelect: ((nodeId: string) => void) | undefined
): ReactNode {
  const node = item.node;
  if (!node.visible) return null;
  const asset = node.assetId ? assets.get(node.assetId) : undefined;
  const selected = selectedNodeId === node.nodeId;
  return (
    <button
      type="button"
      className={`zero-layer-node${selected ? " is-selected" : ""}`}
      data-zero-layer-id={node.nodeId}
      data-zero-layer-kind={node.kind}
      style={layerStyle(item, assets)}
      onClick={(event) => {
        event.stopPropagation();
        onNodeSelect?.(node.nodeId);
      }}
      key={item.key}
    >
      {asset ? <img src={asset.url} alt="" /> : node.text ? <span>{node.text}</span> : null}
    </button>
  );
}

function stageStyle(width: number, height: number): CSSProperties {
  return {
    position: "relative",
    width,
    height,
    flex: "0 0 auto"
  };
}

export function ZeroLayerStage({
  snapshot,
  frame,
  stageWidth,
  stageHeight,
  selectedNodeId,
  overrides,
  onNodeSelect
}: ZeroLayerStageProps) {
  const assets = assetMap(snapshot);
  const items: LayerRenderItem[] = snapshot.layers.map((node, index) => ({
    key: `${frame}-${node.nodeId}`,
    node: resolveNode(node, overrides, frame),
    frame,
    zIndex: index
  }));

  return (
    <div
      className="zero-layer-stage"
      style={stageStyle(stageWidth ?? snapshot.width, stageHeight ?? snapshot.height)}
    >
      {items.map((item) => renderLayer(item, assets, selectedNodeId, onNodeSelect))}
    </div>
  );
}

function nodeById(snapshot: ZeroLayerSnapshot, nodeId: string): ZeroLayerNode | undefined {
  return snapshot.layers.find((node) => node.nodeId === nodeId);
}

function interpolatedNode(from: ZeroLayerNode, to: ZeroLayerNode, progress: number): ZeroLayerNode {
  const node: ZeroLayerNode = {
    ...from,
    bounds: {
      x: lerp(from.bounds.x, to.bounds.x, progress),
      y: lerp(from.bounds.y, to.bounds.y, progress),
      w: lerp(from.bounds.w, to.bounds.w, progress),
      h: lerp(from.bounds.h, to.bounds.h, progress)
    },
    opacity: lerp(from.opacity, to.opacity, progress)
  };
  if (from.cornerRadius != null || to.cornerRadius != null) {
    node.cornerRadius = lerp(from.cornerRadius ?? 0, to.cornerRadius ?? 0, progress);
  }
  const source = progress < 0.5 ? from : to;
  if (source.text != null) node.text = source.text;
  if (source.fills) node.fills = source.fills;
  if (source.strokes) node.strokes = source.strokes;
  if (source.textStyle) node.textStyle = source.textStyle;
  if (source.assetId) node.assetId = source.assetId;
  return node;
}

function stepProgress(
  compositionTrack: CompositionTrack | undefined,
  layerId: string,
  globalProgress: number
): { step: CompositionStep; progress: number } | undefined {
  if (!compositionTrack || compositionTrack.totalDurationMs <= 0) return undefined;
  const currentMs = clamp(globalProgress) * compositionTrack.totalDurationMs;
  const stepById = new Map(compositionTrack.steps.map((step) => [step.id, step]));
  let sampled: { step: CompositionStep; progress: number } | undefined;
  for (const window of computeCompositionStepWindows(compositionTrack.steps)) {
    const step = stepById.get(window.stepId);
    if (!step || step.layerId !== layerId) continue;
    const fillMode = step.fillMode ?? "none";
    let rawProgress: number | undefined;
    if (currentMs >= window.start && currentMs <= window.end) {
      rawProgress = (currentMs - window.start) / Math.max(1, step.durationMs);
    } else if (currentMs > window.end && (fillMode === "forwards" || fillMode === "both")) {
      rawProgress = 1;
    } else if (currentMs < window.start && fillMode === "both") {
      rawProgress = 0;
    }
    if (rawProgress == null) continue;
    sampled = {
      step,
      progress: step.easing ? easedProgress(step.easing, rawProgress) : clamp(rawProgress)
    };
  }
  return sampled;
}

export function ZeroLayerMotionStage({
  from,
  to,
  bindingResult,
  progress,
  compositionTrack,
  stageWidth,
  stageHeight,
  selectedNodeId,
  overrides,
  onNodeSelect
}: ZeroLayerMotionStageProps) {
  const p = clamp(progress);
  if (p <= 0) {
    return (
      <ZeroLayerStage
        snapshot={from}
        frame="from"
        stageWidth={stageWidth ?? Math.max(from.width, to.width)}
        stageHeight={stageHeight ?? Math.max(from.height, to.height)}
        selectedNodeId={selectedNodeId}
        overrides={overrides}
        onNodeSelect={onNodeSelect}
      />
    );
  }
  if (p >= 1) {
    return (
      <ZeroLayerStage
        snapshot={to}
        frame="to"
        stageWidth={stageWidth ?? Math.max(from.width, to.width)}
        stageHeight={stageHeight ?? Math.max(from.height, to.height)}
        selectedNodeId={selectedNodeId}
        overrides={overrides}
        onNodeSelect={onNodeSelect}
      />
    );
  }
  const fromAssets = assetMap(from);
  const toAssets = assetMap(to);
  const boundFrom = new Set(bindingResult.bindings.map((binding) => binding.nodeId));
  const boundTo = new Set(bindingResult.bindings.map((binding) => binding.toNodeId));
  const exitIds = new Set(bindingResult.exit.map((node) => node.nodeId));
  const enterIds = new Set(bindingResult.enter.map((node) => node.nodeId));
  const fromOrder = new Map(from.layers.map((node, index) => [node.nodeId, index]));
  const toOrder = new Map(to.layers.map((node, index) => [node.nodeId, index]));
  const items: Array<{ item: LayerRenderItem; assets: Map<string, ZeroLayerAsset> }> = [];

  for (const binding of bindingResult.bindings) {
    const fromNode = nodeById(from, binding.nodeId);
    const toNode = nodeById(to, binding.toNodeId);
    if (!fromNode || !toNode) continue;
    const resolvedFrom = resolveNode(fromNode, overrides, "from");
    const resolvedTo = resolveNode(toNode, overrides, "to");
    const activeStep = stepProgress(compositionTrack, binding.layerId, p);
    const nodeProgress = activeStep?.progress ?? p;
    items.push({
      item: {
        key: `match-${binding.nodeId}-${binding.toNodeId}`,
        node: interpolatedNode(resolvedFrom, resolvedTo, nodeProgress),
        frame: "from",
        zIndex: toOrder.get(binding.toNodeId) ?? fromOrder.get(binding.nodeId) ?? 0
      },
      assets: p < 0.5 ? fromAssets : toAssets
    });
  }

  for (const node of from.layers) {
    if (!node.visible || boundFrom.has(node.nodeId) || node.nodeId === from.nodeId) continue;
    const isExit = exitIds.has(node.nodeId);
    items.push({
      item: {
        key: `from-${node.nodeId}`,
        node: resolveNode(node, overrides, "from"),
        frame: "from",
        zIndex: (fromOrder.get(node.nodeId) ?? 0) - 1,
        transform: undefined,
        opacityMultiplier: isExit ? 1 - p : p < 1 ? 1 : 0
      },
      assets: fromAssets
    });
  }

  for (const node of to.layers) {
    if (!node.visible || boundTo.has(node.nodeId) || node.nodeId === to.nodeId) continue;
    const isEnter = enterIds.has(node.nodeId);
    items.push({
      item: {
        key: `to-${node.nodeId}`,
        node: resolveNode(node, overrides, "to"),
        frame: "to",
        zIndex: toOrder.get(node.nodeId) ?? 0,
        transform: undefined,
        opacityMultiplier: isEnter ? p : p > 0 ? 1 : 0
      },
      assets: toAssets
    });
  }

  return (
    <div
      className="zero-layer-stage"
      style={stageStyle(
        stageWidth ?? Math.max(from.width, to.width),
        stageHeight ?? Math.max(from.height, to.height)
      )}
    >
      {items
        .sort((left, right) => left.item.zIndex - right.item.zIndex)
        .map(({ item, assets }) => renderLayer(item, assets, selectedNodeId, onNodeSelect))}
    </div>
  );
}
