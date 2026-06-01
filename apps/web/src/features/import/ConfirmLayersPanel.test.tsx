import type { MotionLayer } from "@motion-tool/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmLayersPanel, layerKindLabel } from "./ConfirmLayersPanel";

const layers: MotionLayer[] = [
  {
    id: "heroPoster",
    label: "主视觉",
    kind: "image",
    replaceable: true,
    required: false,
    targets: []
  },
  {
    id: "stage-shell",
    label: "舞台结构",
    kind: "structure",
    replaceable: false,
    required: false,
    targets: []
  }
];

describe("ConfirmLayersPanel", () => {
  it("localizes layer kind labels", () => {
    expect(layerKindLabel("image")).toBe("图片层");
    expect(layerKindLabel("text")).toBe("文案层");
    expect(layerKindLabel("structure")).toBe("结构层");
  });

  it("renders candidate layers and selected replaceable state", () => {
    const html = renderToStaticMarkup(
      <ConfirmLayersPanel
        layers={layers}
        selectedReplaceableLayerIds={new Set(["heroPoster"])}
        onToggle={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("确认可替换图层");
    expect(html).toContain("主视觉");
    expect(html).toContain("图片层");
    expect(html).toContain("舞台结构");
    expect(html).toContain("结构层");
    expect(html).toContain("使用已确认图层");
  });

  it("renders an empty state that still lets the user continue", () => {
    const html = renderToStaticMarkup(
      <ConfirmLayersPanel
        layers={[]}
        selectedReplaceableLayerIds={new Set()}
        onToggle={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("未识别到候选图层");
    expect(html).toContain("继续入库");
  });
});
