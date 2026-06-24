import { describe, expect, it } from "vitest";
import {
  applyDocumentPatch,
  appMotionPresets,
  applyAppMotionPreset,
  compileIntent,
  createClassicEasing,
  createDefaultDocument,
  createSpringEasing,
  evaluateGuidelines,
  exportHtmlCss,
  exportStandaloneHtml,
  layerById,
  primaryElement
} from "../src";

describe("Motion Copilot document", () => {
  it("creates a modal document", () => {
    const document = createDefaultDocument("modal");
    expect(primaryElement(document).role).toBe("modal");
    expect(layerById(document, "modal-title")?.editable).toBe(true);
  });

  it("patches layers and keeps timing", () => {
    const document = createDefaultDocument("modal");
    const patched = applyDocumentPatch(document, {
      layer: { id: "modal-title", content: { text: "替换标题" } }
    });
    expect(layerById(patched, "modal-title")?.content?.text).toBe("替换标题");
    expect(patched.timeline.durationMs).toBe(document.timeline.durationMs);
  });

  it("adds, orders, and removes user layers", () => {
    const document = applyDocumentPatch(createDefaultDocument("modal"), {
      addLayer: {
        id: "user-text-1",
        name: "自定义文本",
        kind: "text",
        editable: true,
        content: { text: "前景" },
        layout: { x: 10, y: 20, width: 120, height: 40, zIndex: 31 }
      }
    });
    expect(document.selectedLayerId).toBe("user-text-1");
    expect(layerById(document, "user-text-1")).toBeDefined();
    expect(layerById(applyDocumentPatch(document, { removeLayerId: "user-text-1" }), "user-text-1")).toBeUndefined();
  });

  it("exports image fit and layer animation metadata", () => {
    const document = applyDocumentPatch(createDefaultDocument("modal"), {
      addLayer: {
        id: "user-image-1",
        name: "前景图片",
        kind: "image",
        editable: true,
        content: { src: "data:image/png;base64,AAA=", alt: "前景图" },
        style: { fit: "contain", position: "bottom" },
        layout: { x: 0, y: 0, width: 120, height: 120 },
        motion: { preset: "lift", durationMs: 320, delayMs: 80 }
      }
    });
    const output = exportHtmlCss(document);
    expect(output.html).toContain("object-fit:contain;object-position:bottom");
    expect(output.html).toContain("animation:mc-free-lift 320ms");
    expect(output.css).toContain("@keyframes mc-free-lift");
  });

  it("exports a standalone safe HTML document payload", () => {
    const standalone = exportStandaloneHtml(createDefaultDocument("modal"));

    expect(standalone).toContain("<!doctype html>");
    expect(standalone).toContain('<meta charset="utf-8" />');
    expect(standalone).toContain("<title>Motion Copilot Export</title>");
    expect(standalone).toContain("@media (prefers-reduced-motion: reduce)");
    expect(standalone).not.toMatch(/https?:\/\//);
    expect(standalone).not.toContain("eval(");
    expect(standalone).not.toContain("fetch(");
    expect(standalone).not.toContain("localStorage");
    expect(standalone).not.toContain("document.cookie");
  });

  it("maps smooth and click intent to deterministic patches", () => {
    const smooth = compileIntent({ prompt: "做一个丝滑高级的弹窗进场" });
    expect(smooth.element?.role).toBe("modal");
    expect(smooth.timeline?.easing).toMatchObject({ type: "classic", preset: "decelerate" });

    const button = compileIntent({ prompt: "按钮点击快速反馈" });
    expect(button.element?.role).toBe("button");
    expect(button.timeline?.trigger).toBe("click");
    expect(button.timeline?.direction).toBe("move-inside");
  });

  it("warns about inappropriate spring usage", () => {
    const toastExit = applyDocumentPatch(createDefaultDocument("toast"), {
      timeline: { direction: "exit-final", easing: createSpringEasing(), durationMs: 260 }
    });
    expect(evaluateGuidelines(toastExit).map((suggestion) => suggestion.id)).toContain("toast-exit-no-spring");

    const opacityOnly = applyDocumentPatch(createDefaultDocument("modal"), {
      element: { size: "medium", initial: { y: 0, scale: 1, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 } },
      timeline: { easing: createSpringEasing() }
    });
    expect(evaluateGuidelines(opacityOnly).map((suggestion) => suggestion.id)).toContain("opacity-only-no-spring");
  });

  it("suggests spring feedback for classic button clicks", () => {
    const document = applyDocumentPatch(createDefaultDocument("button"), {
      timeline: { trigger: "click", easing: createClassicEasing("sharp") }
    });
    expect(evaluateGuidelines(document).map((suggestion) => suggestion.id)).toContain("button-click-needs-spring");
  });

  it("applies mobile app motion presets with a tracked stack", () => {
    const document = applyAppMotionPreset(createDefaultDocument("modal"), "horizontal-switch");

    expect(appMotionPresets.map((preset) => preset.id)).toContain("horizontal-switch");
    expect(document.timeline.direction).toBe("move-inside");
    expect(document.timeline.easing).toMatchObject({ type: "classic", preset: "standard" });
    expect(document.appliedPresets).toEqual([
      expect.objectContaining({ id: "horizontal-switch", label: "横向切换", slot: "scene" })
    ]);
  });

  it("applies app motion presets to the selected layer without changing the main target", () => {
    const document = applyAppMotionPreset(createDefaultDocument("modal"), "horizontal-switch", {
      target: "selected-layer"
    });
    const layer = layerById(document, document.selectedLayerId ?? "");

    expect(document.timeline.durationMs).toBe(260);
    expect(layer?.motion).toMatchObject({ preset: "slide-right", durationMs: 180, delayMs: 0 });
    expect(document.appliedPresets).toEqual([
      expect.objectContaining({
        id: "horizontal-switch",
        target: "selected-layer",
        layerId: "modal-title",
        layerName: "标题"
      })
    ]);
  });

  it("explains when a selected-layer preset cannot be applied", () => {
    const document = {
      ...createDefaultDocument("modal"),
      selectedLayerId: "modal-container"
    };
    const next = applyAppMotionPreset(document, "horizontal-switch", { target: "selected-layer" });

    expect(next.appliedPresets).toEqual([]);
    expect(next.presetResolutions).toEqual([
      expect.objectContaining({ title: "未应用图层动效", action: "adjusted" })
    ]);
  });

  it("replaces presets in the same slot and keeps compatible slots", () => {
    const withScene = applyAppMotionPreset(createDefaultDocument("modal"), "navigation-push");
    const withNextScene = applyAppMotionPreset(withScene, "horizontal-switch");
    const withSequence = applyAppMotionPreset(withNextScene, "list-stagger");

    expect(withNextScene.appliedPresets.map((preset) => preset.id)).toEqual(["horizontal-switch"]);
    expect(withNextScene.presetResolutions).toEqual([
      expect.objectContaining({ action: "replaced", title: "已替换同类动效" })
    ]);
    expect(withSequence.appliedPresets.map((preset) => preset.id)).toEqual(["horizontal-switch", "list-stagger"]);
  });

  it("keeps skeleton loading opacity-only and non-spring", () => {
    const document = applyAppMotionPreset(createDefaultDocument("modal"), "skeleton-loading");
    const element = primaryElement(document);

    expect(document.timeline.easing).toMatchObject({ type: "classic", preset: "standard" });
    expect(element.initial).toMatchObject({ x: 0, y: 0, scale: 1, opacity: 0, blur: 0 });
    expect(element.animate).toMatchObject({ x: 0, y: 0, scale: 1, opacity: 1, blur: 0 });
  });

  it("explains automatic fixes when skeleton loading conflicts with motion presets", () => {
    const container = applyAppMotionPreset(createDefaultDocument("modal"), "container-transform");
    const skeleton = applyAppMotionPreset(container, "skeleton-loading");

    expect(skeleton.appliedPresets.map((preset) => preset.id)).toEqual(["skeleton-loading"]);
    expect(skeleton.presetResolutions).toEqual([
      expect.objectContaining({ action: "adjusted", title: "已移除位移/回弹组合" })
    ]);

    const horizontal = applyAppMotionPreset(skeleton, "horizontal-switch");
    expect(horizontal.appliedPresets.map((preset) => preset.id)).toEqual(["horizontal-switch"]);
    expect(horizontal.presetResolutions).toEqual([
      expect.objectContaining({ action: "adjusted", title: "已退出骨架屏策略" })
    ]);
  });
});
