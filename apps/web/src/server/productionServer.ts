import { createReadStream, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createControlledGenerationHandler } from "../dev-api/controlledGenerationRoute";
import {
  createReferenceGuidedGenerationHandler,
  type CreateReferenceGuidedGenerationHandlerInput
} from "../dev-api/referenceGuidedGenerationRoute";
import { createVideoAnalyzeHandler, type CreateVideoAnalyzeHandlerInput } from "../dev-api/videoAnalyzeRoute";

type ProductionServerInput = {
  distDir: string;
  analyze?: CreateVideoAnalyzeHandlerInput["analyze"];
  generation?: CreateReferenceGuidedGenerationHandlerInput;
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function requestPath(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return decodeURIComponent(url.pathname);
}

function sendFile(res: ServerResponse, filePath: string) {
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function handleApiRequest(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  req: IncomingMessage,
  res: ServerResponse
) {
  handler(req, res).catch((error: unknown) => {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "API request failed."
    });
  });
}

function distFile(distDir: string, pathName: string): string | undefined {
  const normalizedPath = normalize(pathName).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = resolve(distDir, `.${sep}${normalizedPath}`);
  const root = resolve(distDir);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return undefined;
  try {
    return statSync(filePath).isFile() ? filePath : undefined;
  } catch {
    return undefined;
  }
}

export function createProductionServer(input: ProductionServerInput) {
  const distDir = resolve(input.distDir);
  const indexPath = join(distDir, "index.html");
  const videoAnalyzeHandler = createVideoAnalyzeHandler(input.analyze ? { analyze: input.analyze } : {});
  const controlledGenerationHandler = createControlledGenerationHandler();
  const referenceGuidedGenerationHandler = createReferenceGuidedGenerationHandler(input.generation);

  return createServer((req, res) => {
    const pathName = requestPath(req);

    if (pathName === "/api/video/analyze") {
      handleApiRequest(videoAnalyzeHandler, req, res);
      return;
    }

    if (pathName === "/api/generation/controlled") {
      handleApiRequest(controlledGenerationHandler, req, res);
      return;
    }

    if (pathName === "/api/generation/reference-guided") {
      handleApiRequest(referenceGuidedGenerationHandler, req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }

    const staticFile = distFile(distDir, pathName);
    sendFile(res, staticFile ?? indexPath);
  });
}
