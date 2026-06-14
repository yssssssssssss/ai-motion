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

function loadMotionLensEnv(mode: string): Record<string, string> {
  return {
    ...parseEnvFile(new URL("../web/.env.local", import.meta.url)),
    ...loadEnv(mode, process.cwd(), "")
  };
}

function motionLensAnalyzeApiPlugin(env: Record<string, string>): Plugin {
  const timeoutMs = Number(envValue(env, "OPENAI_VISION_TIMEOUT_MS"));
  const modelConfig = {
    apiKey: envValue(env, "OPENAI_API_KEY"),
    apiBaseUrl: envValue(env, "OPENAI_BASE_URL"),
    model: envValue(env, "OPENAI_GENERATION_MODEL") ?? "gpt-5.5",
    ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { modelTimeoutMs: timeoutMs } : {})
  };

  return {
    name: "motion-lens-analyze-api",
    configureServer(server) {
      server.middlewares.use("/api/motion-lens/config", async (req, res) => {
        const { createMotionLensConfigHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/motionLensConfig")
        >("/src/dev-api/motionLensConfig.ts");
        createMotionLensConfigHandler(modelConfig)(req, res);
      });
      server.middlewares.use("/api/motion-lens/analyze", async (req, res) => {
        const { createMotionLensAnalyzeHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/motionLensAnalyze")
        >("/src/dev-api/motionLensAnalyze.ts");
        await createMotionLensAnalyzeHandler(modelConfig)(req, res);
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadMotionLensEnv(mode);

  return {
    plugins: [react(), motionLensAnalyzeApiPlugin(env)],
    resolve: {
      alias: {
        "@motion-lens/core": fileURLToPath(
          new URL("../../packages/motion-lens-core/src/index.ts", import.meta.url)
        )
      }
    },
    server: {
      host: "127.0.0.1",
      port: 5176,
      strictPort: true
    },
    preview: {
      host: "127.0.0.1",
      port: 5176,
      strictPort: true
    }
  };
});
