import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMotionCopilotProductionServer } from "./productionServer";
import { buildCopilotServerConfig } from "./serverConfig";

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

const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "5177", 10);
const distDir = resolve(process.cwd(), "dist");
const fileEnv = parseEnvFile(resolve(process.cwd(), "../web/.env.local"));
const scriptsDir = resolve(process.cwd(), "../../scripts");

if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a positive number");
}

const serverConfig = buildCopilotServerConfig(fileEnv, { scriptsDir });

createMotionCopilotProductionServer({ distDir, ...serverConfig }).listen(port, host, () => {
  console.log(`motion-copilot server listening on http://${host}:${port}`);
});
