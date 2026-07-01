import { appMotionPresets, type AppMotionPresetId } from "../preset/appMotionPresets";
import type { CompositionTiming, MotionDocument, MotionLayer } from "../schema/document";
import {
  assembleDraftFromSpecs,
  selectableLayers,
  type CompositionDraftGeneration,
  type DraftStepSpec,
  type GenerateCompositionDraftInput
} from "./generateCompositionDraft";

const PRESET_IDS = appMotionPresets.map((preset) => preset.id);
const PRESET_ID_SET = new Set<string>(PRESET_IDS);
const TIMING_VALUES: CompositionTiming[] = ["sequential", "parallel"];
const MAX_DELAY_MS = 5000;
const MAX_STEPS = 12;

export type LLMDraftStep = {
  presetId: AppMotionPresetId;
  layerId: string | null;
  timing: CompositionTiming;
  delayMs: number;
  reason: string;
};

export type LLMDraftPlan = {
  steps: LLMDraftStep[];
};

// 受控生成 schema:模型只能从 21 个规范 preset 中选,落到具体图层和时间轴,不能自由发参数。
export const draftPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          presetId: { type: "string", enum: PRESET_IDS },
          layerId: { type: ["string", "null"] },
          timing: { type: "string", enum: TIMING_VALUES },
          delayMs: { type: "number" },
          reason: { type: "string" }
        },
        required: ["presetId", "layerId", "timing", "delayMs", "reason"]
      }
    }
  },
  required: ["steps"]
} as const;

function clampDelay(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_DELAY_MS, Math.max(0, Math.round(value)));
}

function isLLMDraftStep(value: unknown): value is LLMDraftStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Record<string, unknown>;
  if (typeof step.presetId !== "string" || !PRESET_ID_SET.has(step.presetId)) return false;
  if (!(step.layerId === null || typeof step.layerId === "string")) return false;
  if (typeof step.timing !== "string" || !TIMING_VALUES.includes(step.timing as CompositionTiming)) return false;
  if (typeof step.delayMs !== "number" || !Number.isFinite(step.delayMs)) return false;
  if (typeof step.reason !== "string") return false;
  return true;
}

export function isLLMDraftPlan(value: unknown): value is LLMDraftPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  if (!Array.isArray(plan.steps)) return false;
  return plan.steps.every(isLLMDraftStep);
}

export function parseLLMDraftPlan(text: string): LLMDraftPlan | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isLLMDraftPlan(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 把模型给出的图层 id 解析为当前文档里真实可编辑的图层;找不到则降级为主图层(undefined)。
export function draftSpecsFromLLM(document: MotionDocument, plan: LLMDraftPlan): DraftStepSpec[] {
  const layers = selectableLayers(document);
  const byId = new Map<string, MotionLayer>(layers.map((layer) => [layer.id, layer]));

  return plan.steps.slice(0, MAX_STEPS).map((step) => {
    const layer = step.layerId ? byId.get(step.layerId) : undefined;
    return {
      presetId: step.presetId,
      ...(layer ? { layer } : {}),
      timing: step.timing,
      delayMs: clampDelay(step.delayMs),
      reason: step.reason.trim() || "AI 依据动效规范选择该片段。"
    };
  });
}

export function generateCompositionDraftFromLLM(
  input: GenerateCompositionDraftInput,
  plan: LLMDraftPlan
): CompositionDraftGeneration {
  return assembleDraftFromSpecs(input, draftSpecsFromLLM(input.document, plan));
}

// 注入 21 个 preset 的规范说明 + 当前可编辑图层,作为模型的 system 上下文。
export function buildDraftPromptContext(document: MotionDocument): string {
  const presetLines = appMotionPresets.map(
    (preset) =>
      `- ${preset.id}（${preset.label}｜场景:${preset.scene}｜槽位:${preset.slot}）：${preset.summary} 约束:${preset.guideline}`
  );

  const layers = selectableLayers(document);
  const layerLines = layers.length
    ? layers.map((layer) => `- ${layer.id}｜${layer.kind}｜${layer.name}${layer.content?.text ? `（文案:${layer.content.text}）` : ""}`)
    : ["- （当前没有可编辑图层，layerId 一律返回 null）"];

  return [
    "你是京东动效编排助手。根据用户的动效描述,从下列规范预设中挑选并编排时间轴片段。",
    "硬性规则:",
    "1. presetId 只能取下列预设之一,不得自创。",
    "2. layerId 必须取自下列图层列表;若该片段作用于主图层或无法确定,返回 null。",
    "3. timing 取 sequential(串行,接在前一片段之后)或 parallel(并行,与前一片段同时,用 delayMs 错峰)。",
    "4. delayMs 为非负毫秒,用于并行错峰;无需延迟填 0。",
    "5. reason 用简体中文一句话说明该片段的节奏意图。",
    "6. 通常 2-5 个片段;先让主体进场,再错峰带出次要元素,符合规范的进退场节奏。",
    "",
    "可用预设:",
    ...presetLines,
    "",
    "当前可编辑图层:",
    ...layerLines
  ].join("\n");
}
