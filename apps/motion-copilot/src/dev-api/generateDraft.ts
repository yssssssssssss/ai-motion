// 仅在 motion-copilot 的 Vite dev/preview/生产 server 中加载执行。
// 浏览器端永远不会拿到 OPENAI_API_KEY:所有模型调用都经由本 server 代理。
import {
  buildDraftPromptContext,
  draftPlanSchema,
  parseLLMDraftPlan,
  type LLMDraftPlan,
  type MotionDocument
} from "@motion-copilot/core";

type GenerateDraftRequest = {
  method?: string | undefined;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
};

type GenerateDraftHttpResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

type GenerateDraftInput = {
  prompt?: unknown;
  document?: unknown;
};

export type GenerateDraftOptions = {
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  modelTimeoutMs?: number | undefined;
  fetchImpl?: typeof fetch;
  maxBodyBytes?: number;
};

export type GenerateDraftResult = {
  mode: "llm" | "fallback";
  message: string;
  plan: LLMDraftPlan;
};

const DEFAULT_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_MODEL_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const EMPTY_PLAN: LLMDraftPlan = { steps: [] };

function readBody(req: GenerateDraftRequest, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function writeJson(res: GenerateDraftHttpResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function responseEndpointCandidates(apiBaseUrl?: string): string[] {
  const base = trimTrailingSlash(apiBaseUrl?.trim() || DEFAULT_API_BASE_URL);
  if (base.endsWith("/responses")) return [base];

  const candidates = [base];
  if (!base.endsWith("/v1")) {
    candidates.push(`${base}/v1`);
  }

  return [...new Set(candidates)].map((candidate) => `${candidate}/responses`);
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

function isMotionDocument(value: unknown): value is MotionDocument {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as { layers?: unknown }).layers);
}

function fallback(message: string): GenerateDraftResult {
  return { mode: "fallback", message, plan: EMPTY_PLAN };
}

export async function generateCopilotDraft(
  rawInput: GenerateDraftInput,
  options: GenerateDraftOptions = {}
): Promise<GenerateDraftResult> {
  const prompt = typeof rawInput.prompt === "string" ? rawInput.prompt.trim() : "";
  if (!prompt) return fallback("动效描述为空,已使用本地匹配。");
  if (!isMotionDocument(rawInput.document)) return fallback("文档结构无效,已使用本地匹配。");
  if (!options.apiKey) return fallback("未配置接口密钥,已使用本地匹配。");

  const document = rawInput.document;
  const fetcher = options.fetchImpl ?? fetch;
  const requestBody = JSON.stringify({
    model: options.model ?? DEFAULT_MODEL,
    input: [
      { role: "system", content: buildDraftPromptContext(document) },
      { role: "user", content: prompt }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "motion_copilot_draft",
        strict: true,
        schema: draftPlanSchema
      }
    }
  });

  const timeoutMs = options.modelTimeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  let failureMessage = "模型未返回有效内容,已使用本地匹配。";

  for (const endpoint of responseEndpointCandidates(options.apiBaseUrl)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: requestBody,
        signal: controller.signal
      });

      if (!response.ok) {
        failureMessage = `模型接口返回 ${response.status},已使用本地匹配。`;
        continue;
      }

      const payload = (await response.json()) as unknown;
      const text = outputText(payload);
      const plan = text ? parseLLMDraftPlan(text) : null;
      if (!plan) {
        failureMessage = "模型返回无效,已使用本地匹配。";
        continue;
      }

      return { mode: "llm", plan, message: "模型已生成编排草稿。" };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        failureMessage = `模型请求超时(${Math.round(timeoutMs / 1000)}s),已使用本地匹配。`;
      } else {
        failureMessage = "模型请求失败,已使用本地匹配。";
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return fallback(failureMessage);
}

export function createGenerateDraftHandler(options: GenerateDraftOptions = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async function generateDraftHandler(
    req: GenerateDraftRequest,
    res: GenerateDraftHttpResponse
  ): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as GenerateDraftInput;
      const result = await generateCopilotDraft(parsed, options);
      writeJson(res, 200, result);
    } catch (error) {
      writeJson(res, 400, {
        error: error instanceof Error ? error.message : "生成失败。"
      });
    }
  };
}
