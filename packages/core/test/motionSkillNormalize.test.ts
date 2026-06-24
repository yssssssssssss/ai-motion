import { describe, expect, it } from "vitest";
import {
  normalizeDesignerMotionRows,
  parseCssEasing,
  parseKeyframes,
  parseMilliseconds,
  propertyFromAnimationType,
  slugMotionId
} from "../src";

describe("motion skill normalization", () => {
  it("fill-downs PDF-style merged cells after CSV export", () => {
    const rows = normalizeDesignerMotionRows([
      {
        元素: "弹窗反馈",
        动态示意: "popup.png",
        梯度: "中型尺寸",
        示意: "medium.png",
        作用图层: "前景层",
        Token: "standard easing",
        Value: "200ms",
        Delay: "50ms",
        动画类型: "缩放",
        关键属性变化: "scale: 95 -> 105% -> 100%",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        动态示意: "",
        梯度: "",
        示意: "",
        作用图层: "",
        Token: "",
        Value: "150ms",
        Delay: "50ms",
        动画类型: "透明度-淡入",
        关键属性变化: "opacity：0 → 100%",
        "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
      }
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      element: "弹窗反馈",
      motionPreview: "popup.png",
      variant: "中型尺寸",
      variantPreview: "medium.png",
      targetLayer: "前景层",
      token: "standard easing"
    });
  });

  it("parses time, easing, property, keyframes, and stable ids", () => {
    expect(parseMilliseconds("200ms")).toBe(200);
    expect(parseMilliseconds("0.2s")).toBe(200);
    expect(parseMilliseconds("50")).toBe(50);
    expect(parseCssEasing("(0.38, 0.00, 0.24, 1.00)")).toBe("cubic-bezier(0.38, 0, 0.24, 1)");
    expect(propertyFromAnimationType("透明度-淡入")).toBe("opacity");
    expect(propertyFromAnimationType("缩放")).toBe("scale");
    expect(parseKeyframes("scale:95->105->100", "scale")).toEqual([0.95, 1.05, 1]);
    expect(parseKeyframes("opacity:0->100", "opacity")).toEqual([0, 1]);
    expect(slugMotionId("弹窗反馈")).toBe("popup-feedback");
    expect(slugMotionId("中型尺寸")).toBe("medium");
  });

  it("parses compound container transform keyframes from designer CSV text", () => {
    expect(propertyFromAnimationType("对角缩放")).toBe("size");
    expect(parseKeyframes("size: 176 -> 355 | 176 -> 512", "size")).toEqual([
      { width: 176, height: 176 },
      { width: 355, height: 512 }
    ]);
    expect(parseKeyframes("position: x 182->182 | y 602->564", "position")).toEqual([
      { x: 182, y: 602 },
      { x: 182, y: 564 }
    ]);
    expect(parseKeyframes("roundness: 8 -> 12", "roundness")).toEqual([8, 12]);
    expect(slugMotionId("商卡")).toBe("product-card");
  });

  it("preserves designer-specified intermediate keyframe timing", () => {
    expect(parseKeyframes("size: 16 -> 32(80ms) -> 16 | 2.5 -> 2.5(80ms) -> 2.5", "size")).toEqual([
      { width: 16, height: 2.5 },
      { width: 32, height: 2.5, offsetMs: 80 },
      { width: 16, height: 2.5 }
    ]);
    expect(parseKeyframes("position: x 0 -> 0(200ms) -> 0 | y 0 -> 480(200ms) -> 460", "position")).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 480, offsetMs: 200 },
      { x: 0, y: 460 }
    ]);
    expect(() => parseKeyframes("position: x 0 -> 0(200ms) -> 0 | y 0 -> 480(100ms) -> 460", "position")).toThrow(
      /Mismatched position keyframe offsets/
    );
    expect(parseKeyframes("scale: 50 -> 110%(133ms) -> 100%", "scale")).toEqual([
      0.5,
      { value: 1.1, offsetMs: 133 },
      1
    ]);
  });
});
