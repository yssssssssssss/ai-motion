import {
  generateCompositionDraft,
  generateCompositionDraftFromLLM,
  type CompositionDraftGeneration,
  type CompositionStep,
  type LLMDraftPlan,
  type MotionDocument
} from "@motion-copilot/core";

export type DraftGenerationMode = "llm" | "fallback";

export type DraftGenerationResult = {
  mode: DraftGenerationMode;
  message: string;
  draft: CompositionDraftGeneration;
};

type GenerateDraftClientInput = {
  prompt: string;
  document: MotionDocument;
  existingSteps?: CompositionStep[];
};

type GenerateDraftApiResponse = {
  mode?: unknown;
  message?: unknown;
  plan?: unknown;
};

const CACHE_CAPACITY = 16;
const cache = new Map<string, LLMDraftPlan>();

function documentFingerprint(document: MotionDocument): string {
  const layers = document.layers
    .filter((layer) => layer.editable && !layer.hidden && !layer.locked)
    .map((layer) => `${layer.id}:${layer.kind}`)
    .join(",");
  return `${document.selectedLayerId ?? "none"}|${layers}`;
}

function cacheKey(input: GenerateDraftClientInput): string {
  return `${input.prompt.trim()}::${documentFingerprint(input.document)}`;
}

function readCache(key: string): LLMDraftPlan | undefined {
  const value = cache.get(key);
  if (!value) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function writeCache(key: string, value: LLMDraftPlan): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_CAPACITY) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function clearGenerateDraftCache(): void {
  cache.clear();
}

function isLLMPlanResponse(value: GenerateDraftApiResponse): value is { mode: "llm"; plan: LLMDraftPlan; message?: string } {
  return value.mode === "llm" && Boolean(value.plan) && Array.isArray((value.plan as { steps?: unknown }).steps);
}

function localFallback(input: GenerateDraftClientInput, message: string): DraftGenerationResult {
  return {
    mode: "fallback",
    message,
    draft: generateCompositionDraft({
      prompt: input.prompt,
      document: input.document,
      ...(input.existingSteps ? { existingSteps: input.existingSteps } : {})
    })
  };
}

function assembleFromPlan(input: GenerateDraftClientInput, plan: LLMDraftPlan, message: string): DraftGenerationResult {
  const draft = generateCompositionDraftFromLLM(
    {
      prompt: input.prompt,
      document: input.document,
      ...(input.existingSteps ? { existingSteps: input.existingSteps } : {})
    },
    plan
  );
  // 模型命中的预设全部已存在或被去重时,退回本地匹配,保证一定有可用产出。
  if (draft.steps.length === 0) return localFallback(input, "模型未给出新片段,已使用本地匹配。");
  return { mode: "llm", message, draft };
}

export async function generateDraftViaService(input: GenerateDraftClientInput): Promise<DraftGenerationResult> {
  const prompt = input.prompt.trim();
  if (!prompt) return localFallback(input, "请输入动效描述以生成编排。");

  const key = cacheKey(input);
  const cached = readCache(key);
  if (cached) return assembleFromPlan(input, cached, "已复用模型生成结果。");

  try {
    const response = await fetch("/api/copilot/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, document: input.document })
    });

    if (!response.ok) throw new Error(`Generate draft failed: ${response.status}`);
    const payload = (await response.json()) as GenerateDraftApiResponse;

    if (isLLMPlanResponse(payload)) {
      writeCache(key, payload.plan);
      return assembleFromPlan(input, payload.plan, typeof payload.message === "string" ? payload.message : "模型已生成编排草稿。");
    }

    return localFallback(input, typeof payload.message === "string" ? payload.message : "已使用本地匹配。");
  } catch {
    return localFallback(input, "模型请求失败,已使用本地匹配。");
  }
}
