import { evaluateComposition } from "../composition/evaluateComposition";
import { createClassicEasing, type CompositionStep, type MotionDocument } from "../schema/document";
import {
  compileZeroLayerMotionComposition,
  type ZeroLayerMotionCompositionResult
} from "./compileZeroLayerMotionComposition";
import {
  adaptZeroLayerRecipeParameters,
  applyZeroLayerRecipeAdaptedParameters,
  type ZeroLayerRecipeAdaptedParameters
} from "./adaptZeroLayerRecipeParameters";
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

export const zeroLayerMotionRecipes: ZeroLayerMotionRecipe[] = [
  {
    id: "smooth-morph",
    label: "丝滑形变",
    category: "state",
    summary: "适合常规状态变化：位置、尺寸、透明度一起平顺过渡。"
  },
  {
    id: "spring-expand",
    label: "弹性展开",
    category: "expand",
    summary: "适合容器展开：主容器使用一次弹性，其余内容轻微跟随。"
  },
  {
    id: "status-switch",
    label: "状态切换",
    category: "state",
    summary: "适合标签、按钮、状态文案切换：弱化位移，突出内容替换。"
  },
  {
    id: "container-first",
    label: "容器优先",
    category: "expand",
    summary: "适合卡片、胶囊、底板展开：容器先到位，内容再跟随出现。"
  },
  {
    id: "content-stagger",
    label: "内容错峰",
    category: "content",
    summary: "适合多文字、多图标组件：按阅读顺序分批进入。"
  },
  {
    id: "mask-reveal",
    label: "遮罩揭示",
    category: "overlay",
    summary: "适合弹层和信息展开：在目标空间内逐步揭示内容。"
  },
  {
    id: "dropdown-reveal",
    label: "下拉展开",
    category: "overlay",
    summary: "适合菜单和下拉层：容器从触发点向下展开，内容随后进入。"
  },
  {
    id: "anchored-popover",
    label: "锚点浮层",
    category: "overlay",
    summary: "适合锚定触发控件的浮层：从锚点轻微弹出并落位。"
  },
  {
    id: "focus-guide",
    label: "焦点引导",
    category: "navigation",
    summary: "适合导航、状态焦点变化：主对象先动，次级内容随后响应。"
  },
  {
    id: "axis-expand",
    label: "轴向展开",
    category: "expand",
    summary: "适合胶囊、列表项、底部栏：沿主要变化方向完成形变。"
  },
  {
    id: "list-reorder",
    label: "列表重排",
    category: "list",
    summary: "适合多个元素重排：按空间顺序依次移动和补位。"
  },
  {
    id: "tab-indicator-slide",
    label: "Tab 指示滑移",
    category: "navigation",
    summary: "适合 Tab 或分段控件切换：指示器/高亮底板先横向滑动，内容随后替换。"
  },
  {
    id: "card-expand-reveal",
    label: "卡片展开揭示",
    category: "expand",
    summary: "适合卡片收起到展开：容器先在首尾空间内扩展，内容被裁切揭示。"
  },
  {
    id: "list-insert-push",
    label: "列表插入推开",
    category: "list",
    summary: "适合新增列表项：已有项按顺序让位，新项从目标空间内补位进入。"
  },
  {
    id: "bottom-sheet-rise",
    label: "底部面板上升",
    category: "overlay",
    summary: "适合底部浮层：蒙层先稳定，面板从尾帧底部空间内上升，内容随后出现。"
  },
  {
    id: "content-replace",
    label: "内容替换",
    category: "transition",
    summary: "适合文案、局部状态替换：旧内容先收起，新内容按阅读顺序补入。"
  }
];

function layerArea(node: ZeroLayerNode | undefined): number {
  return node ? node.bounds.w * node.bounds.h : 0;
}

function buildNodeIndex(source: ZeroLayerMorphSource): Map<string, ZeroLayerNode> {
  const nodes = new Map<string, ZeroLayerNode>();
  for (const binding of source.bindingResult.bindings) {
    const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const toNode = source.to.layers.find((node) => node.nodeId === binding.toNodeId);
    if (fromNode) nodes.set(binding.layerId, fromNode);
    if (!fromNode && toNode) nodes.set(binding.layerId, toNode);
  }
  for (const node of source.bindingResult.enter) nodes.set(`zero-layer-${safeNodeId(node.nodeId)}`, node);
  for (const node of source.bindingResult.exit) nodes.set(`zero-layer-${safeNodeId(node.nodeId)}`, node);
  return nodes;
}

function safeNodeId(nodeId: string): string {
  return nodeId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findMainLayerId(source: ZeroLayerMorphSource): string | undefined {
  let main: { layerId: string; area: number } | undefined;
  for (const binding of source.bindingResult.bindings) {
    const fromNode = source.from.layers.find((node) => node.nodeId === binding.nodeId);
    const area = Math.max(layerArea(fromNode), binding.fromBounds.w * binding.fromBounds.h);
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
  const current = step as CompositionStep & { metadata?: Record<string, string> };
  return {
    ...step,
    metadata: { ...current.metadata, zeroLayerTransformOrigin: origin }
  } as CompositionStep;
}

function withMotionStyle(step: CompositionStep, style: string): CompositionStep {
  const current = step as CompositionStep & { metadata?: Record<string, string> };
  return {
    ...step,
    metadata: {
      ...current.metadata,
      zeroLayerMotionStyle: style,
      zeroLayerExpressionStrategy: zeroLayerExpressionStrategyIdForMotionStyle(style)
    }
  } as CompositionStep;
}

function corridorMatchedStep(step: CompositionStep): CompositionStep {
  return {
    ...step,
    initial: { ...step.initial, scale: 1, rotate: 0 },
    animate: tailFrameAnimate(step),
    easing: createClassicEasing(step.easing?.type === "classic" ? step.easing.preset : "decelerate")
  };
}

function withSequentialFirst(steps: CompositionStep[]): CompositionStep[] {
  return steps.map((step, index) => ({
    ...step,
    timing: index === 0 ? "sequential" : "parallel",
    delayMs: step.delayMs ?? 0
  }));
}

function smoothMorphSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
  return withSequentialFirst(
    context.baseSteps.map((step) => {
      const isMain = step.layerId === context.mainLayerId && step.id.startsWith("zero-layer-match");
      if (isMain) {
        return withMotionStyle({
          ...corridorMatchedStep(step),
          label: "弹性主容器",
          delayMs: 0,
          durationMs: 420,
          easing: createClassicEasing("sharp")
        }, "spring-settle");
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: "弹性跟随",
        delayMs: 50,
        durationMs: 300
      }, "content-follow");
    })
  );
}

function statusSwitchSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
    context.baseSteps.map((step) => {
      const node = step.layerId ? context.nodeByLayerId.get(step.layerId) : undefined;
      const isText = node?.kind === "text";
      if (isText) {
        return withMotionStyle({
          ...corridorMatchedStep(step),
          label: "状态文字切换",
          delayMs: 40,
          durationMs: 220,
          initial: { ...step.initial, x: 0, y: 0, opacity: step.id.startsWith("zero-layer-exit") ? 1 : 0.72 },
          animate: step.id.startsWith("zero-layer-exit")
            ? { ...step.animate, x: 0, y: 0, opacity: 0 }
            : tailFrameAnimate(step),
          easing: createClassicEasing("standard")
        }, "status-snap");
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: "状态底板切换",
        delayMs: 0,
        durationMs: 300,
        easing: createClassicEasing("standard")
      }, "status-snap");
    })
  );
}

function containerFirstSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
    context.baseSteps.map((step) => {
      const node = stepNode(step, context);
      const isMain = step.layerId === context.mainLayerId || isContainerNode(node) || isFoundationStep(step, context);
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
      return withMotionStyle({
          ...corridorMatchedStep(step),
          label: isMain ? "容器优先形变" : "内容跟随形变",
        delayMs: delay,
        durationMs: isMain ? 360 : 260,
        easing: createClassicEasing(isMain ? "decelerate" : "standard")
      }, isMain ? "container-first" : "content-follow");
    })
  );
}

function contentStaggerSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
    context.baseSteps.map((step) => {
      const order = semanticOrder(step, context);
      const delayMs = Math.min(semanticDelay(step, context, order * 45), 220);
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: "内容错峰形变",
        delayMs,
        durationMs: 260,
        easing: createClassicEasing("standard")
      }, "content-stagger");
    })
  );
}

function maskRevealSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: "遮罩范围形变",
        delayMs: 0,
        durationMs: 320,
        easing: createClassicEasing("sharp")
      }, "mask-scan");
    })
  );
}

function dropdownRevealSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: step.layerId === context.mainLayerId ? "触发区稳定扩展" : "触发区跟随",
        delayMs: step.layerId === context.mainLayerId ? 0 : 40,
        durationMs: step.layerId === context.mainLayerId ? 420 : 260,
        easing: createClassicEasing("sharp")
      }, step.layerId === context.mainLayerId || isContainer ? "dropdown-accordion" : "content-follow");
    })
  );
}

function anchoredPopoverSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: step.layerId === context.mainLayerId ? "锚点主对象" : "锚点跟随",
        delayMs: step.layerId === context.mainLayerId ? 0 : 36,
        durationMs: step.layerId === context.mainLayerId ? 360 : 240,
        easing: createClassicEasing("decelerate")
      }, step.layerId === context.mainLayerId ? "anchor-pop" : "content-follow");
    })
  );
}

function focusGuideSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: isMain ? "焦点主对象" : "焦点跟随对象",
        delayMs: isMain ? 0 : 70,
        durationMs: isMain ? 300 : 230,
        easing: createClassicEasing(isMain ? "decelerate" : "standard")
      }, isMain ? "focus-shift" : "content-follow");
    })
  );
}

function axisExpandSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: horizontal ? "横向轴向展开" : "纵向轴向展开",
        delayMs: isFoundationStep(step, context) ? 0 : delay,
        durationMs: horizontal ? 330 : 300,
        easing: createClassicEasing("sharp")
      }, "axis-expand");
    })
  );
}

function listReorderSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: "列表顺序重排",
        delayMs: order * 35,
        durationMs: 280,
        easing: createClassicEasing("standard")
      }, "list-reorder");
    })
  );
}

function tabIndicatorSlideSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
          initial: { ...step.initial, width: Math.max(1, (step.initial?.width ?? 1) * 0.72), scale: 1, opacity: 0 },
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
          animate: { ...step.animate, width: Math.max(1, (step.initial?.width ?? 1) * 0.72), scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: isIndicator ? "指示器滑移" : "Tab 内容跟随",
        delayMs: isIndicator ? 0 : 110 + order * 18,
        durationMs: isIndicator ? 340 : 210,
        easing: createClassicEasing(isIndicator ? "sharp" : "standard")
      }, isIndicator ? "tab-slide" : "content-replace");
    })
  );
}

function cardExpandRevealSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
          animate: { ...step.animate, height: Math.max(1, (step.initial?.height ?? 1) * 0.55), scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: isContainer ? "卡片容器展开" : "卡片内容跟随",
        delayMs: isContainer ? 0 : 120 + order * 22,
        durationMs: isContainer ? 440 : 240,
        easing: createClassicEasing(isContainer ? "sharp" : "standard")
      }, isContainer ? "container-reveal" : "content-follow");
    })
  );
}

function listInsertPushSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
          animate: { ...step.animate, height: Math.max(1, (step.initial?.height ?? 1) * 0.2), scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: "列表项推开",
        delayMs: 40 + order * 34,
        durationMs: 330,
        easing: createClassicEasing("standard")
      }, "list-push");
    })
  );
}

function bottomSheetRiseSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
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
            initial: { ...step.initial, height: isSheet ? Math.max(1, height * 0.18) : height, scale: 1, opacity: isSheet ? 0.86 : 0 },
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
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: role === "mask" ? "蒙层先稳定" : isSheet ? "面板空间就位" : "浮层内容跟随",
        delayMs: role === "mask" ? 0 : isSheet ? 40 : 130 + order * 22,
        durationMs: role === "mask" ? 260 : isSheet ? 400 : 220,
        easing: createClassicEasing(isSheet ? "sharp" : "standard")
      }, isSheet ? "sheet-rise" : "content-follow");
    })
  );
}

function contentReplaceSteps(context: RecipeContext): CompositionStep[] {
  return withSequentialFirst(
    context.baseSteps.map((step) => {
      const order = semanticOrder(step, context);
      const role = semanticRole(step, context);
      if (step.id.startsWith("zero-layer-enter")) {
        return {
          ...step,
          label: role === "content-text" ? "新文案补入" : "新内容补入",
          delayMs: 150 + order * 32,
          durationMs: 200,
          initial: { ...step.initial, width: Math.max(1, (step.initial?.width ?? 1) * 0.7), scale: 1, opacity: 0 },
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
          animate: { ...step.animate, width: Math.max(1, (step.initial?.width ?? 1) * 0.64), scale: 1, opacity: 0 },
          easing: createClassicEasing("accelerate")
        };
      }
      return withMotionStyle({
        ...corridorMatchedStep(step),
        label: isFoundationStep(step, context) ? "承载层保持稳定" : "内容替换跟随",
        delayMs: isFoundationStep(step, context) ? 0 : 90 + order * 20,
        durationMs: isFoundationStep(step, context) ? 280 : 230,
        easing: createClassicEasing("standard")
      }, isFoundationStep(step, context) ? "container-first" : "content-replace");
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
      ...(objects ? { objects } : {})
    }
  };
}

export function applyZeroLayerMotionRecipe(
  source: ZeroLayerMorphSource,
  recipeId: ZeroLayerMotionRecipeId,
  options: ZeroLayerMotionRecipeApplyOptions = {}
): ZeroLayerMotionCompositionResult {
  const base = compileZeroLayerMotionComposition({
    from: source.from,
    to: source.to,
    bindingResult: source.bindingResult,
    ...(source.diagnosticReport ? { diagnosticReport: source.diagnosticReport } : {})
  });
  const orderPlan = createZeroMotionOrderPlan(source, base.steps, options.spec);
  const context: RecipeContext = {
    baseSteps: base.steps,
    nodeByLayerId: buildNodeIndex(source),
    mainLayerId: findMainLayerId(source),
    orderPlan
  };
  const adaptedParameters =
    options.adaptedParameters ??
    (options.spec ? adaptZeroLayerRecipeParameters(options.spec, recipeId) : undefined);
  const steps = adaptedParameters
    ? applyZeroLayerRecipeAdaptedParameters(recipeSteps(recipeId, context), adaptedParameters, { orderPlan })
    : recipeSteps(recipeId, context);
  const document = withSteps(base.document, steps, source);
  return {
    document,
    steps,
    bindingResult: base.bindingResult,
    summary: `${recipeLabel(recipeId)}：${steps.length} 个 Zero 图层片段，${
      document.composition?.totalDurationMs ?? document.timeline.durationMs
    }ms${adaptedParameters ? ` · ${adaptedParameters.summary}` : ""}`
  };
}
