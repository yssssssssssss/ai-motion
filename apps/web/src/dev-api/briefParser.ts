// 仅在 vite dev server 中通过 ssrLoadModule 加载并执行（见 vite.config.ts 的 briefParserApiPlugin）。
// 生产构建（vite build）不会包含本文件，因此前端 services/briefParserClient 必须有降级逻辑。
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
    semanticQuery: { type: "string" },
    categories: { type: "array", items: { type: "string" } },
    componentKinds: { type: "array", items: { type: "string" } },
    motionStyles: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    softPreferences: { type: "array", items: { type: "string" } },
    hardConstraints: { type: "array", items: { type: "string" } },
    negativePreferences: { type: "array", items: { type: "string" } },
    reasoningHints: { type: "array", items: { type: "string" } },
    confidence: { type: "number" }
  },
  required: [
    "query",
    "semanticQuery",
    "categories",
    "componentKinds",
    "motionStyles",
    "sources",
    "keywords",
    "softPreferences",
    "hardConstraints",
    "negativePreferences",
    "reasoningHints",
    "confidence"
  ]
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
  if (!brief) return fallback("", "需求为空，已展示组件库。");
  if (!input.apiKey) return fallback(brief, "未配置接口密钥，已使用本地匹配。");

  const fetcher = input.fetchImpl ?? fetch;
  const requestBody = JSON.stringify({
    model: input.model ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content:
          "Extract motion component discovery intent as JSON for semantic component search. Keep structured arrays short, but preserve flexible natural-language needs in semanticQuery and softPreferences. Capture color, motion, function, scene, source, and negative preferences when present. Do not choose a final component. Do not generate code."
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
  let failureMessage = "模型解析失败，已使用本地匹配。";

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
        failureMessage = `模型解析接口返回 ${response.status}，已使用本地匹配。`;
        continue;
      }

      const payload = (await response.json()) as unknown;
      const intent = parseOpenAIIntentResponse(payload);
      if (!intent) {
        failureMessage = "模型返回无效，已使用本地匹配。";
        continue;
      }

      return {
        mode: "llm",
        intent,
        message: "模型解析完成。"
      };
    } catch {
      failureMessage = "模型请求失败，已使用本地匹配。";
    }
  }

  return fallback(brief, failureMessage);
}
