import { describe, expect, it } from "vitest";
import { applyPatchToFiles } from "../src/patch/applyPatch";
import type { MotionManifest, MotionPatch } from "../src/manifest/types";

const manifest: MotionManifest = {
  version: "1.0",
  id: "hero",
  name: "Hero",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "headline",
      label: "Headline",
      type: "text",
      default: "Original",
      status: "confirmed",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
    },
    {
      id: "accentColor",
      label: "Accent",
      type: "color",
      default: "#000000",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--accent-color" }]
    },
    {
      id: "duration",
      label: "Duration",
      type: "duration",
      default: 800,
      status: "confirmed",
      constraints: { unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
    }
  ]
};

describe("applyPatchToFiles", () => {
  it("updates html text and css variables", () => {
    const patch: MotionPatch = {
      id: "patch-1",
      sourceManifestId: "hero",
      values: { headline: "Updated", accentColor: "#ff3366" }
    };

    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<h1 data-motion="headline">Original</h1>',
        "source/style.css": ":root { --accent-color: #000000; --duration: 800ms; }"
      },
      manifest,
      patch
    });

    expect(files["source/index.html"]).toContain(">Updated<");
    expect(files["source/style.css"]).toContain("--accent-color: #ff3366");
  });

  it("keeps configured units for numeric css variables", () => {
    const patch: MotionPatch = {
      id: "patch-2",
      sourceManifestId: "hero",
      values: { duration: 1200 }
    };

    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<h1 data-motion="headline">Original</h1>',
        "source/style.css": ":root { --accent-color: #000000; --duration: 800ms; }"
      },
      manifest,
      patch
    });

    expect(files["source/style.css"]).toContain("--duration: 1200ms");
  });

  it("updates css property targets", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<button class="button">Save</button>',
        "source/style.css": ".button { color: #ffffff; transition-duration: 0.3s; border-radius: 40px; }"
      },
      manifest: {
        version: "1.0",
        id: "workeasy",
        name: "WorkEasy",
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
      },
      patch: { id: "patch-3", sourceManifestId: "workeasy", values: { buttonColor: "#ff3366" } }
    });

    expect(files["source/style.css"]).toContain("color: #ff3366");
  });

  it("updates only the targeted css selector", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<button class="button">Save</button><button class="secondary">Cancel</button>',
        "source/style.css": ".button { color: #ffffff; }\n.secondary { color: #111111; }"
      },
      manifest: {
        version: "1.0",
        id: "scoped-css",
        name: "Scoped CSS",
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
      },
      patch: { id: "patch-4", sourceManifestId: "scoped-css", values: { buttonColor: "#ff3366" } }
    });

    expect(files["source/style.css"]).toContain(".button { color: #ff3366; }");
    expect(files["source/style.css"]).toContain(".secondary { color: #111111; }");
  });

  it("updates safe html and svg attributes", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<img data-motion="heroImage" alt="Hero"><svg><path data-motion="logoMark" fill="#ffffff" /></svg>'
      },
      manifest: {
        version: "1.0",
        id: "attributes",
        name: "Attributes",
        sourceKind: "single-html",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "heroImageAlt",
            label: "Hero image alt",
            type: "text",
            default: "Hero",
            status: "confirmed",
            targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=heroImage]", attribute: "alt" }]
          },
          {
            id: "logoMarkFill",
            label: "Logo mark fill",
            type: "color",
            default: "#ffffff",
            status: "confirmed",
            targets: [{ kind: "svg-attribute", file: "source/index.html", selector: "[data-motion=logoMark]", attribute: "fill" }]
          }
        ]
      },
      patch: { id: "patch-5", sourceManifestId: "attributes", values: { heroImageAlt: 'Hero "new"', logoMarkFill: "#ff3366" } }
    });

    expect(files["source/index.html"]).toContain('alt="Hero &quot;new&quot;"');
    expect(files["source/index.html"]).toContain('fill="#ff3366"');
  });
});
