import { describe, expect, it } from "vitest";
import {
  computeCompositionStepWindows,
  createClassicEasing,
  createDefaultDocument,
  evaluateComposition,
  exportCompositionHtml,
  exportCompositionHandoffMarkdown,
  exportCompositionJson,
  isCompositionJsonExport,
  validateCompositionJsonExport,
  type CompositionStep
} from "../src";

function step(overrides: Partial<CompositionStep> & { id: string }): CompositionStep {
  return {
    presetId: "enter-screen",
    label: "进入屏幕",
    target: "target",
    timing: "sequential",
    delayMs: 0,
    durationMs: 240,
    slot: "trajectory",
    ...overrides
  };
}

describe("evaluateComposition", () => {
  it("returns empty track for no steps", () => {
    const track = evaluateComposition([]);
    expect(track.steps).toEqual([]);
    expect(track.issues).toEqual([]);
    expect(track.totalDurationMs).toBe(0);
  });

  it("computes total duration for sequential steps", () => {
    const track = evaluateComposition([
      step({ id: "a", durationMs: 200 }),
      step({ id: "b", durationMs: 150, slot: "scene", presetId: "navigation-push", label: "前后切换" })
    ]);
    expect(track.totalDurationMs).toBe(350);
    expect(track.issues).toEqual([]);
  });

  it("computes total duration for parallel steps", () => {
    const track = evaluateComposition([
      step({ id: "a", durationMs: 200 }),
      step({ id: "b", durationMs: 300, timing: "parallel", delayMs: 50, slot: "scene", presetId: "navigation-push", label: "前后切换" })
    ]);
    // parallel: b starts at a.start(0) + 50 = 50, ends at 350
    expect(track.totalDurationMs).toBe(350);
  });

  it("exposes step windows for preview playback", () => {
    const windows = computeCompositionStepWindows([
      step({ id: "a", durationMs: 200 }),
      step({ id: "b", durationMs: 300, timing: "parallel", delayMs: 50, slot: "scene", presetId: "navigation-push", label: "前后切换" })
    ]);

    expect(windows).toEqual([
      { stepId: "a", start: 0, end: 200 },
      { stepId: "b", start: 50, end: 350 }
    ]);
  });

  it("warns when total duration exceeds limit", () => {
    const track = evaluateComposition([
      step({ id: "a", durationMs: 800, slot: "trajectory" }),
      step({ id: "b", durationMs: 800, slot: "scene", presetId: "modal-feedback", label: "弹窗反馈" }),
      step({ id: "c", durationMs: 800, slot: "sequence", presetId: "list-stagger", label: "依次浮现" })
    ]);
    expect(track.totalDurationMs).toBe(2400);
    expect(track.issues.map((i) => i.id)).toContain("composition-too-long");
  });

  it("detects same-slot conflict on same target", () => {
    const track = evaluateComposition([
      step({ id: "a", presetId: "enter-screen", label: "进入屏幕", slot: "trajectory" }),
      step({ id: "b", presetId: "exit-final", label: "永久离开", slot: "trajectory" })
    ]);
    expect(track.issues.map((i) => i.id)).toContain("slot-conflict-b");
  });

  it("allows same slot on different targets", () => {
    const track = evaluateComposition([
      step({ id: "a", presetId: "enter-screen", label: "进入屏幕", slot: "trajectory", target: "target" }),
      step({ id: "b", presetId: "exit-final", label: "永久离开", slot: "trajectory", target: "selected-layer", layerId: "layer-1" })
    ]);
    const slotConflicts = track.issues.filter((i) => i.id.startsWith("slot-conflict"));
    expect(slotConflicts).toEqual([]);
  });

  it("warns about too-short step duration", () => {
    const track = evaluateComposition([
      step({ id: "a", durationMs: 40 })
    ]);
    expect(track.issues.map((i) => i.id)).toContain("step-too-short-a");
  });

  it("suggests about too-long step duration", () => {
    const track = evaluateComposition([
      step({ id: "a", durationMs: 900 })
    ]);
    expect(track.issues.map((i) => i.id)).toContain("step-too-long-a");
  });

  it("detects skeleton + motion conflict", () => {
    const track = evaluateComposition([
      step({ id: "a", presetId: "skeleton-loading", label: "骨架屏加载", slot: "visual", durationMs: 220 }),
      step({ id: "b", presetId: "navigation-push", label: "前后切换", slot: "scene", durationMs: 280 })
    ]);
    expect(track.issues.map((i) => i.id)).toContain("skeleton-motion-conflict-a");
  });

  it("exports step-specific motion overrides", () => {
    const track = evaluateComposition([
      step({
        id: "a",
        initial: { x: 10, y: 20, opacity: 0.2 },
        animate: { x: 30, y: 40, opacity: 0.8 },
        easing: createClassicEasing("sharp")
      })
    ]);
    const html = exportCompositionHtml(track);

    expect(html).toContain("translate(10px, 20px)");
    expect(html).toContain("translate(30px, 40px)");
    expect(html).toContain("opacity: 0.2");
    expect(html).toContain("opacity: 0.8");
    expect(html).toContain("cubic-bezier(0.25, 0.8, 0.35, 1)");
  });

  it("exports a stable composition json handoff with layer bindings and computed windows", () => {
    const document = createDefaultDocument("modal");
    const track = evaluateComposition([
      step({
        id: "title-in",
        target: "selected-layer",
        layerId: "modal-title",
        layerName: "标题",
        durationMs: 240
      }),
      step({
        id: "image-transform",
        presetId: "container-transform",
        label: "容器变化",
        slot: "scene",
        target: "selected-layer",
        layerId: "modal-image",
        layerName: "图片位",
        timing: "parallel",
        delayMs: 80,
        durationMs: 340,
        initial: { scale: 0.96, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        easing: createClassicEasing("standard")
      })
    ]);

    const json = exportCompositionJson(document, track);
    const payload = JSON.parse(json) as {
      schemaVersion: string;
      stage: { width: number; height: number };
      layers: Array<{ id: string; name: string }>;
      timeline: {
        totalDurationMs: number;
        lanes: Array<{ id: string; label: string; stepIds: string[] }>;
        steps: Array<{
          id: string;
          laneId: string;
          startMs: number;
          endMs: number;
          binding: { type: string; layerId?: string; layerName?: string };
          initial?: { scale?: number; opacity?: number };
        }>;
      };
    };

    expect(payload.schemaVersion).toBe("motion-copilot.composition.v1");
    expect(payload.stage).toMatchObject({ width: 430, height: 720 });
    expect(payload.layers.map((layer) => layer.id)).toContain("modal-title");
    expect(payload.timeline.totalDurationMs).toBe(420);
    expect(payload.timeline.lanes).toEqual([
      { id: "layer:modal-title", label: "标题", binding: { type: "layer", layerId: "modal-title", layerName: "标题" }, stepIds: ["title-in"] },
      { id: "layer:modal-image", label: "图片位", binding: { type: "layer", layerId: "modal-image", layerName: "图片位" }, stepIds: ["image-transform"] }
    ]);
    expect(payload.timeline.steps[0]).toMatchObject({
      id: "title-in",
      laneId: "layer:modal-title",
      startMs: 0,
      endMs: 240,
      binding: { type: "layer", layerId: "modal-title", layerName: "标题" }
    });
    expect(payload.timeline.steps[1]).toMatchObject({
      id: "image-transform",
      laneId: "layer:modal-image",
      startMs: 80,
      endMs: 420,
      initial: { scale: 0.96, opacity: 0 }
    });
    expect(json).not.toContain("目标对象");
    expect(json).not.toContain("主目标");
    expect(json).not.toContain("选中图层");
  });

  it("exports a developer-readable handoff markdown table", () => {
    const document = createDefaultDocument("modal");
    const track = evaluateComposition([
      step({
        id: "title-in",
        target: "selected-layer",
        layerId: "modal-title",
        layerName: "标题",
        durationMs: 240,
        initial: { x: 0, y: 24, opacity: 0 },
        animate: { x: 0, y: 0, opacity: 1 },
        easing: createClassicEasing("decelerate")
      }),
      step({
        id: "image-transform",
        presetId: "container-transform",
        label: "容器变化",
        slot: "scene",
        target: "selected-layer",
        layerId: "modal-image",
        layerName: "图片位",
        timing: "parallel",
        delayMs: 80,
        durationMs: 340,
        initial: { scale: 0.96, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        easing: createClassicEasing("standard")
      })
    ]);

    const markdown = exportCompositionHandoffMarkdown(document, track);

    expect(markdown).toContain("# Motion Copilot 编排参数表");
    expect(markdown).toContain("| 总时长 | 420ms |");
    expect(markdown).toContain("| 标题 | text |");
    expect(markdown).toContain("| 1 | 标题 | 进入屏幕 | enter-screen | trajectory | 串行 | 0ms | 240ms | 240ms | classic/decelerate");
    expect(markdown).toContain("| 2 | 图片位 | 容器变化 | container-transform | scene | 并行 | 80ms | 420ms | 340ms | classic/standard");
    expect(markdown).toContain("x:0px, y:24px, opacity:0");
    expect(markdown).not.toContain("目标对象");
    expect(markdown).not.toContain("主目标");
    expect(markdown).not.toContain("选中图层");
  });

  it("validates composition json exports at runtime", () => {
    const document = createDefaultDocument("modal");
    const track = evaluateComposition([
      step({
        id: "title-in",
        target: "selected-layer",
        layerId: "modal-title",
        layerName: "标题"
      })
    ]);
    const payload = JSON.parse(exportCompositionJson(document, track));

    expect(validateCompositionJsonExport(payload)).toEqual({ valid: true, issues: [] });
    expect(isCompositionJsonExport(payload)).toBe(true);

    const invalid = {
      ...payload,
      schemaVersion: "wrong",
      stage: { ...payload.stage, width: 0 },
      timeline: {
        ...payload.timeline,
        steps: [{ ...payload.timeline.steps[0], endMs: 10 }]
      }
    };

    const result = validateCompositionJsonExport(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.path)).toContain("$.schemaVersion");
    expect(result.issues.map((item) => item.path)).toContain("$.stage.width");
    expect(result.issues.map((item) => item.path)).toContain("$.timeline.steps[0]");
    expect(isCompositionJsonExport(invalid)).toBe(false);
  });
});
