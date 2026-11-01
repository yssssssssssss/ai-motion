import { describe, expect, it } from "vitest";
import {
  assembleMotionPlanFromDraft,
  physicsFromPersonality,
  isMotionPlanDraftResponse,
  parseMotionPlanDraftResponse,
  selectDistinctMotionPlanDraft,
  type MotionPlanDraft
} from "../src";

const fallback = {
  schemaVersion: "motion-copilot.motion-plan.v1" as const,
  stageDurationMs: 400,
  tracks: [
    {
      layerId: "card",
      nodeId: "card",
      kind: "morph" as const,
      source: "rule" as const,
      timing: { delayMs: 0, durationMs: 300 },
      physics: { type: "ease" as const, curve: [0.35, 0, 0.25, 1] as [number, number, number, number] },
      keyframes: [
        { offset: 0, x: 0, y: 0, scale: 0.9, opacity: 0 },
        { offset: 1, x: 100, y: 0, scale: 1, opacity: 1 }
      ]
    },
    {
      layerId: "title",
      nodeId: "title",
      kind: "enter" as const,
      source: "user" as const,
      timing: { delayMs: 40, durationMs: 160 },
      keyframes: [
        { offset: 0, opacity: 0 },
        { offset: 1, opacity: 1 }
      ]
    }
  ]
};

const distinctDraft: MotionPlanDraft = {
  intent: "spatial-morph",
  rationale: "卡片沿上弧线展开。",
  tracks: [
    {
      target: "morph",
      delayScale: 0.5,
      durationScale: 0.8,
      staggerMs: 40,
      curve: "spring",
      path: "arc-up",
      personality: { energy: 0.9, bounce: 0.7, sharpness: 0.6 }
    }
  ]
};

const equivalentDraft: MotionPlanDraft = {
  intent: "spatial-morph",
  rationale: "仅改说明。",
  tracks: [
    {
      target: "morph",
      delayScale: 1,
      durationScale: 1,
      staggerMs: 0,
      curve: "standard",
      path: "straight",
      personality: { energy: 0.5, bounce: 0.5, sharpness: 0.5 }
    }
  ]
};

describe("MotionPlan LLM draft contract", () => {
  it.each([
    [0, 0, 120, 26],
    [1, 1, 300, 12],
    [0.9, 0.7, 282, 16],
    [0.375, 0.25, 188, 23]
  ])(
    "preserves generated spring physics for energy %s and bounce %s",
    (energy, bounce, stiffness, damping) => {
      const draft = structuredClone(distinctDraft);
      draft.tracks[0]!.personality = { energy, bounce, sharpness: 0.5 };
      const expected = { type: "spring", stiffness, damping };
      expect(physicsFromPersonality("spring", draft.tracks[0]!.personality)).toEqual(expected);
      expect(assembleMotionPlanFromDraft(fallback, draft).tracks[0]?.physics).toEqual(expected);
    }
  );

  it.each([
    [0, [0.35, 0, 0.25, 1]],
    [0.5, [0.265, 0.43, 0.235, 1]],
    [1, [0.18, 0.86, 0.22, 1]]
  ])("maps sharpness %s between standard and decelerate", (sharpness, curve) => {
    const physics = physicsFromPersonality("ease", {
      energy: 0.5,
      bounce: 0.3,
      sharpness: Number(sharpness)
    });
    expect(physics.type).toBe("ease");
    if (physics.type === "ease")
      physics.curve.forEach((value, index) => expect(value).toBeCloseTo((curve as number[])[index]!));
  });
  it("accepts only schema-shaped candidates without node or pixel fields", () => {
    expect(isMotionPlanDraftResponse({ candidates: [distinctDraft] })).toBe(true);
    expect(
      parseMotionPlanDraftResponse(JSON.stringify({ candidates: [distinctDraft] }))?.candidates
    ).toHaveLength(1);
    expect(
      isMotionPlanDraftResponse({
        candidates: [{ ...distinctDraft, tracks: [{ ...distinctDraft.tracks[0]!, nodeId: "forbidden" }] }]
      })
    ).toBe(false);
  });

  it("binds only deterministic fallback tracks and preserves user overrides", () => {
    const plan = assembleMotionPlanFromDraft(fallback, distinctDraft);
    expect(plan.tracks.find((track) => track.layerId === "card")).toMatchObject({
      source: "llm",
      timing: { delayMs: 0, durationMs: 240 },
      path: {
        points: [
          { x: 0, y: 0 },
          { x: 50, y: -30 },
          { x: 100, y: 0 }
        ]
      }
    });
    expect(plan.tracks.find((track) => track.layerId === "title")).toMatchObject({
      source: "user",
      timing: { delayMs: 40, durationMs: 160 }
    });
  });

  it("rejects candidates with no meaningful intermediate-frame difference", () => {
    const rejected = selectDistinctMotionPlanDraft(fallback, [equivalentDraft]);
    expect(rejected.selectedCandidate).toBeUndefined();
    expect(rejected.rejectionReason).toContain("中间采样");

    const selected = selectDistinctMotionPlanDraft(fallback, [equivalentDraft, distinctDraft]);
    expect(selected.selectedCandidate).toBe(1);
    expect(selected.motionPlan.tracks.find((track) => track.layerId === "card")?.source).toBe("llm");
  });
});
