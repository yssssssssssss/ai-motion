import { describe, expect, it } from "vitest";
import {
  atomicMotionFeedComponents,
  atomicMotionTriggerRule,
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
        "foregroundLayerRadius",
        "foregroundLayerWidth",
        "foregroundLayerHeight",
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

  it("provides generated feed components for every active atomic motion variant", () => {
    expect(atomicMotionFeedComponents.map((component) => component.name)).toEqual(
      expect.arrayContaining([
        "弹窗反馈 / 大型尺寸",
        "弹窗反馈 / 中型尺寸",
        "弹窗反馈 / 小型尺寸",
        "弹窗关闭 / all"
      ])
    );
    expect(
      atomicMotionFeedComponents
        .filter((component) => component.manifest.motionSkill?.family === "popup-feedback")
        .map((component) => component.manifest.motionSkill?.variant)
    ).toEqual(["大型尺寸", "中型尺寸", "小型尺寸"]);
    expect(atomicMotionFeedComponents.every((component) => component.tags.includes("atomic-motion"))).toBe(
      true
    );
    expect(
      atomicMotionFeedComponents.every((component) => component.useCases.includes("atomic-motion"))
    ).toBe(true);
    expect(atomicMotionFeedComponents.map((component) => component.manifest.motionSkill?.element)).toContain(
      "内容加载"
    );
    expect(
      atomicMotionFeedComponents
        .filter((component) => component.manifest.motionSkill?.family === "content-loading")
        .map((component) => component.manifest.motionSkill?.variant)
    ).toEqual(["全局"]);
  });

  it("generates the collected container transform skill from element and variant", () => {
    expect(motionSkillElements.some((element) => element.label === "容器变换" && element.active)).toBe(true);
    expect(atomicMotionTriggerRule("container-transform")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

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
    expect(component.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "foregroundLayerRadius",
          label: "前景层圆角",
          default: 8,
          targets: [
            {
              kind: "css-variable",
              file: "source/style.css",
              selector: ".motion-skill-stage",
              name: "--foreground-layer-radius"
            }
          ]
        })
      ])
    );
    expect(sourceText).toContain("--foreground-layer-radius: 8px;");
    expect(sourceText).not.toContain("--thumbnail-focus-");
    expect(sourceText).toContain("border-radius: var(--foreground-layer-radius, 8px);");
    expect(sourceText).toContain(
      ".motion-skill-container-transform-product-card {\n  width: var(--stage-width);\n  height: var(--stage-height);"
    );
    expect(sourceText).not.toContain("calc(82vw / 374px)");
    expect(sourceText).not.toContain("calc(82vh / 812px)");
    expect(sourceText).toContain("background: transparent;");
    expect(sourceText).toContain(
      ".motion-skill-container-transform-product-card .motion-skill-background {\n  left: calc((100% - var(--background-layer-width)) / 2);"
    );
    expect(sourceText).toContain("width: var(--background-layer-width);");
    expect(sourceText).toContain("height: var(--background-layer-height);");
    expect(sourceText).toContain("border-radius: 32px;");
    expect(sourceText).toContain("overflow: hidden;");
    expect(sourceText).toContain("background: #3f3f46;");
    expect(sourceText).not.toContain(
      ".motion-skill-container-transform-product-card .motion-skill-background {\n  inset: 0;"
    );
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
    expect(component.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(sourceText).toContain('target.addEventListener("click", replay)');
    expect(sourceText).not.toContain("dataset.motionPlayed");
    expect(sourceText).not.toContain("requestAnimationFrame(replay);");
    expect(motionSkillTokenSummary({ elementId: "container-transform", variant: "商卡" })).toEqual([
      "对角缩放 · 400ms · delay 100ms · width 176 / height 176 -> width 355 / height 512",
      "圆度 · 400ms · delay 100ms · 8 -> 12",
      "位移 · 400ms · delay 100ms · x 182 / y 602 -> x 182 / y 564"
    ]);
  });

  it("can generate an atomic draft that replays on swipe", () => {
    const component = generateAtomicMotionComponent({
      elementId: "popup-feedback",
      variant: "中型尺寸",
      trigger: "swipe",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionRecipes?.[0]?.trigger).toBe("swipe");
    expect(sourceText).toContain("swipeThresholdPx = 48");
    expect(sourceText).toContain('addEventListener("pointerdown"');
    expect(sourceText).toContain('addEventListener("pointerup"');
    expect(sourceText).not.toContain("requestAnimationFrame(replay);");
  });

  it("defaults popup close to click-triggered closing from an open state", () => {
    expect(atomicMotionTriggerRule("popup-close")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

    const component = generateAtomicMotionComponent({
      elementId: "popup-close",
      variant: "all",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(sourceText).toContain("--popup-close-all-opacity-keyframe-0: 1;");
    expect(sourceText).toContain("--popup-close-all-opacity-keyframe-1: 0;");
    expect(sourceText).toContain('target.addEventListener("click", replay)');
    expect(sourceText).toContain('root.dataset.motionPlayed === "true"');
    expect(sourceText).toContain('root.dataset.motionPlayed = "true"');
    expect(sourceText).not.toContain("requestAnimationFrame(replay);");
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
    expect(horizontalSwitch.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(horizontalSwitchSource).toContain('data-active-index="1"');
    expect(horizontalSwitchSource).toContain("motion-switch-text-tab is-active");
    expect(horizontalSwitchSource).toContain("motion-switch-text-tab-indicator");
    expect(horizontalSwitchSource).toContain(".motion-switch-text-tab.is-active");
    expect(horizontalSwitchSource).toContain('tab.addEventListener("click", () => select(index))');
    expect(horizontalSwitchSource).toContain("tabList.dataset.activeIndex = String(nextIndex)");
    expect(horizontalSwitchSource).toContain(
      "transition: color var(--horizontal-switch-tab-navigation-color-duration, 120ms)"
    );
    expect(horizontalSwitchSource).toContain("left: 24px;");
    expect(horizontalSwitchSource).toContain("right: 24px;");
    expect(horizontalSwitchSource).toContain("--tab-navigation-tab-width: calc(100% / 4);");
    expect(horizontalSwitchSource).toContain("--tab-navigation-indicator-left: calc(");
    expect(horizontalSwitchSource).toContain("left: var(--tab-navigation-indicator-left);");
    expect(horizontalSwitchSource).toContain(
      "left var(--horizontal-switch-tab-navigation-position-duration, 300ms)"
    );
    expect(horizontalSwitchSource).not.toContain("requestAnimationFrame(replay);");
    expect(horizontalSwitchSource).not.toContain(".is-playing .motion-switch-text-tabs");
    expect(horizontalSwitchSource).not.toContain("@keyframes horizontal-switch-tab-navigation-label-2");
    expect(horizontalSwitch.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "activeColor", type: "color" }),
        expect.objectContaining({ id: "tabNavigationLabel1", type: "text" })
      ])
    );
    expect(motionSkillElements.find((element) => element.id === "horizontal-switch")?.variants).toContain(
      "频道Tab"
    );

    expect(atomicMotionTriggerRule("horizontal-switch", "Tab导航")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

    expect(atomicMotionTriggerRule("horizontal-switch", "频道Tab")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

    const channelTabComponent = generateAtomicMotionComponent({
      elementId: "horizontal-switch",
      variant: "频道Tab",
      now: 1717747200000
    });
    const channelTabSource = channelTabComponent.source.files.map((file) => file.content).join("\n");
    expect(channelTabComponent.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(channelTabSource).toContain("motion-switch-channel-tabs");
    expect(channelTabSource).toContain("motion-switch-channel-tab is-active");
    expect(channelTabSource).toContain("--stage-width: 375px");
    expect(channelTabSource).toContain("--stage-height: 75px");
    expect(channelTabSource).toContain("border-radius: 0;");
    expect(channelTabSource).toContain("background: #ff0031;");
    expect(channelTabSource).toContain("transform: translateX(42px);");
    expect(channelTabSource).toContain("channel-icon-alarm");
    expect(channelTabSource.match(/data:image\/png;base64,/g)).toHaveLength(6);
    expect(channelTabSource).not.toContain('content: "SALE"');
    expect(channelTabSource).not.toContain("clip-path: polygon");
    expect(channelTabSource).toContain("horizontal-switch-channel-tab-icon-size-reverse");
    expect(channelTabSource).toContain("horizontal-switch-channel-tab-name-fade");
    expect(channelTabSource).toContain('previousTab.classList.add("is-deactivating")');
    expect(channelTabSource).toContain('data-motion="channelTabLabel2">秒杀');
    expect(channelTabSource).toContain("motion-switch-channel-active-bg");
    expect(channelTabSource).toContain("@keyframes horizontal-switch-channel-tab-active-bg");
    expect(channelTabSource).toContain("data:image/svg+xml,");
    expect(channelTabSource).toContain("var(--horizontal-switch-channel-tab-position-keyframe-1-x, 110.4px)");
    expect(channelTabSource).toContain("var(--horizontal-switch-channel-tab-size-keyframe-1-width, 46px)");
    expect(channelTabSource).toContain('tab.addEventListener("click", () => select(index))');
    expect(channelTabSource).toContain('nextTab.classList.add("is-activating")');
    expect(channelTabSource).not.toContain("requestAnimationFrame(replay);");
    expect(channelTabComponent.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "channelTabLabel1", type: "text" }),
        expect.objectContaining({ id: "channelTabLabel6", type: "text" })
      ])
    );

    expect(atomicMotionTriggerRule("horizontal-switch", "开关")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

    const switchComponent = generateAtomicMotionComponent({
      elementId: "horizontal-switch",
      variant: "开关",
      now: 1717747200000
    });
    const switchSource = switchComponent.source.files.map((file) => file.content).join("\n");
    expect(switchSource).toContain('role", "switch');
    expect(switchSource).toContain('root.addEventListener("click", toggle)');
    expect(switchSource).toContain("window.motionReverse");
    expect(switchSource).toContain('root.classList.add(nextIsOn ? "is-toggling-on" : "is-toggling-off")');
    expect(switchSource).toContain('root.classList.toggle("is-on", isOn)');
    expect(switchSource).toContain('root.setAttribute("aria-checked", String(isOn))');
    expect(switchSource).toContain("@keyframes horizontal-switch-switch-position-reverse");
    expect(switchSource).toContain(".motion-skill-horizontal-switch-switch.is-on .motion-switch-track");
    expect(switchSource).not.toContain("requestAnimationFrame(replay);");

    expect(atomicMotionTriggerRule("horizontal-switch", "指示器")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

    const indicatorComponent = generateAtomicMotionComponent({
      elementId: "horizontal-switch",
      variant: "指示器",
      now: 1717747200000
    });
    const indicatorSource = indicatorComponent.source.files.map((file) => file.content).join("\n");
    expect(indicatorComponent.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(indicatorSource).toContain("motion-switch-indicator-dot is-active");
    expect(indicatorSource).toContain('data-indicator-index="0"');
    expect(indicatorSource).toContain('data-indicator-index="1"');
    expect(indicatorSource).toContain('data-indicator-index="2"');
    expect(indicatorSource).toContain('dot.addEventListener("click", () => select(index))');
    expect(indicatorSource).toContain('previousDot.classList.add("is-shrinking")');
    expect(indicatorSource).toContain('nextDot.classList.add("is-growing")');
    expect(indicatorSource).toContain("window.motionReverse");
    expect(indicatorSource).toContain("@keyframes horizontal-switch-indicator-size-shrink");
    expect(indicatorSource).not.toContain("requestAnimationFrame(replay);");

    expect(atomicMotionTriggerRule("horizontal-switch", "分段")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });

    const segmentedComponent = generateAtomicMotionComponent({
      elementId: "horizontal-switch",
      variant: "分段",
      now: 1717747200000
    });
    const segmentedSource = segmentedComponent.source.files.map((file) => file.content).join("\n");
    expect(segmentedComponent.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    expect(segmentedSource).toContain("--stage-width: 240px");
    expect(segmentedSource).toContain("--stage-height: 120px");
    expect(segmentedSource).toContain("--foreground-layer-width: 72px");
    expect(segmentedSource).toContain("--foreground-layer-height: 40px");
    expect(segmentedSource).toContain("motion-switch-segmented-option is-active");
    expect(segmentedSource).toContain('data-segmented-index="1"');
    expect(segmentedSource).toContain('option.addEventListener("click", () => select(index))');
    expect(segmentedSource).toContain("track.dataset.activeIndex = String(activeIndex)");
    expect(segmentedSource).toContain("var(--horizontal-switch-segmented-position-keyframe-1, 72px)");
    expect(segmentedSource).toContain("var(--horizontal-switch-segmented-size-keyframe-1-width, 92px)");
    expect(segmentedSource).toContain(".motion-switch-segmented-track.is-moving-right::after");
    expect(segmentedSource).toContain(".motion-switch-segmented-track.is-moving-left::after");
    expect(segmentedSource).toContain("track.classList.add(directionClass)");
    expect(segmentedSource).toContain(".motion-switch-segmented-option.is-active");
    expect(
      segmentedSource.indexOf("z-index: 1;", segmentedSource.indexOf(".motion-switch-segmented-option"))
    ).toBeGreaterThan(-1);
    expect(
      segmentedSource.indexOf("z-index: 2;", segmentedSource.indexOf(".motion-switch-segmented-track::after"))
    ).toBeGreaterThan(-1);
    expect(
      segmentedSource.indexOf(
        "z-index: 3;",
        segmentedSource.indexOf(".motion-switch-segmented-option.is-active")
      )
    ).toBeGreaterThan(-1);
    expect(segmentedSource).not.toContain("is-pressing");
    expect(segmentedSource).not.toContain("requestAnimationFrame(replay);");
    expect(segmentedSource).toContain("function render(nextIndex)");
    const segmentedSelectStart = segmentedSource.indexOf("function select(nextIndex)");
    const segmentedStateUpdate = segmentedSource.indexOf("render(nextIndex);", segmentedSelectStart);
    const segmentedSettleTimer = segmentedSource.indexOf(
      "timeoutId = window.setTimeout",
      segmentedSelectStart
    );
    expect(segmentedStateUpdate).toBeGreaterThan(segmentedSelectStart);
    expect(segmentedStateUpdate).toBeLessThan(segmentedSettleTimer);

    const contentFeedback = generateAtomicMotionComponent({
      elementId: "content-feedback",
      variant: "单选/多选",
      now: 1717747200000
    });
    expect(atomicMotionTriggerRule("content-feedback", "单选/多选")).toEqual({
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    });
    expect(contentFeedback.manifest.motionRecipes?.[0]?.trigger).toBe("click");
    const contentFeedbackSource = contentFeedback.source.files.map((file) => file.content).join("\n");
    expect(contentFeedbackSource).toContain("--foreground-layer-width: 32px");
    expect(contentFeedbackSource).toContain("--foreground-layer-height: 32px");
    expect(contentFeedbackSource).toContain("content-feedback-selection-unchecked");
    expect(contentFeedbackSource).toContain("border: 2px solid #b4b8bf;");
    expect(contentFeedbackSource).toContain("border-radius: 16px;");
    expect(contentFeedbackSource).toContain("content-feedback-selection-checked");
    expect(contentFeedbackSource).toContain('data-motion="selectionChecked"');
    expect(contentFeedbackSource).toContain("data:image/svg+xml");
    expect(contentFeedbackSource).toContain("fill%3D%22%23ff0f23%22");
    expect(contentFeedbackSource).toContain("fill%3D%22%23ffffff%22");
    expect(contentFeedbackSource).toContain(".is-playing [data-motion=selectionChecked]");
    expect(contentFeedbackSource).toContain('root.classList.add("is-selected")');
    expect(contentFeedbackSource).toContain('root.classList.remove("is-selected", "is-playing")');
    expect(contentFeedbackSource).toContain('root.classList.contains("is-selected")');
    expect(contentFeedbackSource).toContain('target.addEventListener("click", toggleSelected)');
    expect(contentFeedbackSource).toContain('target.setAttribute("aria-checked", "false")');
    expect(contentFeedbackSource).toContain('target.setAttribute("role", "checkbox")');
    expect(contentFeedbackSource).not.toContain("border: 3px solid #FF465A");
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

  it("generates the front-back entry skills collected from the base motion PDF", () => {
    expect(motionSkillElements.some((element) => element.label === "前后进场" && element.active)).toBe(true);
    expect(atomicMotionTriggerRule("front-back-entry", "滑动操作")).toEqual({
      defaultTrigger: "swipe",
      allowedTriggers: ["swipe"]
    });

    const halfSheet = generateAtomicMotionComponent({
      elementId: "front-back-entry",
      variant: "半弹层",
      now: 1717747200000
    });
    const halfSheetSource = halfSheet.source.files.map((file) => file.content).join("\n");

    expect(halfSheet.manifest.motionSkill).toMatchObject({
      element: "前后进场",
      variant: "半弹层",
      family: "front-back-entry",
      recipeId: "front-back-entry.half-sheet.enter",
      tokens: [
        expect.objectContaining({ animationType: "位移", property: "position" }),
        expect.objectContaining({ animationType: "透明度-淡入", property: "opacity" })
      ]
    });
    expect(halfSheetSource).toContain("@keyframes front-back-entry-half-sheet-position");
    expect(halfSheetSource).not.toContain("--thumbnail-focus-");
    expect(halfSheetSource).toContain(
      ".motion-skill-front-back-entry {\n  width: var(--stage-width);\n  height: var(--stage-height);"
    );
    expect(halfSheetSource).toContain("transform: none;");
    expect(halfSheetSource).not.toContain("calc(82vw / 374px)");
    expect(halfSheetSource).not.toContain("calc(82vh / 812px)");
    expect(halfSheetSource).toContain("background: transparent;");
    expect(halfSheetSource).toContain(
      ".motion-skill-front-back-entry .motion-skill-background {\n  left: calc((100% - var(--background-layer-width)) / 2);"
    );
    expect(halfSheetSource).toContain("background: #3f3f46;");
    expect(halfSheetSource).toContain("border-radius: 32px;");
    expect(halfSheetSource).toContain("overflow: hidden;");
    expect(halfSheetSource).toContain(".motion-skill-front-back-entry-half-sheet .motion-skill-foreground");
    expect(halfSheetSource).toContain("left: calc((100% - var(--background-layer-width)) / 2 + 12px);");
    expect(halfSheetSource).toContain(
      "top: calc((100% - var(--background-layer-height)) / 2 + var(--background-layer-height) / 2 + 12px);"
    );
    expect(halfSheetSource).toContain("width: calc(var(--background-layer-width) - 24px);");
    expect(halfSheetSource).toContain("height: calc(var(--background-layer-height) / 2 + 48px);");
    expect(halfSheetSource).toContain("66.667% { transform: translateY(-4.405%); }");
    expect(halfSheetSource).not.toContain(
      "calc(var(--front-back-entry-half-sheet-position-keyframe-2-y, 460px) - var(--front-back-entry-half-sheet-position-keyframe-1-y, 480px))"
    );

    const detailPageSource = generateAtomicMotionComponent({
      elementId: "front-back-entry",
      variant: "二级页跳转",
      now: 1717747200000
    })
      .source.files.map((file) => file.content)
      .join("\n");
    expect(detailPageSource).toContain(".motion-skill-front-back-entry-detail-page .motion-skill-foreground");
    expect(detailPageSource).not.toContain("--thumbnail-focus-");
    expect(detailPageSource).toContain("width: var(--background-layer-width);");
    expect(detailPageSource).toContain("height: var(--background-layer-height);");
    expect(detailPageSource).toContain("front-back-detail-page");
    expect(detailPageSource).toContain("0% { transform: translateX(100%); }");
    expect(detailPageSource).toContain("100% { transform: translateX(0%); }");
    expect(detailPageSource).not.toContain("+ 375px");

    const actionPanelSource = generateAtomicMotionComponent({
      elementId: "front-back-entry",
      variant: "动作面板",
      now: 1717747200000
    })
      .source.files.map((file) => file.content)
      .join("\n");
    expect(actionPanelSource).toContain(
      ".motion-skill-front-back-entry-action-panel .motion-skill-foreground"
    );
    expect(actionPanelSource).not.toContain("--thumbnail-focus-");
    expect(actionPanelSource).toContain(
      "left: calc((100% - var(--background-layer-width)) / 2 + var(--background-layer-width) / 31.1667);"
    );
    expect(actionPanelSource).toContain(
      "top: calc((100% - var(--background-layer-height)) / 2 + var(--background-layer-height) / 50.75);"
    );
    expect(actionPanelSource).toContain("bottom: auto;");
    expect(actionPanelSource).toContain(
      "width: calc(var(--background-layer-width) - var(--background-layer-width) / 15.5833);"
    );
    expect(actionPanelSource).toContain("height: calc(var(--background-layer-height) / 5);");
    expect(actionPanelSource).toContain(
      "transform: translateY(calc(-100% - var(--background-layer-height) / 50.75));"
    );
    expect(actionPanelSource).toContain("0% { transform: translateY(-98.522%); }");
    expect(actionPanelSource).not.toContain("/ 812px * var(--background-layer-height)");
    expect(actionPanelSource).toContain("front-back-action-panel");

    const swipeAction = generateAtomicMotionComponent({
      elementId: "front-back-entry",
      variant: "滑动操作",
      now: 1717747200000
    });
    const swipeSource = swipeAction.source.files.map((file) => file.content).join("\n");
    expect(swipeAction.manifest.motionRecipes?.[0]?.trigger).toBe("swipe");
    expect(swipeAction.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "backgroundImage",
          default: expect.stringMatching(/^data:image\/png;base64,/)
        }),
        expect.objectContaining({
          id: "foregroundImage",
          default: expect.stringMatching(/^data:image\/png;base64,/)
        })
      ])
    );
    expect(swipeAction.manifest.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "backgroundLayer", label: "背景层", kind: "image" }),
        expect.objectContaining({ id: "foregroundLayer", label: "前景层", kind: "image" }),
        expect.objectContaining({ id: "swipeLayer1", label: "滑块1", kind: "structure" }),
        expect.objectContaining({ id: "swipeLayer5", label: "滑块5", kind: "structure" })
      ])
    );
    expect(swipeSource).toContain("--stage-width: 750px");
    expect(swipeSource).toContain("--stage-height: 324px");
    expect(swipeSource).toContain("--foreground-layer-width: 750px");
    expect(swipeSource).toContain("--foreground-layer-height: 324px");
    expect(swipeSource).toContain("transform: scale(min(1, calc(82vw / 750px), calc(82vh / 324px)));");
    expect(swipeSource).toContain('data-motion="backgroundImage" src="data:image/png;base64,');
    expect(swipeSource).toContain('data-motion="foregroundImage" src="data:image/png;base64,');
    expect(swipeSource).toContain('data-motion="swipeLayer1"');
    expect(swipeSource).toContain('data-motion="swipeLayer5"');
    expect(swipeSource).toContain('data-label="加常买"');
    expect(swipeSource).toContain('data-icon="★"');
    expect(swipeSource).toContain("swipeThresholdPx = 48");
    expect(swipeSource).toContain("const openDistance = -576;");
    expect(swipeSource).toContain('root.style.setProperty("--swipe-foreground-x"');
    expect(swipeSource).toContain('root.addEventListener("pointermove"');
    expect(swipeSource).toContain("setDragPosition(nextX);");
    expect(swipeSource).toContain("function settleTo(x)");
    expect(swipeSource).toContain('root.classList.add("is-settling")');
    expect(swipeSource).toContain('root.classList.add("is-dragging")');
    expect(swipeSource).toContain("settleTo(openDistance);");
    expect(swipeSource).toContain("settleTo(0);");
    expect(swipeSource).toContain("let dragStartX = 0;");
    expect(swipeSource).toContain("dragStartX = event.clientX;");
    expect(swipeSource).toContain("touch-action: pan-y;");
    expect(swipeSource).toContain("user-select: none;");
    expect(swipeSource).toContain("-webkit-user-select: none;");
    expect(swipeSource).toContain('root.addEventListener("selectstart", (event) => event.preventDefault());');
    expect(swipeSource).toContain("event.preventDefault();");
    expect(swipeSource).not.toContain("const swipeTarget = target ?? root;");
    expect(swipeSource).toContain('addEventListener("pointerdown"');
    expect(swipeSource).toContain('addEventListener("pointerup"');
    expect(swipeSource).toContain("const deltaX = event.clientX - dragStartX;");
    expect(swipeSource).toContain("if (deltaX > swipeThresholdPx) reverse();");
    expect(swipeSource).toContain(
      "else if (currentX <= openDistance / 2 || deltaX < -swipeThresholdPx) replay();"
    );
    expect(swipeSource).toContain("else reverse();");
    expect(swipeSource).toContain("function reverse()");
    expect(swipeSource).not.toContain('root.classList.remove("is-playing")');
    expect(swipeSource).not.toContain('root.classList.add("is-playing")');
    expect(swipeSource).not.toContain("void root.offsetWidth;");
    expect(swipeSource).not.toContain('style.animation = "none"');
    expect(swipeSource).not.toContain("requestAnimationFrame(replay);");
    expect(swipeSource).not.toContain("@keyframes front-back-entry-swipe-foreground");
    expect(swipeSource).toContain(
      ".motion-skill-front-back-entry-swipe-action.is-settling .motion-skill-foreground,"
    );
    expect(swipeSource).toContain(
      ".motion-skill-front-back-entry-swipe-action.is-settling .front-back-swipe-actions"
    );
    expect(swipeSource).toContain(
      "transition: transform var(--front-back-entry-swipe-action-position-5-duration, 200ms)"
    );
    expect(swipeSource).not.toContain("front-back-swipe-card");
    expect(swipeSource).not.toContain("@keyframes front-back-entry-swipe-action-position-5");
    expect(swipeSource).not.toContain("@keyframes front-back-entry-swipe-action-position-1");
    expect(swipeSource).toContain('root.style.setProperty("--swipe-open-distance", `${openDistance}px`);');
    expect(swipeSource).not.toContain(
      "66.667% { transform: translateX(var(--front-back-entry-swipe-action-position-1-keyframe-1-x, 54px)); }"
    );
    expect(swipeSource).not.toContain(".is-playing [data-motion=swipeLayer1]");
    expect(swipeSource).not.toContain(".is-playing [data-motion=swipeLayer5]");
    expect(swipeSource).toContain("left: 100%;");
    expect(swipeSource).toContain("display: flex;");
    expect(swipeSource).toContain("width: 560px;");
    expect(swipeSource).toContain("border-radius: 16px;");
    expect(swipeSource).toContain("transform: translateX(var(--swipe-foreground-x, 0px));");
    expect(swipeSource).toContain("top: 96px;");
    expect(swipeSource).toContain("width: 112px;");
    expect(swipeSource).toContain("height: 216px;");
    expect(swipeSource).toContain("gap: 12px;");
    expect(swipeSource).toContain("font-size: 20px;");
    expect(swipeSource).toContain("line-height: 28px;");
    expect(swipeSource).toContain("content: attr(data-icon);");
    expect(swipeSource).toContain("content: attr(data-label);");

    expect(motionSkillTokenSummary({ elementId: "front-back-entry", variant: "滑动操作" })).toEqual([
      "滑块1-位移 · 300ms · delay 0ms · x 0 / y 0 -> x 86 / y 0 -> x -86 / y 0",
      "滑块2-位移 · 200ms · delay 0ms · x 0 / y 0 -> x -172 / y 0",
      "滑块3-位移 · 200ms · delay 0ms · x 0 / y 0 -> x -258 / y 0",
      "滑块4-位移 · 200ms · delay 0ms · x 0 / y 0 -> x -344 / y 0",
      "滑块5-位移 · 200ms · delay 0ms · x 0 / y 0 -> x -430 / y 0"
    ]);
  });

  it("generates the global content loading motion from the lottie source", () => {
    expect(motionSkillElements.find((element) => element.id === "content-loading")).toMatchObject({
      active: true,
      variants: ["全局"],
      status: "active"
    });
    expect(atomicMotionTriggerRule("content-loading", "全局")).toEqual({
      defaultTrigger: "loop",
      allowedTriggers: ["loop"]
    });

    const component = generateAtomicMotionComponent({
      elementId: "content-loading",
      variant: "全局",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionSkill).toMatchObject({
      element: "内容加载",
      variant: "全局",
      family: "content-loading",
      recipeId: "content-loading.global.enter"
    });
    expect(component.manifest.motionRecipes?.[0]).toMatchObject({
      trigger: "loop",
      category: "loop"
    });
    expect(component.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "contentLoadingGlobalScaleDuration", default: 1467 })
      ])
    );
    expect(sourceText).toContain("content-loading-global-mark");
    expect(sourceText).toContain("content-loading-global-fill");
    expect(sourceText).toContain("content-loading-global-highlight");
    expect(sourceText).toContain('viewBox="-320 -224 640 448"');
    expect(sourceText).toContain("--foreground-layer-width: 640px");
    expect(sourceText).toContain("--foreground-layer-height: 448px");
    expect(sourceText).toContain("width: min(var(--foreground-layer-width), calc(100% - 48px));");
    expect(sourceText).toContain("aspect-ratio: 640 / 448;");
    expect(sourceText).toContain(
      ".motion-skill-content-loading-global {\n  background: transparent;\n  border-radius: 0;\n  box-shadow: none;\n  overflow: visible;"
    );
    expect(sourceText).toContain("stroke-width: 36;");
    expect(sourceText).toContain("@keyframes content-loading-global-fade");
    expect(sourceText).toContain(
      "animation: content-loading-global-fade var(--content-loading-global-scale-duration, 1467ms)"
    );
    expect(sourceText).toContain("34.091%, 100%");
    expect(sourceText).toContain("transform: scale(1);");
    expect(sourceText).not.toContain("@keyframes content-loading-global-breathe");
    expect(sourceText).not.toContain("animation: content-loading-global-breathe");
    expect(sourceText).toContain("infinite");
    expect(sourceText).toContain("requestAnimationFrame(replay);");
    expect(sourceText).toContain("window.motionReplay = replay");
    expect(sourceText).not.toContain("<video");
    expect(sourceText).not.toContain(".gif");
    expect(sourceText).not.toContain("data:image/webp");

    expect(motionSkillTokenSummary({ elementId: "content-loading", variant: "全局" })).toEqual([
      "透明度-淡入 · 500ms · delay 0ms · 0 -> 1",
      "缩放 · 1467ms · delay 0ms · 1.33 -> 1.25 -> 1.33"
    ]);
  });

  it("rejects incomplete content loading variants before generation", () => {
    expect(() =>
      generateAtomicMotionComponent({
        elementId: "content-loading",
        variant: "骨架",
        now: 1717747200000
      })
    ).toThrow(/未找到所选梯度的动效参数/);
  });
});
