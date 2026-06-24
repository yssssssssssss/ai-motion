import { describe, expect, it } from "vitest";
import {
  applyPatchToFiles,
  compileMotionSkillsFromRows,
  createMotionSkillDraftComponent,
  motionSkillRecipeToMotionRecipe,
  validateGeneratedComponent,
  validateRecipeApplication
} from "../src";

const rows = [
  {
    元素: "弹窗反馈",
    梯度: "中型尺寸",
    Token: "standard easing",
    Value: "200ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale:95->105->100",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "",
    Value: "150ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity:0->100",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  }
];

const popupSizeRows = [
  {
    元素: "弹窗反馈",
    梯度: "大型尺寸",
    Token: "standard easing",
    Value: "300ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale:95->105->100",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "",
    Value: "200ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity:0->100",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  },
  {
    元素: "",
    梯度: "中型尺寸",
    Token: "standard easing",
    Value: "200ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale:95->105->100",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "",
    Value: "150ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity:0->100",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  },
  {
    元素: "",
    梯度: "小型尺寸",
    Token: "standard easing",
    Value: "150ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale:95->105->100",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "",
    Value: "100ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity:0->100",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  }
];

const containerRows = [
  {
    元素: "容器变换",
    梯度: "商卡",
    Token: "standard easing",
    Value: "400ms",
    Delay: "100ms",
    动画类型: "对角缩放",
    关键属性变化: "size: 176 → 355 | 176 → 512",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "",
    Value: "400ms",
    Delay: "100ms",
    动画类型: "圆度",
    关键属性变化: "roundness: 8 → 12",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "ease out",
    Value: "400ms",
    Delay: "100ms",
    动画类型: "位移",
    关键属性变化: "position: x 182→182 | y 602→564",
    "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
  }
];

const contentLoadingPack = {
  manifest: {
    id: "content-loading",
    name: "内容加载",
    version: "1.0.0",
    source: "designer-csv" as const,
    variants: ["全局"],
    defaultVariant: "global",
    tokenFile: "tokens.json",
    recipeFile: "recipes.json",
    skillFile: "skill.md"
  },
  recipes: [
    {
      id: "content-loading.global.enter",
      name: "内容加载 / 全局",
      family: "content-loading",
      sourceElement: "内容加载",
      variant: "global",
      sourceVariant: "全局",
      targetRole: "unknown" as const,
      targetLayer: "前景层",
      trigger: "loop" as const,
      tokenIds: ["content-loading.global.opacity", "content-loading.global.scale"]
    }
  ],
  tokens: [
    {
      id: "content-loading.global.opacity",
      family: "content-loading",
      sourceElement: "内容加载",
      variant: "global",
      sourceVariant: "全局",
      targetRole: "unknown" as const,
      targetLayer: "前景层",
      token: "lottie",
      property: "opacity" as const,
      durationMs: 500,
      delayMs: 0,
      easing: "cubic-bezier(0.79, 0, 0.714, 1)",
      keyframes: [0, 1],
      metadata: {
        animationType: "透明度-淡入",
        sourceChange: "opacity: 0 -> 100%",
        sourceValue: "500ms",
        sourceDelay: "0ms",
        sourceCssValue: "(0.79, 0.00, 0.714, 1.00)"
      }
    },
    {
      id: "content-loading.global.scale",
      family: "content-loading",
      sourceElement: "内容加载",
      variant: "global",
      sourceVariant: "全局",
      targetRole: "unknown" as const,
      targetLayer: "前景层",
      token: "lottie",
      property: "scale" as const,
      durationMs: 1467,
      delayMs: 0,
      easing: "cubic-bezier(0.36, 0, 0.21, 1)",
      keyframes: [1.33, 1.25, 1.33],
      metadata: {
        animationType: "缩放",
        sourceChange: "scale: 133% -> 125% -> 133%",
        sourceValue: "1467ms",
        sourceDelay: "0ms",
        sourceCssValue: "(0.36, 0.00, 0.21, 1.00)"
      }
    }
  ]
};

describe("motion skill recipe adapter", () => {
  it("converts compiled popup tokens into a MotionRecipe", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const pack = compiled.packs["popup-feedback"]!;
    const recipe = motionSkillRecipeToMotionRecipe({
      manifest: pack.manifest,
      recipe: pack.recipes[0]!,
      tokens: pack.tokens
    });

    expect(recipe).toMatchObject({
      id: "popup-feedback.medium.enter",
      name: "弹窗反馈 / 中型尺寸",
      category: "feedback",
      trigger: "load"
    });
    expect(recipe.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["popupFeedbackMediumScaleDuration", "popupFeedbackMediumOpacityDuration"])
    );
    expect(recipe.bindings.keyframes).toEqual(
      expect.arrayContaining(["popup-feedback-medium-scale", "popup-feedback-medium-opacity"])
    );
  });

  it("creates a generated draft component with motionSkill metadata and replayable source", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const component = createMotionSkillDraftComponent({
      registry: compiled.registry,
      pack: compiled.packs["popup-feedback"]!,
      recipeId: "popup-feedback.medium.enter",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");
    const binding = component.manifest.motionRecipes?.[0]!;

    expect(component.source.origin).toBe("generated");
    expect(component.manifest.motionSkill).toMatchObject({
      source: "designer-csv",
      element: "弹窗反馈",
      variant: "中型尺寸",
      family: "popup-feedback",
      version: "1.0.0",
      recipeId: "popup-feedback.medium.enter",
      target: {
        layerId: "foregroundLayer",
        label: "前景层",
        role: "foreground",
        selector: "[data-motion=foregroundLayer]"
      },
      tokens: [
        {
          token: "standard easing",
          animationType: "缩放",
          targetLayer: "前景层",
          value: "200ms",
          delay: "50ms",
          propertyChange: "scale:95->105->100",
          cssValue: "(0.38, 0.00, 0.24, 1.00)"
        },
        {
          token: "standard easing",
          animationType: "透明度-淡入",
          value: "150ms",
          delay: "50ms",
          propertyChange: "opacity:0->100",
          cssValue: "(0.80, 0.00, 1.00, 1.00)"
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
        expect.objectContaining({
          id: "backgroundLayer",
          label: "背景层",
          paramId: "backgroundImage",
          required: false
        }),
        expect.objectContaining({
          id: "foregroundLayer",
          label: "前景层",
          paramId: "foregroundImage",
          required: true
        })
      ])
    );
    expect(binding.targetLayerIds).toEqual(["foregroundLayer"]);
    expect(sourceText).toContain("--stage-width: 375px");
    expect(sourceText).toContain("--stage-height: 812px");
    expect(sourceText).toContain("--background-layer-width: 375px");
    expect(sourceText).toContain("--background-layer-height: 812px");
    expect(sourceText).toContain("--foreground-layer-radius: 24px");
    expect(sourceText).toContain("border-radius: var(--foreground-layer-radius, 24px)");
    expect(sourceText).toContain("width: var(--stage-width)");
    expect(sourceText).toContain("height: var(--stage-height)");
    expect(sourceText).toContain("width: var(--background-layer-width)");
    expect(sourceText).toContain("height: var(--background-layer-height)");
    expect(sourceText).toContain(".motion-skill-background");
    expect(sourceText).toContain("background: #3f3f46");
    expect(sourceText).toContain(".motion-skill-foreground");
    expect(sourceText).toContain("background: #e5e7eb");
    expect(sourceText).not.toContain("--phone-width");
    expect(sourceText).not.toContain("aspect-ratio: 375 / 812");
    expect(sourceText).toContain('data-motion="backgroundLayer"');
    expect(sourceText).toContain('data-motion="backgroundImage"');
    expect(sourceText).toContain('data-motion="foregroundLayer"');
    expect(sourceText).toContain('data-motion="foregroundImage"');
    expect(sourceText).toContain("object-fit: fill");
    expect(sourceText).toContain('.motion-skill-layer-image[src=""]');
    expect(sourceText).toContain("display: none");
    expect(sourceText).not.toContain("object-fit: cover");
    expect(sourceText).toContain("window.motionReplay");
    expect(
      validateRecipeApplication({
        binding,
        params: component.manifest.params,
        layers: component.manifest.layers ?? [],
        sourceText
      }).valid
    ).toBe(true);
    expect(
      validateGeneratedComponent({
        component,
        allowed: {
          paramIds: component.manifest.params.map((param) => param.id),
          layerIds: (component.manifest.layers ?? []).map((layer) => layer.id),
          sourceFiles: component.source.files.map((file) => file.path)
        }
      }).valid
    ).toBe(true);
  });

  it("creates a generated draft component with swipe-triggered replay", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const component = createMotionSkillDraftComponent({
      registry: compiled.registry,
      pack: compiled.packs["popup-feedback"]!,
      recipeId: "popup-feedback.medium.enter",
      trigger: "swipe",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionRecipes?.[0]?.trigger).toBe("swipe");
    expect(sourceText).toContain("swipeThresholdPx = 48");
    expect(sourceText).toContain('addEventListener("pointerdown"');
    expect(sourceText).toContain('addEventListener("pointerup"');
    expect(sourceText).toContain("if (deltaX < 0) replay();");
    expect(sourceText).toContain("else reverse();");
    expect(sourceText).not.toContain("requestAnimationFrame(replay);");
  });

  it("binds uploaded atomic layer images to real image elements", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const component = createMotionSkillDraftComponent({
      registry: compiled.registry,
      pack: compiled.packs["popup-feedback"]!,
      recipeId: "popup-feedback.medium.enter",
      now: 1717747200000
    });
    const sourceFiles = Object.fromEntries(component.source.files.map((file) => [file.path, file.content]));
    const patched = applyPatchToFiles({
      files: sourceFiles,
      manifest: component.manifest,
      patch: {
        id: "layer-images",
        sourceManifestId: component.manifest.id,
        values: {
          backgroundImage: "data:image/png;base64,BACKGROUND",
          foregroundImage: "data:image/png;base64,FOREGROUND"
        }
      }
    });

    expect(component.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "backgroundImage",
          targets: [
            {
              kind: "html-attribute",
              file: "source/index.html",
              selector: "[data-motion=backgroundImage]",
              attribute: "src"
            }
          ]
        }),
        expect.objectContaining({
          id: "foregroundImage",
          targets: [
            {
              kind: "html-attribute",
              file: "source/index.html",
              selector: "[data-motion=foregroundImage]",
              attribute: "src"
            }
          ]
        })
      ])
    );
    expect(patched["source/index.html"]).toContain('data-motion="backgroundImage"');
    expect(patched["source/index.html"]).toContain('src="data:image/png;base64,BACKGROUND"');
    expect(patched["source/index.html"]).toContain('data-motion="foregroundImage"');
    expect(patched["source/index.html"]).toContain('src="data:image/png;base64,FOREGROUND"');
    expect(patched["source/style.css"]).toContain("object-fit: fill");
  });

  it("patches atomic stage and background layer size variables", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const component = createMotionSkillDraftComponent({
      registry: compiled.registry,
      pack: compiled.packs["popup-feedback"]!,
      recipeId: "popup-feedback.medium.enter",
      now: 1717747200000
    });
    const sourceFiles = Object.fromEntries(component.source.files.map((file) => [file.path, file.content]));
    const patched = applyPatchToFiles({
      files: sourceFiles,
      manifest: component.manifest,
      patch: {
        id: "layer-size",
        sourceManifestId: component.manifest.id,
        values: {
          stageWidth: 393,
          stageHeight: 852,
          backgroundLayerWidth: 450,
          backgroundLayerHeight: 960,
          foregroundLayerRadius: 18,
          foregroundLayerWidth: 320,
          foregroundLayerHeight: 240
        }
      }
    });

    expect(patched["source/style.css"]).toContain("--stage-width: 393px");
    expect(patched["source/style.css"]).toContain("--stage-height: 852px");
    expect(patched["source/style.css"]).toContain("--background-layer-width: 450px");
    expect(patched["source/style.css"]).toContain("--background-layer-height: 960px");
    expect(patched["source/style.css"]).toContain("--foreground-layer-radius: 18px");
    expect(patched["source/style.css"]).toContain("--foreground-layer-width: 320px");
    expect(patched["source/style.css"]).toContain("--foreground-layer-height: 240px");
  });

  it("restores popup feedback foreground sizes from large, medium, and small variants", () => {
    const compiled = compileMotionSkillsFromRows({ rows: popupSizeRows, previousLock: null });
    const heights: Record<"large" | "medium" | "small", { height: number; width: number }> = {
      large: { height: 0, width: 0 },
      medium: { height: 0, width: 0 },
      small: { height: 0, width: 0 }
    };
    for (const [variant, recipeId] of [
      ["large", "popup-feedback.large.enter"],
      ["medium", "popup-feedback.medium.enter"],
      ["small", "popup-feedback.small.enter"]
    ] as const) {
      const component = createMotionSkillDraftComponent({
        registry: compiled.registry,
        pack: compiled.packs["popup-feedback"]!,
        recipeId,
        now: 1717747200000
      });
      const css = component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
      const height = Number(css.match(/--foreground-layer-height:\s*(\d+)px/)?.[1]);
      const width = Number(css.match(/--foreground-layer-width:\s*(\d+)px/)?.[1]);
      heights[variant] = { height, width };
    }

    expect(heights.large.height).toBeGreaterThan(360);
    expect(heights.medium.height).toBeGreaterThan(200);
    expect(heights.medium.height).toBeLessThan(360);
    expect(heights.small.height).toBeLessThan(200);
    expect(heights.large.width).toBeGreaterThan(heights.medium.width);
    expect(heights.medium.width).toBeGreaterThan(heights.small.width);
  });

  it("creates replayable source for compound container transform tokens", () => {
    const compiled = compileMotionSkillsFromRows({ rows: containerRows, previousLock: null });
    const component = createMotionSkillDraftComponent({
      registry: compiled.registry,
      pack: compiled.packs["container-transform"]!,
      recipeId: "container-transform.product-card.enter",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionSkill).toMatchObject({
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
    expect(sourceText).toContain("motion-skill-container-transform-product-card");
    expect(sourceText).toContain("--stage-width: 374px");
    expect(sourceText).toContain("--stage-height: 812px");
    expect(sourceText).not.toContain("--thumbnail-focus-");
    expect(sourceText).not.toContain("motion-skill-product-grid");
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
    expect(sourceText).not.toContain(
      ".motion-skill-container-transform-product-card .motion-skill-background {\n  inset: 0;"
    );
    expect(sourceText).toContain(
      "width: var(--container-transform-product-card-size-keyframe-1-width, 355px);"
    );
    expect(sourceText).toContain(
      "height: var(--container-transform-product-card-size-keyframe-1-height, 512px);"
    );
    expect(sourceText).toContain(
      "border-radius: var(--container-transform-product-card-roundness-keyframe-1, 12px);"
    );
    expect(sourceText).toContain(
      "left: calc(var(--container-transform-card-anchor-left, 8px) + (var(--container-transform-product-card-position-keyframe-1-x, 182px) - 182px));"
    );
    expect(sourceText).toContain(
      "bottom: calc(var(--container-transform-card-anchor-bottom, 34px) - (var(--container-transform-product-card-position-keyframe-1-y, 564px) - 602px));"
    );
    expect(sourceText).toContain("transform-origin: left bottom;");
    expect(component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining([
        "containerTransformProductCardSizeKeyframe1Width",
        "containerTransformProductCardSizeKeyframe1Height",
        "containerTransformProductCardPositionKeyframe1Y"
      ])
    );
  });

  it("renders horizontal switch variants with reference-specific default controls", () => {
    const horizontalRows = [
      {
        元素: "横向切换",
        梯度: "Tab导航",
        Token: "standard easing",
        Value: "300ms",
        Delay: "0ms",
        动画类型: "位移",
        关键属性变化: "position: 0 → -86",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "standard easing",
        Value: "300ms",
        Delay: "0ms",
        动画类型: "横向缩放",
        关键属性变化: "size: 16 → 32(80ms) → 16 | 2.5 → 2.5(80ms) → 2.5",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "ease out",
        Value: "120ms",
        Delay: "80ms",
        动画类型: "颜色",
        关键属性变化: "color: #FFF2F3 → #11141A",
        "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
      },
      {
        元素: "",
        梯度: "频道Tab",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "位移",
        关键属性变化: "position: x 34 → 110.4(100ms) → 106.4 | y 74 → 74(100ms) → 74",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "横向缩放",
        关键属性变化: "size: 36 → 46(80ms) → 44 | 36 → 46(80ms) → 44",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "ease out",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "透明度-淡入",
        关键属性变化: "opacity：0 → 100%",
        "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
      },
      {
        元素: "",
        梯度: "Tabbar底导",
        Token: "standard easing",
        Value: "300ms",
        Delay: "0ms",
        动画类型: "位移",
        关键属性变化: "position: 0 → -61.4",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "standard easing",
        Value: "300ms",
        Delay: "0ms",
        动画类型: "横向缩放",
        关键属性变化: "size: 65.4 → 80.4(80ms) → 65.4 | 44 → 44(80ms) → 44",
        "CSS Value": "(0.80, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "开关",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "位移",
        关键属性变化: "position: 0 → 20",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "横向缩放",
        关键属性变化: "size: 32 → 45(33ms) → 32 | 40 → 40(33ms) → 40",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "ease out",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "颜色",
        关键属性变化: "color: #B4B8BF → #FFF2F3",
        "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
      },
      {
        元素: "",
        梯度: "指示器",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "横向缩放",
        关键属性变化: "size: 8 → 4 | 4 → 4",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "ease out",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "颜色",
        关键属性变化: "color: #FFF2F3 → #F0F0F5",
        "CSS Value": "(0.00, 0.00, 0.00, 1.00)"
      },
      {
        元素: "",
        梯度: "分段",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "位移",
        关键属性变化: "position: 0 → 72",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        梯度: "",
        Token: "standard easing",
        Value: "200ms",
        Delay: "0ms",
        动画类型: "横向缩放",
        关键属性变化: "size: 72 → 92(80ms) → 72 | 40 → 40(80ms) → 40",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      }
    ];
    const compiled = compileMotionSkillsFromRows({ rows: horizontalRows, previousLock: null });
    const pack = compiled.packs["horizontal-switch"]!;

    const componentByRecipe = Object.fromEntries(
      [
        "horizontal-switch.tab-navigation.enter",
        "horizontal-switch.channel-tab.enter",
        "horizontal-switch.tabbar.enter",
        "horizontal-switch.switch.enter",
        "horizontal-switch.indicator.enter",
        "horizontal-switch.segmented.enter"
      ].map((recipeId) => {
        const component = createMotionSkillDraftComponent({
          registry: compiled.registry,
          pack,
          recipeId,
          now: 1717747200000
        });
        return [recipeId, component];
      })
    );
    const cssByRecipe = Object.fromEntries(
      Object.entries(componentByRecipe).map(([recipeId, component]) => [
        recipeId,
        component.source.files.map((file) => file.content).join("\n")
      ])
    );

    const channelTabSource = cssByRecipe["horizontal-switch.channel-tab.enter"] ?? "";

    expect(pack.recipes.map((recipe) => recipe.id)).toContain("horizontal-switch.channel-tab.enter");
    expect(channelTabSource).toContain("motion-switch-channel-tabs");
    expect(channelTabSource).toContain("motion-switch-channel-tab is-active");
    expect(channelTabSource).toContain("--stage-width: 375px");
    expect(channelTabSource).toContain("--stage-height: 75px");
    expect(channelTabSource).toContain("border-radius: 0;");
    expect(channelTabSource).toContain("background: #ff0031;");
    expect(channelTabSource).toContain("transform: translateX(42px);");
    expect(channelTabSource).toContain("channel-icon-alarm");
    expect(channelTabSource.match(/data:image\/png;base64,/g) ?? []).toHaveLength(6);
    expect(channelTabSource).not.toContain('content: "SALE"');
    expect(channelTabSource).not.toContain("clip-path: polygon");
    expect(channelTabSource).toContain("horizontal-switch-channel-tab-icon-size-reverse");
    expect(channelTabSource).toContain("horizontal-switch-channel-tab-name-fade");
    expect(channelTabSource).toContain('previousTab.classList.add("is-deactivating")');
    expect(channelTabSource).toContain('data-motion="channelTabLabel2">秒杀');
    expect(channelTabSource).toContain("motion-switch-channel-active-bg");
    expect(channelTabSource).toContain("@keyframes horizontal-switch-channel-tab-active-bg");
    expect(channelTabSource).toContain("data:image/svg+xml,");
    expect(channelTabSource).toContain(
      "50% { transform: translateX(var(--channel-active-bg-overshoot-x, var(--horizontal-switch-channel-tab-position-keyframe-1-x, 110.4px))); }"
    );
    expect(channelTabSource).toContain(
      "40% { width: var(--horizontal-switch-channel-tab-size-keyframe-1-width, 46px); height: var(--horizontal-switch-channel-tab-size-keyframe-1-width, 46px); transform: translateY(-4px); }"
    );
    expect(channelTabSource).toContain(".motion-switch-channel-tab.is-activating");
    expect(componentByRecipe["horizontal-switch.channel-tab.enter"]?.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "channelTabLabel1", default: "推荐" }),
        expect.objectContaining({ id: "channelTabLabel6", default: "临期清仓" })
      ])
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain("motion-switch-text-tabs");
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain("--stage-width: 374px");
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain("left: 24px;");
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain("right: 24px;");
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      'button class="motion-switch-text-tab is-active"'
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      "motion-switch-text-tab-indicator"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      ".motion-switch-text-tab.is-active"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      "--tab-navigation-tab-width: calc(100% / 4);"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      "--tab-navigation-indicator-left: calc("
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      "left: var(--tab-navigation-indicator-left);"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      "left var(--horizontal-switch-tab-navigation-position-duration, 300ms)"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      "26.667% { width: var(--horizontal-switch-tab-navigation-size-keyframe-1-width, 32px);"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).not.toContain(
      ".is-playing .motion-switch-text-tabs"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).not.toContain(
      "@keyframes horizontal-switch-tab-navigation-label-2"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).not.toContain(
      "left: var(--horizontal-switch-tab-navigation-position-keyframe-1, -86px);"
    );
    expect(cssByRecipe["horizontal-switch.tab-navigation.enter"]).toContain(
      'data-motion="tabNavigationLabel1"'
    );
    expect(componentByRecipe["horizontal-switch.tab-navigation.enter"]?.manifest.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "activeColor", type: "color", default: "#e60012" }),
        expect.objectContaining({ id: "tabNavigationLabel1", type: "text", default: "内容名称" })
      ])
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("motion-switch-tabbar-shell");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain('data-motion="tabbarLayer"');
    expect(componentByRecipe["horizontal-switch.tabbar.enter"]?.manifest.motionRecipes?.[0]).toMatchObject({
      targetLayerIds: ["tabbarLayer"],
      targetSelectors: ["[data-motion=tabbarLayer]"]
    });
    expect(componentByRecipe["horizontal-switch.tabbar.enter"]?.manifest.motionSkill?.target).toMatchObject({
      layerId: "tabbarLayer",
      selector: "[data-motion=tabbarLayer]"
    });
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("--stage-width: 375px");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("--stage-height: 52px");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("left: 56px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("width: 319px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("motion-switch-joy-agent");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("motion-switch-joy-agent-image");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "https://img20.360buyimg.com/img/jfs/t1/458414/18/12592/185791/6a394f58F40ad981b/0276210210a38efd.png"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("width: 52px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("height: 52px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("left: -24px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("width: 100px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("motion-switch-tabbar-active-bg");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("--tabbar-item-step: 61.4px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("--tabbar-item-width: 65.4px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("--tabbar-item-overshoot-width: 80.4px;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "background: var(--tabbar-active-background, #f2f4f7);"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "color: var(--motion-active-color, #ff0f23);"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("font-weight: 600;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "--tabbar-icon-active: url(\"data:image/svg+xml,"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "--tabbar-icon-active-detail: url(\"data:image/svg+xml,"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "background-image: var(--tabbar-icon-active);"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "background-image: var(--tabbar-icon-active-detail);"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain("const ITEM_STEP = 61.4;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      'activeBg.style.setProperty("--tabbar-bg-from-x", previousIndex * ITEM_STEP + "px");'
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      'activeBg.style.setProperty("--tabbar-bg-to-x", nextIndex * ITEM_STEP + "px");'
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "animation: motion-switch-tabbar-bg-move 300ms cubic-bezier(0.38, 0, 0.24, 1) both;"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "transform: scaleX(calc(var(--tabbar-item-overshoot-width) / var(--tabbar-item-width)));"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "animation: motion-switch-tabbar-icon-in 300ms cubic-bezier(0.38, 0, 0.24, 1) both;"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      "window.motionReplay = function motionReplay() {\n    render(activeIndex);"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain(
      "select(Math.min(activeIndex + 1, items.length - 1));"
    );
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain("horizontal-switch-tabbar-selection");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain("@keyframes horizontal-switch-tabbar-icon-5");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain("translateX(245.6px)");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain("--stage-height: 140px");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain("border-top: 2px solid currentColor;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain("box-shadow: inset 0 -4px 0 #fff;");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain(".motion-switch-tabbar-shell::before");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).not.toContain(".motion-switch-joy-agent::before");
    expect(cssByRecipe["horizontal-switch.tabbar.enter"]).toContain(
      '<button class="is-active" type="button" data-tabbar-index="0" aria-pressed="true"><b></b><em>文案</em></button>'
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain("motion-switch-track");
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain("--switch-travel: 40px;");
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain("width: 112px;");
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain("height: 48px;");
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain("background: #b4b8bf;");
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      "background-color: var(--motion-active-color, #ff2338);"
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain("16.5% { width: 77px; }");
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      "@keyframes horizontal-switch-switch-position-reverse"
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      ".motion-skill-horizontal-switch-switch.is-toggling-on [data-motion=foregroundLayer]"
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      ".motion-skill-horizontal-switch-switch.is-toggling-off [data-motion=foregroundLayer]"
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      "transform: translateX(var(--switch-travel, 40px));"
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      ".motion-skill-horizontal-switch-switch {\n  --switch-travel: 40px;\n  background: transparent;"
    );
    expect(cssByRecipe["horizontal-switch.switch.enter"]).toContain(
      ".motion-skill-horizontal-switch-switch .motion-skill-foreground {\n  left: 8px;\n  top: 10px;"
    );
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain("motion-switch-indicators");
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain(
      "motion-switch-indicator-dot is-active"
    );
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain('data-indicator-index="0"');
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain("background: #f0f0f5;");
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain("width: 14px;");
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain(
      "background-color: var(--motion-active-color, #ff2338);"
    );
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain(
      "@keyframes horizontal-switch-indicator-size-shrink"
    );
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain(
      ".motion-switch-indicator-dot.is-growing"
    );
    expect(cssByRecipe["horizontal-switch.indicator.enter"]).toContain(
      ".motion-switch-indicator-dot.is-shrinking"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain("motion-switch-segmented-track");
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain("--stage-width: 240px");
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain("--foreground-layer-width: 72px");
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      ".motion-switch-segmented-track::after"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      ".motion-skill-horizontal-switch-segmented .motion-skill-foreground {\n  display: none;"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      "100% { transform: translateX(72px); }"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      "40% { width: var(--horizontal-switch-segmented-size-keyframe-1-width, 92px);"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      '.motion-switch-segmented-track[data-active-index="1"]::after'
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      ".motion-switch-segmented-track.is-moving-right::after"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).toContain(
      ".motion-switch-segmented-track.is-moving-left::after"
    );
    expect(cssByRecipe["horizontal-switch.segmented.enter"]).not.toContain("is-pressing");
  });

  it("creates the global content loading component from lottie shape data", () => {
    const component = createMotionSkillDraftComponent({
      registry: {
        version: "1.0",
        elements: [
          {
            id: "content-loading",
            label: "内容加载",
            latestVersion: "1.0.0",
            active: true,
            variants: ["全局"],
            packPath: "content-loading/manifest.json",
            status: "active"
          }
        ]
      },
      pack: contentLoadingPack,
      recipeId: "content-loading.global.enter",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");

    expect(component.manifest.motionRecipes?.[0]).toMatchObject({
      trigger: "loop",
      category: "loop"
    });
    expect(component.manifest.motionSkill).toMatchObject({
      element: "内容加载",
      variant: "全局",
      family: "content-loading",
      recipeId: "content-loading.global.enter"
    });
    expect(sourceText).toContain("--stage-width: 712px");
    expect(sourceText).toContain("--stage-height: 582px");
    expect(sourceText).toContain("--foreground-layer-width: 640px");
    expect(sourceText).toContain("--foreground-layer-height: 448px");
    expect(sourceText).toContain("width: min(var(--foreground-layer-width), calc(100% - 48px));");
    expect(sourceText).toContain("aspect-ratio: 640 / 448;");
    expect(sourceText).toContain("content-loading-global-mark");
    expect(sourceText).toContain("content-loading-global-highlight");
    expect(sourceText).toContain("viewBox=\"-320 -224 640 448\"");
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
    expect(sourceText).not.toContain("<video");
    expect(sourceText).not.toContain(".gif");
    expect(sourceText).not.toContain("data:image/webp");
  });
});
