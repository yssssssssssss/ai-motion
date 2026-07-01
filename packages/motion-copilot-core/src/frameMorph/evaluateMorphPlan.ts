import type { FrameSnapshot, MorphIssue, MorphPlan } from "./schema";

const maxRecommendedDurationMs = 2000;

export function evaluateMorphPlan(
  plan: MorphPlan,
  frames?: { from?: FrameSnapshot; to?: FrameSnapshot }
): MorphIssue[] {
  const issues: MorphIssue[] = [...plan.issues];

  if (plan.durationMs > maxRecommendedDurationMs) {
    issues.push({
      id: "morph-duration-too-long",
      severity: "warning",
      title: "帧间过渡时长过长",
      reason: `当前时长 ${plan.durationMs}ms，超过推荐上限 ${maxRecommendedDurationMs}ms。`
    });
  }

  for (const track of plan.tracks) {
    if (!track.from && !track.to) {
      issues.push({
        id: `track-empty-${track.id}`,
        severity: "warning",
        title: "空动画轨道",
        reason: `轨道 ${track.id} 缺少 from/to 状态。`
      });
    }
  }

  for (const frame of [frames?.from, frames?.to]) {
    if (!frame) continue;
    for (const element of frame.elements) {
      if ((element.kind === "vector" || element.kind === "image") && !element.assetUrl) {
        issues.push({
          id: `asset-fallback-missing-${element.key}`,
          severity: "suggestion",
          title: "缺少资源兜底",
          reason: `${element.name} 是 ${element.kind} 元素，缺少 assetUrl 时只能按包围盒低保真预览。`,
          elementKey: element.key
        });
      }
    }
  }

  return issues;
}
