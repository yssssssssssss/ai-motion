import { describe, expect, it } from "vitest";
import { parsedChips } from "./BriefPanel";
import type { BriefParseResult } from "@motion-tool/core";

describe("parsedChips", () => {
  it("deduplicates and localizes parsed terms before rendering chips", () => {
    const result: BriefParseResult = {
      mode: "llm",
      message: "LLM parsed",
      intent: {
        query: "button",
        semanticQuery: "workeasy hover cta button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover", "button"],
        sources: ["workeasy"],
        keywords: ["button", "cta"],
        softPreferences: ["紫色", "cta"],
        hardConstraints: [],
        negativePreferences: [],
        reasoningHints: [],
        confidence: 0.9
      }
    };

    expect(parsedChips(result)).toEqual(["按钮", "悬停", "工作易", "转化入口", "紫色"]);
  });
});
