import {
  applyPatchToFiles,
  type MotionManifest,
  type MotionPatch,
  type MotionSource
} from "@motion-tool/core";

type RenderPreviewInput = {
  source: MotionSource;
  manifest: MotionManifest;
  patch: MotionPatch;
  mode?: "full" | "thumbnail" | "editor";
};

const userTriggeredPreviewTriggers = new Set(["click", "hover", "swipe"]);

export function shouldPreviewAutoplay(manifest: MotionManifest | null): boolean {
  const recipes = manifest?.motionRecipes ?? [];
  if (recipes.length === 0) return true;
  return recipes.some((recipe) => !userTriggeredPreviewTriggers.has(recipe.trigger));
}

const THUMBNAIL_STYLE = `<style data-motion-preview="thumbnail">
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: block;
  overflow: hidden;
  padding: 12px;
  position: relative;
  box-sizing: border-box;
}

.motion-preview-stage {
  display: block;
  width: fit-content;
  height: fit-content;
  left: 50%;
  max-width: 100%;
  max-height: 100%;
  position: absolute;
  top: 50%;
  transform-origin: center center;
}
</style>`;

function thumbnailScript(autoplay: boolean): string {
  return `<script data-motion-preview="thumbnail">
(() => {
  const stageClass = "motion-preview-stage";
  const thumbnailReplayPauseMs = 800;
  const shouldAutoplay = ${autoplay ? "true" : "false"};
  let loopTimer = 0;

  function ensureStage() {
    if (!document.body) return null;

    const existing = document.querySelector("." + stageClass);
    if (existing) return existing;

    const stage = document.createElement("div");
    stage.className = stageClass;
    const nodes = Array.from(document.body.childNodes).filter((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node;
        return (
          element.tagName.toUpperCase() !== "SCRIPT" &&
          element.getAttribute("data-motion-preview") !== "thumbnail"
        );
      }

      return Boolean(node.textContent && node.textContent.trim());
    });

    for (const node of nodes) stage.appendChild(node);
    document.body.insertBefore(stage, document.body.firstChild);
    return stage;
  }

  function parseCssPixelValue(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function parseCssOffsetValue(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getDeclaredStageSize(element) {
    const candidates = [element, document.documentElement, document.body].filter(Boolean);

    for (const candidate of candidates) {
      const style = getComputedStyle(candidate);
      const width = parseCssPixelValue(style.getPropertyValue("--stage-width"));
      const height = parseCssPixelValue(style.getPropertyValue("--stage-height"));
      if (width && height) return { width, height };
    }

    return null;
  }

  function getThumbnailFocus(element) {
    const candidates = [element, document.documentElement, document.body].filter(Boolean);

    for (const candidate of candidates) {
      const style = getComputedStyle(candidate);
      const width = parseCssPixelValue(style.getPropertyValue("--thumbnail-focus-width"));
      const height = parseCssPixelValue(style.getPropertyValue("--thumbnail-focus-height"));
      if (!width || !height) continue;

      return {
        x: parseCssOffsetValue(style.getPropertyValue("--thumbnail-focus-x")),
        y: parseCssOffsetValue(style.getPropertyValue("--thumbnail-focus-y")),
        width,
        height,
        radius: parseCssOffsetValue(style.getPropertyValue("--thumbnail-focus-radius"))
      };
    }

    return null;
  }

  function fixElementSize(element, size) {
    element.style.width = \`\${size.width}px\`;
    element.style.height = \`\${size.height}px\`;
    element.style.maxWidth = "none";
    element.style.maxHeight = "none";
  }

  function resetThumbnailFocus(stage, content) {
    stage.style.overflow = "";
    stage.style.borderRadius = "";
    if (!(content instanceof HTMLElement)) return;
    content.style.position = "";
    content.style.left = "";
    content.style.top = "";
    content.style.transform = "";
  }

  function applyThumbnailFocus(stage, content, focus) {
    fixElementSize(stage, focus);
    stage.style.overflow = "hidden";
    stage.style.borderRadius = \`\${Math.max(0, focus.radius)}px\`;
    content.style.position = "absolute";
    content.style.left = \`\${-focus.x}px\`;
    content.style.top = \`\${-focus.y}px\`;
    content.style.transform = "none";
  }

  function measureContent(stage) {
    // 优先使用 scrollWidth/scrollHeight：动画态下 transform: scale(0) 会让 rect 为 0，
    // 但 scrollWidth 是不受 transform 影响的几何尺寸，更稳定。
    const candidates = [stage, ...stage.querySelectorAll("*")];
    let width = 0;
    let height = 0;
    for (const element of candidates) {
      width = Math.max(width, element.scrollWidth || 0, element.offsetWidth || 0);
      height = Math.max(height, element.scrollHeight || 0, element.offsetHeight || 0);
    }
    if (width > 0 && height > 0) return { width, height };

    const rects = candidates
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if (rects.length === 0) return { width: 1, height: 1 };

    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return { width: right - left, height: bottom - top };
  }

  function measureThumbnailContent(stage) {
    const content = stage.firstElementChild;
    stage.style.width = "";
    stage.style.height = "";

    if (content instanceof HTMLElement) {
      resetThumbnailFocus(stage, content);
      const declaredSize = getDeclaredStageSize(content);
      if (declaredSize) {
        fixElementSize(content, declaredSize);
        const focus = getThumbnailFocus(content);
        if (focus) {
          applyThumbnailFocus(stage, content, focus);
          return focus;
        }

        fixElementSize(stage, declaredSize);
        return declaredSize;
      }
    }

    resetThumbnailFocus(stage, content);
    const measuredSize = measureContent(stage);
    fixElementSize(stage, measuredSize);
    return measuredSize;
  }

  function fitThumbnail() {
    const stage = ensureStage();
    if (!stage) return;

    stage.style.transform = "translate(-50%, -50%) scale(1)";

    const bodyStyle = getComputedStyle(document.body);
    const availableWidth = Math.max(
      1,
      document.documentElement.clientWidth - parseFloat(bodyStyle.paddingLeft) - parseFloat(bodyStyle.paddingRight)
    );
    const availableHeight = Math.max(
      1,
      document.documentElement.clientHeight - parseFloat(bodyStyle.paddingTop) - parseFloat(bodyStyle.paddingBottom)
    );
    const content = measureThumbnailContent(stage);
    const fittedScale = Math.min(1, availableWidth / content.width, availableHeight / content.height);
    const scale = fittedScale < 1 ? fittedScale * 0.9 : 1;

    stage.style.transform = \`translate(-50%, -50%) scale(\${
      Number.isFinite(scale) && scale > 0 ? scale.toFixed(3) : "1"
    })\`;
  }

  function parseCssTime(value) {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return 0;
    return trimmed.endsWith("ms") ? parsed : parsed * 1000;
  }

  function maxTimePair(durations, delays) {
    const durationItems = durations.split(",");
    const delayItems = delays.split(",");
    let maxTime = 0;

    for (let index = 0; index < durationItems.length; index += 1) {
      const duration = parseCssTime(durationItems[index] ?? "0s");
      const delay = parseCssTime(delayItems[index] ?? delayItems[0] ?? "0s");
      maxTime = Math.max(maxTime, duration + delay);
    }

    return maxTime;
  }

  function thumbnailPlaybackDuration() {
    const candidates = [document.documentElement, document.body, ...document.querySelectorAll("*")].filter(Boolean);
    let maxDuration = 0;

    for (const element of candidates) {
      const style = getComputedStyle(element);
      maxDuration = Math.max(
        maxDuration,
        parseCssTime(style.getPropertyValue("--motion-duration")),
        parseCssTime(style.getPropertyValue("--reveal-duration")) + parseCssTime(style.getPropertyValue("--start-delay")),
        maxTimePair(style.animationDuration, style.animationDelay),
        maxTimePair(style.transitionDuration, style.transitionDelay)
      );
    }

    return Math.min(Math.max(maxDuration, 800), 10000);
  }

  function restartCssAnimations() {
    const elements = Array.from(document.querySelectorAll("*"));
    const previousAnimations = elements.map((element) => element.style.animation);

    for (const element of elements) element.style.animation = "none";
    void document.documentElement.offsetWidth;
    elements.forEach((element, index) => {
      element.style.animation = previousAnimations[index] ?? "";
    });
  }

  function fallbackReplay() {
    const root = document.querySelector("[data-motion-root]");
    if (root instanceof HTMLElement) {
      root.classList.remove("is-playing");
      void root.offsetWidth;
      root.classList.add("is-playing");
    }
    restartCssAnimations();
  }

  function fallbackPause() {
    if (document.getAnimations) {
      for (const animation of document.getAnimations({ subtree: true })) animation.pause();
    }
  }

  function fallbackSeek(progress) {
    if (!document.getAnimations) return;
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (animation.effect) {
        const timing = animation.effect.getComputedTiming();
        if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
      }
    }
  }

  function ensureMotionPreviewProtocol() {
    if (typeof window.motionReplay !== "function") window.motionReplay = fallbackReplay;
    if (typeof window.motionPause !== "function") window.motionPause = fallbackPause;
    if (typeof window.motionSeek !== "function") window.motionSeek = fallbackSeek;
  }

  function replayThumbnailMotion() {
    ensureMotionPreviewProtocol();
    window.motionReplay();
    scheduleFit();
  }

  function scheduleThumbnailLoop() {
    window.clearTimeout(loopTimer);
    loopTimer = window.setTimeout(() => {
      replayThumbnailMotion();
      scheduleThumbnailLoop();
    }, thumbnailPlaybackDuration() + thumbnailReplayPauseMs);
  }

  window.addEventListener("load", scheduleFit);
  window.addEventListener("resize", scheduleFit);
  if (document.fonts) document.fonts.ready.then(scheduleFit).catch(() => {});
  fitThumbnail();
  scheduleFit();
  window.setTimeout(fitThumbnail, 80);
  ensureMotionPreviewProtocol();
  if (shouldAutoplay) requestAnimationFrame(() => requestAnimationFrame(scheduleThumbnailLoop));

  function scheduleFit() {
    // 双 rAF 后再测量，等动画首帧的 transform 落地，避免初始状态测出过小尺寸
    requestAnimationFrame(() => requestAnimationFrame(fitThumbnail));
  }
})();
</script>`;
}

const EDITOR_STYLE = `<style data-motion-preview="editor">
html,
body {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
}

body {
  display: block !important;
  overflow: hidden !important;
  padding: 24px !important;
  position: relative !important;
  box-sizing: border-box !important;
}

.motion-editor-stage {
  display: block !important;
  flex: 0 0 auto !important;
  left: 50% !important;
  max-width: none !important;
  max-height: none !important;
  position: absolute !important;
  top: 50% !important;
  transform-origin: center center !important;
  will-change: transform;
}

/* 覆盖组件内常见的全屏布局，避免在编辑预览中产生大空白 */
.motion-editor-stage > * {
  flex: 0 0 auto !important;
  max-width: none !important;
  max-height: none !important;
  min-height: auto !important;
  min-width: auto !important;
}
</style>`;

const EDITOR_SCRIPT = `<script data-motion-preview="editor">
(() => {
  const stageClass = "motion-editor-stage";
  const editorReplayPauseMs = 1200;
  let isPreviewPlaying = true;
  let loopTimer = 0;

  function ensureStage() {
    if (!document.body) return null;

    const existing = document.querySelector("." + stageClass);
    if (existing) return existing;

    const stage = document.createElement("div");
    stage.className = stageClass;
    const nodes = Array.from(document.body.childNodes).filter((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node;
        return (
          element.tagName.toUpperCase() !== "SCRIPT" &&
          element.getAttribute("data-motion-preview") !== "editor"
        );
      }

      return Boolean(node.textContent && node.textContent.trim());
    });

    for (const node of nodes) stage.appendChild(node);
    document.body.insertBefore(stage, document.body.firstChild);
    return stage;
  }

  function parseCssPixelValue(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function readElementBox(element) {
    const rect = element.getBoundingClientRect();
    return {
      width: Math.max(1, element.scrollWidth || 0, element.offsetWidth || 0, rect.width || 0),
      height: Math.max(1, element.scrollHeight || 0, element.offsetHeight || 0, rect.height || 0)
    };
  }

  function getDeclaredStageSize(element) {
    const candidates = [element, document.documentElement, document.body].filter(Boolean);

    for (const candidate of candidates) {
      const style = getComputedStyle(candidate);
      const width = parseCssPixelValue(style.getPropertyValue("--stage-width"));
      const height = parseCssPixelValue(style.getPropertyValue("--stage-height"));
      if (width && height) return { width, height };
    }

    return null;
  }

  function fixElementSize(element, size) {
    element.style.width = \`\${size.width}px\`;
    element.style.height = \`\${size.height}px\`;
    element.style.maxWidth = "none";
    element.style.maxHeight = "none";
  }

  function measureEditorContent(stage) {
    const content = stage.firstElementChild;
    stage.style.transform = "none";
    stage.style.width = "";
    stage.style.height = "";

    if (content instanceof HTMLElement) {
      const declaredSize = getDeclaredStageSize(content);
      if (declaredSize) {
        fixElementSize(content, declaredSize);
        fixElementSize(stage, declaredSize);
        return declaredSize;
      }

      const measuredSize = readElementBox(content);
      fixElementSize(stage, measuredSize);
      return measuredSize;
    }

    const stageSize = readElementBox(stage);
    fixElementSize(stage, stageSize);
    return stageSize;
  }

  function fitEditorPreview() {
    const stage = ensureStage();
    if (!stage) return;

    stage.style.transform = "scale(1)";

    const bodyStyle = getComputedStyle(document.body);
    const availableWidth = Math.max(
      1,
      document.documentElement.clientWidth - parseFloat(bodyStyle.paddingLeft) - parseFloat(bodyStyle.paddingRight)
    );
    const availableHeight = Math.max(
      1,
      document.documentElement.clientHeight - parseFloat(bodyStyle.paddingTop) - parseFloat(bodyStyle.paddingBottom)
    );
    const contentSize = measureEditorContent(stage);
    const fittedScale = Math.min(1, availableWidth / contentSize.width, availableHeight / contentSize.height);
    const scale = Number.isFinite(fittedScale) && fittedScale > 0 ? fittedScale * 0.96 : 1;

    stage.style.transform = \`translate(-50%, -50%) scale(\${scale.toFixed(3)})\`;
  }

  function parseCssTime(value) {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return 0;
    return trimmed.endsWith("ms") ? parsed : parsed * 1000;
  }

  function maxTimePair(durations, delays) {
    const durationItems = durations.split(",");
    const delayItems = delays.split(",");
    let maxTime = 0;

    for (let index = 0; index < durationItems.length; index += 1) {
      const duration = parseCssTime(durationItems[index] ?? "0s");
      const delay = parseCssTime(delayItems[index] ?? delayItems[0] ?? "0s");
      maxTime = Math.max(maxTime, duration + delay);
    }

    return maxTime;
  }

  function declaredPlaybackDuration() {
    const candidates = [document.documentElement, document.body, ...document.querySelectorAll("*")].filter(Boolean);
    let maxDuration = 0;

    for (const element of candidates) {
      const style = getComputedStyle(element);
      maxDuration = Math.max(
        maxDuration,
        parseCssTime(style.getPropertyValue("--motion-duration")),
        parseCssTime(style.getPropertyValue("--reveal-duration")) + parseCssTime(style.getPropertyValue("--start-delay")),
        maxTimePair(style.animationDuration, style.animationDelay),
        maxTimePair(style.transitionDuration, style.transitionDelay)
      );
    }

    return Math.min(Math.max(maxDuration, 800), 10000);
  }

  function applyPlaybackState(playState) {
    for (const element of document.querySelectorAll("*")) {
      element.style.animationPlayState = playState;
    }

    if (document.getAnimations) {
      for (const animation of document.getAnimations({ subtree: true })) {
        if (playState === "paused") animation.pause();
        else animation.play();
      }
    }
  }

  function restartCssAnimations() {
    const elements = Array.from(document.querySelectorAll("*"));
    const previousAnimations = elements.map((element) => element.style.animation);

    for (const element of elements) element.style.animation = "none";
    void document.documentElement.offsetWidth;
    elements.forEach((element, index) => {
      element.style.animation = previousAnimations[index] ?? "";
    });
  }

  function fallbackReplay() {
    const root = document.querySelector("[data-motion-root]");
    if (root instanceof HTMLElement) {
      root.classList.remove("is-playing");
      void root.offsetWidth;
      root.classList.add("is-playing");
    }
    restartCssAnimations();
    applyPlaybackState(isPreviewPlaying ? "running" : "paused");
  }

  function fallbackPause() {
    isPreviewPlaying = false;
    applyPlaybackState("paused");
  }

  function fallbackSeek(progress) {
    if (!document.getAnimations) return;
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (animation.effect) {
        const timing = animation.effect.getComputedTiming();
        if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
      }
    }
  }

  function resetMotionPreview() {
    isPreviewPlaying = false;
    window.clearTimeout(loopTimer);
    if (typeof window.motionReverse === "function") window.motionReverse();
    const root = document.querySelector("[data-motion-root]");
    if (root instanceof HTMLElement) {
      root.classList.remove("is-playing");
      delete root.dataset.motionPlayed;
    }
    for (const element of document.querySelectorAll("*")) {
      element.style.animationPlayState = "";
    }
    if (document.getAnimations) {
      for (const animation of document.getAnimations({ subtree: true })) animation.cancel();
    }
    scheduleFit();
  }

  function ensureMotionPreviewProtocol() {
    if (typeof window.motionReplay !== "function") window.motionReplay = fallbackReplay;
    if (typeof window.motionPause !== "function") window.motionPause = fallbackPause;
    if (typeof window.motionSeek !== "function") window.motionSeek = fallbackSeek;
  }

  function replayMotion() {
    ensureMotionPreviewProtocol();
    window.motionReplay();
    applyPlaybackState(isPreviewPlaying ? "running" : "paused");
  }

  function schedulePlaybackLoop() {
    window.clearTimeout(loopTimer);
    if (!isPreviewPlaying) return;

    loopTimer = window.setTimeout(() => {
      if (!isPreviewPlaying) return;
      replayMotion();
      schedulePlaybackLoop();
    }, declaredPlaybackDuration() + editorReplayPauseMs);
  }

  function setPreviewPlayback(nextState) {
    isPreviewPlaying = nextState === "playing";
    applyPlaybackState(isPreviewPlaying ? "running" : "paused");

    if (isPreviewPlaying) schedulePlaybackLoop();
    else window.clearTimeout(loopTimer);
  }

  function formatCssValue(param, value) {
    if (param.type === "image") {
      const rawValue = String(value ?? "").trim();
      if (!rawValue) return "";
      if (/^url\\(/i.test(rawValue)) return rawValue;
      return \`url("\${rawValue.replaceAll("\\\\", "\\\\\\\\").replaceAll('"', '\\\\"')}")\`;
    }

    if (typeof value === "number" && param.constraints && param.constraints.unit) {
      return \`\${value}\${param.constraints.unit}\`;
    }

    return String(value ?? "");
  }

  function forEachTargetElement(selector, callback) {
    try {
      for (const element of document.querySelectorAll(selector)) {
        if (element instanceof HTMLElement || element instanceof SVGElement) callback(element);
      }
    } catch {
      // Ignore unsupported selectors from imported or generated sources.
    }
  }

  function applyMotionPreviewPatch(values, params) {
    if (!values || !params) return;

    for (const param of params) {
      if (!Object.prototype.hasOwnProperty.call(values, param.id)) continue;

      const value = values[param.id];
      const cssValue = formatCssValue(param, value);
      for (const target of param.targets || []) {
        if (target.kind === "css-variable") {
          forEachTargetElement(target.selector, (styleTarget) => {
            styleTarget.style.setProperty(target.name, cssValue);
          });
        }

        if (target.kind === "css-property") {
          forEachTargetElement(target.selector, (styleTarget) => {
            styleTarget.style.setProperty(target.property, cssValue);
          });
        }

        if (target.kind === "html-text") {
          forEachTargetElement(target.selector, (element) => {
            element.textContent = String(value ?? "");
          });
        }

        if (target.kind === "html-attribute" || target.kind === "svg-attribute") {
          forEachTargetElement(target.selector, (element) => {
            element.setAttribute(target.attribute, String(value ?? ""));
          });
        }
      }
    }

    scheduleFit();
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === "motion-preview:patch") applyMotionPreviewPatch(data.values, data.params);
    if (data.type === "motion-preview:reset") {
      resetMotionPreview();
      return;
    }
    if (data.type !== "motion-preview:playback") return;
    if (data.action === "play") setPreviewPlayback("playing");
    if (data.action === "pause") setPreviewPlayback("paused");
    if (data.action === "replay") {
      isPreviewPlaying = true;
      replayMotion();
      schedulePlaybackLoop();
    }
  });

  function scheduleFit() {
    requestAnimationFrame(() => requestAnimationFrame(fitEditorPreview));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleFit, { once: true });
  } else {
    scheduleFit();
  }

  window.addEventListener("load", scheduleFit);
  window.addEventListener("resize", scheduleFit);
  if (document.fonts) document.fonts.ready.then(scheduleFit).catch(() => {});
  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(document.documentElement);
    if (document.body) resizeObserver.observe(document.body);
  }

  ensureMotionPreviewProtocol();
  requestAnimationFrame(() => requestAnimationFrame(schedulePlaybackLoop));
})();
</script>`;

function inlineLocalAssets(html: string, files: Record<string, string>): string {
  return html
    .replace(/<link\b[^>]*>/g, (tag) => {
      if (!/\brel=["']stylesheet["']/.test(tag)) return tag;

      const href = tag.match(/\bhref=["']\.?\/?([^"']+)["']/)?.[1];
      if (!href) return tag;

      const content = files[`source/${href}`] ?? files[href] ?? "";
      if (/^(?:\/|https?:\/\/)/.test(content)) {
        return tag.replace(/\bhref=["'][^"']+["']/, `href="${content}"`);
      }
      return `<style>${content}</style>`;
    })
    .replace(/<script\b[^>]*\bsrc=["']\.?\/?([^"']+)["'][^>]*><\/script>/g, (_match, src: string) => {
      const content = files[`source/${src}`] ?? files[src] ?? "";
      return `<script>${content}</script>`;
    });
}

function addThumbnailLayout(html: string, autoplay: boolean): string {
  const htmlWithStyle = /<\/head\s*>/i.test(html)
    ? html.replace(/<\/head\s*>/i, `${THUMBNAIL_STYLE}</head>`)
    : `${THUMBNAIL_STYLE}${html}`;
  const script = thumbnailScript(autoplay);

  if (/<\/body\s*>/i.test(htmlWithStyle)) {
    return htmlWithStyle.replace(/<\/body\s*>/i, `${script}</body>`);
  }

  return `${htmlWithStyle}${script}`;
}

function addEditorLayout(html: string): string {
  const htmlWithStyle = /<\/head\s*>/i.test(html)
    ? html.replace(/<\/head\s*>/i, `${EDITOR_STYLE}</head>`)
    : `${EDITOR_STYLE}${html}`;

  if (/<\/body\s*>/i.test(htmlWithStyle)) {
    return htmlWithStyle.replace(/<\/body\s*>/i, `${EDITOR_SCRIPT}</body>`);
  }

  return `${htmlWithStyle}${EDITOR_SCRIPT}`;
}

// 上传源的 CSP 安全策略：限制外域脚本和样式加载
const IMPORTED_CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none';" data-motion-preview="csp">`;

function injectCspIfImported(html: string, source: MotionSource): string {
  if (source.origin !== "imported") return html;
  // 注入 CSP 到 <head> 或 HTML 开头
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${IMPORTED_CSP_META}</head>`);
  }
  return `${IMPORTED_CSP_META}${html}`;
}

export function renderPreviewHtml({ source, manifest, patch, mode = "full" }: RenderPreviewInput): string {
  const files = Object.fromEntries(source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({ files, manifest, patch });
  const html = inlineLocalAssets(patchedFiles[source.entry] ?? "", patchedFiles);
  const safeHtml = injectCspIfImported(html, source);
  if (mode === "thumbnail") return addThumbnailLayout(safeHtml, shouldPreviewAutoplay(manifest));
  if (mode === "editor") return addEditorLayout(safeHtml);
  return safeHtml;
}
