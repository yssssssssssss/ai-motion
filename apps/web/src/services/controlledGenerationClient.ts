import type {
  ControlledGenerationPatch,
  GeneratedComponentValidationResult,
  GenerationPlan,
  MotionComponent
} from "@motion-tool/core";

export type ControlledGenerationClientResponse = {
  component: MotionComponent;
  patch: ControlledGenerationPatch;
  validation: GeneratedComponentValidationResult;
  plan: GenerationPlan;
};

async function readPayload(response: Response): Promise<Partial<ControlledGenerationClientResponse> & { error?: string }> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Partial<ControlledGenerationClientResponse> & { error?: string };
  } catch {
    return response.ok ? {} : { error: text.slice(0, 160) };
  }
}

export async function generateControlledComponent(input: {
  brief: string;
  components: MotionComponent[];
}): Promise<ControlledGenerationClientResponse> {
  const response = await fetch("/api/generation/controlled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(payload.error ?? `受控生成失败: ${response.status}`);
  }
  if (!payload.component || !payload.patch || !payload.validation || !payload.plan) {
    throw new Error("受控生成接口返回不完整");
  }

  return {
    component: payload.component,
    patch: payload.patch,
    validation: payload.validation,
    plan: payload.plan
  };
}
