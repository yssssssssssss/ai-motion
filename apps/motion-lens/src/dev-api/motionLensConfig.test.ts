import { describe, expect, it } from "vitest";
import { createMotionLensModelConfig } from "./motionLensConfig";

describe("MotionLens model config API", () => {
  it("exposes non-sensitive model configuration", () => {
    const config = createMotionLensModelConfig({
      apiKey: "secret-key",
      apiBaseUrl: "https://modelservice.jdcloud.com/v1/responses",
      model: "GPT-5.5",
      modelTimeoutMs: 120_000
    });

    expect(config).toEqual({
      endpoint: "https://modelservice.jdcloud.com/v1/responses",
      model: "GPT-5.5",
      hasApiKey: true,
      mode: "llm-ready",
      timeoutMs: 120_000
    });
    expect(JSON.stringify(config)).not.toContain("secret-key");
  });

  it("shows fallback-only mode when API key is missing", () => {
    expect(createMotionLensModelConfig({ apiBaseUrl: "https://example.com" })).toMatchObject({
      endpoint: "https://example.com/responses",
      model: "gpt-5.5",
      hasApiKey: false,
      mode: "fallback-only",
      timeoutMs: 90_000
    });
  });
});
