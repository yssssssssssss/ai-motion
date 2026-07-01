import {
  easingCss,
  type CompositionStep,
  type CompositionTrack,
  type MotionDocument,
  type MotionLayer
} from "../schema/document";
import { computeCompositionStepWindows } from "./evaluateComposition";

function layerCss(layer: MotionLayer): string {
  const parts: string[] = [];
  const layout = layer.layout;
  if (layout) {
    parts.push(`left:${layout.x}px`);
    parts.push(`top:${layout.y}px`);
    parts.push(`width:${layout.width}px`);
    parts.push(`height:${layout.height}px`);
    if (layout.zIndex != null) parts.push(`z-index:${layout.zIndex}`);
  }
  const style = layer.style;
  if (style) {
    if (style.background) parts.push(`background:${style.background}`);
    if (style.color) parts.push(`color:${style.color}`);
    if (style.borderColor) parts.push(`border-color:${style.borderColor}`);
    if (style.borderWidth != null) parts.push(`border-width:${style.borderWidth}px`, "border-style:solid");
    if (style.boxShadow) parts.push(`box-shadow:${style.boxShadow}`);
    if (style.fontFamily) parts.push(`font-family:${style.fontFamily}`);
    if (style.textDecoration) parts.push(`text-decoration:${style.textDecoration}`);
    if (style.radius != null) parts.push(`border-radius:${style.radius}px`);
    if (style.fontSize != null) parts.push(`font-size:${style.fontSize}px`);
    if (style.fontWeight != null) parts.push(`font-weight:${style.fontWeight}`);
    if (style.lineHeight != null) parts.push(`line-height:${style.lineHeight}`);
    if (style.opacity != null) parts.push(`opacity:${style.opacity}`);
    if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  }
  parts.push("position:absolute", "box-sizing:border-box", "overflow:hidden");
  return parts.join(";");
}

function layerContent(layer: MotionLayer): string {
  if (layer.content?.src) {
    return `<img src="${layer.content.src}" alt="${layer.content.alt ?? ""}" style="width:100%;height:100%;object-fit:${layer.style?.fit ?? "cover"};object-position:${layer.style?.position ?? "center"}" />`;
  }
  if (layer.content?.text) {
    return layer.content.text;
  }
  return "";
}

function stepKeyframeName(step: CompositionStep, index: number): string {
  return `fm-${index}`;
}

function buildKeyframe(step: CompositionStep, index: number): string {
  const name = stepKeyframeName(step, index);
  const initial = step.initial ?? {};
  const animate = step.animate ?? {};

  const fromParts: string[] = [];
  const toParts: string[] = [];

  const fromX = initial.x ?? 0;
  const fromY = initial.y ?? 0;
  const fromScale = initial.scale ?? 1;
  const fromRotate = initial.rotate ?? 0;
  const toX = animate.x ?? 0;
  const toY = animate.y ?? 0;
  const toScale = animate.scale ?? 1;
  const toRotate = animate.rotate ?? 0;

  fromParts.push(`transform:translate(${fromX}px,${fromY}px) scale(${fromScale}) rotate(${fromRotate}deg)`);
  toParts.push(`transform:translate(${toX}px,${toY}px) scale(${toScale}) rotate(${toRotate}deg)`);

  if (initial.opacity != null) fromParts.push(`opacity:${initial.opacity}`);
  if (animate.opacity != null) toParts.push(`opacity:${animate.opacity}`);

  const fromBlur = initial.blur ?? 0;
  const toBlur = animate.blur ?? 0;
  if (fromBlur > 0 || toBlur > 0) {
    fromParts.push(`filter:blur(${fromBlur}px)`);
    toParts.push(`filter:blur(${toBlur}px)`);
  }

  if (initial.width != null && animate.width != null && initial.width !== animate.width) {
    fromParts.push(`width:${initial.width}px`);
    toParts.push(`width:${animate.width}px`);
  }
  if (initial.height != null && animate.height != null && initial.height !== animate.height) {
    fromParts.push(`height:${initial.height}px`);
    toParts.push(`height:${animate.height}px`);
  }

  return `@keyframes ${name}{from{${fromParts.join(";")}}to{${toParts.join(";")}}}`;
}

export function exportFrameMorphCompositionHtml(document: MotionDocument, track: CompositionTrack): string {
  const { steps } = track;
  if (steps.length === 0) return "<!-- 帧间组合为空 -->";

  const layerMap = new Map(document.layers.map((l) => [l.id, l]));
  const windows = computeCompositionStepWindows(steps);

  const keyframes = steps.map((step, i) => buildKeyframe(step, i)).join("\n");

  const layerAnimations = new Map<string, string[]>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const win = windows[i]!;
    const layerId = step.layerId;
    if (!layerId) continue;
    const easing = step.easing ? easingCss(step.easing) : "cubic-bezier(0.18,0.86,0.22,1)";
    const animation = `${stepKeyframeName(step, i)} ${step.durationMs}ms ${easing} ${win.start}ms both`;
    const existing = layerAnimations.get(layerId) ?? [];
    existing.push(animation);
    layerAnimations.set(layerId, existing);
  }

  const stageW = document.stage.width;
  const stageH = document.stage.height;
  const stageBg = document.stage.background || "transparent";

  const layerHtmlParts: string[] = [];
  for (const layer of document.layers) {
    if (layer.hidden) continue;
    const animations = layerAnimations.get(layer.id);
    const animStyle = animations ? `animation:${animations.join(",")};will-change:transform,opacity` : "";
    const inlineStyle = layerCss(layer) + (animStyle ? ";" + animStyle : "");
    layerHtmlParts.push(
      `    <div class="fm-layer" data-layer-id="${layer.id}" style="${inlineStyle}">${layerContent(layer)}</div>`
    );
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>帧间动效</title>
<style>
*{margin:0;padding:0}
body{min-height:100vh;display:grid;place-items:center;background:#f0f2f5;font-family:system-ui,-apple-system,sans-serif}
.fm-stage{position:relative;width:${stageW}px;height:${stageH}px;background:${stageBg};overflow:hidden;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12)}
.fm-layer{display:flex;align-items:center;justify-content:center}
.fm-replay{position:fixed;right:16px;bottom:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(0,0,0,0.7);color:#fff;font-size:20px;cursor:pointer;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:background 0.2s}
.fm-replay:hover{background:rgba(0,0,0,0.85)}
${keyframes}
@media(prefers-reduced-motion:reduce){.fm-layer{animation:none!important}}
</style>
</head>
<body>
<div class="fm-stage">
${layerHtmlParts.join("\n")}
</div>
<button type="button" class="fm-replay" aria-label="重播">↻</button>
<script>
(()=>{
  const stage=document.querySelector(".fm-stage");
  const btn=document.querySelector(".fm-replay");
  if(!stage||!btn)return;
  btn.addEventListener("click",()=>{
    const nodes=stage.querySelectorAll(".fm-layer");
    nodes.forEach(n=>{n.style.animation="none";void n.offsetWidth});
    nodes.forEach(n=>{n.style.animation=""});
  });
})();
</script>
</body>
</html>`;
}
