import {
  createClassicEasing,
  createSpringEasing,
  durationRangeForSize,
  primaryElement,
  zLevelForRole,
  springStrategyForZLevel,
  type GuidelineSuggestion,
  type MotionDocument,
  type MotionState
} from "../schema/document";

function numeric(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function changedFields(initial: MotionState, animate: MotionState): string[] {
  return (["x", "y", "scale", "opacity", "blur", "rotate"] as const).filter(
    (field) => numeric(initial[field], field === "scale" || field === "opacity" ? 1 : 0) !==
      numeric(animate[field], field === "scale" || field === "opacity" ? 1 : 0)
  );
}

function hasDisplacement(initial: MotionState, animate: MotionState): boolean {
  const fields = changedFields(initial, animate);
  return fields.includes("x") || fields.includes("y") || fields.includes("scale");
}

export function evaluateGuidelines(document: MotionDocument): GuidelineSuggestion[] {
  const element = primaryElement(document);
  const range = durationRangeForSize(element.size);
  const suggestions: GuidelineSuggestion[] = [];

  if (document.timeline.durationMs > range.max) {
    suggestions.push({
      id: "duration-too-slow",
      target: { elementId: element.id, field: "timeline.durationMs" },
      severity: "suggestion",
      title: "时长偏慢",
      reason: `${element.size} 尺寸对象建议控制在 ${range.min}-${range.max}ms。`,
      suggestedPatch: { timeline: { durationMs: range.recommended } },
      status: "open"
    });
  }

  if (document.timeline.durationMs < range.min) {
    suggestions.push({
      id: "duration-too-fast",
      target: { elementId: element.id, field: "timeline.durationMs" },
      severity: "info",
      title: "时长偏快",
      reason: `当前动效可能略显急促，建议接近 ${range.recommended}ms。`,
      suggestedPatch: { timeline: { durationMs: range.recommended } },
      status: "open"
    });
  }

  if (document.timeline.direction === "exit-final" && document.timeline.durationMs > range.recommended) {
    suggestions.push({
      id: "exit-too-slow",
      target: { elementId: element.id, field: "timeline.durationMs" },
      severity: "suggestion",
      title: "离场偏慢",
      reason: "最终关闭应减少干扰，建议短于同尺寸进场推荐时长。",
      suggestedPatch: { timeline: { durationMs: Math.max(range.min, range.recommended - 40) } },
      status: "open"
    });
  }

  if (element.role === "button" && document.timeline.trigger === "click" && document.timeline.easing.type !== "spring") {
    suggestions.push({
      id: "button-click-needs-spring",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "info",
      title: "按钮反馈可更有手感",
      reason: "按钮点击属于明确反馈动作，适度回弹能强化按压感。",
      suggestedPatch: {
        element: { animate: { scale: 0.96 } },
        timeline: { easing: { type: "spring", stiffness: 220, damping: 18, mass: 1, cssFallback: "cubic-bezier(0.34, 1.56, 0.64, 1)" } }
      },
      status: "open"
    });
  }

  if (
    element.role === "toast" &&
    document.timeline.direction === "exit-final" &&
    document.timeline.easing.type === "spring"
  ) {
    suggestions.push({
      id: "toast-exit-no-spring",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "warning",
      title: "提示退出不建议回弹",
      reason: "临时提示消失时应快速退出，回弹会增加不必要的视觉停留。",
      suggestedPatch: {
        timeline: {
          easing: { type: "classic", preset: "accelerate", css: "cubic-bezier(0.4, 0, 1, 1)" },
          durationMs: range.min
        }
      },
      status: "open"
    });
  }

  if (document.timeline.easing.type === "spring" && changedFields(element.initial, element.animate).join(",") === "opacity") {
    suggestions.push({
      id: "opacity-only-no-spring",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "info",
      title: "透明度动效无需回弹",
      reason: "只有透明度变化时，spring 的物理感不会形成明确视觉收益。",
      suggestedPatch: {
        timeline: { easing: { type: "classic", preset: "standard", css: "cubic-bezier(0.35, 0, 0.25, 1)" } }
      },
      status: "open"
    });
  }

  if (
    element.size === "large" &&
    document.timeline.easing.type === "spring" &&
    (document.timeline.easing.stiffness > 260 || document.timeline.easing.damping < 16)
  ) {
    suggestions.push({
      id: "large-spring-noise",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "warning",
      title: "大面积回弹过强",
      reason: "大面积容器使用高弹性回弹容易造成视觉噪点，建议改为克制缓动。",
      suggestedPatch: {
        timeline: { easing: { type: "classic", preset: "decelerate", css: "cubic-bezier(0.18, 0.86, 0.22, 1)" } }
      },
      status: "open"
    });
  }

  // ─── 回弹判定逻辑（规范 §4.3）───
  // 空间属性(位移/缩放/旋转)变化 → 建议使用弹簧（中层）
  // 效果属性(仅透明度/颜色)变化 → 不应使用弹簧
  const fields = changedFields(element.initial, element.animate);
  const hasSpatialChange = fields.some((f) => f === "x" || f === "y" || f === "scale" || f === "rotate");
  const zLevel = zLevelForRole(element.role);
  const strategy = springStrategyForZLevel(zLevel);

  if (hasSpatialChange && document.timeline.easing.type !== "spring" && strategy.allowBounce && document.timeline.trigger !== "load") {
    suggestions.push({
      id: "spatial-change-suggest-spring",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "info",
      title: "空间变化可加弹簧",
      reason: "位移/缩放/旋转等空间属性变化使用弹簧回弹可增强物理真实感（中层核心操作层策略）。",
      suggestedPatch: {
        timeline: { easing: createSpringEasing({ damping: strategy.dampingRange[0] }) }
      },
      status: "open"
    });
  }

  // 顶层控件不应使用弹簧（高阻尼/无回弹策略）
  if (zLevel === "top" && document.timeline.easing.type === "spring") {
    suggestions.push({
      id: "top-level-no-bounce",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "warning",
      title: "顶层控件不应回弹",
      reason: "导航栏、Tab栏、悬浮按钮属于顶层稳定控件，应使用高阻尼/无回弹策略保持框架稳定感。",
      suggestedPatch: {
        timeline: { easing: createClassicEasing("standard") }
      },
      status: "open"
    });
  }

  // 底层容器不应独立运动
  if (zLevel === "bottom" && document.timeline.easing.type === "spring") {
    suggestions.push({
      id: "bottom-level-no-spring",
      target: { elementId: element.id, field: "timeline.easing" },
      severity: "suggestion",
      title: "底层容器避免弹簧",
      reason: "底层氛围容器应从属、被动，通常跟随中层元素联动，避免独立弹跳。",
      suggestedPatch: {
        timeline: { easing: createClassicEasing("standard") }
      },
      status: "open"
    });
  }

  // 骨架屏场景不应有位移或回弹
  const skeletonApplied = (document.appliedPresets ?? []).some((p) => p.id === "skeleton-loading");
  if (skeletonApplied) {
    if (hasDisplacement(element.initial, element.animate)) {
      suggestions.push({
        id: "skeleton-has-displacement",
        target: { elementId: element.id, field: "element.initial" },
        severity: "warning",
        title: "骨架屏不应有位移",
        reason: "骨架屏加载应保持原位，仅做透明度变化。当前存在 x/y/scale 位移。",
        suggestedPatch: {
          element: { initial: { x: 0, y: 0, scale: 1 }, animate: { x: 0, y: 0, scale: 1 } }
        },
        status: "open"
      });
    }
    if (document.timeline.easing.type === "spring") {
      suggestions.push({
        id: "skeleton-no-spring",
        target: { elementId: element.id, field: "timeline.easing" },
        severity: "warning",
        title: "骨架屏不应使用弹簧",
        reason: "骨架屏加载避免回弹，使用标准曲线保持阅读视点稳定。",
        suggestedPatch: {
          timeline: { easing: createClassicEasing("standard") }
        },
        status: "open"
      });
    }
  }

  // 组合轨道总时长过长
  if (document.composition && document.composition.totalDurationMs > 2000) {
    suggestions.push({
      id: "composition-duration-warning",
      target: { elementId: element.id, field: "composition.totalDurationMs" },
      severity: "suggestion",
      title: "组合动效总时长过长",
      reason: `当前组合轨道总时长 ${document.composition.totalDurationMs}ms，超过 2000ms 可能让用户感到拖沓。`,
      status: "open"
    });
  }

  return suggestions;
}
