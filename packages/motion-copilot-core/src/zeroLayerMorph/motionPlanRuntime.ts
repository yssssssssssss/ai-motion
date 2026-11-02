import { normalizeMotionPlan } from "./normalizeMotionPlan";
import type { LayerMotionTrack, MotionKeyframe, MotionPhysics, MotionPlan } from "./schema";

const stateKeys = ["x", "y", "width", "height", "scale", "rotation", "opacity"] as const;

export type SampledMotionPlanTrack = {
  layerId: string;
  nodeId: string;
  active: boolean;
  progress: number;
  state: Omit<MotionKeyframe, "offset" | "easing">;
};

export type CompileMotionPlanCssOptions = {
  namePrefix?: string;
  selectorForLayer?: (layerId: string) => string;
  timeVariable?: string;
};

export type MotionPlanRuntimeKeyframe = Omit<MotionKeyframe, "easing">;

export type CompiledMotionPlanTrack = {
  layerId: string;
  nodeId: string;
  timing: LayerMotionTrack["timing"];
  keyframes: MotionPlanRuntimeKeyframe[];
};

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function cubicBezierProgress(curve: [number, number, number, number], progress: number): number {
  const [x1, y1, x2, y2] = curve;
  const x = clamp(progress);
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const t = (low + high) / 2;
    const inverse = 1 - t;
    const estimate = 3 * inverse * inverse * t * x1 + 3 * inverse * t * t * x2 + t * t * t;
    if (estimate < x) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t;
}

function springProgress(stiffness: number, damping: number, progress: number, durationMs: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const elapsedSeconds = (progress * Math.max(0, durationMs)) / 1000;
  const naturalFrequency = Math.max(0.001, Math.sqrt(Math.max(0.001, stiffness)));
  const dampingRatio = Math.max(0, damping) / (2 * naturalFrequency);
  let response: number;
  if (dampingRatio < 1) {
    const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    const envelope = Math.exp(-dampingRatio * naturalFrequency * elapsedSeconds);
    response =
      1 -
      envelope *
        (Math.cos(dampedFrequency * elapsedSeconds) +
          ((dampingRatio * naturalFrequency) / dampedFrequency) * Math.sin(dampedFrequency * elapsedSeconds));
  } else if (dampingRatio === 1) {
    response = 1 - (1 + naturalFrequency * elapsedSeconds) * Math.exp(-naturalFrequency * elapsedSeconds);
  } else {
    const root = Math.sqrt(dampingRatio * dampingRatio - 1);
    const slow = -naturalFrequency * (dampingRatio - root);
    const fast = -naturalFrequency * (dampingRatio + root);
    response =
      1 - (fast * Math.exp(slow * elapsedSeconds) - slow * Math.exp(fast * elapsedSeconds)) / (fast - slow);
  }

  const tail = clamp((progress - 0.8) / 0.2);
  const settled = tail * tail * (3 - 2 * tail);
  return response + (1 - response) * settled;
}

function easingFor(
  frame: MotionKeyframe,
  physics: MotionPhysics | undefined,
  durationMs: number
): (progress: number) => number {
  if (frame.easing) return (progress) => cubicBezierProgress(frame.easing!, progress);
  if (physics?.type === "ease") return (progress) => cubicBezierProgress(physics.curve, progress);
  if (physics?.type === "spring")
    return (progress) => springProgress(physics.stiffness, physics.damping, progress, durationMs);
  return clamp;
}

function valueAt(
  keyframes: MotionKeyframe[],
  key: (typeof stateKeys)[number],
  progress: number,
  physics: MotionPhysics | undefined,
  durationMs: number
): number | undefined {
  let from: MotionKeyframe | undefined;
  let to: MotionKeyframe | undefined;
  for (const frame of keyframes) {
    if (frame[key] == null) continue;
    if (frame.offset <= progress) from = frame;
    if (frame.offset >= progress) {
      to = frame;
      break;
    }
  }
  if (!from) return to?.[key];
  if (!to) return from[key];
  if (from === to || to.offset === from.offset) return from[key];
  const local = (progress - from.offset) / (to.offset - from.offset);
  const eased = easingFor(from, physics, durationMs * (to.offset - from.offset))(local);
  const value = from[key]! + (to[key]! - from[key]!) * eased;
  return key === "opacity" ? clamp(value) : value;
}

function catmullRom(from: number, start: number, end: number, to: number, progress: number): number {
  const squared = progress * progress;
  const cubed = squared * progress;
  return (
    0.5 *
    (2 * start +
      (-from + end) * progress +
      (2 * from - 5 * start + 4 * end - to) * squared +
      (-from + 3 * start - 3 * end + to) * cubed)
  );
}

function pathPointAt(path: LayerMotionTrack["path"], progress: number): { x: number; y: number } | undefined {
  const points = path?.points;
  if (!points?.length) return undefined;
  if (points.length === 1) return points[0];
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index]!;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = segments.reduce((total, length) => total + length, 0);
  if (totalLength === 0) return points[0];

  const targetLength = clamp(progress) * totalLength;
  let traversed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segmentLength = segments[index]!;
    if (targetLength > traversed + segmentLength && index < segments.length - 1) {
      traversed += segmentLength;
      continue;
    }
    const from = points[index]!;
    const to = points[index + 1]!;
    const localProgress = clamp(segmentLength === 0 ? 0 : (targetLength - traversed) / segmentLength);
    if (points.length > 2) {
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[Math.min(points.length - 1, index + 2)]!;
      return {
        x: catmullRom(previous.x, from.x, to.x, next.x, localProgress),
        y: catmullRom(previous.y, from.y, to.y, next.y, localProgress)
      };
    }
    return {
      x: from.x + (to.x - from.x) * localProgress,
      y: from.y + (to.y - from.y) * localProgress
    };
  }
  return points.at(-1);
}

function sampleTrack(track: LayerMotionTrack, progress: number): MotionPlanRuntimeKeyframe {
  const state: MotionPlanRuntimeKeyframe = { offset: clamp(progress) };
  for (const key of stateKeys) {
    const valueAtProgress = valueAt(track.keyframes, key, progress, track.physics, track.timing.durationMs);
    if (valueAtProgress != null) state[key] = valueAtProgress;
  }
  const pathProgress = easingFor(track.keyframes[0]!, track.physics, track.timing.durationMs)(progress);
  const point = pathPointAt(track.path, pathProgress);
  if (point) {
    const pathStart = track.path?.points[0];
    const pathEnd = track.path?.points.at(-1);
    if (pathStart && pathEnd) {
      const baselineProgress = clamp(pathProgress);
      const baselineX = pathStart.x + (pathEnd.x - pathStart.x) * baselineProgress;
      const baselineY = pathStart.y + (pathEnd.y - pathStart.y) * baselineProgress;
      state.x = state.x == null ? point.x : state.x + point.x - baselineX;
      state.y = state.y == null ? point.y : state.y + point.y - baselineY;
    }
  }
  return state;
}

/** Samples a persisted MotionPlan without React, DOM, or a browser runtime. */
export function sampleMotionPlan(value: MotionPlan | unknown, timeMs: number): SampledMotionPlanTrack[] {
  const plan = normalizeMotionPlan(value);
  return plan.tracks.map((track) => {
    const progress =
      track.timing.durationMs <= 0 ? 1 : clamp((timeMs - track.timing.delayMs) / track.timing.durationMs);
    const { offset: _offset, ...state } = sampleTrack(track, progress);
    return {
      layerId: track.layerId,
      nodeId: track.nodeId,
      active: timeMs >= track.timing.delayMs && timeMs <= track.timing.delayMs + track.timing.durationMs,
      progress,
      state
    };
  });
}

/**
 * Bakes a MotionPlan into browser-neutral keyframes. Easing, springs, and paths
 * are sampled so the preview, WAAPI player, and CSS fallback share one trajectory.
 */
export function compileMotionPlanKeyframes(
  value: MotionPlan | unknown,
  samplesPerTrack = 24
): CompiledMotionPlanTrack[] {
  const plan = normalizeMotionPlan(value);
  const sampleCount = Math.max(2, Math.round(samplesPerTrack));
  return plan.tracks.map((track) => {
    const offsets = new Set(track.keyframes.map((frame) => frame.offset));
    if (track.physics || track.path || track.keyframes.some((frame) => frame.easing)) {
      for (let index = 0; index <= sampleCount; index += 1) offsets.add(index / sampleCount);
    }
    const keyframes = [...offsets]
      .sort((left, right) => left - right)
      .map((offset) => sampleTrack(track, offset));
    return { layerId: track.layerId, nodeId: track.nodeId, timing: track.timing, keyframes };
  });
}

function numberCss(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

function cssValue(frame: MotionPlanRuntimeKeyframe): string {
  const transform = [
    frame.x != null || frame.y != null
      ? `translate(${numberCss(frame.x ?? 0)}px,${numberCss(frame.y ?? 0)}px)`
      : "",
    frame.scale != null ? `scale(${frame.scale})` : "",
    frame.rotation != null ? `rotate(${numberCss(frame.rotation)}deg)` : ""
  ]
    .filter(Boolean)
    .join(" ");
  return [
    transform ? `transform:${transform}` : "",
    frame.width != null ? `width:${numberCss(frame.width)}px` : "",
    frame.height != null ? `height:${numberCss(frame.height)}px` : "",
    frame.opacity != null ? `opacity:${frame.opacity}` : ""
  ]
    .filter(Boolean)
    .join(";");
}

/** Compiles the same track timing and keyframes into standalone CSS animation rules. */
export function compileMotionPlanCss(
  value: MotionPlan | unknown,
  options: CompileMotionPlanCssOptions = {}
): string {
  const plan = normalizeMotionPlan(value);
  const prefix = options.namePrefix ?? "mc-motion-plan";
  const selectorForLayer =
    options.selectorForLayer ?? ((layerId: string) => `[data-motion-layer-id="${layerId}"]`);
  const timeVariable = options.timeVariable ?? "--mc-motion-plan-time";
  return compileMotionPlanKeyframes(plan)
    .map((track, index) => {
      const name = `${prefix}-${index}-${track.layerId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
      const frames = track.keyframes
        .map((frame) => `  ${frame.offset * 100}%{${cssValue(frame)}}`)
        .join("\n");
      return `@keyframes ${name}{\n${frames}\n}\n${selectorForLayer(track.layerId)}{animation:${name} ${track.timing.durationMs}ms linear calc(${track.timing.delayMs}ms - var(${timeVariable},0ms)) both;}`;
    })
    .join("\n");
}
