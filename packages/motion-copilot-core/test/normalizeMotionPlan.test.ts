import { describe, expect, it } from "vitest";
import { MOTION_PLAN_SCHEMA_VERSION, normalizeMotionPlan } from "../src";
import type { MotionPlan } from "../src";

describe("normalizeMotionPlan", () => {
  it("passes a well-formed plan through, sorting keyframes by offset", () => {
    const input = {
      schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
      stageDurationMs: 600,
      tracks: [
        {
          layerId: "card",
          nodeId: "6:2",
          kind: "morph",
          source: "llm",
          timing: { delayMs: 40, durationMs: 320 },
          keyframes: [
            { offset: 1, opacity: 1, x: 10 },
            { offset: 0, opacity: 0, x: 0 }
          ],
          physics: { type: "spring", stiffness: 220, damping: 24 },
          personality: { energy: 0.6, bounce: 0.3, sharpness: 0.5 },
          overshoot: 0.12
        }
      ]
    };
    const plan = normalizeMotionPlan(input);
    expect(plan.schemaVersion).toBe(MOTION_PLAN_SCHEMA_VERSION);
    expect(plan.stageDurationMs).toBe(600);
    expect(plan.tracks).toHaveLength(1);
    expect(plan.tracks[0]!.keyframes.map((frame) => frame.offset)).toEqual([0, 1]);
    expect(plan.tracks[0]!.physics).toEqual({ type: "spring", stiffness: 220, damping: 24 });
  });

  it("returns an empty plan for invalid or missing input without throwing", () => {
    expect(normalizeMotionPlan(undefined)).toEqual({
      schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
      tracks: [],
      stageDurationMs: 0
    });
    expect(normalizeMotionPlan(null)).toEqual({
      schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
      tracks: [],
      stageDurationMs: 0
    });
    expect(normalizeMotionPlan({ tracks: "nope" }).tracks).toEqual([]);
  });

  it("clamps keyframe offsets into [0,1]", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 300,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "enter",
          source: "rule",
          timing: { delayMs: 0, durationMs: 200 },
          keyframes: [{ offset: -0.5 }, { offset: 1.8 }]
        }
      ]
    });
    expect(plan.tracks[0]!.keyframes.map((frame) => frame.offset)).toEqual([0, 1]);
  });

  it("clamps negative timing, overshoot, and stageDuration to non-negative", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: -100,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "morph",
          source: "user",
          timing: { delayMs: -30, durationMs: -10 },
          keyframes: [{ offset: 0 }],
          overshoot: -1
        }
      ]
    });
    expect(plan.stageDurationMs).toBe(0);
    expect(plan.tracks[0]!.timing).toEqual({ delayMs: 0, durationMs: 0 });
    expect(plan.tracks[0]!.overshoot).toBe(0);
  });

  it("clamps personality components into [0,1]", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 100,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "emphasis",
          source: "llm",
          timing: { delayMs: 0, durationMs: 100 },
          keyframes: [{ offset: 0 }],
          personality: { energy: 2, bounce: -1, sharpness: 0.4 }
        }
      ]
    });
    expect(plan.tracks[0]!.personality).toEqual({ energy: 1, bounce: 0, sharpness: 0.4 });
  });

  it("defaults unknown kind to morph and unknown source to rule", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 100,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "wobble",
          source: "human",
          timing: { delayMs: 0, durationMs: 100 },
          keyframes: [{ offset: 0 }]
        }
      ]
    });
    expect(plan.tracks[0]!.kind).toBe("morph");
    expect(plan.tracks[0]!.source).toBe("rule");
  });

  it("drops tracks missing layerId or nodeId", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 100,
      tracks: [
        { nodeId: "1:1", kind: "morph", source: "rule", timing: {}, keyframes: [] },
        { layerId: "a", kind: "morph", source: "rule", timing: {}, keyframes: [] },
        { layerId: "b", nodeId: "2:2", kind: "morph", source: "rule", timing: {}, keyframes: [{ offset: 0 }] }
      ]
    });
    expect(plan.tracks).toHaveLength(1);
    expect(plan.tracks[0]!.layerId).toBe("b");
  });

  it("drops malformed physics and path but keeps the track", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 100,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "path",
          source: "rule",
          timing: { delayMs: 0, durationMs: 100 },
          keyframes: [{ offset: 0 }],
          physics: { type: "spring", stiffness: "fast" },
          path: { points: [{ x: 0 }, { x: 5, y: 5 }] }
        }
      ]
    });
    const track = plan.tracks[0]!;
    expect(track.physics).toBeUndefined();
    expect(track.path).toEqual({ points: [{ x: 5, y: 5 }] });
  });

  it("accepts an ease physics with a cubic-bezier curve", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 100,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "morph",
          source: "rule",
          timing: { delayMs: 0, durationMs: 100 },
          keyframes: [{ offset: 0 }],
          physics: { type: "ease", curve: [0.4, 0, 0.2, 1] }
        }
      ]
    });
    expect(plan.tracks[0]!.physics).toEqual({ type: "ease", curve: [0.4, 0, 0.2, 1] });
  });

  it("is idempotent — normalizing a normalized plan yields the same result", () => {
    const once = normalizeMotionPlan({
      stageDurationMs: 500,
      tracks: [
        {
          layerId: "a",
          nodeId: "1:1",
          kind: "morph",
          source: "user",
          timing: { delayMs: 10, durationMs: 200 },
          keyframes: [
            { offset: 1, opacity: 1 },
            { offset: 0, opacity: 0 }
          ]
        }
      ]
    });
    const twice: MotionPlan = normalizeMotionPlan(once);
    expect(twice).toEqual(once);
  });

  it("completes endpoint keyframes, de-duplicates each layer, and keeps a user track", () => {
    const plan = normalizeMotionPlan({
      stageDurationMs: 20,
      tracks: [
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "morph",
          source: "rule",
          timing: { delayMs: 30, durationMs: 100 },
          keyframes: [{ offset: 0.4, opacity: 0.5 }]
        },
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "morph",
          source: "user",
          timing: { delayMs: 40, durationMs: 120 },
          keyframes: [
            { offset: 0, x: 12 },
            { offset: 1, x: 0 }
          ]
        }
      ]
    });

    expect(plan.tracks).toHaveLength(1);
    expect(plan.tracks[0]?.source).toBe("user");
    expect(plan.stageDurationMs).toBe(160);

    const endpointPlan = normalizeMotionPlan({
      tracks: [
        {
          layerId: "label",
          nodeId: "1:2",
          kind: "enter",
          source: "rule",
          timing: { delayMs: 0, durationMs: 100 },
          keyframes: [{ offset: 0.4, opacity: 0.5 }]
        }
      ]
    });
    expect(endpointPlan.tracks[0]?.keyframes.map((frame) => frame.offset)).toEqual([0, 0.4, 1]);
  });
});
