import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createVideoAnalyzeHandler, type CreateVideoAnalyzeHandlerInput } from "./videoAnalyzeRoute";

class MockRequest extends EventEmitter {
  method: string;

  constructor(
    method: string,
    private readonly chunks: string[]
  ) {
    super();
    this.method = method;
  }

  setEncoding() {
    return undefined;
  }

  destroy() {
    return this;
  }

  flush() {
    for (const chunk of this.chunks) this.emit("data", chunk);
    this.emit("end");
  }
}

class MockResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  end(value = "") {
    this.body = value;
  }
}

async function invoke(input: {
  method: string;
  body: string;
  maxBodyBytes?: number;
  timeoutMs?: number;
  analyze?: CreateVideoAnalyzeHandlerInput["analyze"];
}) {
  const req = new MockRequest(input.method, [input.body]);
  const res = new MockResponse();
  const handlerInput: CreateVideoAnalyzeHandlerInput = {
    analyze:
      input.analyze ??
      (async () => ({
        width: 64,
        height: 96,
        durationMs: 120,
        fps: 25,
        posterDataUrl: "data:image/png;base64,POSTER",
        frames: [{ id: "start", timestampMs: 0, dataUrl: "data:image/png;base64,POSTER" }],
        contactSheetDataUrl: "data:image/png;base64,SHEET",
        motionHints: {
          direction: "none",
          confidence: 0,
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0
        }
      }))
  };
  if (input.maxBodyBytes !== undefined) handlerInput.maxBodyBytes = input.maxBodyBytes;
  if (input.timeoutMs !== undefined) handlerInput.timeoutMs = input.timeoutMs;
  const handler = createVideoAnalyzeHandler(handlerInput);
  const handled = handler(req as never, res as never);
  req.flush();
  await handled;
  return res;
}

describe("videoAnalyzeRoute", () => {
  it("returns analyzed video metadata as json", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({ fileName: "demo.mp4", dataUrl: "data:video/mp4;base64,AAAA" })
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(res.body)).toMatchObject({ width: 64, posterDataUrl: "data:image/png;base64,POSTER" });
  });

  it("rejects invalid request bodies", async () => {
    const res = await invoke({ method: "POST", body: "{}" });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain("required");
  });

  it("rejects non-post methods", async () => {
    const res = await invoke({ method: "GET", body: "" });

    expect(res.statusCode).toBe(405);
  });

  it("rejects request bodies beyond the configured limit", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({ fileName: "demo.mp4", dataUrl: "data:video/mp4;base64,AAAA" }),
      maxBodyBytes: 8
    });

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body).error).toContain("too large");
  });

  it("returns a timeout when analysis exceeds the configured budget", async () => {
    const res = await invoke({
      method: "POST",
      body: JSON.stringify({ fileName: "demo.mp4", dataUrl: "data:video/mp4;base64,AAAA" }),
      timeoutMs: 1,
      analyze: () => new Promise(() => undefined)
    });

    expect(res.statusCode).toBe(504);
    expect(JSON.parse(res.body).error).toContain("timed out");
  });
});
