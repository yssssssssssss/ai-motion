import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildCopilotServerConfig } from "./src/server/serverConfig";

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
  const scriptsDir = fileURLToPath(new URL("../../scripts", import.meta.url));
  const {
    modelConfig,
    zeroConfig,
    zeroVisualConfig,
    zeroLayerConfig,
    zeroLayerFramePairConfig,
    zeroAssetConfig
  } = buildCopilotServerConfig(env, { scriptsDir });

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
      server.middlewares.use("/api/copilot/zero-motion-plan", async (req, res) => {
        const { createGenerateZeroMotionPlanHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/generateZeroMotionPlan")
        >("/src/dev-api/generateZeroMotionPlan.ts");
        await createGenerateZeroMotionPlanHandler(modelConfig)(req, res);
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
      server.middlewares.use("/api/zero/layer-frame-pairs", async (req, res) => {
        const { createZeroLayerFramePairHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/zeroLayerFramePairs")
        >("/src/dev-api/zeroLayerFramePairs.ts");
        await createZeroLayerFramePairHandler(zeroLayerFramePairConfig)(req, res);
      });
      server.middlewares.use("/api/zero/asset", async (req, res) => {
        const { createZeroAssetProxyHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/zeroAssetProxy")
        >("/src/dev-api/zeroAssetProxy.ts");
        await createZeroAssetProxyHandler(zeroAssetConfig)(req, res);
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
