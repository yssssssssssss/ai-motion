import type { ZeroMotionSpec } from "./zeroMotionSpec";

export type ZeroMotionInteractionPatternType =
  | "dropdown-reveal"
  | "anchored-popover"
  | "container-expand"
  | "cascade-items"
  | "direct-morph"
  | "unknown";

export type ZeroMotionInteractionPattern = {
  type: ZeroMotionInteractionPatternType;
  label: string;
  confidence: number;
  reasons: string[];
};

function clampConfidence(value: number): number {
  return Math.max(0.35, Math.min(0.95, Number(value.toFixed(2))));
}

export function classifyZeroMotionInteractionPattern(spec: ZeroMotionSpec): ZeroMotionInteractionPattern {
  const enterExitCount = spec.topology.enterCount + spec.topology.exitCount;
  const reasons: string[] = [];

  if (
    spec.deltas.stageHeightDelta >= 48 &&
    spec.topology.enterCount >= 3 &&
    spec.deltas.enterAreaRatio >= 0.28
  ) {
    reasons.push(`尾帧高度增加 ${Math.round(spec.deltas.stageHeightDelta)}px`);
    reasons.push(
      `新增内容 ${spec.topology.enterCount} 个，面积占比 ${Math.round(spec.deltas.enterAreaRatio * 100)}%`
    );
    return {
      type: "dropdown-reveal",
      label: "下拉展开",
      confidence: clampConfidence(0.66 + spec.deltas.enterAreaRatio * 0.24),
      reasons
    };
  }

  if (
    (spec.scene.type === "modal-enter" || spec.scene.type === "card-enter") &&
    spec.topology.enterCount >= 1
  ) {
    reasons.push(`新增内容 ${spec.topology.enterCount} 个`);
    reasons.push("新增图层与触发区域存在浮层关系");
    return {
      type: "anchored-popover",
      label: "锚点浮层",
      confidence: clampConfidence(0.62 + Math.min(spec.topology.enterCount / 12, 0.18)),
      reasons
    };
  }

  if (
    spec.scene.type === "horizontal-expand" ||
    spec.scene.type === "vertical-expand" ||
    Math.abs(spec.deltas.dominantWidthDelta) >= 32 ||
    Math.abs(spec.deltas.dominantHeightDelta) >= 32
  ) {
    reasons.push("首尾帧存在明确容器尺寸变化");
    reasons.push(
      Math.abs(spec.deltas.dominantWidthDelta) >= Math.abs(spec.deltas.dominantHeightDelta)
        ? `主宽度变化 ${Math.round(spec.deltas.dominantWidthDelta)}px`
        : `主高度变化 ${Math.round(spec.deltas.dominantHeightDelta)}px`
    );
    return {
      type: "container-expand",
      label: "容器展开",
      confidence: clampConfidence(0.62 + Math.min(Math.abs(spec.deltas.dominantAreaDeltaRatio), 0.25)),
      reasons
    };
  }

  if (spec.scene.type === "list-reorder" || spec.deltas.yMotionCount >= 3 || spec.topology.enterCount >= 3) {
    reasons.push(`纵向变化图层 ${spec.deltas.yMotionCount} 个`);
    reasons.push(`新增/离开图层 ${enterExitCount} 个`);
    return {
      type: "cascade-items",
      label: "内容错峰",
      confidence: clampConfidence(
        0.58 + Math.min((spec.deltas.yMotionCount + spec.topology.enterCount) / 20, 0.22)
      ),
      reasons
    };
  }

  if (spec.topology.matchedCount > 0 && enterExitCount === 0) {
    reasons.push("以 matched 图层形变为主");
    reasons.push("没有新增或离开图层");
    return {
      type: "direct-morph",
      label: "直接形变",
      confidence: 0.64,
      reasons
    };
  }

  return {
    type: "unknown",
    label: "未知模式",
    confidence: 0.4,
    reasons: ["首尾帧缺少稳定的主导交互模式"]
  };
}
