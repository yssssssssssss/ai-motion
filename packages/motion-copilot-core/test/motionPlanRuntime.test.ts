import { describe, expect, it } from "vitest";
import { compileMotionPlanCss, compileMotionPlanKeyframes, sampleMotionPlan } from "../src";

const plan = {
  schemaVersion: "motion-copilot.motion-plan.v1" as const,
  stageDurationMs: 300,
  tracks: [
    {
      layerId: "card",
      nodeId: "1:1",
      kind: "morph" as const,
      source: "rule" as const,
      timing: { delayMs: 40, durationMs: 200 },
      physics: { type: "ease" as const, curve: [0, 0, 1, 1] as [number, number, number, number] },
      keyframes: [
        { offset: 0, x: 0, width: 100, opacity: 0 },
        { offset: 1, x: 80, width: 180, opacity: 1 }
      ]
    }
  ]
};

describe("MotionPlan runtime helpers", () => {
  it("bakes ease physics into playback and CSS instead of playing only linear endpoints", () => {
    const eased = structuredClone(plan);
    eased.tracks[0]!.physics.curve = [0.18, 0.86, 0.22, 1];
    const midpoint = compileMotionPlanKeyframes(eased)[0]?.keyframes.find((frame) => frame.offset === 0.5);
    expect(midpoint?.x).toBeGreaterThan(70);
    expect(midpoint?.x).toBeCloseTo(sampleMotionPlan(eased, 140)[0]!.state.x!, 5);
    expect(compileMotionPlanCss(eased)).not.toBe(compileMotionPlanCss(plan));
  });
  it("samples track state before, during, and after its time window", () => {
    expect(sampleMotionPlan(plan, 0)[0]).toMatchObject({
      active: false,
      progress: 0,
      state: { x: 0, opacity: 0 }
    });
    const midpoint = sampleMotionPlan(plan, 140)[0];
    expect(midpoint).toMatchObject({ active: true, progress: 0.5 });
    expect(midpoint?.state.x).toBeCloseTo(40, 3);
    expect(midpoint?.state.width).toBeCloseTo(140, 3);
    expect(midpoint?.state.opacity).toBeCloseTo(0.5, 3);
    expect(sampleMotionPlan(plan, 300)[0]).toMatchObject({
      active: false,
      progress: 1,
      state: { x: 80, opacity: 1 }
    });
  });

  it("compiles selectors, timing, and keyframes from the same plan", () => {
    const css = compileMotionPlanCss(plan, {
      selectorForLayer: (layerId) => `[data-zero-layer-id="${layerId}"]`
    });

    expect(css).toContain("@keyframes mc-motion-plan-0-card");
    expect(css).toContain('data-zero-layer-id="card"');
    expect(css).toContain("40ms - var(--mc-motion-plan-time,0ms)");
    expect(css).toContain("translate(80px,0px)");
  });

  it("samples spring overshoot and polyline paths, then bakes them for browser runtimes", () => {
    const physicalPlan = {
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: 400,
      tracks: [
        {
          layerId: "badge",
          nodeId: "2:1",
          kind: "path" as const,
          source: "user" as const,
          timing: { delayMs: 0, durationMs: 400 },
          physics: { type: "spring" as const, stiffness: 170, damping: 10 },
          path: {
            points: [
              { x: 0, y: 0 },
              { x: 40, y: -30 },
              { x: 80, y: 0 }
            ]
          },
          keyframes: [
            { offset: 0, scale: 0.8, opacity: 0 },
            { offset: 1, scale: 1, opacity: 1 }
          ]
        }
      ]
    };

    const midpoint = sampleMotionPlan(physicalPlan, 200)[0];
    expect(midpoint?.state).toMatchObject({ x: 40, y: -30 });
    expect(sampleMotionPlan(physicalPlan, 120)[0]?.state.scale).toBeGreaterThan(1);
    expect(midpoint?.state.opacity).toBeLessThanOrEqual(1);

    const baked = compileMotionPlanKeyframes(physicalPlan);
    expect(baked[0]?.keyframes).toHaveLength(25);
    expect(baked[0]?.keyframes[12]).toMatchObject({ x: 40, y: -30 });
    expect(compileMotionPlanCss(physicalPlan)).toContain("25%{");
  });
});
