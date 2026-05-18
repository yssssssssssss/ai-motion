import { describe, expect, it } from "vitest";
import { renderPreviewHtml } from "./previewHtml";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";

const source: MotionSource = {
  id: "button",
  origin: "builtin",
  kind: "builtin-component",
  entry: "source/index.html",
  files: [
    {
      path: "source/index.html",
      kind: "html",
      content: '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><button class="button">Save</button></body></html>'
    },
    {
      path: "source/style.css",
      kind: "css",
      content: ".button { color: #ffffff; background-color: #111827; }"
    }
  ]
};

const manifest: MotionManifest = {
  version: "1.0",
  id: "button",
  name: "Button",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "buttonColor",
      label: "Button color",
      type: "color",
      default: "#ffffff",
      status: "confirmed",
      targets: [{ kind: "css-property", file: "source/style.css", selector: ".button", property: "color" }]
    }
  ]
};

const patch: MotionPatch = {
  id: "patch",
  sourceManifestId: "button",
  values: { buttonColor: "#ff3366" }
};

describe("renderPreviewHtml", () => {
  it("inlines local styles and applies patches", () => {
    const html = renderPreviewHtml({ source, manifest, patch });

    expect(html).toContain("<style>");
    expect(html).toContain("color: #ff3366");
    expect(html).not.toContain('<link rel="stylesheet"');
  });
});
