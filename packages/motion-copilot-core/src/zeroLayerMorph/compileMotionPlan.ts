import {
  createClassicEasing,
  createSpringEasing,
  type ClassicEasingPreset,
  type CompositionStep,
  type EasingSpec,
  type MotionState
} from "../schema/document";
import { computeCompositionStepWindows } from "../composition/evaluateComposition";
import { layerIdForNode } from "./layerId";
import { MOTION_PLAN_SCHEMA_VERSION, normalizeMotionPlan } from "./normalizeMotionPlan";
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
    const initialOffset = durationMs === 0 ? 0 : (item.start - start) / durationMs;
    const animateOffset = durationMs === 0 ? 1 : (item.end - start) / durationMs;
    addKeyframe(keyframes, keyframeFromState(initialOffset, item.step.initial));
    addKeyframe(keyframes, keyframeFromState(animateOffset, item.step.animate));
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
  const stageDurationMs = Math.max(
    existing.stageDurationMs,
    ...recipeTracks.map((track) => track.timing.delayMs + track.timing.durationMs)
  );

  return normalizeMotionPlan({
    schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
    tracks: [...recipeTracks, ...userTracks],
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
    stageDurationMs: Math.max(regenerated.stageDurationMs, existing.stageDurationMs),
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
  const fallbackByLayerId = new Map(
    fallbackSteps
      .filter((step): step is CompositionStep & { layerId: string } => Boolean(step.layerId))
      .map((step) => [step.layerId, step])
  );
  const tracks = plan.tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => a.track.timing.delayMs - b.track.timing.delayMs || a.index - b.index);
  let previousStart = 0;
  const steps = tracks.map(({ track }, index) => {
    const fallback = fallbackByLayerId.get(track.layerId);
    const first = track.keyframes[0]!;
    const last = track.keyframes.at(-1)!;
    const start = track.timing.delayMs;
    const delayMs = index === 0 ? start : Math.max(0, start - previousStart);
    previousStart = start;
    return {
      id: fallback?.id ?? `motion-plan-${index}-${track.layerId}`,
      presetId: fallback?.presetId ?? "zero-layer-morph",
      label: fallback?.label ?? "Zero 图层动效",
      target: fallback?.target ?? "selected-layer",
      layerId: track.layerId,
      ...(fallback?.layerName ? { layerName: fallback.layerName } : {}),
      timing: "parallel" as const,
      delayMs,
      durationMs: track.timing.durationMs,
      slot: fallback?.slot ?? "trajectory",
      initial: { ...(fallback?.initial ?? {}), ...stateFromKeyframe(first) },
      animate: { ...(fallback?.animate ?? {}), ...stateFromKeyframe(last) },
      easing: easingFromPhysics(track.physics),
      fillMode: fallback?.fillMode ?? "both",
      ...(fallback?.metadata ? { metadata: fallback.metadata } : {})
    } as CompositionStep;
  });
  const plannedLayerIds = new Set(plan.tracks.map((track) => track.layerId));
  return [...steps, ...fallbackSteps.filter((step) => !step.layerId || !plannedLayerIds.has(step.layerId))];
}
