// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileMotionPlanCss,
  createDefaultDocument,
  evaluateComposition,
  exportZeroLayerCompositionHtml,
  sampleMotionPlan,
  type ZeroLayerMorphSource
} from "@motion-copilot/core";
import { MotionPlanEditor } from "./MotionPlanEditor";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function source(): ZeroLayerMorphSource {
  const node = {
    nodeId: "card-node",
    name: "卡片",
    kind: "rect" as const,
    bounds: { x: 0, y: 0, w: 40, h: 40 },
    opacity: 1,
    visible: true
  };
  return {
    kind: "zero-layer-morph",
    from: {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 100,
      height: 40,
      screenshotUrl: "",
      assets: [],
      layers: [node]
    },
    to: {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "to",
      nodeId: "to",
      name: "尾帧",
      width: 100,
      height: 40,
      screenshotUrl: "",
      assets: [],
      layers: [{ ...node, bounds: { ...node.bounds, x: 40 } }]
    },
    bindingResult: {
      bindings: [
        {
          layerId: "card",
          nodeId: "card-node",
          toNodeId: "card-node",
          fromBounds: node.bounds,
          toBounds: { ...node.bounds, x: 40 },
          confidence: 100,
          reasons: ["same-node"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    },
    motionPlan: {
      schemaVersion: "motion-copilot.motion-plan.v1",
      stageDurationMs: 300,
      tracks: [
        {
          layerId: "card",
          nodeId: "card-node",
          kind: "morph",
          source: "rule",
          timing: { delayMs: 0, durationMs: 200 },
          keyframes: [
            { offset: 0, x: 0, opacity: 0 },
            { offset: 1, x: 40, opacity: 1 }
          ]
        },
        {
          layerId: "label",
          nodeId: "label-node",
          kind: "enter",
          source: "rule",
          timing: { delayMs: 80, durationMs: 120 },
          keyframes: [
            { offset: 0, opacity: 0 },
            { offset: 1, opacity: 1 }
          ]
        }
      ]
    }
  };
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("MotionPlanEditor", () => {
  it.each([
    ["spring", "energy", "1", { type: "spring", stiffness: 300, damping: 22 }],
    ["spring", "bounce", "1", { type: "spring", stiffness: 210, damping: 12 }],
    ["ease", "sharpness", "1", { type: "ease", curve: [0.18, 0.86, 0.22, 1] }]
  ] as const)("applies %s %s only on user input and changes runtime output", (type, key, value, expected) => {
    const saved = source();
    saved.motionPlan!.tracks[0]!.source = "user";
    saved.motionPlan!.tracks[0]!.physics =
      type === "spring"
        ? { type: "spring", stiffness: 173, damping: 19 }
        : { type: "ease", curve: [0.35, 0, 0.25, 1] };
    saved.motionPlan!.tracks[0]!.keyframes[0]!.easing = [0, 0, 1, 1];
    const original = structuredClone(saved);
    let updated: ZeroLayerMorphSource | undefined;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<MotionPlanEditor source={saved} onChange={(next) => (updated = next)} />));
    expect(updated).toBeUndefined();
    expect(saved).toEqual(original);
    for (const name of ["energy", "bounce", "sharpness"]) {
      const slider = host.querySelector<HTMLInputElement>(`[aria-label="动效${name}"]`)!;
      expect(slider.disabled).toBe(type === "spring" ? name === "sharpness" : name !== "sharpness");
      if (slider.disabled) expect(slider.closest("label")?.textContent).toContain("仅适用于");
    }
    const slider = host.querySelector<HTMLInputElement>(`[aria-label="动效${key}"]`)!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, value);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(updated?.motionPlan?.tracks[0]?.physics).toEqual(expected);
    expect(compileMotionPlanCss(updated?.motionPlan)).not.toBe(compileMotionPlanCss(original.motionPlan));
    expect(sampleMotionPlan(updated?.motionPlan, 50)[0]?.state.x).not.toBe(
      sampleMotionPlan(original.motionPlan, 50)[0]?.state.x
    );
    const standalone = (visualSource: ZeroLayerMorphSource) =>
      exportZeroLayerCompositionHtml(
        { ...createDefaultDocument("modal"), visualSource },
        evaluateComposition([])
      );
    const originalFrames = standalone(original).match(
      /@keyframes mc-zero-layer-plan-0-card\{[\s\S]*?\n}/
    )?.[0];
    const editedHtml = standalone(updated!);
    expect(originalFrames).toBeDefined();
    expect(editedHtml).toContain('data-zero-layer-id="card-node"');
    expect(editedHtml.match(/@keyframes mc-zero-layer-plan-0-card\{[\s\S]*?\n}/)?.[0]).not.toBe(
      originalFrames
    );
  });
  it("persists a selected track edit without changing other tracks", () => {
    let updated: ZeroLayerMorphSource | undefined;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <MotionPlanEditor
          source={source()}
          selectedNodeId="card-node"
          onChange={(value) => (updated = value)}
        />
      );
    });
    const input = document.querySelector<HTMLInputElement>('[aria-label="动效延迟 ms"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    act(() => {
      setter?.call(input, "40");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(updated?.motionPlan?.tracks.find((track) => track.layerId === "card")).toMatchObject({
      source: "user",
      timing: { delayMs: 40, durationMs: 200 }
    });
    expect(updated?.motionPlan?.tracks.find((track) => track.layerId === "label")).toMatchObject({
      source: "rule",
      timing: { delayMs: 80, durationMs: 120 }
    });
  });
});
