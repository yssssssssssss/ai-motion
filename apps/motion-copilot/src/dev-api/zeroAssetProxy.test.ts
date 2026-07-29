import { describe, expect, it, vi } from "vitest";
import { createZeroAssetProxyHandler, type ZeroAssetProxyOptions } from "./zeroAssetProxy";

type AssetProxyResult = {
  statusCode: number;
  headers: Map<string, string>;
  body: string | Uint8Array | undefined;
};

function requestUrl(source: string): string {
  return `/api/zero/asset?url=${encodeURIComponent(source)}`;
}

async function requestAsset(options: ZeroAssetProxyOptions, method: "GET" | "HEAD", source: string) {
  const result: AssetProxyResult = {
    statusCode: 0,
    headers: new Map(),
    body: undefined
  };
  await createZeroAssetProxyHandler(options)(
    { method, url: requestUrl(source) },
    {
      get statusCode() {
        return result.statusCode;
      },
      set statusCode(value: number) {
        result.statusCode = value;
      },
      setHeader(name: string, value: string) {
        result.headers.set(name.toLowerCase(), value);
      },
      end(body?: string | Uint8Array) {
        result.body = body;
      }
    }
  );
  return result;
}

function imageResponse(body = "<svg></svg>", headers: HeadersInit = {}): Response {
  return new Response(body, { headers: { "content-type": "image/svg+xml", ...headers } });
}

describe("createZeroAssetProxyHandler", () => {
  const allowedAsset = "http://127.0.0.1:27618/assets/card.svg";

  it("proxies an allowed image without following redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(imageResponse());

    const result = await requestAsset({ allowedOrigins: [allowedAsset], fetchImpl }, "GET", allowedAsset);

    expect(result.statusCode).toBe(200);
    expect(result.headers.get("content-type")).toBe("image/svg+xml");
    expect(new TextDecoder().decode(result.body as Uint8Array)).toBe("<svg></svg>");
    expect(fetchImpl).toHaveBeenCalledWith(allowedAsset, { redirect: "manual" });
  });

  it("rejects an origin that has not been explicitly allowed", async () => {
    const fetchImpl = vi.fn();

    const result = await requestAsset(
      { allowedOrigins: [allowedAsset], fetchImpl },
      "GET",
      "http://169.254.169.254/latest/meta-data"
    );

    expect(result.statusCode).toBe(403);
    expect(result.body).toBe("Zero asset origin is not allowed");
    expect(fetchImpl).not.toHaveBeenCalled();

    const defaultResult = await requestAsset({ fetchImpl }, "GET", allowedAsset);
    expect(defaultResult.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects redirects and unsupported content types", async () => {
    const redirectFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: "https://example.test/card.svg" } })
      );
    const redirect = await requestAsset(
      { allowedOrigins: [allowedAsset], fetchImpl: redirectFetch },
      "GET",
      allowedAsset
    );
    expect(redirect.statusCode).toBe(502);
    expect(redirect.body).toBe("Zero asset redirects are not allowed");

    const htmlFetch = vi
      .fn()
      .mockResolvedValue(new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    const unsupported = await requestAsset(
      { allowedOrigins: [allowedAsset], fetchImpl: htmlFetch },
      "GET",
      allowedAsset
    );
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.body).toBe("Unsupported Zero asset content type");
  });

  it("rejects both declared and streamed bodies that exceed the configured limit", async () => {
    const declaredFetch = vi.fn().mockResolvedValue(imageResponse("tiny", { "content-length": "5" }));
    const declared = await requestAsset(
      { allowedOrigins: [allowedAsset], maxResponseBytes: 4, fetchImpl: declaredFetch },
      "GET",
      allowedAsset
    );
    expect(declared.statusCode).toBe(413);

    const streamedFetch = vi.fn().mockResolvedValue(imageResponse("12345"));
    const streamed = await requestAsset(
      { allowedOrigins: [allowedAsset], maxResponseBytes: 4, fetchImpl: streamedFetch },
      "GET",
      allowedAsset
    );
    expect(streamed.statusCode).toBe(413);

    const tooLargeForDefaultLimit = "x".repeat(5 * 1024 * 1024 + 1);
    const invalidLimitFetch = vi.fn().mockResolvedValue(imageResponse(tooLargeForDefaultLimit));
    const invalidLimit = await requestAsset(
      {
        allowedOrigins: [allowedAsset],
        maxResponseBytes: Number.POSITIVE_INFINITY,
        fetchImpl: invalidLimitFetch
      },
      "GET",
      allowedAsset
    );
    expect(invalidLimit.statusCode).toBe(413);
  });

  it("permits HEAD without reading the response body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(imageResponse());

    const result = await requestAsset({ allowedOrigins: [allowedAsset], fetchImpl }, "HEAD", allowedAsset);

    expect(result.statusCode).toBe(200);
    expect(result.headers.get("content-type")).toBe("image/svg+xml");
    expect(result.body).toBeUndefined();
  });
});
