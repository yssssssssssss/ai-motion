// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ZeroLayerMorphSource } from "@motion-copilot/core";
import { MotionPlanEditor } from "./MotionPlanEditor";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function source(): ZeroLayerMorphSource {
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
      layers: []
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
      layers: []
    },
    bindingResult: { bindings: [], enter: [], exit: [], unresolved: [] },
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
