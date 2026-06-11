import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { ComponentFeed, shouldLoadPreviewSource } from "./ComponentFeed";

function makeComponent(index: number): MotionComponent {
  const id = `component-${index}`;
  return {
    id,
    name: `Component ${index}`,
    category: "interaction",
    tags: ["buttons", "workeasy"],
    useCases: ["campaign-page"],
    moods: ["clean"],
    manifest: {
      version: "1.0",
      id,
      name: `Component ${index}`,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "buttonColor",
          label: "按钮颜色",
          type: "color",
          default: "#111111",
          status: "confirmed",
          targets: [
            { kind: "css-property", file: "source/style.css", selector: ".button", property: "background" }
          ]
        }
      ]
    },
    source: {
      id,
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        {
          path: "source/index.html",
          kind: "html",
          content: '<button class="button">开始</button>'
        },
        {
          path: "source/style.css",
          kind: "css",
          content: ".button { transition: transform 180ms; } .button:hover { transform: scale(1.04); }"
        }
      ]
    }
  };
}

describe("ComponentFeed", () => {
  it("only mounts iframe previews for the initial viewport batch", () => {
    const components = Array.from({ length: 18 }, (_, index) => makeComponent(index + 1));
    const html = renderToStaticMarkup(
      <ComponentFeed
        components={components}
        aiMatchIds={new Set()}
        onLoadComponentSource={async (component) => component}
        onSelect={() => {}}
      />
    );

    expect(html.match(/feed-preview-frame/g)).toHaveLength(12);
    expect(html.match(/feed-preview-placeholder/g)).toHaveLength(6);
    expect(html).toContain("Component 18 预览加载占位");
  });

  it("loads mounted oversized builtin component sources without waiting for hover", () => {
    const heavy = {
      ...makeComponent(2),
      id: "jd-product-transition-video",
      name: "商品详情转场代码动效",
      category: "media",
      tags: ["ecommerce", "product", "transition", "video", "jd"],
      source: {
        ...makeComponent(2).source,
        id: "jd-product-transition-video",
        files: [{ path: "source/index.html", content: "", kind: "html" as const }]
      }
    } satisfies MotionComponent;
    expect(shouldLoadPreviewSource(makeComponent(1), { isMounted: true })).toBe(false);
    expect(shouldLoadPreviewSource(heavy, { isMounted: false })).toBe(false);
    expect(shouldLoadPreviewSource(heavy, { isMounted: true })).toBe(true);
  });

  it("renders a compact component health badge", () => {
    const html = renderToStaticMarkup(
      <ComponentFeed
        components={[makeComponent(1)]}
        aiMatchIds={new Set()}
        onLoadComponentSource={async (component) => component}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("健康度");
    expect(html).toContain("feed-health-badge");
  });

  it("renders compact generation readiness metadata", () => {
    const component = {
      ...makeComponent(1),
      tags: ["hero", "campaign"],
      manifest: {
        ...makeComponent(1).manifest,
        params: [
          ...makeComponent(1).manifest.params,
          {
            id: "headline",
            label: "标题文案",
            type: "text" as const,
            default: "新品上市",
            status: "confirmed" as const,
            targets: [
              { kind: "html-text" as const, file: "source/index.html", selector: "[data-motion=headline]" }
            ]
          },
          {
            id: "transitionDuration",
            label: "入场时长",
            type: "duration" as const,
            default: 800,
            constraints: { min: 200, max: 2000, step: 50, unit: "ms" as const },
            status: "confirmed" as const,
            targets: [
              {
                kind: "css-variable" as const,
                file: "source/style.css",
                selector: ":root",
                name: "--motion-duration"
              }
            ]
          }
        ]
      }
    } satisfies MotionComponent;
    const html = renderToStaticMarkup(
      <ComponentFeed
        components={[component]}
        aiMatchIds={new Set()}
        onLoadComponentSource={async (item) => item}
        onSelect={() => {}}
      />
    );

    expect(html).toContain("生成就绪");
    expect(html).toContain("图层");
    expect(html).toContain("feed-readiness-row");
  });

  it("does not render generation readiness filter navigation", () => {
    const ready = {
      ...makeComponent(1),
      tags: ["campaign", "hero"],
      manifest: {
        ...makeComponent(1).manifest,
        designSpecs: [{ id: "campaign-motion-skill" as const, confidence: 0.9 }],
        layers: [
          {
            id: "buttonColor",
            label: "按钮颜色",
            kind: "image" as const,
            replaceable: true,
            paramId: "buttonColor",
            targets: []
          }
        ],
        params: [
          ...makeComponent(1).manifest.params,
          {
            id: "transitionDuration",
            label: "入场时长",
            type: "duration" as const,
            default: 800,
            constraints: { min: 200, max: 2000, step: 50, unit: "ms" as const },
            status: "confirmed" as const,
            targets: [
              {
                kind: "css-variable" as const,
                file: "source/style.css",
                selector: ":root",
                name: "--motion-duration"
              }
            ]
          }
        ]
      }
    } satisfies MotionComponent;
    const blocked = {
      ...makeComponent(2),
      manifest: { ...makeComponent(2).manifest, params: [] },
      source: {
        ...makeComponent(2).source,
        files: [{ path: "source/index.html", kind: "html" as const, content: "" }]
      }
    } satisfies MotionComponent;
    const partial = {
      ...makeComponent(3),
      tags: ["product", "transition"],
      source: {
        ...makeComponent(3).source,
        files: [
          {
            path: "source/index.html",
            kind: "html" as const,
            content: '<main data-motion-root class="product-screen"><button class="button">开始</button></main>'
          },
          {
            path: "source/style.css",
            kind: "css" as const,
            content: ".button { transition: transform 180ms; } .product-screen { display: grid; }"
          }
        ]
      }
    } satisfies MotionComponent;
    const html = renderToStaticMarkup(
      <ComponentFeed
        components={[ready, partial, blocked]}
        aiMatchIds={new Set()}
        onLoadComponentSource={async (item) => item}
        onSelect={() => {}}
      />
    );

    expect(html).not.toContain('aria-label="生成就绪度筛选"');
    expect(html).toContain("生成就绪");
    expect(html).toContain("部分可生成");
    expect(html).toContain("需补规范");
    expect(html).toContain("feed-readiness-row");
  });
});
