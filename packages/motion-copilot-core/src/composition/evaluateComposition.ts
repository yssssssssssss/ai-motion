import {
  type CompositionIssue,
  type CompositionStep,
  type CompositionStepWindow,
  type CompositionTrack
} from "../schema/document";

/** 组合轨道最大允许总时长（ms） */
const MAX_TOTAL_DURATION_MS = 2000;

export function computeCompositionStepWindows(steps: CompositionStep[]): CompositionStepWindow[] {
  const result: CompositionStepWindow[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    let start: number;

    if (i === 0) {
      start = step.delayMs;
    } else if (step.timing === "sequential") {
      // 串行：前一个结束后 + delay
      const prev = result[i - 1]!;
      start = prev.end + step.delayMs;
    } else {
      // 并行：前一个开始后 + delay
      const prev = result[i - 1]!;
      start = prev.start + step.delayMs;
    }

    start = Math.max(0, start);
    const end = start + step.durationMs;
    result.push({ stepId: step.id, start, end });
  }

  return result;
}

/**
 * 校验组合轨道的合法性，返回 CompositionTrack（含 issues 和 totalDurationMs）
 */
export function evaluateComposition(steps: CompositionStep[]): CompositionTrack {
  const issues: CompositionIssue[] = [];
  const times = computeCompositionStepWindows(steps);
  const totalDurationMs = times.length > 0 ? Math.max(...times.map((t) => t.end)) : 0;

  // 规则 1：总时长不超过上限
  if (totalDurationMs > MAX_TOTAL_DURATION_MS) {
    issues.push({
      id: "composition-too-long",
      stepId: steps[steps.length - 1]?.id ?? "",
      severity: "warning",
      title: "组合时长过长",
      reason: `当前组合总时长 ${totalDurationMs}ms，超过推荐上限 ${MAX_TOTAL_DURATION_MS}ms，用户可能感到拖沓。`
    });
  }

  // 规则 2：同一 target + 同一 slot 不能重复出现（同类互斥）
  const slotTargetMap = new Map<string, CompositionStep>();
  for (const step of steps) {
    const key = `${step.target}:${step.layerId ?? "primary"}:${step.slot}`;
    const existing = slotTargetMap.get(key);
    if (existing) {
      issues.push({
        id: `slot-conflict-${step.id}`,
        stepId: step.id,
        severity: "warning",
        title: "同类动效冲突",
        reason: `「${step.label}」与「${existing.label}」同属 ${step.slot} 槽位，作用于同一对象，后者会覆盖前者。`
      });
    }
    slotTargetMap.set(key, step);
  }

  // 规则 3：单个 step 时长不能太短（< 60ms）或太长（> 800ms）
  for (const step of steps) {
    if (step.durationMs < 60) {
      issues.push({
        id: `step-too-short-${step.id}`,
        stepId: step.id,
        severity: "info",
        title: "片段时长过短",
        reason: `「${step.label}」时长仅 ${step.durationMs}ms，可能无法被人眼感知。`
      });
    }
    if (step.durationMs > 800) {
      issues.push({
        id: `step-too-long-${step.id}`,
        stepId: step.id,
        severity: "suggestion",
        title: "片段时长偏长",
        reason: `「${step.label}」时长 ${step.durationMs}ms，单独动效建议控制在 800ms 以内。`
      });
    }
  }

  // 规则 4：骨架屏不能与位移类动效在同一 target 上并存
  const skeletonSteps = steps.filter((s) => s.presetId === "skeleton-loading");
  const motionSlots = new Set(["trajectory", "scene", "feedback"]);
  for (const skeleton of skeletonSteps) {
    const targetKey = `${skeleton.target}:${skeleton.layerId ?? "primary"}`;
    const conflicting = steps.find(
      (s) => s.id !== skeleton.id && `${s.target}:${s.layerId ?? "primary"}` === targetKey && motionSlots.has(s.slot)
    );
    if (conflicting) {
      issues.push({
        id: `skeleton-motion-conflict-${skeleton.id}`,
        stepId: skeleton.id,
        severity: "warning",
        title: "骨架屏与位移冲突",
        reason: `骨架屏只允许透明度变化，但组合中包含「${conflicting.label}」会引入位移，两者不可共存。`
      });
    }
  }

  return { steps, issues, totalDurationMs };
}
