import {
  isMotionPlanDraftResponse,
  normalizeMotionPlan,
  selectDistinctMotionPlanDraft,
  type MotionPlan,
  type ZeroLayerMorphSource
} from "@motion-copilot/core";

type Input = { prompt: string; source: ZeroLayerMorphSource };

type ResponsePayload = { mode?: unknown; message?: unknown; draft?: unknown };

export type GenerateZeroMotionPlanClientResult = {
  mode: "llm" | "fallback";
  message: string;
  motionPlan: MotionPlan;
};

function fallback(source: ZeroLayerMorphSource, message: string): GenerateZeroMotionPlanClientResult {
  return { mode: "fallback", message, motionPlan: normalizeMotionPlan(source.motionPlan) };
}

export async function generateZeroMotionPlanViaService(
  input: Input
): Promise<GenerateZeroMotionPlanClientResult> {
  const prompt = input.prompt.trim();
  if (!prompt) return fallback(input.source, "请输入动效意图，或继续使用当前方案。");
  try {
    const response = await fetch("/api/copilot/zero-motion-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, source: input.source })
    });
    if (!response.ok) return fallback(input.source, `模型请求失败(${response.status})，已保留当前方案。`);
    const payload = (await response.json()) as ResponsePayload;
    if (payload.mode !== "llm" || !isMotionPlanDraftResponse(payload.draft)) {
      return fallback(
        input.source,
        typeof payload.message === "string" ? payload.message : "已保留当前方案。"
      );
    }
    const selected = selectDistinctMotionPlanDraft(input.source.motionPlan, payload.draft.candidates);
    return {
      mode: selected.selectedCandidate != null ? "llm" : "fallback",
      message:
        selected.rejectionReason ??
        (typeof payload.message === "string" ? payload.message : "模型已更新动效方案。"),
      motionPlan: selected.motionPlan
    };
  } catch {
    return fallback(input.source, "模型请求失败，已保留当前方案。");
  }
}
