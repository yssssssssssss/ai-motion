import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import { analyzeGenerationReadiness, canGenerateFromComponent } from "../src/library/generationReadiness";

function makeComponent(overrides: Partial<MotionComponent> = {}): MotionComponent {
  return {
    id: "campaign-hero",
    name: "Campaign Hero",
    category: "layout",
    tags: ["campaign", "hero"],
    useCases: ["landing-page"],
    moods: ["clean"],
    manifest: {
      version: "1.0",
      id: "campaign-hero",
      name: "Campaign Hero",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      capabilities: ["builtin", "editable", "export-html"],
      params: [
        {
          id: "posterImage",
          label: "主视觉图片",
          type: "image",
          default: "var(--poster-image)",
          status: "confirmed",
          targets: [
            { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--poster-image" }
          ]
        },
        {
          id: "headline",
          label: "标题文案",
          type: "text",
          default: "新品上市",
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
            { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }
          ]
        }
      ]
    },
    source: {
      id: "campaign-hero",
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        {
          path: "source/index.html",
          kind: "html",
          content:
            '<main data-motion-root><div class="poster-layer"></div><h1 data-motion="headline">新品上市</h1></main>'
        },
        {
          path: "source/style.css",
          kind: "css",
          content:
            ":root { --motion-duration: 800ms; } .poster-layer { background-image: var(--poster-image); animation: reveal var(--motion-duration) both; }"
        },
        {
          path: "source/assets.css",
          kind: "css",
          content: ':root { --poster-image: url("data:image/png;base64,AAAA"); }'
        }
      ]
    },
    ...overrides
  };
}

describe("analyzeGenerationReadiness", () => {
  it("builds a generation profile from editable image/text params and Plus controls", () => {
    const report = analyzeGenerationReadiness(makeComponent());

    expect(report.status).toBe("ready");
    expect(report.allowedParamIds).toEqual(["posterImage", "headline", "duration"]);
    expect(report.replaceableLayerIds).toEqual(["posterImage", "headline"]);
    expect(report.plusControlCount).toBe(1);
    expect(report.layerProfile.layers.map((layer) => layer.id)).toEqual(
      expect.arrayContaining(["posterImage", "headline", "poster-layer"])
    );
    expect(report.specBindings.map((binding) => binding.id)).toContain("campaign-motion-skill");
  });

  it("prefers explicit manifest specs and layers over inferred metadata", () => {
    const report = analyzeGenerationReadiness(
      makeComponent({
        tags: [],
        useCases: [],
        moods: [],
        manifest: {
          ...makeComponent().manifest,
          designSpecs: [
            {
              id: "ecommerce-transition-motion-skill",
              confidence: 0.91,
              required: true
            }
          ],
          layers: [
            {
              id: "hero-poster",
              label: "Hero poster",
              kind: "image",
              replaceable: true,
              required: true,
              paramId: "posterImage",
              targets: [
                {
                  kind: "css-variable",
                  file: "source/assets.css",
                  selector: ":root",
                  name: "--poster-image"
                }
              ]
            },
            {
              id: "headline-layer",
              label: "Headline",
              kind: "text",
              replaceable: true,
              required: false,
              paramId: "headline",
              targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
            }
          ]
        }
      })
    );

    expect(report.status).toBe("ready");
    expect(report.specBindings.map((binding) => binding.id)).toEqual(["ecommerce-transition-motion-skill"]);
    expect(report.layerProfile.layers.map((layer) => layer.id)).toEqual(["hero-poster", "headline-layer"]);
    expect(report.replaceableLayerIds).toEqual(["hero-poster", "headline-layer"]);
  });

  it("keeps code-only transition components usable but partial when layers are not replaceable", () => {
    const report = analyzeGenerationReadiness(
      makeComponent({
        id: "jd-product-transition-video",
        name: "商品详情转场代码动效",
        category: "media",
        tags: ["ecommerce", "product", "transition", "video"],
        useCases: ["product-detail"],
        manifest: {
          version: "1.0",
          id: "jd-product-transition-video",
          name: "商品详情转场代码动效",
          sourceKind: "builtin-component",
          runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
          capabilities: ["builtin", "editable", "export-html"],
          params: [
            {
              id: "transitionDuration",
              label: "转场速度",
              type: "duration",
              default: 620,
              constraints: { min: 220, max: 1400, step: 20, unit: "ms" },
              status: "confirmed",
              targets: [
                {
                  kind: "css-variable",
                  file: "source/style.css",
                  selector: ":root",
                  name: "--motion-duration"
                }
              ]
            },
            {
              id: "midScale",
              label: "中途缩放",
              type: "range",
              default: 0.96,
              constraints: { min: 0.7, max: 1.25, step: 0.01 },
              status: "confirmed",
              targets: [
                { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--mid-scale" }
              ]
            }
          ]
        },
        source: {
          id: "jd-product-transition-video",
          origin: "builtin",
          kind: "builtin-component",
          entry: "source/index.html",
          files: [
            {
              path: "source/index.html",
              kind: "html",
              content:
                '<main data-motion-root><div class="home-frame"></div><div class="detail-frame"></div><article class="shared-card"></article></main>'
            },
            {
              path: "source/style.css",
              kind: "css",
              content:
                ".home-frame { background-image: var(--home-frame); } .detail-frame { background-image: var(--detail-frame); } .shared-card { animation: move var(--motion-duration) both; }"
            }
          ]
        }
      })
    );

    expect(report.status).toBe("partial");
    expect(report.layerProfile.layers.map((layer) => layer.id)).toEqual(
      expect.arrayContaining(["home-frame", "detail-frame", "shared-card"])
    );
    expect(report.replaceableLayerIds).toEqual([]);
    expect(report.specBindings.map((binding) => binding.id)).toContain("ecommerce-transition-motion-skill");
    expect(report.checks.find((check) => check.id === "replaceable-layers")?.status).toBe("warn");
  });

  it("blocks generation when a component has no controls and no layer inventory", () => {
    const report = analyzeGenerationReadiness(
      makeComponent({
        manifest: { ...makeComponent().manifest, params: [] },
        source: {
          ...makeComponent().source,
          files: [{ path: "source/index.html", kind: "html", content: "<main></main>" }]
        }
      })
    );

    expect(report.status).toBe("blocked");
    expect(report.score).toBeLessThan(60);
  });

  it("returns a blocking generation gate when required readiness checks fail", () => {
    const result = canGenerateFromComponent(
      makeComponent({
        manifest: { ...makeComponent().manifest, params: [] },
        source: {
          ...makeComponent().source,
          files: [{ path: "source/index.html", kind: "html", content: "<main></main>" }]
        }
      })
    );

    expect(result.allowed).toBe(false);
    expect(result.blockers.map((blocker) => blocker.id)).toEqual(
      expect.arrayContaining(["bounded-params", "layer-inventory"])
    );
  });
});
