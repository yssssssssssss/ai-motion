import type { IncomingMessage, ServerResponse } from "node:http";
import { analyzeVideoUpload, type VideoUploadAnalysis } from "./videoAnalyzer";

type AnalyzeInput = {
  fileName: string;
  dataUrl: string;
};

const DEFAULT_MAX_BODY_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

export type CreateVideoAnalyzeHandlerInput = {
  analyze?: (input: AnalyzeInput) => Promise<VideoUploadAnalysis>;
  maxBodyBytes?: number;
  timeoutMs?: number;
};

function readBody(req: IncomingMessage, maxBodyBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Video analysis timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function createVideoAnalyzeHandler(input: CreateVideoAnalyzeHandlerInput = {}) {
  const analyze = input.analyze ?? analyzeVideoUpload;
  const maxBodyBytes = input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function videoAnalyzeHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as { fileName?: unknown; dataUrl?: unknown };
      if (typeof parsed.fileName !== "string" || typeof parsed.dataUrl !== "string") {
        writeJson(res, 400, { error: "fileName and dataUrl are required" });
        return;
      }

      const result = await withTimeout(
        analyze({ fileName: parsed.fileName, dataUrl: parsed.dataUrl }),
        timeoutMs
      );
      writeJson(res, 200, result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("too large")) {
        writeJson(res, 413, { error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("timed out")) {
        writeJson(res, 504, { error: error.message });
        return;
      }

      writeJson(res, 500, {
        error: error instanceof Error ? error.message : "Failed to analyze video."
      });
    }
  };
}
