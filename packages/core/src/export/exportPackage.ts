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

function json(value: unknown): string {
  return JSON.stringify(value);
}

function prefixedAssets(assets: Record<string, Uint8Array>): Record<string, Uint8Array> {
  return Object.fromEntries(Object.entries(assets).map(([path, content]) => [`dist/${path}`, content]));
}

function paramRuntimeMetadata(manifest: MotionManifest): unknown[] {
  return manifest.params.map((param) => ({
    id: param.id,
    type: param.type,
    unit: param.constraints?.unit,
    targets: param.targets
  }));
}

function packageNameFor(metadata: Record<string, unknown>, manifest: MotionManifest): string {
  const rawName = String(metadata.id ?? manifest.id ?? manifest.name);
  return `@ai-motion/${fileNameSafe(rawName) || "motion-widget"}`;
}

function runtimeCore(): string {
  return `const DEFAULT_OPTIONS = {
  autoplay: false,
  title: "Motion widget"
};

function normalizeBaseUrl(baseUrl) {
  const rawBaseUrl = typeof baseUrl === "string" && baseUrl.length > 0 ? baseUrl : "./";
  return new URL(rawBaseUrl.endsWith("/") ? rawBaseUrl : rawBaseUrl + "/", document.baseURI).href;
}

function resolveIframeUrl(baseUrl) {
  return new URL("dist/iframe.html", normalizeBaseUrl(baseUrl)).href;
}

function resolveContainer(container) {
  const target = typeof container === "string" ? document.querySelector(container) : container;
  if (!(target instanceof Element)) throw new Error("mountMotionWidget target not found.");
  return target;
}

function mountMotionWidget(container, options = {}) {
  const target = resolveContainer(container);
  const nextOptions = { ...DEFAULT_OPTIONS, ...options };
  const iframe = document.createElement("iframe");
  const pendingMessages = [];
  let isReady = false;
  let isDestroyed = false;

  function post(message) {
    if (isDestroyed) return;
    if (!isReady || !iframe.contentWindow) {
      pendingMessages.push(message);
      return;
    }
    iframe.contentWindow.postMessage(message, "*");
  }

  function flush() {
    while (pendingMessages.length > 0) {
      const message = pendingMessages.shift();
      if (message) post(message);
    }
  }

  function handleMessage(event) {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== "object" || typeof data.type !== "string") return;
    if (data.type === "ai-motion:ready") {
      isReady = true;
      resize(data);
      initializeFrame();
      flush();
      if (typeof nextOptions.onReady === "function") nextOptions.onReady(handle);
    }
    if (data.type === "ai-motion:resize") resize(data);
    if (data.type === "ai-motion:error" && typeof nextOptions.onError === "function") {
      nextOptions.onError(new Error(String(data.message || "Motion widget error")));
    }
  }

  function initializeFrame() {
    post({
      type: "ai-motion:init",
      params: nextOptions.params || {},
      autoplay: Boolean(nextOptions.autoplay)
    });
  }

  function resize(data) {
    const width = Math.ceil(Math.max(Number(data.width) || 0, 1));
    const height = Math.ceil(Math.max(Number(data.height) || 0, 1));
    iframe.style.width = width + "px";
    iframe.style.height = height + "px";
  }

  target.innerHTML = "";
  target.classList.add("motion-widget-host");
  iframe.className = "motion-widget-frame";
  iframe.title = String(nextOptions.title || DEFAULT_OPTIONS.title);
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.display = "block";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.src = resolveIframeUrl(nextOptions.baseUrl);
  iframe.addEventListener("load", initializeFrame);
  window.addEventListener("message", handleMessage);
  target.append(iframe);

  const handle = {
    frame: iframe,
    replay() {
      post({ type: "ai-motion:replay" });
    },
    pause() {
      post({ type: "ai-motion:pause" });
    },
    seek(progress) {
      post({ type: "ai-motion:seek", progress });
    },
    update(params) {
      post({ type: "ai-motion:update", params: params || {} });
    },
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      iframe.removeEventListener("load", initializeFrame);
      window.removeEventListener("message", handleMessage);
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "ai-motion:destroy" }, "*");
      }
      iframe.remove();
    }
  };

  return handle;
}`;
}

function composeEsmRuntime(): string {
  return `${runtimeCore()}

export { mountMotionWidget };
export default { mountMotionWidget };
`;
}

function composeUmdRuntime(): string {
  return `(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AiMotionWidget = api;
  root.MotionWidget = { mount: api.mountMotionWidget };
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
${runtimeCore()
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n")}

  return {
    mountMotionWidget,
    mount: mountMotionWidget
  };
});
`;
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

function composeIframeHtml(manifest: MotionManifest, fragment: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.name)}</title>
    <link rel="stylesheet" href="./iframe.css" />
  </head>
  <body>
    <div class="motion-widget-root">
${fragment
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
    </div>
    <script src="./iframe.js"></script>
  </body>
</html>`;
}

function composeIframeScript(componentScript: string, manifest: MotionManifest): string {
  return `${componentScript}

(() => {
  const PARAMS = ${json(paramRuntimeMetadata(manifest))};
  const root = document.querySelector("[data-motion-root]") || document.body;
  let observer = null;

  function cssValue(param, value) {
    if (value === undefined || value === null) return "";
    if (param.type === "image" && typeof value === "string" && !value.startsWith("url(")) {
      return "url(" + JSON.stringify(value) + ")";
    }
    if (typeof value === "number" && param.unit) return String(value) + param.unit;
    return String(value);
  }

  function applyParams(params) {
    if (!params || typeof params !== "object") return;
    for (const param of PARAMS) {
      if (!Object.prototype.hasOwnProperty.call(params, param.id)) continue;
      const value = params[param.id];
      for (const target of param.targets || []) {
        const element = target.selector ? document.querySelector(target.selector) : null;
        if (target.kind === "css-variable" && element instanceof HTMLElement) {
          element.style.setProperty(target.name, cssValue(param, value));
        }
        if (target.kind === "css-property" && element instanceof HTMLElement) {
          element.style.setProperty(target.property, cssValue(param, value));
        }
        if (target.kind === "html-text" && element) {
          element.textContent = String(value ?? "");
        }
        if ((target.kind === "html-attribute" || target.kind === "svg-attribute") && element) {
          element.setAttribute(target.attribute, String(value ?? ""));
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(params, "selectedIndex")) {
      selectIndex(params.selectedIndex);
    }
    reportSize("ai-motion:resize");
  }

  function selectIndex(value) {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0) return;
    const exactTarget = document.querySelector("[data-bottom-tab='" + index + "']");
    if (exactTarget instanceof HTMLElement) {
      exactTarget.click();
      return;
    }
    for (const selector of [".bottom-tabbar-item", ".channel-tab", ".tab-item", "[role='tab']", "button"]) {
      const target = Array.from(document.querySelectorAll(selector))[index];
      if (target instanceof HTMLElement) {
        target.click();
        return;
      }
    }
  }

  function callIfAvailable(name, ...args) {
    const candidate = window[name];
    if (typeof candidate === "function") return candidate(...args);
    return undefined;
  }

  function reportSize(type) {
    const element = document.querySelector("[data-motion-root]") || document.body.firstElementChild || document.documentElement;
    const rect = element.getBoundingClientRect();
    let contentRight = rect.right;
    let contentBottom = rect.bottom;
    for (const child of document.body.querySelectorAll("*")) {
      const childRect = child.getBoundingClientRect();
      contentRight = Math.max(contentRight, childRect.right);
      contentBottom = Math.max(contentBottom, childRect.bottom);
    }
    const width = Math.ceil(Math.max(contentRight, rect.width, document.documentElement.scrollWidth, document.body.scrollWidth, 1));
    const height = Math.ceil(Math.max(contentBottom, rect.height, document.documentElement.scrollHeight, document.body.scrollHeight, 1));
    window.parent.postMessage({ type, width, height }, "*");
  }

  function handleMessage(event) {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== "object" || typeof data.type !== "string") return;
    try {
      if (data.type === "ai-motion:init") {
        applyParams(data.params || {});
        if (data.autoplay) callIfAvailable("motionReplay");
      }
      if (data.type === "ai-motion:update") applyParams(data.params || {});
      if (data.type === "ai-motion:replay") callIfAvailable("motionReplay");
      if (data.type === "ai-motion:pause") callIfAvailable("motionPause");
      if (data.type === "ai-motion:seek") callIfAvailable("motionSeek", data.progress);
      if (data.type === "ai-motion:destroy") window.removeEventListener("message", handleMessage);
    } catch (error) {
      window.parent.postMessage({
        type: "ai-motion:error",
        message: error instanceof Error ? error.message : String(error)
      }, "*");
    }
  }

  window.addEventListener("message", handleMessage);
  window.addEventListener("load", () => reportSize("ai-motion:resize"));
  if ("ResizeObserver" in window) {
    observer = new ResizeObserver(() => reportSize("ai-motion:resize"));
    observer.observe(document.documentElement);
    observer.observe(document.body);
    if (root instanceof Element) observer.observe(root);
  }
  window.addEventListener("pagehide", () => observer?.disconnect(), { once: true });
  reportSize("ai-motion:ready");
  window.requestAnimationFrame(() => reportSize("ai-motion:resize"));
  window.setTimeout(() => reportSize("ai-motion:resize"), 50);
})();
`;
}

function composeDemoHtml(manifest: MotionManifest): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.name)} - embed demo</title>
    <link rel="stylesheet" href="./dist/style.css" />
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
    <script src="./dist/index.umd.js"></script>
    <script>
      const widget = window.AiMotionWidget.mountMotionWidget("#motion-slot", {
        baseUrl: "./",
        autoplay: true
      });
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
    <link rel="stylesheet" href="./dist/style.css" />
  </head>
  <body>
    <div id="motion-slot"></div>
    <script src="./dist/index.umd.js"></script>
    <script>
      const widget = window.AiMotionWidget.mountMotionWidget("#motion-slot", {
        baseUrl: "./"
      });
      widget.replay();
    </script>
  </body>
</html>`;
}

function composeVanillaExampleHtml(manifest: MotionManifest): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(manifest.name)} - vanilla example</title>
    <link rel="stylesheet" href="../dist/style.css" />
  </head>
  <body>
    <div id="motion-slot"></div>
    <script src="../dist/index.umd.js"></script>
    <script>
      const widget = window.AiMotionWidget.mountMotionWidget("#motion-slot", {
        baseUrl: "../",
        params: { selectedIndex: 0 }
      });
      widget.update({ selectedIndex: 1 });
    </script>
  </body>
</html>`;
}

function composeReactWrapperCjs(): string {
  return `const React = require("react");
const { mountMotionWidget } = require("../dist/index.umd.js");

const MotionWidget = React.forwardRef(function MotionWidget(props, ref) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const latestCallbacks = React.useRef({
    onReady: props.onReady,
    onError: props.onError
  });

  latestCallbacks.current.onReady = props.onReady;
  latestCallbacks.current.onError = props.onError;

  React.useEffect(() => {
    if (!hostRef.current) return undefined;
    handleRef.current = mountMotionWidget(hostRef.current, {
      baseUrl: props.baseUrl,
      params: props.params,
      autoplay: props.autoplay,
      title: props.title,
      onReady: (handle) => latestCallbacks.current.onReady?.(handle),
      onError: (error) => latestCallbacks.current.onError?.(error)
    });
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [props.baseUrl]);

  React.useEffect(() => {
    handleRef.current?.update(props.params || {});
  }, [props.params]);

  React.useImperativeHandle(ref, () => ({
    get frame() {
      return handleRef.current?.frame || null;
    },
    replay() {
      handleRef.current?.replay();
    },
    pause() {
      handleRef.current?.pause();
    },
    seek(progress) {
      handleRef.current?.seek(progress);
    },
    update(params) {
      handleRef.current?.update(params);
    },
    destroy() {
      handleRef.current?.destroy();
    }
  }), []);

  return React.createElement("div", { ref: hostRef, className: props.className });
});

module.exports = { MotionWidget };
`;
}

function composeReactWrapperEsm(): string {
  return `import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { mountMotionWidget } from "../dist/index.esm.mjs";

const MotionWidget = forwardRef(function MotionWidget(props, ref) {
  const hostRef = useRef(null);
  const handleRef = useRef(null);
  const latestCallbacks = useRef({
    onReady: props.onReady,
    onError: props.onError
  });

  latestCallbacks.current.onReady = props.onReady;
  latestCallbacks.current.onError = props.onError;

  useEffect(() => {
    if (!hostRef.current) return undefined;
    handleRef.current = mountMotionWidget(hostRef.current, {
      baseUrl: props.baseUrl,
      params: props.params,
      autoplay: props.autoplay,
      title: props.title,
      onReady: (handle) => latestCallbacks.current.onReady?.(handle),
      onError: (error) => latestCallbacks.current.onError?.(error)
    });
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [props.baseUrl]);

  useEffect(() => {
    handleRef.current?.update(props.params || {});
  }, [props.params]);

  useImperativeHandle(ref, () => ({
    get frame() {
      return handleRef.current?.frame || null;
    },
    replay() {
      handleRef.current?.replay();
    },
    pause() {
      handleRef.current?.pause();
    },
    seek(progress) {
      handleRef.current?.seek(progress);
    },
    update(params) {
      handleRef.current?.update(params);
    },
    destroy() {
      handleRef.current?.destroy();
    }
  }), []);

  return React.createElement("div", { ref: hostRef, className: props.className });
});

export { MotionWidget };
`;
}

function composeTypes(): string {
  return `export type MotionWidgetParams = Record<string, unknown>;

export type MotionWidgetOptions = {
  baseUrl: string;
  params?: MotionWidgetParams;
  autoplay?: boolean;
  className?: string;
  title?: string;
  onReady?: (handle: MotionWidgetHandle) => void;
  onError?: (error: Error) => void;
};

export type MotionWidgetHandle = {
  frame: HTMLIFrameElement;
  replay(): void;
  pause(): void;
  seek(progress: number): void;
  update(params: MotionWidgetParams): void;
  destroy(): void;
};

export function mountMotionWidget(
  container: Element | string,
  options: MotionWidgetOptions
): MotionWidgetHandle;
`;
}

function composeReactTypes(): string {
  return `import type * as React from "react";
import type { MotionWidgetHandle, MotionWidgetParams } from "../dist/index";

export type MotionWidgetReactProps = {
  baseUrl: string;
  params?: MotionWidgetParams;
  autoplay?: boolean;
  className?: string;
  title?: string;
  onReady?: (handle: MotionWidgetHandle) => void;
  onError?: (error: Error) => void;
};

export const MotionWidget: React.ForwardRefExoticComponent<
  MotionWidgetReactProps & React.RefAttributes<MotionWidgetHandle>
>;
`;
}

function composeNutuiReactExample(manifest: MotionManifest): string {
  return `import React, { useRef, useState } from "react";
import { Button } from "@nutui/nutui-react";
import { MotionWidget } from "../react";
import "../dist/style.css";
import type { MotionWidgetHandle } from "../dist";

export default function ${
    fileNameSafe(manifest.id)
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") || "MotionWidgetDemo"
  }() {
  const widgetRef = useRef<MotionWidgetHandle>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  function next() {
    const value = (selectedIndex + 1) % 5;
    setSelectedIndex(value);
  }

  return (
    <div>
      <MotionWidget
        ref={widgetRef}
        baseUrl="/static/motion/${fileNameSafe(manifest.id) || "motion-widget"}/"
        params={{ selectedIndex }}
      />
      <Button type="primary" onClick={next}>
        切换
      </Button>
      <Button onClick={() => widgetRef.current?.replay()}>
        重播
      </Button>
    </div>
  );
}
`;
}

function composeReact18Example(manifest: MotionManifest): string {
  return `import React, { useState } from "react";
import { MotionWidget } from "../react";
import "../dist/style.css";

export function ${
    fileNameSafe(manifest.id)
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") || "MotionWidgetExample"
  }() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <MotionWidget
      baseUrl="/static/motion/${fileNameSafe(manifest.id) || "motion-widget"}/"
      params={{ selectedIndex }}
      onReady={() => setSelectedIndex(1)}
    />
  );
}
`;
}

function composePackageJson(input: { manifest: MotionManifest; metadata: Record<string, unknown> }): string {
  return JSON.stringify(
    {
      name: packageNameFor(input.metadata, input.manifest),
      version: "1.0.0",
      main: "dist/index.umd.js",
      module: "dist/index.esm.mjs",
      types: "dist/index.d.ts",
      style: "dist/style.css",
      peerDependencies: {
        react: "^16.8.0 || ^17.0.0 || ^18.0.0"
      },
      sideEffects: ["dist/style.css"],
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.esm.mjs",
          require: "./dist/index.umd.js"
        },
        "./react": {
          types: "./react/index.d.ts",
          import: "./react/index.esm.mjs",
          require: "./react/index.js"
        },
        "./style.css": "./dist/style.css"
      }
    },
    null,
    2
  );
}

function composeEmbedReadme(manifest: MotionManifest): string {
  return `# ${manifest.name}

This package is an embeddable AI Motion widget export.

## Files

- package.json: npm-style package metadata.
- dist/index.esm.mjs: framework-agnostic ESM runtime.
- dist/index.umd.js: browser script and CommonJS runtime.
- dist/index.d.ts: runtime type declarations.
- dist/style.css: host-page styles.
- dist/iframe.html: isolated motion iframe page.
- dist/iframe.css: isolated motion styles.
- dist/iframe.js: isolated motion script and message protocol.
- dist/assets/: images extracted from uploaded or patched data URLs.
- react/index.js: React 16.8/17/18 compatible wrapper.
- react/index.d.ts: React wrapper types.
- examples/: vanilla, React, and NutUI React examples.
- manifest.json: component metadata snapshot for debugging.
- motion.patch.json: parameter values used for this export.

## Vanilla embed

\`\`\`html
<link rel="stylesheet" href="./dist/style.css" />
<div id="motion-slot"></div>
<script src="./dist/index.umd.js"></script>
<script>
  const widget = AiMotionWidget.mountMotionWidget("#motion-slot", {
    baseUrl: "/static/motion/${fileNameSafe(manifest.id) || "motion-widget"}/",
    params: { selectedIndex: 0 }
  });
  widget.replay();
</script>
\`\`\`

## React embed

\`\`\`tsx
import { MotionWidget } from "@ai-motion/${fileNameSafe(manifest.id) || "motion-widget"}/react";
import "@ai-motion/${fileNameSafe(manifest.id) || "motion-widget"}/style.css";

<MotionWidget
  baseUrl="/static/motion/${fileNameSafe(manifest.id) || "motion-widget"}/"
  params={{ selectedIndex }}
/>;
\`\`\`

## Runtime API

- mountMotionWidget(container, options)
- widget.update(params)
- widget.replay()
- widget.pause()
- widget.seek(progress)
- widget.destroy()

## baseUrl

\`baseUrl\` must point to the package root. The runtime loads \`dist/iframe.html\` from that root.

## Notes

The widget runs in an iframe to avoid leaking styles or scripts into the host page. Unknown runtime params are ignored safely. The exported widget does not add a pink preview background. If the component has its own background layer, that layer is preserved.
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
  const widgetCss = composeWidgetCss(sourceCss);
  const componentScript = collectLinkedScripts(entry, extracted.files);
  const metadata = {
    ...input.metadata,
    manifest: input.manifest,
    entry: "dist/index.esm.mjs",
    umd: "dist/index.umd.js",
    style: "dist/style.css",
    react: "react/index.js",
    iframe: "dist/iframe.html",
    transparentBackground: true
  };

  return {
    "package.json": composePackageJson({ manifest: input.manifest, metadata: input.metadata }),
    "demo.html": composeDemoHtml(input.manifest),
    "embed.html": composeEmbedExampleHtml(input.manifest),
    "dist/index.esm.mjs": composeEsmRuntime(),
    "dist/index.umd.js": composeUmdRuntime(),
    "dist/index.d.ts": composeTypes(),
    "dist/style.css": widgetCss,
    "dist/iframe.html": composeIframeHtml(input.manifest, widgetFragment),
    "dist/iframe.css": widgetCss,
    "dist/iframe.js": composeIframeScript(componentScript, input.manifest),
    "react/index.js": composeReactWrapperCjs(),
    "react/index.esm.mjs": composeReactWrapperEsm(),
    "react/index.d.ts": composeReactTypes(),
    "examples/vanilla.html": composeVanillaExampleHtml(input.manifest),
    "examples/nutui-react-demo.tsx": composeNutuiReactExample(input.manifest),
    "examples/react18.tsx": composeReact18Example(input.manifest),
    "manifest.json": JSON.stringify(metadata, null, 2),
    "motion.patch.json": JSON.stringify(input.patch, null, 2),
    "README.md": composeEmbedReadme(input.manifest),
    ...prefixedAssets(extracted.assets)
  };
}
