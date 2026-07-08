export type ZeroMotionSceneType =
  | "horizontal-expand"
  | "vertical-expand"
  | "list-reorder"
  | "tab-switch"
  | "card-enter"
  | "modal-enter"
  | "complex-state-change"
  | "unknown";

export type ZeroMotionSceneInput = {
  matchedCount: number;
  enterCount: number;
  exitCount: number;
  unresolvedCount: number;
  lowConfidenceCount: number;
  stageWidthDelta: number;
  stageHeightDelta: number;
  dominantWidthDelta: number;
  dominantHeightDelta: number;
  dominantAreaDeltaRatio: number;
  averageMoveDistance: number;
  xMotionCount: number;
  yMotionCount: number;
  textChangeCount: number;
  enterAreaRatio: number;
};

export type ZeroMotionSceneClassification = {
  type: ZeroMotionSceneType;
  confidence: number;
  reasons: string[];
};

function confidence(value: number): number {
  return Math.max(0.35, Math.min(0.95, Number(value.toFixed(2))));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function classifyZeroMotionScene(input: ZeroMotionSceneInput): ZeroMotionSceneClassification {
  const widthRatio = Math.abs(input.dominantWidthDelta) / Math.max(1, Math.abs(input.dominantWidthDelta) + 120);
  const heightRatio = Math.abs(input.dominantHeightDelta) / Math.max(1, Math.abs(input.dominantHeightDelta) + 120);
  const hasMeaningfulWidthChange = Math.abs(input.stageWidthDelta) >= 32 || Math.abs(input.dominantWidthDelta) >= 32;
  const hasMeaningfulHeightChange = Math.abs(input.stageHeightDelta) >= 32 || Math.abs(input.dominantHeightDelta) >= 32;
  const enterExitCount = input.enterCount + input.exitCount;

  if (input.enterAreaRatio >= 0.32 && input.enterCount >= 1) {
    return {
      type: input.enterAreaRatio >= 0.72 ? "modal-enter" : "card-enter",
      confidence: confidence(0.68 + input.enterAreaRatio * 0.25),
      reasons: [
        `尾帧新增图层面积占比 ${percent(input.enterAreaRatio)}`,
        `新增图层 ${input.enterCount} 个，高于常规状态切换`
      ]
    };
  }

  if (input.matchedCount >= 4 && input.yMotionCount >= 3 && input.yMotionCount >= input.xMotionCount) {
    return {
      type: "list-reorder",
      confidence: confidence(0.64 + Math.min(input.yMotionCount / 10, 0.24)),
      reasons: [
        `${input.yMotionCount} 个 matched 图层存在纵向位置变化`,
        "多图层按空间顺序移动，更接近列表重排"
      ]
    };
  }

  if (
    hasMeaningfulWidthChange &&
    Math.abs(input.dominantWidthDelta) >= Math.abs(input.dominantHeightDelta) * 1.25
  ) {
    return {
      type: "horizontal-expand",
      confidence: confidence(0.62 + widthRatio * 0.3),
      reasons: [
        `主图层宽度变化 ${Math.round(input.dominantWidthDelta)}px`,
        "首尾帧变化主要发生在横向空间"
      ]
    };
  }

  if (
    hasMeaningfulHeightChange &&
    Math.abs(input.dominantHeightDelta) > Math.abs(input.dominantWidthDelta) * 1.15
  ) {
    return {
      type: "vertical-expand",
      confidence: confidence(0.62 + heightRatio * 0.3),
      reasons: [
        `主图层高度变化 ${Math.round(input.dominantHeightDelta)}px`,
        "首尾帧变化主要发生在纵向空间"
      ]
    };
  }

  if (
    input.textChangeCount > 0 &&
    Math.abs(input.dominantAreaDeltaRatio) < 0.28 &&
    input.averageMoveDistance < 18
  ) {
    return {
      type: "tab-switch",
      confidence: confidence(0.62 + Math.min(input.textChangeCount / 8, 0.22)),
      reasons: [
        `${input.textChangeCount} 个文本图层发生内容变化`,
        "主结构位移和尺寸变化较小，更接近状态/Tab 切换"
      ]
    };
  }

  if (input.matchedCount >= 5 && enterExitCount >= 3 && input.averageMoveDistance >= 12) {
    return {
      type: "complex-state-change",
      confidence: confidence(0.58 + Math.min((input.matchedCount + enterExitCount) / 30, 0.24)),
      reasons: [
        `matched ${input.matchedCount} 个，新增/离开 ${enterExitCount} 个`,
        "多类图层同时变化，单一动效模式覆盖风险较高"
      ]
    };
  }

  if (input.unresolvedCount > 0 || input.lowConfidenceCount > 0) {
    return {
      type: "unknown",
      confidence: 0.42,
      reasons: [
        `存在 ${input.unresolvedCount} 个未解析图层、${input.lowConfidenceCount} 个低置信匹配`,
        "需要先保持稳妥方案或人工确认配对"
      ]
    };
  }

  return {
    type: "unknown",
    confidence: 0.4,
    reasons: ["首尾帧变化幅度较小或缺少明确主导图层"]
  };
}
