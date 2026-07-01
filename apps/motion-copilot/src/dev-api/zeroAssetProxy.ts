type ZeroAssetRequest = {
  method?: string | undefined;
  url?: string | undefined;
};

type ZeroAssetResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string | Uint8Array): void;
};

function writeText(res: ZeroAssetResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(body);
}

function contentTypeFor(url: URL, response: Response): string {
  const upstream = response.headers.get("content-type");
  if (upstream) return upstream;
  if (url.pathname.endsWith(".svg")) return "image/svg+xml";
  if (url.pathname.endsWith(".png")) return "image/png";
  if (url.pathname.endsWith(".webp")) return "image/webp";
  if (url.pathname.endsWith(".jpg") || url.pathname.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export function createZeroAssetProxyHandler(fetchImpl: typeof fetch = fetch) {
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

    try {
      const upstream = await fetchImpl(sourceUrl.href);
      if (!upstream.ok) {
        writeText(res, upstream.status, `Zero asset request failed: ${upstream.status}`);
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", contentTypeFor(sourceUrl, upstream));
      res.setHeader("Cache-Control", "public, max-age=300");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(new Uint8Array(await upstream.arrayBuffer()));
    } catch (error) {
      writeText(res, 502, error instanceof Error ? error.message : "Zero asset proxy failed");
    }
  };
}
