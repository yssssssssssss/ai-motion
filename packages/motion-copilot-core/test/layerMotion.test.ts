import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyDocumentPatch,
  createDefaultDocument,
  exportHtmlCss,
  layerMotionOffset,
  type MotionLayerMotion
} from "../src";

function motion(patch: Partial<MotionLayerMotion> = {}): MotionLayerMotion {
  return { preset: "lift", durationMs: 220, delayMs: 0, ...patch };
}

describe("layer movement", () => {
  it("clears an explicit undefined direction and uses the preset default offset", () => {
    const document = createDefaultDocument("modal");
    const layer = document.layers.find((item) => item.id === "modal-title")!;
    layer.motion = motion({ direction: "up" });

    const patched = applyDocumentPatch(document, {
      layer: {
        id: layer.id,
        // @ts-expect-error The direction select sends undefined to restore the preset default.
        motion: { direction: undefined }
      }
    });
    const patchedMotion = patched.layers.find((item) => item.id === layer.id)!.motion;

    expect(patchedMotion).not.toHaveProperty("direction");
    expect(layerMotionOffset(patchedMotion)).toEqual({ x: 0, y: 18 });
  });

  it("keeps the existing direction when the patch omits it", () => {
    const document = createDefaultDocument("modal");
    const layer = document.layers.find((item) => item.id === "modal-title")!;
    layer.motion = motion({ direction: "up" });

    const patched = applyDocumentPatch(document, {
      layer: { id: layer.id, motion: { durationMs: 320 } }
    });
    const patchedMotion = patched.layers.find((item) => item.id === layer.id)!.motion;

    expect(patchedMotion?.durationMs).toBe(320);
    expect(patchedMotion?.direction).toBe("up");
    expect(layerMotionOffset(patchedMotion)).toEqual({ x: 0, y: -18 });
  });

  it.each([
    ["up", 0, -42],
    ["down", 0, 42],
    ["left", -42, 0],
    ["right", 42, 0]
  ] as const)("exports the same %s start offset as the preview", (direction, x, y) => {
    const document = createDefaultDocument("modal");
    const layer = document.layers.find((item) => item.id === "modal-title")!;
    layer.motion = motion({ direction, distance: 42 });
    expect(layerMotionOffset(layer.motion)).toEqual({ x, y });
    const { html } = exportHtmlCss(document);
    expect(html).toContain(`--mc-layer-x-from:${x}px`);
    expect(html).toContain(`--mc-layer-y-from:${y}px`);
  });

  it.each([
    ["lift", 0, 18],
    ["slide-left", -28, 0],
    ["slide-right", 28, 0]
  ] as const)("keeps the original %s keyframe offsets when fields are absent", (preset, x, y) => {
    expect(layerMotionOffset(motion({ preset }))).toEqual({ x, y });
    const previewCss = readFileSync(
      new URL("../../../apps/motion-copilot/src/styles.css", import.meta.url),
      "utf8"
    );
    const exportCss = exportHtmlCss(createDefaultDocument("modal")).css;
    for (const css of [previewCss, exportCss]) {
      const keyframes = css.slice(css.indexOf(`@keyframes mc-free-${preset}`));
      expect(keyframes).toContain(
        `translate(var(--mc-layer-x-from, ${x}px), var(--mc-layer-y-from, ${y}px))`
      );
      expect(keyframes).toContain("translate(0, 0)");
    }
  });

  it.each([Infinity, NaN, "40px);color:red", -5, 1e10])("sanitizes distance %s before CSS", (distance) => {
    const document = createDefaultDocument("modal");
    const layer = document.layers.find((item) => item.id === "modal-title")!;
    layer.motion = motion({ distance: distance as number });
    const expected = distance === -5 ? 0 : distance === 1e10 ? 2400 : 18;
    expect(layerMotionOffset(layer.motion)).toEqual({ x: 0, y: expected });
    expect(exportHtmlCss(document).html).toContain(`--mc-layer-y-from:${expected}px`);
  });

  it.each(["none", "fade", "zoom"] as const)("has no translation for %s", (preset) => {
    expect(layerMotionOffset(motion({ preset, distance: 50, direction: "left" }))).toBeUndefined();
  });
});
