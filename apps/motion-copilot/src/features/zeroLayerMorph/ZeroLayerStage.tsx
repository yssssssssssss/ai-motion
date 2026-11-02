import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  computeCompositionStepWindows,
  easedProgress,
  fillMissingMatchedMotionPlanTracks,
  layerIdFromNodeId,
  motionPlanPlaybackDurationMs,
  resolveZeroLayerNodeOverride,
  sampleZeroLayerSkinMix,
  sampleMotionPlan,
  type CompositionStep,
  type CompositionTrack,
  type MotionPlan,
  type SampledMotionPlanTrack,
  ZeroLayerAsset,
  ZeroLayerMotionBindingResult,
  ZeroLayerNode,
  ZeroLayerNodeOverride,
  ZeroLayerSnapshot,
  zeroLayerAppearanceDiffers,
  zeroLayerPaintStyle
} from "@motion-copilot/core";

type RenderFrame = "from" | "to";

type LayerRenderItem = {
  key: string;
  node: ZeroLayerNode;
  frame: RenderFrame;
  zIndex: number;
  transform?: string | undefined;
  transformOrigin?: string | undefined;
  borderRadius?: CSSProperties["borderRadius"] | undefined;
  opacityMultiplier?: number | undefined;
  motionLayerId?: string | undefined;
  skins?: MatchedAppearanceSkin[] | undefined;
};

type MatchedAppearanceSkin = {
  frame: RenderFrame;
  node: ZeroLayerNode;
  assets: Map<string, ZeroLayerAsset>;
  weight: number;
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
  motionPlan?: MotionPlan | undefined;
  isPlaying?: boolean | undefined;
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

function assetMap(snapshot: ZeroLayerSnapshot): Map<string, ZeroLayerAsset> {
  return new Map(snapshot.assets.map((asset) => [asset.id, asset]));
}

function layerStyle(item: LayerRenderItem, assets: Map<string, ZeroLayerAsset>): CSSProperties {
  const node = item.node;
  const opacity = node.opacity * (item.opacityMultiplier ?? 1);
  const paint = zeroLayerPaintStyle(node, assets);
  const transform = [item.transform, paint.rotation ? `rotate(${paint.rotation}deg)` : ""]
    .filter(Boolean)
    .join(" ");
  return {
    position: "absolute",
    left: node.bounds.x,
    top: node.bounds.y,
    width: node.bounds.w,
    height: node.bounds.h,
    zIndex: item.zIndex,
    opacity,
    transform: transform || undefined,
    transformOrigin: item.transformOrigin,
    overflow: node.clipsContent ? "hidden" : undefined,
    borderRadius: item.borderRadius ?? (node.kind === "ellipse" ? "50%" : node.cornerRadius),
    boxSizing: "border-box",
    padding: 0,
    margin: 0,
    display: item.skins ? "block" : node.kind === "text" ? "flex" : "block",
    alignItems: !item.skins && node.kind === "text" ? "center" : undefined,
    textAlign: item.skins ? undefined : node.textStyle?.textAlign,
    fontFamily: item.skins ? undefined : node.textStyle?.fontFamily,
    fontSize: item.skins ? undefined : node.textStyle?.fontSize,
    fontWeight: item.skins ? undefined : node.textStyle?.fontWeight,
    lineHeight: !item.skins && node.textStyle?.lineHeight ? `${node.textStyle.lineHeight}px` : undefined,
    letterSpacing: item.skins ? undefined : node.textStyle?.letterSpacing,
    fontStyle: item.skins ? undefined : node.textStyle?.fontStyle,
    textDecoration: item.skins ? undefined : node.textStyle?.textDecoration,
    textTransform: item.skins
      ? undefined
      : node.textStyle?.textCase === "upper"
        ? "uppercase"
        : node.textStyle?.textCase === "lower"
          ? "lowercase"
          : node.textStyle?.textCase === "capitalize"
            ? "capitalize"
            : undefined,
    background: item.skins ? undefined : paint.background,
    color: item.skins ? undefined : paint.color,
    border: item.skins ? undefined : paint.border,
    boxShadow: item.skins ? undefined : paint.boxShadow,
    filter: item.skins ? undefined : paint.filter,
    mixBlendMode: (item.skins ? undefined : paint.blendMode) as CSSProperties["mixBlendMode"]
  };
}

function skinStyle(skin: MatchedAppearanceSkin): CSSProperties {
  const node = skin.node;
  const paint = zeroLayerPaintStyle(node, skin.assets);
  return {
    position: "absolute",
    inset: 0,
    opacity: node.opacity * skin.weight,
    borderRadius: "inherit",
    overflow: node.clipsContent ? "hidden" : undefined,
    display: node.kind === "text" ? "flex" : "block",
    alignItems: node.kind === "text" ? "center" : undefined,
    textAlign: node.textStyle?.textAlign,
    fontFamily: node.textStyle?.fontFamily,
    fontSize: node.textStyle?.fontSize,
    fontWeight: node.textStyle?.fontWeight,
    lineHeight: node.textStyle?.lineHeight ? `${node.textStyle.lineHeight}px` : undefined,
    letterSpacing: node.textStyle?.letterSpacing,
    fontStyle: node.textStyle?.fontStyle,
    textDecoration: node.textStyle?.textDecoration,
    textTransform:
      node.textStyle?.textCase === "upper"
        ? "uppercase"
        : node.textStyle?.textCase === "lower"
          ? "lowercase"
          : node.textStyle?.textCase === "capitalize"
            ? "capitalize"
            : undefined,
    background: paint.background,
    color: paint.color,
    border: paint.border,
    boxShadow: paint.boxShadow,
    filter: paint.filter,
    mixBlendMode: paint.blendMode as CSSProperties["mixBlendMode"],
    pointerEvents: "none"
  };
}

function layerContent(node: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>): ReactNode {
  const asset = node.assetId ? assets.get(node.assetId) : undefined;
  return asset && (node.renderMode === "image" || node.kind === "image") ? (
    <img src={asset.url} alt="" />
  ) : node.text ? (
    <span>{node.text}</span>
  ) : null;
}

function renderLayer(
  item: LayerRenderItem,
  assets: Map<string, ZeroLayerAsset>,
  selectedNodeId: string | undefined,
  onNodeSelect: ((nodeId: string) => void) | undefined
): ReactNode {
  const node = item.node;
  if (!node.visible) return null;
  const selected = selectedNodeId === node.nodeId;
  return (
    <button
      type="button"
      className={`zero-layer-node${selected ? " is-selected" : ""}`}
      data-zero-layer-id={node.nodeId}
      data-zero-layer-kind={node.kind}
      data-zero-base-rotation={node.rotation ?? 0}
      {...(item.motionLayerId ? { "data-motion-layer-id": item.motionLayerId } : {})}
      style={layerStyle(item, assets)}
      onClick={(event) => {
        event.stopPropagation();
        onNodeSelect?.(node.nodeId);
      }}
      key={item.key}
    >
      {item.skins
        ? item.skins.map((skin) => (
            <div
              data-zero-layer-skin={skin.frame}
              data-zero-layer-kind={skin.node.kind}
              style={skinStyle(skin)}
              key={skin.frame}
            >
              {layerContent(skin.node, skin.assets)}
            </div>
          ))
        : layerContent(node, assets)}
    </button>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
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
    node: resolveZeroLayerNodeOverride(node, overrides, frame),
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

function nodeWithAppearance(
  base: ZeroLayerNode,
  appearance: ZeroLayerNode,
  from: ZeroLayerNode,
  to: ZeroLayerNode,
  progress: number
): ZeroLayerNode {
  const {
    cornerRadius: _cornerRadius,
    text: _text,
    fills: _fills,
    strokes: _strokes,
    effects: _effects,
    textStyle: _textStyle,
    assetId: _assetId,
    renderMode: _renderMode,
    blendMode: _blendMode,
    opacity: _opacity,
    rotation: _rotation,
    ...structural
  } = base;
  return {
    ...structural,
    opacity: appearance.opacity,
    ...(from.rotation != null || to.rotation != null
      ? { rotation: lerp(from.rotation ?? 0, to.rotation ?? from.rotation ?? 0, progress) }
      : {}),
    ...(from.cornerRadius != null || to.cornerRadius != null
      ? { cornerRadius: lerp(from.cornerRadius ?? 0, to.cornerRadius ?? 0, progress) }
      : {}),
    ...(appearance.text != null ? { text: appearance.text } : {}),
    ...(appearance.fills ? { fills: appearance.fills } : {}),
    ...(appearance.strokes ? { strokes: appearance.strokes } : {}),
    ...(appearance.effects ? { effects: appearance.effects } : {}),
    ...(appearance.textStyle ? { textStyle: appearance.textStyle } : {}),
    ...(appearance.assetId ? { assetId: appearance.assetId } : {}),
    ...(appearance.renderMode ? { renderMode: appearance.renderMode } : {}),
    ...(appearance.blendMode ? { blendMode: appearance.blendMode } : {})
  };
}

function interpolatedBorderRadius(
  from: ZeroLayerNode,
  to: ZeroLayerNode,
  progress: number
): CSSProperties["borderRadius"] {
  const fromPercent = from.kind === "ellipse" ? 50 : 0;
  const toPercent = to.kind === "ellipse" ? 50 : 0;
  const fromPixels = from.kind === "ellipse" ? 0 : (from.cornerRadius ?? 0);
  const toPixels = to.kind === "ellipse" ? 0 : (to.cornerRadius ?? 0);
  const percent = lerp(fromPercent, toPercent, progress);
  const pixels = lerp(fromPixels, toPixels, progress);
  if (percent === 0) return pixels;
  if (pixels === 0) return `${percent}%`;
  return `calc(${percent}% + ${pixels}px)`;
}

function interpolatedNode(
  from: ZeroLayerNode,
  to: ZeroLayerNode,
  appearance: ZeroLayerNode,
  progress: number,
  opacity: number
): ZeroLayerNode {
  const node: ZeroLayerNode = {
    ...from,
    bounds: {
      x: lerp(from.bounds.x, to.bounds.x, progress),
      y: lerp(from.bounds.y, to.bounds.y, progress),
      w: lerp(from.bounds.w, to.bounds.w, progress),
      h: lerp(from.bounds.h, to.bounds.h, progress)
    },
    opacity
  };
  if (from.rotation != null || to.rotation != null) {
    node.rotation = lerp(from.rotation ?? 0, to.rotation ?? from.rotation ?? 0, progress);
  }
  return {
    ...nodeWithAppearance(node, appearance, from, to, progress),
    opacity: node.opacity,
    ...(node.rotation != null ? { rotation: node.rotation } : {})
  };
}

function stepNumber(
  source: Record<string, number | undefined> | undefined,
  key: string,
  fallback: number
): number {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stepTransformOrigin(step: CompositionStep | undefined): string | undefined {
  return (step as (CompositionStep & { metadata?: { zeroLayerTransformOrigin?: string } }) | undefined)
    ?.metadata?.zeroLayerTransformOrigin;
}

function motionTransform(step: CompositionStep, progress: number): string | undefined {
  const fromScale = stepNumber(step.initial, "scale", 1);
  const toScale = stepNumber(step.animate, "scale", fromScale);
  const fromRotate = stepNumber(step.initial, "rotate", 0);
  const toRotate = stepNumber(step.animate, "rotate", fromRotate);
  const scale = lerp(fromScale, toScale, progress);
  const rotate = lerp(fromRotate, toRotate, progress);
  if (scale === 1 && rotate === 0) return undefined;
  return `scale(${scale}) rotate(${rotate}deg)`;
}

function nodeWithStepMotion(
  base: ZeroLayerNode,
  step: CompositionStep,
  progress: number,
  opacityBase: number
): ZeroLayerNode {
  const fromWidth = stepNumber(step.initial, "width", base.bounds.w);
  const fromHeight = stepNumber(step.initial, "height", base.bounds.h);
  const toWidth = stepNumber(step.animate, "width", fromWidth);
  const toHeight = stepNumber(step.animate, "height", fromHeight);
  const fromX = stepNumber(step.initial, "x", 0);
  const fromY = stepNumber(step.initial, "y", 0);
  const toX = stepNumber(step.animate, "x", fromX);
  const toY = stepNumber(step.animate, "y", fromY);
  const fromOpacity = stepNumber(step.initial, "opacity", 1);
  const toOpacity = stepNumber(step.animate, "opacity", fromOpacity);
  return {
    ...base,
    bounds: {
      x: base.bounds.x + lerp(fromX, toX, progress),
      y: base.bounds.y + lerp(fromY, toY, progress),
      w: lerp(fromWidth, toWidth, progress),
      h: lerp(fromHeight, toHeight, progress)
    },
    opacity: opacityBase * lerp(fromOpacity, toOpacity, progress)
  };
}

function motionTransformFromState(state: SampledMotionPlanTrack["state"]): string | undefined {
  const scale = state.scale ?? 1;
  const rotation = state.rotation ?? 0;
  if (scale === 1 && rotation === 0) return undefined;
  return `scale(${scale}) rotate(${rotation}deg)`;
}

function nodeWithMotionPlan(
  base: ZeroLayerNode,
  state: SampledMotionPlanTrack["state"],
  opacityBase: number
): ZeroLayerNode {
  return {
    ...base,
    bounds: {
      x: base.bounds.x + (state.x ?? 0),
      y: base.bounds.y + (state.y ?? 0),
      w: state.width ?? base.bounds.w,
      h: state.height ?? base.bounds.h
    },
    opacity: opacityBase * (state.opacity ?? 1)
  };
}

function stepProgress(
  compositionTrack: CompositionTrack | undefined,
  layerId: string,
  currentMs: number
): { step: CompositionStep; progress: number; rawProgress: number } | undefined {
  if (!compositionTrack) return undefined;
  const stepById = new Map(compositionTrack.steps.map((step) => [step.id, step]));
  let sampled: { step: CompositionStep; progress: number; rawProgress: number } | undefined;
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
    const clampedProgress = clamp(rawProgress);
    sampled = {
      step,
      progress: step.easing ? easedProgress(step.easing, clampedProgress) : clampedProgress,
      rawProgress: clampedProgress
    };
  }
  return sampled;
}

export function ZeroLayerMotionStage({
  from,
  to,
  bindingResult,
  progress,
  motionPlan,
  isPlaying = false,
  compositionTrack,
  stageWidth,
  stageHeight,
  selectedNodeId,
  overrides,
  onNodeSelect
}: ZeroLayerMotionStageProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const p = prefersReducedMotion && isPlaying ? 1 : clamp(progress);

  if (p <= 0 && !isPlaying) {
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
  const effectiveMotionPlan =
    motionPlan || compositionTrack
      ? fillMissingMatchedMotionPlanTracks(motionPlan, compositionTrack, {
          kind: "zero-layer-morph",
          from,
          to,
          bindingResult,
          ...(overrides ? { nodeOverrides: overrides } : {})
        })
      : undefined;
  const playbackDurationMs = motionPlanPlaybackDurationMs(effectiveMotionPlan, compositionTrack);
  const currentMs = p * playbackDurationMs;
  const sampledPlanByLayer = new Map(
    effectiveMotionPlan
      ? sampleMotionPlan(effectiveMotionPlan, currentMs).map((track) => [track.layerId, track])
      : []
  );
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
    const resolvedFrom = resolveZeroLayerNodeOverride(fromNode, overrides, "from");
    const resolvedTo = resolveZeroLayerNodeOverride(toNode, overrides, "to");
    const sampledPlan = sampledPlanByLayer.get(binding.layerId);
    const activeStep = stepProgress(compositionTrack, binding.layerId, currentMs);
    const nodeProgress = activeStep?.progress ?? p;
    const appearanceProgress = sampledPlan?.progress ?? activeStep?.rawProgress ?? p;
    const appearanceDiffers = zeroLayerAppearanceDiffers(resolvedFrom, resolvedTo, fromAssets, toAssets);
    const mix = sampleZeroLayerSkinMix(appearanceProgress);
    const skins: MatchedAppearanceSkin[] = appearanceDiffers
      ? [
          { frame: "from" as const, node: resolvedFrom, assets: fromAssets, weight: mix.from },
          { frame: "to" as const, node: resolvedTo, assets: toAssets, weight: mix.to }
        ]
      : [
          {
            frame: "from" as const,
            node: {
              ...resolvedFrom,
              opacity: lerp(resolvedFrom.opacity, resolvedTo.opacity, appearanceProgress)
            },
            assets: fromAssets,
            weight: 1
          }
        ];
    const appearanceNode = {
      ...nodeWithAppearance(resolvedFrom, resolvedFrom, resolvedFrom, resolvedTo, appearanceProgress),
      clipsContent: Boolean(resolvedFrom.clipsContent || resolvedTo.clipsContent)
    };
    const node = sampledPlan
      ? nodeWithMotionPlan(appearanceNode, sampledPlan.state, 1)
      : activeStep
        ? nodeWithStepMotion(appearanceNode, activeStep.step, nodeProgress, 1)
        : interpolatedNode(resolvedFrom, resolvedTo, resolvedFrom, nodeProgress, 1);
    items.push({
      item: {
        key: `match-${binding.nodeId}-${binding.toNodeId}`,
        node,
        frame: "from",
        zIndex: toOrder.get(binding.toNodeId) ?? fromOrder.get(binding.nodeId) ?? 0,
        ...(sampledPlan ? { motionLayerId: sampledPlan.layerId } : {}),
        transform: sampledPlan
          ? motionTransformFromState(sampledPlan.state)
          : activeStep
            ? motionTransform(activeStep.step, nodeProgress)
            : undefined,
        transformOrigin: stepTransformOrigin(activeStep?.step),
        borderRadius: interpolatedBorderRadius(resolvedFrom, resolvedTo, appearanceProgress),
        skins: skins.filter((skin) => skin.weight > 0)
      },
      assets: fromAssets
    });
  }

  for (const node of from.layers) {
    if (!node.visible || boundFrom.has(node.nodeId) || node.nodeId === from.nodeId) continue;
    const isExit = exitIds.has(node.nodeId);
    const resolved = resolveZeroLayerNodeOverride(node, overrides, "from");
    const layerId = layerIdFromNodeId(node.nodeId);
    const sampledPlan = isExit ? sampledPlanByLayer.get(layerId) : undefined;
    const activeStep = isExit ? stepProgress(compositionTrack, layerId, currentMs) : undefined;
    const renderedNode = sampledPlan
      ? nodeWithMotionPlan(resolved, sampledPlan.state, resolved.opacity)
      : activeStep
        ? nodeWithStepMotion(resolved, activeStep.step, activeStep.progress, resolved.opacity)
        : resolved;
    items.push({
      item: {
        key: `from-${node.nodeId}`,
        node: renderedNode,
        frame: "from",
        zIndex: (fromOrder.get(node.nodeId) ?? 0) - 1,
        ...(sampledPlan ? { motionLayerId: sampledPlan.layerId } : {}),
        transform: sampledPlan
          ? motionTransformFromState(sampledPlan.state)
          : activeStep
            ? motionTransform(activeStep.step, activeStep.progress)
            : undefined,
        transformOrigin: stepTransformOrigin(activeStep?.step),
        opacityMultiplier: sampledPlan || activeStep ? 1 : isExit ? 1 - p : p < 1 ? 1 : 0
      },
      assets: fromAssets
    });
  }

  for (const node of to.layers) {
    if (!node.visible || boundTo.has(node.nodeId) || node.nodeId === to.nodeId) continue;
    const isEnter = enterIds.has(node.nodeId);
    const resolved = resolveZeroLayerNodeOverride(node, overrides, "to");
    const layerId = layerIdFromNodeId(node.nodeId);
    const sampledPlan = isEnter ? sampledPlanByLayer.get(layerId) : undefined;
    const activeStep = isEnter ? stepProgress(compositionTrack, layerId, currentMs) : undefined;
    const renderedNode = sampledPlan
      ? nodeWithMotionPlan(resolved, sampledPlan.state, resolved.opacity)
      : activeStep
        ? nodeWithStepMotion(resolved, activeStep.step, activeStep.progress, resolved.opacity)
        : resolved;
    items.push({
      item: {
        key: `to-${node.nodeId}`,
        node: renderedNode,
        frame: "to",
        zIndex: toOrder.get(node.nodeId) ?? 0,
        ...(sampledPlan ? { motionLayerId: sampledPlan.layerId } : {}),
        transform: sampledPlan
          ? motionTransformFromState(sampledPlan.state)
          : activeStep
            ? motionTransform(activeStep.step, activeStep.progress)
            : undefined,
        transformOrigin: stepTransformOrigin(activeStep?.step),
        opacityMultiplier: sampledPlan || activeStep ? 1 : isEnter ? p : p > 0 ? 1 : 0
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
