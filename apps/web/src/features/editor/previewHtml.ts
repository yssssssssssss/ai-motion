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

const THUMBNAIL_STYLE = `<style data-motion-preview="thumbnail">
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

.motion-preview-stage {
  display: inline-block;
  width: fit-content;
  height: fit-content;
  max-width: 100%;
  max-height: 100%;
  transform-origin: center center;
}
</style>`;

const THUMBNAIL_SCRIPT = `<script data-motion-preview="thumbnail">
(() => {
  const stageClass = "motion-preview-stage";

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

  function measureContent(stage) {
    const elements = [stage, ...stage.querySelectorAll("*")];
    const rects = elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if (rects.length === 0) return { width: 1, height: 1 };

    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return { width: right - left, height: bottom - top };
  }

  function fitThumbnail() {
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
    const content = measureContent(stage);
    const fittedScale = Math.min(1, availableWidth / content.width, availableHeight / content.height);
    const scale = fittedScale < 1 ? fittedScale * 0.9 : 1;

    stage.style.transform = \`scale(\${Number.isFinite(scale) && scale > 0 ? scale.toFixed(3) : "1"})\`;
  }

  window.addEventListener("load", scheduleFit);
  window.addEventListener("resize", scheduleFit);
  if (document.fonts) document.fonts.ready.then(scheduleFit).catch(() => {});
  scheduleFit();

  function scheduleFit() {
    // 双 rAF 后再测量，等动画首帧的 transform 落地，避免初始状态测出过小尺寸
    requestAnimationFrame(() => requestAnimationFrame(fitThumbnail));
  }
})();
</script>`;

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
})();
</script>`;

function inlineLocalAssets(html: string, files: Record<string, string>): string {
  return html
    .replace(/<link\b[^>]*>/g, (tag) => {
      if (!/\brel=["']stylesheet["']/.test(tag)) return tag;

      const href = tag.match(/\bhref=["']\.?\/?([^"']+)["']/)?.[1];
      if (!href) return tag;

      const content = files[`source/${href}`] ?? files[href] ?? "";
      return `<style>${content}</style>`;
    })
    .replace(/<script\b[^>]*\bsrc=["']\.?\/?([^"']+)["'][^>]*><\/script>/g, (_match, src: string) => {
      const content = files[`source/${src}`] ?? files[src] ?? "";
      return `<script>${content}</script>`;
    });
}

function addThumbnailLayout(html: string): string {
  const htmlWithStyle = /<\/head\s*>/i.test(html)
    ? html.replace(/<\/head\s*>/i, `${THUMBNAIL_STYLE}</head>`)
    : `${THUMBNAIL_STYLE}${html}`;

  if (/<\/body\s*>/i.test(htmlWithStyle)) {
    return htmlWithStyle.replace(/<\/body\s*>/i, `${THUMBNAIL_SCRIPT}</body>`);
  }

  return `${htmlWithStyle}${THUMBNAIL_SCRIPT}`;
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

export function renderPreviewHtml({ source, manifest, patch, mode = "full" }: RenderPreviewInput): string {
  const files = Object.fromEntries(source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({ files, manifest, patch });
  const html = inlineLocalAssets(patchedFiles[source.entry] ?? "", patchedFiles);
  if (mode === "thumbnail") return addThumbnailLayout(html);
  if (mode === "editor") return addEditorLayout(html);
  return html;
}
