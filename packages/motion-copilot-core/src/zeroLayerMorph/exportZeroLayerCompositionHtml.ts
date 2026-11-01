import {
  createClassicEasing,
  easingCss,
  type CompositionStep,
  type CompositionTrack,
  type MotionDocument,
  type MotionState
} from "../schema/document";
import { computeCompositionStepWindows } from "../composition/evaluateComposition";
import { compileMotionPlanCss } from "./motionPlanRuntime";
import { layerIdFromNodeId } from "./layerId";
import type {
  LayerMotionTrack,
  ZeroLayerAsset,
  ZeroLayerMorphSource,
  ZeroLayerNode,
  ZeroLayerNodeOverride,
  ZeroLayerSnapshot
} from "./schema";
import { zeroLayerExpressionStrategyForStep } from "./zeroLayerExpressionStrategies";
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

function overrideFor(
  nodeId: string,
  overrides: ZeroLayerNodeOverride[] | undefined,
  frame: RenderFrame
): ZeroLayerNodeOverride | undefined {
  return overrides?.find(
    (override) => override.nodeId === nodeId && (override.frame === frame || override.frame === "both")
  );
}

function resolveLayer(
  layer: ZeroLayerNode,
  overrides: ZeroLayerNodeOverride[] | undefined,
  frame: RenderFrame
): ZeroLayerNode {
  const override = overrideFor(layer.nodeId, overrides, frame);
  if (!override) return layer;
  return {
    ...layer,
    bounds: {
      x: override.x ?? layer.bounds.x,
      y: override.y ?? layer.bounds.y,
      w: override.width ?? layer.bounds.w,
      h: override.height ?? layer.bounds.h
    },
    opacity: override.opacity ?? layer.opacity,
    ...(override.cornerRadius != null ? { cornerRadius: override.cornerRadius } : {})
  };
}

function resolvedBounds(
  source: ZeroLayerMorphSource,
  nodeId: string,
  frame: RenderFrame
): { x: number; y: number; w: number; h: number } | undefined {
  const snapshot = frame === "from" ? source.from : source.to;
  const layer = snapshot.layers.find((item) => item.nodeId === nodeId);
  return layer ? resolveLayer(layer, source.nodeOverrides, frame).bounds : undefined;
}

function resolvedOpacity(source: ZeroLayerMorphSource, nodeId: string, frame: RenderFrame): number {
  const snapshot = frame === "from" ? source.from : source.to;
  const layer = snapshot.layers.find((item) => item.nodeId === nodeId);
  return layer ? resolveLayer(layer, source.nodeOverrides, frame).opacity : 1;
}

function resolvedRotation(source: ZeroLayerMorphSource, nodeId: string, frame: RenderFrame): number {
  const snapshot = frame === "from" ? source.from : source.to;
  const layer = snapshot.layers.find((item) => item.nodeId === nodeId);
  return layer ? (resolveLayer(layer, source.nodeOverrides, frame).rotation ?? 0) : 0;
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

export function renderZeroLayerSnapshotHtml(
  snapshot: ZeroLayerSnapshot,
  frame: RenderFrame,
  overrides?: ZeroLayerNodeOverride[]
): string {
  const assets = new Map(snapshot.assets.map((asset) => [asset.id, asset]));
  return snapshot.layers
    .filter((layer) => layer.visible)
    .map((layer) => resolveLayer(layer, overrides, frame))
    .map((layer) => {
      const asset = layer.assetId ? assets.get(layer.assetId) : undefined;
      const content =
        asset && (layer.renderMode === "image" || layer.kind === "image")
          ? `<img src="${escapeHtml(asset.url)}" alt="" />`
          : layer.text
            ? `<span>${escapeHtml(layer.text)}</span>`
            : "";
      return `<div data-zero-layer-id="${escapeHtml(layer.nodeId)}" data-zero-layer-kind="${escapeHtml(layer.kind)}" style="${escapeHtml(layerStyle(layer, assets))}">${content}</div>`;
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

function matchedCss(
  source: ZeroLayerMorphSource,
  step: CompositionStep | undefined,
  startMs: number,
  index: number,
  nodeId: string,
  toNodeId: string
): string {
  if (!step) return "";
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
  const fromOpacity = resolvedOpacity(source, nodeId, "from");
  const fromRotation = resolvedRotation(source, nodeId, "from");
  const toRotation = resolvedRotation(source, toNodeId, "to");
  const toOpacity = numberValue(step.animate, "opacity", resolvedOpacity(source, toNodeId, "to"));
  const tailName = `mc-zero-layer-tail-${index}-${cssIdent(toNodeId)}`;
  const tailOpacity = resolvedOpacity(source, toNodeId, "to");

  return `${layerSelector("mc-zero-layer-to", toNodeId)}{animation:${animationDeclaration(
    step,
    tailName,
    startMs
  )};will-change:opacity;}
${layerSelector("mc-zero-layer-from", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;}
${matchedKeyframes(
  step,
  name,
  { x: 0, y: 0, width: fromWidth, height: fromHeight, opacity: fromOpacity, rotation: fromRotation },
  { x: toX, y: toY, width: toWidth, height: toHeight, opacity: toOpacity, rotation: toRotation }
)}
@keyframes ${tailName}{
  0%,99.8%{opacity:0;}
  100%{opacity:${tailOpacity};}
}`;
}

function enterCss(
  source: ZeroLayerMorphSource,
  nodeId: string,
  step: CompositionStep | undefined,
  startMs: number,
  index: number
): string {
  if (!step) return "";
  const name = `mc-zero-layer-enter-${index}-${cssIdent(nodeId)}`;
  const fromWidth = numberValue(step.initial, "width", numberValue(step.animate, "width", 0));
  const fromHeight = numberValue(step.initial, "height", numberValue(step.animate, "height", 0));
  const toWidth = numberValue(step.animate, "width", fromWidth);
  const toHeight = numberValue(step.animate, "height", fromHeight);
  const rotation = resolvedRotation(source, nodeId, "to");
  return `${layerSelector("mc-zero-layer-to", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;overflow:hidden;${transformOriginCss(step)}}
@keyframes ${name}{
  from{transform:${transformValue(step.initial, 0, 0, rotation)};width:${px(fromWidth)};height:${px(fromHeight)};opacity:${numberValue(step.initial, "opacity", 0)};}
  to{transform:${transformValue(step.animate, 0, 0, rotation)};width:${px(toWidth)};height:${px(toHeight)};opacity:${numberValue(step.animate, "opacity", 1)};}
}`;
}

function exitCss(
  source: ZeroLayerMorphSource,
  nodeId: string,
  step: CompositionStep | undefined,
  startMs: number,
  index: number
): string {
  if (!step) return "";
  const name = `mc-zero-layer-exit-${index}-${cssIdent(nodeId)}`;
  const fromWidth = numberValue(step.initial, "width", numberValue(step.animate, "width", 0));
  const fromHeight = numberValue(step.initial, "height", numberValue(step.animate, "height", 0));
  const toWidth = numberValue(step.animate, "width", fromWidth);
  const toHeight = numberValue(step.animate, "height", fromHeight);
  const rotation = resolvedRotation(source, nodeId, "from");
  return `${layerSelector("mc-zero-layer-from", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;overflow:hidden;${transformOriginCss(step)}}
@keyframes ${name}{
  from{transform:${transformValue(step.initial, 0, 0, rotation)};width:${px(fromWidth)};height:${px(fromHeight)};opacity:${numberValue(step.initial, "opacity", 1)};}
  to{transform:${transformValue(step.animate, 0, 0, rotation)};width:${px(toWidth)};height:${px(toHeight)};opacity:${numberValue(step.animate, "opacity", 0)};}
}`;
}

function motionCss(source: ZeroLayerMorphSource, track: CompositionTrack): string {
  const byLayer = stepByLayerId(track);
  const windows = stepWindowById(track);
  const rules: string[] = [];
  source.bindingResult.bindings.forEach((binding, index) => {
    const step = byLayer.get(binding.layerId);
    rules.push(
      matchedCss(
        source,
        step,
        step ? (windows.get(step.id)?.start ?? 0) : 0,
        index,
        binding.nodeId,
        binding.toNodeId
      )
    );
  });
  source.bindingResult.exit.forEach((node, index) => {
    const step = byLayer.get(layerIdFromNodeId(node.nodeId));
    rules.push(exitCss(source, node.nodeId, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  source.bindingResult.enter.forEach((node, index) => {
    const step = byLayer.get(layerIdFromNodeId(node.nodeId));
    rules.push(enterCss(source, node.nodeId, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  return rules.filter(Boolean).join("\n");
}

function needsGenericMotionPlanRuntime(track: LayerMotionTrack): boolean {
  return track.source !== "rule" || Boolean(track.path) || track.physics?.type === "spring";
}

function motionPlanCss(source: ZeroLayerMorphSource, track: CompositionTrack): string {
  const plan = source.motionPlan;
  if (!plan?.tracks.length) return "";
  const stageDurationMs = Math.max(plan.stageDurationMs, track.totalDurationMs);
  const genericTracks = plan.tracks.filter(needsGenericMotionPlanRuntime);
  const genericLayerIds = new Set(genericTracks.map((item) => item.layerId));
  const strategyLayerIds = new Set(
    plan.tracks.filter((item) => !needsGenericMotionPlanRuntime(item)).map((item) => item.layerId)
  );
  const strategyTrack: CompositionTrack = {
    ...track,
    steps: track.steps.filter((step) => step.layerId && strategyLayerIds.has(step.layerId))
  };
  const selectorForLayer = (layerId: string): string => {
    const binding = source.bindingResult.bindings.find((item) => item.layerId === layerId);
    if (binding) return layerSelector("mc-zero-layer-from", binding.nodeId);
    const enter = source.bindingResult.enter.find((node) => layerIdFromNodeId(node.nodeId) === layerId);
    if (enter) return layerSelector("mc-zero-layer-to", enter.nodeId);
    const exit = source.bindingResult.exit.find((node) => layerIdFromNodeId(node.nodeId) === layerId);
    if (exit) return layerSelector("mc-zero-layer-from", exit.nodeId);
    return "[data-zero-layer-missing-motion-plan]";
  };
  const tailRules = source.bindingResult.bindings
    .filter((binding) => genericLayerIds.has(binding.layerId))
    .map((binding, index) => {
      const name = `mc-zero-layer-plan-tail-${index}-${cssIdent(binding.toNodeId)}`;
      return `${layerSelector("mc-zero-layer-to", binding.toNodeId)}{animation:${name} ${stageDurationMs}ms linear calc(0ms - var(--mc-zero-layer-time, 0ms)) both;}
@keyframes ${name}{0%,99.8%{opacity:0;}100%{opacity:${resolvedOpacity(source, binding.toNodeId, "to")};}}`;
    })
    .join("\n");
  const sourceTail = genericTracks.length
    ? [
        "@keyframes mc-zero-layer-plan-source-tail{0%,99.8%{visibility:visible;}100%{visibility:hidden;}}",
        ".mc-zero-layer-from{animation:mc-zero-layer-plan-source-tail " +
          stageDurationMs +
          "ms linear calc(0ms - var(--mc-zero-layer-time, 0ms)) both;}"
      ].join("\n")
    : "";
  return `${motionCss(source, strategyTrack)}\n${compileMotionPlanCss(
    { ...plan, tracks: genericTracks },
    {
      namePrefix: "mc-zero-layer-plan",
      selectorForLayer,
      timeVariable: "--mc-zero-layer-time"
    }
  )}\n${tailRules}\n${sourceTail}`;
}

export function exportZeroLayerCompositionHtml(document: MotionDocument, track: CompositionTrack): string {
  const source = document.visualSource;
  if (!source || source.kind !== "zero-layer-morph") return "<!-- Zero layer visual source is empty -->";

  const width = Math.max(source.from.width, source.to.width);
  const height = Math.max(source.from.height, source.to.height);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(source.from.name)} → ${escapeHtml(source.to.name)}</title>
  <style>
    html,body{margin:0;padding:0;background:transparent;}
    body{min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;}
    *{box-sizing:border-box;}
    .mc-zero-layer-stage{--mc-zero-layer-time:0ms;position:relative;width:${px(width)};height:${px(height)};background:transparent;overflow:visible;}
    .mc-zero-layer-stage[data-verify-progress] [data-zero-layer-id]{animation-play-state:paused!important;}
    .mc-zero-layer-frame{position:absolute;left:0;top:0;width:${px(width)};height:${px(height)};}
    [data-zero-layer-id] > img{display:block;width:100%;height:100%;object-fit:contain;}
    [data-zero-layer-kind="text"] span{display:block;width:100%;overflow:hidden;text-overflow:clip;white-space:pre;}
    ${(source.motionPlan?.tracks.length ? motionPlanCss(source, track) : motionCss(source, track)).replaceAll("</", "\\3c /")}
    @media (prefers-reduced-motion: reduce){.mc-zero-layer-from{display:none!important;}[data-zero-layer-id]{animation:none!important;}}
  </style>
</head>
<body>
  <main class="mc-zero-layer-stage" data-total-duration="${track.totalDurationMs}">
    <section class="mc-zero-layer-frame mc-zero-layer-from" aria-label="${escapeHtml(source.from.name)}">
${renderZeroLayerSnapshotHtml(source.from, "from", source.nodeOverrides)}
    </section>
    <section class="mc-zero-layer-frame mc-zero-layer-to" aria-label="${escapeHtml(source.to.name)}">
${renderZeroLayerSnapshotHtml(source.to, "to", source.nodeOverrides)}
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
