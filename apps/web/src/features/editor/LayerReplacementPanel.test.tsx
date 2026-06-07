import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MotionManifest, MotionPatch } from "@motion-tool/core";
import { LayerReplacementPanel, layerReplacementParamIds } from "./LayerReplacementPanel";

const manifest: MotionManifest = {
  version: "1.0",
  id: "layered",
  name: "Layered",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "heroImage",
      label: "主图",
      type: "image",
      default: "",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--hero-image" }]
    },
    {
      id: "headline",
      label: "标题",
      type: "text",
      default: "新品",
      status: "confirmed",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
    },
    {
      id: "duration",
      label: "时长",
      type: "duration",
      default: 800,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
    }
  ],
  layers: [
    {
      id: "poster-layer",
      label: "主视觉层",
      kind: "image",
      replaceable: true,
      paramId: "heroImage",
      targets: [{ kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--hero-image" }]
    },
    {
      id: "backgroundLayer",
      label: "背景结构层",
      kind: "structure",
      replaceable: true,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=backgroundLayer]", attribute: "class" }]
    },
    {
      id: "screenLayer",
      label: "页面结构层",
      kind: "structure",
      replaceable: true,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=screenLayer]", attribute: "class" }]
    }
  ],
  motionRecipes: [
    {
      recipeId: "float-loop",
      recipeName: "漂浮循环",
      category: "loop",
      targetLayerIds: ["poster-layer", "backgroundLayer", "screenLayer"],
      targetRoles: ["background", "screen"],
      paramIds: ["duration"],
      trigger: "loop"
    }
  ]
};

describe("LayerReplacementPanel", () => {
  it("separates replaceable image and text layers from ordinary params", () => {
    expect(layerReplacementParamIds(manifest)).toEqual(["heroImage", "headline"]);

    const html = renderToStaticMarkup(
      <LayerReplacementPanel
        manifest={manifest}
        patch={{ id: "patch", sourceManifestId: "layered", values: {} }}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("图层替换");
    expect(html).toContain("主视觉层");
    expect(html).toContain("动效目标：背景图层 / 页面层");
    expect(html).toContain("标题");
    expect(html).toContain("背景结构层");
    expect(html).toContain("页面结构层");
    expect(html).toContain("背景图层 / 页面层");
    expect(html).not.toContain("时长");
  });

  it("renders nothing when a component has no replaceable layers", () => {
    const patch: MotionPatch = { id: "patch", sourceManifestId: "layered", values: {} };
    expect(
      renderToStaticMarkup(
        <LayerReplacementPanel
          manifest={{ ...manifest, params: [], motionRecipes: [], layers: [] }}
          patch={patch}
          onChange={vi.fn()}
        />
      )
    ).toBe("");
  });
});
