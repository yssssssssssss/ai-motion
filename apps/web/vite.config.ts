import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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

function briefParserApiPlugin(): Plugin {
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
            typeof import("./src/server/briefParser")
          >("/src/server/briefParser.ts");
          const result = await parseBriefWithOpenAI({
            brief,
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_BRIEF_MODEL
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

export default defineConfig({
  plugins: [react(), briefParserApiPlugin()]
});
