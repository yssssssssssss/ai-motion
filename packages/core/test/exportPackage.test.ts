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

    expect(files["assets/background-image.png"]).toBeInstanceOf(Uint8Array);
    expect(files["motion-widget.html"]).toContain('src="./assets/background-image.png"');
    expect(files["motion-widget.html"]).not.toContain("data:image/png;base64");
    expect(files["motion-widget.css"]).toContain("--motion-duration: 900ms");
    expect(files["motion-widget.css"]).toContain("background: transparent");
    expect(files["motion-widget.css"]).not.toContain("#ffeef2");
    expect(files["motion-widget.js"]).toContain("MotionWidget = { mount }");
    expect(files["motion-widget.js"]).toContain("iframe.srcdoc");
    expect(files["motion-widget.js"]).not.toContain('document.querySelector("[data-motion-root]")');
    expect(files["demo.html"]).toContain("background: transparent");
    expect(files["embed.html"]).toContain("MotionWidget.mount");
    expect(files["README.md"]).toContain("does not add a pink preview background");
    expect(files["manifest.json"]).toContain('"transparentBackground": true');
    expect(files["motion.patch.json"]).toContain('"duration": 900');
  });
});
