import { describe, expect, it } from "vitest";
import { parseBriefWithOpenAI, parseOpenAIIntentResponse } from "./briefParser";

describe("briefParser", () => {
  it("extracts intent JSON from an OpenAI Responses payload", () => {
    const intent = parseOpenAIIntentResponse({
      output_text: JSON.stringify({
        query: "hover button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover"],
        sources: ["workeasy"],
        keywords: ["cta"],
        confidence: 0.88
      })
    });

    expect(intent?.componentKinds).toEqual(["button"]);
    expect(intent?.sources).toEqual(["workeasy"]);
  });

  it("returns fallback result when api key is missing", async () => {
    const result = await parseBriefWithOpenAI({ brief: "WorkEasy hover button" });

    expect(result.mode).toBe("fallback");
    expect(result.intent.componentKinds).toContain("button");
    expect(result.intent.sources).toContain("workeasy");
  });
});
