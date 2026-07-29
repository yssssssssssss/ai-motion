import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  compileMotionPlanKeyframes,
  computeCompositionStepWindows,
  easedProgress,
  layerIdFromNodeId,
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
  opacityMultiplier?: number | undefined;
  motionLayerId?: string | undefined;
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
    mixBlendMode: paint.blendMode as CSSProperties["mixBlendMode"]
  };
}

function renderLayer(
  item: LayerRenderItem,
  assets: Map<string, ZeroLayerAsset>,
  selectedNodeId: string | undefined,
  onNodeSelect: ((nodeId: string) => void) | undefined,
  onMotionLayerElement?: ((layerId: string, element: HTMLButtonElement | null) => void) | undefined
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
      data-zero-base-rotation={node.rotation ?? 0}
      {...(item.motionLayerId ? { "data-motion-layer-id": item.motionLayerId } : {})}
      style={layerStyle(item, assets)}
      ref={item.motionLayerId ? (element) => onMotionLayerElement?.(item.motionLayerId!, element) : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onNodeSelect?.(node.nodeId);
      }}
      key={item.key}
    >
      {asset && (node.renderMode === "image" || node.kind === "image") ? (
        <img src={asset.url} alt="" />
      ) : node.text ? (
        <span>{node.text}</span>
      ) : null}
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

function waapiTransform(frame: SampledMotionPlanTrack["state"], baseRotation: number): string {
  return `translate(${frame.x ?? 0}px,${frame.y ?? 0}px) scale(${frame.scale ?? 1}) rotate(${(frame.rotation ?? 0) + baseRotation}deg)`;
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
  if (source.effects) node.effects = source.effects;
  if (source.textStyle) node.textStyle = source.textStyle;
  if (source.assetId) node.assetId = source.assetId;
  if (source.renderMode) node.renderMode = source.renderMode;
  if (source.blendMode) node.blendMode = source.blendMode;
  if (from.rotation != null || to.rotation != null) {
    node.rotation = lerp(from.rotation ?? 0, to.rotation ?? from.rotation ?? 0, progress);
  }
  return node;
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
  motionPlan,
  isPlaying = false,
  compositionTrack,
  stageWidth,
  stageHeight,
  selectedNodeId,
  overrides,
  onNodeSelect
}: ZeroLayerMotionStageProps) {
  const motionLayerElements = useRef(new Map<string, HTMLButtonElement>());
  const prefersReducedMotion = usePrefersReducedMotion();
  const p = prefersReducedMotion && isPlaying ? 1 : clamp(progress);
  const playbackStartProgress = useRef(p);
  if (!isPlaying) playbackStartProgress.current = p;

  useEffect(() => {
    if (
      !isPlaying ||
      prefersReducedMotion ||
      !motionPlan ||
      typeof Element.prototype.animate !== "function"
    ) {
      return undefined;
    }
    const initialTimeMs = playbackStartProgress.current * motionPlan.stageDurationMs;
    const animations = compileMotionPlanKeyframes(motionPlan).flatMap((track) => {
      const element = motionLayerElements.current.get(track.layerId);
      if (!element) return [];
      const baseRotation = Number(element.dataset.zeroBaseRotation ?? "0");
      const frames = track.keyframes.map((frame) => ({
        offset: frame.offset,
        transform: waapiTransform(frame, baseRotation),
        ...(frame.width != null ? { width: `${frame.width}px` } : {}),
        ...(frame.height != null ? { height: `${frame.height}px` } : {}),
        ...(frame.opacity != null ? { opacity: frame.opacity } : {})
      }));
      const animation = element.animate(frames, {
        duration: track.timing.durationMs,
        delay: 0,
        easing: "linear",
        fill: "both"
      });
      animation.currentTime = initialTimeMs - track.timing.delayMs;
      return [animation];
    });
    return () => animations.forEach((animation) => animation.cancel());
  }, [isPlaying, motionPlan, prefersReducedMotion]);

  const onMotionLayerElement = (layerId: string, element: HTMLButtonElement | null) => {
    if (element) motionLayerElements.current.set(layerId, element);
    else motionLayerElements.current.delete(layerId);
  };

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
  const sampledPlanByLayer = new Map(
    motionPlan
      ? sampleMotionPlan(motionPlan, p * motionPlan.stageDurationMs).map((track) => [track.layerId, track])
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
    const resolvedFrom = resolveNode(fromNode, overrides, "from");
    const resolvedTo = resolveNode(toNode, overrides, "to");
    const sampledPlan = sampledPlanByLayer.get(binding.layerId);
    const activeStep = stepProgress(compositionTrack, binding.layerId, p);
    const nodeProgress = activeStep?.progress ?? p;
    const node = sampledPlan
      ? nodeWithMotionPlan(resolvedFrom, sampledPlan.state, resolvedFrom.opacity)
      : activeStep
        ? nodeWithStepMotion(resolvedFrom, activeStep.step, nodeProgress, resolvedFrom.opacity)
        : interpolatedNode(resolvedFrom, resolvedTo, nodeProgress);
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
        transformOrigin: stepTransformOrigin(activeStep?.step)
      },
      assets: activeStep ? fromAssets : p < 0.5 ? fromAssets : toAssets
    });
  }

  for (const node of from.layers) {
    if (!node.visible || boundFrom.has(node.nodeId) || node.nodeId === from.nodeId) continue;
    const isExit = exitIds.has(node.nodeId);
    const resolved = resolveNode(node, overrides, "from");
    const layerId = layerIdFromNodeId(node.nodeId);
    const sampledPlan = isExit ? sampledPlanByLayer.get(layerId) : undefined;
    const activeStep = isExit ? stepProgress(compositionTrack, layerId, p) : undefined;
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
    const resolved = resolveNode(node, overrides, "to");
    const layerId = layerIdFromNodeId(node.nodeId);
    const sampledPlan = isEnter ? sampledPlanByLayer.get(layerId) : undefined;
    const activeStep = isEnter ? stepProgress(compositionTrack, layerId, p) : undefined;
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
        .map(({ item, assets }) =>
          renderLayer(item, assets, selectedNodeId, onNodeSelect, onMotionLayerElement)
        )}
    </div>
  );
}
