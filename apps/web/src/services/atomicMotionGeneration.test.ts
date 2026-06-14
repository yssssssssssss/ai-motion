import { describe, expect, it } from "vitest";
import {
  generateAtomicMotionComponent,
  motionSkillElements,
  motionSkillTokenSummary
} from "./atomicMotionGeneration";

describe("atomic motion generation service", () => {
  it("lists active elements and generates popup feedback from element and variant", () => {
    expect(motionSkillElements.some((element) => element.label === "弹窗反馈")).toBe(true);

    const component = generateAtomicMotionComponent({
      elementId: "popup-feedback",
      variant: "中型尺寸",
      now: 1717747200000
    });

    expect(component.manifest.motionSkill).toMatchObject({
      source: "designer-csv",
      element: "弹窗反馈",
      variant: "中型尺寸",
      family: "popup-feedback",
      target: {
        layerId: "foregroundLayer",
        label: "前景层"
      },
      tokens: [
        {
          animationType: "缩放",
          targetLayer: "前景层",
          value: "200ms",
          delay: "50ms",
          propertyChange: "scale：95 → 105% →100%"
        },
        {
          animationType: "透明度-淡入",
          value: "150ms",
          delay: "50ms",
          propertyChange: "opacity：0 → 100%"
        }
      ]
    });
    expect(component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining([
        "backgroundImage",
        "foregroundImage",
        "stageWidth",
        "stageHeight",
        "backgroundLayerWidth",
        "backgroundLayerHeight"
      ])
    );
    expect(component.manifest.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "backgroundLayer", label: "背景层", paramId: "backgroundImage" }),
        expect.objectContaining({ id: "foregroundLayer", label: "前景层", paramId: "foregroundImage" })
      ])
    );
    expect(component.source.files.map((file) => file.content).join("\n")).toContain("window.motionReplay");
  });

  it("generates the collected container transform skill from element and variant", () => {
    expect(motionSkillElements.some((element) => element.label === "容器变换" && element.active)).toBe(true);

    const component = generateAtomicMotionComponent({
      elementId: "container-transform",
      variant: "商卡",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionSkill).toMatchObject({
      source: "designer-csv",
      element: "容器变换",
      variant: "商卡",
      family: "container-transform",
      recipeId: "container-transform.product-card.enter",
      tokens: [
        {
          animationType: "对角缩放",
          property: "size",
          propertyChange: "size: 176 → 355 | 176 → 512"
        },
        {
          animationType: "圆度",
          property: "roundness",
          propertyChange: "roundness: 8 → 12"
        },
        {
          animationType: "位移",
          property: "position",
          propertyChange: "position: x 182→182 | y 602→564"
        }
      ]
    });
    expect(sourceText).toContain("@keyframes container-transform-product-card-size");
    expect(sourceText).toContain(
      "width: var(--container-transform-product-card-size-keyframe-1-width, 355px);"
    );
    expect(sourceText).toContain(
      "border-radius: var(--container-transform-product-card-roundness-keyframe-1, 12px);"
    );
    expect(sourceText).toContain(
      "bottom: calc(var(--container-transform-card-anchor-bottom, 34px) - (var(--container-transform-product-card-position-keyframe-1-y, 564px) - 602px));"
    );
    expect(sourceText).toContain("transform-origin: left bottom;");
    expect(motionSkillTokenSummary({ elementId: "container-transform", variant: "商卡" })).toEqual([
      "对角缩放 · 400ms · delay 100ms · width 176 / height 176 -> width 355 / height 512",
      "圆度 · 400ms · delay 100ms · 8 -> 12",
      "位移 · 400ms · delay 100ms · x 182 / y 602 -> x 182 / y 564"
    ]);
  });

  it("generates newly collected horizontal switch and content feedback skills", () => {
    expect(motionSkillElements.some((element) => element.label === "横向切换" && element.active)).toBe(true);
    expect(motionSkillElements.some((element) => element.label === "内容反馈" && element.active)).toBe(true);

    const horizontalSwitch = generateAtomicMotionComponent({
      elementId: "horizontal-switch",
      variant: "Tab导航",
      now: 1717747200000
    });
    expect(horizontalSwitch.manifest.motionSkill).toMatchObject({
      element: "横向切换",
      variant: "Tab导航",
      family: "horizontal-switch",
      tokens: expect.arrayContaining([
        expect.objectContaining({
          animationType: "颜色",
          property: "color",
          propertyChange: "color: #FFF2F3 → #11141A"
        })
      ])
    });
    const horizontalSwitchSource = horizontalSwitch.source.files.map((file) => file.content).join("\n");
    expect(horizontalSwitchSource).toContain("100% { transform: translateX(258px); }");
    expect(horizontalSwitchSource).toContain(
      "horizontal-switch-tab-navigation-position calc(var(--horizontal-switch-tab-navigation-position-duration, 300ms) + var(--horizontal-switch-tab-navigation-position-duration, 300ms) + var(--horizontal-switch-tab-navigation-position-duration, 300ms))"
    );
    expect(horizontalSwitch.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "activeColor", type: "color" }),
        expect.objectContaining({ id: "tabNavigationLabel1", type: "text" })
      ])
    );
    expect(motionSkillElements.find((element) => element.id === "horizontal-switch")?.variants).not.toContain(
      "频道Tab"
    );
    expect(() =>
      generateAtomicMotionComponent({
        elementId: "horizontal-switch",
        variant: "频道Tab",
        now: 1717747200000
      })
    ).toThrow(/未找到所选梯度的动效参数/);

    const contentFeedback = generateAtomicMotionComponent({
      elementId: "content-feedback",
      variant: "单选/多选",
      now: 1717747200000
    });
    expect(contentFeedback.manifest.motionSkill).toMatchObject({
      element: "内容反馈",
      variant: "单选/多选",
      family: "content-feedback",
      tokens: [
        expect.objectContaining({ animationType: "缩放", property: "scale" }),
        expect.objectContaining({ animationType: "透明度-淡入", property: "opacity" })
      ]
    });
  });

  it("rejects incomplete elements before generation", () => {
    expect(() =>
      generateAtomicMotionComponent({
        elementId: "front-back-entry",
        variant: "半弹层",
        now: 1717747200000
      })
    ).toThrow(/参数未完整/);
  });
});
