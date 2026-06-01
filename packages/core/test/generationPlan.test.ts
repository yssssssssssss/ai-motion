import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import { createGenerationPlan } from "../src/orchestrator/generationPlan";

function component(input: Partial<MotionComponent> & Pick<MotionComponent, "id" | "name">): MotionComponent {
  const id = input.id;
  const base: MotionComponent = {
    id,
    name: input.name,
    category: "layout",
    tags: [],
    useCases: [],
    moods: [],
    manifest: {
      version: "1.0",
      id,
      name: input.name,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      capabilities: ["builtin", "editable", "export-html"],
      params: []
    },
    source: {
      id,
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [{ path: "source/index.html", kind: "html", content: "<main data-motion-root></main>" }]
    }
  };
  return { ...base, ...input };
}

const productTransition = component({
  id: "product-transition",
  name: "商品详情转场",
  category: "media",
  tags: ["ecommerce", "product", "transition"],
  useCases: ["product-detail"],
  manifest: {
    version: "1.0",
    id: "product-transition",
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
        id: "productImage",
        label: "商品图",
        type: "image",
        default: "",
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--product-image" }
        ]
      },
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
      },
      {
        id: "startDelay",
        label: "开始延迟",
        type: "duration",
        default: 120,
        constraints: { min: 0, max: 600, step: 20, unit: "ms" },
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-delay" }
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
        content: '<main data-motion-root class="product-screen"></main>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content:
          ":root { --motion-duration: 620ms; --slide-distance: 320px; --start-delay: 120ms; } .product-screen { animation: move var(--motion-duration) both; }"
      },
      {
        path: "source/assets.css",
        kind: "css",
        content: ':root { --product-image: url("data:image/png;base64,A"); }'
      }
    ]
  }
});

const campaignHero = component({
  id: "campaign-hero",
  name: "活动页首屏",
  category: "layout",
  tags: ["campaign", "hero"],
  useCases: ["landing-page"],
  manifest: {
    ...productTransition.manifest,
    id: "campaign-hero",
    name: "活动页首屏",
    designSpecs: [{ id: "campaign-motion-skill", confidence: 0.9 }],
    params: productTransition.manifest.params.slice(0, 2)
  }
});

const blockedProduct = component({
  id: "product-static",
  name: "商品详情静态稿",
  category: "media",
  tags: ["ecommerce", "product", "transition"],
  useCases: ["product-detail"]
});

describe("createGenerationPlan", () => {
  it("returns only two controlled candidates with whitelisted params, layers, specs, and acceptance rules", () => {
    const plan = createGenerationPlan({
      brief: "需要商品详情页转场动效，滑动轨迹短一点，节奏更紧凑",
      components: [blockedProduct, campaignHero, productTransition]
    });

    expect(plan.candidates.map((candidate) => candidate.componentId)).toEqual([
      "product-transition",
      "campaign-hero"
    ]);
    expect(plan.candidates[0]?.specSkillIds).toEqual(["ecommerce-transition-motion-skill"]);
    expect(plan.candidates[0]?.allowed.paramIds).toEqual([
      "productImage",
      "transitionDuration",
      "slideDistance",
      "startDelay"
    ]);
    expect(plan.candidates[0]?.allowed.layerIds).toEqual(["productImage"]);
    expect(plan.candidates[0]?.allowed.sourceFiles).toEqual(
      expect.arrayContaining(["source/assets.css", "source/style.css"])
    );
    expect(plan.candidates[0]?.paramConcepts).toEqual(
      expect.arrayContaining([
        { paramId: "slideDistance", concepts: ["trajectory"] },
        { paramId: "startDelay", concepts: ["rhythm"] }
      ])
    );
    expect(plan.acceptanceRules.map((rule) => rule.id)).toEqual([
      "schema-valid",
      "spec-bound",
      "diff-whitelist",
      "preview-playable",
      "loopable-motion"
    ]);
    expect(plan.fallback.action).toBe("edit-candidates");
  });
});
