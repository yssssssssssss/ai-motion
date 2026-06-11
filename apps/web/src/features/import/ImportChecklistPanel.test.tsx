import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImportChecklistPanel, importChecklistItems } from "./ImportChecklistPanel";

describe("ImportChecklistPanel", () => {
  it("tracks preview, layer, params, and spec readiness before intake", () => {
    const items = importChecklistItems({
      phase: "confirm-layers",
      hasPreview: true,
      layerCount: 2,
      confirmedParamCount: 3,
      selectedDesignSpecId: "campaign-motion-skill"
    });

    expect(items.map((item) => [item.id, item.done])).toEqual([
      ["preview-playable", true],
      ["layers-recognized", true],
      ["params-confirmed", true],
      ["spec-selected", true]
    ]);
  });

  it("renders missing spec selection clearly", () => {
    const html = renderToStaticMarkup(
      <ImportChecklistPanel
        phase="confirm-layers"
        hasPreview
        layerCount={1}
        confirmedParamCount={2}
        selectedDesignSpecId={null}
      />
    );

    expect(html).toContain("入库检查清单");
    expect(html).toContain("规范已选择");
    expect(html).toContain("待确认");
  });
});
