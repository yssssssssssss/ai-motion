import { describe, expect, it } from "vitest";
import {
  candidatesToElements,
  classifyGoal,
  createBlueprintFromElements,
  createFallbackBlueprint,
  createMotionDocument,
  createMotionBlueprint,
  createMotionPreviewSpec,
  createBlueprintFromVision,
  fixtureDrafts,
  parseMotionDocument,
  recommendPattern
} from "../src";

describe("MotionLens blueprint pipeline", () => {
  it("covers the P0 fixture archetypes", () => {
    expect(fixtureDrafts.map((fixture) => fixture.id)).toEqual([
      "commerce-product",
      "ai-result",
      "dashboard",
      "form-flow",
      "confirm-modal",
      "marketing-content"
    ]);
  });

  it("maps review goals without AI", () => {
    expect(classifyGoal("提高购买按钮点击率", "commerce")).toBe("ctr");
    expect(classifyGoal("帮助用户理解 AI 生成结果", "ai")).toBe("clarity");
    expect(classifyGoal("让提交成功反馈更明确", "form")).toBe("feedback");
    expect(classifyGoal("增强删除确认的信任感", "modal")).toBe("trust");
  });

  it("creates a ranked designer review blueprint", () => {
    const blueprint = createMotionBlueprint({
      fixtureId: "commerce-product",
      goalText: "提高购买按钮点击率"
    });

    expect(blueprint.version).toBe("0.1");
    expect(blueprint.diagnostics.analysisMode).toBe("fixture");
    expect(blueprint.elements.length).toBeGreaterThan(0);
    expect(blueprint.opportunities.length).toBeGreaterThan(0);
    expect(blueprint.opportunities.length).toBeLessThanOrEqual(5);
    expect(blueprint.opportunities[0]?.elementId).toBe("buy-cta");
    expect(blueprint.opportunities[0]?.priority).toBe("P0");
  });

  it("keeps fixture quality gates broad enough for regression checks", () => {
    const blueprints = fixtureDrafts.map((fixture) =>
      createMotionBlueprint({
        fixtureId: fixture.id,
        goalText: fixture.defaultGoalText
      })
    );
    const pageTypes = new Set(blueprints.map((blueprint) => blueprint.context.pageType));
    const patternIds = new Set(
      blueprints.flatMap((blueprint) => blueprint.opportunities.map((opportunity) => opportunity.patternId))
    );

    expect(pageTypes.size).toBeGreaterThanOrEqual(6);
    expect(blueprints.every((blueprint) => blueprint.opportunities.length > 0)).toBe(true);
    expect(patternIds.size).toBeGreaterThanOrEqual(5);
    expect(
      blueprints
        .flatMap((blueprint) => blueprint.opportunities)
        .every((opportunity) => opportunity.recommendedParams.repeat !== "loop")
    ).toBe(true);
  });

  it("selects stable patterns for common element/friction pairs", () => {
    const blueprint = createMotionBlueprint({ fixtureId: "form-flow", goalText: "让提交成功反馈更明确" });
    const submit = blueprint.elements.find((element) => element.id === "submit-button");

    expect(submit).toBeTruthy();
    if (!submit) return;

    expect(recommendPattern(submit, "confidence").id).toBe("button-press-success");
  });

  it("uses knowledge-backed patterns for specific commerce actions", () => {
    const blueprint = createBlueprintFromElements({
      source: {
        kind: "image",
        id: "product-detail-upload",
        name: "product.png",
        width: 1200,
        height: 900
      },
      pageType: "product-detail",
      goalText: "提升加购转化和收藏反馈",
      elements: [
        {
          id: "cart-button",
          kind: "button",
          label: "加入购物车",
          text: "加入购物车",
          bounds: { x: 760, y: 720, width: 220, height: 56 },
          confidence: 0.94,
          visualWeight: 0.58,
          interactiveLikelihood: 0.98
        },
        {
          id: "favorite-button",
          kind: "button",
          label: "收藏",
          text: "收藏",
          bounds: { x: 1040, y: 120, width: 72, height: 72 },
          confidence: 0.9,
          visualWeight: 0.5,
          interactiveLikelihood: 0.82
        }
      ]
    });

    expect(blueprint.opportunities.find((item) => item.elementId === "cart-button")?.patternId).toBe(
      "add-to-cart-fly"
    );
    expect(blueprint.opportunities.find((item) => item.elementId === "favorite-button")?.patternId).toBe(
      "favorite-heartbeat"
    );
  });

  it("varies card and content recommendations beyond element kind", () => {
    const blueprint = createBlueprintFromElements({
      source: {
        kind: "image",
        id: "mixed-upload",
        name: "mixed.png",
        width: 1200,
        height: 900
      },
      pageType: "commerce",
      goalText: "提高商品点击率",
      elements: [
        {
          id: "hero-card",
          kind: "card",
          label: "首屏商品卡",
          bounds: { x: 80, y: 120, width: 720, height: 260 },
          confidence: 0.94,
          visualWeight: 0.82,
          interactiveLikelihood: 0.64
        },
        {
          id: "copy-block",
          kind: "content",
          label: "说明内容区",
          bounds: { x: 80, y: 440, width: 720, height: 180 },
          confidence: 0.9,
          visualWeight: 0.48,
          interactiveLikelihood: 0.18
        }
      ]
    });

    expect(blueprint.opportunities.find((item) => item.elementId === "hero-card")?.patternId).toBe(
      "card-focus-spotlight"
    );
    expect(blueprint.opportunities.find((item) => item.elementId === "copy-block")?.patternId).toBe(
      "progressive-reveal"
    );
  });

  it("creates a preview spec from a selected opportunity", () => {
    const blueprint = createMotionBlueprint({ fixtureId: "confirm-modal" });
    const selected = blueprint.opportunities[0];

    expect(selected).toBeTruthy();
    if (!selected) return;

    const preview = createMotionPreviewSpec(blueprint, selected.id);

    expect(preview?.opportunityId).toBe(selected.id);
    expect(["button", "modal", "toast", "sequence"]).toContain(preview?.role);
  });

  it("creates an honest fallback blueprint for uploaded images before vision analysis exists", () => {
    const blueprint = createFallbackBlueprint({
      source: {
        kind: "image",
        id: "upload-1",
        name: "upload.png",
        width: 1280,
        height: 720
      },
      pageType: "commerce",
      goalText: "提高购买按钮点击率"
    });

    expect(blueprint.source.kind).toBe("image");
    expect(blueprint.diagnostics.analysisMode).toBe("fallback");
    expect(blueprint.elements).toEqual([]);
    expect(blueprint.opportunities).toEqual([]);
    expect(blueprint.diagnostics.warnings[0]).toContain("点击 AI 分析稿件");
  });

  it("creates a ranked blueprint from manually marked elements", () => {
    const blueprint = createBlueprintFromElements({
      source: {
        kind: "image",
        id: "manual-upload",
        name: "manual.png",
        width: 1200,
        height: 800
      },
      pageType: "commerce",
      goalText: "提高购买按钮点击率",
      analysisMode: "hybrid",
      warnings: ["手动标注生成。"],
      elements: [
        {
          id: "manual-button",
          kind: "button",
          label: "主按钮",
          bounds: { x: 500, y: 620, width: 180, height: 56 },
          confidence: 1,
          visualWeight: 0.5,
          interactiveLikelihood: 1
        }
      ]
    });

    expect(blueprint.elements).toHaveLength(1);
    expect(blueprint.opportunities[0]?.elementId).toBe("manual-button");
    expect(blueprint.opportunities[0]?.priority).toBe("P0");
    expect(blueprint.opportunities[0]?.recommendationSource).toBe("local-fallback");
    expect(blueprint.diagnostics.analysisMode).toBe("hybrid");
  });

  it("keeps decorative and ambiguous elements out of motion opportunities", () => {
    const blueprint = createBlueprintFromElements({
      source: {
        kind: "image",
        id: "decorative-upload",
        name: "decorative.png",
        width: 1200,
        height: 800
      },
      pageType: "marketing",
      goalText: "突出价格方案和转化入口",
      elements: [
        {
          id: "decorative-hero",
          kind: "content",
          label: "装饰插画",
          bounds: { x: 20, y: 20, width: 400, height: 300 },
          confidence: 0.92,
          visualWeight: 0.9,
          interactiveLikelihood: 0.02,
          isDecorative: true
        },
        {
          id: "real-cta",
          kind: "button",
          label: "开始使用",
          bounds: { x: 760, y: 620, width: 180, height: 48 },
          confidence: 0.9,
          visualWeight: 0.5,
          interactiveLikelihood: 0.96
        }
      ]
    });

    expect(blueprint.opportunities.map((item) => item.elementId)).toEqual(["real-cta"]);
    expect(blueprint.diagnostics.noMotionSuggestions[0]?.elementId).toBe("decorative-hero");
  });

  it("dedupes overlapping candidates before returning top opportunities", () => {
    const blueprint = createBlueprintFromElements({
      source: {
        kind: "image",
        id: "duplicate-upload",
        name: "duplicate.png",
        width: 1200,
        height: 800
      },
      pageType: "commerce",
      goalText: "提高购买按钮点击率",
      elements: [
        {
          id: "cta-1",
          kind: "button",
          label: "购买",
          bounds: { x: 500, y: 620, width: 200, height: 56 },
          confidence: 0.96,
          visualWeight: 0.5,
          interactiveLikelihood: 1
        },
        {
          id: "cta-2",
          kind: "button",
          label: "购买 duplicate",
          bounds: { x: 508, y: 624, width: 196, height: 54 },
          confidence: 0.9,
          visualWeight: 0.5,
          interactiveLikelihood: 1
        }
      ]
    });

    expect(blueprint.opportunities).toHaveLength(1);
    expect(blueprint.opportunities[0]?.elementId).toBe("cta-1");
  });

  it("exports and parses a MotionLens review document", () => {
    const blueprint = createMotionBlueprint({ fixtureId: "commerce-product" });
    const document = createMotionDocument({
      blueprint,
      imageDataUrl: "data:image/png;base64,abc",
      generatedAt: "2026-06-11T00:00:00.000Z"
    });

    const parsed = parseMotionDocument(JSON.parse(JSON.stringify(document)) as unknown);

    expect(parsed.kind).toBe("motionlens-review");
    expect(parsed.blueprint.source.id).toBe("commerce-product");
    expect(parsed.assets?.imageDataUrl).toBe("data:image/png;base64,abc");
  });

  it("fills recommendation source when importing older review documents", () => {
    const blueprint = createMotionBlueprint({ fixtureId: "commerce-product" });
    const legacy = JSON.parse(JSON.stringify(createMotionDocument({ blueprint }))) as {
      blueprint: { opportunities: Array<{ recommendationSource?: unknown }> };
    };
    delete legacy.blueprint.opportunities[0]?.recommendationSource;

    const parsed = parseMotionDocument(legacy);

    expect(parsed.blueprint.opportunities[0]?.recommendationSource).toBe("local-fallback");
  });

  it("validates vision candidates before creating elements", () => {
    const { elements, warnings } = candidatesToElements(
      {
        candidates: [
          {
            kind: "button",
            label: "提交",
            bounds: { x: -10, y: 20, width: 180, height: 48 },
            confidence: 1.2,
            visualWeight: 0.4,
            interactiveLikelihood: 0.9
          },
          {
            kind: "bad-kind",
            label: "bad",
            bounds: { x: 0, y: 0, width: 20, height: 20 }
          }
        ]
      },
      {
        kind: "image",
        id: "vision-upload",
        name: "vision.png",
        width: 320,
        height: 240
      }
    );

    expect(elements).toHaveLength(1);
    expect(elements[0]?.bounds.x).toBe(0);
    expect(elements[0]?.confidence).toBe(1);
    expect(warnings[0]).toContain("kind 无效");
  });

  it("falls back honestly when no vision analyzer is configured", async () => {
    const blueprint = await createBlueprintFromVision({
      source: {
        kind: "image",
        id: "upload-no-api",
        name: "upload.png",
        width: 1280,
        height: 720
      },
      pageType: "commerce",
      goalText: "提高购买按钮点击率"
    });

    expect(blueprint.diagnostics.analysisMode).toBe("fallback");
    expect(blueprint.diagnostics.warnings[0]).toContain("未配置视觉模型");
  });

  it("falls back when the vision analyzer returns no valid candidates", async () => {
    const blueprint = await createBlueprintFromVision({
      source: {
        kind: "image",
        id: "upload-empty-model",
        name: "upload.png",
        width: 1280,
        height: 720
      },
      pageType: "commerce",
      goalText: "提高购买按钮点击率",
      apiKey: "test-key",
      analyzer: async () => ({ candidates: [] })
    });

    expect(blueprint.diagnostics.analysisMode).toBe("fallback");
    expect(blueprint.elements).toEqual([]);
    expect(blueprint.diagnostics.warnings[0]).toContain("未识别到可评审元素");
  });

  it("uses model-generated opportunities when the vision analyzer returns them", async () => {
    const blueprint = await createBlueprintFromVision({
      source: {
        kind: "image",
        id: "upload-model-review",
        name: "upload.png",
        width: 1280,
        height: 720
      },
      pageType: "product-detail",
      goalText: "提升加购转化和操作反馈",
      apiKey: "test-key",
      analyzer: async () => ({
        candidates: [
          {
            id: "cart-cta",
            kind: "button",
            label: "加入购物车",
            text: "加入购物车",
            bounds: { x: 880, y: 620, width: 220, height: 56 },
            confidence: 0.94,
            visualWeight: 0.52,
            interactiveLikelihood: 0.98,
            isDecorative: false
          }
        ],
        opportunities: [
          {
            id: "cart-cta-add-to-cart-fly",
            elementId: "cart-cta",
            priority: "P0",
            score: 88,
            confidence: 0.91,
            businessGoal: "cvr",
            decisionStage: "act",
            friction: "confidence",
            strategy: "feedback",
            patternId: "pattern-add-to-cart-fly",
            patternName: "加购飞行动效",
            reason: "该按钮是商品详情页的核心转化动作，可通过飞入购物车建立明确反馈。",
            risks: ["购物车入口不可见时不要使用飞行动线。"],
            recommendedParams: {
              durationMs: 320,
              delayMs: null,
              easing: "spring",
              transform: "translate-to-cart + scale",
              repeat: "none"
            },
            knowledgeRefs: [
              {
                id: "pattern-add-to-cart-fly",
                title: "加购飞行动效",
                source: "人文共情-创造更有温度的用户体验-动态化趣味性场景设计预研",
                pageRange: "10-12"
              }
            ]
          }
        ]
      })
    });

    expect(blueprint.opportunities[0]?.patternName).toBe("加购飞行动效");
    expect(blueprint.opportunities[0]?.recommendationSource).toBe("llm-opportunity");
    expect(blueprint.opportunities[0]?.reason).toContain("飞入购物车");
    expect(blueprint.opportunities[0]?.knowledgeRefs?.[0]?.id).toBe("pattern-add-to-cart-fly");
    expect(blueprint.diagnostics.warnings[0]).toContain("AI 已基于视觉稿件和知识库生成机会点");
  });

  it("falls back when the vision analyzer throws", async () => {
    const blueprint = await createBlueprintFromVision({
      source: {
        kind: "image",
        id: "upload-model-error",
        name: "upload.png",
        width: 1280,
        height: 720
      },
      pageType: "commerce",
      goalText: "提高购买按钮点击率",
      apiKey: "test-key",
      analyzer: async () => {
        throw new Error("AI 视觉接口返回 502。");
      }
    });

    expect(blueprint.diagnostics.analysisMode).toBe("fallback");
    expect(blueprint.diagnostics.warnings[0]).toContain("502");
  });
});
