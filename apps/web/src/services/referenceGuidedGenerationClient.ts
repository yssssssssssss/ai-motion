import type {
  MotionComponent,
  ReferenceGuidedGenerationResult
} from "@motion-tool/core";

export type ReferenceGuidedGenerationClientResponse = ReferenceGuidedGenerationResult;

async function readPayload(response: Response): Promise<Partial<ReferenceGuidedGenerationClientResponse> & { error?: string }> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as Partial<ReferenceGuidedGenerationClientResponse> & { error?: string };
  } catch {
    return response.ok ? {} : { error: text.slice(0, 160) };
  }
}

export async function generateReferenceGuidedComponent(input: {
  brief: string;
  components: MotionComponent[];
}): Promise<ReferenceGuidedGenerationClientResponse> {
  const response = await fetch("/api/generation/reference-guided", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new Error(payload.error ?? `参考生成失败: ${response.status}`);
  }
  if (
    !payload.component ||
    !payload.intent ||
    !payload.intentV2 ||
    !payload.coverage ||
    !payload.validation ||
    !payload.references
  ) {
    throw new Error("参考生成接口返回不完整");
  }

  return {
    component: payload.component,
    intent: payload.intent,
    intentV2: payload.intentV2,
    coverage: payload.coverage,
    validation: payload.validation,
    references: payload.references
  };
}
