// Zero 图层动效草稿只在服务端生成，浏览器只接收受限的节奏候选，绝不接触模型密钥。
import {
  buildMotionPlanDraftPromptContext,
  motionPlanDraftSchema,
  parseMotionPlanDraftResponse,
  type MotionPlanDraftResponse,
  type ZeroLayerMorphSource
} from "@motion-copilot/core";
import { outputText, responseEndpointCandidates, type GenerateDraftOptions } from "./generateDraft";

type RequestLike = {
  method?: string | undefined;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
};

type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

type Input = { prompt?: unknown; source?: unknown };

export type GenerateZeroMotionPlanResult = {
  mode: "llm" | "fallback";
  message: string;
  draft: MotionPlanDraftResponse;
};

const EMPTY_DRAFT: MotionPlanDraftResponse = { candidates: [] };
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;

function isSource(value: unknown): value is ZeroLayerMorphSource {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "zero-layer-morph" &&
    Array.isArray((value as { from?: { layers?: unknown } }).from?.layers) &&
    Array.isArray((value as { to?: { layers?: unknown } }).to?.layers)
  );
}

function fallback(message: string): GenerateZeroMotionPlanResult {
  return { mode: "fallback", message, draft: EMPTY_DRAFT };
}

function readBody(req: RequestLike, maxBytes: number): Promise<string> {
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

function writeJson(res: ResponseLike, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

export async function generateZeroMotionPlan(
  rawInput: Input,
  options: GenerateDraftOptions = {}
): Promise<GenerateZeroMotionPlanResult> {
  const prompt = typeof rawInput.prompt === "string" ? rawInput.prompt.trim() : "";
  if (!prompt) return fallback("动效描述为空，已保留规则方案。");
  if (!isSource(rawInput.source)) return fallback("Zero 图层数据无效，已保留规则方案。");
  if (!options.apiKey) return fallback("未配置接口密钥，已保留规则方案。");

  const fetcher = options.fetchImpl ?? fetch;
  const requestBody = JSON.stringify({
    model: options.model ?? DEFAULT_MODEL,
    input: [
      { role: "system", content: buildMotionPlanDraftPromptContext(rawInput.source) },
      { role: "user", content: prompt }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "zero_motion_plan_draft",
        strict: true,
        schema: motionPlanDraftSchema
      }
    }
  });
  const timeoutMs = options.modelTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  let failureMessage = "模型未返回有效候选，已保留规则方案。";

  for (const endpoint of responseEndpointCandidates(options.apiBaseUrl)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal
      });
      if (!response.ok) {
        failureMessage = `模型接口返回 ${response.status}，已保留规则方案。`;
        continue;
      }
      const payload = (await response.json()) as unknown;
      const text = outputText(payload);
      const draft = text ? parseMotionPlanDraftResponse(text) : null;
      if (!draft) {
        failureMessage = "模型返回无效，已保留规则方案。";
        continue;
      }
      return { mode: "llm", message: "模型已生成动效节奏候选。", draft };
    } catch (error) {
      failureMessage =
        error instanceof Error && error.name === "AbortError"
          ? `模型请求超时(${Math.round(timeoutMs / 1000)}s)，已保留规则方案。`
          : "模型请求失败，已保留规则方案。";
    } finally {
      clearTimeout(timeout);
    }
  }
  return fallback(failureMessage);
}

export function createGenerateZeroMotionPlanHandler(options: GenerateDraftOptions = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  return async function generateZeroMotionPlanHandler(req: RequestLike, res: ResponseLike): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }
    try {
      const body = await readBody(req, maxBodyBytes);
      const result = await generateZeroMotionPlan(JSON.parse(body || "{}") as Input, options);
      writeJson(res, 200, result);
    } catch (error) {
      writeJson(res, 400, { error: error instanceof Error ? error.message : "生成失败。" });
    }
  };
}
