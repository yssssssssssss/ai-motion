// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createClassicEasing,
  evaluateComposition,
  type CompositionStep,
  type MotionPlan,
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

function renderMotion(
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot,
  bindingResult: ZeroLayerMotionBindingResult
) {
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

function renderMotionWithPlan(
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot,
  bindingResult: ZeroLayerMotionBindingResult,
  progress: number,
  isPlaying = false,
  endOpacity = 0.5
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
        progress={progress}
        isPlaying={isPlaying}
        motionPlan={{
          schemaVersion: "motion-copilot.motion-plan.v1",
          stageDurationMs: 400,
          tracks: [
            {
              layerId: "zero-layer-box",
              nodeId: "box",
              kind: "morph",
              source: "user",
              timing: { delayMs: 0, durationMs: 400 },
              keyframes: [
                { offset: 0, x: 0, y: 0, width: 40, opacity: 1 },
                { offset: 1, x: 100, y: 0, width: 80, opacity: endOpacity }
              ]
            }
          ]
        }}
      />
    );
  });
}

function renderMotionWithCustomPlan(
  from: ZeroLayerSnapshot,
  to: ZeroLayerSnapshot,
  bindingResult: ZeroLayerMotionBindingResult,
  motionPlan: MotionPlan,
  steps: CompositionStep[],
  progress: number,
  overrides?: Array<{
    frame: "from" | "to" | "both";
    nodeId: string;
    x?: number;
    width?: number;
  }>
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
        motionPlan={motionPlan}
        compositionTrack={evaluateComposition(steps)}
        progress={progress}
        overrides={overrides}
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
      layers: [
        {
          ...from.layers[0]!,
          bounds: { x: 100, y: 0, w: 40, h: 40 },
          fills: [{ type: "solid", color: "#000000" }]
        }
      ]
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
    expect(Number.parseFloat(layer?.style.left ?? "0")).toBeCloseTo(32.481459, 5);
    expect(layer?.style.transform).toBe("");
    expect(layer?.querySelector<HTMLElement>('[data-zero-layer-skin="from"]')?.style.opacity).toBe("0.5");
    expect(layer?.querySelector<HTMLElement>('[data-zero-layer-skin="to"]')?.style.opacity).toBe("0.5");
  });

  it("prefers the persisted MotionPlan over the compatibility composition track", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 180,
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
      layers: [{ ...from.layers[0]!, bounds: { x: 100, y: 0, w: 80, h: 40 } }]
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

    renderMotionWithPlan(from, to, bindingResult, 0.5);

    const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="box"]');
    expect(layer?.style.left).toBe("50px");
    expect(layer?.style.width).toBe("60px");
    expect(layer?.style.opacity).toBe("0.75");
  });

  it("fills sparse MotionPlan geometry from the compatibility track without a tail jump", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 180,
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
      layers: [{ ...from.layers[0]!, bounds: { x: 100, y: 0, w: 80, h: 40 } }]
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
    const step: CompositionStep = {
      id: "box-step",
      presetId: "zero-layer-morph",
      label: "box",
      target: "selected-layer",
      layerId: "zero-layer-box",
      timing: "sequential",
      delayMs: 0,
      durationMs: 400,
      slot: "trajectory",
      initial: { x: 0, y: 0, width: 40, height: 40, opacity: 1 },
      animate: { x: 100, y: 0, width: 80, height: 40, opacity: 1 },
      fillMode: "both"
    };

    renderMotionWithCustomPlan(
      from,
      to,
      bindingResult,
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 400,
        tracks: [
          {
            layerId: "zero-layer-box",
            nodeId: "box",
            kind: "morph",
            source: "user",
            timing: { delayMs: 0, durationMs: 400 },
            keyframes: [
              { offset: 0, scale: 1, opacity: 1 },
              { offset: 1, scale: 1.2, opacity: 1 }
            ]
          }
        ]
      },
      [step],
      0.5,
      [
        { frame: "from", nodeId: "box", x: 10, width: 50 },
        { frame: "to", nodeId: "box", x: 130, width: 90 }
      ]
    );

    const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="box"]');
    expect(layer?.style.left).toBe("70px");
    expect(layer?.style.width).toBe("70px");
    expect(layer?.style.transform).toContain("scale(1.1)");
  });

  it("uses one global clock for planned and compatibility-fallback layers", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 200,
      height: 60,
      screenshotUrl: "",
      assets: [],
      layers: [
        {
          nodeId: "box",
          name: "box",
          kind: "rect",
          bounds: { x: 0, y: 0, w: 40, h: 20 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#ffffff" }]
        },
        {
          nodeId: "badge",
          name: "badge",
          kind: "rect",
          bounds: { x: 0, y: 30, w: 20, h: 20 },
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
      layers: [
        { ...from.layers[0]!, bounds: { x: 100, y: 0, w: 40, h: 20 } },
        { ...from.layers[1]!, bounds: { x: 80, y: 30, w: 20, h: 20 } }
      ]
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
        },
        {
          layerId: "zero-layer-badge",
          nodeId: "badge",
          toNodeId: "badge",
          fromBounds: from.layers[1]!.bounds,
          toBounds: to.layers[1]!.bounds,
          confidence: 100,
          reasons: ["same-node"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    };
    const steps: CompositionStep[] = [
      {
        id: "box-step",
        presetId: "zero-layer-morph",
        label: "box",
        target: "selected-layer",
        layerId: "zero-layer-box",
        timing: "sequential",
        delayMs: 0,
        durationMs: 100,
        slot: "trajectory",
        initial: { x: 0, y: 0, width: 40, height: 20, opacity: 1 },
        animate: { x: 100, y: 0, width: 40, height: 20, opacity: 1 },
        fillMode: "both"
      },
      {
        id: "badge-step",
        presetId: "zero-layer-morph",
        label: "badge",
        target: "selected-layer",
        layerId: "zero-layer-badge",
        timing: "sequential",
        delayMs: 100,
        durationMs: 200,
        slot: "trajectory",
        initial: { x: 0, y: 0, width: 20, height: 20, opacity: 1 },
        animate: { x: 80, y: 0, width: 20, height: 20, opacity: 1 },
        fillMode: "both"
      }
    ];

    renderMotionWithCustomPlan(
      from,
      to,
      bindingResult,
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 100,
        tracks: [
          {
            layerId: "zero-layer-box",
            nodeId: "box",
            kind: "morph",
            source: "user",
            timing: { delayMs: 0, durationMs: 100 },
            keyframes: [
              { offset: 0, x: 0, y: 0, width: 40, height: 20 },
              { offset: 1, x: 100, y: 0, width: 40, height: 20 }
            ]
          }
        ]
      },
      steps,
      0.5
    );

    expect(document.querySelector<HTMLElement>('[data-zero-layer-id="box"]')?.style.left).toBe("100px");
    expect(document.querySelector<HTMLElement>('[data-zero-layer-id="badge"]')?.style.left).toBe("0px");
  });

  it("uses expression stops for a matched layer missing from a partial MotionPlan", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 200,
      height: 60,
      screenshotUrl: "",
      assets: [],
      layers: [
        {
          nodeId: "box",
          name: "box",
          kind: "rect",
          bounds: { x: 0, y: 0, w: 40, h: 20 },
          opacity: 1,
          visible: true,
          fills: [{ type: "solid", color: "#ffffff" }]
        },
        {
          nodeId: "badge",
          name: "badge",
          kind: "rect",
          bounds: { x: 0, y: 30, w: 20, h: 20 },
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
      layers: [
        { ...from.layers[0]!, bounds: { x: 100, y: 0, w: 40, h: 20 } },
        { ...from.layers[1]!, bounds: { x: 80, y: 30, w: 20, h: 20 } }
      ]
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
        },
        {
          layerId: "zero-layer-badge",
          nodeId: "badge",
          toNodeId: "badge",
          fromBounds: from.layers[1]!.bounds,
          toBounds: to.layers[1]!.bounds,
          confidence: 100,
          reasons: ["same-node"]
        }
      ],
      enter: [],
      exit: [],
      unresolved: []
    };
    const steps: CompositionStep[] = [
      {
        id: "box-step",
        presetId: "zero-layer-morph",
        label: "box",
        target: "selected-layer",
        layerId: "zero-layer-box",
        timing: "parallel",
        delayMs: 0,
        durationMs: 400,
        slot: "trajectory",
        initial: { x: 0, y: 0, width: 40, height: 20, opacity: 1 },
        animate: { x: 100, y: 0, width: 40, height: 20, opacity: 1 },
        fillMode: "both"
      },
      {
        id: "badge-step",
        presetId: "zero-layer-morph",
        label: "badge",
        target: "selected-layer",
        layerId: "zero-layer-badge",
        timing: "parallel",
        delayMs: 0,
        durationMs: 400,
        slot: "trajectory",
        initial: { x: 0, y: 0, width: 20, height: 20, opacity: 1 },
        animate: { x: 80, y: 0, width: 20, height: 20, opacity: 1 },
        easing: createClassicEasing("standard"),
        fillMode: "both",
        metadata: { zeroLayerExpressionStrategy: "delayed-follow" }
      }
    ];

    renderMotionWithCustomPlan(
      from,
      to,
      bindingResult,
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 400,
        tracks: [
          {
            layerId: "zero-layer-box",
            nodeId: "box",
            kind: "morph",
            source: "user",
            timing: { delayMs: 0, durationMs: 400 },
            keyframes: [
              { offset: 0, x: 0, y: 0, width: 40, height: 20 },
              { offset: 1, x: 100, y: 0, width: 40, height: 20 }
            ]
          }
        ]
      },
      steps,
      0.4,
      [
        { frame: "from", nodeId: "badge", x: 10 },
        { frame: "to", nodeId: "badge", x: 130 }
      ]
    );

    expect(document.querySelector<HTMLElement>('[data-zero-layer-id="box"]')?.style.left).toBe("40px");
    expect(document.querySelector<HTMLElement>('[data-zero-layer-id="badge"]')?.style.left).toBe("10px");
  });

  it("uses the sampled MotionPlan during playback without applying a second WAAPI transform", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 180,
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
      layers: [{ ...from.layers[0]!, bounds: { x: 100, y: 0, w: 80, h: 40 } }]
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
    const originalAnimate = Element.prototype.animate;
    const animate = vi.fn<
      (frames: Keyframe[], options: KeyframeAnimationOptions) => { currentTime: number; cancel: () => void }
    >(() => ({ currentTime: 0, cancel: vi.fn() }));
    Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });

    try {
      renderMotionWithPlan(from, to, bindingResult, 0.5, true);
      const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="box"]');
      expect(layer?.style.left).toBe("50px");
      expect(layer?.style.transform).toBe("");
      expect(animate).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      Object.defineProperty(Element.prototype, "animate", { configurable: true, value: originalAnimate });
    }
  });

  it("crossfades from local track time and keeps shape interpolation on one moving wrapper", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 180,
      height: 40,
      screenshotUrl: "",
      assets: [],
      layers: [
        {
          nodeId: "box",
          name: "label",
          kind: "ellipse",
          bounds: { x: 0, y: 0, w: 40, h: 40 },
          opacity: 0.4,
          visible: true,
          rotation: 0,
          cornerRadius: 4,
          text: "Start",
          fills: [{ type: "solid", color: "#ff0000" }]
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
          kind: "rect",
          bounds: { x: 100, y: 0, w: 80, h: 40 },
          opacity: 0.8,
          rotation: 20,
          cornerRadius: 12,
          text: "Tail",
          fills: [{ type: "solid", color: "#0000ff" }]
        }
      ]
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

    renderMotionWithCustomPlan(
      from,
      to,
      bindingResult,
      {
        schemaVersion: "motion-copilot.motion-plan.v1",
        stageDurationMs: 400,
        tracks: [
          {
            layerId: "zero-layer-box",
            nodeId: "box",
            kind: "morph",
            source: "user",
            timing: { delayMs: 200, durationMs: 200 },
            keyframes: [
              { offset: 0, x: 0, width: 40, opacity: 1 },
              { offset: 1, x: 100, width: 80, opacity: 0.5 }
            ]
          }
        ]
      },
      [],
      0.75
    );

    const layer = document.querySelector<HTMLElement>('[data-zero-layer-id="box"]');
    const fromSkin = layer?.querySelector<HTMLElement>('[data-zero-layer-skin="from"]');
    const toSkin = layer?.querySelector<HTMLElement>('[data-zero-layer-skin="to"]');
    expect(layer?.textContent).toBe("StartTail");
    expect(layer?.style.left).toBe("50px");
    expect(layer?.style.width).toBe("60px");
    expect(layer?.style.opacity).toBe("0.75");
    expect(fromSkin?.textContent).toBe("Start");
    expect(toSkin?.textContent).toBe("Tail");
    expect(fromSkin?.style.background).toBe("#ff0000");
    expect(toSkin?.style.background).toBe("#0000ff");
    expect(Number.parseFloat(fromSkin?.style.opacity ?? "0")).toBeCloseTo(0.2, 4);
    expect(Number.parseFloat(toSkin?.style.opacity ?? "0")).toBeCloseTo(0.4, 4);
    expect(Number.parseFloat(layer?.style.transform.match(/rotate\(([-\d.]+)/)?.[1] ?? "0")).toBeCloseTo(
      10,
      4
    );
    expect(layer?.style.borderRadius).toBe("calc(25% + 6px)");
  });

  it("uses the tail asset for a matched image before final progress", () => {
    const from: ZeroLayerSnapshot = {
      schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
      frameId: "from",
      nodeId: "from",
      name: "首帧",
      width: 180,
      height: 40,
      screenshotUrl: "",
      assets: [{ id: "from-image", type: "png", url: "data:image/png;base64,FROM" }],
      layers: [
        {
          nodeId: "box",
          name: "image",
          kind: "image",
          bounds: { x: 0, y: 0, w: 40, h: 40 },
          opacity: 1,
          visible: true,
          renderMode: "image",
          assetId: "from-image"
        }
      ]
    };
    const to: ZeroLayerSnapshot = {
      ...from,
      frameId: "to",
      nodeId: "to",
      name: "尾帧",
      assets: [{ id: "to-image", type: "png", url: "data:image/png;base64,TO" }],
      layers: [
        {
          ...from.layers[0]!,
          bounds: { x: 100, y: 0, w: 80, h: 40 },
          assetId: "to-image"
        }
      ]
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

    renderMotionWithPlan(from, to, bindingResult, 0.999);

    expect(
      document.querySelector<HTMLImageElement>('[data-zero-layer-id="box"] img')?.getAttribute("src")
    ).toBe("data:image/png;base64,TO");
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
