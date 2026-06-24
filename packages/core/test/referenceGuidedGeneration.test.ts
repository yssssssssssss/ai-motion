import { describe, expect, it } from "vitest";
import {
  createReferenceGuidedComponent,
  parseSemanticGenerationIntent,
  parseSemanticIntentV2Fallback,
  semanticIntentV2ToLegacyIntent
} from "../src";
import type { MotionComponent } from "../src";

const referenceButton: MotionComponent = {
  id: "reference-button",
  name: "参考按钮",
  category: "interaction",
  tags: ["button", "hover"],
  useCases: ["button-motion"],
  moods: ["clean"],
  manifest: {
    version: "1.0",
    id: "reference-button-manifest",
    name: "参考按钮",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["builtin", "editable", "export-html"],
    params: [],
    layers: []
  },
  source: {
    id: "reference-button",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      { path: "source/index.html", kind: "html", content: "<main data-motion-root><button>参考</button></main>" },
      { path: "source/style.css", kind: "css", content: "button { transition: transform 300ms; }" }
    ]
  }
};

const referencePageTransition: MotionComponent = {
  id: "jd-front-back-entry-transition",
  name: "前后进场代码动效",
  category: "interaction",
  tags: ["jd", "mobile", "page-transition"],
  useCases: ["mobile-ui", "page-transition", "app-prototype"],
  moods: ["clean"],
  manifest: {
    version: "1.0",
    id: "jd-front-back-entry-transition",
    name: "前后进场代码动效",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["builtin", "editable", "export-html"],
    designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.9, required: true }],
    params: [
      {
        id: "cycleDuration",
        label: "循环时长",
        type: "duration",
        default: 2640,
        constraints: { min: 1400, max: 5000, step: 40, unit: "ms" },
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--cycle-duration" }]
      },
      {
        id: "enterDistance",
        label: "进入距离",
        type: "range",
        default: 520,
        constraints: { min: 0, max: 1118, step: 1, unit: "px" },
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--enter-distance" }]
      },
      {
        id: "exitDistance",
        label: "退出距离",
        type: "range",
        default: -520,
        constraints: { min: -1118, max: 0, step: 1, unit: "px" },
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--exit-distance" }]
      },
      {
        id: "transitionOpacity",
        label: "过渡泛白",
        type: "range",
        default: 0.72,
        constraints: { min: 0, max: 0.9, step: 0.01 },
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--transition-opacity" }]
      },
      {
        id: "windowRadius",
        label: "屏幕圆角",
        type: "range",
        default: 92,
        constraints: { min: 0, max: 160, step: 1, unit: "px" },
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--window-radius" }]
      },
      {
        id: "easing",
        label: "缓动曲线",
        type: "easing",
        default: "cubic-bezier(0.18, 0.86, 0.22, 1)",
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
      }
    ],
    groups: [
      { id: "timing", label: "速度", params: ["cycleDuration", "easing"] },
      { id: "trajectory", label: "轨迹", params: ["enterDistance", "exitDistance"] },
      { id: "visual", label: "视觉", params: ["transitionOpacity", "windowRadius"] }
    ],
    layers: [
      {
        id: "frontPage",
        label: "前页",
        kind: "structure",
        replaceable: false,
        targets: []
      },
      {
        id: "backPage",
        label: "后页",
        kind: "structure",
        replaceable: false,
        targets: []
      }
    ]
  },
  source: {
    id: "jd-front-back-entry-transition",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content:
          '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><main class="jd-front-back-entry" data-motion-root><div class="screen-window"><div class="screen-layer mine-content"></div><div class="screen-layer orders-content"></div><div class="screen-wash"></div></div></main><script src="./script.js"></script></body></html>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content:
          ":root { --cycle-duration: 2640ms; --enter-distance: 520px; --exit-distance: -520px; --transition-opacity: 0.72; --window-radius: 92px; --motion-easing: cubic-bezier(0.18, 0.86, 0.22, 1); } .orders-content { transform: translate3d(var(--enter-distance), 0, 0); } .is-playing .mine-content { animation: mine-exit var(--cycle-duration) var(--motion-easing) infinite; } .is-playing .orders-content { animation: orders-enter var(--cycle-duration) var(--motion-easing) infinite; } .is-playing .screen-wash { animation: transition-wash var(--cycle-duration) linear infinite; } @keyframes mine-exit { to { opacity: 0; transform: translate3d(var(--exit-distance), 0, 0); } } @keyframes orders-enter { to { opacity: 1; transform: translate3d(0, 0, 0); } } @keyframes transition-wash { 46% { opacity: var(--transition-opacity); } }"
      },
      {
        path: "source/script.js",
        kind: "js",
        content:
          "const root = document.querySelector('[data-motion-root]'); window.motionReplay = function motionReplay() { root?.classList.add('is-playing'); }; window.motionPause = function motionPause() {}; window.motionSeek = function motionSeek() {};"
      }
    ]
  }
};

function sourceByPath(component: MotionComponent, path: string): string {
  return component.source.files.find((file) => file.path === path)?.content ?? "";
}

describe("reference-guided generation", () => {
  it("parses the example brief into role, color, effect, and direction intent", () => {
    const intent = parseSemanticGenerationIntent("创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧");

    expect(intent.role).toBe("button");
    expect(intent.colors).toEqual([{ target: "background", label: "红色", value: "#ef4444" }]);
    expect(intent.effects).toEqual(expect.arrayContaining(["bounce", "elastic", "slide"]));
    expect(intent.direction).toBe("left-to-right");
    expect(intent.trigger).toBe("load");
  });

  it("generates a fresh red bouncing button that travels from left to right", () => {
    const result = createReferenceGuidedComponent({
      brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
      references: [referenceButton],
      now: 1
    });
    const html = result.component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
    const css = result.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
    const script = result.component.source.files.find((file) => file.path === "source/script.js")?.content ?? "";

    expect(result.component.id).toBe("generated-reference-button-1");
    expect(result.component.source.origin).toBe("generated");
    expect(result.coverage.missing).toEqual([]);
    expect(result.validation.valid).toBe(true);
    expect(html).toContain("<button");
    expect(html).toContain('data-motion="buttonLabel"');
    expect(css).toContain("--button-bg: #ef4444");
    expect(css).toContain("@keyframes generated-left-to-right-slide-bounce");
    expect(css).toContain("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(script).toContain("window.motionReplay");
    expect(result.component.manifest.motionRecipes?.[0]).toMatchObject({
      recipeId: "bounce-feedback",
      trigger: "load"
    });
    expect(result.component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining([
        "buttonBackgroundColor",
        "motionDuration",
        "motionEasing",
        "travelDistance",
        "bounceIntensity",
        "buttonLabel"
      ])
    );
  });

  it("escapes user-provided text before writing generated source", () => {
    const result = createReferenceGuidedComponent({
      brief: "创建红色按钮，按钮文案是「<script>alert(1)</script>」",
      now: 2
    });
    const html = result.component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(result.validation.valid).toBe(true);
  });

  it("uses a valid generated source draft when it satisfies the semantic gates", () => {
    const result = createReferenceGuidedComponent({
      brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
      now: 3,
      sourceDraft: {
        html: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main data-motion-root class="ai-stage">
      <button data-motion="buttonLabel" class="ai-red-button">立即行动</button>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`,
        css: `.ai-red-button {
  background: #ef4444;
  color: #fff;
  animation: ai-left-to-right-slide-bounce 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes ai-left-to-right-slide-bounce {
  from { transform: translateX(-42vw) scale(.96); }
  58% { transform: translateX(0) scale(1.14); }
  to { transform: translateX(42vw) scale(1); }
}`,
        js: `window.motionReplay = function motionReplay() {
  document.querySelector("[data-motion-root]")?.classList.toggle("is-playing");
};
window.motionPause = function motionPause() {};
window.motionSeek = function motionSeek() {};`
      }
    });
    const css = result.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";

    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(css).toContain("ai-left-to-right-slide-bounce");
  });

  it("falls back to deterministic source when a generated draft is unsafe", () => {
    const result = createReferenceGuidedComponent({
      brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
      now: 4,
      sourceDraft: {
        html: `<main data-motion-root><button data-motion="buttonLabel">立即行动</button></main>`,
        css: `.ai-red-button { background: #ef4444; animation: ai-left-to-right-slide-bounce 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }`,
        js: `fetch("https://example.com"); window.motionReplay = function motionReplay() {};`
      }
    });
    const source = result.component.source.files.map((file) => file.content).join("\n");

    expect(result.validation.valid).toBe(true);
    expect(source).not.toContain("https://example.com");
    expect(source).toContain("@keyframes generated-left-to-right-slide-bounce");
  });

  it("generates click-triggered bounce instead of autoplay for click intent", () => {
    const result = createReferenceGuidedComponent({
      brief: "我要生成一个紫色的原型按钮，点击后按钮会有弹动效果",
      now: 5
    });
    const html = result.component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
    const css = result.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
    const script = result.component.source.files.find((file) => file.path === "source/script.js")?.content ?? "";

    expect(result.intent.trigger).toBe("click");
    expect(result.intent.effects).toEqual(expect.arrayContaining(["bounce", "elastic"]));
    expect(result.validation.valid).toBe(true);
    expect(html).not.toContain("semantic-stage is-playing");
    expect(css).toContain("--button-bg: #7c3aed");
    expect(script).toContain('button.addEventListener("click"');
    expect(script).not.toContain("requestAnimationFrame(replay)");
  });

  it("changes generated motion source when the requested effect changes", () => {
    const bounce = createReferenceGuidedComponent({
      brief: "我要生成一个紫色按钮，点击后按钮会有弹动效果",
      now: 6
    });
    const rotate = createReferenceGuidedComponent({
      brief: "我要生成一个紫色按钮，点击后按钮会旋转",
      now: 7
    });
    const bounceCss = bounce.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
    const rotateCss = rotate.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";

    expect(bounce.validation.valid).toBe(true);
    expect(rotate.validation.valid).toBe(true);
    expect(bounceCss).toContain("generated-click-bounce");
    expect(rotateCss).toContain("generated-click-rotate");
    expect(rotateCss).toContain("rotate(360deg)");
    expect(rotateCss).not.toEqual(bounceCss);
  });

  it("parses extended component roles for text, badge, and loader generation", () => {
    expect(parseSemanticGenerationIntent("生成一个紫色标题，慢速淡入")).toMatchObject({
      role: "text",
      trigger: "load",
      speed: "slow"
    });
    expect(parseSemanticGenerationIntent("生成一个红色标签，循环脉冲")).toMatchObject({
      role: "badge",
      trigger: "loop",
      effects: expect.arrayContaining(["pulse"])
    });
    expect(parseSemanticGenerationIntent("生成一个蓝色加载动画，三个点循环跳动")).toMatchObject({
      role: "loader",
      trigger: "loop"
    });
  });

  it("parses negated component roles and page-transition intent from natural language", () => {
    const intent = parseSemanticGenerationIntent(
      "不要按钮，我要一个页面前后切换的进场动效，前页向左退出，后页从右边进来"
    );

    expect(intent.role).toBe("page-transition");
    expect(intent.negativePreferences.join(" ")).toContain("按钮");
    expect(intent.effects).toEqual(expect.arrayContaining(["slide"]));
    expect(intent.direction).toBe("right-to-left");
  });

  it("generates a page-transition variant from the front-back entry reference", () => {
    const result = createReferenceGuidedComponent({
      brief: "基于前后进场代码动效，做一个更快一点的版本，进入距离短一点，泛白弱一点，圆角小一点，不要生成按钮",
      references: [referencePageTransition],
      now: 12
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("page-transition");
    expect(result.component.id).toBe("generated-reference-page-transition-12");
    expect(result.component.tags).toContain("ref:jd-front-back-entry-transition");
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(html).not.toContain("<button");
    expect(css).toContain("--cycle-duration: 1840ms");
    expect(css).toContain("--enter-distance: 360px");
    expect(css).toContain("--exit-distance: -360px");
    expect(css).toContain("--transition-opacity: 0.35");
    expect(css).toContain("--window-radius: 48px");
  });

  it("applies the front-back transition recipe to product card switching", () => {
    const result = createReferenceGuidedComponent({
      brief: "把前后进场代码动效应用到商品卡片切换上",
      references: [referencePageTransition],
      now: 13
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("page-transition");
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(html).toContain("semantic-product-transition");
    expect(html).toContain("product-card-front");
    expect(html).toContain('data-motion="frontPage"');
    expect(html).toContain('data-motion="backPage"');
    expect(html).not.toContain("<button");
    expect(css).toContain("@keyframes mine-exit");
    expect(css).toContain("animation: mine-exit");
    expect(result.component.manifest.motionRecipes?.[0]).toMatchObject({
      recipeId: "page-front-back-transition",
      source: "extracted",
      trigger: "loop"
    });
    expect(result.component.manifest.layers?.every((layer) => layer.replaceable)).toBe(true);
  });

  it("keeps natural-language page-transition acceptance samples away from button fallback", () => {
    const samples = [
      "基于前后进场代码动效，做一个更快一点的版本",
      "像前后进场那个动效，但泛白弱一点，圆角小一点",
      "不要按钮，我要一个页面前后切换的进场动效",
      "做一个移动端页面切换，前页向左退出，后页从右边进来",
      "参考 jd-front-back-entry-transition，生成一个节奏更紧凑的页面转场"
    ];

    for (const [index, brief] of samples.entries()) {
      const result = createReferenceGuidedComponent({
        brief,
        references: [referencePageTransition],
        now: 20 + index
      });
      const source = result.component.source.files.map((file) => file.content).join("\n");

      expect(result.intent.role, brief).toBe("page-transition");
      expect(result.component.id, brief).toContain("generated-reference-page-transition");
      expect(result.component.tags, brief).toContain("ref:jd-front-back-entry-transition");
      expect(result.validation.valid, brief).toBe(true);
      expect(result.coverage.missing, brief).toEqual([]);
      expect(source, brief).toContain("mine-exit");
      expect(source, brief).toContain("orders-enter");
      expect(source, brief).not.toContain("<button");
    }
  });

  it("generates a mobile page foreground layer entrance instead of falling back to a button", () => {
    const result = createReferenceGuidedComponent({
      brief: "做一个移动端页面，需要前景图层以缩放效果入场",
      now: 25
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("mobile-page");
    expect(result.intent.effects).toEqual(expect.arrayContaining(["scale"]));
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(result.component.id).toBe("generated-reference-mobile-page-25");
    expect(result.component.category).toBe("layout");
    expect(html).toContain("semantic-mobile-page");
    expect(html).toContain("foreground-layer");
    expect(html).not.toContain("<button");
    expect(css).toContain("@keyframes generated-load-foreground-scale");
    expect(result.component.manifest.motionRecipes?.[0]).toMatchObject({
      recipeId: "scale-entrance",
      trigger: "load"
    });
  });

  it("generates a mobile page with a floating replaceable background layer", () => {
    const result = createReferenceGuidedComponent({
      brief: "做一个背景层缓慢漂浮的页面",
      now: 28
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("mobile-page");
    expect(result.intent.effects).toEqual(expect.arrayContaining(["float"]));
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(html).toContain('data-motion="backgroundLayer"');
    expect(html).not.toContain("<button");
    expect(css).toContain("--stage-width: 375px");
    expect(css).toContain("--stage-height: 812px");
    expect(css).toContain("--background-layer-width: 375px");
    expect(css).toContain("--background-layer-height: 812px");
    expect(css).toContain("width: var(--background-layer-width)");
    expect(css).toContain("height: var(--background-layer-height)");
    expect(css).toContain("left: calc((100% - var(--background-layer-width)) / 2)");
    expect(css).toContain("top: calc((100% - var(--background-layer-height)) / 2)");
    expect(css).not.toContain("translate3d(-50%, -50%, 0)");
    expect(css).toContain("@keyframes generated-loop-float");
    expect(css).toContain("animation: generated-loop-float");
    expect(result.component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["stageWidth", "stageHeight", "backgroundLayerWidth", "backgroundLayerHeight"])
    );
    expect(result.component.manifest.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "backgroundLayerSize",
          params: ["stageWidth", "stageHeight", "backgroundLayerWidth", "backgroundLayerHeight"]
        })
      ])
    );
    expect(result.component.manifest.motionRecipes?.[0]).toMatchObject({
      recipeId: "float-loop",
      trigger: "loop"
    });
    expect(result.component.manifest.layers?.every((layer) => layer.replaceable)).toBe(true);
  });

  it("builds a structured V2 semantic intent with target layers and motion dimensions", () => {
    const intentV2 = parseSemanticIntentV2Fallback("做一个移动端页面，需要前景图层以缩放效果入场");
    const legacy = semanticIntentV2ToLegacyIntent(intentV2);

    expect(intentV2).toMatchObject({
      version: 2,
      target: { kind: "mobile-page" },
      source: "fallback",
      trigger: "load"
    });
    expect(intentV2.confidence).toBeLessThanOrEqual(0.62);
    expect(intentV2.layers.map((layer) => layer.role)).toEqual(expect.arrayContaining(["foreground", "screen"]));
    expect(intentV2.motions).toEqual(expect.arrayContaining([expect.objectContaining({ type: "scale", target: "foreground" })]));
    expect(legacy.role).toBe("mobile-page");
    expect(legacy.effects).toEqual(expect.arrayContaining(["scale"]));
  });

  it("uses supplied V2 intent instead of forcing ambiguous requests through button fallback", () => {
    const result = createReferenceGuidedComponent({
      brief: "做一个界面元素出现时轻微放大",
      now: 26,
      intentV2: {
        version: 2,
        target: { kind: "mobile-page", label: "移动端页面" },
        layers: [{ role: "foreground", label: "前景图层" }],
        motions: [{ type: "scale", target: "foreground", trigger: "load", speed: "normal" }],
        colors: [],
        text: null,
        trigger: "load",
        speed: "normal",
        motionCategory: "entrance",
        targetRoles: ["foreground"],
        composition: "single",
        migrationIntent: false,
        referenceRecipeHints: [],
        negativeConstraints: ["不要按钮"],
        referenceHints: [],
        source: "model",
        confidence: 0.82,
        raw: "做一个界面元素出现时轻微放大"
      }
    });
    const html = sourceByPath(result.component, "source/index.html");

    expect(result.intentV2.source).toBe("model");
    expect(result.intent.role).toBe("mobile-page");
    expect(result.component.id).toBe("generated-reference-mobile-page-26");
    expect(result.coverage.missing).toEqual([]);
    expect(html).toContain("semantic-mobile-page");
    expect(html).not.toContain("<button");
  });

  it("keeps vague non-button generation away from the default blue button fallback", () => {
    const result = createReferenceGuidedComponent({
      brief: "做一个界面元素出现时轻微放大",
      now: 27
    });
    const source = result.component.source.files.map((file) => file.content).join("\n");

    expect(result.component.id).toBe("generated-reference-mobile-page-27");
    expect(result.component.category).toBe("layout");
    expect(result.validation.valid).toBe(true);
    expect(source).toContain("semantic-mobile-page");
    expect(source).not.toContain("<button");
    expect(source).not.toContain("--button-bg: #2563eb");
    expect(result.component.manifest.motionRecipes?.[0]).toMatchObject({
      recipeId: "scale-entrance",
      trigger: "load"
    });
  });

  it("marks every generated role layer as replaceable for migration", () => {
    const cases = [
      { brief: "创建一个红色按钮，带有弹动效果", role: "button" },
      { brief: "生成一个紫色标题，慢速淡入", role: "text" },
      { brief: "生成一个绿色卡片，悬停后发光", role: "card" },
      { brief: "生成一个红色标签，循环脉冲", role: "badge" },
      { brief: "生成一个蓝色加载动画，三个点循环跳动", role: "loader" },
      { brief: "做一个移动端页面，需要前景图层以缩放效果入场", role: "mobile-page" },
      { brief: "不要按钮，我要一个页面前后切换的进场动效", role: "page-transition" }
    ];

    for (const [index, item] of cases.entries()) {
      const result = createReferenceGuidedComponent({
        brief: item.brief,
        references: [referencePageTransition],
        now: 70 + index
      });
      const layers = result.component.manifest.layers ?? [];

      expect(result.intent.role, item.brief).toBe(item.role);
      expect(layers.length, item.brief).toBeGreaterThan(0);
      expect(layers.every((layer) => layer.replaceable), item.brief).toBe(true);
      expect(result.component.manifest.motionRecipes?.length, item.brief).toBeGreaterThan(0);
      expect(result.component.manifest.motionRecipes?.[0]?.targetLayerIds.length, item.brief).toBeGreaterThan(0);
      expect(result.validation.valid, item.brief).toBe(true);
    }
  });

  it("generates a text heading with fade motion and text-specific manifest fields", () => {
    const result = createReferenceGuidedComponent({
      brief: "生成一个紫色标题，标题文案是「欢迎回来」，慢速淡入",
      now: 8
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("text");
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(result.component.category).toBe("text");
    expect(html).toContain("<h1");
    expect(html).toContain("欢迎回来");
    expect(html).not.toContain("<button");
    expect(css).toContain("--text-color: #7c3aed");
    expect(css).toContain("@keyframes generated-load-fade");
    expect(result.component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["textContent", "textColor", "fontSize", "motionDuration", "motionEasing"])
    );
  });

  it("generates a card with title, description, hover glow, and card-specific params", () => {
    const result = createReferenceGuidedComponent({
      brief: "生成一个绿色卡片，标题文案是「增长概览」，内容是本周关键数据，悬停后发光",
      now: 9
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("card");
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(result.component.category).toBe("layout");
    expect(html).toContain('class="semantic-card"');
    expect(html).toContain("增长概览");
    expect(html).toContain("本周关键数据");
    expect(css).toContain("--card-bg: #16a34a");
    expect(css).toContain(".semantic-card:hover");
    expect(css).toContain("@keyframes generated-hover-glow");
    expect(result.component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["cardTitle", "cardDescription", "cardBackgroundColor", "cardRadius", "cardShadow"])
    );
  });

  it("generates a looping pulse badge with badge-specific source and params", () => {
    const result = createReferenceGuidedComponent({
      brief: "生成一个红色标签，文案是「NEW」，循环脉冲",
      now: 10
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("badge");
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(result.component.category).toBe("interaction");
    expect(html).toContain('class="semantic-badge"');
    expect(html).toContain("NEW");
    expect(css).toContain("--badge-bg: #ef4444");
    expect(css).toContain("@keyframes generated-loop-pulse");
    expect(css).toContain("infinite");
    expect(result.component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["badgeText", "badgeBackgroundColor", "badgeTextColor"])
    );
  });

  it("generates a looping dots loader with loader-specific source and params", () => {
    const result = createReferenceGuidedComponent({
      brief: "生成一个蓝色加载动画，三个点循环跳动",
      now: 11
    });
    const html = sourceByPath(result.component, "source/index.html");
    const css = sourceByPath(result.component, "source/style.css");

    expect(result.intent.role).toBe("loader");
    expect(result.validation.valid).toBe(true);
    expect(result.coverage.missing).toEqual([]);
    expect(result.component.category).toBe("data");
    expect(html).toContain('class="semantic-loader semantic-loader-dots"');
    expect(html.match(/class="semantic-loader-dot"/g)).toHaveLength(3);
    expect(css).toContain("--loader-color: #2563eb");
    expect(css).toContain("@keyframes generated-loop-dots");
    expect(css).toContain("infinite");
    expect(result.component.manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["loaderColor", "loaderSize", "motionDuration"])
    );
  });
});
