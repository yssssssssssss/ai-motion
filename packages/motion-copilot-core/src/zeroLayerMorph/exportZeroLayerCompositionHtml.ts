import {
  createClassicEasing,
  easingCss,
  type CompositionStep,
  type CompositionTrack,
  type MotionDocument,
  type MotionState
} from "../schema/document";
import { computeCompositionStepWindows } from "../composition/evaluateComposition";
import type {
  ZeroLayerAsset,
  ZeroLayerMorphSource,
  ZeroLayerNode,
  ZeroLayerNodeOverride,
  ZeroLayerSnapshot
} from "./schema";

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

function solidColorCss(color: string, opacity: number | undefined): string {
  if (opacity == null || opacity >= 1) return color;
  if (opacity <= 0) return "transparent";
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1]!;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity})`;
}

function layerSelector(layerClass: string, nodeId: string): string {
  return `.${layerClass} [data-zero-layer-id="${cssAttributeValue(nodeId)}"]`;
}

function fillCss(layer: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>): string {
  const fill = layer.fills?.[0];
  if (!fill) return "";
  if (fill.type === "solid") {
    const property = layer.kind === "text" ? "color" : "background";
    return `${property}:${solidColorCss(fill.color, fill.opacity)};`;
  }
  if (fill.type === "gradient" && fill.css) return `background:${fill.css};`;
  if (fill.type === "image" && fill.assetId) {
    const asset = assets.get(fill.assetId);
    return asset ? `background:url("${cssAttributeValue(asset.url)}") center/cover no-repeat;` : "";
  }
  return "";
}

function strokeCss(layer: ZeroLayerNode): string {
  const stroke = layer.strokes?.[0];
  if (!stroke) return "";
  return `border:${px(stroke.width ?? 1)} solid ${stroke.color};`;
}

function effectCss(layer: ZeroLayerNode): string {
  return (
    layer.effects
      ?.map((effect) => effect.css)
      .filter(Boolean)
      .join(";") ?? ""
  );
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

function layerStyle(layer: ZeroLayerNode, assets: Map<string, ZeroLayerAsset>): string {
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
    fillCss(layer, assets),
    strokeCss(layer),
    effectCss(layer),
    layer.kind === "text" ? "display:flex;align-items:center" : "",
    layer.textStyle?.fontFamily ? `font-family:${layer.textStyle.fontFamily}` : "",
    layer.textStyle?.fontSize != null ? `font-size:${px(layer.textStyle.fontSize)}` : "",
    layer.textStyle?.fontWeight != null ? `font-weight:${layer.textStyle.fontWeight}` : "",
    layer.textStyle?.lineHeight != null ? `line-height:${px(layer.textStyle.lineHeight)}` : "",
    layer.textStyle?.textAlign ? `text-align:${layer.textStyle.textAlign}` : ""
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
      const content = asset
        ? `<img src="${escapeHtml(asset.url)}" alt="" />`
        : layer.text
          ? `<span>${escapeHtml(layer.text)}</span>`
          : "";
      return `<div data-zero-layer-id="${escapeHtml(layer.nodeId)}" data-zero-layer-kind="${escapeHtml(layer.kind)}" style="${layerStyle(layer, assets)}">${content}</div>`;
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

function transformValue(state: MotionState | undefined, fallbackX: number, fallbackY: number): string {
  const x = numberValue(state, "x", fallbackX);
  const y = numberValue(state, "y", fallbackY);
  const scale = numberValue(state, "scale", 1);
  const rotate = numberValue(state, "rotate", 0);
  return `translate(${px(x)},${px(y)}) scale(${scale}) rotate(${rotate}deg)`;
}

function animationDeclaration(step: CompositionStep, name: string, startMs: number): string {
  const easing = easingCss(step.easing ?? createClassicEasing("decelerate"));
  return `${name} ${step.durationMs}ms ${easing} calc(${startMs}ms - var(--mc-zero-layer-time, 0ms)) both`;
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
  const toOpacity = numberValue(step.animate, "opacity", resolvedOpacity(source, toNodeId, "to"));
  const fromTransform = transformValue(step.initial, 0, 0);
  const toTransform = transformValue(step.animate, toX, toY);
  const tailName = `mc-zero-layer-tail-${index}-${cssIdent(toNodeId)}`;
  const tailOpacity = resolvedOpacity(source, toNodeId, "to");

  return `${layerSelector("mc-zero-layer-to", toNodeId)}{animation:${animationDeclaration(
    step,
    tailName,
    startMs
  )};will-change:opacity;}
${layerSelector("mc-zero-layer-from", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;}
@keyframes ${name}{
  from{transform:${fromTransform};width:${px(
    numberValue(step.initial, "width", fromWidth)
  )};height:${px(numberValue(step.initial, "height", fromHeight))};opacity:${numberValue(
    step.initial,
    "opacity",
    fromOpacity
  )};}
  to{transform:${toTransform};width:${px(numberValue(step.animate, "width", toWidth))};height:${px(
    numberValue(step.animate, "height", toHeight)
  )};opacity:${toOpacity};}
}
@keyframes ${tailName}{
  0%,99.8%{opacity:0;}
  100%{opacity:${tailOpacity};}
}`;
}

function enterCss(nodeId: string, step: CompositionStep | undefined, startMs: number, index: number): string {
  if (!step) return "";
  const name = `mc-zero-layer-enter-${index}-${cssIdent(nodeId)}`;
  return `${layerSelector("mc-zero-layer-to", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,opacity;}
@keyframes ${name}{
  from{transform:${transformValue(step.initial, 0, 0)};opacity:${numberValue(step.initial, "opacity", 0)};}
  to{transform:${transformValue(step.animate, 0, 0)};opacity:${numberValue(step.animate, "opacity", 1)};}
}`;
}

function exitCss(nodeId: string, step: CompositionStep | undefined, startMs: number, index: number): string {
  if (!step) return "";
  const name = `mc-zero-layer-exit-${index}-${cssIdent(nodeId)}`;
  return `${layerSelector("mc-zero-layer-from", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,opacity;}
@keyframes ${name}{
  from{transform:${transformValue(step.initial, 0, 0)};opacity:${numberValue(step.initial, "opacity", 1)};}
  to{transform:${transformValue(step.animate, 0, 0)};opacity:${numberValue(step.animate, "opacity", 0)};}
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
    const step = byLayer.get(`zero-layer-${cssIdent(node.nodeId).toLowerCase()}`);
    rules.push(exitCss(node.nodeId, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  source.bindingResult.enter.forEach((node, index) => {
    const step = byLayer.get(`zero-layer-${cssIdent(node.nodeId).toLowerCase()}`);
    rules.push(enterCss(node.nodeId, step, step ? (windows.get(step.id)?.start ?? 0) : 0, index));
  });
  return rules.filter(Boolean).join("\n");
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
    ${motionCss(source, track)}
    @media (prefers-reduced-motion: reduce){[data-zero-layer-id]{animation:none!important;}}
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
