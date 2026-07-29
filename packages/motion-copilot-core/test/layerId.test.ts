import { describe, expect, it } from "vitest";
import {
  compileZeroLayerMotionBindings,
  compileZeroLayerMotionComposition,
  layerIdForNode,
  layerIdFromNodeId
} from "../src";
import type { ZeroLayerNode, ZeroLayerSnapshot } from "../src";

function node(nodeId: string): ZeroLayerNode {
  return {
    nodeId,
    name: nodeId,
    kind: "frame",
    bounds: { x: 0, y: 0, w: 10, h: 10 },
    opacity: 1,
    visible: true
  };
}

describe("layerIdForNode / layerIdFromNodeId", () => {
  it("prefixes the slug with zero-layer-", () => {
    expect(layerIdFromNodeId("28:11")).toBe("zero-layer-28-11");
  });

  it("agrees whether given a node or a raw nodeId", () => {
    expect(layerIdForNode(node("28:11"))).toBe(layerIdFromNodeId("28:11"));
  });

  it("lowercases so casing never splits the same node", () => {
    expect(layerIdFromNodeId("Card")).toBe(layerIdFromNodeId("card"));
    expect(layerIdFromNodeId("Card")).toBe("zero-layer-card");
  });

  it("trims and drops leading/trailing separators", () => {
    expect(layerIdFromNodeId("  card  ")).toBe("zero-layer-card");
  });

  it("preserves CJK characters instead of collapsing them to dashes", () => {
    expect(layerIdFromNodeId("按钮 Button")).toBe("zero-layer-按钮-button");
  });

  it("falls back to node when the slug is empty", () => {
    expect(layerIdFromNodeId("   ")).toBe("zero-layer-node");
    expect(layerIdFromNodeId("!!!")).toBe("zero-layer-node");
  });

  it("is idempotent for an already-clean id", () => {
    expect(layerIdFromNodeId("card-node")).toBe("zero-layer-card-node");
  });
});

function snapshot(nodeId: string, layers: ZeroLayerNode[]): ZeroLayerSnapshot {
  return {
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: nodeId,
    nodeId,
    name: nodeId,
    width: 100,
    height: 100,
    screenshotUrl: "",
    assets: [],
    layers
  };
}

function box(nodeId: string, x: number): ZeroLayerNode {
  return {
    nodeId,
    name: nodeId,
    kind: "frame",
    bounds: { x, y: 0, w: 40, h: 40 },
    opacity: 1,
    visible: true
  };
}

describe("layerId is consistent across the compile pipeline", () => {
  it("binding.layerId and matched step share the authoritative slug for mixed-case node ids", () => {
    const from = snapshot("Frame-From", [box("Frame-From", 0), box("Card-A", 10)]);
    const to = snapshot("Frame-To", [box("Frame-To", 0), box("Card-A", 12)]);

    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const cardBinding = bindingResult.bindings.find((item) => item.nodeId === "Card-A");
    expect(cardBinding).toBeDefined();
    expect(cardBinding?.layerId).toBe(layerIdFromNodeId("Card-A"));

    const { steps } = compileZeroLayerMotionComposition({ from, to, bindingResult });
    const matchedStep = steps.find((step) => step.layerId === cardBinding?.layerId);
    expect(matchedStep).toBeDefined();
  });

  it("enter step layerId matches the authoritative slug so export lookup never misses", () => {
    const from = snapshot("Frame-From", [box("Frame-From", 0)]);
    const to = snapshot("Frame-To", [box("Frame-To", 0), box("New-Badge", 20)]);

    const bindingResult = compileZeroLayerMotionBindings(from, to);
    const enterNode = bindingResult.enter.find((node) => node.nodeId === "New-Badge");
    expect(enterNode).toBeDefined();

    const { steps } = compileZeroLayerMotionComposition({ from, to, bindingResult });
    const enterStep = steps.find((step) => step.layerId === layerIdForNode(enterNode!));
    expect(enterStep).toBeDefined();
  });
});
