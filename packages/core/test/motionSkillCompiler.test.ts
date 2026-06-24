import { describe, expect, it } from "vitest";
import {
  compileMotionSkillsFromRows,
  motionManifestSchema,
  motionSkillRegistrySchema,
  motionSkillTokenFileSchema,
  type MotionManifest,
  type MotionSkillLock
} from "../src";

const popupRows = [
  {
    元素: "弹窗反馈",
    动态示意: "",
    梯度: "中型尺寸",
    示意: "",
    作用图层: "前景层",
    Token: "standard easing",
    Value: "200ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale：95 → 105% →100%",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    动态示意: "",
    梯度: "",
    示意: "",
    Token: "",
    Value: "150ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity：0 → 100%",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  }
];

const containerTransformRows = [
  {
    元素: "容器变换",
    动态示意: "",
    梯度: "商卡",
    示意: "",
    作用图层: "前景层",
    Token: "standard easing",
    Value: "400ms",
    Delay: "100ms",
    动画类型: "对角缩放",
    关键属性变化: "size: 176 → 355 | 176 → 512",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    动态示意: "",
    梯度: "",
    示意: "",
    作用图层: "",
    Token: "",
    Value: "400ms",
    Delay: "100ms",
    动画类型: "圆度",
    关键属性变化: "roundness: 8 → 12",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    动态示意: "",
    梯度: "",
    示意: "",
    作用图层: "",
    Token: "ease out",
    Value: "400ms",
    Delay: "100ms",
    动画类型: "位移",
    关键属性变化: "position: x 182→182 | y 602→564",
    "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
  }
];

describe("motion skill manifest metadata", () => {
  it("accepts generated components that record their designer CSV source", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "generated-popup-feedback-manifest",
      name: "弹窗反馈 / 中型尺寸",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [],
      motionSkill: {
        source: "designer-csv",
        element: "弹窗反馈",
        variant: "中型尺寸",
        family: "popup-feedback",
        version: "1.0.0",
        recipeId: "popup-feedback.medium.enter",
        tokenIds: ["popup-feedback.medium.scale", "popup-feedback.medium.opacity"],
        tokens: [
          {
            id: "popup-feedback.medium.scale",
            token: "standard easing",
            animationType: "缩放",
            targetLayer: "前景层",
            value: "200ms",
            delay: "50ms",
            propertyChange: "scale：95 → 105% →100%",
            cssValue: "(0.38, 0.00, 0.24, 1.00)",
            property: "scale",
            durationParamId: "popupFeedbackMediumScaleDuration",
            delayParamId: "popupFeedbackMediumScaleDelay",
            easingParamId: "popupFeedbackMediumScaleEasing",
            keyframeParamIds: [
              "popupFeedbackMediumScaleKeyframe0",
              "popupFeedbackMediumScaleKeyframe1",
              "popupFeedbackMediumScaleKeyframe2"
            ]
          }
        ],
        target: {
          layerId: "modalLayer",
          label: "弹窗图层",
          role: "modal",
          selector: "[data-motion=modalLayer]"
        }
      }
    };

    expect(motionManifestSchema.parse(manifest).motionSkill).toMatchObject({
      source: "designer-csv",
      family: "popup-feedback",
      recipeId: "popup-feedback.medium.enter"
    });
  });
});

describe("motion skill compiler", () => {
  it("compiles PDF-style popup feedback rows into a registry and pack", () => {
    const result = compileMotionSkillsFromRows({ rows: popupRows, previousLock: null });
    const pack = result.packs["popup-feedback"];

    expect(motionSkillRegistrySchema.parse(result.registry).elements[0]).toMatchObject({
      id: "popup-feedback",
      label: "弹窗反馈",
      latestVersion: "1.0.0",
      active: true
    });
    expect(pack?.manifest).toMatchObject({
      id: "popup-feedback",
      name: "弹窗反馈",
      version: "1.0.0",
      defaultVariant: "medium"
    });
    expect(motionSkillTokenFileSchema.parse({ tokens: pack?.tokens }).tokens).toHaveLength(2);
    expect(pack?.recipes[0]).toMatchObject({
      id: "popup-feedback.medium.enter",
      sourceElement: "弹窗反馈",
      sourceVariant: "中型尺寸",
      targetLayer: "前景层",
      tokenIds: ["popup-feedback.medium.scale", "popup-feedback.medium.opacity"]
    });
    expect(pack?.tokens[0]).toMatchObject({
      targetLayer: "前景层"
    });
    expect(result.report).toContain("新增元素: 弹窗反馈@1.0.0");
  });

  it("keeps unchanged locks stable and archives removed historical tokens", () => {
    const first = compileMotionSkillsFromRows({ rows: popupRows, previousLock: null });
    const second = compileMotionSkillsFromRows({ rows: popupRows, previousLock: first.lock });
    const removed = compileMotionSkillsFromRows({ rows: [popupRows[0]!], previousLock: first.lock });

    expect(second.registry.elements[0]?.latestVersion).toBe("1.0.0");
    expect(second.report).toContain("无变化: 弹窗反馈@1.0.0");
    expect(removed.registry.elements[0]?.latestVersion).toBe("1.1.0");
    expect(removed.lock.families["popup-feedback"]?.tokens["popup-feedback.medium.opacity"]?.status).toBe(
      "archived"
    );
  });

  it("marks incomplete elements as disabled instead of generating broken recipes", () => {
    const result = compileMotionSkillsFromRows({
      rows: [{ 元素: "前后进场", 梯度: "半弹层" }],
      previousLock: null
    });

    expect(result.registry.elements[0]).toMatchObject({
      id: "front-back-entry",
      label: "前后进场",
      active: false,
      status: "incomplete"
    });
    expect(result.registry.elements[0]?.reason).toContain("Value");
    expect(result.registry.elements[0]?.reason).toContain("Delay");
    expect(result.registry.elements[0]?.reason).toContain("动画类型");
    expect(result.report).toContain("不完整元素: 前后进场");
  });

  it("compiles container transform rows with size, roundness, and position tokens", () => {
    const result = compileMotionSkillsFromRows({ rows: containerTransformRows, previousLock: null });
    const element = result.registry.elements[0];
    const pack = result.packs["container-transform"];

    expect(element).toMatchObject({
      id: "container-transform",
      label: "容器变换",
      active: true,
      variants: ["商卡"],
      packPath: "container-transform/manifest.json"
    });
    expect(pack?.manifest).toMatchObject({
      id: "container-transform",
      defaultVariant: "product-card"
    });
    expect(pack?.recipes[0]).toMatchObject({
      id: "container-transform.product-card.enter",
      sourceVariant: "商卡",
      targetRole: "container",
      tokenIds: [
        "container-transform.product-card.size",
        "container-transform.product-card.roundness",
        "container-transform.product-card.position"
      ]
    });
    expect(motionSkillTokenFileSchema.parse({ tokens: pack?.tokens }).tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "container-transform.product-card.size",
          property: "size",
          keyframes: [
            { width: 176, height: 176 },
            { width: 355, height: 512 }
          ]
        }),
        expect.objectContaining({
          id: "container-transform.product-card.roundness",
          property: "roundness",
          keyframes: [8, 12]
        }),
        expect.objectContaining({
          id: "container-transform.product-card.position",
          property: "position",
          keyframes: [
            { x: 182, y: 602 },
            { x: 182, y: 564 }
          ]
        })
      ])
    );
    expect(result.report).toContain("新增元素: 容器变换@1.0.0");
  });

  it("compiles front-back entry variants from the base motion PDF without dropping repeated position rows", () => {
    const result = compileMotionSkillsFromRows({
      rows: [
        {
          元素: "前后进场",
          梯度: "二级页跳转",
          作用图层: "前景层",
          Token: "ease out",
          Value: "200ms",
          Delay: "0ms",
          动画类型: "位移",
          关键属性变化: "position: x 0 → -375 | y 406 → 406",
          "CSS Value": "(0.00, 0.00, 0.15, 1.00)"
        },
        {
          梯度: "半弹层",
          Token: "ease out",
          Value: "300ms",
          Delay: "0ms",
          动画类型: "位移",
          关键属性变化: "position: x 0 → 0(200ms) → 0 | y 0 → 480(200ms) → 460",
          "CSS Value": "(0.00, 0.00, 0.15, 1.00)"
        },
        {
          Token: "ease out",
          Value: "200ms",
          Delay: "0ms",
          动画类型: "透明度-淡入",
          关键属性变化: "opacity：0 → 100%",
          "CSS Value": "(0.00, 0.00, 0.15, 1.00)"
        },
        {
          梯度: "滑动操作",
          Token: "ease out",
          Value: "300ms",
          Delay: "0ms",
          动画类型: "滑块1-位移",
          关键属性变化: "position: x 0 → 54(200ms) → -56 | y 0 → 0(200ms) → 0",
          "CSS Value": "(0.00, 0.00, 0.15, 1.00)"
        },
        {
          Token: "ease out",
          Value: "200ms",
          Delay: "0ms",
          动画类型: "滑块2-位移",
          关键属性变化: "position: x 0 → -112 | y 0 → 0",
          "CSS Value": "(0.00, 0.00, 0.15, 1.00)"
        }
      ],
      previousLock: null
    });
    const pack = result.packs["front-back-entry"];

    expect(result.registry.elements[0]).toMatchObject({
      id: "front-back-entry",
      label: "前后进场",
      active: true,
      variants: ["二级页跳转", "半弹层", "滑动操作"]
    });
    expect(pack?.recipes.find((recipe) => recipe.variant === "half-sheet")?.tokenIds).toEqual([
      "front-back-entry.half-sheet.position",
      "front-back-entry.half-sheet.opacity"
    ]);
    expect(pack?.recipes.find((recipe) => recipe.variant === "swipe-action")?.tokenIds).toEqual([
      "front-back-entry.swipe-action.position-1",
      "front-back-entry.swipe-action.position-2"
    ]);
    expect(pack?.tokens.find((token) => token.id === "front-back-entry.half-sheet.position")).toMatchObject({
      property: "position",
      keyframes: [
        { x: 0, y: 0 },
        { x: 0, y: 480, offsetMs: 200 },
        { x: 0, y: 460 }
      ]
    });
  });

  it("compiles horizontal switch rows with color tokens", () => {
    const result = compileMotionSkillsFromRows({
      rows: [
        {
          元素: "横向切换",
          梯度: "Tab导航",
          作用图层: "前景层",
          Token: "standard easing",
          Value: "300ms",
          Delay: "0ms",
          动画类型: "位移",
          关键属性变化: "position: 0 → -86",
          "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
        },
        {
          Token: "ease out",
          Value: "120ms",
          Delay: "80ms",
          动画类型: "颜色",
          关键属性变化: "color: #FFF2F3 → #11141A",
          "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
        }
      ],
      previousLock: null
    });
    const pack = result.packs["horizontal-switch"];

    expect(result.registry.elements[0]).toMatchObject({
      id: "horizontal-switch",
      label: "横向切换",
      active: true,
      variants: ["Tab导航"]
    });
    expect(pack?.recipes[0]).toMatchObject({
      id: "horizontal-switch.tab-navigation.enter",
      tokenIds: ["horizontal-switch.tab-navigation.position", "horizontal-switch.tab-navigation.color"]
    });
    expect(pack?.tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "horizontal-switch.tab-navigation.color",
          property: "color",
          keyframes: ["#fff2f3", "#11141a"]
        })
      ])
    );
  });

  it("compiles content feedback selection as click-triggered", () => {
    const result = compileMotionSkillsFromRows({
      rows: [
        {
          元素: "内容反馈",
          梯度: "单选/多选",
          作用图层: "前景层",
          Token: "standard easing",
          Value: "200ms",
          Delay: "0ms",
          动画类型: "缩放",
          关键属性变化: "scale：50 → 110%(133ms) →100%",
          "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
        },
        {
          Token: "ease out",
          Value: "200ms",
          Delay: "0ms",
          动画类型: "透明度-淡入",
          关键属性变化: "opacity：0 → 100%",
          "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
        }
      ],
      previousLock: null
    });

    expect(result.packs["content-feedback"]?.recipes[0]).toMatchObject({
      id: "content-feedback.selection.enter",
      sourceVariant: "单选/多选",
      trigger: "click"
    });
  });

  it("bumps the family version when visual token values change", () => {
    const first = compileMotionSkillsFromRows({ rows: popupRows, previousLock: null });
    const changed = compileMotionSkillsFromRows({
      rows: [{ ...popupRows[0]!, Value: "240ms" }, popupRows[1]!],
      previousLock: first.lock as MotionSkillLock
    });

    expect(changed.registry.elements[0]?.latestVersion).toBe("1.1.0");
    expect(changed.report).toContain("更新元素: 弹窗反馈 1.0.0 -> 1.1.0");
  });
});
