import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { PreviewFrame, previewPatchValues } from "./PreviewFrame";

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
});
