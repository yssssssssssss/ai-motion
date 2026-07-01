import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { PreviewFrame, previewPatchValues, shouldPreviewAutoplay } from "./PreviewFrame";

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
      content: ".button { color: #ffffff; }"
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

const imageManifest: MotionManifest = {
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
      default: "",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--hero-image" }]
    }
  ]
};

const imageSource: MotionSource = {
  id: "image-layer",
  origin: "generated",
  kind: "builtin-component",
  entry: "source/index.html",
  files: [
    {
      path: "source/index.html",
      kind: "html",
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><div class="hero"></div></body></html>'
    },
    {
      path: "source/style.css",
      kind: "css",
      content: ".hero { background: var(--hero-image, none) center / 100% 100% no-repeat; }"
    }
  ]
};

function renderPreview(patch: MotionPatch): string {
  return renderToStaticMarkup(
    <PreviewFrame source={source} manifest={manifest} patch={patch} playbackState="playing" />
  );
}

describe("PreviewFrame", () => {
  it("keeps iframe srcDoc stable when only patch values change", () => {
    const initial = renderPreview({
      id: "patch",
      sourceManifestId: "button",
      values: { buttonColor: "#ffffff" }
    });
    const updated = renderPreview({
      id: "patch",
      sourceManifestId: "button",
      values: { buttonColor: "#ff3366" }
    });

    expect(initial).toContain("srcDoc=");
    expect(initial).toBe(updated);
  });

  it("keeps iframe srcDoc stable when non-image values change on image-capable components", () => {
    const initial = renderToStaticMarkup(
      <PreviewFrame
        source={imageSource}
        manifest={{
          ...imageManifest,
          params: [
            ...imageManifest.params,
            {
              id: "opacity",
              label: "Opacity",
              type: "range",
              default: 1,
              status: "confirmed",
              targets: [
                { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--opacity" }
              ]
            }
          ]
        }}
        patch={{ id: "patch", sourceManifestId: "image-layer", values: { heroImage: "data:image/png;base64,A", opacity: 1 } }}
        playbackState="playing"
      />
    );
    const updated = renderToStaticMarkup(
      <PreviewFrame
        source={imageSource}
        manifest={{
          ...imageManifest,
          params: [
            ...imageManifest.params,
            {
              id: "opacity",
              label: "Opacity",
              type: "range",
              default: 1,
              status: "confirmed",
              targets: [
                { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--opacity" }
              ]
            }
          ]
        }}
        patch={{ id: "patch", sourceManifestId: "image-layer", values: { heroImage: "data:image/png;base64,A", opacity: 0.4 } }}
        playbackState="playing"
      />
    );

    expect(initial).toBe(updated);
  });

  it("keeps iframe srcDoc stable when replay token changes", () => {
    const initial = renderToStaticMarkup(
      <PreviewFrame
        source={source}
        manifest={manifest}
        patch={{ id: "patch", sourceManifestId: "button", values: { buttonColor: "#ffffff" } }}
        playbackState="playing"
        replayToken={0}
      />
    );
    const replayed = renderToStaticMarkup(
      <PreviewFrame
        source={source}
        manifest={manifest}
        patch={{ id: "patch", sourceManifestId: "button", values: { buttonColor: "#ffffff" } }}
        playbackState="playing"
        replayToken={1}
      />
    );

    expect(initial).toBe(replayed);
  });

  it("refreshes iframe srcDoc when image patch values change", () => {
    const initial = renderToStaticMarkup(
      <PreviewFrame
        source={imageSource}
        manifest={imageManifest}
        patch={{ id: "patch", sourceManifestId: "image-layer", values: {} }}
        playbackState="playing"
      />
    );
    const updated = renderToStaticMarkup(
      <PreviewFrame
        source={imageSource}
        manifest={imageManifest}
        patch={{
          id: "patch",
          sourceManifestId: "image-layer",
          values: { heroImage: "data:image/png;base64,NEWPAYLOAD" }
        }}
        playbackState="playing"
      />
    );

    expect(initial).not.toBe(updated);
    expect(updated).toContain("data:image/png;base64,NEWPAYLOAD");
    expect(updated).toContain("--hero-image: url(&quot;data:image/png;base64,NEWPAYLOAD&quot;)");
    expect(updated).not.toContain("data-preview-image-signature");
  });

  it("keeps builtin srcDoc previews on a non-null origin", () => {
    const html = renderToStaticMarkup(
      <PreviewFrame
        source={imageSource}
        manifest={imageManifest}
        patch={{ id: "patch", sourceManifestId: "image-layer", values: {} }}
        playbackState="playing"
      />
    );

    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
  });

  it("keeps imported srcDoc previews origin-isolated", () => {
    const html = renderToStaticMarkup(
      <PreviewFrame
        source={{ ...imageSource, origin: "imported" }}
        manifest={imageManifest}
        patch={{ id: "patch", sourceManifestId: "image-layer", values: {} }}
        playbackState="playing"
      />
    );

    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).not.toContain('sandbox="allow-scripts allow-same-origin"');
  });

  it("posts to srcDoc previews with wildcard target origin", () => {
    const sourceText = readFileSync(new URL("./PreviewFrame.tsx", import.meta.url), "utf8");

    expect(sourceText).toContain("key={iframeKey}");
    expect(sourceText).toContain("function imagePatchSignature");
    expect(sourceText).toContain('postMessage(message, "*")');
    expect(sourceText).not.toContain("location.origin");
    expect(sourceText).not.toContain("targetOrigin");
    expect(sourceText).not.toContain('postMessage(message, "null")');
    expect(sourceText).not.toContain("postMessage(message, 'null')");
  });

  it("sends default values for params missing from the current patch", () => {
    expect(previewPatchValues(manifest, { id: "patch", sourceManifestId: "button", values: {} })).toEqual({
      buttonColor: "#ffffff"
    });
    expect(
      previewPatchValues(manifest, {
        id: "patch",
        sourceManifestId: "button",
        values: { buttonColor: "#ff3366" }
      })
    ).toEqual({ buttonColor: "#ff3366" });
  });

  it("does not send empty image defaults that would erase builtin CSS assets", () => {
    expect(
      previewPatchValues(imageManifest, {
        id: "patch",
        sourceManifestId: "image-layer",
        values: {}
      })
    ).toEqual({});
    expect(
      previewPatchValues(imageManifest, {
        id: "patch",
        sourceManifestId: "image-layer",
        values: { heroImage: "data:image/png;base64,NEW" }
      })
    ).toEqual({ heroImage: "data:image/png;base64,NEW" });
  });

  it("does not autoplay user-triggered recipe previews", () => {
    expect(shouldPreviewAutoplay({ ...manifest, motionRecipes: [] })).toBe(true);
    expect(
      shouldPreviewAutoplay({
        ...manifest,
        motionRecipes: [
          {
            recipeId: "popup-close.all.enter",
            recipeName: "弹窗关闭 / all",
            category: "feedback",
            targetLayerIds: ["foregroundLayer"],
            paramIds: [],
            trigger: "click"
          }
        ]
      })
    ).toBe(false);
    expect(
      shouldPreviewAutoplay({
        ...manifest,
        motionRecipes: [
          {
            recipeId: "front-back-entry.swipe-action.enter",
            recipeName: "前后进场 / 滑动操作",
            category: "transition",
            targetLayerIds: ["foregroundLayer"],
            paramIds: [],
            trigger: "swipe"
          }
        ]
      })
    ).toBe(false);
    expect(
      shouldPreviewAutoplay({
        ...manifest,
        motionRecipes: [
          {
            recipeId: "load-motion",
            targetLayerIds: ["foregroundLayer"],
            paramIds: [],
            trigger: "load"
          }
        ]
      })
    ).toBe(true);
  });
});
