import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMotionLensProductionServer } from "./productionServer";

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};

  const result: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const name = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    result[name] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }

  return result;
}

function envValue(fileEnv: Record<string, string>, name: string): string | undefined {
  return process.env[name] || fileEnv[name] || undefined;
}

function positiveNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "5176", 10);
const distDir = resolve(process.cwd(), "dist");
const fileEnv = parseEnvFile(resolve(process.cwd(), "../web/.env.local"));

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a positive number");
}

createMotionLensProductionServer({
  distDir,
  modelConfig: {
    apiKey: envValue(fileEnv, "OPENAI_API_KEY"),
    apiBaseUrl: envValue(fileEnv, "OPENAI_BASE_URL"),
    model: envValue(fileEnv, "OPENAI_GENERATION_MODEL") ?? "gpt-5.5",
    modelTimeoutMs: positiveNumber(envValue(fileEnv, "OPENAI_VISION_TIMEOUT_MS"))
  }
}).listen(port, host, () => {
  console.log(`motion-lens server listening on http://${host}:${port}`);
});
