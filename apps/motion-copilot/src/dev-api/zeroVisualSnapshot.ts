import { execFile } from "node:child_process";
import { normalizeZeroVisualSnapshotOrCreateFromMcp, type ZeroVisualSnapshot } from "@motion-copilot/core";

type ZeroVisualRequest = {
  method?: string | undefined;
  url?: string | undefined;
  headers?: Record<string, string | string[] | undefined> | undefined;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
};

type ZeroVisualResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

type ZeroVisualInput = {
  nodeId?: unknown;
};

export type ZeroVisualSnapshotSource = "real-zero-mcp-http" | "fixture" | "zero-mcp-bridge" | "custom-command";

export type ZeroVisualSnapshotOptions = {
  visualCommand?: string | undefined;
  visualArgs?: string[] | undefined;
  maxBodyBytes?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function readBody(req: ZeroVisualRequest, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function writeJson(res: ZeroVisualResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function argsForNode(template: string[] | undefined, nodeId: string): string[] {
  const args = template && template.length > 0 ? template : ["--node-id", "{nodeId}"];
  return args.map((item) => item.replaceAll("{nodeId}", nodeId));
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestOrigin(req: ZeroVisualRequest): string {
  const host = firstHeader(req.headers?.host);
  if (!host) return "";
  const proto = firstHeader(req.headers?.["x-forwarded-proto"]) ?? "http";
  return `${proto}://${host}`;
}

function proxiedAssetUrl(source: string, origin: string): string {
  if (!/^https?:\/\//.test(source)) return source;
  const path = `/api/zero/asset?url=${encodeURIComponent(source)}`;
  return origin ? `${origin}${path}` : path;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rewriteZeroAssetUrls(snapshot: ZeroVisualSnapshot, origin: string): ZeroVisualSnapshot {
  const replacements = new Map<string, string>();
  for (const asset of snapshot.assets) {
    replacements.set(asset.url, proxiedAssetUrl(asset.url, origin));
  }
  replacements.set(snapshot.screenshotUrl, proxiedAssetUrl(snapshot.screenshotUrl, origin));

  let html = snapshot.html;
  for (const [source, proxied] of replacements) {
    if (source === proxied) continue;
    html = html.replaceAll(source, proxied).replaceAll(escapeHtml(source), escapeHtml(proxied));
  }

  return {
    ...snapshot,
    screenshotUrl: replacements.get(snapshot.screenshotUrl) ?? snapshot.screenshotUrl,
    html,
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      url: replacements.get(asset.url) ?? asset.url
    }))
  };
}

function sourceForBridge(command: string, args: string[]): ZeroVisualSnapshotSource {
  const bridgeText = [command, ...args].join(" ");
  if (process.env.ZERO_MCP_HTTP_URL) return "real-zero-mcp-http";
  if (bridgeText.includes("zero-visual-snapshot-fixture")) return "fixture";
  if (bridgeText.includes("zero-mcp-visual-bridge")) return "zero-mcp-bridge";
  return "custom-command";
}

function runVisualCommand(command: string, args: string[], timeoutMs: number): Promise<ZeroVisualSnapshot> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolve(normalizeZeroVisualSnapshotOrCreateFromMcp(JSON.parse(stdout) as unknown));
      } catch (parseError) {
        reject(
          parseError instanceof Error ? parseError : new Error("Zero visual snapshot output is invalid.")
        );
      }
    });
  });
}

export function createZeroVisualSnapshotHandler(options: ZeroVisualSnapshotOptions = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function zeroVisualSnapshotHandler(
    req: ZeroVisualRequest,
    res: ZeroVisualResponse
  ): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const command = options.visualCommand?.trim();
    if (!command) {
      writeJson(res, 503, {
        error:
          "Zero MCP visual bridge is not configured. Set ZERO_MCP_VISUAL_COMMAND to a command that prints ZeroVisualSnapshot JSON."
      });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as ZeroVisualInput;
      const nodeId = typeof parsed.nodeId === "string" ? parsed.nodeId.trim() : "";
      if (!nodeId) {
        writeJson(res, 400, { error: "nodeId is required." });
        return;
      }
      const args = argsForNode(options.visualArgs, nodeId);
      const snapshot = rewriteZeroAssetUrls(await runVisualCommand(command, args, timeoutMs), requestOrigin(req));
      writeJson(res, 200, {
        snapshot,
        source: sourceForBridge(command, args),
        bridge: [command, ...args].join(" ")
      });
    } catch (error) {
      writeJson(res, 400, {
        error: error instanceof Error ? error.message : "Zero visual snapshot failed."
      });
    }
  };
}
