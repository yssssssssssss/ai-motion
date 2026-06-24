import { describe, expect, it } from "vitest";
import { renderPreviewHtml } from "./previewHtml";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { generateAtomicMotionComponent } from "../../services/atomicMotionGeneration";

const source: MotionSource = {
  id: "button",
  origin: "builtin",
  kind: "builtin-component",
  entry: "source/index.html",
  files: [
    {
      path: "source/index.html",
      kind: "html",
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><button class="button">Save</button></body></html>'
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

  it("adds thumbnail centering styles only when requested", () => {
    const html = renderPreviewHtml({ source, manifest, patch, mode: "thumbnail" });

    expect(html).toContain('data-motion-preview="thumbnail"');
    expect(html).toContain("motion-preview-stage");
    expect(html).toContain("requestAnimationFrame(fitThumbnail)");
    expect(html).toContain("position: absolute");
    expect(html).toContain("translate(-50%, -50%) scale(");
    expect(html).toContain("width: fit-content");
    expect(html).toContain('style.getPropertyValue("--stage-width")');
    expect(html).toContain('style.getPropertyValue("--stage-height")');
    expect(html).toContain('style.getPropertyValue("--thumbnail-focus-width")');
    expect(html).toContain('style.getPropertyValue("--thumbnail-focus-height")');
    expect(html).toContain("function applyThumbnailFocus(stage, content, focus)");
    expect(html).toContain('stage.style.overflow = "hidden"');
    expect(html).toContain('content.style.transform = "none"');
    expect(html).toContain("fixElementSize(content, declaredSize)");
    expect(html).toContain("fitThumbnail();");
    expect(html).toContain("window.setTimeout(fitThumbnail, 80)");
    expect(html).toContain("function replayThumbnailMotion()");
    expect(html).toContain("function ensureMotionPreviewProtocol()");
    expect(html).toContain("window.motionReplay = fallbackReplay");
    expect(html).toContain("const thumbnailReplayPauseMs = 800");
    expect(html).toContain("function scheduleThumbnailLoop()");
    expect(html).toContain("thumbnailPlaybackDuration() + thumbnailReplayPauseMs");
    expect(html).toContain('root.classList.remove("is-playing")');
    expect(html).toContain('root.classList.add("is-playing")');
    expect(html).not.toContain("animation-play-state: paused !important");
    expect(html).not.toContain("transition: none !important");
  });

  it("does not autoplay click-triggered thumbnails", () => {
    const html = renderPreviewHtml({
      source,
      manifest: {
        ...manifest,
        motionRecipes: [
          {
            recipeId: "button.click",
            recipeName: "Button click",
            targetLayerIds: ["button"],
            paramIds: [],
            trigger: "click"
          }
        ]
      },
      patch,
      mode: "thumbnail"
    });

    expect(html).toContain("const shouldAutoplay = false");
    expect(html).toContain("if (shouldAutoplay) requestAnimationFrame");
  });

  it("keeps full previews free of thumbnail layout styles", () => {
    const html = renderPreviewHtml({ source, manifest, patch });

    expect(html).not.toContain('data-motion-preview="thumbnail"');
    expect(html).not.toContain('data-motion-preview="editor"');
    expect(html).not.toContain("motion-preview-stage");
    expect(html).not.toContain("motion-editor-stage");
    expect(html).not.toContain("translate(-50%, -50%) scale(");
  });

  it("adds editor centering layout when requested", () => {
    const html = renderPreviewHtml({ source, manifest, patch, mode: "editor" });

    expect(html).toContain('data-motion-preview="editor"');
    expect(html).toContain("motion-editor-stage");
    expect(html).toContain("height: 100%");
    expect(html).toContain("position: absolute !important");
    expect(html).toContain("left: 50% !important");
    expect(html).toContain("top: 50% !important");
    expect(html).toContain('document.addEventListener("DOMContentLoaded", scheduleFit');
  });

  it("fits the full editor preview into the iframe viewport", () => {
    const html = renderPreviewHtml({ source, manifest, patch, mode: "editor" });

    expect(html).toContain("overflow: hidden !important");
    expect(html).toContain("max-height: none !important");
    expect(html).toContain("transform-origin: center center !important");
    expect(html).toContain("function fitEditorPreview()");
    expect(html).toContain("function parseCssPixelValue(value)");
    expect(html).toContain('style.getPropertyValue("--stage-width")');
    expect(html).toContain('style.getPropertyValue("--stage-height")');
    expect(html).toContain("fixElementSize(content, declaredSize)");
    expect(html).toContain("measureEditorContent(stage)");
    expect(html).toContain("availableWidth / contentSize.width");
    expect(html).toContain("availableHeight / contentSize.height");
    expect(html).toContain("stage.style.transform = `translate(-50%, -50%) scale(");
    expect(html).toContain("ResizeObserver");
  });

  it("adds editor playback controls inside the preview iframe", () => {
    const html = renderPreviewHtml({ source, manifest, patch, mode: "editor" });

    expect(html).toContain('data.type !== "motion-preview:playback"');
    expect(html).toContain("const editorReplayPauseMs = 1200");
    expect(html).toContain("function schedulePlaybackLoop()");
    expect(html).toContain("function ensureMotionPreviewProtocol()");
    expect(html).toContain("window.motionPause = fallbackPause");
    expect(html).toContain("window.motionSeek = fallbackSeek");
    expect(html).toContain("window.motionReplay();");
    expect(html).toContain("function applyPlaybackState(playState)");
    expect(html).toContain("animation.pause()");
    expect(html).toContain("animation.play()");
    expect(html).toContain('data.action === "pause"');
    expect(html).toContain('data.action === "play"');
    expect(html).toContain('data.type === "motion-preview:reset"');
    expect(html).toContain("function resetMotionPreview()");
    expect(html).toContain('if (typeof window.motionReverse === "function") window.motionReverse()');
    expect(html).toContain('root.classList.remove("is-playing")');
    expect(html).toContain("delete root.dataset.motionPlayed");
    expect(html).toContain("requestAnimationFrame(() => requestAnimationFrame(schedulePlaybackLoop))");
    expect(html).toContain('data.action === "replay"');
    expect(html).toContain("replayMotion();");
    expect(html).toContain("declaredPlaybackDuration() + editorReplayPauseMs");
  });

  it("adds editor patch updates inside the preview iframe", () => {
    const html = renderPreviewHtml({ source, manifest, patch, mode: "editor" });

    expect(html).toContain('data.type === "motion-preview:patch"');
    expect(html).toContain("function applyMotionPreviewPatch(values, params)");
    expect(html).toContain("style.setProperty(target.name, cssValue)");
    expect(html).toContain('target.kind === "css-property"');
    expect(html).toContain('target.kind === "html-text"');
  });

  it("keeps externalized builtin stylesheets as links", () => {
    const externalSource: MotionSource = {
      ...source,
      files: [
        {
          ...source.files[0]!,
          content:
            '<!doctype html><html><head><link rel="stylesheet" href="./assets.css" /><link rel="stylesheet" href="./style.css" /></head><body><button class="button">Save</button></body></html>'
        },
        source.files[1]!,
        {
          path: "source/assets.css",
          kind: "css",
          content: "/assets/jd-product-transition-video/assets.css"
        }
      ]
    };
    const html = renderPreviewHtml({
      source: externalSource,
      manifest,
      patch
    });

    expect(html).toContain('<link rel="stylesheet" href="/assets/jd-product-transition-video/assets.css" />');
    expect(html).not.toContain("<style>/assets/jd-product-transition-video/assets.css</style>");
  });

  it("renders uploaded atomic foreground and background images as real layer image src values", () => {
    const component = generateAtomicMotionComponent({
      elementId: "popup-feedback",
      variant: "中型尺寸",
      now: 1717747200000
    });
    const html = renderPreviewHtml({
      source: component.source,
      manifest: component.manifest,
      patch: {
        id: "atomic-image-patch",
        sourceManifestId: component.manifest.id,
        values: {
          backgroundImage: "data:image/png;base64,BACKGROUND",
          foregroundImage: "data:image/png;base64,FOREGROUND"
        }
      },
      mode: "editor"
    });

    expect(html).toContain('data-motion="backgroundImage" src="data:image/png;base64,BACKGROUND"');
    expect(html).toContain('data-motion="foregroundImage" src="data:image/png;base64,FOREGROUND"');
    expect(html).toContain("object-fit: fill");
    expect(html).not.toContain("object-fit: cover");
  });
});
