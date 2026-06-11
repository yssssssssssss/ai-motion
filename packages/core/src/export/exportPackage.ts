import type { MotionManifest, MotionPatch } from "../manifest/types";
import { applyPatchToFiles } from "../patch/applyPatch";

export function composeEditablePackageFiles(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  metadata: Record<string, unknown>;
  patch: MotionPatch;
}): Record<string, string> {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });

  return {
    ...patchedFiles,
    "motion.manifest.json": JSON.stringify(input.manifest, null, 2),
    "metadata.json": JSON.stringify(input.metadata, null, 2),
    "motion.patch.json": JSON.stringify(input.patch, null, 2)
  };
}

function localAssetPath(path: string): string {
  return path.replace(/^\.?\//, "");
}

function sourceLookupPath(path: string): string {
  const normalized = localAssetPath(path);
  return normalized.startsWith("source/") ? normalized : `source/${normalized}`;
}

export function composeStandaloneHtmlFile(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  patch: MotionPatch;
}): string {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });
  const entry = patchedFiles[input.manifest.runtime.entry] ?? "";

  return entry
    .replace(/<link\b[^>]*>/g, (tag) => {
      if (!/\brel=["']stylesheet["']/.test(tag)) return tag;

      const href = tag.match(/\bhref=["']([^"']+)["']/)?.[1];
      if (!href) return tag;

      const content = patchedFiles[sourceLookupPath(href)] ?? patchedFiles[localAssetPath(href)];
      return content === undefined ? tag : `<style>\n${content}\n</style>`;
    })
    .replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g, (tag, src: string) => {
      const content = patchedFiles[sourceLookupPath(src)] ?? patchedFiles[localAssetPath(src)];
      return content === undefined ? tag : `<script>${content}</script>`;
    });
}
