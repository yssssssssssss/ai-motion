import type { MotionManifest, MotionPatch } from "../manifest/types";
import { applyPatchToFiles } from "../patch/applyPatch";

export type EmbedPackageFileContent = string | Uint8Array;

export function composeEditablePackageFiles(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  metadata: Record<string, unknown>;
  patch: MotionPatch;
}): Record<string, string> {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });

  return {
    ...patchedFiles,
    "motion.manifest.json": JSON.stringify(input.manifest, null, 2),
    "metadata.json": JSON.stringify(input.metadata, null, 2),
    "motion.patch.json": JSON.stringify(input.patch, null, 2)
  };
}

function localAssetPath(path: string): string {
  return path.replace(/^\.?\//, "");
}

function sourceLookupPath(path: string): string {
  const normalized = localAssetPath(path);
  return normalized.startsWith("source/") ? normalized : `source/${normalized}`;
}

export function composeStandaloneHtmlFile(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  patch: MotionPatch;
}): string {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });
  const entry = patchedFiles[input.manifest.runtime.entry] ?? "";

  return entry
    .replace(/<link\b[^>]*>/g, (tag) => {
      if (!/\brel=["']stylesheet["']/.test(tag)) return tag;

      const href = tag.match(/\bhref=["']([^"']+)["']/)?.[1];
      if (!href) return tag;

      const content = patchedFiles[sourceLookupPath(href)] ?? patchedFiles[localAssetPath(href)];
      return content === undefined ? tag : `<style>\n${content}\n</style>`;
    })
    .replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g, (tag, src: string) => {
      const content = patchedFiles[sourceLookupPath(src)] ?? patchedFiles[localAssetPath(src)];
      return content === undefined ? tag : `<script>${content}</script>`;
    });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fileNameSafe(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/svg+xml") return "svg";
  return mimeType.replace("image/", "") || "bin";
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function extractBodyHtml(html: string): string {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch?.[1] ?? html)
    .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .trim();
}

function collectLinkedStyles(entryHtml: string, files: Record<string, string>): string {
  const styles: string[] = [];
  entryHtml.replace(/<link\b[^>]*>/g, (tag) => {
    if (!/\brel=["']stylesheet["']/.test(tag)) return tag;
    const href = tag.match(/\bhref=["']([^"']+)["']/)?.[1];
    if (!href) return tag;
    const content = files[sourceLookupPath(href)] ?? files[localAssetPath(href)];
    if (content !== undefined) styles.push(content);
    return tag;
  });
  return styles.join("\n\n");
}

function collectLinkedScripts(entryHtml: string, files: Record<string, string>): string {
  const scripts: string[] = [];
  entryHtml.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g, (_tag, src: string) => {
    const content = files[sourceLookupPath(src)] ?? files[localAssetPath(src)];
    if (content !== undefined) scripts.push(content);
    return "";
  });
  return scripts.join("\n\n");
}

function neutralizePageBackground(css: string): string {
  return css.replace(
    /((?:html|body|html\s*,\s*body|body\s*,\s*html)\s*\{[^}]*?background(?:-color)?\s*:\s*)[^;]+/gi,
    "$1transparent"
  );
}

function extractDataUrlAssets(
  files: Record<string, string>,
  manifest: MotionManifest,
  patch: MotionPatch
): { files: Record<string, string>; assets: Record<string, Uint8Array> } {
  const output = { ...files };
  const assets: Record<string, Uint8Array> = {};
  const namedAssetPaths = new Map<string, string>();
  let unnamedAssetCount = 0;
  const imageParams = manifest.params.filter((param) => param.type === "image");
  const dataUrlPattern = /data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)/g;

  function assetPathFor(dataUrl: string, mimeType: string): string {
    const matchedParam = imageParams.find(
      (param) => patch.values[param.id] === dataUrl || param.default === dataUrl
    );
    const baseName = fileNameSafe(matchedParam?.id ?? "") || `image-${(unnamedAssetCount += 1)}`;
    const extension = extensionForMimeType(mimeType);
    const path = `assets/${baseName}.${extension}`;
    namedAssetPaths.set(dataUrl, path);
    return path;
  }

  for (const [path, content] of Object.entries(files)) {
    output[path] = content.replace(dataUrlPattern, (dataUrl, mimeType: string, base64: string) => {
      const assetPath = namedAssetPaths.get(dataUrl) ?? assetPathFor(dataUrl, mimeType);
      if (!assets[assetPath]) assets[assetPath] = decodeBase64(base64);
      return `./${assetPath}`;
    });
  }

  return { files: output, assets };
}

function safeScriptContent(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script");
}

function embedRuntimeScript(fragment: string, css: string, componentScript: string): string {
  const widgetBody = `<div class="motion-widget-root">
${fragment}
</div>`;

  return `(() => {
  const WIDGET_BODY = ${JSON.stringify(widgetBody)};
  const WIDGET_CSS = ${JSON.stringify(css)};
  const COMPONENT_SCRIPT = ${JSON.stringify(safeScriptContent(componentScript))};

  function escapeAttribute(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  }

  function packageBaseHref() {
    const script = document.currentScript;
    if (script instanceof HTMLScriptElement && script.src) {
      return new URL("./", script.src).href;
    }
    return document.baseURI;
  }

  function composeSrcdoc(baseHref) {
    return \`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base href="\${escapeAttribute(baseHref)}" />
    <style>
      html,
      body {
        margin: 0;
        background: transparent;
      }
      .motion-widget-root {
        display: inline-block;
        background: transparent;
      }
      \${WIDGET_CSS}
    </style>
  </head>
  <body>
    \${WIDGET_BODY}
    <script>\${COMPONENT_SCRIPT}<\\/script>
  </body>
</html>\`;
  }

  function callIfAvailable(targetWindow, name, ...args) {
    const candidate = targetWindow && targetWindow[name];
    if (typeof candidate === "function") return candidate(...args);
    return undefined;
  }

  function mount(container) {
    const target = typeof container === "string" ? document.querySelector(container) : container;
    if (!(target instanceof Element)) throw new Error("MotionWidget.mount target not found.");
    target.innerHTML = "";
    target.classList.add("motion-widget-host");
    const iframe = document.createElement("iframe");
    iframe.className = "motion-widget-frame";
    iframe.title = "Motion widget";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("allowtransparency", "true");
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.display = "block";
    iframe.style.width = "100%";
    iframe.style.minWidth = "1px";
    iframe.style.minHeight = "1px";
    iframe.srcdoc = composeSrcdoc(packageBaseHref());
    const pendingCalls = [];
    let isReady = false;
    function fitFrame() {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const root = doc.querySelector("[data-motion-root]") || doc.body.firstElementChild || doc.documentElement;
      const rect = root.getBoundingClientRect();
      const width = Math.ceil(Math.max(rect.width, doc.documentElement.scrollWidth, doc.body.scrollWidth, 1));
      const height = Math.ceil(Math.max(rect.height, doc.documentElement.scrollHeight, doc.body.scrollHeight, 1));
      iframe.style.width = width + "px";
      iframe.style.height = height + "px";
    }
    iframe.addEventListener("load", () => {
      isReady = true;
      fitFrame();
      const frameWindow = iframe.contentWindow;
      if (frameWindow && "ResizeObserver" in frameWindow) {
        const observer = new frameWindow.ResizeObserver(fitFrame);
        if (iframe.contentDocument?.documentElement) observer.observe(iframe.contentDocument.documentElement);
        if (iframe.contentDocument?.body) observer.observe(iframe.contentDocument.body);
      }
      for (const call of pendingCalls.splice(0)) call();
    });
    target.append(iframe);

    function run(name, ...args) {
      const invoke = () => callIfAvailable(iframe.contentWindow, name, ...args);
      if (isReady) return invoke();
      pendingCalls.push(invoke);
      return undefined;
    }

    return {
      frame: iframe,
      replay() {
        return run("motionReplay");
      },
      pause() {
        return run("motionPause");
      },
      seek(progress) {
        return run("motionSeek", progress);
      },
      destroy() {
        iframe.remove();
      }
    };
  }

  window.MotionWidget = { mount };
})();`;
}

function composeWidgetCss(css: string): string {
  return `.motion-widget-host,
.motion-widget-root {
  background: transparent;
}

.motion-widget-host {
  display: inline-block;
  line-height: 0;
}

.motion-widget-frame {
  border: 0;
  background: transparent;
  display: block;
}

${neutralizePageBackground(css)}

html,
body {
  background: transparent;
}`;
}

function composeWidgetHtml(fragment: string): string {
  return `<template id="motion-widget-template">
  <div class="motion-widget-root">
${fragment
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
  </div>
</template>`;
}

function composeDemoHtml(manifest: MotionManifest): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.name)} - embed demo</title>
    <link rel="stylesheet" href="./motion-widget.css" />
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
      }
      body {
        display: grid;
        place-items: center;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <div id="motion-slot"></div>
    <script src="./motion-widget.js"></script>
    <script>
      const widget = window.MotionWidget.mount("#motion-slot");
      widget.replay();
    </script>
  </body>
</html>`;
}

function composeEmbedExampleHtml(manifest: MotionManifest): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.name)} - embed example</title>
    <link rel="stylesheet" href="./motion-widget.css" />
  </head>
  <body>
    <div id="motion-slot"></div>
    <script src="./motion-widget.js"></script>
    <script>
      const widget = window.MotionWidget.mount("#motion-slot");
      widget.replay();
    </script>
  </body>
</html>`;
}

function composeEmbedReadme(manifest: MotionManifest): string {
  return `# ${manifest.name}

This package is an embeddable motion component export.

## Files

- demo.html: runnable preview page with a transparent page background.
- embed.html: minimal host-page example.
- motion-widget.css: component styles. The widget root is transparent by default.
- motion-widget.js: runtime with MotionWidget.mount(container).
- motion-widget.html: DOM template for inspection or manual integration.
- assets/: images extracted from uploaded or patched data URLs.
- manifest.json: component metadata snapshot.
- motion.patch.json: parameter values used for this export.

## DOM embed

\`\`\`html
<link rel="stylesheet" href="./motion-widget.css" />
<div id="motion-slot"></div>
<script src="./motion-widget.js"></script>
<script>
  const widget = MotionWidget.mount("#motion-slot");
  widget.replay();
</script>
\`\`\`

## Runtime API

- widget.replay()
- widget.pause()
- widget.seek(progress)
- widget.destroy()

The exported widget does not add a pink preview background. If the component has its own background layer, that layer is preserved.
`;
}

export function composeEmbedPackageFiles(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  metadata: Record<string, unknown>;
  patch: MotionPatch;
}): Record<string, EmbedPackageFileContent> {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });
  const extracted = extractDataUrlAssets(patchedFiles, input.manifest, input.patch);
  const entry = extracted.files[input.manifest.runtime.entry] ?? "";
  const widgetFragment = extractBodyHtml(entry);
  const sourceCss = neutralizePageBackground(collectLinkedStyles(entry, extracted.files));
  const widgetHtml = composeWidgetHtml(widgetFragment);
  const widgetCss = composeWidgetCss(sourceCss);
  const widgetJs = embedRuntimeScript(
    widgetFragment,
    sourceCss,
    collectLinkedScripts(entry, extracted.files)
  );

  return {
    "demo.html": composeDemoHtml(input.manifest),
    "embed.html": composeEmbedExampleHtml(input.manifest),
    "motion-widget.html": widgetHtml,
    "motion-widget.css": widgetCss,
    "motion-widget.js": widgetJs,
    "manifest.json": JSON.stringify(
      {
        ...input.metadata,
        manifest: input.manifest,
        entry: "motion-widget.js",
        style: "motion-widget.css",
        template: "motion-widget.html",
        transparentBackground: true
      },
      null,
      2
    ),
    "motion.patch.json": JSON.stringify(input.patch, null, 2),
    "README.md": composeEmbedReadme(input.manifest),
    ...extracted.assets
  };
}
