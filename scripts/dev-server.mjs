import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(repoRoot, "apps/web");
const ports = [5173, 5174];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  });
}

function pidsForPort(port) {
  try {
    return run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"])
      .split(/\s+/)
      .map((value) => Number(value))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function cwdForPid(pid) {
  try {
    const output = run("lsof", ["-a", "-p", String(pid), "-d", "cwd"]);
    const line = output.split("\n").slice(1).find(Boolean);
    return line?.match(/\s(\/.+)$/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function projectDevPids() {
  return ports.flatMap((port) =>
    pidsForPort(port)
      .map((pid) => ({ pid, port, cwd: cwdForPid(pid) }))
      .filter((item) => item.cwd === webRoot)
  );
}

function status() {
  const servers = projectDevPids();
  if (servers.length === 0) {
    console.log("ai-motion dev server is stopped.");
    return;
  }

  for (const server of servers) {
    console.log(`ai-motion dev server is running: http://127.0.0.1:${server.port} pid=${server.pid}`);
  }
}

function stop() {
  const servers = projectDevPids();
  if (servers.length === 0) {
    console.log("ai-motion dev server is already stopped.");
    return;
  }

  for (const server of servers) {
    process.kill(server.pid, "SIGTERM");
    console.log(`stopped pid=${server.pid} on port ${server.port}`);
  }
}

function start() {
  if (projectDevPids().length > 0) {
    console.error("ai-motion dev server is already running. Use `pnpm dev:restart` to restart it.");
    process.exit(1);
  }

  const pnpm = "/opt/homebrew/bin/pnpm";
  const command = existsSync(pnpm) ? pnpm : "pnpm";
  const child = spawn(command, ["--filter", "@motion-tool/web", "dev"], {
    cwd: repoRoot,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

const command = process.argv[2] ?? "status";

if (command === "status") status();
else if (command === "stop") stop();
else if (command === "start") start();
else if (command === "restart") {
  stop();
  start();
} else {
  console.error("Usage: node scripts/dev-server.mjs <start|stop|restart|status>");
  process.exit(1);
}
