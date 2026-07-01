import { describe, expect, it } from "vitest";
import {
  composeEditablePackageFiles,
  composeEmbedPackageFiles,
  composeStandaloneHtmlFile
} from "../src/export/exportPackage";
import type { MotionManifest, MotionPatch } from "../src/manifest/types";

describe("composeEditablePackageFiles", () => {
  it("includes source, manifest, metadata, and patch", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "hero",
      name: "Hero",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "hero", values: {} };

    const files = composeEditablePackageFiles({
      sourceFiles: { "source/index.html": "<h1>Hello</h1>" },
      manifest,
      metadata: { id: "hero", name: "Hero" },
      patch
    });

    expect(files["motion.manifest.json"]).toContain('"id": "hero"');
    expect(files["motion.patch.json"]).toContain('"sourceManifestId": "hero"');
    expect(files["source/index.html"]).toBe("<h1>Hello</h1>");
  });

  it("exports editable source files with the current patch applied", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "hero",
      name: "Hero",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "duration",
          label: "Duration",
          type: "duration",
          default: 600,
          status: "confirmed",
          constraints: { unit: "ms" },
          targets: [
            {
              kind: "css-variable",
              file: "source/style.css",
              selector: ":root",
              name: "--motion-duration"
            }
          ]
        }
      ]
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "hero", values: { duration: 900 } };

    const files = composeEditablePackageFiles({
      sourceFiles: {
        "source/index.html": '<link rel="stylesheet" href="./style.css" />',
        "source/style.css": ":root { --motion-duration: 600ms; }"
      },
      manifest,
      metadata: { id: "hero", name: "Hero" },
      patch
    });

    expect(files["source/style.css"]).toContain("--motion-duration: 900ms");
    expect(files["motion.patch.json"]).toContain('"duration": 900');
  });

  it("composes a runnable standalone HTML file with patched CSS and JS inlined", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "hero",
      name: "Hero",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "duration",
          label: "Duration",
          type: "duration",
          default: 600,
          status: "confirmed",
          constraints: { min: 100, max: 2000, step: 50, unit: "ms" },
          targets: [
            {
              kind: "css-variable",
              file: "source/style.css",
              selector: ":root",
              name: "--motion-duration"
            }
          ]
        }
      ]
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "hero", values: { duration: 900 } };

    const html = composeStandaloneHtmlFile({
      sourceFiles: {
        "source/index.html":
          '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><div class="hero"></div><script src="./script.js"></script></body></html>',
        "source/style.css":
          ":root { --motion-duration: 600ms; } .hero { animation-duration: var(--motion-duration); }",
        "source/script.js": "document.body.dataset.ready = 'true';"
      },
      manifest,
      patch
    });

    expect(html).toContain("<style>");
    expect(html).toContain("--motion-duration: 900ms");
    expect(html).toContain("<script>document.body.dataset.ready = 'true';</script>");
    expect(html).not.toContain('href="./style.css"');
    expect(html).not.toContain('src="./script.js"');
  });

  it("inlines resolved externalized CSS content into standalone HTML", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "product",
      name: "Product",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "product", values: {} };

    const html = composeStandaloneHtmlFile({
      sourceFiles: {
        "source/index.html": '<link rel="stylesheet" href="./assets.css" /><main></main>',
        "source/assets.css": ":root { --hero-image: url(data:image/png;base64,abc); }"
      },
      manifest,
      patch
    });

    expect(html).toContain("<style>");
    expect(html).toContain("--hero-image");
    expect(html).toContain("data:image/png;base64,abc");
    expect(html).not.toContain('href="./assets.css"');
  });
});

describe("composeEmbedPackageFiles", () => {
  function rect(width: number, height: number, left = 0, top = 0) {
    return {
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height
    };
  }

  it("exports patched params, extracted image assets, transparent embed files, and runtime API", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "popup",
      name: "Popup",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "backgroundImage",
          label: "Background",
          type: "image",
          default: "",
          status: "confirmed",
          targets: [
            {
              kind: "html-attribute",
              file: "source/index.html",
              selector: "[data-motion=backgroundImage]",
              attribute: "src"
            }
          ]
        },
        {
          id: "duration",
          label: "Duration",
          type: "duration",
          default: 600,
          status: "confirmed",
          constraints: { unit: "ms" },
          targets: [
            {
              kind: "css-variable",
              file: "source/style.css",
              selector: ":root",
              name: "--motion-duration"
            }
          ]
        }
      ]
    };
    const patch: MotionPatch = {
      id: "patch",
      sourceManifestId: "popup",
      values: {
        backgroundImage: "data:image/png;base64,QUJD",
        duration: 900
      }
    };

    const files = composeEmbedPackageFiles({
      sourceFiles: {
        "source/index.html":
          '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><main data-motion-root><img data-motion="backgroundImage" src="" /></main><script src="./script.js"></script></body></html>',
        "source/style.css": "body { background: #ffeef2; } :root { --motion-duration: 600ms; }",
        "source/script.js":
          "window.motionReplay = function motionReplay() { document.body.dataset.playing = 'true'; };"
      },
      manifest,
      metadata: { id: "popup-project", name: "Popup" },
      patch
    });

    expect(files["package.json"]).toContain('"module": "dist/index.esm.mjs"');
    expect(files["package.json"]).toContain('"import": "./react/index.esm.mjs"');
    expect(files["package.json"]).toContain('"react": "^16.8.0 || ^17.0.0 || ^18.0.0"');
    expect(files["dist/assets/background-image.png"]).toBeInstanceOf(Uint8Array);
    expect(files["dist/iframe.html"]).toContain('src="./assets/background-image.png"');
    expect(files["dist/iframe.html"]).not.toContain("data:image/png;base64");
    expect(files["dist/iframe.css"]).toContain("--motion-duration: 900ms");
    expect(files["dist/iframe.css"]).toContain("background: transparent");
    expect(files["dist/iframe.css"]).not.toContain("#ffeef2");
    expect(files["dist/index.esm.mjs"]).toContain("export { mountMotionWidget }");
    expect(files["dist/index.esm.mjs"]).toContain('new URL("dist/iframe.html"');
    expect(files["dist/index.esm.mjs"]).toContain("postMessage(message");
    expect(files["dist/index.esm.mjs"]).not.toContain("iframe.srcdoc");
    expect(files["dist/index.umd.js"]).toContain("root.AiMotionWidget");
    expect(files["dist/index.umd.js"]).toContain("root.MotionWidget = { mount: api.mountMotionWidget }");
    expect(files["dist/iframe.js"]).toContain('"ai-motion:update"');
    expect(files["dist/iframe.js"]).toContain('"selectedIndex"');
    expect(files["dist/index.d.ts"]).toContain("update(params: MotionWidgetParams): void");
    expect(files["react/index.js"]).toContain("React.forwardRef");
    expect(files["react/index.js"]).toContain("handleRef.current?.destroy()");
    expect(files["react/index.esm.mjs"]).toContain("import React, { forwardRef");
    expect(files["react/index.esm.mjs"]).toContain("export { MotionWidget }");
    expect(files["react/index.d.ts"]).toContain("ForwardRefExoticComponent");
    expect(files["examples/nutui-react-demo.tsx"]).toContain("@nutui/nutui-react");
    expect(files["demo.html"]).toContain("background: transparent");
    expect(files["embed.html"]).toContain("AiMotionWidget.mountMotionWidget");
    expect(files["README.md"]).toContain("React 16.8/17/18 compatible wrapper");
    expect(files["manifest.json"]).toContain('"transparentBackground": true');
    expect(files["manifest.json"]).toContain('"react": "react/index.js"');
    expect(files["motion.patch.json"]).toContain('"duration": 900');
  });

  it("mounts the generated UMD runtime, flushes queued commands, updates params, and destroys cleanly", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "tabbar",
      name: "Tabbar",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "tabbar", values: {} };
    const files = composeEmbedPackageFiles({
      sourceFiles: {
        "source/index.html": "<main data-motion-root></main>",
        "source/style.css": "",
        "source/script.js": ""
      },
      manifest,
      metadata: { id: "tabbar-project", name: "Tabbar" },
      patch
    });
    const runtime = String(files["dist/index.umd.js"]);
    const postedMessages: unknown[] = [];
    const listeners = new Map<string, Set<(event: unknown) => void>>();
    const iframe = {
      className: "",
      title: "",
      src: "",
      style: {} as Record<string, string>,
      contentWindow: {
        postMessage(message: unknown) {
          postedMessages.push(message);
        }
      },
      setAttribute() {},
      addEventListener() {},
      removeEventListener() {},
      removeCalls: 0,
      remove() {
        this.removeCalls += 1;
      }
    };
    const target = {
      innerHTML: "stale",
      appended: null as unknown,
      classList: { add() {} },
      append(child: unknown) {
        this.appended = child;
      }
    };
    const documentMock = {
      baseURI: "https://example.com/page/",
      createElement(tag: string) {
        expect(tag).toBe("iframe");
        return iframe;
      },
      querySelector(selector: string) {
        expect(selector).toBe("#slot");
        return target;
      }
    };
    const windowMock = {
      addEventListener(type: string, listener: (event: unknown) => void) {
        const bucket = listeners.get(type) ?? new Set();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener(type: string, listener: (event: unknown) => void) {
        listeners.get(type)?.delete(listener);
      }
    };
    const globalMock = {
      window: windowMock,
      document: documentMock,
      Element: Object,
      HTMLIFrameElement: Object,
      globalThis: windowMock
    };

    new Function("window", "document", "Element", "HTMLIFrameElement", "globalThis", runtime)(
      globalMock.window,
      globalMock.document,
      globalMock.Element,
      globalMock.HTMLIFrameElement,
      globalMock.globalThis
    );

    const api = (windowMock as unknown as { AiMotionWidget: { mountMotionWidget: Function } }).AiMotionWidget;
    const handle = api.mountMotionWidget("#slot", {
      baseUrl: "/widgets/tabbar",
      params: { selectedIndex: 0 },
      autoplay: true
    });
    handle.update({ selectedIndex: 2 });
    handle.replay();
    handle.pause();
    handle.seek(0.5);

    expect(target.innerHTML).toBe("");
    expect(target.appended).toBe(iframe);
    expect(iframe.src).toBe("https://example.com/widgets/tabbar/dist/iframe.html");
    expect(postedMessages).toEqual([]);

    for (const listener of listeners.get("message") ?? []) {
      listener({
        source: iframe.contentWindow,
        data: { type: "ai-motion:ready", width: 120, height: 48 }
      });
    }

    expect(iframe.style.width).toBe("120px");
    expect(iframe.style.height).toBe("48px");
    expect(postedMessages).toEqual([
      { type: "ai-motion:init", params: { selectedIndex: 0 }, autoplay: true },
      { type: "ai-motion:update", params: { selectedIndex: 2 } },
      { type: "ai-motion:replay" },
      { type: "ai-motion:pause" },
      { type: "ai-motion:seek", progress: 0.5 }
    ]);

    handle.destroy();
    expect(iframe.removeCalls).toBe(1);
    expect(listeners.get("message")?.size).toBe(0);
    expect(postedMessages.at(-1)).toEqual({ type: "ai-motion:destroy" });
  });

  it("applies iframe update messages to manifest targets and selected tab controls", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "tabbar",
      name: "Tabbar",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "activeColor",
          label: "Active color",
          type: "color",
          default: "#f00",
          status: "confirmed",
          targets: [
            {
              kind: "css-variable",
              file: "source/style.css",
              selector: ":root",
              name: "--active-color"
            }
          ]
        },
        {
          id: "label",
          label: "Label",
          type: "text",
          default: "Home",
          status: "confirmed",
          targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-label]" }]
        }
      ]
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "tabbar", values: {} };
    const files = composeEmbedPackageFiles({
      sourceFiles: {
        "source/index.html":
          '<main data-motion-root><span data-label>Home</span></main><script src="./script.js"></script>',
        "source/style.css": "",
        "source/script.js":
          "window.motionReplay = function motionReplay() { document.body.dataset.replayed = 'true'; };"
      },
      manifest,
      metadata: { id: "tabbar-project", name: "Tabbar" },
      patch
    });
    const iframeScript = String(files["dist/iframe.js"]);
    const postedMessages: unknown[] = [];
    const listeners = new Map<string, Set<(event: unknown) => void>>();
    const rootElement = {
      style: {
        values: {} as Record<string, string>,
        setProperty(name: string, value: string) {
          this.values[name] = value;
        }
      },
      getBoundingClientRect: () => rect(200, 64)
    };
    const labelElement = {
      textContent: "Home",
      getBoundingClientRect: () => rect(120, 32)
    };
    const tabClicks = [0, 0, 0];
    const tabElements = tabClicks.map((_count, index) => ({
      getBoundingClientRect: () => rect(60, 64, 20 + index * 60),
      click() {
        tabClicks[index]! += 1;
      }
    }));
    const body = {
      dataset: {} as Record<string, string>,
      scrollWidth: 200,
      scrollHeight: 64,
      firstElementChild: rootElement,
      querySelectorAll: () => [rootElement, labelElement, ...tabElements]
    };
    const documentMock = {
      body,
      documentElement: {
        scrollWidth: 200,
        scrollHeight: 64,
        getBoundingClientRect: () => rect(200, 64)
      },
      querySelector(selector: string) {
        if (selector === "[data-motion-root]" || selector === ":root") return rootElement;
        if (selector === "[data-label]") return labelElement;
        if (selector === "[data-bottom-tab='2']") return tabElements[2];
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === ".bottom-tabbar-item") return tabElements;
        return [];
      },
      getAnimations: () => []
    };
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    }
    const windowMock = {
      parent: {
        postMessage(message: unknown) {
          postedMessages.push(message);
        }
      },
      addEventListener(type: string, listener: (event: unknown) => void) {
        const bucket = listeners.get(type) ?? new Set();
        bucket.add(listener);
        listeners.set(type, bucket);
      },
      removeEventListener(type: string, listener: (event: unknown) => void) {
        listeners.get(type)?.delete(listener);
      },
      ResizeObserver: ResizeObserverMock,
      requestAnimationFrame(callback: () => void) {
        callback();
      },
      setTimeout(callback: () => void) {
        callback();
      }
    };

    new Function("window", "document", "HTMLElement", "Element", "ResizeObserver", iframeScript)(
      windowMock,
      documentMock,
      Object,
      Object,
      ResizeObserverMock
    );

    expect(postedMessages[0]).toMatchObject({ type: "ai-motion:ready", width: 200, height: 64 });
    for (const listener of listeners.get("message") ?? []) {
      listener({
        source: windowMock.parent,
        data: {
          type: "ai-motion:update",
          params: { activeColor: "#123456", label: "Cart", selectedIndex: 2 }
        }
      });
      listener({ source: windowMock.parent, data: { type: "ai-motion:replay" } });
      listener({ source: windowMock.parent, data: { type: "ai-motion:destroy" } });
    }

    expect(rootElement.style.values["--active-color"]).toBe("#123456");
    expect(labelElement.textContent).toBe("Cart");
    expect(tabClicks).toEqual([0, 0, 1]);
    expect(body.dataset.replayed).toBe("true");
    expect(listeners.get("message")?.size).toBe(0);
  });
});
