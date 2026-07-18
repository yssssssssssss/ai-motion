import type {
  LayerMotionTrack,
  MotionKeyframe,
  MotionPersonality,
  MotionPhysics,
  MotionPlan,
  MotionTrackKind,
  MotionTrackSource
} from "./schema";

export const MOTION_PLAN_SCHEMA_VERSION = "motion-copilot.motion-plan.v1" as const;

const trackKinds = new Set<MotionTrackKind>(["morph", "enter", "exit", "emphasis", "path"]);
const trackSources = new Set<MotionTrackSource>(["llm", "rule", "user"]);
const numericKeyframeKeys = ["x", "y", "width", "height", "scale", "rotation", "opacity"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nonNegative(value: unknown, fallback = 0): number {
  const num = finiteNumber(value);
  return num != null ? Math.max(0, num) : fallback;
}

function cubicBezier(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const nums = value.map((entry) => finiteNumber(entry));
  if (nums.some((entry) => entry == null)) return undefined;
  return nums as [number, number, number, number];
}

function normalizePhysics(value: unknown): MotionPhysics | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type === "spring") {
    const stiffness = finiteNumber(value.stiffness);
    const damping = finiteNumber(value.damping);
    if (stiffness == null || damping == null) return undefined;
    return { type: "spring", stiffness: Math.max(0, stiffness), damping: Math.max(0, damping) };
  }
  if (value.type === "ease") {
    const curve = cubicBezier(value.curve);
    return curve ? { type: "ease", curve } : undefined;
  }
  return undefined;
}

function normalizePersonality(value: unknown): MotionPersonality | undefined {
  if (!isRecord(value)) return undefined;
  const energy = finiteNumber(value.energy);
  const bounce = finiteNumber(value.bounce);
  const sharpness = finiteNumber(value.sharpness);
  if (energy == null && bounce == null && sharpness == null) return undefined;
  return {
    energy: clamp(energy ?? 0, 0, 1),
    bounce: clamp(bounce ?? 0, 0, 1),
    sharpness: clamp(sharpness ?? 0, 0, 1)
  };
}

function normalizePath(value: unknown): { points: Array<{ x: number; y: number }> } | undefined {
  if (!isRecord(value) || !Array.isArray(value.points)) return undefined;
  const points = value.points
    .map((point) => {
      if (!isRecord(point)) return undefined;
      const x = finiteNumber(point.x);
      const y = finiteNumber(point.y);
      return x != null && y != null ? { x, y } : undefined;
    })
    .filter((point): point is { x: number; y: number } => point != null);
  return points.length > 0 ? { points } : undefined;
}

function normalizeKeyframe(value: unknown): MotionKeyframe | undefined {
  if (!isRecord(value)) return undefined;
  const offset = finiteNumber(value.offset);
  if (offset == null) return undefined;
  const keyframe: MotionKeyframe = { offset: clamp(offset, 0, 1) };
  for (const key of numericKeyframeKeys) {
    const num = finiteNumber(value[key]);
    if (num != null) keyframe[key] = num;
  }
  const easing = cubicBezier(value.easing);
  if (easing) keyframe.easing = easing;
  return keyframe;
}

function normalizeKeyframes(value: unknown): MotionKeyframe[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeKeyframe)
    .filter((frame): frame is MotionKeyframe => frame != null)
    .sort((a, b) => a.offset - b.offset);
}

function normalizeTrack(value: unknown): LayerMotionTrack | undefined {
  if (!isRecord(value)) return undefined;
  const layerId = typeof value.layerId === "string" ? value.layerId : undefined;
  const nodeId = typeof value.nodeId === "string" ? value.nodeId : undefined;
  if (!layerId || !nodeId) return undefined;
  const kind = trackKinds.has(value.kind as MotionTrackKind) ? (value.kind as MotionTrackKind) : "morph";
  const source = trackSources.has(value.source as MotionTrackSource)
    ? (value.source as MotionTrackSource)
    : "rule";
  const timing = isRecord(value.timing) ? value.timing : {};
  const track: LayerMotionTrack = {
    layerId,
    nodeId,
    kind,
    keyframes: normalizeKeyframes(value.keyframes),
    timing: { delayMs: nonNegative(timing.delayMs), durationMs: nonNegative(timing.durationMs) },
    source
  };
  const physics = normalizePhysics(value.physics);
  if (physics) track.physics = physics;
  const path = normalizePath(value.path);
  if (path) track.path = path;
  const overshoot = finiteNumber(value.overshoot);
  if (overshoot != null) track.overshoot = Math.max(0, overshoot);
  const personality = normalizePersonality(value.personality);
  if (personality) track.personality = personality;
  return track;
}

/**
 * 把持久化/生成得到的 MotionPlan 归一化为干净可播放的一等数据：
 * 校验 schema、钳制数值范围、按 offset 排序关键帧、丢弃无效轨道。
 * 无效或缺失输入返回空 plan（stageDurationMs 至少为 0），不抛异常，保证 restore 路径不崩。
 */
export function normalizeMotionPlan(value: unknown): MotionPlan {
  const source = isRecord(value) ? value : {};
  const tracks = Array.isArray(source.tracks)
    ? source.tracks.map(normalizeTrack).filter((track): track is LayerMotionTrack => track != null)
    : [];
  return {
    schemaVersion: MOTION_PLAN_SCHEMA_VERSION,
    tracks,
    stageDurationMs: nonNegative(source.stageDurationMs)
  };
}
