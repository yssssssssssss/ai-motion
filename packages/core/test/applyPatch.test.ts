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

  it("updates image css variables without truncating data urls", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<div class="hero"></div>',
        "source/style.css":
          ':root { --hero-image: url("data:image/webp;base64,OLDPAYLOAD"); --accent-color: #000000; }'
      },
      manifest: {
        version: "1.0",
        id: "image-layer",
        name: "Image layer",
        sourceKind: "builtin-component",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "heroImage",
            label: "Hero image",
            type: "image",
            default: null,
            status: "confirmed",
            constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp"] },
            targets: [
              { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--hero-image" }
            ]
          }
        ]
      },
      patch: { id: "patch-image", sourceManifestId: "image-layer", values: { heroImage: dataUrl } }
    });

    expect(files["source/style.css"]).toContain(`--hero-image: url("${dataUrl}");`);
    expect(files["source/style.css"]).toContain("--accent-color: #000000");
    expect(files["source/style.css"]).not.toContain("OLDPAYLOAD");
  });

  it("inserts missing css variables so image layer patches are persisted", () => {
    const dataUrl = "data:image/png;base64,NEWPAYLOAD";
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<div class="hero"></div>',
        "source/style.css": ".hero { background: var(--hero-image, none) center / cover no-repeat; }"
      },
      manifest: {
        version: "1.0",
        id: "missing-image-var",
        name: "Missing image var",
        sourceKind: "builtin-component",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "heroImage",
            label: "Hero image",
            type: "image",
            default: "",
            status: "confirmed",
            targets: [
              { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--hero-image" }
            ]
          }
        ]
      },
      patch: { id: "patch-missing-var", sourceManifestId: "missing-image-var", values: { heroImage: dataUrl } }
    });

    expect(files["source/style.css"]).toContain(`:root { --hero-image: url("${dataUrl}"); }`);
    expect(files["source/style.css"]).toContain("background: var(--hero-image, none) center / cover no-repeat");
  });

  it("does not patch externalized stylesheet references as if they were css", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<link rel="stylesheet" href="./assets.css" />',
        "source/assets.css": "/assets/product-assets.css"
      },
      manifest: {
        version: "1.0",
        id: "external-assets",
        name: "External assets",
        sourceKind: "builtin-component",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "detailCardImage",
            label: "Detail card image",
            type: "image",
            default: "",
            status: "confirmed",
            targets: [
              { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--detail-card" }
            ]
          }
        ]
      },
      patch: {
        id: "patch-external-assets",
        sourceManifestId: "external-assets",
        values: { detailCardImage: "data:image/png;base64,NEWCARD" }
      }
    });

    expect(files["source/assets.css"]).toBe("/assets/product-assets.css");
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
            targets: [
              { kind: "css-property", file: "source/style.css", selector: ".button", property: "color" }
            ]
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
            targets: [
              { kind: "css-property", file: "source/style.css", selector: ".button", property: "color" }
            ]
          }
        ]
      },
      patch: { id: "patch-4", sourceManifestId: "scoped-css", values: { buttonColor: "#ff3366" } }
    });

    expect(files["source/style.css"]).toContain(".button { color: #ff3366; }");
    expect(files["source/style.css"]).toContain(".secondary { color: #111111; }");
  });

  it("updates every occurrence when the selector repeats", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<button class="button">Save</button>',
        "source/style.css":
          ".button { color: #ffffff; }\n.button:hover { background: #000000; }\n.button { color: #eeeeee; }"
      },
      manifest: {
        version: "1.0",
        id: "repeat",
        name: "Repeat",
        sourceKind: "builtin-component",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "buttonColor",
            label: "Button color",
            type: "color",
            default: "#ffffff",
            status: "confirmed",
            targets: [
              { kind: "css-property", file: "source/style.css", selector: ".button", property: "color" }
            ]
          }
        ]
      },
      patch: { id: "patch-repeat", sourceManifestId: "repeat", values: { buttonColor: "#ff3366" } }
    });

    // 两个 .button {} 中的 color 都应被改
    const css = files["source/style.css"] ?? "";
    expect(css.match(/color: #ff3366/g)?.length).toBe(2);
    expect(css).not.toContain("color: #ffffff");
    expect(css).not.toContain("color: #eeeeee");
  });

  it("updates safe html and svg attributes", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html":
          '<img data-motion="heroImage" alt="Hero"><svg><path data-motion="logoMark" fill="#ffffff" /></svg>'
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
            targets: [
              {
                kind: "html-attribute",
                file: "source/index.html",
                selector: "[data-motion=heroImage]",
                attribute: "alt"
              }
            ]
          },
          {
            id: "logoMarkFill",
            label: "Logo mark fill",
            type: "color",
            default: "#ffffff",
            status: "confirmed",
            targets: [
              {
                kind: "svg-attribute",
                file: "source/index.html",
                selector: "[data-motion=logoMark]",
                attribute: "fill"
              }
            ]
          }
        ]
      },
      patch: {
        id: "patch-5",
        sourceManifestId: "attributes",
        values: { heroImageAlt: 'Hero "new"', logoMarkFill: "#ff3366" }
      }
    });

    expect(files["source/index.html"]).toContain('alt="Hero &quot;new&quot;"');
    expect(files["source/index.html"]).toContain('fill="#ff3366"');
  });

  it("updates image src attributes whose existing value contains nested quotes", () => {
    const files = applyPatchToFiles({
      files: {
        "source/index.html":
          '<img data-motion="heroImage" src="data:image/svg+xml,%3Csvg viewBox=\'0 0 1 1\'%3E%3C/svg%3E" alt="" />'
      },
      manifest: {
        version: "1.0",
        id: "image-src-attribute",
        name: "Image src attribute",
        sourceKind: "single-html",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "heroImage",
            label: "Hero image",
            type: "image",
            default: "",
            status: "confirmed",
            targets: [
              {
                kind: "html-attribute",
                file: "source/index.html",
                selector: "[data-motion=heroImage]",
                attribute: "src"
              }
            ]
          }
        ]
      },
      patch: {
        id: "patch-image-src",
        sourceManifestId: "image-src-attribute",
        values: { heroImage: "data:image/png;base64,NEWIMAGE" }
      }
    });

    expect(files["source/index.html"]).toContain('src="data:image/png;base64,NEWIMAGE"');
    expect(files["source/index.html"]).not.toContain("viewBox");
  });
});
