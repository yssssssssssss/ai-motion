import { responseEndpointCandidates } from "./generateDraft";

type GenerateConfigRequest = {
  method?: string | undefined;
};

type GenerateConfigResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

export type CopilotModelConfig = {
  endpoint: string;
  model: string;
  hasApiKey: boolean;
  mode: "llm-ready" | "fallback-only";
  timeoutMs: number;
};

type CopilotModelConfigOptions = {
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  modelTimeoutMs?: number | undefined;
};

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 60_000;

export function createCopilotModelConfig(options: CopilotModelConfigOptions = {}): CopilotModelConfig {
  const endpoint = responseEndpointCandidates(options.apiBaseUrl)[0] ?? "https://api.openai.com/v1/responses";
  const model = options.model?.trim() || DEFAULT_MODEL;
  const hasApiKey = Boolean(options.apiKey?.trim());
  const timeoutMs =
    typeof options.modelTimeoutMs === "number" && Number.isFinite(options.modelTimeoutMs)
      ? options.modelTimeoutMs
      : DEFAULT_TIMEOUT_MS;

  return {
    endpoint,
    model,
    hasApiKey,
    mode: hasApiKey ? "llm-ready" : "fallback-only",
    timeoutMs
  };
}

export function createGenerateConfigHandler(options: CopilotModelConfigOptions = {}) {
  const config = createCopilotModelConfig(options);

  return function generateConfigHandler(req: GenerateConfigRequest, res: GenerateConfigResponse): void {
    if (req.method && req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }
    writeJson(res, 200, config);
  };
}

function writeJson(res: GenerateConfigResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}
