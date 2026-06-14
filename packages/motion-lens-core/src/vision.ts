import { classifyGoal, createBlueprintFromElements, createFallbackBlueprint } from "./blueprint";
import type { DesignElement, DesignElementKind, DesignSource, MotionBlueprint, Rect } from "./schema";
import type {
  BusinessGoal,
  DecisionFriction,
  DecisionStage,
  MotionAlternativeRecommendation,
  MotionKnowledgeRef,
  MotionOpportunity,
  MotionReviewEvidence,
  MotionStrategy,
  OpportunityPriority,
  RecommendedParams
} from "./schema";

const candidateKinds: DesignElementKind[] = [
  "button",
  "card",
  "modal",
  "form",
  "nav",
  "content",
  "feedback",
  "unknown"
];
const opportunityPriorities: OpportunityPriority[] = ["P0", "P1", "P2"];
const businessGoals: BusinessGoal[] = ["ctr", "cvr", "clarity", "trust", "feedback", "retention"];
const decisionStages: DecisionStage[] = ["discover", "understand", "evaluate", "decide", "act", "feedback"];
const decisionFrictions: DecisionFriction[] = [
  "attention",
  "understanding",
  "trust",
  "confidence",
  "motivation"
];
const motionStrategies: MotionStrategy[] = ["attention", "guidance", "trust", "feedback", "reward"];
const easingValues: RecommendedParams["easing"][] = [
  "standard",
  "decelerate",
  "accelerate",
  "sharp",
  "spring"
];
const repeatValues: RecommendedParams["repeat"][] = ["none", "limited", "loop"];

export const visionCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "opportunities"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "kind",
          "label",
          "text",
          "bounds",
          "confidence",
          "visualWeight",
          "interactiveLikelihood",
          "isDecorative"
        ],
        properties: {
          id: { type: ["string", "null"] },
          kind: { enum: candidateKinds },
          label: { type: "string" },
          text: { type: ["string", "null"] },
          bounds: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" }
            }
          },
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          visualWeight: { type: ["number", "null"], minimum: 0, maximum: 1 },
          interactiveLikelihood: { type: ["number", "null"], minimum: 0, maximum: 1 },
          isDecorative: { type: ["boolean", "null"] }
        }
      }
    },
    opportunities: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "elementId",
          "priority",
          "score",
          "confidence",
          "businessGoal",
          "decisionStage",
          "friction",
          "strategy",
          "patternId",
          "patternName",
          "reason",
          "reviewEvidence",
          "alternativeRecommendations",
          "risks",
          "recommendedParams",
          "knowledgeRefs"
        ],
        properties: {
          id: { type: ["string", "null"] },
          elementId: { type: "string" },
          priority: { enum: opportunityPriorities },
          score: { type: ["number", "null"], minimum: 0, maximum: 100 },
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          businessGoal: { enum: businessGoals },
          decisionStage: { enum: decisionStages },
          friction: { enum: decisionFrictions },
          strategy: { enum: motionStrategies },
          patternId: { type: "string" },
          patternName: { type: "string" },
          reason: { type: "string" },
          reviewEvidence: {
            type: "object",
            additionalProperties: false,
            required: [
              "whyThisMotion",
              "whyNotAlternatives",
              "noMotionAssessment",
              "differentiation",
              "trigger"
            ],
            properties: {
              whyThisMotion: { type: "string" },
              whyNotAlternatives: { type: "string" },
              noMotionAssessment: { type: "string" },
              differentiation: { type: "string" },
              trigger: { type: "string" }
            }
          },
          alternativeRecommendations: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["patternId", "patternName", "reason", "recommendedParams", "risks"],
              properties: {
                patternId: { type: "string" },
                patternName: { type: "string" },
                reason: { type: "string" },
                recommendedParams: {
                  type: "object",
                  additionalProperties: false,
                  required: ["durationMs", "delayMs", "easing", "transform", "repeat"],
                  properties: {
                    durationMs: { type: "number", minimum: 50, maximum: 800 },
                    delayMs: { type: ["number", "null"], minimum: 0, maximum: 600 },
                    easing: { enum: easingValues },
                    transform: { type: ["string", "null"] },
                    repeat: { enum: repeatValues }
                  }
                },
                risks: {
                  type: "array",
                  maxItems: 3,
                  items: { type: "string" }
                }
              }
            }
          },
          risks: {
            type: "array",
            maxItems: 5,
            items: { type: "string" }
          },
          recommendedParams: {
            type: "object",
            additionalProperties: false,
            required: ["durationMs", "delayMs", "easing", "transform", "repeat"],
            properties: {
              durationMs: { type: "number", minimum: 50, maximum: 800 },
              delayMs: { type: ["number", "null"], minimum: 0, maximum: 600 },
              easing: { enum: easingValues },
              transform: { type: ["string", "null"] },
              repeat: { enum: repeatValues }
            }
          },
          knowledgeRefs: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "title", "source", "pageRange"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                source: { type: "string" },
                pageRange: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
} as const;

export type VisionAnalyzerRequest = {
  source: DesignSource;
  goalText: string;
  pageType: string;
  candidateJsonSchema: typeof visionCandidateJsonSchema;
};

export type VisionAnalyzer = (request: VisionAnalyzerRequest) => Promise<unknown>;

export type VisionBlueprintInput = {
  source: DesignSource;
  goalText: string;
  pageType: string;
  apiKey?: string;
  analyzer?: VisionAnalyzer;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBounds(raw: unknown, source: DesignSource): Rect | undefined {
  if (!isObject(raw)) return undefined;
  const width = Math.round(clamp(numberOr(raw.width, 0), 8, source.width));
  const height = Math.round(clamp(numberOr(raw.height, 0), 8, source.height));
  const x = Math.round(clamp(numberOr(raw.x, 0), 0, source.width - width));
  const y = Math.round(clamp(numberOr(raw.y, 0), 0, source.height - height));
  if (width <= 0 || height <= 0) return undefined;
  return { x, y, width, height };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeKnowledgeRefs(raw: unknown): MotionKnowledgeRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObject)
    .map((item) => ({
      id: stringOr(item.id, "unknown"),
      title: stringOr(item.title, "未命名知识"),
      source: stringOr(item.source, "未知来源"),
      pageRange: stringOr(item.pageRange, "未标注")
    }))
    .slice(0, 4);
}

function normalizeParams(raw: unknown): RecommendedParams {
  const params = isObject(raw) ? raw : {};
  const delayMs = numberOr(params.delayMs, 0);
  const transform =
    typeof params.transform === "string" && params.transform.trim() ? params.transform.trim() : "";
  return {
    durationMs: Math.round(clamp(numberOr(params.durationMs, 220), 50, 800)),
    ...(delayMs > 0 ? { delayMs: Math.round(clamp(delayMs, 0, 600)) } : {}),
    easing: enumOr(params.easing, easingValues, "decelerate"),
    ...(transform ? { transform } : {}),
    repeat: enumOr(params.repeat, repeatValues, "none")
  };
}

function normalizeReviewEvidence(raw: unknown): MotionReviewEvidence | undefined {
  if (!isObject(raw)) return undefined;
  const evidence = {
    whyThisMotion: stringOr(raw.whyThisMotion, ""),
    whyNotAlternatives: stringOr(raw.whyNotAlternatives, ""),
    noMotionAssessment: stringOr(raw.noMotionAssessment, ""),
    differentiation: stringOr(raw.differentiation, ""),
    trigger: stringOr(raw.trigger, "")
  };
  return Object.values(evidence).some(Boolean) ? evidence : undefined;
}

function normalizeAlternativeRecommendations(raw: unknown): MotionAlternativeRecommendation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObject)
    .map((item) => ({
      patternId: stringOr(item.patternId, "model-alternative-motion"),
      patternName: stringOr(item.patternName, "备选动效"),
      reason: stringOr(item.reason, ""),
      recommendedParams: normalizeParams(item.recommendedParams),
      risks: Array.isArray(item.risks)
        ? item.risks.filter((risk) => typeof risk === "string").slice(0, 3)
        : []
    }))
    .filter((item) => item.patternName && item.reason)
    .slice(0, 3);
}

export function candidatesToElements(
  raw: unknown,
  source: DesignSource
): { elements: DesignElement[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!isObject(raw) || !Array.isArray(raw.candidates)) {
    return { elements: [], warnings: ["视觉模型返回格式无效，已降级为空候选。"] };
  }

  const elements: DesignElement[] = [];
  for (const [index, candidate] of raw.candidates.entries()) {
    if (!isObject(candidate)) {
      warnings.push(`第 ${index + 1} 个候选不是对象，已丢弃。`);
      continue;
    }
    if (!candidateKinds.includes(candidate.kind as DesignElementKind)) {
      warnings.push(`第 ${index + 1} 个候选 kind 无效，已丢弃。`);
      continue;
    }
    const bounds = normalizeBounds(candidate.bounds, source);
    if (!bounds) {
      warnings.push(`第 ${index + 1} 个候选 bounds 无效，已丢弃。`);
      continue;
    }

    const label =
      typeof candidate.label === "string" && candidate.label.trim()
        ? candidate.label.trim()
        : `候选 ${index + 1}`;
    elements.push({
      id:
        typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `vision-${index + 1}`,
      kind: candidate.kind as DesignElementKind,
      label,
      bounds,
      confidence: clamp(numberOr(candidate.confidence, 0.72), 0, 1),
      visualWeight: clamp(numberOr(candidate.visualWeight, 0.5), 0, 1),
      interactiveLikelihood: clamp(numberOr(candidate.interactiveLikelihood, 0.35), 0, 1),
      ...(typeof candidate.text === "string" ? { text: candidate.text } : {}),
      ...(candidate.isDecorative === true ? { isDecorative: true } : {})
    });
  }

  return { elements, warnings };
}

export function modelOpportunitiesToBlueprintOpportunities(
  raw: unknown,
  elements: DesignElement[]
): { opportunities: MotionOpportunity[]; warnings: string[] } {
  const warnings =
    isObject(raw) && Array.isArray(raw.warnings)
      ? raw.warnings.filter((warning): warning is string => typeof warning === "string")
      : [];
  if (!isObject(raw) || !Array.isArray(raw.opportunities)) {
    return { opportunities: [], warnings: ["视觉模型未返回完整机会点。"] };
  }

  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const opportunities: MotionOpportunity[] = [];
  for (const [index, item] of raw.opportunities.entries()) {
    if (!isObject(item)) {
      warnings.push(`第 ${index + 1} 个机会点不是对象，已丢弃。`);
      continue;
    }

    const elementId = stringOr(item.elementId, "");
    const element = elementsById.get(elementId);
    if (!element || element.isDecorative) {
      warnings.push(`第 ${index + 1} 个机会点未引用有效元素，已丢弃。`);
      continue;
    }

    const reason = stringOr(item.reason, "");
    const patternName = stringOr(item.patternName, "");
    if (!reason || !patternName) {
      warnings.push(`第 ${index + 1} 个机会点缺少理由或推荐动效，已丢弃。`);
      continue;
    }

    const reviewEvidence = normalizeReviewEvidence(item.reviewEvidence);
    const alternativeRecommendations = normalizeAlternativeRecommendations(item.alternativeRecommendations);
    opportunities.push({
      id: stringOr(item.id, `${elementId}-${stringOr(item.patternId, "model-motion")}`),
      elementId,
      recommendationSource: "llm-opportunity",
      priority: enumOr(item.priority, opportunityPriorities, "P1"),
      score: Math.round(clamp(numberOr(item.score, 60), 0, 100)),
      confidence: clamp(numberOr(item.confidence, element.confidence), 0, 1),
      businessGoal: enumOr(item.businessGoal, businessGoals, "ctr"),
      decisionStage: enumOr(item.decisionStage, decisionStages, "decide"),
      friction: enumOr(item.friction, decisionFrictions, "attention"),
      strategy: enumOr(item.strategy, motionStrategies, "attention"),
      patternId: stringOr(item.patternId, "model-motion"),
      patternName,
      reason,
      ...(reviewEvidence ? { reviewEvidence } : {}),
      ...(alternativeRecommendations.length > 0 ? { alternativeRecommendations } : {}),
      risks: Array.isArray(item.risks)
        ? item.risks.filter((risk) => typeof risk === "string").slice(0, 5)
        : [],
      recommendedParams: normalizeParams(item.recommendedParams),
      knowledgeRefs: normalizeKnowledgeRefs(item.knowledgeRefs)
    });
  }

  return {
    opportunities: opportunities.sort((left, right) => right.score - left.score).slice(0, 5),
    warnings
  };
}

export async function createBlueprintFromVision(input: VisionBlueprintInput): Promise<MotionBlueprint> {
  if (!input.apiKey || !input.analyzer) {
    const blueprint = createFallbackBlueprint(input);
    return {
      ...blueprint,
      diagnostics: {
        ...blueprint.diagnostics,
        warnings: ["未配置视觉模型或 API key，已使用 fallback。"]
      }
    };
  }

  let raw: unknown;
  try {
    raw = await input.analyzer({
      source: input.source,
      goalText: input.goalText,
      pageType: input.pageType,
      candidateJsonSchema: visionCandidateJsonSchema
    });
  } catch (error) {
    const blueprint = createFallbackBlueprint(input);
    return {
      ...blueprint,
      diagnostics: {
        ...blueprint.diagnostics,
        warnings: [
          error instanceof Error
            ? `AI 视觉模型调用失败：${error.message}`
            : "AI 视觉模型调用失败，已使用 fallback。"
        ]
      }
    };
  }
  const { elements, warnings } = candidatesToElements(raw, input.source);

  if (elements.length === 0) {
    const blueprint = createFallbackBlueprint(input);
    return {
      ...blueprint,
      diagnostics: {
        ...blueprint.diagnostics,
        warnings:
          warnings.length > 0
            ? ["AI 视觉模型未返回有效候选，已使用 fallback。", ...warnings]
            : ["AI 视觉模型未识别到可评审元素，已使用 fallback。"]
      }
    };
  }

  const modelOpportunities = modelOpportunitiesToBlueprintOpportunities(raw, elements);
  if (modelOpportunities.opportunities.length > 0) {
    return {
      version: "0.1",
      source: input.source,
      context: {
        pageType: input.pageType,
        goalText: input.goalText,
        inferredGoal: classifyGoal(input.goalText, input.pageType)
      },
      elements,
      opportunities: modelOpportunities.opportunities,
      diagnostics: {
        warnings:
          warnings.length > 0 || modelOpportunities.warnings.length > 0
            ? [...warnings, ...modelOpportunities.warnings]
            : ["AI 已基于视觉稿件和知识库生成机会点。"],
        noMotionSuggestions: [],
        analysisMode: "hybrid"
      }
    };
  }

  return createBlueprintFromElements({
    source: input.source,
    goalText: input.goalText,
    pageType: input.pageType,
    elements,
    analysisMode: "hybrid",
    recommendationSource: "llm-candidate-rule-recommendation",
    warnings:
      warnings.length > 0 || modelOpportunities.warnings.length > 0
        ? [...warnings, ...modelOpportunities.warnings, "AI 仅返回元素，机会点由本地规则生成。"]
        : ["AI 仅返回元素，机会点由本地规则生成。"]
  });
}
