import { describe, expect, it } from "vitest";
import { parseBriefWithOpenAI, parseOpenAIIntentResponse, responseEndpointCandidates } from "./briefParser";

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

  it("builds response endpoints from custom API base URLs", () => {
    expect(responseEndpointCandidates("https://otokapi.com")).toEqual([
      "https://otokapi.com/responses",
      "https://otokapi.com/v1/responses"
    ]);
    expect(responseEndpointCandidates("https://otokapi.com/v1")).toEqual(["https://otokapi.com/v1/responses"]);
  });

  it("retries the v1 endpoint when the configured base URL fails", async () => {
    const endpoints: string[] = [];
    const parsedIntent = {
      query: "hover button",
      categories: ["interaction"],
      componentKinds: ["button"],
      motionStyles: ["hover"],
      sources: ["workeasy"],
      keywords: [],
      confidence: 0.9
    };
    const fetchImpl: typeof fetch = async (url) => {
      endpoints.push(String(url));
      if (endpoints.length === 1) return new Response(null, { status: 404 });

      return new Response(JSON.stringify({ output_text: JSON.stringify(parsedIntent) }), { status: 200 });
    };

    const result = await parseBriefWithOpenAI({
      brief: "WorkEasy hover button",
      apiKey: "test-key",
      apiBaseUrl: "https://otokapi.com",
      fetchImpl
    });

    expect(result.mode).toBe("llm");
    expect(endpoints).toEqual(["https://otokapi.com/responses", "https://otokapi.com/v1/responses"]);
  });
});
