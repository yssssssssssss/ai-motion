import {
  createFallbackBriefIntent,
  isParsedBriefIntent,
  type BriefParseResult,
  type ParsedBriefIntent
} from "@motion-tool/core";

type ParseBriefInput = {
  brief: string;
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  fetchImpl?: typeof fetch;
};

const DEFAULT_API_BASE_URL = "https://api.openai.com/v1";

const intentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string" },
    categories: { type: "array", items: { type: "string" } },
    componentKinds: { type: "array", items: { type: "string" } },
    motionStyles: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    confidence: { type: "number" }
  },
  required: ["query", "categories", "componentKinds", "motionStyles", "sources", "keywords", "confidence"]
};

function fallback(brief: string, message: string): BriefParseResult {
  return {
    mode: "fallback",
    intent: createFallbackBriefIntent(brief),
    message
  };
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as { output_text?: unknown; output?: unknown };
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return null;

  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function responseEndpointCandidates(apiBaseUrl?: string): string[] {
  const base = trimTrailingSlash(apiBaseUrl?.trim() || DEFAULT_API_BASE_URL);
  const candidates = [base];

  if (!base.endsWith("/v1")) {
    candidates.push(`${base}/v1`);
  }

  return [...new Set(candidates)].map((candidate) => `${candidate}/responses`);
}

export function parseOpenAIIntentResponse(payload: unknown): ParsedBriefIntent | null {
  const text = outputText(payload);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    return isParsedBriefIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function parseBriefWithOpenAI(input: ParseBriefInput): Promise<BriefParseResult> {
  const brief = input.brief.trim();
  if (!brief) return fallback("", "Empty brief; using browse feed.");
  if (!input.apiKey) return fallback(brief, "OPENAI_API_KEY is not configured; using local matching.");

  const fetcher = input.fetchImpl ?? fetch;
  const requestBody = JSON.stringify({
    model: input.model ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content:
          "Extract motion component discovery intent as JSON. Do not choose a final component. Do not generate code."
      },
      {
        role: "user",
        content: brief
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "brief_intent",
        strict: true,
        schema: intentSchema
      }
    }
  });
  let failureMessage = "LLM parse failed; using local matching.";

  for (const endpoint of responseEndpointCandidates(input.apiBaseUrl)) {
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json"
        },
        body: requestBody
      });

      if (!response.ok) {
        failureMessage = `LLM parse failed with HTTP ${response.status}; using local matching.`;
        continue;
      }

      const payload = (await response.json()) as unknown;
      const intent = parseOpenAIIntentResponse(payload);
      if (!intent) {
        failureMessage = "LLM response was invalid; using local matching.";
        continue;
      }

      return {
        mode: "llm",
        intent,
        message: "LLM parsed"
      };
    } catch {
      failureMessage = "LLM parse request failed; using local matching.";
    }
  }

  return fallback(brief, failureMessage);
}
