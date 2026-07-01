// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultDocument } from "@motion-copilot/core";
import { clearGenerateDraftCache, generateDraftViaService } from "./generateDraftClient";

const document = createDefaultDocument("modal");

afterEach(() => {
  clearGenerateDraftCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubFetch(impl: typeof fetch) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function llmResponse(planSteps: unknown) {
  return new Response(JSON.stringify({ mode: "llm", message: "ok", plan: { steps: planSteps } }), { status: 200 });
}

describe("generateDraftViaService", () => {
  it("assembles llm steps when the service returns a valid plan", async () => {
    stubFetch(async () =>
      llmResponse([{ presetId: "modal-feedback", layerId: "modal-image", timing: "sequential", delayMs: 0, reason: "焦点" }])
    );
    const result = await generateDraftViaService({ prompt: "弹窗进场", document });
    expect(result.mode).toBe("llm");
    expect(result.draft.steps).toHaveLength(1);
    expect(result.draft.steps[0]?.layerId).toBe("modal-image");
  });

  it("falls back to local mock when the request fails", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    const result = await generateDraftViaService({ prompt: "加载成功", document });
    expect(result.mode).toBe("fallback");
    expect(result.draft.steps.length).toBeGreaterThan(0); // 本地 mock 仍产出片段
  });

  it("falls back when the service reports fallback mode", async () => {
    stubFetch(async () => new Response(JSON.stringify({ mode: "fallback", message: "no key" }), { status: 200 }));
    const result = await generateDraftViaService({ prompt: "切换 tab", document });
    expect(result.mode).toBe("fallback");
    expect(result.draft.steps.length).toBeGreaterThan(0);
  });

  it("falls back to local mock when an llm plan yields no new steps", async () => {
    stubFetch(async () => llmResponse([]));
    const result = await generateDraftViaService({ prompt: "弹窗", document });
    expect(result.mode).toBe("fallback");
  });

  it("caches the plan and only calls the service once for identical input", async () => {
    const fetchSpy = vi.fn(async () =>
      llmResponse([{ presetId: "enter-screen", layerId: "modal-title", timing: "sequential", delayMs: 0, reason: "x" }])
    );
    vi.stubGlobal("fetch", fetchSpy);
    await generateDraftViaService({ prompt: "进场", document });
    await generateDraftViaService({ prompt: "进场", document });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns local mock for an empty prompt without hitting the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await generateDraftViaService({ prompt: "   ", document });
    expect(result.mode).toBe("fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
