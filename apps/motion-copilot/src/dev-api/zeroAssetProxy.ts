type ZeroAssetRequest = {
  method?: string | undefined;
  url?: string | undefined;
};

type ZeroAssetResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string | Uint8Array): void;
};

export type ZeroAssetProxyOptions = {
  allowedOrigins?: string[] | undefined;
  maxResponseBytes?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
};

const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_CONTENT_TYPES = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]);

class AssetProxyError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function writeText(res: ZeroAssetResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}

function normalizedOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function allowedOrigins(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map(normalizedOrigin).filter((origin): origin is string => Boolean(origin)));
}

function responseByteLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || value == null || value <= 0) return DEFAULT_MAX_RESPONSE_BYTES;
  return Math.max(1, Math.floor(value));
}

function contentTypeFor(response: Response): string | undefined {
  const value = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return value && SUPPORTED_CONTENT_TYPES.has(value) ? value : undefined;
}

function contentLength(response: Response): number | undefined {
  const header = response.headers.get("content-length");
  if (header == null) return undefined;
  const value = Number(header);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function readAssetBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = contentLength(response);
  if (declaredLength != null && declaredLength > maxBytes) {
    throw new AssetProxyError(413, "Zero asset response is too large");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > maxBytes) throw new AssetProxyError(413, "Zero asset response is too large");
    return body;
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AssetProxyError(413, "Zero asset response is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createZeroAssetProxyHandler(options: ZeroAssetProxyOptions = {}) {
  const origins = allowedOrigins(options.allowedOrigins);
  const maxResponseBytes = responseByteLimit(options.maxResponseBytes);
  const fetchImpl = options.fetchImpl ?? fetch;

  return async function zeroAssetProxyHandler(req: ZeroAssetRequest, res: ZeroAssetResponse): Promise<void> {
    if (req.method !== "GET" && req.method !== "HEAD") {
      writeText(res, 405, "Method not allowed");
      return;
    }

    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
    const source = requestUrl.searchParams.get("url") ?? "";
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(source);
    } catch {
      writeText(res, 400, "Invalid Zero asset url");
      return;
    }

    if (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:") {
      writeText(res, 400, "Unsupported Zero asset protocol");
      return;
    }
    if (!origins.has(sourceUrl.origin)) {
      writeText(res, 403, "Zero asset origin is not allowed");
      return;
    }

    try {
      const upstream = await fetchImpl(sourceUrl.href, { redirect: "manual" });
      if (upstream.status >= 300 && upstream.status < 400) {
        writeText(res, 502, "Zero asset redirects are not allowed");
        return;
      }
      if (!upstream.ok) {
        writeText(res, upstream.status, `Zero asset request failed: ${upstream.status}`);
        return;
      }

      const contentType = contentTypeFor(upstream);
      if (!contentType) {
        writeText(res, 415, "Unsupported Zero asset content type");
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(await readAssetBody(upstream, maxResponseBytes));
    } catch (error) {
      if (error instanceof AssetProxyError) {
        writeText(res, error.statusCode, error.message);
        return;
      }
      writeText(res, 502, error instanceof Error ? error.message : "Zero asset proxy failed");
    }
  };
}
