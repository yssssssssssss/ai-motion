import { describe, expect, it } from "vitest";
import {
  compileZeroLayerMotionComposition,
  exportZeroLayerCompositionHtml,
  type ZeroLayerSnapshot
} from "../src";

function snapshot(frameId: string, x: number): ZeroLayerSnapshot {
  return {
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId,
    nodeId: frameId,
    name: frameId,
    width: 160,
    height: 40,
    screenshotUrl: "",
    assets: [],
    layers: [
      {
        nodeId: "box",
        name: "box",
        kind: "rect",
        bounds: { x, y: 0, w: 40, h: 40 },
        opacity: 1,
        visible: true,
        fills: [{ type: "solid", color: "#ffffff" }]
      }
    ]
  };
}

describe("exportZeroLayerCompositionHtml", () => {
  it("exports MotionPlan keyframes and keeps a reduced-motion tail-frame fallback", () => {
    const from = snapshot("from", 0);
    const to = snapshot("to", 100);
    const result = compileZeroLayerMotionComposition({
      from,
      to,
      bindingResult: {
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
      }
    });
    const source = result.document.visualSource;
    if (!source || source.kind !== "zero-layer-morph") throw new Error("Expected Zero layer source.");
    source.motionPlan = {
      ...source.motionPlan!,
      tracks: source.motionPlan!.tracks.map((track) => ({
        ...track,
        physics: { type: "spring", stiffness: 170, damping: 10 },
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 50, y: -20 },
            { x: 100, y: 0 }
          ]
        }
      }))
    };

    const html = exportZeroLayerCompositionHtml(result.document, result.document.composition!);

    expect(html).toContain("mc-zero-layer-plan-0-zero-layer-box");
    expect(html).toContain("translate(50px,-20px)");
    expect(html).toContain("mc-zero-layer-plan-source-tail");
    expect(html).toContain("prefers-reduced-motion");
  });
});
