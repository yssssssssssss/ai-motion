import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MotionComponent, Recommendation } from "@motion-tool/core";
import { ComponentCandidates } from "./ComponentCandidates";

const component = {
  id: "campaign-button",
  name: "Campaign Button",
  category: "interaction",
  tags: ["buttons", "workeasy"],
  useCases: ["campaign-page"],
  moods: ["expressive"],
  manifest: {
    version: "1.0",
    id: "campaign-button",
    name: "Campaign Button",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: [
      {
        id: "buttonColor",
        label: "按钮颜色",
        type: "color",
        default: "#6b36fa",
        status: "confirmed",
        targets: [
          { kind: "css-property", file: "source/style.css", selector: ".button", property: "background" }
        ]
      }
    ]
  },
  source: {
    id: "campaign-button",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content:
          '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><button class="button">立即参与</button></body></html>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content: ".button { background: #6b36fa; color: #fff; transition: transform 200ms; }"
      }
    ]
  }
} as MotionComponent;

const recommendation: Recommendation = {
  componentId: "campaign-button",
  score: 12,
  reason: "命中：按钮、紫色",
  matches: ["按钮", "紫色"],
  initialPatch: {
    id: "campaign-button-initial",
    sourceManifestId: "campaign-button",
    values: {}
  }
};

describe("ComponentCandidates", () => {
  const loadComponentSource = async (item: MotionComponent) => item;

  it("renders a helpful empty state after a parsed brief has no matches", () => {
    const html = renderToStaticMarkup(
      <ComponentCandidates
        recommendations={[]}
        components={[component]}
        hasSearched
        onLoadComponentSource={loadComponentSource}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("暂未找到匹配组件");
    expect(html).toContain("减少硬性条件");
  });

  it("renders live thumbnail previews for search results", () => {
    const html = renderToStaticMarkup(
      <ComponentCandidates
        recommendations={[recommendation]}
        components={[component]}
        onLoadComponentSource={loadComponentSource}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("recommendation-preview-frame");
    expect(html).toContain("Campaign Button 搜索结果预览");
    expect(html).toContain("motion-preview-stage");
    expect(html).toContain("打开参数编辑器");
  });
});
