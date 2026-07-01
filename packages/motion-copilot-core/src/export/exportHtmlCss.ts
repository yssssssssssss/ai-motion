import {
  easingCss,
  layerById,
  primaryElement,
  type EasingSpec,
  type ImageFit,
  type ImagePosition,
  type LayerMotionPreset,
  type MotionDocument,
  type MotionLayer,
  type MotionState
} from "../schema/document";
import { exportVisualCompositionHtml } from "../composition/exportVisualCompositionHtml";
import { exportFrameMorphCompositionHtml } from "../composition/exportFrameMorphCompositionHtml";

function numeric(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeCssColor(value: string | undefined, fallback = "#eef2f6"): string {
  const color = value?.trim() ?? "";
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (["black", "white", "transparent"].includes(color.toLowerCase())) return color;
  return fallback;
}

function safeDimension(value: number, fallback: number): number {
  return Math.min(2400, Math.max(1, Math.round(numeric(value, fallback))));
}

function safeMs(value: number | undefined, fallback: number): number {
  return Math.min(5000, Math.max(0, Math.round(numeric(value, fallback))));
}

function safeImageFit(value: ImageFit | undefined): string {
  if (value === "contain") return "contain";
  if (value === "fill") return "fill";
  return "cover";
}

function safeImagePosition(value: ImagePosition | undefined): string {
  if (value === "top") return "top";
  if (value === "bottom") return "bottom";
  if (value === "left") return "left";
  if (value === "right") return "right";
  return "center";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeImageSrc(value: string | undefined): string {
  if (!value) return "";
  const src = value.trim();
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(src)) return src;
  return /^https?:\/\/[^\s"'<>]+$/.test(src) ? src : "";
}

function iconGlyph(layer: MotionLayer | undefined): string {
  if (layer?.content?.icon === "info") return "i";
  if (layer?.content?.icon === "arrow") return ">";
  return "✓";
}

function layerText(layer: MotionLayer | undefined, fallback: string): string {
  return escapeHtml(layer?.content?.text ?? fallback);
}

function styleDeclarations(layer: MotionLayer | undefined): string[] {
  if (!layer?.style) return [];
  const styles: string[] = [];
  if (layer.style.background) styles.push(`background:${safeCssColor(layer.style.background)}`);
  if (layer.style.color) styles.push(`color:${safeCssColor(layer.style.color, "#1f2328")}`);
  if (layer.style.borderColor)
    styles.push(`border-color:${safeCssColor(layer.style.borderColor, "transparent")}`);
  if (layer.style.boxShadow && /^[#(),.%\sa-zA-Z0-9-]+$/.test(layer.style.boxShadow)) {
    styles.push(`box-shadow:${layer.style.boxShadow}`);
  }
  if (layer.style.fontFamily && /^[\w\s'",:-]+$/.test(layer.style.fontFamily)) {
    styles.push(`font-family:${layer.style.fontFamily}`);
  }
  if (layer.style.textDecoration && /^[\w\s-]+$/.test(layer.style.textDecoration)) {
    styles.push(`text-decoration:${layer.style.textDecoration}`);
  }
  if (typeof layer.style.radius === "number") {
    styles.push(`border-radius:${Math.min(40, Math.max(0, layer.style.radius))}px`);
  }
  if (typeof layer.style.borderWidth === "number") {
    styles.push(`border-width:${Math.min(12, Math.max(0, layer.style.borderWidth))}px`);
  }
  if (typeof layer.style.opacity === "number") {
    styles.push(`opacity:${Math.min(1, Math.max(0, layer.style.opacity))}`);
  }
  return styles;
}

function layerMotionName(preset: LayerMotionPreset | undefined): string {
  if (preset === "fade") return "mc-free-fade";
  if (preset === "lift") return "mc-free-lift";
  if (preset === "slide-left") return "mc-free-slide-left";
  if (preset === "slide-right") return "mc-free-slide-right";
  if (preset === "zoom") return "mc-free-zoom";
  return "";
}

function layerMotionDeclarations(layer: MotionLayer): string[] {
  const name = layerMotionName(layer.motion?.preset);
  if (!name) return [];
  const easing: EasingSpec = layer.motion?.easing ?? {
    type: "classic" as const,
    preset: "decelerate" as const,
    css: "cubic-bezier(0.18, 0.86, 0.22, 1)"
  };
  return [
    `--mc-layer-opacity-from:${Math.min(1, Math.max(0, layer.motion?.opacityFrom ?? 0))}`,
    `--mc-layer-opacity-to:${Math.min(1, Math.max(0, layer.motion?.opacityTo ?? 1))}`,
    `--mc-layer-scale-from:${Math.max(0, layer.motion?.scaleFrom ?? 0.92)}`,
    `animation:${name} ${safeMs(layer.motion?.durationMs, 220)}ms ${easingCss(easing)} ${safeMs(layer.motion?.delayMs, 0)}ms both`
  ];
}

function inlineStyle(layer: MotionLayer | undefined): string {
  const styles = layer ? [...layerMotionDeclarations(layer), ...styleDeclarations(layer)] : [];
  return styles.length > 0 ? ` style="${styles.join(";")}"` : "";
}

function freeLayerStyle(document: MotionDocument, layer: MotionLayer): string {
  const layout = layer.layout;
  if (!layout) return inlineStyle(layer);
  const width = safeDimension(document.stage.width, 430);
  const height = safeDimension(document.stage.height, 720);
  const styles = [
    `left:${(layout.x / width) * 100}%`,
    `top:${(layout.y / height) * 100}%`,
    `width:${(safeDimension(layout.width, 120) / width) * 100}%`,
    `height:${(safeDimension(layout.height, 80) / height) * 100}%`,
    `z-index:${Math.round(numeric(layout.zIndex, 1))}`,
    ...layerMotionDeclarations(layer),
    ...styleDeclarations(layer)
  ];
  return ` style="${styles.join(";")}"`;
}

function renderImage(layer: MotionLayer | undefined): string {
  if (layer?.hidden) return "";
  const src = safeImageSrc(layer?.content?.src);
  if (!src) return `<span class="mc-modal-image-placeholder"${inlineStyle(layer)}></span>`;
  const styles = [
    `object-fit:${safeImageFit(layer?.style?.fit)}`,
    `object-position:${safeImagePosition(layer?.style?.position)}`,
    ...(layer ? layerMotionDeclarations(layer) : []),
    ...styleDeclarations(layer)
  ];
  return `<img class="mc-modal-image" src="${src}" alt="${escapeHtml(layer?.content?.alt ?? "")}" style="${styles.join(";")}" />`;
}

function roleMarkup(document: MotionDocument): string {
  const role = primaryElement(document).role;
  if (role === "toast") {
    const icon = layerById(document, "toast-icon");
    const title = layerById(document, "toast-title");
    const message = layerById(document, "toast-message");
    return `${icon?.hidden ? "" : `<span class="mc-toast-mark"${inlineStyle(icon)}>${iconGlyph(icon)}</span>`}<span class="mc-toast-copy">${title?.hidden ? "" : `<strong>${layerText(title, "操作已完成")}</strong>`}${message?.hidden ? "" : `<span>${layerText(message, "系统已同步当前修改。")}</span>`}</span>`;
  }
  if (role === "button") {
    const label = layerById(document, "button-label");
    const icon = layerById(document, "button-icon");
    return `${label?.hidden ? "" : layerText(label, "立即查看")}${icon?.hidden ? "" : `<span class="mc-button-icon">${iconGlyph(icon)}</span>`}`;
  }

  const title = layerById(document, "modal-title");
  const body = layerById(document, "modal-body");
  const secondary = layerById(document, "modal-secondary");
  const primary = layerById(document, "modal-primary");
  const actions =
    secondary?.hidden && primary?.hidden
      ? ""
      : `<span class="mc-modal-actions">${secondary?.hidden ? "" : `<button class="mc-modal-secondary"${inlineStyle(secondary)}>${layerText(secondary, "稍后再说")}</button>`}${primary?.hidden ? "" : `<button class="mc-modal-primary"${inlineStyle(primary)}>${layerText(primary, "立即查看")}</button>`}</span>`;
  return `<span class="mc-modal-handle"></span>${renderImage(layerById(document, "modal-image"))}${title?.hidden ? "" : `<strong class="mc-modal-title"${inlineStyle(title)}>${layerText(title, "新品上线提醒")}</strong>`}${body?.hidden ? "" : `<p class="mc-modal-text"${inlineStyle(body)}>${layerText(body, "这里展示关键说明。")}</p>`}${actions}`;
}

function stageBackground(document: MotionDocument): string {
  const src = safeImageSrc(document.stage.backgroundImage);
  if (!src) return "";
  return `<img class="mc-stage-background" src="${src}" alt="${escapeHtml(document.stage.backgroundAlt ?? "")}" />`;
}

function freeLayerMarkup(document: MotionDocument): string {
  return document.layers
    .filter((layer) => layer.layout && !layer.hidden)
    .sort((left, right) => (left.layout?.zIndex ?? 0) - (right.layout?.zIndex ?? 0))
    .map((layer) => {
      let content = "";
      if (layer.kind === "image") {
        const src = safeImageSrc(layer.content?.src);
        content = src
          ? `<img src="${src}" alt="${escapeHtml(layer.content?.alt ?? "")}" style="object-fit:${safeImageFit(layer.style?.fit)};object-position:${safeImagePosition(layer.style?.position)}" />`
          : "<span>图片</span>";
      } else if (layer.kind === "text") content = layerText(layer, "自定义文本");
      else if (layer.kind === "button") content = layerText(layer, "立即行动");
      else if (layer.kind === "icon") content = escapeHtml(iconGlyph(layer));
      const tag = layer.kind === "button" ? "button" : "span";
      return `<${tag} class="mc-layer mc-layer-${layer.kind}"${freeLayerStyle(document, layer)}>${content}</${tag}>`;
    })
    .join("");
}

function cssState(state: MotionState): string {
  return [
    `transform: translate(${numeric(state.x, 0)}px, ${numeric(state.y, 0)}px) scale(${numeric(state.scale, 1)}) rotate(${numeric(state.rotate, 0)}deg);`,
    `opacity: ${numeric(state.opacity, 1)};`,
    `filter: blur(${numeric(state.blur, 0)}px);`
  ].join("\n    ");
}

function keyframes(document: MotionDocument): string {
  const element = primaryElement(document);
  if (element.role !== "button") {
    return `@keyframes mc-motion {
  from { ${cssState(element.initial)} }
  to { ${cssState(element.animate)} }
}`;
  }
  return `@keyframes mc-motion {
  0%, 100% { ${cssState(element.initial)} }
  50% { ${cssState(element.animate)} }
}`;
}

export function exportHtmlCss(document: MotionDocument): { html: string; css: string } {
  const element = primaryElement(document);
  const role = element.role;
  const stageWidth = safeDimension(document.stage.width, 430);
  const stageHeight = safeDimension(document.stage.height, 720);
  const targetStyle =
    role === "toast" && !layerById(document, "toast-background")?.hidden
      ? inlineStyle(layerById(document, "toast-background"))
      : role === "button" && !layerById(document, "button-label")?.hidden
        ? inlineStyle(layerById(document, "button-label"))
        : "";
  const html = `<main class="mc-stage">
  <div class="mc-artboard mc-artboard-${document.stage.mode}">
    ${stageBackground(document)}
    <div class="mc-target mc-${role}"${targetStyle}>${roleMarkup(document)}</div>
    ${freeLayerMarkup(document)}
  </div>
</main>`;
  const css = `.mc-stage { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f6f8fa; }
.mc-artboard { --mc-stage-width: ${stageWidth}; --mc-stage-height: ${stageHeight}; --mc-stage-width-px: ${stageWidth}px; position: relative; overflow: hidden; width: min(var(--mc-stage-width-px), calc(100vw - 48px)); aspect-ratio: var(--mc-stage-width) / var(--mc-stage-height); display: grid; place-items: center; background: ${safeCssColor(document.stage.background)}; border-radius: ${document.stage.mode === "mobile" ? 30 : 0}px; }
.mc-stage-background { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: ${safeImageFit(document.stage.backgroundFit)}; object-position: ${safeImagePosition(document.stage.backgroundPosition)}; }
.mc-target { position: relative; z-index: 20; animation: mc-motion ${document.timeline.durationMs}ms ${easingCss(document.timeline.easing)} ${document.timeline.delayMs}ms both; will-change: transform, opacity, filter; }
.mc-layer { position: absolute; box-sizing: border-box; display: grid; place-items: center; overflow: hidden; border: 0 solid transparent; padding: 0; color: #1f2328; background: transparent; font: inherit; text-align: center; line-height: normal; text-decoration: none; }
.mc-layer img { width: 100%; height: 100%; display: block; }
.mc-layer-image, .mc-layer-shape { padding: 0; }
.mc-modal { width: min(330px, 76vw); min-height: 220px; padding: 24px; border-radius: 18px; background: #ffffff; box-shadow: 0 28px 92px rgba(20, 30, 44, 0.22); }
.mc-modal-image, .mc-modal-image-placeholder { width: 100%; height: 76px; display: block; border-radius: 12px; margin: 0 0 18px; background: #d8e8e0; }
.mc-modal-title { display: block; color: #1f2328; font-size: 18px; margin-bottom: 10px; }
.mc-modal-text { margin: 0; color: #57606a; line-height: 1.6; }
.mc-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.mc-modal-actions button { min-width: 86px; min-height: 36px; border: 0; padding: 0 14px; font: inherit; }
.mc-toast { min-width: min(340px, 82vw); min-height: 68px; padding: 14px 16px; border-radius: 14px; background: #17202a; color: white; display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: center; }
.mc-button { min-width: 172px; height: 54px; border-radius: 14px; border: 0; display: grid; place-items: center; color: white; background: #0f5c8a; }
${keyframes(document)}
@keyframes mc-free-fade { from { opacity: var(--mc-layer-opacity-from, 0); } to { opacity: var(--mc-layer-opacity-to, 1); } }
@keyframes mc-free-lift { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes mc-free-slide-left { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes mc-free-slide-right { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes mc-free-zoom { from { opacity: var(--mc-layer-opacity-from, 0); transform: scale(var(--mc-layer-scale-from, 0.92)); } to { opacity: var(--mc-layer-opacity-to, 1); transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .mc-target, .mc-layer { animation: none; transform: none; opacity: 1; filter: none; } }`;
  return { html, css };
}

export function exportStandaloneHtml(document: MotionDocument): string {
  if (document.visualSource?.kind === "zero-visual-morph" && document.composition) {
    return exportVisualCompositionHtml(document, document.composition);
  }
  if (document.composition && document.composition.steps.some((s) => s.presetId === "frame-morph-layout")) {
    return exportFrameMorphCompositionHtml(document, document.composition);
  }
  const output = exportHtmlCss(document);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Motion Copilot Export</title>
  <style>
${output.css}
  </style>
</head>
<body>
${output.html}
</body>
</html>`;
}
