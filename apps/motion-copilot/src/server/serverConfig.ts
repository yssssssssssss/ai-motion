import { join } from "node:path";
import type { ZeroFrameSnapshotOptions } from "../dev-api/zeroFrameSnapshot";
import type { ZeroVisualSnapshotOptions } from "../dev-api/zeroVisualSnapshot";
import type { ZeroLayerSnapshotOptions } from "../dev-api/zeroLayerSnapshot";
import type { ZeroLayerFramePairOptions } from "../dev-api/zeroLayerFramePairs";
import type { ZeroAssetProxyOptions } from "../dev-api/zeroAssetProxy";
import type { createGenerateDraftHandler } from "../dev-api/generateDraft";

type CopilotModelConfig = NonNullable<Parameters<typeof createGenerateDraftHandler>[0]>;

export type CopilotServerConfig = {
  modelConfig: CopilotModelConfig;
  zeroConfig: ZeroFrameSnapshotOptions;
  zeroVisualConfig: ZeroVisualSnapshotOptions;
  zeroLayerConfig: ZeroLayerSnapshotOptions;
  zeroLayerFramePairConfig: ZeroLayerFramePairOptions;
  zeroAssetConfig: ZeroAssetProxyOptions;
};

export type CopilotServerConfigOptions = {
  scriptsDir: string;
};

function envValue(env: Record<string, string>, name: string): string | undefined {
  return process.env[name] || env[name] || undefined;
}

function prefixedEnv(env: Record<string, string>, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  const names = new Set([...Object.keys(env), ...Object.keys(process.env)]);
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const value = envValue(env, name);
    if (value) result[name] = value;
  }
  return result;
}

function splitArgs(value: string | undefined): string[] | undefined {
  return value?.split(/\s+/).filter(Boolean);
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

function assetAllowedOrigins(value: string | undefined, zeroMcpHttpUrl: string | undefined): string[] {
  return [zeroMcpHttpUrl, ...(value?.split(",") ?? [])].filter((candidate): candidate is string =>
    Boolean(candidate?.trim())
  );
}

export function buildCopilotServerConfig(
  env: Record<string, string>,
  { scriptsDir }: CopilotServerConfigOptions
): CopilotServerConfig {
  const snapshotScript = join(scriptsDir, "zero-frame-snapshot-fixture.mjs");
  const visualScript = join(scriptsDir, "zero-visual-snapshot-fixture.mjs");
  const layerScript = join(scriptsDir, "zero-layer-snapshot-fixture.mjs");
  const mcpLayerBridge = join(scriptsDir, "zero-mcp-layer-bridge.mjs");
  const mcpVisualBridge = join(scriptsDir, "zero-mcp-visual-bridge.mjs");

  const zeroMcpHttpUrl = envValue(env, "ZERO_MCP_HTTP_URL");
  const zeroBridgeEnv = prefixedEnv(env, "ZERO_MCP_");

  const modelTimeoutMs = positiveNumber(envValue(env, "OPENAI_GENERATION_TIMEOUT_MS"));
  const zeroTimeoutMs = positiveNumber(envValue(env, "ZERO_MCP_SNAPSHOT_TIMEOUT_MS"));
  const zeroVisualTimeoutMs = positiveNumber(envValue(env, "ZERO_MCP_VISUAL_TIMEOUT_MS"));
  const zeroLayerTimeoutMs = positiveNumber(envValue(env, "ZERO_MCP_LAYER_TIMEOUT_MS"));
  const zeroAssetMaxBytes = positiveNumber(envValue(env, "ZERO_ASSET_MAX_BYTES"));

  const layerArgs = splitArgs(envValue(env, "ZERO_MCP_LAYER_ARGS"));

  return {
    modelConfig: {
      apiKey: envValue(env, "OPENAI_API_KEY"),
      apiBaseUrl: envValue(env, "OPENAI_BASE_URL"),
      model: envValue(env, "OPENAI_GENERATION_MODEL") ?? "gpt-5.5",
      ...(modelTimeoutMs ? { modelTimeoutMs } : {})
    },
    zeroConfig: {
      snapshotCommand: envValue(env, "ZERO_MCP_SNAPSHOT_COMMAND") ?? process.execPath,
      snapshotArgs: argsWithNodeId(splitArgs(envValue(env, "ZERO_MCP_SNAPSHOT_ARGS")), [
        snapshotScript,
        "--node-id",
        "{nodeId}"
      ]),
      commandEnv: zeroBridgeEnv,
      ...(zeroTimeoutMs ? { timeoutMs: zeroTimeoutMs } : {})
    },
    zeroVisualConfig: {
      visualCommand: envValue(env, "ZERO_MCP_VISUAL_COMMAND") ?? process.execPath,
      visualArgs: argsWithNodeId(splitArgs(envValue(env, "ZERO_MCP_VISUAL_ARGS")), [
        zeroMcpHttpUrl ? mcpVisualBridge : visualScript,
        "--node-id",
        "{nodeId}"
      ]),
      commandEnv: zeroBridgeEnv,
      ...(zeroVisualTimeoutMs ? { timeoutMs: zeroVisualTimeoutMs } : {})
    },
    zeroLayerConfig: {
      layerCommand: envValue(env, "ZERO_MCP_LAYER_COMMAND") ?? process.execPath,
      layerArgs: argsWithNodeId(layerArgs, [
        zeroMcpHttpUrl ? mcpLayerBridge : layerScript,
        "--node-id",
        "{nodeId}"
      ]),
      commandEnv: zeroBridgeEnv,
      ...(zeroLayerTimeoutMs ? { timeoutMs: zeroLayerTimeoutMs } : {})
    },
    zeroLayerFramePairConfig: {
      discoveryCommand: envValue(env, "ZERO_MCP_LAYER_COMMAND") ?? process.execPath,
      discoveryArgs: argsWithFramePairDiscovery(layerArgs, [mcpLayerBridge, "--discover-frame-pairs"]),
      commandEnv: zeroBridgeEnv,
      ...(zeroLayerTimeoutMs ? { timeoutMs: zeroLayerTimeoutMs } : {})
    },
    zeroAssetConfig: {
      allowedOrigins: assetAllowedOrigins(envValue(env, "ZERO_ASSET_ALLOWED_ORIGINS"), zeroMcpHttpUrl),
      ...(zeroAssetMaxBytes ? { maxResponseBytes: zeroAssetMaxBytes } : {})
    }
  };
}
