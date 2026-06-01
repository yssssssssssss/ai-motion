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
});
