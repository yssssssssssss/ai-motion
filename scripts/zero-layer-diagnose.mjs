#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tsx = resolve(repoRoot, "packages/motion-copilot-core/node_modules/.bin/tsx");
const entry = resolve(repoRoot, "scripts/zero-layer-diagnose.ts");

if (!existsSync(tsx)) {
  console.error("Missing tsx runtime. Run pnpm install before using zero:diagnose.");
  process.exit(1);
}

const child = spawn(tsx, [entry, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
