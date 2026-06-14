import type { MotionBlueprint, MotionDocument, RecommendationSource } from "./schema";

export type MotionDocumentInput = {
  blueprint: MotionBlueprint;
  imageDataUrl?: string;
  generatedAt?: string;
};

export function createMotionDocument(input: MotionDocumentInput): MotionDocument {
  return {
    version: "0.1",
    kind: "motionlens-review",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    blueprint: input.blueprint,
    ...(input.imageDataUrl ? { assets: { imageDataUrl: input.imageDataUrl } } : {})
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertBlueprint(value: unknown): MotionBlueprint {
  if (!isObject(value)) throw new Error("评审 JSON 缺少 blueprint。");
  if (value.version !== "0.1") throw new Error("暂不支持该 Blueprint 版本。");
  if (!isObject(value.source)) throw new Error("Blueprint source 无效。");
  if (!isObject(value.context)) throw new Error("Blueprint context 无效。");
  if (!Array.isArray(value.elements)) throw new Error("Blueprint elements 无效。");
  if (!Array.isArray(value.opportunities)) throw new Error("Blueprint opportunities 无效。");
  const blueprint = value as MotionBlueprint;
  return {
    ...blueprint,
    opportunities: blueprint.opportunities.map((opportunity) => ({
      ...opportunity,
      recommendationSource: normalizeRecommendationSource(opportunity.recommendationSource)
    }))
  };
}

function normalizeRecommendationSource(value: unknown): RecommendationSource {
  return value === "llm-opportunity" ||
    value === "llm-candidate-rule-recommendation" ||
    value === "manual-pending" ||
    value === "local-fallback"
    ? value
    : "local-fallback";
}

export function parseMotionDocument(raw: unknown): MotionDocument {
  if (!isObject(raw)) throw new Error("评审 JSON 无效。");

  if (raw.kind === "motionlens-review") {
    if (raw.version !== "0.1") throw new Error("暂不支持该评审文档版本。");
    const blueprint = assertBlueprint(raw.blueprint);
    const assets = isObject(raw.assets) ? raw.assets : undefined;
    return {
      version: "0.1",
      kind: "motionlens-review",
      generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
      blueprint,
      ...(typeof assets?.imageDataUrl === "string" ? { assets: { imageDataUrl: assets.imageDataUrl } } : {})
    };
  }

  const legacyBlueprint = isObject(raw.blueprint) ? raw.blueprint : raw;
  const legacyAssets = isObject(raw.assets) ? raw.assets : undefined;
  return {
    version: "0.1",
    kind: "motionlens-review",
    generatedAt: new Date().toISOString(),
    blueprint: assertBlueprint(legacyBlueprint),
    ...(typeof legacyAssets?.imageDataUrl === "string"
      ? { assets: { imageDataUrl: legacyAssets.imageDataUrl } }
      : {})
  };
}
