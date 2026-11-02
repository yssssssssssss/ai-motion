import { describe, expect, it } from "vitest";
import {
  compileMotionPlanCss,
  compileMotionPlanKeyframes,
  sampleMotionPlan,
  sampleZeroLayerSkinMix,
  zeroLayerAppearanceDiffers,
  type ZeroLayerNode
} from "../src";

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
  it("uses one 40%-60% local-progress window for matched appearance crossfades", () => {
    expect(sampleZeroLayerSkinMix(0.39)).toEqual({ from: 1, to: 0 });
    expect(sampleZeroLayerSkinMix(0.5)).toEqual({ from: 0.5, to: 0.5 });
    expect(sampleZeroLayerSkinMix(0.61)).toEqual({ from: 0, to: 1 });
  });

  it("treats image-fill asset URL changes as a discrete appearance change", () => {
    const node: ZeroLayerNode = {
      nodeId: "card",
      name: "card",
      kind: "rect",
      bounds: { x: 0, y: 0, w: 40, h: 40 },
      opacity: 1,
      visible: true,
      fills: [{ type: "image", assetId: "fill" }]
    };
    const fromAssets = new Map([
      ["fill", { id: "fill", type: "png" as const, url: "data:image/png;base64,FROM" }]
    ]);
    const toAssets = new Map([
      ["fill", { id: "fill", type: "png" as const, url: "data:image/png;base64,TO" }]
    ]);

    expect(zeroLayerAppearanceDiffers(node, node, fromAssets, toAssets)).toBe(true);
  });

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

  it("evaluates spring physics in elapsed seconds instead of normalized track progress", () => {
    const springPlan = (durationMs: number) => ({
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: durationMs,
      tracks: [
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "morph" as const,
          source: "rule" as const,
          timing: { delayMs: 0, durationMs },
          physics: { type: "spring" as const, stiffness: 170, damping: 10 },
          keyframes: [
            { offset: 0, x: 0 },
            { offset: 1, x: 100 }
          ]
        }
      ]
    });

    const shortTrackX = sampleMotionPlan(springPlan(400), 100)[0]?.state.x;
    const longTrackX = sampleMotionPlan(springPlan(800), 100)[0]?.state.x;

    expect(shortTrackX).toBeCloseTo(longTrackX!, 6);
  });

  it("bakes classic easing to the same intermediate state used by the sampler", () => {
    const plan = {
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: 1000,
      tracks: [
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "morph" as const,
          source: "rule" as const,
          timing: { delayMs: 0, durationMs: 1000 },
          physics: { type: "ease" as const, curve: [0.42, 0, 1, 1] as [number, number, number, number] },
          keyframes: [
            { offset: 0, x: 0 },
            { offset: 1, x: 100 }
          ]
        }
      ]
    };

    const sampled = sampleMotionPlan(plan, 500)[0]?.state.x;
    const baked = compileMotionPlanKeyframes(plan)[0]?.keyframes.find((frame) => frame.offset === 0.5)?.x;

    expect(baked).toBeCloseTo(sampled!, 6);
    expect(baked).not.toBeCloseTo(50, 1);
  });

  it("settles a spring continuously before its exact endpoint", () => {
    const settlingPlan = {
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: 400,
      tracks: [
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "morph" as const,
          source: "rule" as const,
          timing: { delayMs: 0, durationMs: 400 },
          physics: { type: "spring" as const, stiffness: 170, damping: 10 },
          keyframes: [
            { offset: 0, x: 0 },
            { offset: 1, x: 100 }
          ]
        }
      ]
    };

    const penultimate = sampleMotionPlan(settlingPlan, 399)[0]!.state.x!;
    const previous = sampleMotionPlan(settlingPlan, 398)[0]!.state.x!;
    const endpoint = sampleMotionPlan(settlingPlan, 400)[0]!.state.x!;

    expect(endpoint).toBe(100);
    expect(penultimate).toBeCloseTo(endpoint, 2);
    expect(Math.abs(penultimate - previous)).toBeLessThan(0.01);
  });

  it("advances a path with track easing and segment-length weighting", () => {
    const pathPlan = {
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: 1000,
      tracks: [
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "path" as const,
          source: "rule" as const,
          timing: { delayMs: 0, durationMs: 1000 },
          physics: { type: "ease" as const, curve: [0.42, 0, 1, 1] as [number, number, number, number] },
          path: {
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 110, y: 0 }
            ]
          },
          keyframes: [
            { offset: 0, x: 0, y: 0 },
            { offset: 1, x: 110, y: 0 }
          ]
        }
      ]
    };

    const midpointX = sampleMotionPlan(pathPlan, 500)[0]!.state.x!;

    expect(midpointX).toBeGreaterThan(25);
    expect(midpointX).toBeLessThan(40);
  });

  it("adds path curvature without discarding keyframed positions", () => {
    const curvedPlan = {
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: 400,
      tracks: [
        {
          layerId: "card",
          nodeId: "1:1",
          kind: "path" as const,
          source: "user" as const,
          timing: { delayMs: 0, durationMs: 400 },
          physics: { type: "ease" as const, curve: [0, 0, 1, 1] as [number, number, number, number] },
          path: {
            points: [
              { x: 0, y: 0 },
              { x: 50, y: -30 },
              { x: 100, y: 0 }
            ]
          },
          keyframes: [
            { offset: 0, x: 100, y: 50 },
            { offset: 1, x: 200, y: 50 }
          ]
        }
      ]
    };

    const midpoint = sampleMotionPlan(curvedPlan, 200)[0]!.state;
    expect(midpoint.x).toBeCloseTo(150, 4);
    expect(midpoint.y).toBeCloseTo(20, 4);
  });

  it("rounds an interior path waypoint instead of snapping direction", () => {
    const smoothPathPlan = {
      schemaVersion: "motion-copilot.motion-plan.v1" as const,
      stageDurationMs: 400,
      tracks: [
        {
          layerId: "badge",
          nodeId: "2:1",
          kind: "path" as const,
          source: "rule" as const,
          timing: { delayMs: 0, durationMs: 400 },
          path: {
            points: [
              { x: 0, y: 0 },
              { x: 40, y: -30 },
              { x: 80, y: 0 }
            ]
          },
          keyframes: [
            { offset: 0, opacity: 1 },
            { offset: 1, opacity: 1 }
          ]
        }
      ]
    };

    const before = sampleMotionPlan(smoothPathPlan, 196)[0]!.state;
    const waypoint = sampleMotionPlan(smoothPathPlan, 200)[0]!.state;
    const after = sampleMotionPlan(smoothPathPlan, 204)[0]!.state;

    expect(Math.abs(waypoint.y! - before.y!)).toBeLessThan(0.1);
    expect(Math.abs(after.y! - waypoint.y!)).toBeLessThan(0.1);
    expect(before.x!).toBeLessThan(waypoint.x!);
    expect(waypoint.x!).toBeLessThan(after.x!);
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
    expect(midpoint?.state).toMatchObject({ x: 80, y: 0 });
    expect(sampleMotionPlan(physicalPlan, 200)[0]?.state.scale).toBeGreaterThan(1);
    expect(midpoint?.state.opacity).toBeLessThanOrEqual(1);

    const baked = compileMotionPlanKeyframes(physicalPlan);
    expect(baked[0]?.keyframes).toHaveLength(25);
    expect(baked[0]?.keyframes[12]).toMatchObject({ x: 80, y: 0 });
    expect(compileMotionPlanCss(physicalPlan)).toContain("25%{");
  });
});
