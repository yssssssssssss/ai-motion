import { describe, expect, it } from "vitest";
import { composeEditablePackageFiles, composeStandaloneHtmlFile } from "../src/export/exportPackage";
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
        "source/style.css": ":root { --motion-duration: 600ms; } .hero { animation-duration: var(--motion-duration); }",
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
});
