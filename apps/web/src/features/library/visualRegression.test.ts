import { describe, expect, it } from "vitest";
import { renderPreviewHtml } from "../editor/previewHtml";
import type { MotionManifest, MotionSource } from "@motion-tool/core";

const source: MotionSource = {
  id: "looping-card",
  origin: "builtin",
  kind: "builtin-component",
  entry: "source/index.html",
  files: [
    {
      path: "source/index.html",
      kind: "html",
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><main data-motion-root><button class="card">Buy</button></main><script src="./script.js"></script></body></html>'
    },
    {
      path: "source/style.css",
      kind: "css",
      content:
        ".is-playing .card { animation: pulse 800ms infinite; } .card:hover { transform: scale(1.04); }"
    },
    {
      path: "source/script.js",
      kind: "js",
      content:
        "window.motionReplay = function () {}; window.motionPause = function () {}; window.motionSeek = function () {};"
    }
  ]
};

const manifest: MotionManifest = {
  version: "1.0",
  id: "looping-card",
  name: "Looping card",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: []
};

describe("preview visual regression harness", () => {
  it("keeps thumbnails nonblank, loopable, and hover-capable in the generated preview document", () => {
    const html = renderPreviewHtml({
      source,
      manifest,
      patch: { id: "patch", sourceManifestId: "looping-card", values: {} },
      mode: "thumbnail"
    });

    expect(html).toContain("motion-preview-stage");
    expect(html).toContain("scheduleThumbnailLoop");
    expect(html).toContain("window.motionReplay");
    expect(html).toContain(":hover");
    expect(html).toContain("Buy");
  });
});
