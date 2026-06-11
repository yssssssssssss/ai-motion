import { describe, expect, it } from "vitest";
import type { MotionManifest } from "@motion-tool/core";
import { applyDesignSpecSelection, applyLayerSelection, createDraftImportState } from "./useImportFlow";

const manifest: MotionManifest = {
  version: "1.0",
  id: "imported-manifest",
  name: "Imported",
  sourceKind: "html-package",
  runtime: { engine: "html", entry: "index.html", sandbox: "iframe" },
  params: [],
  layers: [
    { id: "heroPoster", label: "Hero", kind: "image", replaceable: true, targets: [] },
    { id: "stage-shell", label: "Stage", kind: "structure", replaceable: false, targets: [] }
  ]
};

describe("applyLayerSelection", () => {
  it("writes user-confirmed replaceable flags into the pending manifest", () => {
    const result = applyLayerSelection(manifest, new Set(["stage-shell"]));

    expect(result.layers?.map((layer) => [layer.id, layer.replaceable])).toEqual([
      ["heroPoster", false],
      ["stage-shell", true]
    ]);
  });
});

describe("applyDesignSpecSelection", () => {
  it("binds the selected design spec into the pending manifest", () => {
    const result = applyDesignSpecSelection(manifest, "campaign-motion-skill");

    expect(result.designSpecs).toEqual([{ id: "campaign-motion-skill", confidence: 1, required: true }]);
  });
});

describe("createDraftImportState", () => {
  it("keeps a generated video draft inside the shared import gate", () => {
    const result = createDraftImportState({
      id: "video-demo",
      name: "视频转场",
      category: "media",
      tags: ["uploaded", "video-generated"],
      useCases: ["video-to-motion"],
      moods: ["generated"],
      source: {
        id: "video-demo",
        origin: "generated",
        kind: "html-package",
        entry: "source/index.html",
        files: [
          { path: "source/index.html", kind: "html", content: '<div class="motion-layer"></div>' },
          { path: "source/assets.css", kind: "css", content: ":root { --video-poster: url(TEST); }" }
        ]
      },
      manifest: {
        ...manifest,
        id: "video-demo-manifest",
        name: "视频转场",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: [
          {
            id: "posterImage",
            label: "画面",
            type: "image",
            default: "data:image/png;base64,POSTER",
            status: "confirmed",
            targets: [
              { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--video-poster" }
            ]
          }
        ],
        layers: [
          {
            id: "posterImage",
            label: "视频画面",
            kind: "image",
            replaceable: true,
            paramId: "posterImage",
            targets: [
              { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--video-poster" }
            ]
          }
        ]
      }
    });

    expect(result.pendingImport.origin).toBe("generated");
    expect(result.pendingManifest.id).toBe("video-demo-manifest");
    expect(result.suggestedParams.map((param) => param.id)).toEqual(["posterImage"]);
    expect([...result.selectedParamIds]).toEqual(["posterImage"]);
    expect(result.suggestedLayers.map((layer) => layer.id)).toEqual(["posterImage"]);
    expect([...result.selectedReplaceableLayerIds]).toEqual(["posterImage"]);
    expect(result.metadataDefaults).toMatchObject({ name: "视频转场", category: "media" });
  });
});
