import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function envValue(env: Record<string, string>, name: string): string | undefined {
  return process.env[name] || env[name] || undefined;
}

function parseEnvFile(url: URL): Record<string, string> {
  const file = fileURLToPath(url);
  if (!existsSync(file)) return {};

  const result: Record<string, string> = {};
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

function loadCopilotEnv(mode: string): Record<string, string> {
  return {
    ...parseEnvFile(new URL("../web/.env.local", import.meta.url)),
    ...loadEnv(mode, process.cwd(), "")
  };
}

function copilotGenerateApiPlugin(env: Record<string, string>): Plugin {
  const timeoutMs = Number(envValue(env, "OPENAI_GENERATION_TIMEOUT_MS"));
  const zeroTimeoutMs = Number(envValue(env, "ZERO_MCP_SNAPSHOT_TIMEOUT_MS"));
  const zeroVisualTimeoutMs = Number(envValue(env, "ZERO_MCP_VISUAL_TIMEOUT_MS"));
  const zeroLayerTimeoutMs = Number(envValue(env, "ZERO_MCP_LAYER_TIMEOUT_MS"));
  const defaultZeroSnapshotScript = fileURLToPath(
    new URL("../../scripts/zero-frame-snapshot-fixture.mjs", import.meta.url)
  );
  const defaultZeroVisualScript = fileURLToPath(
    new URL("../../scripts/zero-visual-snapshot-fixture.mjs", import.meta.url)
  );
  const defaultZeroLayerScript = fileURLToPath(
    new URL("../../scripts/zero-layer-snapshot-fixture.mjs", import.meta.url)
  );
  const defaultZeroMcpLayerBridge = fileURLToPath(
    new URL("../../scripts/zero-mcp-layer-bridge.mjs", import.meta.url)
  );
  const zeroMcpHttpUrl = envValue(env, "ZERO_MCP_HTTP_URL");
  const modelConfig = {
    apiKey: envValue(env, "OPENAI_API_KEY"),
    apiBaseUrl: envValue(env, "OPENAI_BASE_URL"),
    model: envValue(env, "OPENAI_GENERATION_MODEL") ?? "gpt-5.5",
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { modelTimeoutMs: timeoutMs } : {})
  };
  const zeroConfig = {
    snapshotCommand: envValue(env, "ZERO_MCP_SNAPSHOT_COMMAND") ?? process.execPath,
    snapshotArgs: envValue(env, "ZERO_MCP_SNAPSHOT_ARGS")?.split(/\s+/).filter(Boolean) ?? [
      defaultZeroSnapshotScript,
      "--node-id",
      "{nodeId}"
    ],
    ...(Number.isFinite(zeroTimeoutMs) && zeroTimeoutMs > 0 ? { timeoutMs: zeroTimeoutMs } : {})
  };
  const zeroVisualConfig = {
    visualCommand: envValue(env, "ZERO_MCP_VISUAL_COMMAND") ?? process.execPath,
    visualArgs: envValue(env, "ZERO_MCP_VISUAL_ARGS")?.split(/\s+/).filter(Boolean) ?? [
      defaultZeroVisualScript,
      "--node-id",
      "{nodeId}"
    ],
    ...(Number.isFinite(zeroVisualTimeoutMs) && zeroVisualTimeoutMs > 0
      ? { timeoutMs: zeroVisualTimeoutMs }
      : {})
  };
  const zeroLayerConfig = {
    layerCommand: envValue(env, "ZERO_MCP_LAYER_COMMAND") ?? process.execPath,
    layerArgs: envValue(env, "ZERO_MCP_LAYER_ARGS")?.split(/\s+/).filter(Boolean) ?? [
      zeroMcpHttpUrl ? defaultZeroMcpLayerBridge : defaultZeroLayerScript,
      "--node-id",
      "{nodeId}"
    ],
    ...(Number.isFinite(zeroLayerTimeoutMs) && zeroLayerTimeoutMs > 0 ? { timeoutMs: zeroLayerTimeoutMs } : {})
  };

  return {
    name: "motion-copilot-generate-api",
    configureServer(server) {
      server.middlewares.use("/api/copilot/config", async (req, res) => {
        const { createGenerateConfigHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/generateConfig")
        >("/src/dev-api/generateConfig.ts");
        createGenerateConfigHandler(modelConfig)(req, res);
      });
      server.middlewares.use("/api/copilot/generate", async (req, res) => {
        const { createGenerateDraftHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/generateDraft")
        >("/src/dev-api/generateDraft.ts");
        await createGenerateDraftHandler(modelConfig)(req, res);
      });
      server.middlewares.use("/api/zero/frame-snapshot", async (req, res) => {
        const { createZeroFrameSnapshotHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/zeroFrameSnapshot")
        >("/src/dev-api/zeroFrameSnapshot.ts");
        await createZeroFrameSnapshotHandler(zeroConfig)(req, res);
      });
      server.middlewares.use("/api/zero/visual-snapshot", async (req, res) => {
        const { createZeroVisualSnapshotHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/zeroVisualSnapshot")
        >("/src/dev-api/zeroVisualSnapshot.ts");
        await createZeroVisualSnapshotHandler(zeroVisualConfig)(req, res);
      });
      server.middlewares.use("/api/zero/layer-snapshot", async (req, res) => {
        const { createZeroLayerSnapshotHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/zeroLayerSnapshot")
        >("/src/dev-api/zeroLayerSnapshot.ts");
        await createZeroLayerSnapshotHandler(zeroLayerConfig)(req, res);
      });
      server.middlewares.use("/api/zero/asset", async (req, res) => {
        const { createZeroAssetProxyHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/zeroAssetProxy")
        >("/src/dev-api/zeroAssetProxy.ts");
        await createZeroAssetProxyHandler()(req, res);
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadCopilotEnv(mode);

  return {
    plugins: [react(), copilotGenerateApiPlugin(env)],
    resolve: {
      alias: {
        "@motion-copilot/core": fileURLToPath(
          new URL("../../packages/motion-copilot-core/src/index.ts", import.meta.url)
        )
      }
    },
    server: {
      host: "127.0.0.1",
      port: 5177,
      strictPort: true
    },
    preview: {
      host: "127.0.0.1",
      port: 5177,
      strictPort: true
    }
  };
});
