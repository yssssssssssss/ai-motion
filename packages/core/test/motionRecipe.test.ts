import { describe, expect, it } from "vitest";
import {
  applyMotionRecipe,
  applyMotionRecipeToComponent,
  builtinMotionRecipes,
  createMotionRecipeCache,
  extractMotionRecipeFromComponent,
  findCachedMotionRecipe,
  motionRecipeRequestFromSemanticIntent,
  parseSemanticIntentV2Fallback,
  resolveMotionRecipe,
  validateMotionRecipe,
  validateRecipeApplication
} from "../src";

describe("motion recipe", () => {
  const frontBackReference = {
    id: "jd-front-back-entry-transition",
    name: "前后进场代码动效",
    category: "interaction" as const,
    tags: ["page-transition"],
    useCases: ["mobile-ui"],
    moods: ["clean"],
    manifest: {
      version: "1.0" as const,
      id: "front-back",
      name: "前后进场代码动效",
      sourceKind: "builtin-component" as const,
      runtime: { engine: "html" as const, entry: "source/index.html", sandbox: "iframe" as const },
      params: [],
      layers: []
    },
    source: {
      id: "front-back",
      origin: "builtin" as const,
      kind: "builtin-component" as const,
      entry: "source/index.html",
      files: [
        {
          path: "source/index.html",
          kind: "html" as const,
          content:
            '<main data-motion-root><div data-motion="frontPage"></div><div data-motion="backPage"></div><div data-motion="transitionWash"></div></main>'
        },
        {
          path: "source/style.css",
          kind: "css" as const,
          content:
            ".is-playing [data-motion=frontPage] { animation: mine-exit 2s linear infinite; } .is-playing [data-motion=backPage] { animation: orders-enter 2s linear infinite; } @keyframes mine-exit { to { opacity: 0; } } @keyframes orders-enter { to { opacity: 1; } } @keyframes transition-wash { 50% { opacity: 1; } }"
        },
        { path: "source/script.js", kind: "js" as const, content: "window.motionReplay = function motionReplay() {};" }
      ]
    }
  };

  it("keeps every builtin recipe valid and replaceable", () => {
    for (const recipe of builtinMotionRecipes) {
      const result = validateMotionRecipe(recipe);

      expect(result.valid, recipe.id).toBe(true);
      expect(recipe.targets.length, recipe.id).toBeGreaterThan(0);
      expect(recipe.targets.every((target) => target.replaceable), recipe.id).toBe(true);
      expect(recipe.bindings.replay, recipe.id).toBe(true);
    }
  });

  it("maps semantic intent to a recipe request", () => {
    const scale = motionRecipeRequestFromSemanticIntent(
      parseSemanticIntentV2Fallback("做一个移动端页面，需要前景图层以缩放效果入场")
    );
    const bounce = motionRecipeRequestFromSemanticIntent(
      parseSemanticIntentV2Fallback("我要生成一个紫色按钮，点击后按钮会有弹动效果")
    );
    const transition = motionRecipeRequestFromSemanticIntent(
      parseSemanticIntentV2Fallback("不要按钮，我要一个页面前后切换的进场动效")
    );
    const float = motionRecipeRequestFromSemanticIntent(parseSemanticIntentV2Fallback("做一个背景层缓慢漂浮的页面"));
    const pulse = motionRecipeRequestFromSemanticIntent(parseSemanticIntentV2Fallback("做一个循环脉冲标签"));

    expect(scale).toMatchObject({ recipeId: "scale-entrance", trigger: "load" });
    expect(scale.targetRoles).toEqual(expect.arrayContaining(["foreground", "screen"]));
    expect(bounce).toMatchObject({ recipeId: "bounce-feedback", trigger: "click" });
    expect(transition).toMatchObject({ recipeId: "page-front-back-transition", trigger: "loop" });
    expect(float).toMatchObject({ recipeId: "float-loop", trigger: "loop" });
    expect(float.targetRoles).toEqual(expect.arrayContaining(["background", "screen"]));
    expect(pulse).toMatchObject({ recipeId: "pulse-loop", trigger: "loop" });
  });

  it("applies recipe params, layers, and a manifest binding", () => {
    const request = motionRecipeRequestFromSemanticIntent(
      parseSemanticIntentV2Fallback("做一个移动端页面，需要前景图层以缩放效果入场")
    );
    const recipe = resolveMotionRecipe(request);
    const applied = applyMotionRecipe({
      recipe,
      request,
      params: [],
      layers: [],
      source: "fallback",
      confidence: 0.7
    });

    expect(applied.binding).toMatchObject({
      recipeId: "scale-entrance",
      trigger: "load",
      source: "fallback",
      confidence: 0.7
    });
    expect(applied.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["motionDuration", "motionEasing", "foregroundScaleStart"])
    );
    expect(applied.layers.length).toBeGreaterThan(0);
    expect(applied.layers.every((layer) => layer.replaceable)).toBe(true);
  });

  it("validates recipe application against manifest and replay source", () => {
    const request = motionRecipeRequestFromSemanticIntent(
      parseSemanticIntentV2Fallback("做一个移动端页面，需要前景图层以缩放效果入场")
    );
    const recipe = resolveMotionRecipe(request);
    const applied = applyMotionRecipe({
      recipe,
      request,
      params: [],
      layers: [],
      sourceFiles: [
        {
          path: "source/index.html",
          kind: "html",
          content: '<main data-motion-root><div data-motion="foregroundLayer"></div></main>'
        },
        { path: "source/style.css", kind: "css", content: "" },
        { path: "source/script.js", kind: "js", content: "" }
      ]
    });
    const sourceText = applied.files?.map((file) => file.content).join("\n") ?? "";

    const result = validateRecipeApplication({
      binding: applied.binding,
      params: applied.params,
      layers: applied.layers,
      sourceText
    });

    expect(result.valid).toBe(true);
  });

  it("applies a recipe to HTML/CSS/JS source files", () => {
    const request = motionRecipeRequestFromSemanticIntent(parseSemanticIntentV2Fallback("做一个背景层缓慢漂浮的页面"));
    const recipe = resolveMotionRecipe(request);
    const applied = applyMotionRecipe({
      recipe,
      request,
      params: [],
      layers: [],
      sourceFiles: [
        { path: "source/index.html", kind: "html", content: "<main data-motion-root></main>" },
        { path: "source/style.css", kind: "css", content: "" },
        { path: "source/script.js", kind: "js", content: "" }
      ]
    });
    const sourceText = applied.files?.map((file) => file.content).join("\n") ?? "";

    expect(sourceText).toContain('data-motion="backgroundLayer"');
    expect(sourceText).toContain("--float-duration");
    expect(sourceText).toContain("@keyframes generated-loop-float");
    expect(sourceText).toContain("animation: generated-loop-float");
    expect(sourceText).toContain("window.motionReplay");
    expect(
      validateRecipeApplication({
        binding: applied.binding,
        params: applied.params,
        layers: applied.layers,
        sourceText
      }).valid
    ).toBe(true);
  });

  it("extracts the front-back transition recipe from a reference component", () => {
    const extracted = extractMotionRecipeFromComponent(frontBackReference);

    expect(extracted?.recipe).toMatchObject({
      id: "page-front-back-transition",
      source: "extracted"
    });
    expect(extracted?.confidence).toBeGreaterThan(0.9);
  });

  it("extracts recipe params and class selectors from reference source evidence", () => {
    const reference = {
      id: "class-front-back-transition",
      name: "前后进场代码动效",
      category: "interaction" as const,
      tags: ["page-transition"],
      useCases: ["mobile-ui"],
      moods: ["clean"],
      manifest: {
        version: "1.0" as const,
        id: "class-front-back",
        name: "前后进场代码动效",
        sourceKind: "builtin-component" as const,
        runtime: { engine: "html" as const, entry: "source/index.html", sandbox: "iframe" as const },
        params: [
          {
            id: "cycleDuration",
            label: "循环时长",
            type: "duration" as const,
            default: 3120,
            status: "confirmed" as const,
            targets: [{ kind: "css-variable" as const, file: "source/style.css", selector: ":root", name: "--cycle-duration" }]
          }
        ],
        layers: [
          {
            id: "frontPage",
            label: "前页",
            kind: "structure" as const,
            replaceable: true,
            targets: [{ kind: "html-attribute" as const, file: "source/index.html", selector: ".mine-content", attribute: "class" }]
          },
          {
            id: "backPage",
            label: "后页",
            kind: "structure" as const,
            replaceable: true,
            targets: [{ kind: "html-attribute" as const, file: "source/index.html", selector: ".orders-content", attribute: "class" }]
          }
        ]
      },
      source: {
        id: "class-front-back",
        origin: "builtin" as const,
        kind: "builtin-component" as const,
        entry: "source/index.html",
        files: [
          {
            path: "source/index.html",
            kind: "html" as const,
            content:
              '<main data-motion-root><div class="screen-layer mine-content"></div><div class="screen-layer orders-content"></div><div class="screen-wash"></div></main>'
          },
          {
            path: "source/style.css",
            kind: "css" as const,
            content:
              ":root { --cycle-duration: 3s; --enter-distance: 430px; --exit-distance: -430px; --transition-opacity: 0.42; --window-radius: 64px; --motion-easing: ease-in-out; } .is-playing .mine-content { animation: mine-exit var(--cycle-duration) var(--motion-easing) infinite; } .is-playing .orders-content { animation: orders-enter var(--cycle-duration) var(--motion-easing) infinite; } .is-playing .screen-wash { animation: transition-wash var(--cycle-duration) linear infinite; } @keyframes mine-exit { to { opacity: 0; } } @keyframes orders-enter { to { opacity: 1; } } @keyframes transition-wash { 50% { opacity: var(--transition-opacity); } }"
          },
          { path: "source/script.js", kind: "js" as const, content: "window.motionReplay = function motionReplay() {};" }
        ]
      }
    };

    const extracted = extractMotionRecipeFromComponent(reference);
    const params = new Map(extracted?.recipe.params.map((param) => [param.id, param.default]));

    expect(extracted?.recipe.id).toBe("page-front-back-transition");
    expect(extracted?.recipe.bindings.selectors).toEqual(expect.arrayContaining([".mine-content", ".orders-content"]));
    expect(params.get("cycleDuration")).toBe(3120);
    expect(params.get("enterDistance")).toBe(430);
    expect(params.get("transitionOpacity")).toBe(0.42);

    const applied = applyMotionRecipe({
      recipe: extracted!.recipe,
      params: [],
      layers: [],
      sourceFiles: reference.source.files
    });
    const sourceText = applied.files?.map((file) => file.content).join("\n") ?? "";

    expect(sourceText).toContain(".is-playing .mine-content");
    expect(
      validateRecipeApplication({
        binding: applied.binding,
        params: applied.params,
        layers: applied.layers,
        sourceText
      }).valid
    ).toBe(true);
  });

  it("builds and finds a natural-language recipe cache from reference components", () => {
    const cache = createMotionRecipeCache([frontBackReference]);
    const matched = findCachedMotionRecipe({
      cache,
      raw: "基于前后进场代码动效，应用到商品卡片",
      recipeId: "page-front-back-transition"
    });

    expect(cache).toHaveLength(1);
    expect(matched).toMatchObject({
      componentId: "jd-front-back-entry-transition",
      recipe: { id: "page-front-back-transition", source: "extracted" }
    });
  });

  it("applies an extracted recipe from one component to another target layer", () => {
    const source = {
      id: "source-float",
      name: "背景漂浮",
      category: "background" as const,
      tags: ["float"],
      useCases: ["background"],
      moods: ["clean"],
      manifest: {
        version: "1.0" as const,
        id: "source-float-manifest",
        name: "背景漂浮",
        sourceKind: "builtin-component" as const,
        runtime: { engine: "html" as const, entry: "source/index.html", sandbox: "iframe" as const },
        params: [],
        layers: []
      },
      source: {
        id: "source-float",
        origin: "builtin" as const,
        kind: "builtin-component" as const,
        entry: "source/index.html",
        files: [
          { path: "source/index.html", kind: "html" as const, content: '<main data-motion-root><div data-motion="backgroundLayer"></div></main>' },
          {
            path: "source/style.css",
            kind: "css" as const,
            content:
              ":root { --float-duration: 3200ms; } .is-playing [data-motion=backgroundLayer] { animation: generated-loop-float var(--float-duration) ease-in-out infinite; } @keyframes generated-loop-float { 50% { transform: translateY(-20px); } }"
          },
          { path: "source/script.js", kind: "js" as const, content: "window.motionReplay = function motionReplay() {};" }
        ]
      }
    };
    const target = {
      id: "target-card",
      name: "目标卡片",
      category: "layout" as const,
      tags: ["card"],
      useCases: ["card"],
      moods: ["clean"],
      manifest: {
        version: "1.0" as const,
        id: "target-card-manifest",
        name: "目标卡片",
        sourceKind: "builtin-component" as const,
        runtime: { engine: "html" as const, entry: "source/index.html", sandbox: "iframe" as const },
        params: [],
        layers: [
          {
            id: "cardRoot",
            label: "卡片",
            kind: "structure" as const,
            replaceable: true,
            targets: [{ kind: "html-attribute" as const, file: "source/index.html", selector: "[data-motion=cardRoot]", attribute: "class" }]
          }
        ]
      },
      source: {
        id: "target-card",
        origin: "builtin" as const,
        kind: "builtin-component" as const,
        entry: "source/index.html",
        files: [
          { path: "source/index.html", kind: "html" as const, content: '<main data-motion-root><article data-motion="cardRoot"></article></main>' },
          { path: "source/style.css", kind: "css" as const, content: "" },
          { path: "source/script.js", kind: "js" as const, content: "" }
        ]
      }
    };

    const applied = applyMotionRecipeToComponent({
      sourceComponent: source,
      targetComponent: target,
      targetLayerId: "cardRoot",
      id: "float-card"
    });
    const sourceText = applied.source.files.map((file) => file.content).join("\n");

    expect(applied.id).toBe("float-card");
    expect(applied.source.origin).toBe("generated");
    expect(applied.manifest.motionRecipes?.[0]).toMatchObject({
      recipeId: "float-loop",
      source: "extracted",
      targetLayerIds: ["cardRoot"],
      targetSelectors: ["[data-motion=cardRoot]"]
    });
    expect(sourceText).toContain("animation: generated-loop-float");
    expect(sourceText).toContain("[data-motion=cardRoot]");
    expect(
      validateRecipeApplication({
        binding: applied.manifest.motionRecipes![0]!,
        params: applied.manifest.params,
        layers: applied.manifest.layers ?? [],
        sourceText
      }).valid
    ).toBe(true);
  });
});
