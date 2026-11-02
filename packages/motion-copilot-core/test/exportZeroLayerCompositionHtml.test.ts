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
    assets: [{ id: `${frameId}-asset`, type: "png", url: `data:image/png;base64,${frameId}` }],
    layers: [
      {
        nodeId: "box",
        name: "box",
        kind: "image",
        bounds: { x, y: 0, w: 40, h: 40 },
        opacity: 1,
        visible: true,
        renderMode: "image",
        assetId: `${frameId}-asset`
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
    expect(html).toMatch(/25%\{transform:translate\([^,]+px,-[\d.]+px\)/);
    expect(html).toContain("100%{transform:translate(100px,0px)");
    expect(html).toContain('data-zero-layer-skin="from"');
    expect(html).toContain('data-zero-layer-skin="to"');
    expect(html).toContain("[data-zero-layer-skin] > img");
    expect(html).toContain('src="data:image/png;base64,to"');
    expect(html).not.toContain("49.999%");
    expect(html).toContain("40%{opacity:1;}");
    expect(html).toContain("60%{opacity:0;}");
    expect(html).toContain("60%{opacity:1;}");
    expect(html).toContain("data-zero-tail-fallback");
    expect(html).toContain("prefers-reduced-motion");
  });

  it("falls back per layer when a persisted MotionPlan is only partially covered", () => {
    const from = snapshot("from", 0);
    const to = snapshot("to", 100);
    from.layers.push({
      ...from.layers[0]!,
      nodeId: "badge",
      name: "badge",
      bounds: { x: 0, y: 20, w: 20, h: 20 }
    });
    to.layers.push({
      ...to.layers[0]!,
      nodeId: "badge",
      name: "badge",
      bounds: { x: 80, y: 20, w: 20, h: 20 }
    });
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
      }
    });
    const source = result.document.visualSource;
    if (!source || source.kind !== "zero-layer-morph" || !source.motionPlan) {
      throw new Error("Expected MotionPlan source.");
    }
    source.motionPlan = {
      ...source.motionPlan,
      tracks: source.motionPlan.tracks.filter((track) => track.layerId === "zero-layer-box")
    };
    source.nodeOverrides = [
      { frame: "from", nodeId: "badge", x: 10, width: 24 },
      { frame: "to", nodeId: "badge", x: 130, width: 32 }
    ];
    const composition = result.document.composition!;
    composition.steps[0] = {
      ...composition.steps[0]!,
      timing: "sequential",
      delayMs: 80,
      durationMs: 200
    };
    composition.steps[1] = {
      ...composition.steps[1]!,
      timing: "sequential",
      delayMs: 30,
      durationMs: 180
    };

    const html = exportZeroLayerCompositionHtml(result.document, composition);

    expect(html).toContain("mc-zero-layer-plan-0-zero-layer-box");
    expect(html).toContain("mc-zero-layer-match-1-badge-badge");
    const badgeFrames = html.match(/@keyframes mc-zero-layer-match-1-badge-badge\{([\s\S]*?)\n\}/)?.[1];
    expect(badgeFrames).toContain("100%{transform:translate(120px,0px)");
    expect(badgeFrames).toContain("width:32px");
    expect(html).toContain('data-zero-tail-fallback=""');
    expect(html).toContain("mc-zero-layer-skin-from-1-badge");
    expect(html).toContain("calc(310ms - var(--mc-zero-layer-time, 0ms))");
    expect(html).toContain("calc(310ms - var(--mc-zero-layer-time,0ms))");
    expect(html).toContain('data-total-duration="490"');
  });

  it("exports linear matched and visibility fallbacks when both plan tracks and steps are missing", () => {
    const from = snapshot("from", 0);
    const to = snapshot("to", 100);
    const badgeFrom = {
      ...from.layers[0]!,
      nodeId: "badge",
      name: "badge",
      bounds: { x: 0, y: 20, w: 20, h: 20 }
    };
    const badgeTo = {
      ...to.layers[0]!,
      nodeId: "badge",
      name: "badge",
      bounds: { x: 80, y: 20, w: 20, h: 20 }
    };
    const exiting = {
      ...from.layers[0]!,
      nodeId: "old-label",
      name: "old-label",
      bounds: { x: 20, y: 0, w: 20, h: 20 }
    };
    const entering = {
      ...to.layers[0]!,
      nodeId: "new-label",
      name: "new-label",
      bounds: { x: 120, y: 0, w: 20, h: 20 }
    };
    from.layers.push(badgeFrom, exiting);
    to.layers.push(badgeTo, entering);
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
          },
          {
            layerId: "zero-layer-badge",
            nodeId: "badge",
            toNodeId: "badge",
            fromBounds: badgeFrom.bounds,
            toBounds: badgeTo.bounds,
            confidence: 100,
            reasons: ["same-node"]
          }
        ],
        enter: [entering],
        exit: [exiting],
        unresolved: []
      }
    });
    const source = result.document.visualSource;
    if (!source || source.kind !== "zero-layer-morph" || !source.motionPlan) {
      throw new Error("Expected MotionPlan source.");
    }
    source.motionPlan = {
      ...source.motionPlan,
      tracks: source.motionPlan.tracks.filter((track) => track.layerId === "zero-layer-box")
    };
    const composition = result.document.composition!;
    composition.steps = composition.steps.filter((step) => step.layerId === "zero-layer-box");

    const html = exportZeroLayerCompositionHtml(result.document, composition);

    expect(html).toContain("mc-zero-layer-plan-0-zero-layer-box");
    expect(html).toContain("@keyframes mc-zero-layer-match-1-badge-badge");
    expect(html).toContain("100%{transform:translate(80px,0px)");
    expect(html).toContain("mc-zero-layer-skin-from-1-badge");
    expect(html).toContain("mc-zero-layer-skin-to-1-badge");
    expect(html).toContain("@keyframes mc-zero-layer-enter-0-new-label");
    expect(html).toContain("@keyframes mc-zero-layer-exit-0-old-label");
    expect(html).toMatch(/mc-zero-layer-enter-0-new-label[^;]+;[^}]*opacity:0/);
    expect(html).toMatch(/mc-zero-layer-exit-0-old-label[^;]+;[^}]*opacity:1/);
  });

  it("drops malformed persisted tracks and exports the complete legacy motion path", () => {
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
    if (!source || source.kind !== "zero-layer-morph" || !source.motionPlan) {
      throw new Error("Expected MotionPlan source.");
    }
    source.motionPlan = {
      ...source.motionPlan,
      stageDurationMs: 999,
      tracks: source.motionPlan.tracks.map((track) => ({ ...track, keyframes: [] }))
    };

    const html = exportZeroLayerCompositionHtml(result.document, result.document.composition!);

    expect(html).not.toContain("mc-zero-layer-plan-0-zero-layer-box");
    expect(html).toContain("mc-zero-layer-match-0-box-box");
    expect(html).toContain("mc-zero-layer-skin-from-0-box");
    expect(html).toContain('data-total-duration="360"');
  });

  it("keeps base rotation and opacity on skins in the legacy fallback path", () => {
    const from = snapshot("from", 0);
    const to = snapshot("to", 100);
    from.layers[0]!.rotation = 10;
    to.layers[0]!.rotation = 20;
    const badge = {
      nodeId: "badge",
      name: "badge",
      kind: "rect" as const,
      bounds: { x: 120, y: 10, w: 24, h: 20 },
      opacity: 0.4,
      visible: true,
      rotation: 15,
      fills: [{ type: "solid" as const, color: "#ff0000" }]
    };
    to.layers.push(badge);
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
        enter: [badge],
        exit: [],
        unresolved: []
      }
    });
    const source = result.document.visualSource;
    if (!source || source.kind !== "zero-layer-morph") throw new Error("Expected Zero layer source.");
    delete source.motionPlan;

    const html = exportZeroLayerCompositionHtml(result.document, result.document.composition!);
    const matchedFrames = html.match(/@keyframes mc-zero-layer-match-0-box-box\{([\s\S]*?)\n\}/)?.[1];
    const fromSkinFrames = html.match(/@keyframes mc-zero-layer-skin-from-0-box\{([\s\S]*?)\n\}/)?.[1];

    expect(matchedFrames).toContain("rotate(0deg)");
    expect(matchedFrames).not.toContain("rotate(10deg)");
    expect(fromSkinFrames).toContain("rotate(10deg)");
    expect(html).toMatch(
      /data-zero-layer-id="badge"[^>]*data-zero-motion-layer-id="zero-layer-badge"[^>]*style="[^"]*opacity:1/
    );
    expect(html).toMatch(/data-zero-layer-skin="single"[^>]*style="[^"]*opacity:0\.4/);
  });
});
