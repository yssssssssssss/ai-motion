import type { MotionManifest } from "@motion-tool/core";

export const LARGE_ASSET_BYTES = 512 * 1024;
export const INLINE_SOURCE_BUDGET_BYTES = 512 * 1024;
export const ENTRY_CHUNK_BUDGET_BYTES = 2 * 1024 * 1024;
export const DATA_URL_BUDGET_BYTES = 512 * 1024;
export const EXTERNALIZED_BUILTIN_SOURCE_FILES = [
  "../jd-horizontal-switch/source/assets.css",
  "../jd-product-transition-video/source/assets.css"
] as const;

export const EXTERNALIZED_BUILTIN_RAW_EXCLUDES = EXTERNALIZED_BUILTIN_SOURCE_FILES.map(
  (filePath) => `!${filePath}`
);

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isManifestTargetFile(manifest: MotionManifest, filePath: string): boolean {
  return manifest.params.some((param) =>
    param.targets.some((target) => "file" in target && target.file === filePath)
  );
}

export function shouldExternalizeBuiltinSourceFile(input: {
  content: string;
  filePath: string;
  manifest: MotionManifest;
  thresholdBytes?: number;
}): boolean {
  const threshold = input.thresholdBytes ?? LARGE_ASSET_BYTES;
  if (!input.filePath.startsWith("source/")) return false;
  if (isManifestTargetFile(input.manifest, input.filePath)) return false;
  return utf8ByteLength(input.content) >= threshold;
}
