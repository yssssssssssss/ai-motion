import { describe, expect, it, vi } from "vitest";
import { createDefaultDocument } from "@motion-copilot/core";
import { createGenerateDraftHandler, generateCopilotDraft } from "./generateDraft";

const document = createDefaultDocument("modal");

function modelResponse(planSteps: unknown): Response {
  return new Response(JSON.stringify({ output_text: JSON.stringify({ steps: planSteps }) }), { status: 200 });
}

describe("generateCopilotDraft", () => {
  it("returns fallback without calling the model when no api key is set", async () => {
    const fetchImpl = vi.fn();
    const result = await generateCopilotDraft({ prompt: "弹窗进场", document }, { fetchImpl });
    expect(result.mode).toBe("fallback");
    expect(result.plan.steps).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns fallback for an empty prompt", async () => {
    const result = await generateCopilotDraft({ prompt: "   ", document }, { apiKey: "k" });
    expect(result.mode).toBe("fallback");
  });

  it("returns fallback for an invalid document", async () => {
    const result = await generateCopilotDraft({ prompt: "弹窗", document: { nope: true } }, { apiKey: "k" });
    expect(result.mode).toBe("fallback");
  });

  it("parses a valid model plan and reports llm mode", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        modelResponse([
          { presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "焦点" }
        ])
      );
    const result = await generateCopilotDraft({ prompt: "弹窗进场", document }, { apiKey: "test-key", fetchImpl });
    expect(result.mode).toBe("llm");
    expect(result.plan.steps).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // 安全边界:请求带 Authorization 头,且 schema 强制 strict json_schema
    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.text.format.name).toBe("motion_copilot_draft");
    expect(body.text.format.strict).toBe(true);
  });

  it("falls back when the model returns malformed content", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ output_text: "{not json" }), { status: 200 }));
    const result = await generateCopilotDraft({ prompt: "弹窗", document }, { apiKey: "k", fetchImpl });
    expect(result.mode).toBe("fallback");
  });

  it("falls back on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("err", { status: 500 }));
    const result = await generateCopilotDraft({ prompt: "弹窗", document }, { apiKey: "k", fetchImpl });
    expect(result.mode).toBe("fallback");
  });
});

describe("createGenerateDraftHandler", () => {
  it("rejects non-POST methods", async () => {
    const handler = createGenerateDraftHandler({ apiKey: "k" });
    const res = makeRes();
    await handler(makeReq("GET", ""), res);
    expect(res.statusCode).toBe(405);
  });

  it("returns a fallback payload for a POST without api key (key never leaks)", async () => {
    const handler = createGenerateDraftHandler({});
    const res = makeRes();
    await handler(makeReq("POST", JSON.stringify({ prompt: "弹窗", document })), res);
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.mode).toBe("fallback");
    expect(res.body).not.toContain("apiKey");
  });
});

type FakeRes = {
  statusCode: number;
  body: string;
  setHeader(): void;
  end(body: string): void;
};

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
