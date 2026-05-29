import { describe, expect, it } from "vitest";
import type { MotionManifest } from "../src/manifest/types";
import { compilePlusPatch, derivePlusControls } from "../src/orchestrator/plusControls";

const manifest: MotionManifest = {
  version: "1.0",
  id: "sample-motion",
  name: "Sample Motion",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "transitionDuration",
      label: "转场速度",
      type: "duration",
      default: 620,
      constraints: { min: 220, max: 1400, step: 20, unit: "ms" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
    },
    {
      id: "easing",
      label: "缓动曲线",
      type: "easing",
      default: "ease-out",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    },
    {
      id: "dimOpacity",
      label: "压暗强度",
      type: "range",
      default: 0.72,
      constraints: { min: 0, max: 0.9, step: 0.01 },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--dim-opacity" }]
    },
    {
      id: "popupWidth",
      label: "弹层宽度",
      type: "range",
      default: 874,
      constraints: { min: 640, max: 980, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--popup-width" }]
    }
  ],
  groups: [{ id: "timing", label: "速度", params: ["transitionDuration", "easing"] }]
};

describe("derivePlusControls", () => {
  it("derives only high-confidence controls from confirmed params", () => {
    const controls = derivePlusControls(manifest);

    expect(controls.map((control) => control.id)).toEqual(["speed", "easing", "intensity"]);
    expect(controls.find((control) => control.id === "speed")?.mappedParamIds).toEqual(["transitionDuration"]);
    expect(controls.find((control) => control.id === "easing")?.mappedParamIds).toEqual(["easing"]);
    expect(controls.find((control) => control.id === "intensity")?.mappedParamIds).toEqual(["dimOpacity"]);
  });

  it("does not expose controls for read-only or unrelated manifests", () => {
    const controls = derivePlusControls({ ...manifest, params: [] });
    expect(controls).toEqual([]);
  });

  it("does not classify trajectory distance as first-phase intensity", () => {
    const controls = derivePlusControls({
      ...manifest,
      params: [
        {
          id: "slideDistance",
          label: "滑动距离",
          type: "range",
          default: 1118,
          constraints: { min: 0, max: 1400, step: 1, unit: "px" },
          status: "confirmed",
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--slide-distance" }]
        }
      ]
    });

    expect(controls).toEqual([]);
  });
});

describe("compilePlusPatch", () => {
  it("compiles plus selections into bounded MotionPatch values", () => {
    const result = compilePlusPatch({
      manifest,
      plusValues: {
        speed: { option: "fast", amount: 100 },
        easing: { option: "soft", amount: 50 },
        intensity: { option: "expressive", amount: 100 }
      },
      baseValues: { popupWidth: 900 }
    });

    expect(result.values.transitionDuration).toBeGreaterThanOrEqual(220);
    expect(result.values.transitionDuration).toBeLessThan(620);
    expect(result.values.easing).toBe("ease-in-out");
    expect(result.values.dimOpacity).toBe(0.9);
    expect(result.values.popupWidth).toBe(900);
    expect(result.affectedParamIds).toEqual(["transitionDuration", "easing", "dimOpacity"]);
  });

  it("compiles from manifest defaults instead of repeatedly multiplying existing plus output", () => {
    const first = compilePlusPatch({
      manifest,
      plusValues: { speed: { option: "fast", amount: 50 } },
      baseValues: {}
    });
    const second = compilePlusPatch({
      manifest,
      plusValues: { speed: { option: "fast", amount: 50 } },
      baseValues: first.values
    });

    expect(second.values.transitionDuration).toBe(first.values.transitionDuration);
  });

  it("keeps select easing values inside declared options", () => {
    const selectManifest: MotionManifest = {
      ...manifest,
      params: [
        {
          id: "easing",
          label: "缓动曲线",
          type: "select",
          default: "ease-out",
          constraints: {
            options: [
              { label: "Ease out", value: "ease-out" },
              { label: "Spring", value: "spring" }
            ]
          },
          status: "confirmed",
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
        }
      ]
    };

    const result = compilePlusPatch({
      manifest: selectManifest,
      plusValues: { easing: { option: "soft", amount: 50 } }
    });

    expect(result.values.easing).toBe("ease-out");
  });
});
