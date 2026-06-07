import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { createControlledGenerationHandler } from "./controlledGenerationRoute";

class MockRequest extends EventEmitter {
  method: string;

  constructor(
    method: string,
    private readonly chunks: string[]
  ) {
    super();
    this.method = method;
  }

  setEncoding() {
    return undefined;
  }

  destroy() {
    return this;
  }

  flush() {
    for (const chunk of this.chunks) this.emit("data", chunk);
    this.emit("end");
  }
}

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  end(value = "") {
    this.body = value;
  }
}

const component: MotionComponent = {
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

const imageOnlyComponent: MotionComponent = {
  ...component,
  id: "image-only-transition",
  name: "图片替换组件",
  manifest: {
    ...component.manifest,
    id: "image-only-transition-manifest",
    name: "图片替换组件",
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
      }
    ]
  }
};

async function invoke(input: { method: string; body: string }) {
  const req = new MockRequest(input.method, [input.body]);
  const res = new MockResponse();
  const handled = createControlledGenerationHandler()(req as never, res as never);
  req.flush();
  await handled;
  return res;
}

describe("controlledGenerationRoute", () => {
  it("generates a controlled component from a brief and candidate pool", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({ brief: "商品详情转场更快一点，滑动距离短一点", components: [component] })
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toMatchObject({
      component: {
        source: { origin: "generated" }
      },
      patch: {
        baseComponentId: "product-transition",
        paramValues: { transitionDuration: 540, slideDistance: 260 }
      },
      validation: { valid: true },
      plan: {
        candidates: [{ componentId: "product-transition" }]
      }
    });
  });

  it("rejects empty candidate pools with an actionable 422", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({ brief: "生成一个商品详情转场", components: [] })
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toContain("没有可用于受控生成的候选组件");
  });

  it("rejects generation requests that cannot produce a visible diff", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({ brief: "生成一个商品图片转场", components: [imageOnlyComponent] })
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toContain("没有生成有效差异");
  });

  it("rejects malformed requests", async () => {
    const res = await invoke({ method: "POST", body: "{}" });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("brief and components are required");
  });

  it("rejects non-post methods", async () => {
    const res = await invoke({ method: "GET", body: "" });

    expect(res.statusCode).toBe(405);
  });
});
