import { describe, expect, it } from "vitest";
import { mergeRecompiledSteps, type CompositionStep } from "../src";

function step(id: string, layerId: string, durationMs = 320): CompositionStep {
  return {
    id,
    layerId,
    presetId: "zero-visual-morph",
    label: "高保真形变",
    target: "selected-layer",
    timing: "parallel",
    delayMs: 0,
    durationMs,
    slot: "trajectory"
  };
}

describe("mergeRecompiledSteps", () => {
  it("keeps every user-editable value and selection identity when compiler indices change", () => {
    const edited: CompositionStep = {
      ...step("zero-visual-match-2-text", "text", 765),
      label: "我的片段",
      timing: "sequential",
      delayMs: 123,
      initial: { x: 17, opacity: 0.2 },
      animate: { x: 99, opacity: 0.8 },
      easing: { type: "classic", preset: "standard", css: "cubic-bezier(0.4, 0, 0.2, 1)" },
      fillMode: "forwards",
      metadata: { zeroLayerTransformOrigin: "top left" }
    };
    const fresh = { ...step("zero-visual-match-0-text", "text"), initial: { x: 0 }, animate: { x: 50 } };
    const before = structuredClone(edited);
    expect(mergeRecompiledSteps([edited], [fresh])).toEqual([before]);
    expect(edited).toEqual(before);
    expect(fresh.durationMs).toBe(320);
  });

  it("adds new steps, removes missing steps, and preserves the user's order", () => {
    const a = step("edited-a", "a", 555);
    const b = step("edited-b", "b", 666);
    const added = step("new", "new");
    expect(
      mergeRecompiledSteps(
        [b, step("removed", "removed"), a],
        [step("fresh-a", "a"), added, step("fresh-b", "b")]
      )
    ).toEqual([b, a, added]);
  });

  it("matches duplicate identities once each in encounter order", () => {
    const first = step("first", "same", 111);
    const second = step("second", "same", 222);
    const third = step("third", "same", 333);
    expect(
      mergeRecompiledSteps([first, second], [step("fresh-1", "same"), step("fresh-2", "same"), third])
    ).toEqual([first, second, third]);
    expect(mergeRecompiledSteps([first, second], [step("only", "same")])).toEqual([first]);
  });

  it("does not match different presets and keeps absent optional overrides absent", () => {
    const existing = step("old", "text");
    expect(mergeRecompiledSteps([existing], [{ ...step("fresh", "text"), initial: { x: 20 } }])).toEqual([
      existing
    ]);
    const different = { ...step("other", "text"), presetId: "enter-screen" };
    expect(mergeRecompiledSteps([existing], [different])).toEqual([different]);
    expect(mergeRecompiledSteps([existing], [])).toEqual([]);
  });
});
