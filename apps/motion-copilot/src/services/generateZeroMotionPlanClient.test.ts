import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZeroLayerMorphSource } from "@motion-copilot/core";
import { generateZeroMotionPlanViaService } from "./generateZeroMotionPlanClient";

const source: ZeroLayerMorphSource = {
  kind: "zero-layer-morph",
  from: {
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: "from",
    nodeId: "from",
    name: "首帧",
    width: 120,
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
    width: 120,
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
        nodeId: "card",
        kind: "morph",
        source: "rule",
        timing: { delayMs: 0, durationMs: 240 },
        keyframes: [
          { offset: 0, x: 0, opacity: 0 },
          { offset: 1, x: 80, opacity: 1 }
        ]
      }
    ]
  }
};

const responseDraft = {
  candidates: [
    {
      intent: "spatial-morph",
      rationale: "上弧展开。",
      tracks: [
        {
          target: "morph",
          delayScale: 0.5,
          durationScale: 0.8,
          staggerMs: 0,
          curve: "spring",
          path: "arc-up",
          personality: { energy: 0.8, bounce: 0.6, sharpness: 0.5 }
        }
      ]
    }
  ]
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("generateZeroMotionPlanViaService", () => {
  it("assembles a distinct server draft locally", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ mode: "llm", message: "ok", draft: responseDraft }), { status: 200 })
      );
    const result = await generateZeroMotionPlanViaService({ prompt: "更有弹性", source });

    expect(result.mode).toBe("llm");
    expect(result.motionPlan.tracks[0]).toMatchObject({ source: "llm", path: { points: expect.any(Array) } });
  });

  it("keeps the fallback plan when the service is unavailable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await generateZeroMotionPlanViaService({ prompt: "更有弹性", source });

    expect(result.mode).toBe("fallback");
    expect(result.motionPlan.tracks[0]?.source).toBe("rule");
  });
});
