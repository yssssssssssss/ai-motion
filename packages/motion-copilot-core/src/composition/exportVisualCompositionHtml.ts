import {
  createClassicEasing,
  easingCss,
  type CompositionStep,
  type CompositionTrack,
  type MotionDocument,
  type VisualCompositionBindingSource,
  type ZeroVisualCompositionSource
} from "../schema/document";
import { computeCompositionStepWindows } from "./evaluateComposition";
import { createZeroVisualNodeOverrideCss } from "../frameMorph/createZeroVisualNodeOverrideCss";
import { ZERO_VISUAL_STAGE_ALIGNMENT_CSS } from "../frameMorph/zeroVisualStageCss";

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

function nodeSelector(layerClass: string, nodeId: string): string {
  return `.${layerClass} [data-node-id="${cssAttributeValue(nodeId)}"]`;
}

function visualLayerId(nodeId: string): string {
  return `zero-visual-${nodeId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function stepEasing(step: CompositionStep): string {
  return easingCss(step.easing ?? createClassicEasing("decelerate"));
}

function numberValue(source: Record<string, number | undefined> | undefined, key: string, fallback: number): number {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function animationDeclaration(step: CompositionStep, name: string, startMs: number): string {
  return `${name} ${step.durationMs}ms ${stepEasing(step)} calc(${startMs}ms - var(--mc-zero-time, 0ms)) both`;
}

function matchedCss(
  binding: VisualCompositionBindingSource["bindings"][number],
  step: CompositionStep | undefined,
  startMs: number,
  index: number
): string {
  const name = `mc-zero-match-${index}-${cssIdent(binding.nodeId)}-${cssIdent(binding.toNodeId)}`;
  if (!step) return "";
  const fromWidth = numberValue(step.initial, "width", binding.fromBounds.w);
  const fromHeight = numberValue(step.initial, "height", binding.fromBounds.h);
  const toX = numberValue(step.animate, "x", binding.toBounds.x - binding.fromBounds.x);
  const toY = numberValue(step.animate, "y", binding.toBounds.y - binding.fromBounds.y);
  const toWidth = numberValue(step.animate, "width", binding.toBounds.w);
  const toHeight = numberValue(step.animate, "height", binding.toBounds.h);
  const toOpacity = numberValue(step.animate, "opacity", 1);

  return `${nodeSelector("mc-zero-to", binding.toNodeId)}{display:none!important;}
${nodeSelector("mc-zero-from", binding.nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,width,height,opacity;}
@keyframes ${name}{
  from{transform:translate(0px,0px);width:${fromWidth}px;height:${fromHeight}px;opacity:1;}
  to{transform:translate(${toX}px,${toY}px);width:${toWidth}px;height:${toHeight}px;opacity:${toOpacity};}
}`;
}

function enterCss(nodeId: string, step: CompositionStep | undefined, startMs: number, index: number): string {
  const name = `mc-zero-enter-${index}-${cssIdent(nodeId)}`;
  if (!step) return "";
  const fromY = numberValue(step.initial, "y", 0);
  const fromOpacity = numberValue(step.initial, "opacity", 0);
  const toY = numberValue(step.animate, "y", 0);
  const toOpacity = numberValue(step.animate, "opacity", 1);

  return `${nodeSelector("mc-zero-to", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,opacity;}
@keyframes ${name}{
  from{transform:translate(0px,${fromY}px);opacity:${fromOpacity};}
  to{transform:translate(0px,${toY}px);opacity:${toOpacity};}
}`;
}

function exitCss(nodeId: string, step: CompositionStep | undefined, startMs: number, index: number): string {
  const name = `mc-zero-exit-${index}-${cssIdent(nodeId)}`;
  if (!step) return "";
  const toY = numberValue(step.animate, "y", 0);
  const toOpacity = numberValue(step.animate, "opacity", 0);

  return `${nodeSelector("mc-zero-from", nodeId)}{animation:${animationDeclaration(step, name, startMs)};will-change:transform,opacity;}
@keyframes ${name}{
  from{transform:translate(0px,0px);opacity:1;}
  to{transform:translate(0px,${toY}px);opacity:${toOpacity};}
}`;
}

function ignoredCss(nodeId: string, durationMs: number, index: number): string {
  const name = `mc-zero-ignored-${index}-${cssIdent(nodeId)}`;
  const duration = Math.max(1, durationMs);
  return `${nodeSelector("mc-zero-from", nodeId)}{animation:${name} ${duration}ms ease calc(0ms - var(--mc-zero-time, 0ms)) both;will-change:opacity;}
@keyframes ${name}{
  from{opacity:1;}
  to{opacity:0;}
}`;
}

function visualMotionCss(source: ZeroVisualCompositionSource, track: CompositionTrack): string {
  const byLayer = stepByLayerId(track);
  const windows = stepWindowById(track);
  const rules: string[] = [];

  source.bindingResult.bindings.forEach((binding, index) => {
    const step = byLayer.get(visualLayerId(binding.nodeId));
    const startMs = step ? (windows.get(step.id)?.start ?? 0) : 0;
    rules.push(matchedCss(binding, step, startMs, index));
  });

  source.bindingResult.exit.forEach((node, index) => {
    const step = byLayer.get(visualLayerId(node.nodeId));
    const startMs = step ? (windows.get(step.id)?.start ?? 0) : 0;
    rules.push(exitCss(node.nodeId, step, startMs, index));
  });

  source.bindingResult.enter.forEach((node, index) => {
    const step = byLayer.get(visualLayerId(node.nodeId));
    const startMs = step ? (windows.get(step.id)?.start ?? 0) : 0;
    rules.push(enterCss(node.nodeId, step, startMs, index));
  });

  (source.bindingResult.ignored ?? []).forEach((item, index) => {
    rules.push(ignoredCss(item.nodeId, track.totalDurationMs, index));
  });

  return rules.filter(Boolean).join("\n");
}

export function exportVisualCompositionHtml(document: MotionDocument, track: CompositionTrack): string {
  const source = document.visualSource;
  if (!source || source.kind !== "zero-visual-morph") return "<!-- 高保真视觉源为空 -->";

  const width = Math.max(source.from.width, source.to.width);
  const height = Math.max(source.from.height, source.to.height);
  const overrideCss = [
    createZeroVisualNodeOverrideCss(source.nodeOverrides, source.from.nodes, ".mc-zero-from"),
    createZeroVisualNodeOverrideCss(source.nodeOverrides, source.to.nodes, ".mc-zero-to")
  ]
    .filter(Boolean)
    .join("\n");
  const motionCss = visualMotionCss(source, track);

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
    .mc-zero-stage{--mc-zero-time:0ms;position:relative;width:${width}px;height:${height}px;background:transparent;overflow:visible;}
    .mc-zero-stage[data-verify-progress] [data-node-id]{animation-play-state:paused!important;}
    .mc-zero-layer{position:absolute;left:0;top:0;width:${width}px;height:${height}px;transform-origin:left top;}
    .mc-zero-layer iframe{border:0;}
    ${source.from.css}
    ${source.to.css}
    ${ZERO_VISUAL_STAGE_ALIGNMENT_CSS}
    ${overrideCss}
    ${motionCss}
    .mc-zero-replay{position:fixed;right:16px;bottom:16px;width:44px;height:44px;border-radius:50%;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:22px;cursor:pointer;display:grid;place-items:center;z-index:9999;transition:opacity 0.2s;}
    .mc-zero-replay:hover{background:rgba(0,0,0,0.8);}
    @media (prefers-reduced-motion: reduce){[data-node-id]{animation:none!important;}.mc-zero-replay{display:none;}}
  </style>
</head>
<body>
  <main class="mc-zero-stage" data-total-duration="${track.totalDurationMs}">
    <section class="mc-zero-layer mc-zero-from" aria-label="${escapeHtml(source.from.name)}">
${source.from.html}
    </section>
    <section class="mc-zero-layer mc-zero-to" aria-label="${escapeHtml(source.to.name)}">
${source.to.html}
    </section>
  </main>
  <script>
    (() => {
      const stage = document.querySelector(".mc-zero-stage");
      const raw = new URLSearchParams(window.location.search).get("mc-progress");
      if (!stage || raw == null) return;
      const progress = Math.min(1, Math.max(0, Number(raw)));
      const total = Number(stage.getAttribute("data-total-duration") || "0");
      stage.style.setProperty("--mc-zero-time", String(Math.max(0, total * progress)) + "ms");
      stage.setAttribute("data-verify-progress", String(progress));
    })();
  </script>
  <script>
    (() => {
      if (new URLSearchParams(window.location.search).has("mc-progress")) return;
      const stage = document.querySelector(".mc-zero-stage");
      if (!stage) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mc-zero-replay";
      btn.setAttribute("aria-label", "重播");
      btn.textContent = "\\u21BB";
      document.body.appendChild(btn);
      btn.addEventListener("click", function() {
        stage.querySelectorAll("[data-node-id]").forEach(function(n) {
          n.style.animation = "none";
          void n.offsetWidth;
          n.style.animation = "";
        });
      });
    })();
  </script>${source.restorationReportCache ? `\n  <script type="application/json" id="motion-report">${JSON.stringify(source.restorationReportCache.report).replaceAll("</", "<\\/")}</script>` : ""}
</body>
</html>`;
}
