import {
  createClassicEasing,
  createSpringEasing,
  durationRangeForSize,
  primaryElement,
  selectedLayer,
  type AppMotionPresetTarget,
  type AppMotionPresetSlot,
  type AppliedMotionPreset,
  type LayerMotionPreset,
  type MotionDocument,
  type MotionDocumentPatch,
  type MotionLayer,
  type MotionLayerMotion,
  type MotionPresetResolution
} from "../schema/document";
import { applyDocumentPatch } from "../schema/defaults";

export type AppMotionScene =
  | "page-transition"
  | "navigation-push"
  | "navigation-pop"
  | "tab-switch"
  | "modal"
  | "toast-feedback"
  | "button-feedback"
  | "skeleton-loading"
  | "list-sequence"
  | "bottom-sheet"
  | "pull-refresh"
  | "search-expand"
  | "card-expand"
  | "micro-feedback"
  | "form-feedback"
  | "loading-state"
  | "empty-state"
  | "overlay";

export type AppMotionPresetId =
  | "enter-screen"
  | "exit-final"
  | "move-inside"
  | "exit-temporary"
  | "container-transform"
  | "navigation-push"
  | "horizontal-switch"
  | "modal-feedback"
  | "skeleton-loading"
  | "list-stagger"
  | "bottom-sheet-up"
  | "bottom-sheet-down"
  | "pull-refresh"
  | "search-expand"
  | "card-expand-detail"
  | "like-bounce"
  | "form-error-shake"
  | "loading-to-success"
  | "empty-state-appear"
  | "overlay-fade-in"
  | "overlay-fade-out";

export type AppMotionPresetDefinition = {
  id: AppMotionPresetId;
  label: string;
  scene: AppMotionScene;
  slot: AppMotionPresetSlot;
  summary: string;
  guideline: string;
  apply: (document: MotionDocument) => MotionDocumentPatch;
};

type PresetTargetContext =
  | { target: "target"; layer?: undefined }
  | { target: "selected-layer"; layer: MotionLayer };

export type ApplyAppMotionPresetOptions = {
  target?: AppMotionPresetTarget;
};

function appliedPreset(preset: AppMotionPresetDefinition, context: PresetTargetContext): AppliedMotionPreset {
  return {
    id: preset.id,
    label: preset.label,
    slot: preset.slot,
    target: context.target,
    ...(context.layer ? { layerId: context.layer.id, layerName: context.layer.name } : {}),
    source: "app-guideline"
  };
}

function durationFor(document: MotionDocument, fallback: number): number {
  const element = primaryElement(document);
  const range = durationRangeForSize(element.size);
  return Math.min(range.max, Math.max(range.min, fallback));
}

const skeletonIncompatibleSlots = new Set<AppMotionPresetSlot>(["trajectory", "scene", "feedback"]);

function presetLabels(presets: AppliedMotionPreset[]): string {
  return presets.map((preset) => `「${preset.label}」`).join("、");
}

function samePresetTarget(preset: AppliedMotionPreset, context: PresetTargetContext): boolean {
  const target = preset.target ?? "target";
  if (target !== context.target) return false;
  if (context.target === "selected-layer") return preset.layerId === context.layer.id;
  return true;
}

function nextPresetState(
  document: MotionDocument,
  preset: AppMotionPresetDefinition,
  context: PresetTargetContext
): { appliedPresets: AppliedMotionPreset[]; presetResolutions: MotionPresetResolution[] } {
  let current = document.appliedPresets ?? [];
  const resolutions: MotionPresetResolution[] = [];

  if (preset.id === "skeleton-loading") {
    const removed = current.filter((item) => samePresetTarget(item, context) && skeletonIncompatibleSlots.has(item.slot));
    if (removed.length > 0) {
      resolutions.push({
        id: "skeleton-removes-motion",
        presetId: preset.id,
        action: "adjusted",
        title: "已移除位移/回弹组合",
        reason: `骨架屏加载只允许原位透明度变化，系统已移除 ${presetLabels(removed)}，避免布局跳动。`
      });
    }
    current = current.filter((item) => !samePresetTarget(item, context) || !skeletonIncompatibleSlots.has(item.slot));
  } else if (skeletonIncompatibleSlots.has(preset.slot)) {
    const skeleton = current.find((item) => samePresetTarget(item, context) && item.id === "skeleton-loading");
    if (skeleton) {
      resolutions.push({
        id: "motion-replaces-skeleton",
        presetId: preset.id,
        action: "adjusted",
        title: "已退出骨架屏策略",
        reason: `${preset.label} 会引入位移或空间变化，系统已移除「骨架屏加载」以避免规则冲突。`
      });
    }
    current = current.filter((item) => !samePresetTarget(item, context) || item.id !== "skeleton-loading");
  }

  const replaced = current.find((item) => samePresetTarget(item, context) && item.slot === preset.slot && item.id !== preset.id);
  if (replaced) {
    resolutions.push({
      id: `replace-${preset.slot}`,
      presetId: preset.id,
      action: "replaced",
      title: "已替换同类动效",
      reason: `「${preset.label}」与「${replaced.label}」同属 ${preset.slot}，系统保留最后选择，避免同一类动效互相覆盖。`
    });
  }

  return {
    appliedPresets: [
      ...current.filter((item) => !samePresetTarget(item, context) || item.slot !== preset.slot),
      appliedPreset(preset, context)
    ],
    presetResolutions: resolutions
  };
}

function staggerLayers(layers: MotionLayer[]): MotionLayer[] {
  let index = 0;
  return layers.map((layer) => {
    if (!layer.editable || layer.hidden) return layer;
    const delayMs = index * 45;
    index += 1;
    return {
      ...layer,
      motion: {
        preset: "lift",
        durationMs: 220,
        delayMs
      }
    };
  });
}

function layerMotionPresetFor(presetId: AppMotionPresetId): LayerMotionPreset {
  if (presetId === "enter-screen" || presetId === "modal-feedback" || presetId === "list-stagger" || presetId === "bottom-sheet-up" || presetId === "empty-state-appear") return "lift";
  if (presetId === "exit-final" || presetId === "skeleton-loading" || presetId === "bottom-sheet-down" || presetId === "overlay-fade-in" || presetId === "overlay-fade-out" || presetId === "loading-to-success") return "fade";
  if (presetId === "container-transform" || presetId === "card-expand-detail" || presetId === "like-bounce") return "zoom";
  if (presetId === "move-inside" || presetId === "exit-temporary" || presetId === "form-error-shake") return "slide-left";
  if (presetId === "search-expand") return "slide-right";
  if (presetId === "pull-refresh") return "lift";
  return "slide-right";
}

function layerMotionFor(preset: AppMotionPresetDefinition, document: MotionDocument): MotionLayerMotion {
  const basePatch = preset.apply(document);
  const initial = basePatch.element?.initial ?? {};
  const animate = basePatch.element?.animate ?? {};
  return {
    preset: layerMotionPresetFor(preset.id),
    durationMs: basePatch.timeline?.durationMs ?? 220,
    delayMs: 0,
    ...(typeof initial.scale === "number" ? { scaleFrom: initial.scale } : {}),
    ...(typeof initial.opacity === "number" ? { opacityFrom: initial.opacity } : {}),
    ...(typeof animate.opacity === "number" ? { opacityTo: animate.opacity } : {}),
    ...(basePatch.timeline?.easing ? { easing: basePatch.timeline.easing } : {})
  };
}

function selectedLayerUnavailableResolution(preset: AppMotionPresetDefinition): MotionPresetResolution {
  return {
    id: "selected-layer-unavailable",
    presetId: preset.id,
    action: "adjusted",
    title: "未应用图层动效",
    reason: "当前没有可编辑的当前图层。请先选择一个文本或图片图层，再将规范动效应用到当前图层。"
  };
}

export const appMotionPresets: AppMotionPresetDefinition[] = [
  {
    id: "enter-screen",
    label: "进入屏幕",
    scene: "page-transition",
    slot: "trajectory",
    summary: "我来了：初快后慢，让新内容被感知。",
    guideline: "使用减速曲线，适合 Toast、非焦点进场与轻量页面元素出现。",
    apply: (document) => ({
      element: { initial: { y: 18, scale: 0.98, opacity: 0, blur: 0 }, animate: { y: 0, scale: 1, opacity: 1, blur: 0 } },
      timeline: { direction: "enter", durationMs: durationFor(document, 240), easing: createClassicEasing("decelerate") }
    })
  },
  {
    id: "exit-final",
    label: "永久离开",
    scene: "page-transition",
    slot: "trajectory",
    summary: "彻底结束：快速释放空间，不拖泥带水。",
    guideline: "使用加速曲线，适合关闭、删除、最终退出。",
    apply: () => ({
      element: { initial: { y: 0, scale: 1, opacity: 1, blur: 0 }, animate: { y: 8, scale: 0.98, opacity: 0, blur: 0 } },
      timeline: { direction: "exit-final", durationMs: 90, easing: createClassicEasing("accelerate") }
    })
  },
  {
    id: "move-inside",
    label: "屏幕内移动",
    scene: "tab-switch",
    slot: "trajectory",
    summary: "精准停靠：慢-快-慢，稳定移动到目标位置。",
    guideline: "使用标准曲线，适合指示器、选中态和点对点位移。",
    apply: () => ({
      element: { initial: { x: -18, y: 0, scale: 1, opacity: 1 }, animate: { x: 0, y: 0, scale: 1, opacity: 1 } },
      timeline: { direction: "move-inside", durationMs: 180, easing: createClassicEasing("standard") }
    })
  },
  {
    id: "exit-temporary",
    label: "暂时退出",
    scene: "navigation-pop",
    slot: "trajectory",
    summary: "退居幕后：快速退场，为新页面让位。",
    guideline: "使用夏普曲线，适合父级页面向幕后滑出。",
    apply: () => ({
      element: { initial: { x: 0, y: 0, scale: 1, opacity: 1 }, animate: { x: -36, y: 0, scale: 1, opacity: 0.96 } },
      timeline: { direction: "exit-temporary", durationMs: 120, easing: createClassicEasing("sharp") }
    })
  },
  {
    id: "container-transform",
    label: "容器变化",
    scene: "page-transition",
    slot: "scene",
    summary: "卡片到详情：通过形变建立视觉连续性。",
    guideline: "使用低阻尼物理弹簧，但避免过强回弹造成大面积视觉噪点。",
    apply: () => ({
      element: { size: "large", initial: { y: 24, scale: 0.92, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "click", direction: "enter", durationMs: 340, easing: createSpringEasing({ stiffness: 210, damping: 18 }) }
    })
  },
  {
    id: "navigation-push",
    label: "前后切换",
    scene: "navigation-push",
    slot: "scene",
    summary: "进入二级页面：强化空间深入方向。",
    guideline: "使用减速曲线，不使用回弹，保证移动端页面导航稳定。",
    apply: () => ({
      element: { initial: { x: 36, y: 0, scale: 1, opacity: 0.98 }, animate: { x: 0, y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "click", direction: "enter", durationMs: 280, easing: createClassicEasing("decelerate") }
    })
  },
  {
    id: "horizontal-switch",
    label: "横向切换",
    scene: "tab-switch",
    slot: "scene",
    summary: "同层切换：快速、干脆、保持结构稳定。",
    guideline: "使用标准曲线，适合顶部类目、底部 Tab 和指示器切换。",
    apply: () => ({
      element: { initial: { x: 20, y: 0, scale: 1, opacity: 1 }, animate: { x: 0, y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "click", direction: "move-inside", durationMs: 180, easing: createClassicEasing("standard") }
    })
  },
  {
    id: "modal-feedback",
    label: "弹窗反馈",
    scene: "modal",
    slot: "scene",
    summary: "进场吸睛，离场快速撤离。",
    guideline: "进场可用减速或轻弹簧，离场必须切换为加速短时长策略。",
    apply: () => ({
      element: { role: "modal", size: "medium", initial: { y: 24, scale: 0.96, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "load", direction: "enter", durationMs: 260, easing: createSpringEasing({ stiffness: 220, damping: 20 }) }
    })
  },
  {
    id: "skeleton-loading",
    label: "骨架屏加载",
    scene: "skeleton-loading",
    slot: "visual",
    summary: "原位渐隐渐现，保持阅读视点稳定。",
    guideline: "只允许透明度变化，不位移、不回弹，避免布局跳动。",
    apply: () => ({
      element: { initial: { x: 0, y: 0, scale: 1, opacity: 0, blur: 0 }, animate: { x: 0, y: 0, scale: 1, opacity: 1, blur: 0 } },
      timeline: { trigger: "load", direction: "enter", durationMs: 220, easing: createClassicEasing("standard") }
    })
  },
  {
    id: "list-stagger",
    label: "依次浮现",
    scene: "list-sequence",
    slot: "sequence",
    summary: "有先有后，避免信息瞬间堆叠。",
    guideline: "用于列表、瀑布流、商品卡片，让子项按 45ms 间隔依次出现。",
    apply: () => ({})
  },
  {
    id: "bottom-sheet-up",
    label: "底部面板升起",
    scene: "bottom-sheet",
    slot: "scene",
    summary: "从底部滑出，减速到位，不回弹。",
    guideline: "使用减速曲线，位移距离与面板高度匹配，不使用弹簧避免内容抖动。",
    apply: () => ({
      element: { role: "modal", size: "large", initial: { y: 120, scale: 1, opacity: 0.9 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "click", direction: "enter", durationMs: 320, easing: createClassicEasing("decelerate") }
    })
  },
  {
    id: "bottom-sheet-down",
    label: "底部面板收回",
    scene: "bottom-sheet",
    slot: "scene",
    summary: "加速下滑消失，快速释放空间。",
    guideline: "使用加速曲线，时长短于升起（规范要求退出 0-100ms 临时性），让用户感觉面板被甩下去。",
    apply: () => ({
      element: { initial: { y: 0, scale: 1, opacity: 1 }, animate: { y: 120, scale: 1, opacity: 0.9 } },
      timeline: { trigger: "click", direction: "exit-final", durationMs: 150, easing: createClassicEasing("accelerate") }
    })
  },
  {
    id: "pull-refresh",
    label: "下拉刷新",
    scene: "pull-refresh",
    slot: "feedback",
    summary: "跟手下拉后弹回，弹簧体现物理惯性。",
    guideline: "使用轻弹簧，阻尼偏高避免过度回弹，时长短于 300ms。",
    apply: () => ({
      element: { initial: { y: 40, scale: 1, opacity: 1 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "load", direction: "enter", durationMs: 260, easing: createSpringEasing({ stiffness: 300, damping: 22 }) }
    })
  },
  {
    id: "search-expand",
    label: "搜索框展开",
    scene: "search-expand",
    slot: "scene",
    summary: "横向展开搜索栏，标准曲线保持稳定。",
    guideline: "使用标准曲线，只做宽度和透明度变化，不位移主内容。",
    apply: () => ({
      element: { initial: { x: 12, scale: 0.96, opacity: 0 }, animate: { x: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "click", direction: "enter", durationMs: 220, easing: createClassicEasing("standard") }
    })
  },
  {
    id: "card-expand-detail",
    label: "卡片展开详情",
    scene: "card-expand",
    slot: "scene",
    summary: "卡片放大为详情页，形变建立视觉连续性。",
    guideline: "使用低阻尼弹簧，缩放从 0.88 到 1，配合透明度。避免过强回弹。",
    apply: () => ({
      element: { size: "large", initial: { y: 20, scale: 0.88, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "click", direction: "enter", durationMs: 360, easing: createSpringEasing({ stiffness: 200, damping: 20 }) }
    })
  },
  {
    id: "like-bounce",
    label: "点赞弹跳",
    scene: "micro-feedback",
    slot: "feedback",
    summary: "短促弹跳，给予即时反馈。",
    guideline: "使用高刚度弹簧，时长极短（≤160ms），仅做缩放不位移。",
    apply: () => ({
      element: { role: "button", size: "small", initial: { scale: 1 }, animate: { scale: 0.85 } },
      timeline: { trigger: "click", direction: "move-inside", durationMs: 140, easing: createSpringEasing({ stiffness: 400, damping: 14 }) }
    })
  },
  {
    id: "form-error-shake",
    label: "表单错误抖动",
    scene: "form-feedback",
    slot: "feedback",
    summary: "水平抖动，明确提示输入错误。",
    guideline: "使用利落曲线，仅做 X 轴位移 ±6px，时长短不超过 180ms。",
    apply: () => ({
      element: { initial: { x: -6, y: 0, scale: 1, opacity: 1 }, animate: { x: 0, y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "load", direction: "move-inside", durationMs: 160, easing: createClassicEasing("sharp") }
    })
  },
  {
    id: "loading-to-success",
    label: "加载转成功",
    scene: "loading-state",
    slot: "visual",
    summary: "缩放加淡入，确认操作完成。",
    guideline: "使用减速曲线，从缩小状态放大到 1，配合透明度。不用弹簧避免喧宾夺主。",
    apply: () => ({
      element: { initial: { scale: 0.9, opacity: 0, blur: 1 }, animate: { scale: 1, opacity: 1, blur: 0 } },
      timeline: { trigger: "load", direction: "enter", durationMs: 240, easing: createClassicEasing("decelerate") }
    })
  },
  {
    id: "empty-state-appear",
    label: "空状态出现",
    scene: "empty-state",
    slot: "visual",
    summary: "缓慢浮现，不抢视觉焦点。",
    guideline: "使用标准曲线，纯透明度变化 + 微小上浮（8px），时长略长于普通进场。",
    apply: () => ({
      element: { initial: { y: 8, scale: 1, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { trigger: "load", direction: "enter", durationMs: 300, easing: createClassicEasing("standard") }
    })
  },
  {
    id: "overlay-fade-in",
    label: "遮罩浮现",
    scene: "overlay",
    slot: "visual",
    summary: "背景遮罩渐显，聚焦前景内容。",
    guideline: "纯透明度变化，时长 180-240ms，不使用弹簧。",
    apply: () => ({
      element: { initial: { opacity: 0 }, animate: { opacity: 1 } },
      timeline: { trigger: "load", direction: "enter", durationMs: 200, easing: createClassicEasing("standard") }
    })
  },
  {
    id: "overlay-fade-out",
    label: "遮罩消失",
    scene: "overlay",
    slot: "visual",
    summary: "快速消退，不阻碍后续操作。",
    guideline: "纯透明度变化，使用加速曲线，时长短于浮现。",
    apply: () => ({
      element: { initial: { opacity: 1 }, animate: { opacity: 0 } },
      timeline: { trigger: "load", direction: "exit-final", durationMs: 150, easing: createClassicEasing("accelerate") }
    })
  }
];

export function getAppMotionPreset(id: AppMotionPresetId): AppMotionPresetDefinition {
  const preset = appMotionPresets.find((item) => item.id === id);
  if (!preset) throw new Error(`Unknown app motion preset: ${id}`);
  return preset;
}

export function applyAppMotionPreset(
  document: MotionDocument,
  presetId: AppMotionPresetId,
  options: ApplyAppMotionPresetOptions = {}
): MotionDocument {
  const preset = getAppMotionPreset(presetId);

  if (options.target === "selected-layer") {
    const layer = selectedLayer(document);
    if (!layer?.editable || layer.locked || layer.hidden) {
      return applyDocumentPatch(document, { presetResolutions: [selectedLayerUnavailableResolution(preset)] });
    }

    return applyDocumentPatch(document, {
      layer: {
        id: layer.id,
        motion: layerMotionFor(preset, document)
      },
      ...nextPresetState(document, preset, { target: "selected-layer", layer })
    });
  }

  const basePatch = preset.apply(document);
  const presetState = nextPresetState(document, preset, { target: "target" });
  const next = applyDocumentPatch(document, {
    ...basePatch,
    ...presetState
  });

  if (preset.id !== "list-stagger") return next;
  return {
    ...next,
    layers: staggerLayers(next.layers)
  };
}
