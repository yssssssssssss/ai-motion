import {
  createClassicEasing,
  easingCss,
  type CompositionStep,
  type CompositionTrack,
  type MotionDocument,
  type MotionState
} from "../schema/document";
import { computeCompositionStepWindows } from "../composition/evaluateComposition";
import { fillMotionPlanGeometryFromComposition, motionPlanPlaybackDurationMs } from "./compileMotionPlan";
import { compileMotionPlanCss } from "./motionPlanRuntime";
import { layerIdFromNodeId } from "./layerId";
import type {
  LayerMotionTrack,
  ZeroLayerAsset,
  ZeroLayerMotionBinding,
  ZeroLayerMorphSource,
  ZeroLayerNode,
  ZeroLayerNodeOverride,
  ZeroLayerSnapshot
} from "./schema";
import { zeroLayerExpressionStrategyForStep } from "./zeroLayerExpressionStrategies";
import {
  resolveZeroLayerNodeOverride,
  ZERO_LAYER_SKIN_CROSSFADE,
  zeroLayerAppearanceDiffers
} from "./zeroLayerAppearance";
import { zeroLayerPaintStyle } from "./zeroLayerPaint";

type RenderFrame = "from" | "to";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function cssIdent(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function px(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded}px`;
}

function layerSelector(layerClass: string, nodeId: string): string {
  return `.${layerClass} [data-zero-layer-id="${cssAttributeValue(nodeId)}"]`;
}

function resolvedBounds(
  source: ZeroLayerMorphSource,
  nodeId: string,
  frame: RenderFrame
): { x: number; y: number; w: number; h: number } | undefined {
  const snapshot = frame === "from" ? source.from : source.to;
  const layer = snapshot.layers.find((item) => item.nodeId === nodeId);
  return layer ? resolveZeroLayerNodeOverride(layer, source.nodeOverrides, frame).bounds : undefined;
}

function layerStyle(layer: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>): string {
  const paint = zeroLayerPaintStyle(layer, assets);
  const styles = [
    "position:absolute",
    `left:${px(layer.bounds.x)}`,
    `top:${px(layer.bounds.y)}`,
    `width:${px(layer.bounds.w)}`,
    `height:${px(layer.bounds.h)}`,
    `opacity:${layer.opacity}`,
    "box-sizing:border-box",
    layer.clipsContent ? "overflow:hidden" : "",
    layer.kind === "ellipse"
      ? "border-radius:50%"
      : layer.cornerRadius != null
        ? `border-radius:${px(layer.cornerRadius)}`
        : "",
    paint.background ? `background:${paint.background}` : "",
    paint.color ? `color:${paint.color}` : "",
    paint.border ? `border:${paint.border}` : "",
    paint.boxShadow ? `box-shadow:${paint.boxShadow}` : "",
    paint.filter ? `filter:${paint.filter}` : "",
    layer.kind === "text" ? "display:flex;align-items:center" : "",
    layer.textStyle?.fontFamily ? `font-family:${layer.textStyle.fontFamily}` : "",
    layer.textStyle?.fontSize != null ? `font-size:${px(layer.textStyle.fontSize)}` : "",
    layer.textStyle?.fontWeight != null ? `font-weight:${layer.textStyle.fontWeight}` : "",
    layer.textStyle?.lineHeight != null ? `line-height:${px(layer.textStyle.lineHeight)}` : "",
    layer.textStyle?.textAlign ? `text-align:${layer.textStyle.textAlign}` : "",
    layer.textStyle?.letterSpacing != null ? `letter-spacing:${px(layer.textStyle.letterSpacing)}` : "",
    layer.textStyle?.fontStyle ? `font-style:${layer.textStyle.fontStyle}` : "",
    layer.textStyle?.textDecoration ? `text-decoration:${layer.textStyle.textDecoration}` : "",
    layer.textStyle?.textCase && layer.textStyle.textCase !== "none"
      ? `text-transform:${
          layer.textStyle.textCase === "upper"
            ? "uppercase"
            : layer.textStyle.textCase === "lower"
              ? "lowercase"
              : "capitalize"
        }`
      : "",
    paint.rotation ? `transform:rotate(${paint.rotation}deg)` : "",
    paint.blendMode ? `mix-blend-mode:${paint.blendMode}` : ""
  ].filter(Boolean);
  return styles.join(";");
}

function layerContent(layer: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>): string {
  const asset = layer.assetId ? assets.get(layer.assetId) : undefined;
  if (asset && (layer.renderMode === "image" || layer.kind === "image")) {
    return `<img src="${escapeHtml(asset.url)}" alt="" />`;
  }
  return layer.text ? `<span>${escapeHtml(layer.text)}</span>` : "";
}

function renderSnapshotLayerHtml(
  layer: ZeroLayerNode,
  assets: Map<string, ZeroLayerAsset>,
  extraAttributes = ""
): string {
  return `<div data-zero-layer-id="${escapeHtml(layer.nodeId)}" data-zero-layer-kind="${escapeHtml(layer.kind)}"${extraAttributes} style="${escapeHtml(layerStyle(layer, assets))}">${layerContent(layer, assets)}</div>`;
}

export function renderZeroLayerSnapshotHtml(
  snapshot: ZeroLayerSnapshot,
  frame: RenderFrame,
  overrides?: ZeroLayerNodeOverride[]
): string {
  const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  return snapshot.layers
    .filter((layer) => layer.visible)
    .map((layer) => resolveZeroLayerNodeOverride(layer, overrides, frame))
    .map((layer) => renderSnapshotLayerHtml(layer, assets))
    .join("\n");
}

function matchedLayerHtml(source: ZeroLayerMorphSource, binding: ZeroLayerMotionBinding): string {
  const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
  const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
  if (!fromNode || !toNode) return "";
  const from = resolveZeroLayerNodeOverride(fromNode, source.nodeOverrides, "from");
  const to = resolveZeroLayerNodeOverride(toNode, source.nodeOverrides, "to");
  const fromAssets = new Map(source.from.assets.map((asset) => [asset.id, asset]));
  const toAssets = new Map(source.to.assets.map((asset) => [asset.id, asset]));
  const appearanceDiffers = zeroLayerAppearanceDiffers(from, to, fromAssets, toAssets);
  const wrapperStyle = [
    "position:absolute",
    `left:${px(from.bounds.x)}`,
    `top:${px(from.bounds.y)}`,
    `width:${px(from.bounds.w)}`,
    `height:${px(from.bounds.h)}`,
    `z-index:${Math.max(
      0,
      source.to.layers.findIndex((node) => node.nodeId === binding.toNodeId)
    )}`,
    "opacity:1",
    "box-sizing:border-box",
    from.clipsContent || to.clipsContent ? "overflow:hidden" : ""
  ]
    .filter(Boolean)
    .join(";");
  const skinStyle = (node: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>) =>
    `${layerStyle(node, assets)};left:0;top:0;width:100%;height:100%;`;
  const skins = appearanceDiffers
    ? `<div data-zero-layer-skin="from" data-zero-layer-kind="${escapeHtml(from.kind)}" style="${escapeHtml(skinStyle(from, fromAssets))}">${layerContent(from, fromAssets)}</div>
  <div data-zero-layer-skin="to" data-zero-layer-kind="${escapeHtml(to.kind)}" style="${escapeHtml(skinStyle({ ...to, opacity: 0 }, toAssets))}">${layerContent(to, toAssets)}</div>`
    : `<div data-zero-layer-skin="single" data-zero-layer-kind="${escapeHtml(from.kind)}" style="${escapeHtml(skinStyle(from, fromAssets))}">${layerContent(from, fromAssets)}</div>`;
  return `<div data-zero-layer-id="${escapeHtml(binding.nodeId)}" data-zero-layer-kind="${escapeHtml(from.kind)}" data-zero-motion-layer-id="${escapeHtml(binding.layerId)}" style="${escapeHtml(wrapperStyle)}">
  ${skins}
</div>`;
}

function animatedLayerHtml(
  node: ZeroLayerNode,
  assets: Map<string, ZeroLayerAsset>,
  layerId: string,
  zIndex: number
): string {
  const wrapperStyle = [
    "position:absolute",
    `left:${px(node.bounds.x)}`,
    `top:${px(node.bounds.y)}`,
    `width:${px(node.bounds.w)}`,
    `height:${px(node.bounds.h)}`,
    `z-index:${zIndex}`,
    "opacity:1",
    "box-sizing:border-box",
    node.clipsContent ? "overflow:hidden" : ""
  ]
    .filter(Boolean)
    .join(";");
  const skinStyle = `${layerStyle(node, assets)};left:0;top:0;width:100%;height:100%;`;
  return `<div data-zero-layer-id="${escapeHtml(node.nodeId)}" data-zero-layer-kind="${escapeHtml(node.kind)}" data-zero-motion-layer-id="${escapeHtml(layerId)}" style="${escapeHtml(wrapperStyle)}">
  <div data-zero-layer-skin="single" data-zero-layer-kind="${escapeHtml(node.kind)}" style="${escapeHtml(skinStyle)}">${layerContent(node, assets)}</div>
</div>`;
}

function renderMotionPlanFrameHtml(source: ZeroLayerMorphSource, frame: RenderFrame): string {
  const snapshot = frame === "from" ? source.from : source.to;
  const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  const matchedByNodeId = new Map(
    source.bindingResult.bindings.map((binding) => [
      frame === "from" ? binding.nodeId : binding.toNodeId,
      binding
    ])
  );
  const animatedLayerIds = new Set([
    ...(source.motionPlan?.tracks.map((track) => track.layerId) ?? []),
    ...source.bindingResult.enter.map((node) => layerIdFromNodeId(node.nodeId)),
    ...source.bindingResult.exit.map((node) => layerIdFromNodeId(node.nodeId))
  ]);
  return snapshot.layers
    .filter((layer) => layer.visible)
    .map((layer, index) => {
      const binding = matchedByNodeId.get(layer.nodeId);
      if (frame === "from" && binding) return matchedLayerHtml(source, binding);
      const resolved = resolveZeroLayerNodeOverride(layer, source.nodeOverrides, frame);
      const layerId = layerIdFromNodeId(layer.nodeId);
      if (!binding && animatedLayerIds.has(layerId)) {
        return animatedLayerHtml(resolved, assets, layerId, frame === "from" ? index - 1 : index);
      }
      return renderSnapshotLayerHtml(
        resolved,
        assets,
        frame === "to" && binding ? ' data-zero-tail-fallback=""' : ""
      );
    })
    .join("\n");
}

function stepByLayerId(track: CompositionTrack): Map<string, CompositionStep> {
  const result = new Map<string, CompositionStep>();
  for (const step of track.steps) {
    if (step.layerId && !result.has(step.layerId)) result.set(step.layerId, step);
  }
  return result;
}

function stepWindowById(track: CompositionTrack): Map<string, { start: number; end: number }> {
  return new Map(computeCompositionStepWindows(track.steps).map((item) => [item.stepId, item]));
}

function numberValue(
  source: Record<string, number | undefined> | undefined,
  key: string,
  fallback: number
): number {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function transformValue(
  state: MotionState | undefined,
  fallbackX: number,
  fallbackY: number,
  baseRotation = 0
): string {
  const x = numberValue(state, "x", fallbackX);
  const y = numberValue(state, "y", fallbackY);
  const scale = numberValue(state, "scale", 1);
  const rotate = numberValue(state, "rotate", 0) + baseRotation;
  return `translate(${px(x)},${px(y)}) scale(${scale}) rotate(${rotate}deg)`;
}

function animationDeclaration(step: CompositionStep, name: string, startMs: number): string {
  const easing = easingCss(step.easing ?? createClassicEasing("decelerate"));
  return `${name} ${step.durationMs}ms ${easing} calc(${startMs}ms - var(--mc-zero-layer-time, 0ms)) both`;
}

function transformOriginCss(step: CompositionStep): string {
  const metadata = step.metadata;
  return metadata?.zeroLayerTransformOrigin ? `transform-origin:${metadata.zeroLayerTransformOrigin};` : "";
}

function mixNumber(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function mixedState(
  step: CompositionStep,
  progress: number,
  from: { x: number; y: number; width: number; height: number; opacity: number; rotation: number },
  to: { x: number; y: number; width: number; height: number; opacity: number; rotation: number },
  opacityOverride?: number
): string {
  const initial = {
    x: numberValue(step.initial, "x", from.x),
    y: numberValue(step.initial, "y", from.y),
    scale: numberValue(step.initial, "scale", 1),
    rotate: numberValue(step.initial, "rotate", 0)
  };
  const animate = {
    x: numberValue(step.animate, "x", to.x),
    y: numberValue(step.animate, "y", to.y),
    scale: numberValue(step.animate, "scale", 1),
    rotate: numberValue(step.animate, "rotate", 0)
  };
  const width = mixNumber(
    numberValue(step.initial, "width", from.width),
    numberValue(step.animate, "width", to.width),
    progress
  );
  const height = mixNumber(
    numberValue(step.initial, "height", from.height),
    numberValue(step.animate, "height", to.height),
    progress
  );
  const opacity =
    opacityOverride ??
    mixNumber(
      numberValue(step.initial, "opacity", from.opacity),
      numberValue(step.animate, "opacity", to.opacity),
      progress
    );
  const rotation =
    mixNumber(initial.rotate, animate.rotate, progress) + mixNumber(from.rotation, to.rotation, progress);
  const transform = `translate(${px(mixNumber(initial.x, animate.x, progress))},${px(
    mixNumber(initial.y, animate.y, progress)
  )}) scale(${mixNumber(initial.scale, animate.scale, progress)}) rotate(${rotation}deg)`;
  return `transform:${transform};width:${px(width)};height:${px(height)};opacity:${opacity};`;
}

function matchedKeyframes(
  step: CompositionStep,
  name: string,
  from: { x: number; y: number; width: number; height: number; opacity: number; rotation: number },
  to: { x: number; y: number; width: number; height: number; opacity: number; rotation: number }
): string {
  const strategy = zeroLayerExpressionStrategyForStep(step);
  const start = mixedState(step, 0, from, to);
  const end = mixedState(step, 1, from, to);
  const body = strategy.stops
    .map((stop) => {
      const state =
        stop.progress === 0 && stop.opacity == null
          ? start
          : stop.progress === 1 && stop.opacity == null
            ? end
            : mixedState(step, stop.progress, from, to, stop.opacity);
      return `  ${stop.percent}%{${state}}`;
    })
    .join("\n");
  return `/* zero-layer-expression:${strategy.id} */
@keyframes ${name}{
${body}
}`;
}

const fallbackEasing = { type: "classic", preset: "standard", css: "linear" } as const;

function fallbackMatchedStep(
  source: ZeroLayerMorphSource,
  binding: ZeroLayerMotionBinding,
  durationMs: number,
  index: number
): CompositionStep | undefined {
  const from = resolvedBounds(source, binding.nodeId, "from");
  const to = resolvedBounds(source, binding.toNodeId, "to");
  if (!from || !to) return undefined;
  return {
    id: `zero-layer-fallback-match-${index}-${binding.layerId}`,
    presetId: "zero-layer-morph",
    label: "Zero 图层线性兜底",
    target: "selected-layer",
    layerId: binding.layerId,
    timing: "parallel",
    delayMs: 0,
    durationMs,
    slot: "trajectory",
    initial: { x: 0, y: 0, width: from.w, height: from.h, scale: 1, opacity: 1, rotate: 0 },
    animate: {
      x: to.x - from.x,
      y: to.y - from.y,
      width: to.w,
      height: to.h,
      scale: 1,
      opacity: 1,
      rotate: 0
    },
    easing: fallbackEasing,
    fillMode: "both"
  };
}

function fallbackNodeStep(
  source: ZeroLayerMorphSource,
  node: ZeroLayerNode,
  frame: RenderFrame,
  durationMs: number,
  index: number
): CompositionStep {
  const resolved = resolveZeroLayerNodeOverride(node, source.nodeOverrides, frame);
  const entering = frame === "to";
  return {
    id: `zero-layer-fallback-${entering ? "enter" : "exit"}-${index}-${node.nodeId}`,
    presetId: "zero-layer-morph",
    label: entering ? "Zero 图层淡入兜底" : "Zero 图层淡出兜底",
    target: "selected-layer",
    layerId: layerIdFromNodeId(node.nodeId),
    timing: "parallel",
    delayMs: 0,
    durationMs,
    slot: "trajectory",
    initial: {
      x: 0,
      y: 0,
      width: resolved.bounds.w,
      height: resolved.bounds.h,
      scale: 1,
      opacity: entering ? 0 : 1,
      rotate: 0
    },
    animate: {
      x: 0,
      y: 0,
      width: resolved.bounds.w,
      height: resolved.bounds.h,
      scale: 1,
      opacity: entering ? 1 : 0,
      rotate: 0
    },
    easing: fallbackEasing,
    fillMode: "both"
  };
}

function matchedCss(
  source: ZeroLayerMorphSource,
  binding: ZeroLayerMotionBinding,
  step: CompositionStep | undefined,
  startMs: number,
  index: number
): string {
  if (!step) return "";
  const { nodeId, toNodeId } = binding;
  const fromBounds = resolvedBounds(source, nodeId, "from");
  const toBounds = resolvedBounds(source, toNodeId, "to");
  if (!fromBounds || !toBounds) return "";
  const name = `mc-zero-layer-match-${index}-${cssIdent(nodeId)}-${cssIdent(toNodeId)}`;
  const fromWidth = fromBounds.w;
  const fromHeight = fromBounds.h;
  const toX = toBounds.x - fromBounds.x;
  const toY = toBounds.y - fromBounds.y;
  const toWidth = toBounds.w;
  const toHeight = toBounds.h;
  const resolvedStep: CompositionStep = {
    ...step,
    initial: {
      ...step.initial,
      x: 0,
      y: 0,
      width: fromWidth,
      height: fromHeight
    },
    animate: {
      ...step.animate,
      x: toX,
      y: toY,
      width: toWidth,
      height: toHeight
    }
  };
  const fromOpacity = numberValue(resolvedStep.initial, "opacity", 1);
  const toOpacity = numberValue(resolvedStep.animate, "opacity", 1);

  return `${layerSelector("mc-zero-layer-from", nodeId)}{animation:${animationDeclaration(resolvedStep, name, startMs)};will-change:transform,width,height,opacity;}
${matchedKeyframes(
  resolvedStep,
  name,
  { x: 0, y: 0, width: fromWidth, height: fromHeight, opacity: fromOpacity, rotation: 0 },
  { x: toX, y: toY, width: toWidth, height: toHeight, opacity: toOpacity, rotation: 0 }
)}
${matchedSkinCss(source, binding, { delayMs: startMs, durationMs: resolvedStep.durationMs }, index)}`;
}

function enterCss(nodeId: string, step: CompositionStep | undefined, startMs: number, index: number): string {
  if (!step) return "";
  const name = `mc-zero-layer-enter-${index}-${cssIdent(nodeId)}`;
  const fromWidth = numberValue(step.initial, "width", numberValue(step.animate, "width", 0));
  const fromHeight = numberValue(step.initial, "height", numberValue(step.animate, "height", 0));
  const toWidth = numberValue(step.animate, "width", fromWidth);
  const toHeight = numberValue(step.animate, "height", fromHeight);
  return `${layerSelector("mc-zero-layer-to", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;overflow:hidden;${transformOriginCss(step)}}
@keyframes ${name}{
  from{transform:${transformValue(step.initial, 0, 0)};width:${px(fromWidth)};height:${px(fromHeight)};opacity:${numberValue(step.initial, "opacity", 0)};}
  to{transform:${transformValue(step.animate, 0, 0)};width:${px(toWidth)};height:${px(toHeight)};opacity:${numberValue(step.animate, "opacity", 1)};}
}`;
}

function exitCss(nodeId: string, step: CompositionStep | undefined, startMs: number, index: number): string {
  if (!step) return "";
  const name = `mc-zero-layer-exit-${index}-${cssIdent(nodeId)}`;
  const fromWidth = numberValue(step.initial, "width", numberValue(step.animate, "width", 0));
  const fromHeight = numberValue(step.initial, "height", numberValue(step.animate, "height", 0));
  const toWidth = numberValue(step.animate, "width", fromWidth);
  const toHeight = numberValue(step.animate, "height", fromHeight);
  return `${layerSelector("mc-zero-layer-from", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;overflow:hidden;${transformOriginCss(step)}}
@keyframes ${name}{
  from{transform:${transformValue(step.initial, 0, 0)};width:${px(fromWidth)};height:${px(fromHeight)};opacity:${numberValue(step.initial, "opacity", 1)};}
  to{transform:${transformValue(step.animate, 0, 0)};width:${px(toWidth)};height:${px(toHeight)};opacity:${numberValue(step.animate, "opacity", 0)};}
}`;
}

function motionCss(
  source: ZeroLayerMorphSource,
  track: CompositionTrack,
  excludedLayerIds: ReadonlySet<string> = new Set(),
  fallbackDurationMs = Math.max(1, track.totalDurationMs)
): string {
  const byLayer = stepByLayerId(track);
  const windows = stepWindowById(track);
  const rules: string[] = [];
  source.bindingResult.bindings.forEach((binding, index) => {
    const step = excludedLayerIds.has(binding.layerId)
      ? undefined
      : (byLayer.get(binding.layerId) ?? fallbackMatchedStep(source, binding, fallbackDurationMs, index));
    rules.push(matchedCss(source, binding, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  source.bindingResult.exit.forEach((node, index) => {
    const layerId = layerIdFromNodeId(node.nodeId);
    const step = excludedLayerIds.has(layerId)
      ? undefined
      : (byLayer.get(layerId) ?? fallbackNodeStep(source, node, "from", fallbackDurationMs, index));
    rules.push(exitCss(node.nodeId, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  source.bindingResult.enter.forEach((node, index) => {
    const layerId = layerIdFromNodeId(node.nodeId);
    const step = excludedLayerIds.has(layerId)
      ? undefined
      : (byLayer.get(layerId) ?? fallbackNodeStep(source, node, "to", fallbackDurationMs, index));
    rules.push(enterCss(node.nodeId, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  return rules.filter(Boolean).join("\n");
}

function radiusValue(node: ZeroLayerNode): string {
  return node.kind === "ellipse" ? "50%" : px(node.cornerRadius ?? 0);
}

function matchedSkinCss(
  source: ZeroLayerMorphSource,
  binding: ZeroLayerMotionBinding,
  timing: LayerMotionTrack["timing"],
  index: number
): string {
  const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
  const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
  if (!fromNode || !toNode) return "";
  const from = resolveZeroLayerNodeOverride(fromNode, source.nodeOverrides, "from");
  const to = resolveZeroLayerNodeOverride(toNode, source.nodeOverrides, "to");
  const fromAssets = new Map(source.from.assets.map((asset) => [asset.id, asset]));
  const toAssets = new Map(source.to.assets.map((asset) => [asset.id, asset]));
  const appearanceDiffers = zeroLayerAppearanceDiffers(from, to, fromAssets, toAssets);
  const fromName = `mc-zero-layer-skin-from-${index}-${cssIdent(binding.nodeId)}`;
  const toName = `mc-zero-layer-skin-to-${index}-${cssIdent(binding.toNodeId)}`;
  const singleName = `mc-zero-layer-skin-single-${index}-${cssIdent(binding.nodeId)}`;
  const selector = layerSelector("mc-zero-layer-from", binding.nodeId);
  const animation = (name: string) =>
    `${name} ${timing.durationMs}ms linear calc(${timing.delayMs}ms - var(--mc-zero-layer-time,0ms)) both`;
  const fromRotation = from.rotation ?? 0;
  const toRotation = to.rotation ?? fromRotation;
  const fromRadius = radiusValue(from);
  const toRadius = radiusValue(to);
  if (!appearanceDiffers) {
    return `${selector}>[data-zero-layer-skin="single"]{animation:${animation(singleName)};}
@keyframes ${singleName}{
  0%{opacity:${from.opacity};transform:rotate(${fromRotation}deg);border-radius:${fromRadius};}
  100%{opacity:${to.opacity};transform:rotate(${toRotation}deg);border-radius:${toRadius};}
}`;
  }
  const start = ZERO_LAYER_SKIN_CROSSFADE.start * 100;
  const end = ZERO_LAYER_SKIN_CROSSFADE.end * 100;
  return `${selector}>[data-zero-layer-skin="from"]{animation:${animation(fromName)};}
${selector}>[data-zero-layer-skin="to"]{animation:${animation(toName)};}
@keyframes ${fromName}{
  0%{opacity:${from.opacity};transform:rotate(${fromRotation}deg);border-radius:${fromRadius};}
  ${start}%{opacity:${from.opacity};}
  ${end}%{opacity:0;}
  100%{opacity:0;transform:rotate(${toRotation}deg);border-radius:${toRadius};}
}
@keyframes ${toName}{
  0%{opacity:0;transform:rotate(${fromRotation}deg);border-radius:${fromRadius};}
  ${start}%{opacity:0;}
  ${end}%{opacity:${to.opacity};}
  100%{opacity:${to.opacity};transform:rotate(${toRotation}deg);border-radius:${toRadius};}
}`;
}

function motionPlanCss(
  source: ZeroLayerMorphSource,
  composition: CompositionTrack,
  fallbackDurationMs: number
): string {
  const plan = source.motionPlan;
  if (!plan?.tracks.length) return "";
  const plannedLayerIds = new Set(plan.tracks.map((motionTrack) => motionTrack.layerId));
  const selectorForLayer = (layerId: string): string => {
    const binding = source.bindingResult.bindings.find((item) => item.layerId === layerId);
    if (binding) return layerSelector("mc-zero-layer-from", binding.nodeId);
    const enter = source.bindingResult.enter.find((node) => layerIdFromNodeId(node.nodeId) === layerId);
    if (enter) return layerSelector("mc-zero-layer-to", enter.nodeId);
    const exit = source.bindingResult.exit.find((node) => layerIdFromNodeId(node.nodeId) === layerId);
    if (exit) return layerSelector("mc-zero-layer-from", exit.nodeId);
    return "[data-zero-layer-missing-motion-plan]";
  };
  const trackByLayerId = new Map(plan.tracks.map((item) => [item.layerId, item]));
  const skinRules = source.bindingResult.bindings
    .map((binding, index) => {
      const motionTrack = trackByLayerId.get(binding.layerId);
      return motionTrack ? matchedSkinCss(source, binding, motionTrack.timing, index) : "";
    })
    .filter(Boolean)
    .join("\n");
  const transformOrigins = composition.steps
    .filter((step) => step.layerId && step.metadata?.zeroLayerTransformOrigin)
    .map(
      (step) =>
        `${selectorForLayer(step.layerId!)}{transform-origin:${step.metadata!.zeroLayerTransformOrigin};}`
    )
    .join("\n");
  const expressionComments = [
    ...new Set(composition.steps.map((step) => zeroLayerExpressionStrategyForStep(step).id))
  ]
    .map((strategyId) => `/* zero-layer-expression:${strategyId} */`)
    .join("\n");
  const legacyFallback = motionCss(source, composition, plannedLayerIds, fallbackDurationMs);
  return `${compileMotionPlanCss(plan, {
    namePrefix: "mc-zero-layer-plan",
    selectorForLayer,
    timeVariable: "--mc-zero-layer-time"
  })}\n${skinRules}\n${transformOrigins}\n${expressionComments}\n${legacyFallback}`;
}

export function exportZeroLayerCompositionHtml(document: MotionDocument, track: CompositionTrack): string {
  const source = document.visualSource;
  if (!source || source.kind !== "zero-layer-morph") return "<!-- Zero layer visual source is empty -->";
  const motionPlan = fillMotionPlanGeometryFromComposition(source.motionPlan, track, source);
  const exportSource: ZeroLayerMorphSource = { ...source, motionPlan };
  const hasMotionPlan = motionPlan.tracks.length > 0;
  const playbackDurationMs = Math.max(
    1,
    motionPlanPlaybackDurationMs(motionPlan, track) || document.timeline.durationMs
  );

  const width = Math.max(exportSource.from.width, exportSource.to.width);
  const height = Math.max(exportSource.from.height, exportSource.to.height);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(exportSource.from.name)} → ${escapeHtml(exportSource.to.name)}</title>
  <style>
    html,body{margin:0;padding:0;background:transparent;}
    body{min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;}
    *{box-sizing:border-box;}
    .mc-zero-layer-stage{--mc-zero-layer-time:0ms;position:relative;width:${px(width)};height:${px(height)};background:transparent;overflow:visible;}
    .mc-zero-layer-stage[data-verify-progress] [data-zero-layer-id],.mc-zero-layer-stage[data-verify-progress] [data-zero-layer-skin]{animation-play-state:paused!important;}
    .mc-zero-layer-frame{position:absolute;left:0;top:0;width:${px(width)};height:${px(height)};}
    [data-zero-tail-fallback]{display:none!important;}
    [data-zero-legacy-tail]{opacity:0;}
    [data-zero-layer-id] > img,[data-zero-layer-skin] > img{display:block;width:100%;height:100%;object-fit:contain;}
    [data-zero-layer-kind="text"] span{display:block;width:100%;overflow:hidden;text-overflow:clip;white-space:pre;}
    ${hasMotionPlan ? motionPlanCss(exportSource, track, playbackDurationMs) : motionCss(exportSource, track, new Set(), playbackDurationMs)}
    @media (prefers-reduced-motion: reduce){.mc-zero-layer-from{display:none!important;}[data-zero-tail-fallback]{display:block!important;}[data-zero-legacy-tail]{opacity:1!important;}[data-zero-layer-id],[data-zero-layer-skin]{animation:none!important;}}
  </style>
</head>
<body>
  <main class="mc-zero-layer-stage" data-total-duration="${playbackDurationMs}">
    <section class="mc-zero-layer-frame mc-zero-layer-from" aria-label="${escapeHtml(exportSource.from.name)}">
${renderMotionPlanFrameHtml(exportSource, "from")}
    </section>
    <section class="mc-zero-layer-frame mc-zero-layer-to" aria-label="${escapeHtml(exportSource.to.name)}">
${renderMotionPlanFrameHtml(exportSource, "to")}
    </section>
  </main>
  <script>
    (() => {
      const stage = document.querySelector(".mc-zero-layer-stage");
      const raw = new URLSearchParams(window.location.search).get("mc-progress");
      if (!stage || raw == null) return;
      const progress = Math.min(1, Math.max(0, Number(raw)));
      const total = Number(stage.getAttribute("data-total-duration") || "0");
      stage.style.setProperty("--mc-zero-layer-time", String(Math.max(0, total * progress)) + "ms");
      stage.setAttribute("data-verify-progress", String(progress));
    })();
  </script>
</body>
</html>`;
}
