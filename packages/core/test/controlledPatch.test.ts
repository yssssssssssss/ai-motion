import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import {
  buildControlledGenerationRequest,
  compileSemanticPatch,
  createGeneratedComponentFromPatch
} from "../src/generation/controlledPatch";

const baseComponent: MotionComponent = {
  id: "product-transition",
  name: "商品详情转场",
  category: "media",
  tags: ["ecommerce", "product", "transition"],
  useCases: ["product-detail"],
  moods: ["clean"],
  manifest: {
    version: "1.0",
    id: "product-transition-manifest",
    name: "商品详情转场",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["builtin", "editable", "export-html"],
    designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.96, required: true }],
    layers: [
      {
        id: "productImage",
        label: "商品图",
        kind: "image",
        replaceable: true,
        paramId: "productImage",
        targets: [
          { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--product-image" }
        ]
      }
    ],
    params: [
      {
        id: "transitionDuration",
        label: "转场速度",
        type: "duration",
        default: 620,
        constraints: { min: 220, max: 1400, step: 20, unit: "ms" },
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }
        ]
      },
      {
        id: "slideDistance",
        label: "滑动距离",
        type: "range",
        default: 320,
        constraints: { min: 120, max: 720, step: 10, unit: "px" },
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--slide-distance" }
        ]
      }
    ]
  },
  source: {
    id: "product-transition",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content:
          '<main data-motion-root><section class="product"></section><script>window.motionReplay=function(){}</script></main>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content:
          ":root { --motion-duration: 620ms; --slide-distance: 320px; } .product { animation: move var(--motion-duration) infinite; }"
      },
      {
        path: "source/assets.css",
        kind: "css",
        content: ':root { --product-image: url("data:image/png;base64,A"); }'
      }
    ]
  }
};

const textRevealComponent: MotionComponent = {
  id: "hero-text-reveal",
  name: "文字入场动效",
  category: "text",
  tags: ["text", "headline", "entry"],
  useCases: ["landing-page", "saas-home"],
  moods: ["clean"],
  manifest: {
    version: "1.0",
    id: "hero-text-reveal-manifest",
    name: "文字入场动效",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["builtin", "editable", "export-html"],
    designSpecs: [{ id: "text-reveal-motion-skill", confidence: 0.96, required: true }],
    layers: [
      {
        id: "headline",
        label: "标题",
        kind: "text",
        replaceable: true,
        paramId: "headline",
        targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
      }
    ],
    params: [
      {
        id: "headline",
        label: "标题文案",
        type: "text",
        default: "快速生成动效",
        status: "confirmed",
        targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
      },
      {
        id: "duration",
        label: "入场时长",
        type: "duration",
        default: 800,
        constraints: { min: 200, max: 2000, step: 50, unit: "ms" },
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--reveal-duration" }
        ]
      }
    ]
  },
  source: {
    id: "hero-text-reveal",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content:
          '<main data-motion-root><h1 data-motion="headline">快速生成动效</h1><script>window.motionReplay=function(){}</script></main>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content: ":root { --reveal-duration: 800ms; } h1 { animation: reveal var(--reveal-duration) both; }"
      }
    ]
  }
};

describe("controlled semantic generation", () => {
  it("builds a request with top candidates, readable skills, and whitelist context", () => {
    const request = buildControlledGenerationRequest({
      brief: "商品详情转场更快一点，滑动距离短一点",
      components: [baseComponent]
    });

    expect(request.plan.candidates).toHaveLength(1);
    expect(request.candidates[0]?.componentId).toBe("product-transition");
    expect(request.candidates[0]?.skills[0]?.id).toBe("ecommerce-transition-motion-skill");
    expect(request.candidates[0]?.allowed.paramIds).toEqual(["transitionDuration", "slideDistance"]);
    expect(request.outputContract.allowedKeys).toEqual(["baseComponentId", "paramValues", "metadata"]);
  });

  it("compiles a natural-language brief into a whitelisted patch and generated component", () => {
    const request = buildControlledGenerationRequest({
      brief: "商品详情转场更快一点，滑动距离短一点",
      components: [baseComponent]
    });
    const patch = compileSemanticPatch(request);
    const generated = createGeneratedComponentFromPatch({
      brief: request.brief,
      baseComponent,
      candidate: request.plan.candidates[0]!,
      patch
    });

    expect(patch.baseComponentId).toBe("product-transition");
    expect(patch.paramValues).toEqual({ transitionDuration: 540, slideDistance: 260 });
    expect(generated.validation.valid).toBe(true);
    expect(generated.component.id).toMatch(/^generated-product-transition-/);
    expect(generated.component.source.origin).toBe("generated");
    expect(generated.component.source.files.find((file) => file.path === "source/style.css")?.content).toContain(
      "--motion-duration: 540ms"
    );
    expect(generated.component.source.files.find((file) => file.path === "source/style.css")?.content).toContain(
      "--slide-distance: 260px"
    );
  });

  it("does not treat a generic generation brief as a no-op clone", () => {
    const request = buildControlledGenerationRequest({
      brief: "我想要一个适合软件服务首页的文字入场动效",
      components: [textRevealComponent]
    });
    const patch = compileSemanticPatch(request);

    expect(patch.baseComponentId).toBe("hero-text-reveal");
    expect(patch.paramValues).toEqual({ duration: 700 });
  });

  it("uses explicit title copy from the brief when a text parameter is available", () => {
    const request = buildControlledGenerationRequest({
      brief: "生成一个文字入场动效，标题文案是「效率提升 40%」",
      components: [textRevealComponent]
    });
    const patch = compileSemanticPatch(request);
    const generated = createGeneratedComponentFromPatch({
      brief: request.brief,
      baseComponent: textRevealComponent,
      candidate: request.plan.candidates[0]!,
      patch
    });

    expect(patch.paramValues).toMatchObject({
      headline: "效率提升 40%"
    });
    expect(generated.component.source.files.find((file) => file.path === "source/index.html")?.content).toContain(
      "效率提升 40%"
    );
  });
});
