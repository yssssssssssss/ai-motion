import { describe, expect, it } from "vitest";
import {
  applyZeroLayerMotionRecipe,
  compileMotionPlanFromRecipe,
  compileZeroLayerMotionBindings,
  computeCompositionStepWindows,
  createClassicEasing,
  deriveCompositionFromMotionPlan,
  evaluateComposition,
  fillMissingMatchedMotionPlanTracks,
  fillMotionPlanGeometryFromComposition,
  normalizeZeroLayerSnapshot,
  patchMotionPlanTrack,
  updateMotionPlanTrackFromCompositionSteps,
  type CompositionStep,
  type ZeroLayerMorphSource
} from "../src";

function makeSource(): ZeroLayerMorphSource {
  const from = normalizeZeroLayerSnapshot({
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: "card",
    nodeId: "card",
    name: "首帧",
    width: 160,
    height: 80,
    screenshotUrl: "data:image/png;base64,FROM",
    assets: [],
    layers: [
      {
        nodeId: "card",
        name: "卡片",
        kind: "rect",
        bounds: { x: 12, y: 16, w: 100, h: 40 },
        opacity: 1,
        visible: true
      }
    ]
  });
  const to = normalizeZeroLayerSnapshot({
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: "card",
    nodeId: "card",
    name: "尾帧",
    width: 160,
    height: 80,
    screenshotUrl: "data:image/png;base64,TO",
    assets: [],
    layers: [
      {
        nodeId: "card",
        name: "卡片",
        kind: "rect",
        bounds: { x: 20, y: 12, w: 120, h: 48 },
        opacity: 1,
        visible: true
      }
    ]
  });
  return {
    kind: "zero-layer-morph",
    from,
    to,
    bindingResult: compileZeroLayerMotionBindings(from, to)
  };
}

function recipeStep(layerId: string): CompositionStep {
  return {
    id: "card-morph",
    presetId: "zero-layer-morph",
    label: "卡片展开",
    target: "selected-layer",
    layerId,
    timing: "sequential",
    delayMs: 30,
    durationMs: 180,
    slot: "trajectory",
    initial: { x: 0, y: 0, width: 100, height: 40, scale: 0.94, opacity: 0.2 },
    animate: { x: 8, y: -4, width: 120, height: 48, scale: 1, opacity: 1 },
    easing: createClassicEasing("accelerate"),
    fillMode: "both"
  };
}

describe("MotionPlan recipe adapter", () => {
  it("preserves a recipe track's time window, endpoints, and easing in its compatibility view", () => {
    const source = makeSource();
    const step = recipeStep(source.bindingResult.bindings[0]!.layerId);

    const plan = compileMotionPlanFromRecipe({ source, steps: [step] });
    const restored = deriveCompositionFromMotionPlan(plan, [step]);

    expect(plan.tracks).toHaveLength(1);
    expect(plan.tracks[0]).toMatchObject({
      layerId: step.layerId,
      nodeId: "card",
      kind: "morph",
      source: "rule",
      timing: { delayMs: 30, durationMs: 180 },
      physics: { type: "ease", curve: [0.4, 0, 1, 1] }
    });
    expect(computeCompositionStepWindows(restored)).toEqual(computeCompositionStepWindows([step]));
    expect(restored[0]?.initial).toMatchObject(step.initial!);
    expect(restored[0]?.animate).toMatchObject(step.animate!);
    expect(restored[0]?.easing).toEqual(createClassicEasing("accelerate"));
  });

  it("retains a user track and does not regenerate the same layer", () => {
    const source = makeSource();
    const step = recipeStep(source.bindingResult.bindings[0]!.layerId);
    const plan = compileMotionPlanFromRecipe({
      source,
      steps: [step],
      existingPlan: {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 500,
        tracks: [
          {
            layerId: step.layerId!,
            nodeId: "card",
            kind: "morph",
            keyframes: [
              { offset: 0, x: 99 },
              { offset: 1, x: 0 }
            ],
            timing: { delayMs: 50, durationMs: 240 },
            source: "user"
          }
        ]
      }
    });

    expect(plan.tracks).toHaveLength(1);
    expect(plan.tracks[0]).toMatchObject({ source: "user", timing: { delayMs: 50, durationMs: 240 } });
    expect(plan.tracks[0]?.keyframes[0]).toMatchObject({ offset: 0, x: 99 });
  });

  it("drops the stale stage duration of replaced rule tracks", () => {
    const source = makeSource();
    const step = recipeStep(source.bindingResult.bindings[0]!.layerId);

    const plan = compileMotionPlanFromRecipe({
      source,
      steps: [step],
      existingPlan: {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 1000,
        tracks: [
          {
            layerId: step.layerId!,
            nodeId: "card",
            kind: "morph",
            keyframes: [
              { offset: 0, x: 0 },
              { offset: 1, x: 8 }
            ],
            timing: { delayMs: 0, durationMs: 1000 },
            source: "rule"
          }
        ]
      }
    });

    expect(plan.stageDurationMs).toBe(210);
  });

  it("persists an edited compatibility step as user-owned while preserving other user tracks", () => {
    const source = makeSource();
    const step = recipeStep(source.bindingResult.bindings[0]!.layerId);
    const next = { ...step, durationMs: 260, animate: { ...step.animate, x: 36 } };
    source.motionPlan = {
      schemaVersion: "motion-copilot.motion-plan.v1",
      stageDurationMs: 500,
      tracks: [
        {
          layerId: "other-layer",
          nodeId: "other-node",
          kind: "emphasis",
          keyframes: [
            { offset: 0, opacity: 0 },
            { offset: 1, opacity: 1 }
          ],
          timing: { delayMs: 0, durationMs: 100 },
          source: "user"
        }
      ]
    };

    const plan = updateMotionPlanTrackFromCompositionSteps(source, [next], next.layerId!);

    expect(plan.tracks.find((track) => track.layerId === next.layerId)).toMatchObject({
      source: "user",
      timing: { delayMs: 30, durationMs: 260 }
    });
    expect(plan.tracks.find((track) => track.layerId === next.layerId)?.keyframes.at(-1)).toMatchObject({
      x: 36
    });
    expect(plan.tracks.find((track) => track.layerId === "other-layer")?.source).toBe("user");
    expect(plan.stageDurationMs).toBe(290);
  });

  it("patches only the selected track and promotes it to a user override", () => {
    const plan = patchMotionPlanTrack(
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 300,
        tracks: [
          {
            layerId: "card",
            nodeId: "card",
            kind: "morph",
            source: "rule",
            timing: { delayMs: 0, durationMs: 200 },
            keyframes: [
              { offset: 0, x: 0, opacity: 0 },
              { offset: 1, x: 40, opacity: 1 }
            ]
          },
          {
            layerId: "label",
            nodeId: "label",
            kind: "enter",
            source: "rule",
            timing: { delayMs: 80, durationMs: 120 },
            keyframes: [
              { offset: 0, opacity: 0 },
              { offset: 1, opacity: 1 }
            ]
          }
        ]
      },
      "card",
      {
        timing: { delayMs: 32, durationMs: 260 },
        personality: { energy: 0.8, bounce: 0.6, sharpness: 0.4 }
      }
    );

    expect(plan.tracks.find((track) => track.layerId === "card")).toMatchObject({
      source: "user",
      timing: { delayMs: 32, durationMs: 260 },
      personality: { energy: 0.8, bounce: 0.6, sharpness: 0.4 }
    });
    expect(plan.tracks.find((track) => track.layerId === "label")).toMatchObject({
      source: "rule",
      timing: { delayMs: 80, durationMs: 120 }
    });
    expect(plan.stageDurationMs).toBe(292);
  });

  it("keeps unplanned fallback layers at their original absolute start", () => {
    const planned = recipeStep("planned-layer");
    const fallback: CompositionStep = {
      ...recipeStep("fallback-layer"),
      id: "fallback-step",
      timing: "sequential",
      delayMs: 30,
      durationMs: 180
    };
    const fullSteps = [{ ...planned, delayMs: 80, durationMs: 200 }, fallback];
    const restored = deriveCompositionFromMotionPlan(
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 280,
        tracks: [
          {
            layerId: "planned-layer",
            nodeId: "card",
            kind: "morph",
            source: "user",
            timing: { delayMs: 80, durationMs: 200 },
            keyframes: [
              { offset: 0, x: 0 },
              { offset: 1, x: 8 }
            ]
          }
        ]
      },
      fullSteps
    );

    expect(computeCompositionStepWindows(restored)).toEqual([
      { stepId: "card-morph", start: 80, end: 280 },
      { stepId: "fallback-step", start: 310, end: 490 }
    ]);
  });

  it("carries step metadata through the MotionPlan compatibility view without casts", () => {
    const source = makeSource();
    const step: CompositionStep = {
      ...recipeStep(source.bindingResult.bindings[0]!.layerId),
      metadata: { zeroLayerTransformOrigin: "top center", zeroLayerExpressionStrategy: "scale-origin" }
    };

    const plan = compileMotionPlanFromRecipe({ source, steps: [step] });
    const restored = deriveCompositionFromMotionPlan(plan, [step]);

    expect(restored[0]?.metadata?.zeroLayerTransformOrigin).toBe("top center");
    expect(restored[0]?.metadata?.zeroLayerExpressionStrategy).toBe("scale-origin");
  });

  it("bakes the selected Zero expression stops into the persisted track", () => {
    const source = makeSource();
    const step: CompositionStep = {
      ...recipeStep(source.bindingResult.bindings[0]!.layerId),
      metadata: { zeroLayerExpressionStrategy: "content-cross-replace" }
    };

    const plan = compileMotionPlanFromRecipe({ source, steps: [step] });

    expect(plan.tracks[0]?.keyframes).toEqual([
      { offset: 0, x: 0, y: 0, width: 100, height: 40, scale: 0.94, opacity: 0.2 },
      { offset: 0.42, x: 3.04, y: -1.52, width: 107.6, height: 43.04, scale: 0.9628, opacity: 0.28 },
      { offset: 0.74, x: 6.56, y: -3.28, width: 116.4, height: 46.56, scale: 0.9892, opacity: 0.72 },
      { offset: 1, x: 8, y: -4, width: 120, height: 48, scale: 1, opacity: 1 }
    ]);
  });

  it("persists the spring-expand main track as spring physics", () => {
    const source = makeSource();
    source.from.nodeId = "from-frame";
    source.to.nodeId = "to-frame";
    source.from.layers[0]!.fills = [{ type: "solid", color: "#ffffff" }];
    source.to.layers[0]!.fills = [{ type: "solid", color: "#ffffff" }];

    const result = applyZeroLayerMotionRecipe(source, "spring-expand");
    const mainStep = result.steps.find((step) => step.label === "弹性主容器");
    const motionPlan =
      result.document.visualSource?.kind === "zero-layer-morph"
        ? result.document.visualSource.motionPlan
        : undefined;

    expect(motionPlan?.tracks.find((track) => track.layerId === mainStep?.layerId)?.physics).toEqual({
      type: "spring",
      stiffness: 220,
      damping: 22
    });
  });

  it("recovers matched geometry for a sparse restored plan without a composition projection", () => {
    const source = makeSource();
    const layerId = source.bindingResult.bindings[0]!.layerId;
    source.nodeOverrides = [
      { frame: "from", nodeId: "card", x: 16, width: 96 },
      { frame: "to", nodeId: "card", x: 28, width: 132 }
    ];

    const plan = fillMotionPlanGeometryFromComposition(
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 240,
        tracks: [
          {
            layerId,
            nodeId: "card",
            kind: "morph",
            source: "user",
            timing: { delayMs: 0, durationMs: 240 },
            keyframes: [
              { offset: 0, opacity: 0.4 },
              { offset: 1, opacity: 1 }
            ]
          }
        ]
      },
      undefined,
      source
    );

    expect(plan.tracks[0]?.keyframes[0]).toMatchObject({ x: 0, y: 0, width: 96, height: 40 });
    expect(plan.tracks[0]?.keyframes.at(-1)).toMatchObject({ x: 12, y: -4, width: 132, height: 48 });
  });

  it("rebases a synthesized matched fallback track to node overrides", () => {
    const source = makeSource();
    const layerId = source.bindingResult.bindings[0]!.layerId;
    source.nodeOverrides = [
      { frame: "from", nodeId: "card", x: 16, width: 96 },
      { frame: "to", nodeId: "card", x: 28, width: 132 }
    ];
    const step = recipeStep(layerId);

    const plan = fillMissingMatchedMotionPlanTracks(undefined, evaluateComposition([step]), source);

    expect(plan.tracks[0]?.keyframes[0]).toMatchObject({ x: 0, y: 0, width: 96, height: 40 });
    expect(plan.tracks[0]?.keyframes.at(-1)).toMatchObject({ x: 12, y: -4, width: 132, height: 48 });
  });

  it("keeps user-owned geometry while filling only its missing matched properties", () => {
    const source = makeSource();
    const layerId = source.bindingResult.bindings[0]!.layerId;
    source.nodeOverrides = [
      { frame: "from", nodeId: "card", x: 16, width: 96 },
      { frame: "to", nodeId: "card", x: 28, width: 132 }
    ];

    const plan = fillMotionPlanGeometryFromComposition(
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 240,
        tracks: [
          {
            layerId,
            nodeId: "card",
            kind: "morph",
            source: "user",
            timing: { delayMs: 0, durationMs: 240 },
            keyframes: [
              { offset: 0, x: 0, width: 100 },
              { offset: 0.5, x: 4, width: 110 },
              { offset: 1, x: 8, width: 120 }
            ]
          }
        ]
      },
      undefined,
      source
    );

    expect(plan.tracks[0]?.keyframes).toEqual([
      { offset: 0, x: 0, y: 0, width: 100, height: 40 },
      { offset: 0.5, x: 4, width: 110 },
      { offset: 1, x: 8, y: -4, width: 120, height: 48 }
    ]);
  });

  it("preserves an interior pulse when rebasing generated matched endpoints", () => {
    const source = makeSource();
    const layerId = source.bindingResult.bindings[0]!.layerId;
    source.nodeOverrides = [
      { frame: "from", nodeId: "card", x: 16, width: 96 },
      { frame: "to", nodeId: "card", x: 28, width: 132 }
    ];

    const plan = fillMotionPlanGeometryFromComposition(
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 240,
        tracks: [
          {
            layerId,
            nodeId: "card",
            kind: "morph",
            source: "rule",
            timing: { delayMs: 0, durationMs: 240 },
            keyframes: [
              { offset: 0, x: 0, width: 100 },
              { offset: 0.5, x: 4, width: 120 },
              { offset: 1, x: 0, width: 100 }
            ]
          }
        ]
      },
      undefined,
      source
    );

    expect(plan.tracks[0]?.keyframes).toEqual([
      { offset: 0, x: 0, y: 0, width: 96, height: 40 },
      { offset: 0.5, x: 10, width: 134 },
      { offset: 1, x: 12, y: -4, width: 132, height: 48 }
    ]);
  });
});
