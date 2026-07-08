import { execFile } from "node:child_process";
import type { ZeroLayerFramePairDiscovery } from "@motion-copilot/core";

type ZeroLayerFramePairRequest = {
  method?: string | undefined;
};

type ZeroLayerFramePairResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

export type ZeroLayerFramePairOptions = {
  discoveryCommand?: string | undefined;
  discoveryArgs?: string[] | undefined;
  commandEnv?: Record<string, string | undefined> | undefined;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function writeJson(res: ZeroLayerFramePairResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function normalizeDiscovery(input: unknown): ZeroLayerFramePairDiscovery {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Zero frame pair discovery output must be an object.");
  }
  const value = input as Partial<ZeroLayerFramePairDiscovery>;
  if (value.schemaVersion !== "motion-copilot.zero-layer-frame-pair-discovery.v1") {
    throw new Error("Zero frame pair discovery output has an invalid schemaVersion.");
  }
  if (!Array.isArray(value.pages) || !Array.isArray(value.candidates) || !Array.isArray(value.pairs)) {
    throw new Error("Zero frame pair discovery output must include pages, candidates, and pairs.");
  }
  return {
    schemaVersion: "motion-copilot.zero-layer-frame-pair-discovery.v1",
    pages: value.pages,
    candidates: value.candidates,
    pairs: value.pairs
  };
}

function runDiscoveryCommand(
  command: string,
  args: string[],
  timeoutMs: number,
  commandEnv: Record<string, string | undefined> | undefined
): Promise<ZeroLayerFramePairDiscovery> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, ...commandEnv } },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }
        try {
          resolve(normalizeDiscovery(JSON.parse(stdout) as unknown));
        } catch (parseError) {
          reject(parseError instanceof Error ? parseError : new Error("Zero frame pair discovery failed."));
        }
      }
    );
  });
}

function sourceForBridge(
  command: string,
  args: string[],
  commandEnv: Record<string, string | undefined> | undefined
) {
  const bridgeText = [command, ...args].join(" ");
  if (
    bridgeText.includes("zero-mcp-layer-bridge") &&
    (commandEnv?.ZERO_MCP_HTTP_URL || process.env.ZERO_MCP_HTTP_URL)
  ) {
    return "real-zero-mcp-http";
  }
  if (bridgeText.includes("zero-mcp-layer-bridge")) return "zero-layer-bridge";
  return "custom-command";
}

export function createZeroLayerFramePairHandler(options: ZeroLayerFramePairOptions = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function zeroLayerFramePairHandler(
    req: ZeroLayerFramePairRequest,
    res: ZeroLayerFramePairResponse
  ): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const command = options.discoveryCommand?.trim();
    if (!command) {
      writeJson(res, 503, {
        error: "Zero MCP frame pair discovery is not configured."
      });
      return;
    }

    try {
      const args = options.discoveryArgs ?? ["--discover-frame-pairs"];
      const discovery = await runDiscoveryCommand(command, args, timeoutMs, options.commandEnv);
      writeJson(res, 200, {
        discovery,
        source: sourceForBridge(command, args, options.commandEnv),
        bridge: [command, ...args].join(" ")
      });
    } catch (error) {
      writeJson(res, 400, {
        error: error instanceof Error ? error.message : "Zero frame pair discovery failed."
      });
    }
  };
}
