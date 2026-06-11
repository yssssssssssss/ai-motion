import { describe, expect, it, vi } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { loadControlledGenerationCandidates } from "./generationCandidates";

function component(input: {
  id: string;
  name: string;
  tags: string[];
  useCases?: string[];
  entryContent: string;
}): MotionComponent {
  return {
    id: input.id,
    name: input.name,
    category: "media",
    tags: input.tags,
    useCases: input.useCases ?? ["product-detail"],
    moods: ["clean"],
    manifest: {
      version: "1.0",
      id: input.id,
      name: input.name,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      capabilities: ["builtin", "editable", "export-html"],
      designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.9 }],
      layers: [
        {
          id: "productImage",
          label: "商品图",
          kind: "image",
          replaceable: true,
          paramId: "productImage",
          targets: [{ kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--product-image" }]
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
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
        }
      ]
    },
    source: {
      id: input.id,
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: input.entryContent },
        { path: "source/style.css", kind: "css", content: ":root { --motion-duration: 620ms; }" },
        { path: "source/assets.css", kind: "css", content: ":root { --product-image: none; }" }
      ]
    }
  };
}

describe("loadControlledGenerationCandidates", () => {
  it("hydrates recommended placeholder components before returning generation candidates", async () => {
    const placeholder = component({
      id: "product-transition",
      name: "商品详情转场",
      tags: ["ecommerce", "product", "transition"],
      entryContent: ""
    });
    const hydrated = component({
      id: "product-transition",
      name: "商品详情转场",
      tags: ["ecommerce", "product", "transition"],
      entryContent: "<main data-motion-root></main>"
    });
    const loadComponentSource = vi.fn(async () => hydrated);

    const candidates = await loadControlledGenerationCandidates({
      brief: "商品详情转场快一点",
      components: [placeholder],
      onLoadComponentSource: loadComponentSource
    });

    expect(loadComponentSource).toHaveBeenCalledWith(placeholder);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toBe("product-transition");
    expect(candidates[0]?.source.files[0]?.content).toContain("data-motion-root");
  });

  it("does not reload candidates that already have renderable entry source", async () => {
    const ready = component({
      id: "product-transition",
      name: "商品详情转场",
      tags: ["ecommerce", "product", "transition"],
      entryContent: "<main data-motion-root></main>"
    });
    const loadComponentSource = vi.fn(async () => ready);

    const candidates = await loadControlledGenerationCandidates({
      brief: "商品详情转场快一点",
      components: [ready],
      onLoadComponentSource: loadComponentSource
    });

    expect(loadComponentSource).not.toHaveBeenCalled();
    expect(candidates.map((candidate) => candidate.id)).toEqual(["product-transition"]);
  });

  it("pins an explicitly referenced front-back page transition ahead of broad button matches", async () => {
    const pageTransition = component({
      id: "jd-front-back-entry-transition",
      name: "前后进场代码动效",
      tags: ["jd", "page-transition"],
      useCases: ["mobile-ui", "page-transition", "app-prototype"],
      entryContent: "<main data-motion-root class=\"jd-front-back-entry\"></main>"
    });
    const buttonLike = component({
      id: "workeasy-buttons-31-button",
      name: "闪光按钮",
      tags: ["button", "workeasy"],
      entryContent: "<main data-motion-root><button>按钮</button></main>"
    });
    const loadComponentSource = vi.fn(async (item: MotionComponent) => item);

    const candidates = await loadControlledGenerationCandidates({
      brief: "基于前后进场代码动效，做一个更快一点的版本，不要生成按钮",
      components: [buttonLike, pageTransition],
      onLoadComponentSource: loadComponentSource
    });

    expect(candidates[0]?.id).toBe("jd-front-back-entry-transition");
    expect(candidates.map((candidate) => candidate.id)).not.toEqual(["workeasy-buttons-31-button"]);
  });
});
