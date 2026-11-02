import {
  createClassicEasing,
  createSpringEasing,
  type ClassicEasingPreset,
  type CompositionStep,
  type CompositionTrack,
  type EasingSpec,
  type MotionState
} from "../schema/document";
import { computeCompositionStepWindows } from "../composition/evaluateComposition";
import { layerIdForNode } from "./layerId";
import { MOTION_PLAN_SCHEMA_VERSION, normalizeMotionPlan } from "./normalizeMotionPlan";
import { resolveZeroLayerNodeOverride } from "./zeroLayerAppearance";
import {
  zeroLayerExpressionStrategyForStep,
  type ZeroLayerExpressionStop
} from "./zeroLayerExpressionStrategies";
import type {
  LayerMotionTrack,
  MotionKeyframe,
  MotionPhysics,
  MotionPlan,
  MotionTrackKind,
  ZeroLayerMorphSource,
  ZeroLayerNode
} from "./schema";

const classicCurves: Record<ClassicEasingPreset, [number, number, number, number]> = {
  decelerate: [0.18, 0.86, 0.22, 1],
  accelerate: [0.4, 0, 1, 1],
  standard: [0.35, 0, 0.25, 1],
  sharp: [0.25, 0.8, 0.35, 1]
};

export type CompileMotionPlanFromRecipeInput = {
  source: ZeroLayerMorphSource;
  steps: CompositionStep[];
  existingPlan?: MotionPlan;
};

export type MotionPlanTrackPatch = Pick<
  LayerMotionTrack,
  "kind" | "keyframes" | "physics" | "path" | "timing" | "overshoot" | "personality"
>;

function nodeForLayer(source: ZeroLayerMorphSource, layerId: string): ZeroLayerNode | undefined {
  const binding = source.bindingResult.bindings.find((item) => item.layerId === layerId);
  if (binding) {
    return (
      source.from.layers.find((node) => node.nodeId === binding.nodeId) ??
      source.to.layers.find((node) => node.nodeId === binding.toNodeId)
    );
  }
  return [...source.bindingResult.enter, ...source.bindingResult.exit].find(
    (node) => layerIdForNode(node) === layerId
  );
}

function kindForLayer(source: ZeroLayerMorphSource, layerId: string): MotionTrackKind {
  if (source.bindingResult.bindings.some((item) => item.layerId === layerId)) return "morph";
  if (source.bindingResult.enter.some((node) => layerIdForNode(node) === layerId)) return "enter";
  if (source.bindingResult.exit.some((node) => layerIdForNode(node) === layerId)) return "exit";
  return "emphasis";
}

function physicsFromEasing(easing: EasingSpec | undefined): MotionPhysics | undefined {
  if (!easing) return undefined;
  if (easing.type === "spring") {
    return { type: "spring", stiffness: easing.stiffness, damping: easing.damping };
  }
  return { type: "ease", curve: classicCurves[easing.preset] };
}

function keyframeFromState(offset: number, state: MotionState | undefined): MotionKeyframe {
  const frame: MotionKeyframe = { offset };
  if (state?.x != null) frame.x = state.x;
  if (state?.y != null) frame.y = state.y;
  if (state?.width != null) frame.width = state.width;
  if (state?.height != null) frame.height = state.height;
  if (state?.scale != null) frame.scale = state.scale;
  if (state?.rotate != null) frame.rotation = state.rotate;
  if (state?.opacity != null) frame.opacity = state.opacity;
  return frame;
}

function keyframeFromExpressionStop(
  offset: number,
  step: CompositionStep,
  stop: ZeroLayerExpressionStop
): MotionKeyframe {
  if (stop.progress <= 0) {
    const frame = keyframeFromState(offset, step.initial);
    if (stop.opacity != null) frame.opacity = stop.opacity;
    return frame;
  }
  if (stop.progress >= 1) {
    const frame = keyframeFromState(offset, step.animate);
    if (stop.opacity != null) frame.opacity = stop.opacity;
    return frame;
  }

  const state: MotionState = {};
  const keys = ["x", "y", "width", "height", "scale", "rotate", "opacity"] as const;
  for (const key of keys) {
    const initial = step.initial?.[key];
    const animate = step.animate?.[key];
    if (initial != null && animate != null) {
      state[key] = initial + (animate - initial) * stop.progress;
    } else if (initial != null || animate != null) {
      const value = initial ?? animate;
      if (value != null) state[key] = value;
    }
  }
  if (stop.opacity != null) state.opacity = stop.opacity;
  return keyframeFromState(offset, state);
}

function addKeyframe(frameByOffset: Map<number, MotionKeyframe>, frame: MotionKeyframe): void {
  frameByOffset.set(frame.offset, { ...(frameByOffset.get(frame.offset) ?? {}), ...frame });
}

function stepGroups(
  steps: CompositionStep[]
): Map<string, Array<{ step: CompositionStep; start: number; end: number }>> {
  const windows = computeCompositionStepWindows(steps);
  const groups = new Map<string, Array<{ step: CompositionStep; start: number; end: number }>>();
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const window = windows[index]!;
    if (!step.layerId) continue;
    const group = groups.get(step.layerId) ?? [];
    group.push({ step, start: window.start, end: window.end });
    groups.set(step.layerId, group);
  }
  return groups;
}

function trackForStepGroup(
  source: ZeroLayerMorphSource,
  layerId: string,
  group: Array<{ step: CompositionStep; start: number; end: number }>
): LayerMotionTrack | undefined {
  const node = nodeForLayer(source, layerId);
  if (!node) return undefined;
  const first = group[0]!;
  const start = first.start;
  const end = Math.max(...group.map((item) => item.end));
  const durationMs = Math.max(0, end - start);
  const keyframes = new Map<number, MotionKeyframe>();
  for (const item of group) {
    const strategy = zeroLayerExpressionStrategyForStep(item.step);
    for (const stop of strategy.stops) {
      const localOffset = Math.min(1, Math.max(0, stop.percent / 100));
      const offset =
        durationMs === 0
          ? localOffset
          : (item.start - start + (item.end - item.start) * localOffset) / durationMs;
      addKeyframe(keyframes, keyframeFromExpressionStop(offset, item.step, stop));
    }
  }
  const track: LayerMotionTrack = {
    layerId,
    nodeId: node.nodeId,
    kind: kindForLayer(source, layerId),
    keyframes: [...keyframes.values()].sort((a, b) => a.offset - b.offset),
    timing: { delayMs: start, durationMs },
    source: "rule"
  };
  const physics = physicsFromEasing(first.step.easing);
  if (physics) track.physics = physics;
  return track;
}

/**
 * 将既有 recipe 的时间窗和首尾状态编译为可持久化的 per-layer MotionPlan。
 * 已保存的 user 轨道优先于规则轨道，重新生成不会覆盖用户编辑。
 */
export function compileMotionPlanFromRecipe(input: CompileMotionPlanFromRecipeInput): MotionPlan {
  const existing = normalizeMotionPlan(input.existingPlan ?? input.source.motionPlan);
  const userTracks = existing.tracks.filter((track) => track.source === "user");
  const userLayerIds = new Set(userTracks.map((track) => track.layerId));
  const recipeTracks = [...stepGroups(input.steps)]
    .map(([layerId, group]) => trackForStepGroup(input.source, layerId, group))
    .filter((track): track is LayerMotionTrack => track != null && !userLayerIds.has(track.layerId));
  const tracks = [...recipeTracks, ...userTracks];
  const stageDurationMs = Math.max(
    0,
    ...tracks.map((track) => track.timing.delayMs + track.timing.durationMs)
  );

  return normalizeMotionPlan({
    schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
    tracks,
    stageDurationMs
  });
}

/** Promotes one edited compatibility step to a durable user track without replacing other user tracks. */
export function updateMotionPlanTrackFromCompositionSteps(
  source: ZeroLayerMorphSource,
  steps: CompositionStep[],
  layerId: string
): MotionPlan {
  const { motionPlan: _existingPlan, ...sourceWithoutPlan } = source;
  const regenerated = compileMotionPlanFromRecipe({ source: sourceWithoutPlan, steps });
  const editedTrack = regenerated.tracks.find((track) => track.layerId === layerId);
  if (!editedTrack) return compileMotionPlanFromRecipe({ source, steps });

  const existing = normalizeMotionPlan(source.motionPlan);
  const preservedUserTracks = existing.tracks.filter(
    (track) => track.source === "user" && track.layerId !== layerId
  );
  const preservedLayerIds = new Set(preservedUserTracks.map((track) => track.layerId));
  return normalizeMotionPlan({
    schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
    stageDurationMs: 0,
    tracks: [
      ...regenerated.tracks.filter(
        (track) => track.layerId !== layerId && !preservedLayerIds.has(track.layerId)
      ),
      ...preservedUserTracks,
      { ...editedTrack, source: "user" }
    ]
  });
}

/** Updates exactly one persisted track and promotes it to a user-owned override. */
export function patchMotionPlanTrack(
  value: MotionPlan | unknown,
  layerId: string,
  patch: Partial<MotionPlanTrackPatch>
): MotionPlan {
  const plan = normalizeMotionPlan(value);
  return normalizeMotionPlan({
    ...plan,
    stageDurationMs: 0,
    tracks: plan.tracks.map((track) =>
      track.layerId === layerId
        ? {
            ...track,
            ...patch,
            ...(patch.timing ? { timing: { ...track.timing, ...patch.timing } } : {}),
            source: "user"
          }
        : track
    )
  });
}

const geometryKeys = ["x", "y", "width", "height"] as const;

function sourceGeometryForLayer(
  source: ZeroLayerMorphSource,
  layerId: string
): { initial: MotionState; animate: MotionState; exactEndpoints: boolean } | undefined {
  const binding = source.bindingResult.bindings.find((item) => item.layerId === layerId);
  if (binding) {
    const rawFrom = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const rawTo = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    if (!rawFrom || !rawTo) return undefined;
    const from = resolveZeroLayerNodeOverride(rawFrom, source.nodeOverrides, "from");
    const to = resolveZeroLayerNodeOverride(rawTo, source.nodeOverrides, "to");
    return {
      initial: { x: 0, y: 0, width: from.bounds.w, height: from.bounds.h },
      animate: {
        x: to.bounds.x - from.bounds.x,
        y: to.bounds.y - from.bounds.y,
        width: to.bounds.w,
        height: to.bounds.h
      },
      exactEndpoints: true
    };
  }

  const enter = source.bindingResult.enter.find((node) => layerIdForNode(node) === layerId);
  const exit = source.bindingResult.exit.find((node) => layerIdForNode(node) === layerId);
  const rawNode = enter ?? exit;
  if (!rawNode) return undefined;
  const frame = enter ? "to" : "from";
  const node = resolveZeroLayerNodeOverride(rawNode, source.nodeOverrides, frame);
  const state = { x: 0, y: 0, width: node.bounds.w, height: node.bounds.h };
  return { initial: state, animate: state, exactEndpoints: false };
}

function rebaseGeometryKeyframes(
  keyframes: MotionKeyframe[],
  key: (typeof geometryKeys)[number],
  targetStart: number,
  targetEnd: number
): MotionKeyframe[] {
  const values = keyframes.flatMap((frame) => (frame[key] == null ? [] : [frame[key]]));
  if (values.length === 0) {
    return keyframes.map((frame, index) =>
      index === 0
        ? { ...frame, [key]: targetStart }
        : index === keyframes.length - 1
          ? { ...frame, [key]: targetEnd }
          : frame
    );
  }
  const oldStart = values[0]!;
  const oldEnd = values.at(-1)!;
  const oldSpan = oldEnd - oldStart;
  const targetSpan = targetEnd - targetStart;
  return keyframes.map((frame, index) => {
    if (index === 0) return { ...frame, [key]: targetStart };
    if (index === keyframes.length - 1) return { ...frame, [key]: targetEnd };
    const value = frame[key];
    if (value == null) return frame;
    if (oldSpan === 0) {
      const targetBaseline = targetStart + targetSpan * frame.offset;
      return { ...frame, [key]: targetBaseline + value - oldStart };
    }
    const ratio = (value - oldStart) / oldSpan;
    return { ...frame, [key]: targetStart + targetSpan * ratio };
  });
}

/**
 * A sparse persisted track overrides only the properties it owns. Missing
 * geometry is recovered from the compatibility composition or Zero source.
 * Generated matched tracks are rebased when node overrides move their exact
 * endpoints; user-owned geometry remains the persisted source of truth.
 */
export function fillMotionPlanGeometryFromComposition(
  value: MotionPlan | unknown,
  composition: CompositionTrack | undefined,
  source?: ZeroLayerMorphSource
): MotionPlan {
  const plan = normalizeMotionPlan(value);
  const stepByLayerId = new Map(
    (composition?.steps ?? [])
      .filter((step): step is CompositionStep & { layerId: string } => Boolean(step.layerId))
      .map((step) => [step.layerId, step])
  );
  if (stepByLayerId.size === 0 && !source) return plan;
  return normalizeMotionPlan({
    ...plan,
    stageDurationMs: 0,
    tracks: plan.tracks.map((track) => {
      const step = stepByLayerId.get(track.layerId);
      const sourceGeometry = source ? sourceGeometryForLayer(source, track.layerId) : undefined;
      if (!step && !sourceGeometry) return track;
      let keyframes = track.keyframes;
      for (const key of geometryKeys) {
        const ownsGeometry = keyframes.some((frame) => frame[key] != null);
        const initial = step?.initial?.[key] ?? sourceGeometry?.initial[key];
        const animate = step?.animate?.[key] ?? sourceGeometry?.animate[key];
        if (typeof initial !== "number" || typeof animate !== "number") continue;
        const sourceInitial = sourceGeometry?.initial[key];
        const sourceAnimate = sourceGeometry?.animate[key];
        if (
          sourceGeometry?.exactEndpoints &&
          typeof sourceInitial === "number" &&
          typeof sourceAnimate === "number" &&
          (track.source !== "user" || !ownsGeometry)
        ) {
          keyframes = rebaseGeometryKeyframes(keyframes, key, sourceInitial, sourceAnimate);
          continue;
        }
        if (ownsGeometry) continue;
        keyframes = rebaseGeometryKeyframes(keyframes, key, initial, animate);
      }
      return keyframes === track.keyframes ? track : { ...track, keyframes };
    })
  });
}

/**
 * Completes only missing matched tracks from the compatibility composition.
 * Persisted tracks remain authoritative; enter/exit stay on their legacy path
 * because standalone export applies expression stops only to matched layers.
 */
export function fillMissingMatchedMotionPlanTracks(
  value: MotionPlan | unknown,
  composition: CompositionTrack | undefined,
  source: ZeroLayerMorphSource
): MotionPlan {
  const plan = fillMotionPlanGeometryFromComposition(value, composition, source);
  if (!composition?.steps.length) return plan;
  const plannedLayerIds = new Set(plan.tracks.map((track) => track.layerId));
  const missingMatchedLayerIds = new Set(
    source.bindingResult.bindings
      .map((binding) => binding.layerId)
      .filter((layerId) => !plannedLayerIds.has(layerId))
  );
  if (missingMatchedLayerIds.size === 0) return plan;
  if (!composition.steps.some((step) => step.layerId && missingMatchedLayerIds.has(step.layerId))) {
    return plan;
  }
  const { motionPlan: _motionPlan, ...sourceWithoutPlan } = source;
  const fallbackPlan = compileMotionPlanFromRecipe({
    source: sourceWithoutPlan,
    steps: composition.steps
  });
  return fillMotionPlanGeometryFromComposition(
    {
      schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
      stageDurationMs: 0,
      tracks: [
        ...plan.tracks,
        ...fallbackPlan.tracks.filter((track) => missingMatchedLayerIds.has(track.layerId))
      ]
    },
    composition,
    source
  );
}

/** Shared global clock for MotionPlan tracks and any per-layer compatibility fallback. */
export function motionPlanPlaybackDurationMs(
  value: MotionPlan | unknown,
  composition: CompositionTrack | undefined
): number {
  const plan = normalizeMotionPlan(value);
  const compositionEnd = composition
    ? computeCompositionStepWindows(composition.steps).reduce(
        (latest, window) => Math.max(latest, window.end),
        0
      )
    : 0;
  return Math.max(plan.stageDurationMs, compositionEnd);
}

function stateFromKeyframe(frame: MotionKeyframe): MotionState {
  const state: MotionState = {};
  if (frame.x != null) state.x = frame.x;
  if (frame.y != null) state.y = frame.y;
  if (frame.width != null) state.width = frame.width;
  if (frame.height != null) state.height = frame.height;
  if (frame.scale != null) state.scale = frame.scale;
  if (frame.rotation != null) state.rotate = frame.rotation;
  if (frame.opacity != null) state.opacity = frame.opacity;
  return state;
}

function easingFromPhysics(physics: MotionPhysics | undefined): EasingSpec {
  if (!physics) return createClassicEasing("decelerate");
  if (physics.type === "spring") {
    return createSpringEasing({ stiffness: physics.stiffness, damping: physics.damping });
  }
  const preset = (Object.entries(classicCurves).find(([, curve]) =>
    curve.every((value, index) => value === physics.curve[index])
  )?.[0] ?? "standard") as ClassicEasingPreset;
  return createClassicEasing(preset);
}

/**
 * 为现有 CompositionStep 消费者投影 MotionPlan。传入 fallbackSteps 时保留
 * recipe 的展示、slot 和 metadata，只由 MotionPlan 接管时间窗、状态和曲线。
 */
export function deriveCompositionFromMotionPlan(
  value: MotionPlan | unknown,
  fallbackSteps: CompositionStep[] = []
): CompositionStep[] {
  const plan = normalizeMotionPlan(value);
  const fallbackWindows = new Map(
    computeCompositionStepWindows(fallbackSteps).map((window) => [window.stepId, window])
  );
  const fallbackByLayerId = new Map(
    fallbackSteps
      .filter((step): step is CompositionStep & { layerId: string } => Boolean(step.layerId))
      .map((step) => [step.layerId, step])
  );
  const tracks = plan.tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => a.track.timing.delayMs - b.track.timing.delayMs || a.index - b.index);
  const plannedEntries = tracks.map(({ track }, index) => {
    const fallback = fallbackByLayerId.get(track.layerId);
    const first = track.keyframes[0]!;
    const last = track.keyframes.at(-1)!;
    return {
      start: track.timing.delayMs,
      order: index,
      step: {
        id: fallback?.id ?? `motion-plan-${index}-${track.layerId}`,
        presetId: fallback?.presetId ?? "zero-layer-morph",
        label: fallback?.label ?? "Zero 图层动效",
        target: fallback?.target ?? "selected-layer",
        layerId: track.layerId,
        ...(fallback?.layerName ? { layerName: fallback.layerName } : {}),
        timing: "parallel" as const,
        delayMs: 0,
        durationMs: track.timing.durationMs,
        slot: fallback?.slot ?? "trajectory",
        initial: { ...(fallback?.initial ?? {}), ...stateFromKeyframe(first) },
        animate: { ...(fallback?.animate ?? {}), ...stateFromKeyframe(last) },
        easing: easingFromPhysics(track.physics),
        fillMode: fallback?.fillMode ?? "both",
        ...(fallback?.metadata ? { metadata: fallback.metadata } : {})
      } as CompositionStep
    };
  });
  const plannedLayerIds = new Set(plan.tracks.map((track) => track.layerId));
  const fallbackEntries = fallbackSteps.flatMap((step, index) => {
    if (step.layerId && plannedLayerIds.has(step.layerId)) return [];
    return [
      {
        start: fallbackWindows.get(step.id)?.start ?? 0,
        order: tracks.length + index,
        step
      }
    ];
  });
  const entries = [...plannedEntries, ...fallbackEntries].sort(
    (left, right) => left.start - right.start || left.order - right.order
  );
  let previousStart = 0;
  return entries.map((entry, index) => {
    const delayMs = index === 0 ? entry.start : Math.max(0, entry.start - previousStart);
    previousStart = entry.start;
    return { ...entry.step, timing: "parallel", delayMs };
  });
}
