import { responseEndpointCandidates } from "./motionLensAnalyze";

type MotionLensConfigRequest = {
  method?: string | undefined;
};

type MotionLensConfigResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

export type MotionLensModelConfig = {
  endpoint: string;
  model: string;
  hasApiKey: boolean;
  mode: "llm-ready" | "fallback-only";
  timeoutMs: number;
};

type MotionLensModelConfigOptions = {
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  modelTimeoutMs?: number | undefined;
};

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 90_000;

export function createMotionLensModelConfig(
  options: MotionLensModelConfigOptions = {}
): MotionLensModelConfig {
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

export function createMotionLensConfigHandler(options: MotionLensModelConfigOptions = {}) {
  const config = createMotionLensModelConfig(options);

  return function motionLensConfigHandler(req: MotionLensConfigRequest, res: MotionLensConfigResponse): void {
    if (req.method && req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    writeJson(res, 200, config);
  };
}

function writeJson(res: MotionLensConfigResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}
