import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MotionManifest, MotionPatch } from "@motion-tool/core";
import { AtomicMotionInspectorPanel, easingPointFromClientPosition } from "./AtomicMotionInspectorPanel";

const manifest: MotionManifest = {
  version: "1.0",
  id: "generated-popup-feedback",
  name: "弹窗反馈 / 中型尺寸",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "popupFeedbackMediumScaleDuration",
      label: "中型尺寸 缩放时长",
      type: "duration",
      default: 200,
      status: "confirmed",
      constraints: { min: 120, max: 6000, step: 20, unit: "ms" },
      targets: []
    },
    {
      id: "popupFeedbackMediumScaleDelay",
      label: "中型尺寸 缩放延迟",
      type: "range",
      default: 50,
      status: "confirmed",
      constraints: { min: 0, max: 3000, step: 20, unit: "ms" },
      targets: []
    },
    {
      id: "popupFeedbackMediumScaleEasing",
      label: "中型尺寸 缩放曲线",
      type: "easing",
      default: "cubic-bezier(0.38, 0, 0.24, 1)",
      status: "confirmed",
      targets: []
    },
    {
      id: "popupFeedbackMediumScaleKeyframe0",
      label: "中型尺寸 缩放关键帧 1",
      type: "range",
      default: 0.95,
      status: "confirmed",
      constraints: { min: 0.2, max: 2, step: 0.01 },
      targets: []
    },
    {
      id: "foregroundImage",
      label: "前景层",
      type: "image",
      default: "",
      status: "confirmed",
      targets: []
    },
    {
      id: "foregroundLayerRadius",
      label: "前景层圆角",
      type: "range",
      default: 24,
      status: "confirmed",
      constraints: { min: 0, max: 120, step: 1, unit: "px" },
      targets: [
        {
          kind: "css-variable",
          file: "source/style.css",
          selector: ".motion-skill-stage",
          name: "--foreground-layer-radius"
        }
      ]
    },
    {
      id: "foregroundLayerWidth",
      label: "前景层宽度",
      type: "range",
      default: 330,
      status: "confirmed",
      constraints: { min: 16, max: 720, step: 1, unit: "px" },
      targets: []
    },
    {
      id: "foregroundLayerHeight",
      label: "前景层高度",
      type: "range",
      default: 300,
      status: "confirmed",
      constraints: { min: 2, max: 1280, step: 1, unit: "px" },
      targets: []
    },
    {
      id: "stageWidth",
      label: "页面宽度",
      type: "range",
      default: 375,
      status: "confirmed",
      constraints: { min: 80, max: 520, step: 1, unit: "px" },
      targets: []
    },
    {
      id: "stageHeight",
      label: "页面高度",
      type: "range",
      default: 812,
      status: "confirmed",
      constraints: { min: 48, max: 1200, step: 1, unit: "px" },
      targets: []
    },
    {
      id: "backgroundLayerWidth",
      label: "背景层宽度",
      type: "range",
      default: 375,
      status: "confirmed",
      constraints: { min: 80, max: 640, step: 1, unit: "px" },
      targets: []
    },
    {
      id: "backgroundLayerHeight",
      label: "背景层高度",
      type: "range",
      default: 812,
      status: "confirmed",
      constraints: { min: 48, max: 1280, step: 1, unit: "px" },
      targets: []
    }
  ],
  motionSkill: {
    source: "designer-csv",
    element: "弹窗反馈",
    variant: "中型尺寸",
    family: "popup-feedback",
    version: "1.0.0",
    recipeId: "popup-feedback.medium.enter",
    tokenIds: ["popup-feedback.medium.scale"],
    target: {
      layerId: "modalLayer",
      label: "弹窗图层",
      role: "modal",
      selector: "[data-motion=modalLayer]"
    },
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
        keyframeParamIds: ["popupFeedbackMediumScaleKeyframe0"]
      }
    ]
  }
};

const patch: MotionPatch = {
  id: "patch",
  sourceManifestId: "generated-popup-feedback",
  values: {}
};

describe("AtomicMotionInspectorPanel", () => {
  it("renders PDF-style designer token fields and the motion target", () => {
    const html = renderToStaticMarkup(
      <AtomicMotionInspectorPanel manifest={manifest} patch={patch} onChange={vi.fn()} />
    );

    expect(html).toContain("原子动效参数");
    expect(html).toContain("弹窗反馈");
    expect(html).toContain("中型尺寸");
    expect(html).toContain("应用图层");
    expect(html).toContain("弹窗图层");
    expect(html).toContain("Token");
    expect(html).toContain("时长");
    expect(html).toContain("延迟");
    expect(html).toContain("动画类型");
    expect(html).toContain("关键属性变化");
    expect(html).toContain("缓动曲线");
    expect(html).toContain("缓动曲线曲线编辑器");
    expect(html).toContain("控制点 1");
    expect(html).toContain("x1");
    expect(html).toContain("y2");
    expect(html).toContain("scale：95 → 105% →100%");
    expect(html).toContain("(0.38, 0.00, 0.24, 1.00)");
  });

  it("can render only the atomic motion summary for the information tab", () => {
    const html = renderToStaticMarkup(
      <AtomicMotionInspectorPanel section="summary" manifest={manifest} patch={patch} onChange={vi.fn()} />
    );

    expect(html).toContain("原子动效信息");
    expect(html).toContain("弹窗反馈");
    expect(html).toContain("中型尺寸");
    expect(html).toContain("应用图层");
    expect(html).toContain("弹窗图层");
    expect(html).not.toContain("时长");
    expect(html).not.toContain("延迟");
    expect(html).not.toContain("关键属性变化");
  });

  it("can render only editable token parameters for the parameter tab", () => {
    const html = renderToStaticMarkup(
      <AtomicMotionInspectorPanel section="params" manifest={manifest} patch={patch} onChange={vi.fn()} />
    );

    expect(html).toContain("Token 参数");
    expect(html).not.toContain("通用参数");
    expect(html).not.toContain("前景层圆角");
    expect(html).not.toContain("页面宽度");
    expect(html).not.toContain("页面高度");
    expect(html).not.toContain("背景层宽度");
    expect(html).not.toContain("背景层高度");
    expect(html).not.toContain("前景层宽度");
    expect(html).not.toContain("前景层高度");
    expect(html).toContain("Token");
    expect(html).toContain("时长");
    expect(html).toContain("延迟");
    expect(html).toContain("关键属性变化");
    expect(html).not.toContain("已替换图片");
    expect(html).not.toContain("应用图层");
  });

  it("filters swipe-action params to the controls wired into the custom swipe motion", () => {
    const swipeManifest: MotionManifest = {
      ...manifest,
      params: [
        {
          id: "frontBackEntrySwipeActionPosition1Duration",
          label: "滑块1-位移时长",
          type: "duration",
          default: 300,
          status: "confirmed",
          constraints: { min: 120, max: 6000, step: 20, unit: "ms" },
          targets: []
        },
        {
          id: "frontBackEntrySwipeActionPosition1Keyframe1X",
          label: "滑块1-位移关键帧 2X",
          type: "range",
          default: 86,
          status: "confirmed",
          constraints: { min: -800, max: 800, step: 1, unit: "px" },
          targets: []
        },
        {
          id: "frontBackEntrySwipeActionPosition5Duration",
          label: "滑块5-位移时长",
          type: "duration",
          default: 200,
          status: "confirmed",
          constraints: { min: 120, max: 6000, step: 20, unit: "ms" },
          targets: []
        },
        {
          id: "frontBackEntrySwipeActionPosition5Delay",
          label: "滑块5-位移延迟",
          type: "range",
          default: 0,
          status: "confirmed",
          constraints: { min: 0, max: 3000, step: 20, unit: "ms" },
          targets: []
        },
        {
          id: "frontBackEntrySwipeActionPosition5Easing",
          label: "滑块5-位移曲线",
          type: "easing",
          default: "cubic-bezier(0, 0, 0.15, 1)",
          status: "confirmed",
          targets: []
        },
        {
          id: "frontBackEntrySwipeActionPosition5Keyframe1X",
          label: "滑块5-位移关键帧 2X",
          type: "range",
          default: -430,
          status: "confirmed",
          constraints: { min: -800, max: 800, step: 1, unit: "px" },
          targets: []
        }
      ],
      motionSkill: {
        ...manifest.motionSkill!,
        element: "前后进场",
        variant: "滑动操作",
        family: "front-back-entry",
        recipeId: "front-back-entry.swipe-action.enter",
        tokens: [
          {
            id: "front-back-entry.swipe-action.position-1",
            token: "standard easing",
            animationType: "滑块1-位移",
            targetLayer: "滑块1",
            value: "300ms",
            delay: "0ms",
            propertyChange: "position: x 0 → 86 → -86",
            cssValue: "cubic-bezier(0, 0, 0.15, 1)",
            property: "position",
            durationParamId: "frontBackEntrySwipeActionPosition1Duration",
            delayParamId: "",
            easingParamId: "",
            keyframeParamIds: ["frontBackEntrySwipeActionPosition1Keyframe1X"]
          },
          {
            id: "front-back-entry.swipe-action.position-5",
            token: "standard easing",
            animationType: "滑块5-位移",
            targetLayer: "滑块5",
            value: "200ms",
            delay: "0ms",
            propertyChange: "position: x 0 → -430",
            cssValue: "cubic-bezier(0, 0, 0.15, 1)",
            property: "position",
            durationParamId: "frontBackEntrySwipeActionPosition5Duration",
            delayParamId: "frontBackEntrySwipeActionPosition5Delay",
            easingParamId: "frontBackEntrySwipeActionPosition5Easing",
            keyframeParamIds: ["frontBackEntrySwipeActionPosition5Keyframe1X"]
          }
        ]
      }
    };
    const html = renderToStaticMarkup(
      <AtomicMotionInspectorPanel section="params" manifest={swipeManifest} patch={patch} onChange={vi.fn()} />
    );

    expect(html).toContain("滑块5-位移");
    expect(html).toContain("时长");
    expect(html).toContain("缓动曲线");
    expect(html).not.toContain("滑块1-位移");
    expect(html).not.toContain("延迟");
    expect(html).not.toContain("关键属性变化");
    expect(html).not.toContain("-430");
  });

  it("labels horizontal switch duration as per-move timing", () => {
    const horizontalManifest: MotionManifest = {
      ...manifest,
      motionSkill: {
        ...manifest.motionSkill!,
        family: "horizontal-switch",
        tokens: [
          {
            ...manifest.motionSkill!.tokens![0]!,
            id: "horizontal-switch.tab-navigation.position",
            property: "position"
          }
        ]
      }
    };
    const html = renderToStaticMarkup(
      <AtomicMotionInspectorPanel
        section="params"
        manifest={horizontalManifest}
        patch={patch}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("单次移动时长");
  });

  it("maps pointer coordinates through the centered easing SVG viewport", () => {
    const point = easingPointFromClientPosition({
      clientX: 100 + (320 - 180) / 2 + 16 + 0.8 * 148,
      clientY: 200 + 16 + 0.25 * 72,
      rect: { left: 100, top: 200, width: 320, height: 104 },
      width: 180,
      height: 104,
      padding: 16
    });

    expect(point?.x).toBeCloseTo(0.8);
    expect(point?.y).toBeCloseTo(0.75);
  });

  it("renders nothing for non-atomic components", () => {
    const { motionSkill: _motionSkill, ...plainManifest } = manifest;

    expect(
      renderToStaticMarkup(
        <AtomicMotionInspectorPanel manifest={plainManifest} patch={patch} onChange={vi.fn()} />
      )
    ).toBe("");
  });
});
