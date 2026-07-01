// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  createClassicEasing,
  evaluateComposition,
  type CompositionStep,
  type ZeroLayerMotionBindingResult,
  type ZeroLayerSnapshot
} from "@motion-copilot/core";
import { ZeroLayerMotionStage, ZeroLayerStage } from "./ZeroLayerStage";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function render(snapshot: ZeroLayerSnapshot, selectedNodeId?: string) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<ZeroLayerStage snapshot={snapshot} frame="from" selectedNodeId={selectedNodeId} />);
  });
}

function renderMotion(from: ZeroLayerSnapshot, to: ZeroLayerSnapshot, bindingResult: ZeroLayerMotionBindingResult) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(<ZeroLayerMotionStage from={from} to={to} bindingResult={bindingResult} progress={0} />);
  });
}

function renderMotionWithTrack(
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot,
  bindingResult: ZeroLayerMotionBindingResult,
  steps: CompositionStep[],
  progress: number
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ZeroLayerMotionStage
        from={from}
        to={to}
        bindingResult={bindingResult}
        compositionTrack={evaluateComposition(steps)}
        progress={progress}
      />
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("ZeroLayerStage", () => {
  it("renders layer effects collected from Zero native layers", () => {
    render({
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "28:19",
      nodeId: "28:19",
      name: "信息收起状态",
      width: 120,
      height: 40,
      screenshotUrl: "data:image/png;base64,FROM",
      assets: [],
      layers: [
        {
          nodeId: "28:19",
          name: "信息收起状态",
          kind: "group",
          bounds: { x: 0, y: 0, w: 120, h: 40 },
          opacity: 1,
          visible: true
        },
        {
          nodeId: "shadow-card",
          parentId: "28:19",
          name: "阴影背景",
          kind: "vector",
          bounds: { x: 0, y: 0, w: 120, h: 40 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#ffffff" }],
          effects: [{ type: "drop-shadow", css: "box-shadow:0px 0px 5px 0px rgba(0,0,0,0.25)" }]
        }
      ]
    });

    const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="shadow-card"]');
    expect(layer?.style.boxShadow).toBe("0px 0px 5px 0px rgba(0,0,0,0.25)");
  });

  it("does not paint editor selection outlines into the Zero layer visual preview", () => {
    render(
      {
        schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
        frameId: "33:36",
        nodeId: "33:36",
        name: "首帧",
        width: 120,
        height: 40,
        screenshotUrl: "",
        assets: [],
        layers: [
          {
            nodeId: "33:36",
            name: "首帧",
            kind: "group",
            bounds: { x: 0, y: 0, w: 120, h: 40 },
            opacity: 1,
            visible: true
          }
        ]
      },
      "33:36"
    );

    const selected = document.querySelector<HTMLElement>('[data-zero-layer-id="33:36"]');
    expect(selected?.style.outline).toBe("");
  });

  it("keeps exiting parent containers behind matched child layers", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "33:36",
      nodeId: "33:36",
      name: "首帧",
      width: 220,
      height: 44,
      screenshotUrl: "",
      assets: [],
      layers: [
        {
          nodeId: "33:36",
          name: "首帧",
          kind: "group",
          bounds: { x: 0, y: 0, w: 220, h: 44 },
          opacity: 1,
          visible: true
        },
        {
          nodeId: "33:24",
          parentId: "33:36",
          name: "Tabs 标签页- 初始状态",
          kind: "frame",
          bounds: { x: 0, y: 0, w: 220, h: 44 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#ffffff" }]
        },
        {
          nodeId: "33:27",
          parentId: "33:24",
          name: "text",
          kind: "text",
          bounds: { x: 24, y: 11, w: 70, h: 22 },
          opacity: 1,
          visible: true,
          text: "业务流程图",
          fills: [{ type: "solid", color: "#11141a" }]
        }
      ]
    };
    const to: ZeroLayerSnapshot = {
      ...from,
      frameId: "33:35",
      nodeId: "33:35",
      name: "尾帧",
      height: 140,
      layers: [
        { ...from.layers[0]!, nodeId: "33:35", name: "尾帧", bounds: { x: 0, y: 0, w: 220, h: 140 } },
        { ...from.layers[2]!, nodeId: "33:16", parentId: "33:35" }
      ]
    };
    const bindingResult: ZeroLayerMotionBindingResult = {
      bindings: [
        {
          layerId: "zero-layer-33-36",
          nodeId: "33:36",
          toNodeId: "33:35",
          fromBounds: from.layers[0]!.bounds,
          toBounds: to.layers[0]!.bounds,
          confidence: 100,
          reasons: ["root-frame"]
        },
        {
          layerId: "zero-layer-33-27",
          nodeId: "33:27",
          toNodeId: "33:16",
          fromBounds: from.layers[2]!.bounds,
          toBounds: to.layers[1]!.bounds,
          confidence: 94,
          reasons: ["same-text"]
        }
      ],
      enter: [],
      exit: [from.layers[1]!],
      unresolved: []
    };

    renderMotion(from, to, bindingResult);

    const parent = document.querySelector<HTMLElement>('[data-zero-layer-id="33:24"]');
    const text = document.querySelector<HTMLElement>('[data-zero-layer-id="33:27"]');
    expect(Number(parent?.style.zIndex)).toBeLessThan(Number(text?.style.zIndex));
  });

  it("samples Zero layer motion from the composition track instead of linear global progress", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 160,
      height: 40,
      screenshotUrl: "",
      assets: [],
      layers: [
        {
          nodeId: "box",
          name: "box",
          kind: "rect",
          bounds: { x: 0, y: 0, w: 40, h: 40 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#ffffff" }]
        }
      ]
    };
    const to: ZeroLayerSnapshot = {
      ...from,
      frameId: "to",
      nodeId: "to",
      name: "尾帧",
      layers: [{ ...from.layers[0]!, bounds: { x: 100, y: 0, w: 40, h: 40 } }]
    };
    const bindingResult: ZeroLayerMotionBindingResult = {
      bindings: [
        {
          layerId: "zero-layer-box",
          nodeId: "box",
          toNodeId: "box",
          fromBounds: from.layers[0]!.bounds,
          toBounds: to.layers[0]!.bounds,
          confidence: 100,
          reasons: ["same-node"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    };

    renderMotionWithTrack(
      from,
      to,
      bindingResult,
      [
        {
          id: "step-box",
          presetId: "zero-layer-morph",
          label: "加速位移",
          target: "selected-layer",
          layerId: "zero-layer-box",
          timing: "sequential",
          delayMs: 0,
          durationMs: 1000,
          slot: "trajectory",
          initial: { x: 0, y: 0, width: 40, height: 40, scale: 1, opacity: 1 },
          animate: { x: 100, y: 0, width: 40, height: 40, scale: 1, opacity: 1 },
          easing: createClassicEasing("accelerate"),
          fillMode: "both"
        }
      ],
      0.5
    );

    const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="box"]');
    expect(layer?.style.left).toBe("25px");
    expect(layer?.style.transform).toBe("");
  });

  it("renders the exact Zero tail frame at the final progress even when a recipe uses scale", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 160,
      height: 40,
      screenshotUrl: "",
      assets: [],
      layers: [
        {
          nodeId: "box-from",
          name: "box",
          kind: "rect",
          bounds: { x: 0, y: 0, w: 40, h: 40 },
          opacity: 1,
          visible: true,
          cornerRadius: 4,
          fills: [{ type: "solid", color: "#ffffff" }]
        }
      ]
    };
    const to: ZeroLayerSnapshot = {
      ...from,
      frameId: "to",
      nodeId: "to",
      name: "尾帧",
      layers: [
        {
          ...from.layers[0]!,
          nodeId: "box-to",
          bounds: { x: 100, y: 0, w: 60, h: 40 },
          cornerRadius: 12
        }
      ]
    };
    const bindingResult: ZeroLayerMotionBindingResult = {
      bindings: [
        {
          layerId: "zero-layer-box",
          nodeId: "box-from",
          toNodeId: "box-to",
          fromBounds: from.layers[0]!.bounds,
          toBounds: to.layers[0]!.bounds,
          confidence: 100,
          reasons: ["same-node"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    };

    renderMotionWithTrack(
      from,
      to,
      bindingResult,
      [
        {
          id: "step-box",
          presetId: "zero-layer-morph",
          label: "弹性主容器",
          target: "selected-layer",
          layerId: "zero-layer-box",
          timing: "sequential",
          delayMs: 0,
          durationMs: 420,
          slot: "trajectory",
          initial: { x: 0, y: 0, width: 40, height: 40, scale: 0.96, opacity: 1 },
          animate: { x: 100, y: 0, width: 60, height: 40, scale: 1, opacity: 1 },
          easing: createClassicEasing("decelerate"),
          fillMode: "both"
        }
      ],
      1
    );

    const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="box-to"]');
    expect(layer?.style.left).toBe("100px");
    expect(layer?.style.width).toBe("60px");
    expect(layer?.style.borderRadius).toBe("12px");
    expect(layer?.style.transform).toBe("");
  });
});
