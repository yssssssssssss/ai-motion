#!/usr/bin/env node

import { execFile } from "node:child_process";

function parseArgs(argv) {
  const args = {
    timeoutMs: Number(process.env.ZERO_MCP_BRIDGE_TIMEOUT_MS || 30000)
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--")) continue;
    if (value == null || value.startsWith("--")) {
      args[key.slice(2)] = true;
      continue;
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/zero-mcp-visual-bridge.mjs --node-id 28:2

Required environment:
  ZERO_MCP_HTTP_URL       Zero MCP streamable HTTP endpoint, for example http://127.0.0.1:27618/mcp
                          OR
  ZERO_MCP_TOOL_COMMAND   External MCP-capable command executable.
  ZERO_MCP_TOOL_ARGS      Default argument template. Use {tool} and {nodeId}.

Optional environment:
  ZERO_MCP_TOOL_ARGS_GET_DESIGN_CONTEXT
  ZERO_MCP_TOOL_ARGS_GET_DESIGN_METADATA
  ZERO_MCP_TOOL_ARGS_GET_SCREENSHOT
  ZERO_MCP_BRIDGE_TIMEOUT_MS  default 30000.
  ZERO_MCP_SCREENSHOT_MAX_DIMENSION  default 1024.
  ZERO_MCP_SCREENSHOT_BASE64  default true. Set to false to keep only the short-lived hosted URL.

This bridge calls three MCP tools:
  get_design_context
  get_design_metadata
  get_screenshot

HTTP endpoint example:
  ZERO_MCP_HTTP_URL=http://127.0.0.1:27618/mcp \\
  ZERO_MCP_VISUAL_COMMAND=node \\
  ZERO_MCP_VISUAL_ARGS='scripts/zero-mcp-visual-bridge.mjs --node-id {nodeId}' \\
  pnpm motion-copilot:dev

External command example:
  ZERO_MCP_TOOL_COMMAND=/path/to/mcp-client \\
  ZERO_MCP_TOOL_ARGS='zero_design {tool} --node-id {nodeId}' \\
  ZERO_MCP_TOOL_ARGS_GET_DESIGN_CONTEXT='zero_design get_design_context --node-id {nodeId} --force-code true' \\
  ZERO_MCP_VISUAL_COMMAND=node \\
  ZERO_MCP_VISUAL_ARGS='scripts/zero-mcp-visual-bridge.mjs --node-id {nodeId}' \\
  pnpm motion-copilot:dev`;
}

function splitArgs(value) {
  if (!value) return [];
  return value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((item) => item.replace(/^(['"])(.*)\1$/, "$2")) ?? [];
}

function toolArgs(template, tool, nodeId) {
  return splitArgs(template).map((item) => item.replaceAll("{tool}", tool).replaceAll("{nodeId}", nodeId));
}

function argsTemplateForTool(tool) {
  const specificName = `ZERO_MCP_TOOL_ARGS_${tool.toUpperCase()}`;
  return process.env[specificName]?.trim() || process.env.ZERO_MCP_TOOL_ARGS?.trim() || "";
}

function requiredToolArgsTemplate(tool) {
  const template = argsTemplateForTool(tool);
  if (!template) {
    throw new Error(`Missing argument template for ${tool}. Set ZERO_MCP_TOOL_ARGS or ZERO_MCP_TOOL_ARGS_${tool.toUpperCase()}.`);
  }
  return template;
}

function runTool(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout.trim());
      }
    });
  });
}

function parseSsePayload(raw) {
  const dataLines = String(raw)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  const payload = dataLines.length > 0 ? dataLines.join("\n") : String(raw).trim();
  if (!payload) throw new Error("MCP HTTP response is empty.");
  return JSON.parse(payload);
}

function toolArguments(tool, nodeId) {
  if (tool === "get_design_context") return { nodeId, forceCode: true };
  if (tool === "get_screenshot") {
    const maxDimension = Number(process.env.ZERO_MCP_SCREENSHOT_MAX_DIMENSION || 1024);
    const enableBase64Response = process.env.ZERO_MCP_SCREENSHOT_BASE64 !== "false";
    return {
      nodeId,
      enableBase64Response,
      contentsOnly: true,
      ...(Number.isFinite(maxDimension) && maxDimension > 0 ? { maxDimension } : {})
    };
  }
  return { nodeId };
}

async function runHttpTool(url, tool, nodeId, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Protocol-Version": "2025-06-18"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${tool}-${Date.now()}`,
        method: "tools/call",
        params: {
          name: tool,
          arguments: toolArguments(tool, nodeId)
        }
      })
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`MCP HTTP ${tool} failed: ${response.status} ${body}`);
    const message = parseSsePayload(body);
    if (message.error) throw new Error(message.error.message || `MCP HTTP ${tool} returned an error.`);
    return message.result;
  } finally {
    clearTimeout(timeout);
  }
}

function hasUsablePayload(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "object" && value !== null;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

// get_screenshot only feeds the pixel-diff/preview reference; the morph renders from the
// design context + metadata. Retry it a couple of times, then degrade to "" so a slow or failed
// screenshot never aborts a snapshot that is otherwise fully renderable.
async function runScreenshotBestEffort(callTool, retryDelayMs) {
  const attempts = 2;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const screenshot = await callTool("get_screenshot");
      if (hasUsablePayload(screenshot)) return screenshot;
    } catch (error) {
      if (attempt >= attempts) {
        console.error(`get_screenshot failed after ${attempts} attempts, degrading to empty: ${errorText(error)}`);
        break;
      }
    }
    if (attempt < attempts) await delay(retryDelayMs);
  }
  return "";
}

function createToolRunner({ httpUrl, command, timeoutMs }) {
  if (httpUrl) {
    return (tool, nodeId) => runHttpTool(httpUrl, tool, nodeId, timeoutMs);
  }
  return (tool, nodeId) => {
    const args = toolArgs(requiredToolArgsTemplate(tool), tool, nodeId);
    return runTool(command, args, timeoutMs);
  };
}

function requireEssential(tool, result) {
  if (result.status === "rejected") throw new Error(`${tool} failed: ${errorText(result.reason)}`);
  if (!hasUsablePayload(result.value)) throw new Error(`${tool} returned an empty payload.`);
  return result.value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const nodeId = typeof args["node-id"] === "string" ? args["node-id"].trim() : "";
  const httpUrl = process.env.ZERO_MCP_HTTP_URL?.trim();
  const command = process.env.ZERO_MCP_TOOL_COMMAND?.trim();
  const timeoutMs = Number.isFinite(args.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : 30000;
  const retryDelayMs = Number(process.env.ZERO_MCP_BRIDGE_RETRY_DELAY_MS || 250);

  if (!nodeId) throw new Error("Missing --node-id.");
  if (!httpUrl && !command) {
    throw new Error(
      "Zero MCP is not configured. Set ZERO_MCP_HTTP_URL or ZERO_MCP_TOOL_COMMAND/ZERO_MCP_TOOL_ARGS."
    );
  }

  const callTool = createToolRunner({ httpUrl, command, timeoutMs });

  // Screenshot runs in parallel and never rejects, so it can't slow down or abort the essential
  // tools — it degrades to "" on its own.
  const screenshotPromise = runScreenshotBestEffort((tool) => callTool(tool, nodeId), retryDelayMs);

  // Context + metadata are render-essential. Settle all three before deciding (no floating promise),
  // then fail fast if either essential tool is missing.
  const [contextResult, metadataResult] = await Promise.allSettled([
    callTool("get_design_context", nodeId),
    callTool("get_design_metadata", nodeId)
  ]);
  const screenshot = await screenshotPromise;

  const bundle = {
    nodeId,
    designContext: requireEssential("get_design_context", contextResult),
    designMetadata: requireEssential("get_design_metadata", metadataResult),
    screenshot
  };

  process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
