import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MotionManifest, MotionPatch } from "@motion-tool/core";
import { generateAtomicMotionComponent } from "../../services/atomicMotionGeneration";
import {
  LayerReplacementPanel,
  backgroundLayerSizePatch,
  layerReplacementParamIds,
  readLayerFileAsDataUrl
} from "./LayerReplacementPanel";

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
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=backgroundLayer]",
          attribute: "class"
        }
      ]
    },
    {
      id: "screenLayer",
      label: "页面结构层",
      kind: "structure",
      replaceable: true,
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=screenLayer]",
          attribute: "class"
        }
      ]
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

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("renders background and foreground upload entries for atomic motion drafts", () => {
    const component = generateAtomicMotionComponent({
      elementId: "popup-feedback",
      variant: "中型尺寸",
      now: 1717747200000
    });

    expect(layerReplacementParamIds(component.manifest)).toEqual(["backgroundImage", "foregroundImage"]);
    expect(component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["stageWidth", "stageHeight", "backgroundLayerWidth", "backgroundLayerHeight"])
    );

    const html = renderToStaticMarkup(
      <LayerReplacementPanel
        manifest={component.manifest}
        patch={{ id: "patch", sourceManifestId: component.manifest.id, values: {} }}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("背景层");
    expect(html).toContain("前景层");
    expect(html).toContain("动效目标：前景图层");
    expect(html).toContain("背景层尺寸");
    expect(html.indexOf("背景层尺寸")).toBeLessThan(html.lastIndexOf("背景层"));
  });

  it("shows image upload failures instead of failing silently", () => {
    const html = renderToStaticMarkup(
      <LayerReplacementPanel
        manifest={manifest}
        patch={{ id: "patch", sourceManifestId: "layered", values: {} }}
        onChange={vi.fn()}
        uploadErrorByParamId={{ heroImage: "图片读取失败，请重新选择图片。" }}
      />
    );

    expect(html).toContain("图片读取失败，请重新选择图片。");
    expect(html).toContain('role="alert"');
  });

  it("renders the three supported background layer size presets", () => {
    const html = renderToStaticMarkup(
      <LayerReplacementPanel
        manifest={{
          ...manifest,
          params: [
            ...manifest.params,
            {
              id: "stageWidth",
              label: "页面宽度",
              type: "range",
              default: 430,
              status: "confirmed",
              constraints: { min: 320, max: 520, step: 1, unit: "px" },
              targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--stage-width" }]
            },
            {
              id: "stageHeight",
              label: "页面高度",
              type: "range",
              default: 932,
              status: "confirmed",
              constraints: { min: 700, max: 1200, step: 1, unit: "px" },
              targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--stage-height" }]
            },
            {
              id: "backgroundLayerWidth",
              label: "背景层宽度",
              type: "range",
              default: 500,
              status: "confirmed",
              constraints: { min: 360, max: 640, step: 1, unit: "px" },
              targets: [
                { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--background-layer-width" }
              ]
            },
            {
              id: "backgroundLayerHeight",
              label: "背景层高度",
              type: "range",
              default: 1060,
              status: "confirmed",
              constraints: { min: 800, max: 1280, step: 1, unit: "px" },
              targets: [
                { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--background-layer-height" }
              ]
            }
          ]
        }}
        patch={{ id: "patch", sourceManifestId: "layered", values: {} }}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("背景层尺寸");
    expect(html).toContain("新常规 iPhone");
    expect(html).toContain("393x852");
    expect(html).toContain("450x960");
    expect(html).toContain("大屏 iPhone");
    expect(html).toContain("414x896");
    expect(html).toContain("470x1000");
    expect(html).toContain("Pro Max 常用");
    expect(html).toContain("430x932");
    expect(html).toContain("500x1060");
  });

  it("maps background layer size presets to all affected params", () => {
    expect(
      backgroundLayerSizePatch({
        id: "iphone-large",
        label: "大屏 iPhone",
        stage: { width: 414, height: 896 },
        background: { width: 470, height: 1000 }
      })
    ).toEqual({
      stageWidth: 414,
      stageHeight: 896,
      backgroundLayerWidth: 470,
      backgroundLayerHeight: 1000
    });
  });

  it("rejects unreadable layer files with a stable message", async () => {
    class FailingFileReader {
      result: string | ArrayBuffer | null = null;
      error = new Error("disk read failed");
      private listeners = new Map<string, Array<() => void>>();

      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }

      readAsDataURL() {
        for (const listener of this.listeners.get("error") ?? []) listener();
      }
    }

    vi.stubGlobal("FileReader", FailingFileReader);

    await expect(readLayerFileAsDataUrl(new File(["bad"], "bad.png", { type: "image/png" }))).rejects.toThrow(
      "disk read failed"
    );
  });
});
