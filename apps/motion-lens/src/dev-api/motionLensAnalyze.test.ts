import { describe, expect, it, vi } from "vitest";
import { analyzeMotionLensDraft, responseEndpointCandidates } from "./motionLensAnalyze";

const source = {
  kind: "image" as const,
  id: "upload-test",
  name: "upload.png",
  width: 1200,
  height: 800
};

describe("MotionLens AI analysis API", () => {
  it("uses the project default gpt-5.5 model for vision analysis", async () => {
    const requestBodies: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(async (_url, init) => {
      if (typeof init?.body === "string") requestBodies.push(init.body);
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            candidates: [
              {
                id: "buy-cta",
                kind: "button",
                label: "立即购买",
                text: "立即购买",
                bounds: { x: 820, y: 680, width: 180, height: 56 },
                confidence: 0.92,
                visualWeight: 0.48,
                interactiveLikelihood: 0.96,
                isDecorative: false
              }
            ],
            opportunities: [
              {
                id: "buy-cta-model-highlight",
                elementId: "buy-cta",
                priority: "P0",
                score: 86,
                confidence: 0.9,
                businessGoal: "cvr",
                decisionStage: "decide",
                friction: "attention",
                strategy: "attention",
                patternId: "model-cta-highlight",
                patternName: "模型推荐 CTA 强调",
                reason: "主购买按钮位于转化路径关键位置，但视觉权重偏低。",
                reviewEvidence: {
                  whyThisMotion: "按钮是当前转化路径的关键动作，短促强调能提升首轮发现。",
                  whyNotAlternatives: "不使用加购飞行动效，因为该按钮语义是立即购买，不是加入购物车。",
                  noMotionAssessment: "不建议完全静止，因为当前视觉权重低于主转化入口预期。",
                  differentiation: "同屏其他内容区保持静态，只突出主购买按钮。",
                  trigger: "首屏进入后播放一次，用户返回页面时不循环。"
                },
                risks: ["不要循环播放。"],
                recommendedParams: {
                  durationMs: 220,
                  delayMs: null,
                  easing: "decelerate",
                  transform: "scale(1.02)",
                  repeat: "none"
                },
                alternativeRecommendations: [
                  {
                    patternId: "button-press-feedback",
                    patternName: "按钮压感确认",
                    reason: "如果按钮已足够醒目，可改为点击后的确定性反馈。",
                    recommendedParams: {
                      durationMs: 160,
                      delayMs: null,
                      easing: "spring",
                      transform: "scale(0.98)",
                      repeat: "none"
                    },
                    risks: ["不要替代主路径可见性。"]
                  },
                  {
                    patternId: "cta-one-shot-highlight",
                    patternName: "CTA 一次性强调",
                    reason: "如果页面首屏竞争较强，可在进入后播放一次。",
                    recommendedParams: {
                      durationMs: 240,
                      delayMs: 120,
                      easing: "decelerate",
                      transform: "scale(1.04)",
                      repeat: "none"
                    },
                    risks: ["不要循环播放。"]
                  }
                ],
                knowledgeRefs: [
                  {
                    id: "principle-motion-value",
                    title: "动效价值三分法",
                    source: "模型写错的来源",
                    pageRange: "999"
                  },
                  {
                    id: "hallucinated-ref",
                    title: "不存在的规则",
                    source: "模型编造来源",
                    pageRange: "99"
                  }
                ]
              }
            ]
          })
        }),
        { status: 200 }
      );
    });

    const result = await analyzeMotionLensDraft(
      {
        source,
        imageDataUrl: "data:image/png;base64,abc",
        goalText: "提高购买按钮点击率",
        pageType: "commerce"
      },
      {
        apiKey: "test-key",
        fetchImpl
      }
    );

    const body = JSON.parse(requestBodies[0] ?? "{}") as {
      model: string;
      input: Array<{
        role: string;
        content:
          | string
          | Array<{
              type: string;
              text?: string;
            }>;
      }>;
      text?: {
        format?: {
          schema?: unknown;
        };
      };
    };
    const userContent = body.input.find((item) => item.role === "user")?.content;
    const textPayload =
      Array.isArray(userContent) && typeof userContent[0]?.text === "string"
        ? (JSON.parse(userContent[0].text) as {
            knowledgeContext?: Array<{ source: string; title: string }>;
            outputContract?: string;
          })
        : {};
    const schema = body.text?.format?.schema as {
      properties?: {
        opportunities?: {
          items?: {
            required?: string[];
          };
        };
      };
    };

    expect(body.model).toBe("gpt-5.5");
    expect(textPayload.knowledgeContext?.some((item) => item.source.includes("动效"))).toBe(true);
    expect(textPayload.knowledgeContext?.some((item) => item.source.includes("人文共情"))).toBe(true);
    expect(textPayload.outputContract).toContain("为什么不是其他动效");
    expect(textPayload.outputContract).toContain("是否不推荐动效");
    expect(textPayload.outputContract).toContain("alternativeRecommendations");
    expect(schema.properties?.opportunities?.items?.required).toContain("reviewEvidence");
    expect(schema.properties?.opportunities?.items?.required).toContain("alternativeRecommendations");
    expect(result.mode).toBe("llm");
    expect(result.blueprint.elements[0]?.label).toBe("立即购买");
    expect(result.blueprint.opportunities[0]?.elementId).toBe("buy-cta");
    expect(result.blueprint.opportunities[0]?.patternName).toBe("模型推荐 CTA 强调");
    expect(result.blueprint.opportunities[0]?.recommendationSource).toBe("llm-opportunity");
    expect(result.blueprint.opportunities[0]?.knowledgeRefs?.map((item) => item.id)).toEqual([
      "principle-motion-value"
    ]);
    expect(result.blueprint.opportunities[0]?.knowledgeRefs?.[0]?.source).toBe("动效设计规范系统（ing~）");
    expect(result.blueprint.opportunities[0]?.knowledgeRefs?.[0]?.pageRange).toBe("1");
    expect(result.blueprint.opportunities[0]?.reviewEvidence?.whyNotAlternatives).toContain("加购飞行动效");
    expect(
      result.blueprint.opportunities[0]?.alternativeRecommendations?.map((item) => item.patternName)
    ).toEqual(["按钮压感确认", "CTA 一次性强调"]);
  });

  it("falls back when no API key is configured", async () => {
    const result = await analyzeMotionLensDraft({
      source,
      imageDataUrl: "data:image/png;base64,abc",
      goalText: "提高购买按钮点击率",
      pageType: "commerce"
    });

    expect(result.mode).toBe("fallback");
    expect(result.blueprint.diagnostics.analysisMode).toBe("fallback");
    expect(result.blueprint.elements).toEqual([]);
    expect(result.message).toContain("未配置视觉模型");
  });

  it("drops model opportunities without valid knowledge references", async () => {
    const result = await analyzeMotionLensDraft(
      {
        source,
        imageDataUrl: "data:image/png;base64,abc",
        goalText: "提高购买按钮点击率",
        pageType: "commerce"
      },
      {
        apiKey: "test-key",
        fetchImpl: vi.fn(async () => {
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                candidates: [
                  {
                    id: "buy-cta",
                    kind: "button",
                    label: "立即购买",
                    text: "立即购买",
                    bounds: { x: 820, y: 680, width: 180, height: 56 },
                    confidence: 0.92,
                    visualWeight: 0.48,
                    interactiveLikelihood: 0.96,
                    isDecorative: false
                  }
                ],
                opportunities: [
                  {
                    id: "buy-cta-unsupported",
                    elementId: "buy-cta",
                    priority: "P0",
                    score: 90,
                    confidence: 0.9,
                    businessGoal: "cvr",
                    decisionStage: "decide",
                    friction: "attention",
                    strategy: "attention",
                    patternId: "unsupported-pattern",
                    patternName: "无依据模型推荐",
                    reason: "这条建议没有真实知识库依据。",
                    risks: ["无法追溯。"],
                    recommendedParams: {
                      durationMs: 220,
                      delayMs: null,
                      easing: "decelerate",
                      transform: "scale(1.02)",
                      repeat: "none"
                    },
                    knowledgeRefs: [
                      {
                        id: "hallucinated-ref",
                        title: "不存在的规则",
                        source: "模型编造来源",
                        pageRange: "99"
                      }
                    ]
                  }
                ]
              })
            }),
            { status: 200 }
          );
        })
      }
    );

    expect(result.mode).toBe("llm");
    expect(result.blueprint.opportunities[0]?.patternName).not.toBe("无依据模型推荐");
    expect(result.blueprint.opportunities[0]?.recommendationSource).toBe("llm-candidate-rule-recommendation");
    expect(result.blueprint.opportunities[0]?.knowledgeRefs).toBeUndefined();
    expect(result.blueprint.diagnostics.warnings.join("\n")).toContain("知识依据不足");
    expect(result.blueprint.diagnostics.warnings.join("\n")).toContain("AI 仅返回元素");
  });

  it("labels candidate-only model output as AI detected and rule recommended", async () => {
    const result = await analyzeMotionLensDraft(
      {
        source,
        imageDataUrl: "data:image/png;base64,abc",
        goalText: "提升加购转化",
        pageType: "product-detail"
      },
      {
        apiKey: "test-key",
        fetchImpl: vi.fn(async () => {
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                candidates: [
                  {
                    id: "cart-button",
                    kind: "button",
                    label: "加入购物车",
                    text: "加入购物车",
                    bounds: { x: 760, y: 700, width: 220, height: 56 },
                    confidence: 0.92,
                    visualWeight: 0.58,
                    interactiveLikelihood: 0.98,
                    isDecorative: false
                  }
                ],
                opportunities: []
              })
            }),
            { status: 200 }
          );
        })
      }
    );

    expect(result.mode).toBe("llm");
    expect(result.blueprint.opportunities[0]?.patternName).toBe("加购飞行动效");
    expect(result.blueprint.opportunities[0]?.recommendationSource).toBe("llm-candidate-rule-recommendation");
    expect(result.blueprint.diagnostics.warnings.join("\n")).toContain("AI 仅返回元素");
  });

  it("passes manual seed elements into the model request", async () => {
    const requestBodies: string[] = [];
    const fetchImpl: typeof fetch = vi.fn(async (_url, init) => {
      if (typeof init?.body === "string") requestBodies.push(init.body);
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            candidates: [
              {
                id: "manual-button",
                kind: "button",
                label: "主按钮",
                text: null,
                bounds: { x: 400, y: 620, width: 180, height: 56 },
                confidence: 0.96,
                visualWeight: 0.52,
                interactiveLikelihood: 1,
                isDecorative: false
              }
            ],
            opportunities: [
              {
                id: "manual-button-confirm",
                elementId: "manual-button",
                priority: "P0",
                score: 82,
                confidence: 0.92,
                businessGoal: "ctr",
                decisionStage: "decide",
                friction: "confidence",
                strategy: "feedback",
                patternId: "button-press-feedback",
                patternName: "按钮压感确认",
                reason: "用户框选区域是主操作按钮，需要明确点击反馈。",
                risks: ["反馈幅度保持克制。"],
                recommendedParams: {
                  durationMs: 160,
                  delayMs: null,
                  easing: "spring",
                  transform: "scale(0.98)",
                  repeat: "none"
                },
                knowledgeRefs: [
                  {
                    id: "pattern-button-press-feedback",
                    title: "按钮压感确认",
                    source: "动效设计规范系统（ing~）",
                    pageRange: "4-5, 10"
                  }
                ]
              }
            ]
          })
        }),
        { status: 200 }
      );
    });

    const result = await analyzeMotionLensDraft(
      {
        source,
        imageDataUrl: "data:image/png;base64,abc",
        goalText: "提高主按钮点击反馈",
        pageType: "commerce",
        seedElements: [
          {
            id: "manual-button",
            kind: "button",
            label: "主按钮",
            text: "人工标注类型：按钮/CTA",
            bounds: { x: 400, y: 620, width: 180, height: 56 },
            confidence: 1,
            visualWeight: 0.5,
            interactiveLikelihood: 1
          }
        ]
      },
      {
        apiKey: "test-key",
        fetchImpl
      }
    );

    const body = JSON.parse(requestBodies[0] ?? "{}") as {
      input: Array<{
        role: string;
        content: Array<{ type: string; text?: string }> | string;
      }>;
    };
    const userContent = body.input.find((item) => item.role === "user")?.content;
    const textPayload =
      Array.isArray(userContent) && typeof userContent[0]?.text === "string"
        ? (JSON.parse(userContent[0].text) as {
            seedElements?: Array<{ id: string }>;
            seedElementHints?: Array<{ id: string; manualAnnotation?: string }>;
            outputContract?: string;
          })
        : {};

    expect(textPayload.seedElements?.[0]?.id).toBe("manual-button");
    expect(textPayload.outputContract).toContain("只围绕 seedElements 输出机会点");
    expect(textPayload.outputContract).toContain("不要额外扩展整图机会点");
    expect(textPayload.seedElementHints?.[0]).toEqual({
      id: "manual-button",
      kind: "button",
      label: "主按钮",
      manualAnnotation: "按钮/CTA"
    });
    expect(result.blueprint.opportunities[0]?.patternName).toBe("按钮压感确认");
  });

  it("warns when model recommendations are homogeneous across different elements", async () => {
    const result = await analyzeMotionLensDraft(
      {
        source,
        imageDataUrl: "data:image/png;base64,abc",
        goalText: "提升页面转化",
        pageType: "commerce"
      },
      {
        apiKey: "test-key",
        fetchImpl: vi.fn(async () => {
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                candidates: [
                  {
                    id: "cta",
                    kind: "button",
                    label: "立即购买",
                    text: null,
                    bounds: { x: 820, y: 680, width: 180, height: 56 },
                    confidence: 0.92,
                    visualWeight: 0.48,
                    interactiveLikelihood: 0.96,
                    isDecorative: false
                  },
                  {
                    id: "card",
                    kind: "card",
                    label: "商品卡片",
                    text: null,
                    bounds: { x: 80, y: 220, width: 260, height: 220 },
                    confidence: 0.86,
                    visualWeight: 0.62,
                    interactiveLikelihood: 0.62,
                    isDecorative: false
                  },
                  {
                    id: "content",
                    kind: "content",
                    label: "权益内容",
                    text: null,
                    bounds: { x: 420, y: 260, width: 320, height: 180 },
                    confidence: 0.82,
                    visualWeight: 0.46,
                    interactiveLikelihood: 0.2,
                    isDecorative: false
                  }
                ],
                opportunities: ["cta", "card", "content"].map((elementId, index) => ({
                  id: `${elementId}-same-pattern`,
                  elementId,
                  priority: index === 0 ? "P0" : "P1",
                  score: 90 - index,
                  confidence: 0.88,
                  businessGoal: "cvr",
                  decisionStage: "decide",
                  friction: "attention",
                  strategy: "attention",
                  patternId: "model-same-pattern",
                  patternName: "统一卡片强调",
                  reason: "模型给出了同质化推荐。",
                  risks: ["需要复核。"],
                  recommendedParams: {
                    durationMs: 220,
                    delayMs: null,
                    easing: "decelerate",
                    transform: "scale(1.02)",
                    repeat: "none"
                  },
                  knowledgeRefs: [
                    {
                      id: "principle-motion-value",
                      title: "动效价值三分法",
                      source: "动效设计规范系统（ing~）",
                      pageRange: "1"
                    }
                  ]
                }))
              })
            }),
            { status: 200 }
          );
        })
      }
    );

    expect(result.mode).toBe("llm");
    expect(result.blueprint.opportunities).toHaveLength(3);
    expect(result.blueprint.diagnostics.warnings.join("\n")).toContain("推荐同质化");
  });

  it("falls back with a useful warning when the model gateway fails", async () => {
    const result = await analyzeMotionLensDraft(
      {
        source,
        imageDataUrl: "data:image/png;base64,abc",
        goalText: "提高购买按钮点击率",
        pageType: "commerce"
      },
      {
        apiKey: "test-key",
        fetchImpl: vi.fn(async () => new Response("bad gateway", { status: 502 }))
      }
    );

    expect(result.mode).toBe("fallback");
    expect(result.message).toContain("502");
    expect(result.blueprint.diagnostics.analysisMode).toBe("fallback");
  });

  it("maps compressed analysis coordinates back to the original image source", async () => {
    const requestBodies: string[] = [];
    const result = await analyzeMotionLensDraft(
      {
        source: { ...source, width: 1280, height: 2768 },
        analysisSource: { ...source, id: "analysis", width: 740, height: 1600 },
        imageDataUrl: "data:image/png;base64,original",
        analysisImageDataUrl: "data:image/jpeg;base64,analysis",
        goalText: "提高购买按钮点击率",
        pageType: "commerce",
        seedElements: [
          {
            id: "manual-cta",
            kind: "button",
            label: "手动主按钮",
            bounds: { x: 640, y: 1384, width: 173, height: 87 },
            confidence: 1,
            visualWeight: 0.5,
            interactiveLikelihood: 1
          }
        ]
      },
      {
        apiKey: "test-key",
        fetchImpl: vi.fn(async (_url, init) => {
          if (typeof init?.body === "string") requestBodies.push(init.body);
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                candidates: [
                  {
                    id: "cta",
                    kind: "button",
                    label: "立即购买",
                    text: null,
                    bounds: { x: 370, y: 800, width: 100, height: 50 },
                    confidence: 0.9,
                    visualWeight: 0.5,
                    interactiveLikelihood: 0.95,
                    isDecorative: false
                  }
                ]
              })
            }),
            { status: 200 }
          );
        })
      }
    );

    expect(result.mode).toBe("llm");
    expect(result.blueprint.source.width).toBe(1280);
    expect(result.blueprint.elements[0]?.bounds).toEqual({ x: 640, y: 1384, width: 173, height: 87 });

    const body = JSON.parse(requestBodies[0] ?? "{}") as {
      input: Array<{ role: string; content: Array<{ type: string; text?: string }> | string }>;
    };
    const userContent = body.input.find((item) => item.role === "user")?.content;
    const textPayload =
      Array.isArray(userContent) && typeof userContent[0]?.text === "string"
        ? (JSON.parse(userContent[0].text) as {
            seedElements?: Array<{ bounds: { x: number; y: number; width: number; height: number } }>;
          })
        : {};
    expect(textPayload.seedElements?.[0]?.bounds).toEqual({ x: 370, y: 800, width: 100, height: 50 });
  });

  it("matches existing response endpoint fallback behavior", () => {
    expect(responseEndpointCandidates("https://modelservice.jdcloud.com/v1/responses")).toEqual([
      "https://modelservice.jdcloud.com/v1/responses"
    ]);
    expect(responseEndpointCandidates("https://otokapi.com")).toEqual([
      "https://otokapi.com/responses",
      "https://otokapi.com/v1/responses"
    ]);
    expect(responseEndpointCandidates("https://otokapi.com/v1")).toEqual([
      "https://otokapi.com/v1/responses"
    ]);
  });
});
