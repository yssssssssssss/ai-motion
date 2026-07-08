import type { CompositionStep } from "../schema/document";

export type ZeroLayerExpressionStrategyId =
  | "linear-morph"
  | "staged-container"
  | "delayed-follow"
  | "axis-expand-contained"
  | "clip-reveal-x"
  | "clip-reveal-y"
  | "content-cross-replace"
  | "list-push-insert"
  | "indicator-slide"
  | "sheet-rise-contained"
  | "emphasis-pulse-contained"
  | "spring-settle-contained"
  | "status-snap-replace"
  | "mask-scan-reveal"
  | "dropdown-accordion-y"
  | "anchor-pop-contained"
  | "focus-shift-contained"
  | "list-reorder-cascade";

export type ZeroLayerExpressionStop = {
  percent: number;
  progress: number;
  opacity?: number;
};

export type ZeroLayerExpressionStrategy = {
  id: ZeroLayerExpressionStrategyId;
  label: string;
  summary: string;
  stops: ZeroLayerExpressionStop[];
};

export const zeroLayerExpressionStrategies: ZeroLayerExpressionStrategy[] = [
  {
    id: "linear-morph",
    label: "线性首尾过渡",
    summary: "保守地从首帧插值到尾帧，用作安全兜底。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "staged-container",
    label: "容器分阶段",
    summary: "容器先完成主要形变，后续内容再跟随。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 58, progress: 1 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "delayed-follow",
    label: "延迟跟随",
    summary: "内容先保持首帧，再追随容器进入尾帧。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 42, progress: 0 },
      { percent: 76, progress: 0.72 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "axis-expand-contained",
    label: "轴向分段展开",
    summary: "沿主轴在首尾空间内分段推进，避免越界。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 45, progress: 0.45 },
      { percent: 70, progress: 0.82 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "clip-reveal-x",
    label: "横向裁切揭示",
    summary: "先建立横向空间，再揭示内部内容。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 22, progress: 0.16 },
      { percent: 58, progress: 0.82 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "clip-reveal-y",
    label: "纵向裁切揭示",
    summary: "先建立纵向空间，再从目标区域内展开内容。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 22, progress: 0.12 },
      { percent: 58, progress: 0.74 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "content-cross-replace",
    label: "内容交叉替换",
    summary: "旧内容先弱化，新内容在同一空间内补入。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 42, progress: 0.38, opacity: 0.28 },
      { percent: 74, progress: 0.82, opacity: 0.72 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "list-push-insert",
    label: "列表推开补位",
    summary: "已有项先让位，新项按空间顺序补入。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 24, progress: 0 },
      { percent: 62, progress: 0.62 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "indicator-slide",
    label: "指示器滑移",
    summary: "指示器或高亮底板先滑到目标位置。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 35, progress: 0.78 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "sheet-rise-contained",
    label: "面板空间上升",
    summary: "底部面板在尾帧空间内先建立承载区。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 18, progress: 0 },
      { percent: 60, progress: 0.86 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "emphasis-pulse-contained",
    label: "空间内强调",
    summary: "通过中间透明度变化增强反馈，不改变最终几何。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 45, progress: 0.7, opacity: 0.86 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "spring-settle-contained",
    label: "弹性就位",
    summary: "主对象先快速接近尾帧，再用短尾段稳定到位，不越过首尾空间。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 32, progress: 0.72 },
      { percent: 62, progress: 0.94 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "status-snap-replace",
    label: "状态瞬切替换",
    summary: "弱化中段内容可见度，让状态切换像一次明确的 snap，而不是普通淡入淡出。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 28, progress: 0.18, opacity: 0.36 },
      { percent: 56, progress: 0.76, opacity: 0.58 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "mask-scan-reveal",
    label: "遮罩扫描揭示",
    summary: "前段压住变化，中后段快速完成揭示，强化被遮罩打开的感知。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 18, progress: 0.04 },
      { percent: 42, progress: 0.34, opacity: 0.68 },
      { percent: 74, progress: 0.92 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "dropdown-accordion-y",
    label: "下拉折叠展开",
    summary: "纵向空间先被打开，再补足尾帧高度，适合菜单、筛选和详情下拉。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 20, progress: 0.08 },
      { percent: 48, progress: 0.56 },
      { percent: 78, progress: 0.9 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "anchor-pop-contained",
    label: "锚点弹出",
    summary: "从锚点附近建立浮层存在感，再在目标空间内完成落位。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 24, progress: 0.28, opacity: 0.82 },
      { percent: 52, progress: 0.78, opacity: 0.96 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "focus-shift-contained",
    label: "焦点快速转移",
    summary: "焦点对象先完成大部分位移，后续内容再稳定跟随。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 26, progress: 0.64 },
      { percent: 54, progress: 0.88 },
      { percent: 100, progress: 1 }
    ]
  },
  {
    id: "list-reorder-cascade",
    label: "列表级联重排",
    summary: "列表项前段保留原位，中段集中让位，形成更清晰的重排感。",
    stops: [
      { percent: 0, progress: 0 },
      { percent: 34, progress: 0.18 },
      { percent: 68, progress: 0.78 },
      { percent: 100, progress: 1 }
    ]
  }
];

const legacyMotionStyleMap: Record<string, ZeroLayerExpressionStrategyId> = {
  "container-first": "staged-container",
  "content-follow": "delayed-follow",
  "content-stagger": "delayed-follow",
  "spring-settle": "spring-settle-contained",
  "status-snap": "status-snap-replace",
  "mask-scan": "mask-scan-reveal",
  "dropdown-accordion": "dropdown-accordion-y",
  "anchor-pop": "anchor-pop-contained",
  "focus-shift": "focus-shift-contained",
  "axis-expand": "axis-expand-contained",
  "list-reorder": "list-reorder-cascade",
  "tab-slide": "indicator-slide",
  "container-reveal": "clip-reveal-x",
  "list-push": "list-push-insert",
  "sheet-rise": "sheet-rise-contained",
  "content-replace": "content-cross-replace"
};

export function zeroLayerExpressionStrategyById(
  id: string | undefined
): ZeroLayerExpressionStrategy | undefined {
  if (!id) return undefined;
  return zeroLayerExpressionStrategies.find((strategy) => strategy.id === id);
}

export function zeroLayerExpressionStrategyIdForMotionStyle(
  motionStyle: string | undefined
): ZeroLayerExpressionStrategyId {
  if (!motionStyle) return "linear-morph";
  if (zeroLayerExpressionStrategyById(motionStyle)) return motionStyle as ZeroLayerExpressionStrategyId;
  return legacyMotionStyleMap[motionStyle] ?? "linear-morph";
}

export function zeroLayerExpressionStrategyForStep(step: CompositionStep): ZeroLayerExpressionStrategy {
  const metadata = (
    step as CompositionStep & {
      metadata?: { zeroLayerExpressionStrategy?: string; zeroLayerMotionStyle?: string };
    }
  ).metadata;
  const id =
    metadata?.zeroLayerExpressionStrategy ??
    zeroLayerExpressionStrategyIdForMotionStyle(metadata?.zeroLayerMotionStyle);
  return zeroLayerExpressionStrategyById(id) ?? zeroLayerExpressionStrategies[0]!;
}
