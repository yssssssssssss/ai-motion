import { describe, expect, it } from "vitest";
import { motionManifestSchema } from "../src/manifest/schema";

describe("motionManifestSchema", () => {
  it("accepts a minimal confirmed HTML manifest", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "hero-text-reveal",
      name: "Hero Text Reveal",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "headline",
          label: "Headline",
          type: "text",
          default: "Build faster",
          status: "confirmed",
          targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported parameter types", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "bad",
      name: "Bad",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "timeline",
          label: "Timeline",
          type: "keyframe-editor",
          default: [],
          status: "confirmed",
          targets: []
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("accepts viewport and font-relative CSS units used by builtin components", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "iphone-dynamic-island",
      name: "iPhone Dynamic Island",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "phoneHeight",
          label: "Phone height",
          type: "range",
          default: 80,
          status: "confirmed",
          constraints: { min: 48, max: 104, step: 1, unit: "em" },
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--height" }]
        },
        {
          id: "scenePadding",
          label: "Scene padding",
          type: "range",
          default: 5,
          status: "confirmed",
          constraints: { min: 0, max: 10, step: 0.5, unit: "vmin" },
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--scene-pad" }]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("accepts explicit design spec bindings and layer inventory", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "product-transition",
      name: "Product Transition",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "transitionDuration",
          label: "Transition duration",
          type: "duration",
          default: 620,
          status: "confirmed",
          targets: [
            { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }
          ]
        }
      ],
      designSpecs: [
        {
          id: "ecommerce-transition-motion-skill",
          confidence: 0.92,
          required: true
        }
      ],
      layers: [
        {
          id: "product-card",
          label: "Product card",
          kind: "image",
          replaceable: true,
          required: true,
          paramId: "productImage",
          targets: [
            { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--product-card" }
          ]
        },
        {
          id: "stage-shell",
          label: "Stage shell",
          kind: "structure",
          replaceable: false,
          required: true,
          targets: []
        }
      ]
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.designSpecs?.[0]?.id).toBe("ecommerce-transition-motion-skill");
    expect(result.data.layers?.map((layer) => layer.id)).toEqual(["product-card", "stage-shell"]);
  });

  it("accepts swipe motion recipe bindings", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "swipe-motion",
      name: "Swipe Motion",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [],
      motionRecipes: [
        {
          recipeId: "swipe-motion.enter",
          recipeName: "Swipe Motion",
          category: "transition",
          targetLayerIds: ["foregroundLayer"],
          paramIds: [],
          trigger: "swipe",
          source: "model"
        }
      ]
    });

    expect(result.success).toBe(true);
  });
});
