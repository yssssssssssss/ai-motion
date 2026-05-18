import { applyPatchToFiles, type MotionManifest, type MotionPatch, type MotionSource } from "@motion-tool/core";

type RenderPreviewInput = {
  source: MotionSource;
  manifest: MotionManifest;
  patch: MotionPatch;
  mode?: "full" | "thumbnail";
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

  window.addEventListener("load", fitThumbnail);
  window.addEventListener("resize", fitThumbnail);
  if (document.fonts) document.fonts.ready.then(fitThumbnail).catch(() => {});
  requestAnimationFrame(fitThumbnail);
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

export function renderPreviewHtml({ source, manifest, patch, mode = "full" }: RenderPreviewInput): string {
  const files = Object.fromEntries(source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({ files, manifest, patch });
  const html = inlineLocalAssets(patchedFiles[source.entry] ?? "", patchedFiles);
  return mode === "thumbnail" ? addThumbnailLayout(html) : html;
}
