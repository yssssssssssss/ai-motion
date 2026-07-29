import { describe, expect, it, vi } from "vitest";
import type { ZeroLayerMorphSource } from "@motion-copilot/core";
import { createGenerateZeroMotionPlanHandler, generateZeroMotionPlan } from "./generateZeroMotionPlan";

const source: ZeroLayerMorphSource = {
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

const draft = {
  candidates: [
    {
      intent: "spatial-morph",
      rationale: "卡片上弧展开。",
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

describe("generateZeroMotionPlan", () => {
  it("uses a strict schema and returns only rhythm candidates", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 })
      );
    const result = await generateZeroMotionPlan(
      { prompt: "卡片轻快弹出", source },
      { apiKey: "k", fetchImpl }
    );

    expect(result.mode).toBe("llm");
    expect(result.draft.candidates).toHaveLength(1);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const body = JSON.parse(init.body as string);
    expect(body.text.format.name).toBe("zero_motion_plan_draft");
    expect(body.text.format.strict).toBe(true);
    expect(
      body.text.format.schema.properties.candidates.items.properties.tracks.items.properties
    ).not.toHaveProperty("nodeId");
  });

  it("falls back without a key or on invalid model output", async () => {
    expect((await generateZeroMotionPlan({ prompt: "卡片", source })).mode).toBe("fallback");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({ candidates: [{ ...draft.candidates[0], nodeId: "forbidden" }] })
        }),
        {
          status: 200
        }
      )
    );
    expect((await generateZeroMotionPlan({ prompt: "卡片", source }, { apiKey: "k", fetchImpl })).mode).toBe(
      "fallback"
    );
  });
});

describe("createGenerateZeroMotionPlanHandler", () => {
  it("rejects non-POST requests and never serializes a key", async () => {
    const handler = createGenerateZeroMotionPlanHandler({ apiKey: "hidden" });
    const res = makeRes();
    await handler(makeReq("GET", ""), res);
    expect(res.statusCode).toBe(405);

    const post = makeRes();
    await createGenerateZeroMotionPlanHandler({})(
      makeReq("POST", JSON.stringify({ prompt: "卡片", source })),
      post
    );
    expect(post.statusCode).toBe(200);
    expect(post.body).not.toContain("hidden");
  });
});

type FakeRes = { statusCode: number; body: string; setHeader(): void; end(body: string): void };

function makeRes(): FakeRes {
  return {
    statusCode: 0,
    body: "",
    setHeader() {},
    end(body: string) {
      this.body = body;
    }
  };
}

function makeReq(method: string, body: string) {
  return {
    method,
    setEncoding() {},
    on(event: "data" | "end" | "error", listener: (chunk: never) => void) {
      if (event === "data" && body) (listener as (chunk: string) => void)(body);
      if (event === "end") (listener as () => void)();
    },
    destroy() {}
  };
}
