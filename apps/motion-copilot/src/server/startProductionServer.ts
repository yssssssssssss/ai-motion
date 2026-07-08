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

function prefixedEnv(fileEnv: Record<string, string>, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  const names = new Set([...Object.keys(fileEnv), ...Object.keys(process.env)]);
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const value = envValue(fileEnv, name);
    if (value) result[name] = value;
  }
  return result;
}

function argsWithNodeId(args: string[] | undefined, fallback: string[]): string[] {
  if (!args || args.length === 0) return fallback;
  return args.some((arg) => arg.includes("{nodeId}")) ? args : [...args, "--node-id", "{nodeId}"];
}

function argsWithFramePairDiscovery(args: string[] | undefined, fallback: string[]): string[] {
  if (!args || args.length === 0) return fallback;
  if (args.includes("--discover-frame-pairs")) return args;
  const output: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--node-id") {
      index += 1;
      continue;
    }
    if (arg.includes("{nodeId}")) continue;
    output.push(arg);
  }
  return [...output, "--discover-frame-pairs"];
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
const zeroBridgeEnv = prefixedEnv(fileEnv, "ZERO_MCP_");

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
    snapshotArgs: argsWithNodeId(zeroSnapshotArgs, [defaultZeroSnapshotScript, "--node-id", "{nodeId}"]),
    commandEnv: zeroBridgeEnv,
    ...(zeroSnapshotTimeoutMs ? { timeoutMs: zeroSnapshotTimeoutMs } : {})
  },
  zeroVisualConfig: {
    visualCommand: zeroVisualCommand ?? process.execPath,
    visualArgs: argsWithNodeId(zeroVisualArgs, [defaultZeroVisualScript, "--node-id", "{nodeId}"]),
    commandEnv: zeroBridgeEnv,
    ...(zeroVisualTimeoutMs ? { timeoutMs: zeroVisualTimeoutMs } : {})
  },
  zeroLayerConfig: {
    layerCommand: zeroLayerCommand ?? process.execPath,
    layerArgs: argsWithNodeId(zeroLayerArgs, [
      zeroMcpHttpUrl ? defaultZeroMcpLayerBridge : defaultZeroLayerScript,
      "--node-id",
      "{nodeId}"
    ]),
    commandEnv: zeroBridgeEnv,
    ...(zeroLayerTimeoutMs ? { timeoutMs: zeroLayerTimeoutMs } : {})
  },
  zeroLayerFramePairConfig: {
    discoveryCommand: zeroLayerCommand ?? process.execPath,
    discoveryArgs: argsWithFramePairDiscovery(zeroLayerArgs, [
      defaultZeroMcpLayerBridge,
      "--discover-frame-pairs"
    ]),
    commandEnv: zeroBridgeEnv,
    ...(zeroLayerTimeoutMs ? { timeoutMs: zeroLayerTimeoutMs } : {})
  }
}).listen(port, host, () => {
  console.log(`motion-copilot server listening on http://${host}:${port}`);
});
