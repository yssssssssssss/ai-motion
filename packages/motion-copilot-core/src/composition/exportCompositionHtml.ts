import {
  easingCss,
  createClassicEasing,
  type CompositionStep,
  type CompositionTrack,
  type EasingSpec,
  type MotionDocument
} from "../schema/document";
import { getAppMotionPreset, type AppMotionPresetId } from "../preset/appMotionPresets";
import { computeCompositionStepWindows } from "./evaluateComposition";
import { exportVisualCompositionHtml } from "./exportVisualCompositionHtml";
import { exportZeroLayerCompositionHtml } from "../zeroLayerMorph/exportZeroLayerCompositionHtml";
import { exportFrameMorphCompositionHtml } from "./exportFrameMorphCompositionHtml";

function presetKeyframeName(step: CompositionStep, index: number): string {
  return `mc-comp-${index}-${step.presetId}`;
}

function stepEasing(step: CompositionStep): string {
  let patch: ReturnType<ReturnType<typeof getAppMotionPreset>["apply"]> = {};
  try {
    const preset = getAppMotionPreset(step.presetId as AppMotionPresetId);
    patch = preset.apply({
      elements: [{ id: "p", name: "P", role: "modal", size: "medium", initial: {}, animate: {} }],
      layers: [],
      timeline: {
        trigger: "load",
        direction: "enter",
        durationMs: 240,
        delayMs: 0,
        easing: createClassicEasing("decelerate"),
        repeat: "none"
      },
      stage: { mode: "mobile", width: 390, height: 844, background: "#eef2f6" },
      appliedPresets: [],
      presetResolutions: [],
      guidelineSuggestions: [],
      version: "0.1"
    });
  } catch {
    patch = {};
  }
  const easing: EasingSpec = step.easing ?? patch.timeline?.easing ?? createClassicEasing("decelerate");
  return easingCss(easing);
}

function stepKeyframes(step: CompositionStep, index: number): string {
  const dummyDoc = {
    elements: [
      { id: "p", name: "P", role: "modal" as const, size: "medium" as const, initial: {}, animate: {} }
    ],
    layers: [],
    timeline: {
      trigger: "load" as const,
      direction: "enter" as const,
      durationMs: 240,
      delayMs: 0,
      easing: createClassicEasing("decelerate"),
      repeat: "none" as const
    },
    stage: { mode: "mobile" as const, width: 390, height: 844, background: "#eef2f6" },
    appliedPresets: [],
    presetResolutions: [],
    guidelineSuggestions: [],
    version: "0.1" as const
  };
  let patch: ReturnType<ReturnType<typeof getAppMotionPreset>["apply"]> = {};
  try {
    const preset = getAppMotionPreset(step.presetId as AppMotionPresetId);
    patch = preset.apply(dummyDoc);
  } catch {
    patch = {};
  }
  const initial = { ...(patch.element?.initial ?? {}), ...(step.initial ?? {}) };
  const animate = { ...(patch.element?.animate ?? {}), ...(step.animate ?? {}) };
  const name = presetKeyframeName(step, index);

  function val(obj: Record<string, number | undefined>, key: string, fallback: number): number {
    const v = obj[key];
    return typeof v === "number" ? v : fallback;
  }

  const fromTransform = `translate(${val(initial, "x", 0)}px, ${val(initial, "y", 0)}px) scale(${val(initial, "scale", 1)}) rotate(${val(initial, "rotate", 0)}deg)`;
  const toTransform = `translate(${val(animate, "x", 0)}px, ${val(animate, "y", 0)}px) scale(${val(animate, "scale", 1)}) rotate(${val(animate, "rotate", 0)}deg)`;
  const fromOpacity = val(initial, "opacity", 1);
  const toOpacity = val(animate, "opacity", 1);
  const fromBlur = val(initial, "blur", 0);
  const toBlur = val(animate, "blur", 0);
  const fromWidth = val(initial, "width", 0);
  const toWidth = val(animate, "width", 0);
  const fromHeight = val(initial, "height", 0);
  const toHeight = val(animate, "height", 0);
  const fromSize = `${fromWidth > 0 ? `width: ${fromWidth}px;` : ""}${fromHeight > 0 ? ` height: ${fromHeight}px;` : ""}`;
  const toSize = `${toWidth > 0 ? `width: ${toWidth}px;` : ""}${toHeight > 0 ? ` height: ${toHeight}px;` : ""}`;

  return `@keyframes ${name} {
  from { transform: ${fromTransform}; opacity: ${fromOpacity}; filter: blur(${fromBlur}px); ${fromSize} }
  to { transform: ${toTransform}; opacity: ${toOpacity}; filter: blur(${toBlur}px); ${toSize} }
}`;
}

/**
 * 将组合轨道导出为一段自包含的 HTML，多 step 按时序串行/并行播放
 */
export function exportCompositionHtml(track: CompositionTrack, document?: MotionDocument): string {
  if (track.steps.length === 0) {
    return "<!-- 组合轨道为空 -->";
  }
  if (document?.visualSource?.kind === "zero-visual-morph") {
    return exportVisualCompositionHtml(document, track);
  }
  if (document?.visualSource?.kind === "zero-layer-morph") {
    return exportZeroLayerCompositionHtml(document, track);
  }
  if (document && track.steps.some((s) => s.presetId === "frame-morph-layout")) {
    return exportFrameMorphCompositionHtml(document, track);
  }

  const starts = computeCompositionStepWindows(track.steps).map((item) => item.start);
  const keyframesAll = track.steps.map((step, i) => stepKeyframes(step, i)).join("\n");

  const animationEntries = track.steps.map((step, i) => {
    const name = presetKeyframeName(step, i);
    const delay = starts[i]!;
    const easing = stepEasing(step);
    return `${name} ${step.durationMs}ms ${easing} ${delay}ms both`;
  });

  const stepsHtml = track.steps
    .map((step, i) => {
      const targetLabel = step.target === "selected-layer" ? (step.layerName ?? "图层") : "未绑定图层";
      return `    <div class="mc-comp-step" data-step="${i + 1}" data-preset="${step.presetId}">
      <span class="mc-comp-label">${step.label}</span>
      <span class="mc-comp-target">${targetLabel}</span>
    </div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Motion Copilot - 组合动效导出</title>
  <style>
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8fa; font-family: system-ui, sans-serif; }
.mc-comp-stage { position: relative; width: min(390px, 90vw); aspect-ratio: 390 / 844; background: #eef2f6; border-radius: 30px; overflow: hidden; display: grid; place-items: center; }
.mc-comp-target { position: relative; z-index: 10; width: 76%; min-height: 200px; background: #fff; border-radius: 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); padding: 24px; display: grid; gap: 8px; place-items: center; animation: ${animationEntries.join(",\n    ")}; will-change: transform, opacity, filter; }
.mc-comp-step { position: absolute; bottom: 16px; left: 16px; right: 16px; padding: 8px 12px; background: rgba(0,0,0,0.6); border-radius: 8px; color: #fff; font-size: 12px; display: flex; justify-content: space-between; opacity: 0.7; }
.mc-comp-info { position: absolute; top: 16px; left: 16px; font-size: 11px; color: #6a737d; }
${keyframesAll}
@media (prefers-reduced-motion: reduce) { .mc-comp-target { animation: none; } }
  </style>
</head>
<body>
  <div class="mc-comp-stage">
    <span class="mc-comp-info">${track.steps.length} 个动效片段 / 总时长 ${track.totalDurationMs}ms</span>
    <div class="mc-comp-target">
${stepsHtml}
    </div>
  </div>
</body>
</html>`;
}
