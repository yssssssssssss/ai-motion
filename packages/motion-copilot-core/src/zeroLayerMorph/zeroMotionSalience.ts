import type { CompositionStep } from "../schema/document";
import type { ZeroLayerRecipeAdaptedParameters } from "./adaptZeroLayerRecipeParameters";
import type { ZeroMotionSpec } from "./zeroMotionSpec";

export type ZeroMotionSalienceReport = {
  schemaVersion: "motion-copilot.zero-motion-salience.v1";
  score: number;
  diagnosis: "too-subtle" | "balanced" | "too-strong";
  factors: {
    positionDelta: number;
    sizeDelta: number;
    opacityDelta: number;
    enterExit: number;
    stagger: number;
    areaChange: number;
  };
  evidence: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function maxDelay(steps: CompositionStep[] | undefined): number {
  return Math.max(0, ...(steps ?? []).map((step) => step.delayMs ?? 0));
}

function opacityDelta(steps: CompositionStep[] | undefined): number {
  return Math.max(
    0,
    ...(steps ?? []).map((step) => Math.abs((step.animate?.opacity ?? 1) - (step.initial?.opacity ?? 1)))
  );
}

export function evaluateZeroMotionSalience(input: {
  spec: ZeroMotionSpec;
  steps?: CompositionStep[];
  adaptedParameters?: ZeroLayerRecipeAdaptedParameters;
}): ZeroMotionSalienceReport {
  const { spec, steps, adaptedParameters } = input;
  const factors = {
    positionDelta: clamp((spec.deltas.averageMoveDistance / 48) * 100),
    sizeDelta: clamp(
      ((Math.abs(spec.deltas.dominantWidthDelta) + Math.abs(spec.deltas.dominantHeightDelta)) / 120) * 100
    ),
    opacityDelta: clamp(opacityDelta(steps) * 100),
    enterExit: clamp(((spec.topology.enterCount + spec.topology.exitCount) / 5) * 100),
    stagger: clamp(((adaptedParameters?.staggerMs ?? maxDelay(steps)) / 72) * 100),
    areaChange: clamp(Math.abs(spec.deltas.dominantAreaDeltaRatio) * 100)
  };
  const score = clamp(
    factors.positionDelta * 0.22 +
      factors.sizeDelta * 0.2 +
      factors.opacityDelta * 0.15 +
      factors.enterExit * 0.14 +
      factors.stagger * 0.16 +
      factors.areaChange * 0.13
  );
  const diagnosis = score < 40 ? "too-subtle" : score > 84 ? "too-strong" : "balanced";
  const evidence: string[] = [];
  if (diagnosis === "too-subtle") {
    evidence.push("首尾帧几何或透明度变化较弱");
    if (factors.stagger < 25) evidence.push("当前时间错峰不足，变化节奏不明显");
  } else if (diagnosis === "too-strong") {
    evidence.push("多个显著度指标同时偏高，建议确认是否过度");
  } else {
    evidence.push("当前动效显著度处于可感知区间");
  }
  if (adaptedParameters) evidence.push(`场景适配参数：${adaptedParameters.summary}`);

  return {
    schemaVersion: "motion-copilot.zero-motion-salience.v1",
    score,
    diagnosis,
    factors,
    evidence
  };
}
