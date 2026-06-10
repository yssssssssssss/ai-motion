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
    expect(sourceText).toContain("--stage-width: 430px");
    expect(sourceText).toContain("--stage-height: 932px");
    expect(sourceText).toContain("--background-layer-width: 500px");
    expect(sourceText).toContain("--background-layer-height: 1060px");
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
          backgroundLayerHeight: 960
        }
      }
    });

    expect(patched["source/style.css"]).toContain("--stage-width: 393px");
    expect(patched["source/style.css"]).toContain("--stage-height: 852px");
    expect(patched["source/style.css"]).toContain("--background-layer-width: 450px");
    expect(patched["source/style.css"]).toContain("--background-layer-height: 960px");
  });

  it("restores popup feedback foreground sizes from large, medium, and small variants", () => {
    const compiled = compileMotionSkillsFromRows({ rows: popupSizeRows, previousLock: null });
    const heights = Object.fromEntries(
      [
        ["large", "popup-feedback.large.enter"],
        ["medium", "popup-feedback.medium.enter"],
        ["small", "popup-feedback.small.enter"]
      ].map(([variant, recipeId]) => {
        const component = createMotionSkillDraftComponent({
          registry: compiled.registry,
          pack: compiled.packs["popup-feedback"]!,
          recipeId,
          now: 1717747200000
        });
        const css = component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
        const height = Number(css.match(/--foreground-layer-height:\s*(\d+)px/)?.[1]);
        const width = Number(css.match(/--foreground-layer-width:\s*(\d+)px/)?.[1]);
        return [variant, { height, width }] as const;
      })
    );

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
    expect(sourceText).toContain("width: var(--container-transform-product-card-size-keyframe-1-width, 355px);");
    expect(sourceText).toContain("height: var(--container-transform-product-card-size-keyframe-1-height, 512px);");
    expect(sourceText).toContain("border-radius: var(--container-transform-product-card-roundness-keyframe-1, 12px);");
    expect(sourceText).toContain("left: var(--container-transform-product-card-position-keyframe-1-x, 182px);");
    expect(sourceText).toContain("top: var(--container-transform-product-card-position-keyframe-1-y, 564px);");
    expect(component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining([
        "containerTransformProductCardSizeKeyframe1Width",
        "containerTransformProductCardSizeKeyframe1Height",
        "containerTransformProductCardPositionKeyframe1Y"
      ])
    );
  });
});
