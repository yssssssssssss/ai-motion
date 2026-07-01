import { describe, expect, it } from "vitest";
import {
  appMotionPresets,
  buildDraftPromptContext,
  createDefaultDocument,
  draftPlanSchema,
  draftSpecsFromLLM,
  generateCompositionDraftFromLLM,
  isLLMDraftPlan,
  parseLLMDraftPlan,
  type LLMDraftPlan
} from "../src";

function plan(steps: LLMDraftPlan["steps"]): LLMDraftPlan {
  return { steps };
}

describe("draftPlanSchema", () => {
  it("restricts presetId enum to the registered presets", () => {
    const presetSchema = draftPlanSchema.properties.steps.items.properties.presetId;
    expect(presetSchema.enum).toEqual(appMotionPresets.map((preset) => preset.id));
    expect(draftPlanSchema.properties.steps.items.required).toEqual([
      "presetId",
      "layerId",
      "timing",
      "delayMs",
      "reason"
    ]);
  });
});

describe("isLLMDraftPlan", () => {
  it("accepts a well-formed plan", () => {
    expect(
      isLLMDraftPlan(
        plan([{ presetId: "enter-screen", layerId: "modal-title", timing: "sequential", delayMs: 0, reason: "进场" }])
      )
    ).toBe(true);
  });

  it("accepts null layerId", () => {
    expect(
      isLLMDraftPlan(plan([{ presetId: "enter-screen", layerId: null, timing: "parallel", delayMs: 40, reason: "x" }]))
    ).toBe(true);
  });

  it("rejects unknown presetId", () => {
    expect(
      isLLMDraftPlan(plan([{ presetId: "not-a-preset", layerId: null, timing: "sequential", delayMs: 0, reason: "x" } as never]))
    ).toBe(false);
  });

  it("rejects invalid timing", () => {
    expect(
      isLLMDraftPlan(plan([{ presetId: "enter-screen", layerId: null, timing: "diagonal", delayMs: 0, reason: "x" } as never]))
    ).toBe(false);
  });

  it("rejects non-array steps and non-objects", () => {
    expect(isLLMDraftPlan({ steps: "nope" })).toBe(false);
    expect(isLLMDraftPlan(null)).toBe(false);
    expect(isLLMDraftPlan({})).toBe(false);
  });
});

describe("parseLLMDraftPlan", () => {
  it("parses a valid JSON plan", () => {
    const text = JSON.stringify(
      plan([{ presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "焦点" }])
    );
    expect(parseLLMDraftPlan(text)?.steps).toHaveLength(1);
  });

  it("returns null for malformed JSON", () => {
    expect(parseLLMDraftPlan("{not json")).toBeNull();
  });

  it("returns null for valid JSON that fails the type guard", () => {
    expect(parseLLMDraftPlan(JSON.stringify({ steps: [{ presetId: "ghost" }] }))).toBeNull();
  });
});

describe("draftSpecsFromLLM", () => {
  it("resolves real editable layers and drops non-editable/unknown ids to primary", () => {
    const document = createDefaultDocument("modal");
    const specs = draftSpecsFromLLM(
      document,
      plan([
        { presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "a" },
        { presetId: "enter-screen", layerId: "modal-container", timing: "parallel", delayMs: 50, reason: "b" },
        { presetId: "enter-screen", layerId: "ghost-layer", timing: "parallel", delayMs: 60, reason: "c" }
      ])
    );
    expect(specs[0]?.layer?.id).toBe("modal-image");
    // modal-container 不可编辑 -> undefined;ghost-layer 不存在 -> undefined
    expect(specs[1]?.layer).toBeUndefined();
    expect(specs[2]?.layer).toBeUndefined();
  });

  it("clamps negative and oversized delays", () => {
    const document = createDefaultDocument("modal");
    const specs = draftSpecsFromLLM(
      document,
      plan([
        { presetId: "enter-screen", layerId: null, timing: "parallel", delayMs: -10, reason: "x" },
        { presetId: "enter-screen", layerId: null, timing: "parallel", delayMs: 999999, reason: "y" }
      ])
    );
    expect(specs[0]?.delayMs).toBe(0);
    expect(specs[1]?.delayMs).toBe(5000);
  });

  it("falls back to a default reason when the model returns blank", () => {
    const document = createDefaultDocument("modal");
    const specs = draftSpecsFromLLM(
      document,
      plan([{ presetId: "enter-screen", layerId: null, timing: "sequential", delayMs: 0, reason: "   " }])
    );
    expect(specs[0]?.reason).not.toBe("");
  });
});

describe("generateCompositionDraftFromLLM", () => {
  it("assembles composition steps from a model plan", () => {
    const document = createDefaultDocument("modal");
    const result = generateCompositionDraftFromLLM(
      { prompt: "弹窗进场", document },
      plan([
        { presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "焦点容器" },
        { presetId: "enter-screen", layerId: "modal-title", timing: "parallel", delayMs: 80, reason: "标题错峰" }
      ])
    );
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.presetId).toBe("modal-feedback");
    expect(result.steps[0]?.layerId).toBe("modal-image");
    expect(result.explanations[0]?.reason).toBe("焦点容器");
    expect(result.steps[1]?.timing).toBe("parallel");
  });

  it("reports an empty draft when the plan has no steps", () => {
    const document = createDefaultDocument("modal");
    const result = generateCompositionDraftFromLLM({ prompt: "空", document }, plan([]));
    expect(result.steps).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("dedups against existing steps via conflict key", () => {
    const document = createDefaultDocument("modal");
    const first = generateCompositionDraftFromLLM(
      { prompt: "一次", document },
      plan([{ presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "a" }])
    );
    const second = generateCompositionDraftFromLLM(
      { prompt: "二次", document, existingSteps: first.steps },
      plan([{ presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "b" }])
    );
    expect(second.steps).toHaveLength(0);
    expect(second.corrections.length).toBeGreaterThan(0);
  });
});

describe("buildDraftPromptContext", () => {
  it("injects every preset id and editable layer ids", () => {
    const document = createDefaultDocument("modal");
    const context = buildDraftPromptContext(document);
    for (const preset of appMotionPresets) {
      expect(context).toContain(preset.id);
    }
    expect(context).toContain("modal-title");
    expect(context).not.toContain("modal-container"); // 不可编辑图层不应出现
  });

  it("notes when there is no editable layer", () => {
    const document = createDefaultDocument("modal");
    const locked = { ...document, layers: document.layers.map((layer) => ({ ...layer, editable: false })) };
    expect(buildDraftPromptContext(locked)).toContain("layerId 一律返回 null");
  });
});
