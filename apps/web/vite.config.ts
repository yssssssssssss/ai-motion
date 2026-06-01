import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const DEV_HOST = "127.0.0.1";
const DEV_PORT = 5173;

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function envValue(env: Record<string, string>, name: string): string | undefined {
  return process.env[name] || env[name] || undefined;
}

function briefParserApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "brief-parser-api",
    configureServer(server) {
      server.middlewares.use("/api/brief/parse", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw || "{}") as { brief?: unknown };
          const brief = typeof parsed.brief === "string" ? parsed.brief : "";
          const { parseBriefWithOpenAI } = await server.ssrLoadModule<
            typeof import("./src/dev-api/briefParser")
          >("/src/dev-api/briefParser.ts");
          const result = await parseBriefWithOpenAI({
            brief,
            apiKey: envValue(env, "OPENAI_API_KEY"),
            apiBaseUrl: envValue(env, "OPENAI_BASE_URL"),
            model: envValue(env, "OPENAI_BRIEF_MODEL")
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Failed to parse brief." }));
        }
      });
    }
  };
}

function videoAnalyzerApiPlugin(): Plugin {
  return {
    name: "video-analyzer-api",
    configureServer(server) {
      server.middlewares.use("/api/video/analyze", async (req, res) => {
        const { createVideoAnalyzeHandler } = await server.ssrLoadModule<
          typeof import("./src/dev-api/videoAnalyzeRoute")
        >("/src/dev-api/videoAnalyzeRoute.ts");
        await createVideoAnalyzeHandler()(req, res);
      });
    },
    async configurePreviewServer(server) {
      const { createVideoAnalyzeHandler } = await import("./src/dev-api/videoAnalyzeRoute");
      const handler = createVideoAnalyzeHandler();

      server.middlewares.use("/api/video/analyze", (req, res) => {
        void handler(req, res);
      });
    }
  };
}

export function builtinComponentChunk(id: string): string | undefined {
  const match = id.match(/\/packages\/components-builtin\/([^/]+)\//);
  const componentId = match?.[1];
  if (!componentId || componentId === "src") return undefined;
  return `builtin-${componentId}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), briefParserApiPlugin(env), videoAnalyzerApiPlugin()],
    server: {
      host: DEV_HOST,
      port: DEV_PORT,
      strictPort: true
    },
    preview: {
      host: DEV_HOST,
      port: DEV_PORT,
      strictPort: true
    },
    build: {
      // 大资源 inline 在 builtin 组件中（如 jd-product-transition-video/assets.css 含 base64 图片）
      // 主 chunk 阈值放宽到 3MB，避免误告警
      chunkSizeWarningLimit: 3072,
      rollupOptions: {
        output: {
          // 把大体量的 WorkEasy 静态数据 / builtin 组件资源 拆到独立 chunk，避免拖慢首屏
          manualChunks(id) {
            if (id.includes("workeasyComponents.generated")) return "workeasy-data";
            const builtinChunk = builtinComponentChunk(id);
            if (builtinChunk) return builtinChunk;
            if (id.includes("/node_modules/react") || id.includes("/node_modules/react-dom")) {
              return "react-vendor";
            }
            return undefined;
          }
        }
      }
    }
  };
});
