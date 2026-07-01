import { execFile } from "node:child_process";
import { normalizeZeroLayerSnapshot, type ZeroLayerSnapshot } from "@motion-copilot/core";

type ZeroLayerRequest = {
  method?: string | undefined;
  url?: string | undefined;
  headers?: Record<string, string | string[] | undefined> | undefined;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
};

type ZeroLayerResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

export type ZeroLayerSnapshotSource = "real-zero-mcp-http" | "fixture" | "zero-layer-bridge" | "custom-command";

export type ZeroLayerSnapshotOptions = {
  layerCommand?: string | undefined;
  layerArgs?: string[] | undefined;
  maxBodyBytes?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function writeJson(res: ZeroLayerResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function readBody(req: ZeroLayerRequest, maxBytes: number): Promise<string> {
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

function argsForNode(template: string[] | undefined, nodeId: string): string[] {
  const args = template && template.length > 0 ? template : ["--node-id", "{nodeId}"];
  return args.map((item) => item.replaceAll("{nodeId}", nodeId));
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestOrigin(req: ZeroLayerRequest): string {
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

function rewriteAssetUrls(snapshot: ZeroLayerSnapshot, origin: string): ZeroLayerSnapshot {
  const replacements = new Map<string, string>();
  for (const asset of snapshot.assets) {
    replacements.set(asset.url, proxiedAssetUrl(asset.url, origin));
  }
  replacements.set(snapshot.screenshotUrl, proxiedAssetUrl(snapshot.screenshotUrl, origin));
  return {
    ...snapshot,
    screenshotUrl: replacements.get(snapshot.screenshotUrl) ?? snapshot.screenshotUrl,
    assets: snapshot.assets.map((asset) => ({ ...asset, url: replacements.get(asset.url) ?? asset.url }))
  };
}

function sourceForBridge(command: string, args: string[]): ZeroLayerSnapshotSource {
  const bridgeText = [command, ...args].join(" ");
  if (bridgeText.includes("zero-layer-snapshot-fixture")) return "fixture";
  if (bridgeText.includes("zero-mcp-layer-bridge")) {
    return process.env.ZERO_MCP_HTTP_URL ? "real-zero-mcp-http" : "zero-layer-bridge";
  }
  return "custom-command";
}

function runLayerCommand(command: string, args: string[], timeoutMs: number): Promise<ZeroLayerSnapshot> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolve(normalizeZeroLayerSnapshot(JSON.parse(stdout) as unknown));
      } catch (parseError) {
        reject(parseError instanceof Error ? parseError : new Error("Zero layer snapshot output is invalid."));
      }
    });
  });
}

export function createZeroLayerSnapshotHandler(options: ZeroLayerSnapshotOptions = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function zeroLayerSnapshotHandler(req: ZeroLayerRequest, res: ZeroLayerResponse): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const command = options.layerCommand?.trim();
    if (!command) {
      writeJson(res, 503, {
        error:
          "Zero MCP layer bridge is not configured. Set ZERO_MCP_LAYER_COMMAND to a command that prints ZeroLayerSnapshot JSON."
      });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as { nodeId?: unknown };
      const nodeId = typeof parsed.nodeId === "string" ? parsed.nodeId.trim() : "";
      if (!nodeId) {
        writeJson(res, 400, { error: "nodeId is required." });
        return;
      }
      const args = argsForNode(options.layerArgs, nodeId);
      const snapshot = rewriteAssetUrls(await runLayerCommand(command, args, timeoutMs), requestOrigin(req));
      writeJson(res, 200, {
        snapshot,
        source: sourceForBridge(command, args),
        bridge: [command, ...args].join(" ")
      });
    } catch (error) {
      writeJson(res, 400, {
        error: error instanceof Error ? error.message : "Zero layer snapshot failed."
      });
    }
  };
}
