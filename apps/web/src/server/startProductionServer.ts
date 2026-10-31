import { resolve } from "node:path";
import { createProductionServer } from "./productionServer";
import { loadProductionEnv } from "./productionEnv";

const env = loadProductionEnv();
const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "4173", 10);
const distDir = resolve(process.cwd(), "dist");

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a positive number");
}

createProductionServer({
  distDir,
  brief: {
    apiKey: env.OPENAI_API_KEY,
    apiBaseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_BRIEF_MODEL || env.OPENAI_GENERATION_MODEL
  },
  generation: {
    apiKey: env.OPENAI_API_KEY,
    apiBaseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_GENERATION_MODEL
  }
}).listen(port, host, () => {
  console.log(`ai-motion web server listening on http://${host}:${port}`);
});
