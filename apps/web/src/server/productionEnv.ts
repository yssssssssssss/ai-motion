import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadProductionEnv(
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const path = resolve(cwd, ".env.local");
  const result: Record<string, string> = {};
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const name = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      result[name] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  for (const [name, value] of Object.entries(environment)) {
    if (value) result[name] = value;
  }
  return result;
}
