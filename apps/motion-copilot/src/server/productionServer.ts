import { createReadStream, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createGenerateDraftHandler } from "../dev-api/generateDraft";
import { createGenerateConfigHandler } from "../dev-api/generateConfig";
import { createZeroFrameSnapshotHandler, type ZeroFrameSnapshotOptions } from "../dev-api/zeroFrameSnapshot";
import {
  createZeroVisualSnapshotHandler,
  type ZeroVisualSnapshotOptions
} from "../dev-api/zeroVisualSnapshot";
import {
  createZeroLayerSnapshotHandler,
  type ZeroLayerSnapshotOptions
} from "../dev-api/zeroLayerSnapshot";
import { createZeroAssetProxyHandler } from "../dev-api/zeroAssetProxy";

type CopilotModelConfig = Parameters<typeof createGenerateDraftHandler>[0];

type ProductionServerInput = {
  distDir: string;
  modelConfig?: CopilotModelConfig;
  zeroConfig?: ZeroFrameSnapshotOptions;
  zeroVisualConfig?: ZeroVisualSnapshotOptions;
  zeroLayerConfig?: ZeroLayerSnapshotOptions;
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function requestPath(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return decodeURIComponent(url.pathname);
}

function sendFile(res: ServerResponse, filePath: string): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(res);
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

export function createMotionCopilotProductionServer(input: ProductionServerInput) {
  const distDir = resolve(input.distDir);
  const indexPath = join(distDir, "index.html");
  const configHandler = createGenerateConfigHandler(input.modelConfig);
  const generateHandler = createGenerateDraftHandler(input.modelConfig);
  const zeroFrameHandler = createZeroFrameSnapshotHandler(input.zeroConfig);
  const zeroVisualHandler = createZeroVisualSnapshotHandler(input.zeroVisualConfig);
  const zeroLayerHandler = createZeroLayerSnapshotHandler(input.zeroLayerConfig);
  const zeroAssetHandler = createZeroAssetProxyHandler();

  return createServer((req, res) => {
    const pathName = requestPath(req);

    if (pathName === "/api/copilot/config") {
      configHandler(req, res);
      return;
    }

    if (pathName === "/api/copilot/generate") {
      void generateHandler(req, res);
      return;
    }

    if (pathName === "/api/zero/frame-snapshot") {
      void zeroFrameHandler(req, res);
      return;
    }

    if (pathName === "/api/zero/visual-snapshot") {
      void zeroVisualHandler(req, res);
      return;
    }

    if (pathName === "/api/zero/layer-snapshot") {
      void zeroLayerHandler(req, res);
      return;
    }

    if (pathName === "/api/zero/asset") {
      void zeroAssetHandler(req, res);
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
