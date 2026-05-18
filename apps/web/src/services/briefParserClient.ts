import { createFallbackBriefIntent, type BriefParseResult } from "@motion-tool/core";

export async function parseBrief(brief: string): Promise<BriefParseResult> {
  const trimmed = brief.trim();
  if (!trimmed) {
    return {
      mode: "fallback",
      intent: createFallbackBriefIntent(""),
      message: "Enter a brief to get AI recommendations."
    };
  }

  try {
    const response = await fetch("/api/brief/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: trimmed })
    });

    if (!response.ok) throw new Error(`Brief parser failed: ${response.status}`);
    return (await response.json()) as BriefParseResult;
  } catch {
    return {
      mode: "fallback",
      intent: createFallbackBriefIntent(trimmed),
      message: "Using local matching."
    };
  }
}
