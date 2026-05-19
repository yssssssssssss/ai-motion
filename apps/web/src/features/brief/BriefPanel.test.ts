import { describe, expect, it } from "vitest";
import { parsedChips } from "./BriefPanel";
import type { BriefParseResult } from "@motion-tool/core";

describe("parsedChips", () => {
  it("deduplicates parsed terms before rendering chips", () => {
    const result: BriefParseResult = {
      mode: "llm",
      message: "LLM parsed",
      intent: {
        query: "button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover", "button"],
        sources: ["workeasy"],
        keywords: ["button", "cta"],
        confidence: 0.9
      }
    };

    expect(parsedChips(result)).toEqual(["button", "hover", "workeasy", "cta"]);
  });
});
