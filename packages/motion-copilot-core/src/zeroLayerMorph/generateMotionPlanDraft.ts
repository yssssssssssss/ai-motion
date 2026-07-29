import { normalizeMotionPlan } from "./normalizeMotionPlan";
import { sampleMotionPlan } from "./motionPlanRuntime";
import type {
  LayerMotionTrack,
  MotionPhysics,
  MotionPlan,
  MotionTrackKind,
  ZeroLayerMorphSource
} from "./schema";

const draftTargets = ["morph", "enter", "exit", "emphasis"] as const;
const draftCurves = ["linear", "standard", "decelerate", "spring"] as const;
const draftPaths = ["straight", "arc-up", "arc-down"] as const;
const draftIntents = ["spatial-morph", "content-reveal", "state-feedback", "navigation"] as const;

type MotionPlanDraftTarget = (typeof draftTargets)[number];
type MotionPlanDraftCurve = (typeof draftCurves)[number];
type MotionPlanDraftPath = (typeof draftPaths)[number];

export type MotionPlanDraftTrack = {
  target: MotionPlanDraftTarget;
  delayScale: number;
  durationScale: number;
  staggerMs: number;
  curve: MotionPlanDraftCurve;
  path: MotionPlanDraftPath;
  personality: { energy: number; bounce: number; sharpness: number };
};

export type MotionPlanDraft = {
  intent: (typeof draftIntents)[number];
  rationale: string;
  tracks: MotionPlanDraftTrack[];
};

export type MotionPlanDraftResponse = {
  candidates: MotionPlanDraft[];
};

export const motionPlanDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          intent: { type: "string", enum: draftIntents },
          rationale: { type: "string" },
          tracks: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                target: { type: "string", enum: draftTargets },
                delayScale: { type: "number", minimum: 0, maximum: 2 },
                durationScale: { type: "number", minimum: 0.4, maximum: 2 },
                staggerMs: { type: "number", minimum: 0, maximum: 400 },
                curve: { type: "string", enum: draftCurves },
                path: { type: "string", enum: draftPaths },
                personality: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    energy: { type: "number", minimum: 0, maximum: 1 },
                    bounce: { type: "number", minimum: 0, maximum: 1 },
                    sharpness: { type: "number", minimum: 0, maximum: 1 }
                  },
                  required: ["energy", "bounce", "sharpness"]
                }
              },
              required: ["target", "delayScale", "durationScale", "staggerMs", "curve", "path", "personality"]
            }
          }
        },
        required: ["intent", "rationale", "tracks"]
      }
    }
  },
  required: ["candidates"]
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isBoundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isDraftTrack(value: unknown): value is MotionPlanDraftTrack {
  if (!isRecord(value)) return false;
  if (
    !hasOnlyKeys(value, [
      "target",
      "delayScale",
      "durationScale",
      "staggerMs",
      "curve",
      "path",
      "personality"
    ])
  ) {
    return false;
  }
  if (!draftTargets.includes(value.target as MotionPlanDraftTarget)) return false;
  if (!draftCurves.includes(value.curve as MotionPlanDraftCurve)) return false;
  if (!draftPaths.includes(value.path as MotionPlanDraftPath)) return false;
  if (!isBoundedNumber(value.delayScale, 0, 2)) return false;
  if (!isBoundedNumber(value.durationScale, 0.4, 2)) return false;
  if (!isBoundedNumber(value.staggerMs, 0, 400) || !isRecord(value.personality)) return false;
  if (!hasOnlyKeys(value.personality, ["energy", "bounce", "sharpness"])) return false;
  return (
    isBoundedNumber(value.personality.energy, 0, 1) &&
    isBoundedNumber(value.personality.bounce, 0, 1) &&
    isBoundedNumber(value.personality.sharpness, 0, 1)
  );
}

function isDraft(value: unknown): value is MotionPlanDraft {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ["intent", "rationale", "tracks"])) return false;
  return (
    draftIntents.includes(value.intent as MotionPlanDraft["intent"]) &&
    typeof value.rationale === "string" &&
    Array.isArray(value.tracks) &&
    value.tracks.length > 0 &&
    value.tracks.length <= 4 &&
    value.tracks.every(isDraftTrack)
  );
}

export function isMotionPlanDraftResponse(value: unknown): value is MotionPlanDraftResponse {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["candidates"]) &&
    Array.isArray(value.candidates) &&
    value.candidates.length > 0 &&
    value.candidates.length <= 3 &&
    value.candidates.every(isDraft)
  );
}

export function parseMotionPlanDraftResponse(text: string): MotionPlanDraftResponse | null {
  try {
    const value = JSON.parse(text) as unknown;
    return isMotionPlanDraftResponse(value) ? value : null;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function physicsFor(
  curve: MotionPlanDraftCurve,
  personality: MotionPlanDraftTrack["personality"]
): MotionPhysics {
  if (curve === "spring") {
    return {
      type: "spring",
      stiffness: Math.round(120 + personality.energy * 180),
      damping: Math.round(26 - personality.bounce * 14)
    };
  }
  if (curve === "linear") return { type: "ease", curve: [0, 0, 1, 1] };
  if (curve === "decelerate") return { type: "ease", curve: [0.18, 0.86, 0.22, 1] };
  return { type: "ease", curve: [0.35, 0, 0.25, 1] };
}

function pathFor(track: LayerMotionTrack, path: MotionPlanDraftPath): LayerMotionTrack["path"] | undefined {
  if (path === "straight") return undefined;
  const first = track.keyframes[0]!;
  const last = track.keyframes.at(-1)!;
  const start = { x: first.x ?? 0, y: first.y ?? 0 };
  const end = { x: last.x ?? start.x, y: last.y ?? start.y };
  const amplitude = Math.max(
    12,
    Math.min(80, Math.abs(end.x - start.x) * 0.3 + Math.abs(end.y - start.y) * 0.2)
  );
  return {
    points: [
      start,
      { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 + (path === "arc-up" ? -amplitude : amplitude) },
      end
    ]
  };
}

function draftForTrack(draft: MotionPlanDraft, kind: MotionTrackKind): MotionPlanDraftTrack | undefined {
  if (kind === "path") return draft.tracks.find((item) => item.target === "morph");
  return draft.tracks.find((item) => item.target === kind);
}

/** Binds a schema-limited LLM draft onto existing tracks without allowing it to address nodes or pixels. */
export function assembleMotionPlanFromDraft(
  fallback: MotionPlan | unknown,
  draft: MotionPlanDraft
): MotionPlan {
  const plan = normalizeMotionPlan(fallback);
  const occurrenceByKind = new Map<MotionTrackKind, number>();
  return normalizeMotionPlan({
    ...plan,
    tracks: plan.tracks.map((track) => {
      if (track.source === "user") return track;
      const directive = draftForTrack(draft, track.kind);
      if (!directive) return track;
      const occurrence = occurrenceByKind.get(track.kind) ?? 0;
      occurrenceByKind.set(track.kind, occurrence + 1);
      const { path: _existingPath, ...trackWithoutPath } = track;
      return {
        ...trackWithoutPath,
        timing: {
          delayMs: clamp(
            Math.round(track.timing.delayMs * directive.delayScale + occurrence * directive.staggerMs),
            0,
            1600
          ),
          durationMs: clamp(Math.round(track.timing.durationMs * directive.durationScale), 80, 1200)
        },
        physics: physicsFor(directive.curve, directive.personality),
        ...(directive.path === "straight" ? {} : { path: pathFor(track, directive.path) }),
        personality: directive.personality,
        source: "llm" as const
      };
    })
  });
}

function planSampleDistance(left: MotionPlan, right: MotionPlan): number {
  const totalDuration = Math.max(left.stageDurationMs, right.stageDurationMs, 1);
  let distance = 0;
  for (const progress of [0.25, 0.5, 0.75]) {
    const leftByLayer = new Map(
      sampleMotionPlan(left, totalDuration * progress).map((track) => [track.layerId, track])
    );
    const rightByLayer = new Map(
      sampleMotionPlan(right, totalDuration * progress).map((track) => [track.layerId, track])
    );
    for (const layerId of new Set([...leftByLayer.keys(), ...rightByLayer.keys()])) {
      const leftState = leftByLayer.get(layerId)?.state ?? {};
      const rightState = rightByLayer.get(layerId)?.state ?? {};
      distance += Math.abs((leftState.x ?? 0) - (rightState.x ?? 0)) / 100;
      distance += Math.abs((leftState.y ?? 0) - (rightState.y ?? 0)) / 100;
      distance += Math.abs((leftState.width ?? 0) - (rightState.width ?? 0)) / 100;
      distance += Math.abs((leftState.height ?? 0) - (rightState.height ?? 0)) / 100;
      distance += Math.abs((leftState.scale ?? 1) - (rightState.scale ?? 1));
      distance += Math.abs((leftState.rotation ?? 0) - (rightState.rotation ?? 0)) / 90;
      distance += Math.abs((leftState.opacity ?? 1) - (rightState.opacity ?? 1));
    }
  }
  return distance;
}

export type MotionPlanDraftSelection = {
  motionPlan: MotionPlan;
  selectedCandidate?: number | undefined;
  rejectionReason?: string | undefined;
};

/** Rejects candidates whose intermediate states are visually equivalent to the fallback or an earlier candidate. */
export function selectDistinctMotionPlanDraft(
  fallback: MotionPlan | unknown,
  candidates: MotionPlanDraft[]
): MotionPlanDraftSelection {
  const baseline = normalizeMotionPlan(fallback);
  const accepted: MotionPlan[] = [baseline];
  for (const [index, candidate] of candidates.entries()) {
    const motionPlan = assembleMotionPlanFromDraft(baseline, candidate);
    if (accepted.every((existing) => planSampleDistance(existing, motionPlan) >= 0.08)) {
      return { motionPlan, selectedCandidate: index };
    }
    accepted.push(motionPlan);
  }
  return { motionPlan: baseline, rejectionReason: "候选方案在中间采样中没有可感知差异，已保留规则方案。" };
}

/** Builds the limited structural context that is safe for the model to rank. */
export function buildMotionPlanDraftPromptContext(source: ZeroLayerMorphSource): string {
  const plan = normalizeMotionPlan(source.motionPlan);
  const counts = draftTargets.map(
    (target) => `${target}:${plan.tracks.filter((track) => track.kind === target).length}`
  );
  return [
    "你是京东帧间动效编排助手。只输出节奏意图，不能输出 nodeId、layerId、坐标、尺寸、关键帧或 CSS。",
    "系统会把你的类别建议确定性绑定到已有图层轨道，并保留所有 user 轨道。",
    "每个候选必须在 25/50/75% 形成可感知差异；不要仅更换标签或曲线名称。",
    `可用轨道类别：${counts.join("，")}。`,
    "target 只可选 morph / enter / exit / emphasis；path 仅可选 straight / arc-up / arc-down。",
    "通常给 2 个候选，优先体现明确的空间、内容或反馈节奏差异。"
  ].join("\n");
}
