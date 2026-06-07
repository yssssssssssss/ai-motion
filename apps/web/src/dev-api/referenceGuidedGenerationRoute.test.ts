import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import {
  createReferenceGuidedGenerationHandler,
  generateSemanticIntentV2,
  generateReferenceGuidedSourceDraft,
  type CreateReferenceGuidedGenerationHandlerInput
} from "./referenceGuidedGenerationRoute";

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
  id: "reference-button",
  name: "参考按钮",
  category: "interaction",
  tags: ["button", "reference"],
  useCases: ["button-motion"],
  moods: ["generated"],
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
    files: [{ path: "source/index.html", kind: "html", content: "<main data-motion-root></main>" }]
  }
};

const pageTransitionComponent: MotionComponent = {
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
    layers: [
      { id: "frontPage", label: "前页", kind: "structure", replaceable: false, targets: [] },
      { id: "backPage", label: "后页", kind: "structure", replaceable: false, targets: [] }
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
          '<!doctype html><html><head><link rel="stylesheet" href="./style.css" /></head><body><main data-motion-root class="jd-front-back-entry"><div class="screen-window"><div class="screen-layer mine-content"></div><div class="screen-layer orders-content"></div><div class="screen-wash"></div></div></main><script src="./script.js"></script></body></html>'
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

async function invoke(input: {
  method: string;
  body: string;
  handlerInput?: CreateReferenceGuidedGenerationHandlerInput;
}) {
  const req = new MockRequest(input.method, [input.body]);
  const res = new MockResponse();
  const handled = createReferenceGuidedGenerationHandler(input.handlerInput)(req as never, res as never);
  req.flush();
  await handled;
  return res;
}

const modelDraft = {
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
  animation: ai-left-to-right-slide-bounce 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes ai-left-to-right-slide-bounce {
  from { transform: translateX(-42vw) scale(.96); }
  58% { transform: translateX(0) scale(1.14); }
  to { transform: translateX(42vw) scale(1); }
}`,
  js: `window.motionReplay = function motionReplay() {};
window.motionPause = function motionPause() {};
window.motionSeek = function motionSeek() {};`
};

function responsePayload(value: unknown) {
  return { output_text: JSON.stringify(value) };
}

const modelSemanticIntentV2 = {
  version: 2,
  target: { kind: "button", label: "按钮" },
  layers: [{ role: "button", label: "按钮" }],
  motions: [
    {
      type: "bounce",
      target: "button",
      trigger: "load",
      direction: "left-to-right",
      speed: "normal",
      description: "从左到右弹动进入"
    },
    {
      type: "slide",
      target: "button",
      trigger: "load",
      direction: "left-to-right",
      speed: "normal",
      description: "从左侧移动到右侧"
    }
  ],
  colors: [{ target: "background", label: "红色", value: "#ef4444" }],
  text: null,
  trigger: "load",
  speed: "normal",
  motionCategory: "feedback",
  targetRoles: ["button"],
  composition: "sequence",
  migrationIntent: false,
  referenceRecipeHints: [],
  negativeConstraints: [],
  referenceHints: [],
  source: "model",
  confidence: 0.9,
  raw: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧"
};

const modelMobilePageIntentV2 = {
  version: 2,
  target: { kind: "mobile-page", label: "移动端页面" },
  layers: [
    { role: "screen", label: "移动端页面" },
    { role: "foreground", label: "前景图层" }
  ],
  motions: [
    {
      type: "scale",
      target: "foreground",
      trigger: "load",
      direction: null,
      speed: "normal",
      description: "前景图层缩放入场"
    }
  ],
  colors: [],
  text: null,
  trigger: "load",
  speed: "normal",
  motionCategory: "entrance",
  targetRoles: ["screen", "foreground"],
  composition: "single",
  migrationIntent: false,
  referenceRecipeHints: [],
  negativeConstraints: ["不要按钮"],
  referenceHints: [],
  source: "model",
  confidence: 0.86,
  raw: "做一个移动端页面，需要前景图层以缩放效果入场"
};

describe("referenceGuidedGenerationRoute", () => {
  it("generates a new semantic component from reference candidates", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({
        brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
        components: [component]
      })
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      component: { source: { origin: "generated" } },
      coverage: { missing: [] },
      validation: { valid: true }
    });
  });

  it("generates distinct semantic roles through the API route", async () => {
    const cases = [
      { brief: "生成一个紫色标题，慢速淡入", role: "text", marker: "semantic-text" },
      { brief: "生成一个绿色卡片，悬停后发光", role: "card", marker: "semantic-card" },
      { brief: "生成一个红色标签，循环脉冲", role: "badge", marker: "semantic-badge" },
      { brief: "生成一个蓝色加载动画，三个点循环跳动", role: "loader", marker: "semantic-loader" }
    ];

    for (const item of cases) {
      const res = await invoke({
        method: "POST",
        body: JSON.stringify({ brief: item.brief, components: [component] })
      });
      const body = JSON.parse(res.body);
      const source = body.component.source.files.map((file: { content: string }) => file.content).join("\n");

      expect(res.statusCode).toBe(200);
      expect(body.intent.role).toBe(item.role);
      expect(body.coverage.missing).toEqual([]);
      expect(body.validation.valid).toBe(true);
      expect(source).toContain(item.marker);
    }
  });

  it("generates a page-transition variant from a natural language reference", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({
        brief: "基于前后进场代码动效，生成一个更快、进入距离更短、泛白更弱的页面转场，不要按钮",
        components: [pageTransitionComponent, component]
      })
    });
    const body = JSON.parse(res.body);
    const css = body.component.source.files.find((file: { path: string }) => file.path === "source/style.css").content;

    expect(res.statusCode).toBe(200);
    expect(body.intent.role).toBe("page-transition");
    expect(body.references).toEqual(
      expect.arrayContaining([{ id: "jd-front-back-entry-transition", name: "前后进场代码动效" }])
    );
    expect(body.coverage.missing).toEqual([]);
    expect(body.validation.valid).toBe(true);
    expect(css).toContain("--cycle-duration: 1840ms");
    expect(css).toContain("--enter-distance: 360px");
  });

  it("uses an OpenAI source draft when configured and valid", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload(modelSemanticIntentV2)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload(modelDraft)), { status: 200 }));
    const res = await invoke({
      method: "POST",
      handlerInput: { apiKey: "test-key", apiBaseUrl: "https://api.example.test/v1", fetchImpl },
      body: JSON.stringify({
        brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
        components: [component]
      })
    });
    const body = JSON.parse(res.body);
    const css = body.component.source.files.find((file: { path: string }) => file.path === "source/style.css").content;
    const secondCall = fetchImpl.mock.calls[1] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(secondCall[1]?.body as string);
    const modelContext = JSON.parse(requestBody.input[1].content);

    expect(res.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(modelContext.intent).toMatchObject({ role: "button", trigger: "load" });
    expect(modelContext.intentV2).toMatchObject({ version: 2, target: { kind: "button" }, source: "model" });
    expect(body.intentV2).toMatchObject({ target: { kind: "button" }, source: "model" });
    expect(css).toContain("ai-left-to-right-slide-bounce");
    expect(body.coverage.missing).toEqual([]);
    expect(body.validation.valid).toBe(true);
  });

  it("falls back when the OpenAI source draft is unsafe", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload(modelSemanticIntentV2)), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(responsePayload({ ...modelDraft, js: `fetch("https://example.com")` })), {
          status: 200
        })
      );
    const res = await invoke({
      method: "POST",
      handlerInput: { apiKey: "test-key", fetchImpl },
      body: JSON.stringify({
        brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
        components: [component]
      })
    });
    const body = JSON.parse(res.body);
    const source = body.component.source.files.map((file: { content: string }) => file.content).join("\n");

    expect(res.statusCode).toBe(200);
    expect(source).not.toContain("https://example.com");
    expect(source).toContain("@keyframes generated-left-to-right-slide-bounce");
    expect(body.validation.valid).toBe(true);
  });

  it("uses model semantic intent to avoid button fallback for layer-based page requests", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload(modelMobilePageIntentV2)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(responsePayload({ html: "", css: "", js: "" })), { status: 200 }));
    const res = await invoke({
      method: "POST",
      handlerInput: { apiKey: "test-key", fetchImpl },
      body: JSON.stringify({
        brief: "做一个移动端页面，需要前景图层以缩放效果入场",
        components: [component]
      })
    });
    const body = JSON.parse(res.body);
    const source = body.component.source.files.map((file: { content: string }) => file.content).join("\n");

    expect(res.statusCode).toBe(200);
    expect(body.intentV2).toMatchObject({ target: { kind: "mobile-page" }, source: "model" });
    expect(body.intent.role).toBe("mobile-page");
    expect(body.coverage.missing).toEqual([]);
    expect(source).toContain("semantic-mobile-page");
    expect(source).not.toContain("<button");
  });

  it("generates from built-in recipes when no reference candidates are available", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({
        brief: "做一个背景层缓慢漂浮的页面",
        components: []
      })
    });
    const body = JSON.parse(res.body);
    const source = body.component.source.files.map((file: { content: string }) => file.content).join("\n");

    expect(res.statusCode).toBe(200);
    expect(body.intent.role).toBe("mobile-page");
    expect(body.component.manifest.motionRecipes[0]).toMatchObject({
      recipeId: "float-loop",
      trigger: "loop"
    });
    expect(body.coverage.missing).toEqual([]);
    expect(body.validation.valid).toBe(true);
    expect(source).toContain('data-motion="backgroundLayer"');
    expect(source).toContain("@keyframes generated-loop-float");
    expect(source).not.toContain("<button");
  });

  it("falls back to local V2 semantic intent when model semantic parsing is malformed", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(responsePayload({ bad: true })), { status: 200 }));
    const res = await invoke({
      method: "POST",
      handlerInput: { apiKey: "test-key", fetchImpl },
      body: JSON.stringify({
        brief: "做一个移动端页面，需要前景图层以缩放效果入场",
        components: [component]
      })
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.intentV2).toMatchObject({ target: { kind: "mobile-page" }, source: "fallback" });
    expect(body.intent.role).toBe("mobile-page");
    expect(body.coverage.missing).toEqual([]);
  });

  it("parses OpenAI semantic intent V2 responses with an abort signal", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Response(JSON.stringify(responsePayload(modelMobilePageIntentV2)), { status: 200 });
    });

    const intent = await generateSemanticIntentV2({
      brief: "做一个移动端页面，需要前景图层以缩放效果入场",
      apiKey: "test-key",
      fetchImpl
    });

    expect(intent).toMatchObject({ target: { kind: "mobile-page" }, source: "model" });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("adds an abort signal to OpenAI source draft requests", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Response(JSON.stringify(responsePayload(modelDraft)), { status: 200 });
    });

    const draft = await generateReferenceGuidedSourceDraft({
      brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
      references: [component],
      apiKey: "test-key",
      fetchImpl
    });

    expect(draft).toEqual(modelDraft);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back when an OpenAI source draft request exceeds the timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      });
      const promise = generateReferenceGuidedSourceDraft({
        brief: "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧",
        references: [component],
        apiKey: "test-key",
        apiBaseUrl: "https://api.example.test/v1",
        fetchImpl,
        modelTimeoutMs: 5
      });

      await vi.advanceTimersByTimeAsync(5);

      await expect(promise).resolves.toBeUndefined();
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
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
