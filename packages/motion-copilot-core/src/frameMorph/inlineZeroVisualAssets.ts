import type { ZeroVisualSnapshot } from "./schema";

export type AssetFetcher = (url: string) => Promise<{ data: Uint8Array; mime: string }>;

export type InlineZeroVisualAssetsResult = {
  snapshot: ZeroVisualSnapshot;
  errors: Array<{ url: string; reason: string }>;
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  return "application/octet-stream";
}

const defaultFetcher: AssetFetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || mimeFromUrl(url);
  const buffer = await response.arrayBuffer();
  return { data: new Uint8Array(buffer), mime };
};

export async function inlineZeroVisualAssets(
  snapshot: ZeroVisualSnapshot,
  fetcher: AssetFetcher = defaultFetcher
): Promise<InlineZeroVisualAssetsResult> {
  const errors: InlineZeroVisualAssetsResult["errors"] = [];
  let html = snapshot.html;
  const assets = [...snapshot.assets];

  const results = await Promise.allSettled(
    assets.map(async (asset, index) => {
      if (asset.url.startsWith("data:")) return { index, dataUrl: asset.url };
      try {
        const { data, mime } = await fetcher(asset.url);
        const dataUrl = `data:${mime};base64,${uint8ToBase64(data)}`;
        return { index, dataUrl };
      } catch (error) {
        errors.push({ url: asset.url, reason: error instanceof Error ? error.message : String(error) });
        return { index, dataUrl: null };
      }
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value.dataUrl) continue;
    const { index, dataUrl } = result.value;
    const originalUrl = assets[index]!.url;
    if (originalUrl.startsWith("data:")) continue;
    html = html.replaceAll(originalUrl, dataUrl);
    assets[index] = { ...assets[index]!, url: dataUrl };
  }

  return {
    snapshot: { ...snapshot, html, assets },
    errors
  };
}
