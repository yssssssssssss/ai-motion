import { createServer, request } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import { createMotionLensAnalyzeHandler } from "./motionLensAnalyze";

it("keeps a slow model response alive without changing the JSON response contract", async () => {
  vi.useFakeTimers();
  let releaseModel!: (response: Response) => void;
  let modelStarted!: () => void;
  const started = new Promise<void>((resolve) => (modelStarted = resolve));
  const modelResponse = new Promise<Response>((resolve) => (releaseModel = resolve));
  const handler = createMotionLensAnalyzeHandler({
    apiKey: "test-key",
    fetchImpl: async () => {
      modelStarted();
      return modelResponse;
    }
  });
  const server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  let body = "";
  let contentType: string | undefined;
  const responseBody = new Promise<string>((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port: address.port, method: "POST", agent: false },
      (res) => {
        contentType = res.headers["content-type"];
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve(body));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end(
      JSON.stringify({
        source: { kind: "image", id: "slow", name: "slow.png", width: 1200, height: 800 },
        imageDataUrl: "data:image/png;base64,test"
      })
    );
  });

  try {
    await started;
    await vi.advanceTimersByTimeAsync(15_000);
    await delay(20);
    expect(body).toBe(" ");
    expect(contentType).toContain("application/json");
    releaseModel(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            candidates: [
              {
                id: "cta",
                kind: "button",
                label: "购买",
                text: "购买",
                bounds: { x: 10, y: 10, width: 100, height: 40 },
                confidence: 0.9,
                visualWeight: 0.5,
                interactiveLikelihood: 1,
                isDecorative: false
              }
            ],
            opportunities: []
          })
        })
      )
    );
    const result = JSON.parse(await responseBody);
    expect(result.mode).toBe("llm");
    expect(result.blueprint.elements).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    releaseModel(new Response(JSON.stringify({ output_text: '{"candidates":[],"opportunities":[]}' })));
    await responseBody;
    vi.useRealTimers();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
