import { execFile } from "node:child_process";
import { normalizeFrameSnapshot, type FrameSnapshot } from "@motion-copilot/core";

type ZeroFrameRequest = {
  method?: string | undefined;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
};

type ZeroFrameResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

type ZeroFrameInput = {
  nodeId?: unknown;
};

export type ZeroFrameSnapshotOptions = {
  snapshotCommand?: string | undefined;
  snapshotArgs?: string[] | undefined;
  maxBodyBytes?: number;
  timeoutMs?: number;
};

const DEFAULT_MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

function readBody(req: ZeroFrameRequest, maxBytes: number): Promise<string> {
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

function writeJson(res: ZeroFrameResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function argsForNode(template: string[] | undefined, nodeId: string): string[] {
  const args = template && template.length > 0 ? template : ["--node-id", "{nodeId}"];
  return args.map((item) => item.replaceAll("{nodeId}", nodeId));
}

function runSnapshotCommand(command: string, args: string[], timeoutMs: number): Promise<FrameSnapshot> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolve(normalizeFrameSnapshot(JSON.parse(stdout) as unknown));
      } catch (parseError) {
        reject(parseError instanceof Error ? parseError : new Error("Zero snapshot output is invalid."));
      }
    });
  });
}

export function createZeroFrameSnapshotHandler(options: ZeroFrameSnapshotOptions = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function zeroFrameSnapshotHandler(
    req: ZeroFrameRequest,
    res: ZeroFrameResponse
  ): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const command = options.snapshotCommand?.trim();
    if (!command) {
      writeJson(res, 503, {
        error:
          "Zero MCP bridge is not configured. Set ZERO_MCP_SNAPSHOT_COMMAND to a command that prints FrameSnapshot JSON."
      });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as ZeroFrameInput;
      const nodeId = typeof parsed.nodeId === "string" ? parsed.nodeId.trim() : "";
      if (!nodeId) {
        writeJson(res, 400, { error: "nodeId is required." });
        return;
      }
      const snapshot = await runSnapshotCommand(
        command,
        argsForNode(options.snapshotArgs, nodeId),
        timeoutMs
      );
      writeJson(res, 200, { snapshot });
    } catch (error) {
      writeJson(res, 400, {
        error: error instanceof Error ? error.message : "Zero frame snapshot failed."
      });
    }
  };
}
