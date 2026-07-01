import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMotionCopilotProductionServer } from "./productionServer";

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
const port = Number.parseInt(process.env.PORT || "5177", 10);
const distDir = resolve(process.cwd(), "dist");
const fileEnv = parseEnvFile(resolve(process.cwd(), "../web/.env.local"));
const defaultZeroSnapshotScript = resolve(process.cwd(), "../../scripts/zero-frame-snapshot-fixture.mjs");
const defaultZeroVisualScript = resolve(process.cwd(), "../../scripts/zero-visual-snapshot-fixture.mjs");
const defaultZeroLayerScript = resolve(process.cwd(), "../../scripts/zero-layer-snapshot-fixture.mjs");
const defaultZeroMcpLayerBridge = resolve(process.cwd(), "../../scripts/zero-mcp-layer-bridge.mjs");
const zeroMcpHttpUrl = envValue(fileEnv, "ZERO_MCP_HTTP_URL");
const zeroSnapshotCommand = envValue(fileEnv, "ZERO_MCP_SNAPSHOT_COMMAND");
const zeroSnapshotArgs = envValue(fileEnv, "ZERO_MCP_SNAPSHOT_ARGS")?.split(/\s+/).filter(Boolean);
const zeroSnapshotTimeoutMs = positiveNumber(envValue(fileEnv, "ZERO_MCP_SNAPSHOT_TIMEOUT_MS"));
const zeroVisualCommand = envValue(fileEnv, "ZERO_MCP_VISUAL_COMMAND");
const zeroVisualArgs = envValue(fileEnv, "ZERO_MCP_VISUAL_ARGS")?.split(/\s+/).filter(Boolean);
const zeroVisualTimeoutMs = positiveNumber(envValue(fileEnv, "ZERO_MCP_VISUAL_TIMEOUT_MS"));
const zeroLayerCommand = envValue(fileEnv, "ZERO_MCP_LAYER_COMMAND");
const zeroLayerArgs = envValue(fileEnv, "ZERO_MCP_LAYER_ARGS")?.split(/\s+/).filter(Boolean);
const zeroLayerTimeoutMs = positiveNumber(envValue(fileEnv, "ZERO_MCP_LAYER_TIMEOUT_MS"));

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a positive number");
}

createMotionCopilotProductionServer({
  distDir,
  modelConfig: {
    apiKey: envValue(fileEnv, "OPENAI_API_KEY"),
    apiBaseUrl: envValue(fileEnv, "OPENAI_BASE_URL"),
    model: envValue(fileEnv, "OPENAI_GENERATION_MODEL") ?? "gpt-5.5",
    modelTimeoutMs: positiveNumber(envValue(fileEnv, "OPENAI_GENERATION_TIMEOUT_MS"))
  },
  zeroConfig: {
    snapshotCommand: zeroSnapshotCommand ?? process.execPath,
    snapshotArgs:
      zeroSnapshotArgs && zeroSnapshotArgs.length > 0
        ? zeroSnapshotArgs
        : [defaultZeroSnapshotScript, "--node-id", "{nodeId}"],
    ...(zeroSnapshotTimeoutMs ? { timeoutMs: zeroSnapshotTimeoutMs } : {})
  },
  zeroVisualConfig: {
    visualCommand: zeroVisualCommand ?? process.execPath,
    visualArgs:
      zeroVisualArgs && zeroVisualArgs.length > 0
        ? zeroVisualArgs
        : [defaultZeroVisualScript, "--node-id", "{nodeId}"],
    ...(zeroVisualTimeoutMs ? { timeoutMs: zeroVisualTimeoutMs } : {})
  },
  zeroLayerConfig: {
    layerCommand: zeroLayerCommand ?? process.execPath,
    layerArgs:
      zeroLayerArgs && zeroLayerArgs.length > 0
        ? zeroLayerArgs
        : [zeroMcpHttpUrl ? defaultZeroMcpLayerBridge : defaultZeroLayerScript, "--node-id", "{nodeId}"],
    ...(zeroLayerTimeoutMs ? { timeoutMs: zeroLayerTimeoutMs } : {})
  }
}).listen(port, host, () => {
  console.log(`motion-copilot server listening on http://${host}:${port}`);
});
