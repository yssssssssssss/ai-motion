import { evaluateComposition } from "../composition/evaluateComposition";
import {
  createClassicEasing,
  createSpringEasing,
  type CompositionStep,
  type MotionDocument
} from "../schema/document";
import {
  compileZeroLayerMotionComposition,
  type ZeroLayerMotionCompositionResult
} from "./compileZeroLayerMotionComposition";
import {
  compileMotionPlanFromRecipe,
  deriveCompositionFromMotionPlan,
  fillMotionPlanGeometryFromComposition
} from "./compileMotionPlan";
import { isLowConfidenceZeroLayerBinding } from "./compileZeroLayerMotionBindings";
import { deriveZeroLayerDiagnosticGate } from "./createZeroLayerDiagnosticReport";
import { layerIdForNode } from "./layerId";
import {
  adaptZeroLayerRecipeParameters,
  applyZeroLayerRecipeAdaptedParameters,
  type ZeroLayerRecipeAdaptedParameters
} from "./adaptZeroLayerRecipeParameters";
import { zeroLayerRecipeManifests } from "./zeroLayerRecipeManifests";
import type { ZeroLayerMorphSource, ZeroLayerNode } from "./schema";
import { zeroLayerExpressionStrategyIdForMotionStyle } from "./zeroLayerExpressionStrategies";
import { createZeroMotionOrderPlan, orderItemForStep, type ZeroMotionOrderPlan } from "./zeroMotionOrdering";
import type { ZeroMotionSpec } from "./zeroMotionSpec";

export type ZeroLayerMotionRecipeId =
  | "smooth-morph"
  | "spring-expand"
  | "status-switch"
  | "container-first"
  | "content-stagger"
  | "mask-reveal"
  | "dropdown-reveal"
  | "anchored-popover"
  | "focus-guide"
  | "axis-expand"
  | "list-reorder"
  | "tab-indicator-slide"
  | "card-expand-reveal"
  | "list-insert-push"
  | "bottom-sheet-rise"
  | "content-replace";

export type ZeroLayerMotionRecipeCategory =
  | "state"
  | "expand"
  | "content"
  | "navigation"
  | "overlay"
  | "list"
  | "transition";

export type ZeroLayerMotionRecipe = {
  id: ZeroLayerMotionRecipeId;
  label: string;
  summary: string;
  category: ZeroLayerMotionRecipeCategory;
};

export type ZeroLayerMotionRecipeApplyOptions = {
  spec?: ZeroMotionSpec;
  adaptedParameters?: ZeroLayerRecipeAdaptedParameters;
};

type RecipeContext = {
  baseSteps: CompositionStep[];
  nodeByLayerId: Map<string, ZeroLayerNode>;
  mainLayerId: string | undefined;
  orderPlan: ZeroMotionOrderPlan;
};

export const zeroLayerMotionRecipes: ZeroLayerMotionRecipe[] = zeroLayerRecipeManifests.map(
  ({ id, label, summary, category }) => ({ id, label, summary, category })
);

export function zeroLayerDiagnosticGateForSource(source: ZeroLayerMorphSource) {
  const report = source.diagnosticReport;
  return report ? (report.gate ?? deriveZeroLayerDiagnosticGate(report)) : undefined;
}

export function zeroLayerNativeRecipeBlockReason(source: ZeroLayerMorphSource): string | undefined {
  const gate = zeroLayerDiagnosticGateForSource(source);
  if (
    !gate ||
    (gate.status !== "blocked" &&
      gate.strategy !== "manual-fix-required" &&
      gate.strategy !== "screenshot-fallback")
  ) {
    return undefined;
  }
  return `Zero 原生图层动效已被质量门禁阻止（${gate.strategy}）：${gate.summary}`;
}

function layerArea(node: ZeroLayerNode | undefined): number {
  return node ? node.bounds.w * node.bounds.h : 0;
}

function hasVisiblePaint(node: ZeroLayerNode | undefined): node is ZeroLayerNode {
  if (!node || !node.visible || node.opacity <= 0.01) return false;
  if (node.kind === "image" || node.kind === "text" || node.assetId || node.renderMode === "image") {
    return true;
  }
  if (node.fills?.some((fill) => (fill.opacity ?? 1) > 0.01)) return true;
  if (node.strokes?.some((stroke) => (stroke.opacity ?? 1) > 0.01 && (stroke.width ?? 1) > 0)) {
    return true;
  }
  return Boolean(node.effects?.length);
}

function buildNodeIndex(source: ZeroLayerMorphSource): Map<string, ZeroLayerNode> {
  const nodes = new Map<string, ZeroLayerNode>();
  for (const binding of source.bindingResult.bindings) {
    const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    if (fromNode) nodes.set(binding.layerId, fromNode);
    if (!fromNode && toNode) nodes.set(binding.layerId, toNode);
  }
  for (const node of source.bindingResult.enter) nodes.set(layerIdForNode(node), node);
  for (const node of source.bindingResult.exit) nodes.set(layerIdForNode(node), node);
  return nodes;
}

function findMainLayerId(source: ZeroLayerMorphSource, spec?: ZeroMotionSpec): string | undefined {
  const dominantBinding = source.bindingResult.bindings.find(
    (binding) => binding.layerId === spec?.topology.dominantLayerId
  );
  if (dominantBinding) {
    const fromNode = source.from.layers.find((node) => node.nodeId === dominantBinding.nodeId);
    const toNode = source.to.layers.find((node) => node.nodeId === dominantBinding.toNodeId);
    const isRoot =
      dominantBinding.nodeId === source.from.nodeId || dominantBinding.toNodeId === source.to.nodeId;
    if (!isRoot && (hasVisiblePaint(fromNode) || hasVisiblePaint(toNode))) {
      return dominantBinding.layerId;
    }
  }
  let main: { layerId: string; area: number } | undefined;
  for (const binding of source.bindingResult.bindings) {
    const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    const isRoot = binding.nodeId === source.from.nodeId || binding.toNodeId === source.to.nodeId;
    if (isRoot || (!hasVisiblePaint(fromNode) && !hasVisiblePaint(toNode))) continue;
    const area = Math.max(layerArea(fromNode), layerArea(toNode));
    if (!main || area > main.area) main = { layerId: binding.layerId, area };
  }
  return main?.layerId;
}

function stepNode(step: CompositionStep, context: RecipeContext): ZeroLayerNode | undefined {
  return step.layerId ? context.nodeByLayerId.get(step.layerId) : undefined;
}

function spatialIndex(step: CompositionStep, context: RecipeContext): number {
  const node = stepNode(step, context);
  if (!node) return 0;
  const sorted = [...context.baseSteps]
    .map((item) => stepNode(item, context))
    .filter((item): item is ZeroLayerNode => Boolean(item))
    .sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x);
  return Math.max(
    0,
    sorted.findIndex((item) => item.nodeId === node.nodeId)
  );
}

function semanticDelay(step: CompositionStep, context: RecipeContext, fallbackMs = 0): number {
  return orderItemForStep(context.orderPlan, step)?.delayMs ?? fallbackMs;
}

function semanticOrder(step: CompositionStep, context: RecipeContext): number {
  return orderItemForStep(context.orderPlan, step)?.order ?? spatialIndex(step, context);
}

function semanticRole(step: CompositionStep, context: RecipeContext): string {
  return step.layerId ? (context.orderPlan.roleByLayerId[step.layerId] ?? "unknown") : "unknown";
}

function isContainerNode(node: ZeroLayerNode | undefined): boolean {
  return Boolean(
    node &&
    (node.kind === "frame" ||
      node.kind === "group" ||
      node.kind === "component" ||
      node.kind === "instance" ||
      node.kind === "rect")
  );
}

function isFoundationStep(step: CompositionStep, context: RecipeContext): boolean {
  const role = semanticRole(step, context);
  return role === "root-container" || role === "background" || role === "surface" || role === "mask";
}

function tailFrameAnimate(step: CompositionStep): NonNullable<CompositionStep["animate"]> {
  return {
    ...step.animate,
    scale: 1,
    opacity: step.animate?.opacity ?? 1,
    rotate: 0
  };
}

function withTransformOrigin(step: CompositionStep, origin: string): CompositionStep {
  return {
    ...step,
    metadata: { ...step.metadata, zeroLayerTransformOrigin: origin }
  };
}

function withMotionStyle(step: CompositionStep, style: string): CompositionStep {
  return {
    ...step,
    metadata: {
      ...step.metadata,
      zeroLayerMotionStyle: style,
      zeroLayerExpressionStrategy: zeroLayerExpressionStrategyIdForMotionStyle(style)
    }
  };
}

function corridorMatchedStep(step: CompositionStep): CompositionStep {
  return {
    ...step,
    initial: { ...step.initial, scale: 1, rotate: 0 },
    animate: tailFrameAnimate(step),
    easing: createClassicEasing(step.easing?.type === "classic" ? step.easing.preset : "decelerate")
  };
}

function orderByAbsoluteStartTime(steps: CompositionStep[]): CompositionStep[] {
  return steps
    .map((step, index) => ({ step, index, start: Math.max(0, step.delayMs ?? 0) }))
    .sort((left, right) => left.start - right.start || left.index - right.index)
    .map(({ step }) => step);
}

function encodeAbsoluteStartTimes(steps: CompositionStep[]): CompositionStep[] {
  const ordered = orderByAbsoluteStartTime(steps);
  let previousStart = 0;
  return ordered.map((step, index) => {
    const start = Math.max(0, step.delayMs ?? 0);
    const delayMs = index === 0 ? start : start - previousStart;
    previousStart = start;
    return { ...step, timing: "parallel", delayMs };
  });
}

function smoothMorphSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "丝滑进入",
          delayMs: 40,
          durationMs: 220,
          initial: { ...step.initial, scale: 0.98, opacity: 0 },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "丝滑离开",
          delayMs: 0,
          durationMs: 200,
          initial: { ...step.initial, scale: 1, opacity: 1 },
          animate: { ...step.animate, scale: 0.98, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return {
        ...corridorMatchedStep(step),
        label: "丝滑形变",
        delayMs: 0,
        durationMs: 340
      };
    })
  );
}

function springExpandSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const isMain = step.layerId === context.mainLayerId && step.id.startsWith("zero-layer-match");
      if (isMain) {
        return withMotionStyle(
          {
            ...corridorMatchedStep(step),
            label: "弹性主容器",
            delayMs: 0,
            durationMs: 420,
            easing: createSpringEasing({ stiffness: 220, damping: 22 })
          },
          "spring-settle"
        );
      }
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "弹性内容进入",
          delayMs: 80,
          durationMs: 220,
          initial: { ...step.initial, y: (step.initial?.y ?? 0) - 10, scale: 0.96, opacity: 0 },
          animate: { ...step.animate, y: step.animate?.y ?? 0, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "弹性内容离开",
          delayMs: 0,
          durationMs: 180,
          animate: { ...step.animate, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: "弹性跟随",
          delayMs: 50,
          durationMs: 300
        },
        "content-follow"
      );
    })
  );
}

function statusSwitchSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const node = step.layerId ? context.nodeByLayerId.get(step.layerId) : undefined;
      const isText = node?.kind === "text";
      if (isText) {
        return withMotionStyle(
          {
            ...corridorMatchedStep(step),
            label: "状态文字切换",
            delayMs: 40,
            durationMs: 220,
            initial: {
              ...step.initial,
              x: 0,
              y: 0,
              opacity: step.id.startsWith("zero-layer-exit") ? 1 : 0.72
            },
            animate: step.id.startsWith("zero-layer-exit")
              ? { ...step.animate, x: 0, y: 0, opacity: 0 }
              : tailFrameAnimate(step),
            easing: createClassicEasing("standard")
          },
          "status-snap"
        );
      }
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "状态内容出现",
          delayMs: 60,
          durationMs: 200,
          initial: { ...step.initial, scale: 1, opacity: 0 },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("standard")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "状态内容淡出",
          delayMs: 0,
          durationMs: 180,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: "状态底板切换",
          delayMs: 0,
          durationMs: 300,
          easing: createClassicEasing("standard")
        },
        "status-snap"
      );
    })
  );
}

function containerFirstSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const node = stepNode(step, context);
      const isMain =
        step.layerId === context.mainLayerId || isContainerNode(node) || isFoundationStep(step, context);
      const delay = semanticDelay(step, context, isMain ? 0 : 90);
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "容器完成后进入",
          delayMs: Math.max(delay, isMain ? 80 : 140),
          durationMs: 220,
          initial: { ...step.initial, scale: 1, opacity: 0 },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "旧内容先淡出",
          delayMs: 0,
          durationMs: 140,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: isMain ? "容器优先形变" : "内容跟随形变",
          delayMs: delay,
          durationMs: isMain ? 360 : 260,
          easing: createClassicEasing(isMain ? "decelerate" : "standard")
        },
        isMain ? "container-first" : "content-follow"
      );
    })
  );
}

function contentStaggerSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const order = semanticOrder(step, context);
      const group = orderItemForStep(context.orderPlan, step)?.group;
      const delayMs =
        group === "foundation" || group === "structure"
          ? step.delayMs
          : Math.min(semanticDelay(step, context, order * 45), 220);
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "内容错峰进入",
          delayMs,
          durationMs: 210,
          initial: { ...step.initial, y: (step.initial?.y ?? 0) - 10, scale: 1, opacity: 0 },
          animate: { ...step.animate, y: step.animate?.y ?? 0, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "内容错峰离开",
          delayMs: Math.max(0, Math.min(delayMs, 80)),
          durationMs: 150,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: "内容错峰形变",
          delayMs,
          durationMs: 260,
          easing: createClassicEasing("standard")
        },
        "content-stagger"
      );
    })
  );
}

function maskRevealSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const node = stepNode(step, context);
      const isText = node?.kind === "text";
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "遮罩内容揭示",
          delayMs: isText ? 120 : 70,
          durationMs: isText ? 220 : 280,
          initial: {
            ...step.initial,
            width: Math.max(1, (step.initial?.width ?? 1) * 0.2),
            height: Math.max(1, (step.initial?.height ?? 1) * 0.35),
            y: (step.initial?.y ?? 0) - 8,
            scale: 1,
            opacity: 0
          },
          animate: { ...step.animate, y: step.animate?.y ?? 0, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "遮罩内容收起",
          delayMs: 0,
          durationMs: 160,
          animate: {
            ...step.animate,
            width: Math.max(1, (step.initial?.width ?? 1) * 0.2),
            scale: 1,
            opacity: 0
          },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: "遮罩范围形变",
          delayMs: 0,
          durationMs: 320,
          easing: createClassicEasing("sharp")
        },
        "mask-scan"
      );
    })
  );
}

function dropdownRevealSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const node = stepNode(step, context);
      const order = spatialIndex(step, context);
      const isContainer = isContainerNode(node);
      if (step.id.startsWith("zero-layer-enter")) {
        const height = step.animate?.height ?? step.initial?.height ?? 1;
        return {
          ...step,
          label: isContainer ? "下拉容器展开" : "下拉内容进入",
          delayMs: isContainer ? 40 : 100 + Math.min(order * 32, 160),
          durationMs: isContainer ? 300 : 210,
          initial: {
            ...step.initial,
            y: (step.initial?.y ?? 0) - 12,
            height: isContainer ? Math.max(1, height * 0.08) : Math.max(1, height * 0.55),
            scale: 1,
            opacity: isContainer ? 0.78 : 0
          },
          animate: { ...step.animate, y: step.animate?.y ?? 0, height, scale: 1, opacity: 1 },
          easing: createClassicEasing(isContainer ? "sharp" : "decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "旧下拉状态收起",
          delayMs: 0,
          durationMs: 120,
          animate: { ...step.animate, y: (step.animate?.y ?? 0) - 6, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: step.layerId === context.mainLayerId ? "触发区稳定扩展" : "触发区跟随",
          delayMs: step.layerId === context.mainLayerId ? 0 : 40,
          durationMs: step.layerId === context.mainLayerId ? 420 : 260,
          easing: createClassicEasing("sharp")
        },
        step.layerId === context.mainLayerId || isContainer ? "dropdown-accordion" : "content-follow"
      );
    })
  );
}

function anchoredPopoverSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const order = spatialIndex(step, context);
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "锚点浮层进入",
          delayMs: 60 + Math.min(order * 18, 120),
          durationMs: 260,
          initial: { ...step.initial, y: (step.initial?.y ?? 0) - 14, scale: 0.96, opacity: 0 },
          animate: { ...step.animate, y: step.animate?.y ?? 0, scale: 1, opacity: 1 },
          easing: createClassicEasing("sharp")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "锚点旧态离开",
          delayMs: 0,
          durationMs: 140,
          animate: { ...step.animate, y: (step.animate?.y ?? 0) - 8, scale: 0.98, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: step.layerId === context.mainLayerId ? "锚点主对象" : "锚点跟随",
          delayMs: step.layerId === context.mainLayerId ? 0 : 36,
          durationMs: step.layerId === context.mainLayerId ? 360 : 240,
          easing: createClassicEasing("decelerate")
        },
        step.layerId === context.mainLayerId ? "anchor-pop" : "content-follow"
      );
    })
  );
}

function focusGuideSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const isMain = step.layerId === context.mainLayerId;
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: isMain ? "焦点进入" : "次级内容响应",
          delayMs: isMain ? 40 : 150,
          durationMs: isMain ? 260 : 180,
          initial: { ...step.initial, scale: 1, opacity: 0 },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing(isMain ? "decelerate" : "standard")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "失焦内容淡出",
          delayMs: 0,
          durationMs: 120,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: isMain ? "焦点主对象" : "焦点跟随对象",
          delayMs: isMain ? 0 : 70,
          durationMs: isMain ? 300 : 230,
          easing: createClassicEasing(isMain ? "decelerate" : "standard")
        },
        isMain ? "focus-shift" : "content-follow"
      );
    })
  );
}

function axisExpandSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const dx = Math.abs(step.animate?.x ?? 0);
      const dy = Math.abs(step.animate?.y ?? 0);
      const dw = Math.abs((step.animate?.width ?? step.initial?.width ?? 0) - (step.initial?.width ?? 0));
      const dh = Math.abs((step.animate?.height ?? step.initial?.height ?? 0) - (step.initial?.height ?? 0));
      const horizontal = dx + dw >= dy + dh;
      const delay = semanticDelay(step, context, 0);
      if (step.id.startsWith("zero-layer-enter")) {
        const initialWidth = step.initial?.width ?? step.animate?.width ?? 1;
        const initialHeight = step.initial?.height ?? step.animate?.height ?? 1;
        return {
          ...step,
          label: horizontal ? "横向内容出现" : "纵向内容出现",
          delayMs: Math.max(delay, 80),
          durationMs: 200,
          initial: {
            ...step.initial,
            width: horizontal ? Math.max(1, initialWidth * 0.5) : initialWidth,
            height: horizontal ? initialHeight : Math.max(1, initialHeight * 0.5),
            scale: 1,
            opacity: 0
          },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: horizontal ? "横向内容收起" : "纵向内容收起",
          delayMs: 0,
          durationMs: 150,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: horizontal ? "横向轴向展开" : "纵向轴向展开",
          delayMs: isFoundationStep(step, context) ? 0 : delay,
          durationMs: horizontal ? 330 : 300,
          easing: createClassicEasing("sharp")
        },
        "axis-expand"
      );
    })
  );
}

function listReorderSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const order = spatialIndex(step, context);
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "列表补位进入",
          delayMs: 100 + order * 35,
          durationMs: 190,
          initial: { ...step.initial, scale: 1, opacity: 0 },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("standard")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "列表旧项离开",
          delayMs: order * 20,
          durationMs: 150,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: "列表顺序重排",
          delayMs: order * 35,
          durationMs: 280,
          easing: createClassicEasing("standard")
        },
        "list-reorder"
      );
    })
  );
}

function tabIndicatorSlideSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const role = semanticRole(step, context);
      const order = semanticOrder(step, context);
      const isIndicator = role === "badge" || role === "surface" || step.layerId === context.mainLayerId;
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: "Tab 内容补入",
          delayMs: 140 + order * 24,
          durationMs: 180,
          initial: {
            ...step.initial,
            width: Math.max(1, (step.initial?.width ?? 1) * 0.72),
            scale: 1,
            opacity: 0
          },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("standard")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "Tab 旧内容让位",
          delayMs: Math.min(order * 18, 72),
          durationMs: 150,
          animate: {
            ...step.animate,
            width: Math.max(1, (step.initial?.width ?? 1) * 0.72),
            scale: 1,
            opacity: 0
          },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: isIndicator ? "指示器滑移" : "Tab 内容跟随",
          delayMs: isIndicator ? 0 : 110 + order * 18,
          durationMs: isIndicator ? 340 : 210,
          easing: createClassicEasing(isIndicator ? "sharp" : "standard")
        },
        isIndicator ? "tab-slide" : "content-replace"
      );
    })
  );
}

function cardExpandRevealSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const role = semanticRole(step, context);
      const order = semanticOrder(step, context);
      const isContainer = isFoundationStep(step, context) || step.layerId === context.mainLayerId;
      if (step.id.startsWith("zero-layer-enter")) {
        const height = step.animate?.height ?? step.initial?.height ?? 1;
        return withTransformOrigin(
          {
            ...step,
            label: role === "content-text" ? "卡片文字揭示" : "卡片内容揭示",
            delayMs: 150 + order * 34,
            durationMs: 230,
            initial: { ...step.initial, height: Math.max(1, height * 0.22), scale: 1, opacity: 0 },
            animate: { ...step.animate, height, scale: 1, opacity: 1 },
            easing: createClassicEasing("decelerate")
          },
          "top center"
        );
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "收起旧卡片内容",
          delayMs: Math.min(order * 20, 72),
          durationMs: 150,
          animate: {
            ...step.animate,
            height: Math.max(1, (step.initial?.height ?? 1) * 0.55),
            scale: 1,
            opacity: 0
          },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: isContainer ? "卡片容器展开" : "卡片内容跟随",
          delayMs: isContainer ? 0 : 120 + order * 22,
          durationMs: isContainer ? 440 : 240,
          easing: createClassicEasing(isContainer ? "sharp" : "standard")
        },
        isContainer ? "container-reveal" : "content-follow"
      );
    })
  );
}

function listInsertPushSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const order = semanticOrder(step, context);
      if (step.id.startsWith("zero-layer-enter")) {
        const height = step.animate?.height ?? step.initial?.height ?? 1;
        return withTransformOrigin(
          {
            ...step,
            label: "新列表项补位",
            delayMs: 120 + order * 42,
            durationMs: 220,
            initial: { ...step.initial, height: Math.max(1, height * 0.12), scale: 1, opacity: 0 },
            animate: { ...step.animate, height, scale: 1, opacity: 1 },
            easing: createClassicEasing("decelerate")
          },
          "top center"
        );
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "旧列表项移除",
          delayMs: order * 22,
          durationMs: 150,
          animate: {
            ...step.animate,
            height: Math.max(1, (step.initial?.height ?? 1) * 0.2),
            scale: 1,
            opacity: 0
          },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: "列表项推开",
          delayMs: 40 + order * 34,
          durationMs: 330,
          easing: createClassicEasing("standard")
        },
        "list-push"
      );
    })
  );
}

function bottomSheetRiseSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const role = semanticRole(step, context);
      const order = semanticOrder(step, context);
      const isSheet = role === "surface" || step.layerId === context.mainLayerId;
      if (step.id.startsWith("zero-layer-enter")) {
        const height = step.animate?.height ?? step.initial?.height ?? 1;
        return withTransformOrigin(
          {
            ...step,
            label: isSheet ? "底部面板上升" : "面板内容进入",
            delayMs: isSheet ? 60 : 170 + order * 28,
            durationMs: isSheet ? 340 : 210,
            initial: {
              ...step.initial,
              height: isSheet ? Math.max(1, height * 0.18) : height,
              scale: 1,
              opacity: isSheet ? 0.86 : 0
            },
            animate: { ...step.animate, height, scale: 1, opacity: 1 },
            easing: createClassicEasing(isSheet ? "sharp" : "decelerate")
          },
          isSheet ? "bottom center" : "top center"
        );
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: "旧内容先离开",
          delayMs: Math.min(order * 18, 80),
          durationMs: 140,
          animate: { ...step.animate, scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: role === "mask" ? "蒙层先稳定" : isSheet ? "面板空间就位" : "浮层内容跟随",
          delayMs: role === "mask" ? 0 : isSheet ? 40 : 130 + order * 22,
          durationMs: role === "mask" ? 260 : isSheet ? 400 : 220,
          easing: createClassicEasing(isSheet ? "sharp" : "standard")
        },
        isSheet ? "sheet-rise" : "content-follow"
      );
    })
  );
}

function contentReplaceSteps(context: RecipeContext): CompositionStep[] {
  return orderByAbsoluteStartTime(
    context.baseSteps.map((step) => {
      const order = semanticOrder(step, context);
      const role = semanticRole(step, context);
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: role === "content-text" ? "新文案补入" : "新内容补入",
          delayMs: 150 + order * 32,
          durationMs: 200,
          initial: {
            ...step.initial,
            width: Math.max(1, (step.initial?.width ?? 1) * 0.7),
            scale: 1,
            opacity: 0
          },
          animate: { ...step.animate, scale: 1, opacity: 1 },
          easing: createClassicEasing("standard")
        };
      }
      if (step.id.startsWith("zero-layer-exit")) {
        return {
          ...step,
          label: role === "content-text" ? "旧文案退出" : "旧内容退出",
          delayMs: order * 24,
          durationMs: 160,
          animate: {
            ...step.animate,
            width: Math.max(1, (step.initial?.width ?? 1) * 0.64),
            scale: 1,
            opacity: 0
          },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle(
        {
          ...corridorMatchedStep(step),
          label: isFoundationStep(step, context) ? "承载层保持稳定" : "内容替换跟随",
          delayMs: isFoundationStep(step, context) ? 0 : 90 + order * 20,
          durationMs: isFoundationStep(step, context) ? 280 : 230,
          easing: createClassicEasing("standard")
        },
        isFoundationStep(step, context) ? "container-first" : "content-replace"
      );
    })
  );
}

function recipeSteps(id: ZeroLayerMotionRecipeId, context: RecipeContext): CompositionStep[] {
  if (id === "tab-indicator-slide") return tabIndicatorSlideSteps(context);
  if (id === "card-expand-reveal") return cardExpandRevealSteps(context);
  if (id === "list-insert-push") return listInsertPushSteps(context);
  if (id === "bottom-sheet-rise") return bottomSheetRiseSteps(context);
  if (id === "content-replace") return contentReplaceSteps(context);
  if (id === "container-first") return containerFirstSteps(context);
  if (id === "content-stagger") return contentStaggerSteps(context);
  if (id === "mask-reveal") return maskRevealSteps(context);
  if (id === "dropdown-reveal") return dropdownRevealSteps(context);
  if (id === "anchored-popover") return anchoredPopoverSteps(context);
  if (id === "focus-guide") return focusGuideSteps(context);
  if (id === "axis-expand") return axisExpandSteps(context);
  if (id === "list-reorder") return listReorderSteps(context);
  if (id === "spring-expand") return springExpandSteps(context);
  if (id === "status-switch") return statusSwitchSteps(context);
  return smoothMorphSteps(context);
}

function recipeLabel(id: ZeroLayerMotionRecipeId): string {
  return zeroLayerMotionRecipes.find((recipe) => recipe.id === id)?.label ?? "Zero 原生动效方案";
}

function withSteps(
  document: MotionDocument,
  steps: CompositionStep[],
  source: ZeroLayerMorphSource
): MotionDocument {
  const composition = evaluateComposition(steps);
  const baseSource = document.visualSource?.kind === "zero-layer-morph" ? document.visualSource : source;
  const objects = baseSource.objects ?? source.objects;
  return {
    ...document,
    ...(steps[0]?.layerId ? { selectedLayerId: steps[0].layerId } : {}),
    timeline: {
      ...document.timeline,
      durationMs: composition.totalDurationMs || document.timeline.durationMs
    },
    composition,
    visualSource: {
      ...baseSource,
      ...(source.nodeOverrides ? { nodeOverrides: source.nodeOverrides } : {}),
      ...(source.motionPlan ? { motionPlan: source.motionPlan } : {}),
      ...(objects ? { objects } : {})
    }
  };
}

export function applyZeroLayerMotionRecipe(
  source: ZeroLayerMorphSource,
  recipeId: ZeroLayerMotionRecipeId,
  options: ZeroLayerMotionRecipeApplyOptions = {}
): ZeroLayerMotionCompositionResult {
  const blockReason = zeroLayerNativeRecipeBlockReason(source);
  if (blockReason) throw new Error(blockReason);

  const base = compileZeroLayerMotionComposition({
    from: source.from,
    to: source.to,
    bindingResult: source.bindingResult,
    downgradeLowConfidenceMatches: source.bindingResult.bindings.some(isLowConfidenceZeroLayerBinding),
    ...(source.diagnosticReport ? { diagnosticReport: source.diagnosticReport } : {})
  });
  const compiledSource = base.document.visualSource;
  const recipeSource: ZeroLayerMorphSource =
    compiledSource?.kind === "zero-layer-morph"
      ? {
          ...compiledSource,
          ...(source.nodeOverrides ? { nodeOverrides: source.nodeOverrides } : {}),
          ...(source.motionPlan ? { motionPlan: source.motionPlan } : {})
        }
      : source;
  if (!source.motionPlan) delete recipeSource.motionPlan;
  const orderPlan = createZeroMotionOrderPlan(recipeSource, base.steps, options.spec);
  const context: RecipeContext = {
    baseSteps: base.steps,
    nodeByLayerId: buildNodeIndex(recipeSource),
    mainLayerId: findMainLayerId(recipeSource, options.spec),
    orderPlan
  };
  const adaptedParameters =
    options.adaptedParameters ??
    (options.spec ? adaptZeroLayerRecipeParameters(options.spec, recipeId) : undefined);
  const recipeAbsoluteSteps = recipeSteps(recipeId, context);
  const computedRecipeSteps = encodeAbsoluteStartTimes(
    adaptedParameters
      ? applyZeroLayerRecipeAdaptedParameters(recipeAbsoluteSteps, adaptedParameters, { orderPlan })
      : recipeAbsoluteSteps
  );
  const motionPlan = fillMotionPlanGeometryFromComposition(
    compileMotionPlanFromRecipe({ source: recipeSource, steps: computedRecipeSteps }),
    undefined,
    recipeSource
  );
  const steps = deriveCompositionFromMotionPlan(motionPlan, computedRecipeSteps);
  const document = withSteps(base.document, steps, { ...recipeSource, motionPlan });
  return {
    document,
    steps,
    bindingResult: base.bindingResult,
    summary: `${recipeLabel(recipeId)}：${steps.length} 个 Zero 图层片段，${
      document.composition?.totalDurationMs ?? document.timeline.durationMs
    }ms${adaptedParameters ? ` · ${adaptedParameters.summary}` : ""}`
  };
}
