import { describe, expect, it } from "vitest";
import { zeroLayerPaintStyle, type ZeroLayerNode } from "../src";

describe("zeroLayerPaintStyle", () => {
  it("preserves layered fills, strokes, effects, rotation, and blend mode", () => {
    const node: ZeroLayerNode = {
      nodeId: "card",
      name: "卡片",
      kind: "rect",
      bounds: { x: 0, y: 0, w: 120, h: 64 },
      opacity: 1,
      visible: true,
      rotation: 12,
      blendMode: "multiply",
      fills: [
        { type: "solid", color: "#ffffff", opacity: 0.8 },
        { type: "gradient", css: "linear-gradient(90deg,#ff0000,#0000ff)" },
        { type: "image", assetId: "texture" }
      ],
      strokes: [
        { color: "#111111", width: 1 },
        { color: "#ff0000", opacity: 0.5, width: 2 }
      ],
      effects: [
        { type: "drop-shadow", css: "box-shadow:0 4px 8px rgba(0,0,0,.2)" },
        { type: "blur", css: "filter:blur(2px)" }
      ]
    };

    const style = zeroLayerPaintStyle(
      node,
      new Map([["texture", { id: "texture", type: "svg", url: "data:image/svg+xml,test" }]])
    );

    expect(style.background).toContain("linear-gradient(rgba(255,255,255,0.8),rgba(255,255,255,0.8))");
    expect(style.background).toContain("linear-gradient(90deg,#ff0000,#0000ff)");
    expect(style.background).toContain('url("data:image/svg+xml,test")');
    expect(style.border).toBe("1px solid #111111");
    expect(style.boxShadow).toContain("0 4px 8px rgba(0,0,0,.2)");
    expect(style.boxShadow).toContain("inset 0 0 0 2px rgba(255,0,0,0.5)");
    expect(style.filter).toBe("blur(2px)");
    expect(style.rotation).toBe(12);
    expect(style.blendMode).toBe("multiply");
  });

  it("keeps text fills as foreground color instead of a background layer", () => {
    const style = zeroLayerPaintStyle(
      {
        nodeId: "label",
        name: "标签",
        kind: "text",
        bounds: { x: 0, y: 0, w: 40, h: 20 },
        opacity: 1,
        visible: true,
        fills: [{ type: "solid", color: "#123456" }]
      },
      new Map()
    );

    expect(style).toMatchObject({ color: "#123456" });
    expect(style.background).toBeUndefined();
  });
});
