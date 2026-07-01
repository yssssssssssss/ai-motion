import { easingCss, type EasingSpec } from "../schema/document";
import type { MorphPlan, MorphState, MorphTrack, RestorationReport } from "./schema";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeCssColor(value: string | undefined, fallback = "transparent"): string {
  const color = value?.trim() ?? "";
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (["black", "white", "transparent"].includes(color.toLowerCase())) return color;
  return fallback;
}

function safeUrl(value: string | undefined): string {
  const url = value?.trim() ?? "";
  if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[a-zA-Z0-9+/=]+$/i.test(url)) return url;
  return "";
}

function numeric(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stateCss(state: MorphState | undefined): string {
  return [
    `left:${numeric(state?.x, 0)}px;`,
    `top:${numeric(state?.y, 0)}px;`,
    `width:${Math.max(0, numeric(state?.w, 0))}px;`,
    `height:${Math.max(0, numeric(state?.h, 0))}px;`,
    `opacity:${Math.min(1, Math.max(0, numeric(state?.opacity, 1)))};`,
    `border-radius:${Math.max(0, numeric(state?.radius, 0))}px;`,
    `background:${safeCssColor(state?.background)};`,
    `color:${safeCssColor(state?.color, "#1f2328")};`
  ].join(" ");
}

function keyframeName(index: number): string {
  return `mc-morph-${index}`;
}

function trackDuration(plan: MorphPlan, track: MorphTrack): number {
  return Math.max(1, Math.round(track.timing?.durationMs ?? plan.durationMs));
}

function trackDelay(track: MorphTrack): number {
  return Math.max(0, Math.round(track.timing?.delayMs ?? 0));
}

function trackEasing(plan: MorphPlan, track: MorphTrack): EasingSpec {
  return track.timing?.easing ?? plan.easing;
}

function trackStartState(track: MorphTrack): MorphState | undefined {
  return track.from ?? track.to;
}

function trackEndState(track: MorphTrack): MorphState | undefined {
  return track.to ?? track.from;
}

function keyframes(plan: MorphPlan): string {
  return plan.tracks
    .map(
      (track, index) => `@keyframes ${keyframeName(index)} {
  from { ${stateCss(trackStartState(track))} }
  to { ${stateCss(trackEndState(track))} }
}`
    )
    .join("\n");
}

function trackContent(track: MorphTrack): string {
  const state = trackEndState(track) ?? trackStartState(track);
  const src = safeUrl(state?.assetUrl);
  if (src) return `<img src="${escapeHtml(src)}" alt="" />`;
  return escapeHtml(state?.text ?? "");
}

function trackMarkup(plan: MorphPlan, track: MorphTrack, index: number): string {
  const name = keyframeName(index);
  const duration = trackDuration(plan, track);
  const delay = trackDelay(track);
  const easing = easingCss(trackEasing(plan, track));
  const initial = stateCss(trackStartState(track));
  return `<div class="mc-morph-layer mc-morph-${track.role}" data-track-id="${escapeHtml(track.id)}" style="${initial} animation:${name} ${duration}ms ${easing} ${delay}ms both;">${trackContent(track)}</div>`;
}

export function exportMorphHtml(plan: MorphPlan, options?: { report?: RestorationReport }): string {
  const maxWidth = Math.max(
    1,
    ...plan.tracks.flatMap((track) =>
      [track.from, track.to].map((state) => numeric(state?.x, 0) + numeric(state?.w, 0))
    )
  );
  const maxHeight = Math.max(
    1,
    ...plan.tracks.flatMap((track) =>
      [track.from, track.to].map((state) => numeric(state?.y, 0) + numeric(state?.h, 0))
    )
  );
  const duration = Math.max(1, plan.durationMs);

  const reportBlock = options?.report
    ? `\n  <script type="application/json" id="motion-report">${JSON.stringify(options.report).replaceAll("</", "<\\/")}</script>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Motion Copilot Frame Morph</title>
  <style>
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8fa; font-family: system-ui, sans-serif; }
.mc-morph-stage { position: relative; width: ${Math.ceil(maxWidth)}px; height: ${Math.ceil(maxHeight)}px; overflow: visible; background: transparent; }
.mc-morph-layer { position: absolute; box-sizing: border-box; display: grid; place-items: center; white-space: nowrap; overflow: hidden; font-size: 12px; line-height: normal; will-change: left, top, width, height, opacity, border-radius; }
.mc-morph-layer img { width: 100%; height: 100%; display: block; object-fit: fill; }
.mc-morph-enter, .mc-morph-exit { pointer-events: none; }
${keyframes(plan)}
@media (prefers-reduced-motion: reduce) {
  .mc-morph-layer { animation-duration: 1ms !important; animation-delay: 0ms !important; }
}
  </style>
</head>
<body>
  <main class="mc-morph-stage" data-from-frame="${escapeHtml(plan.fromFrameId)}" data-to-frame="${escapeHtml(plan.toFrameId)}" data-duration-ms="${duration}">
    ${plan.tracks.map((track, index) => trackMarkup(plan, track, index)).join("\n    ")}
  </main>${reportBlock}
</body>
</html>`;
}
