import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import { recommendComponents } from "../src/orchestrator/recommend";
import type { ParsedBriefIntent } from "../src/orchestrator/briefIntent";

function component(input: {
  id: string;
  name: string;
  category: MotionComponent["category"];
  tags: string[];
  useCases?: string[];
  moods?: string[];
  html: string;
  css: string;
}): MotionComponent {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    tags: input.tags,
    useCases: input.useCases ?? [],
    moods: input.moods ?? [],
    manifest: {
      version: "1.0",
      id: `${input.id}-manifest`,
      name: input.name,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [],
      capabilities: ["builtin", "export-html"]
    },
    source: {
      id: input.id,
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: input.html },
        { path: "source/style.css", kind: "css", content: input.css }
      ]
    }
  };
}

const evalComponents = [
  component({
    id: "hero-text-reveal",
    name: "文字入场动效",
    category: "text",
    tags: ["hero", "text", "saas", "reveal"],
    useCases: ["landing-page"],
    moods: ["premium", "clean"],
    html: '<section class="hero"><h1 data-motion="headline">快速生成动效</h1></section>',
    css: ".hero { color: #fff; } .hero h1 { animation: reveal 800ms ease both; transform: translateY(0); } @keyframes reveal { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }"
  }),
  component({
    id: "campaign-button",
    name: "紫色活动按钮",
    category: "interaction",
    tags: ["button", "campaign", "cta"],
    useCases: ["campaign-page"],
    moods: ["expressive"],
    html: '<button class="button">立即参与</button>',
    css: ".button { background: linear-gradient(90deg, #6b36fa, #3544eb); transition: transform 200ms; } .button:hover { transform: scale(1.08); box-shadow: 0 0 20px #8f55fd; }"
  }),
  component({
    id: "product-card",
    name: "商品卡片动效",
    category: "layout",
    tags: ["card", "ecommerce"],
    useCases: ["product"],
    moods: ["clean"],
    html: '<article class="card">商品信息</article>',
    css: ".card { background: #fff; border-radius: 24px; transition: transform 220ms; } .card:hover { transform: scale(1.03); }"
  }),
  component({
    id: "form-checkbox",
    name: "表单选择控件",
    category: "interaction",
    tags: ["checkbox", "form"],
    useCases: ["form"],
    moods: ["subtle"],
    html: '<label class="check"><input type="checkbox" />同意协议</label>',
    css: ".check { transition: color 180ms; } .check:hover { color: #2563eb; }"
  })
] satisfies MotionComponent[];

type EvalCase = {
  name: string;
  intent: ParsedBriefIntent;
  expectedTop3: string[];
  forbiddenTop3?: string[];
};

const baseIntent: ParsedBriefIntent = {
  query: "",
  semanticQuery: "",
  categories: [],
  componentKinds: [],
  motionStyles: [],
  sources: [],
  keywords: [],
  softPreferences: [],
  hardConstraints: [],
  negativePreferences: [],
  reasoningHints: [],
  confidence: 0.9
};

const cases: EvalCase[] = [
  {
    name: "SaaS 首页文字入场",
    intent: {
      ...baseIntent,
      query: "适合 SaaS 首页的文字入场动效",
      semanticQuery: "软件服务首页首屏标题文字淡入上滑出现",
      componentKinds: ["animated headline"],
      motionStyles: ["fade in", "slide up"],
      softPreferences: ["软件服务首页", "文字入场", "干净简洁"]
    },
    expectedTop3: ["hero-text-reveal"],
    forbiddenTop3: ["campaign-button"]
  },
  {
    name: "活动页紫色按钮 hover",
    intent: {
      ...baseIntent,
      query: "活动页紫色按钮 hover 动效",
      semanticQuery: "campaign cta purple button hover glow",
      componentKinds: ["button"],
      softPreferences: ["活动页", "紫色", "hover", "发光"]
    },
    expectedTop3: ["campaign-button"],
    forbiddenTop3: ["product-card"]
  },
  {
    name: "商品卡片",
    intent: {
      ...baseIntent,
      query: "电商商品卡片动效",
      semanticQuery: "ecommerce product card hover motion",
      componentKinds: ["card"],
      softPreferences: ["电商", "商品", "卡片"]
    },
    expectedTop3: ["product-card"],
    forbiddenTop3: ["campaign-button"]
  }
];

describe("retrieval evals", () => {
  it.each(cases)("keeps expected results in top 3: $name", ({ intent, expectedTop3, forbiddenTop3 = [] }) => {
    const top3 = recommendComponents({ intent, components: evalComponents, limit: 3 }).map(
      (result) => result.componentId
    );

    for (const expected of expectedTop3) expect(top3).toContain(expected);
    for (const forbidden of forbiddenTop3) expect(top3).not.toContain(forbidden);
  });

  it("returns no result for unavailable strict background particle requirements", () => {
    const results = recommendComponents({
      intent: {
        ...baseIntent,
        query: "直播间礼物雨粒子爆炸背景",
        semanticQuery: "live gift rain particle explosion background",
        categories: ["background"],
        hardConstraints: ["背景", "粒子"],
        softPreferences: ["直播间", "礼物雨", "爆炸"]
      },
      components: evalComponents,
      limit: 3
    });

    expect(results).toEqual([]);
  });
});
