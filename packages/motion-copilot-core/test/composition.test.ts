import { describe, expect, it } from "vitest";
import { computeCompositionStepWindows, createClassicEasing, evaluateComposition, exportCompositionHtml, type CompositionStep } from "../src";

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
});
