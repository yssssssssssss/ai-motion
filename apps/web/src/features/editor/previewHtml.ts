import { applyPatchToFiles, type MotionManifest, type MotionPatch, type MotionSource } from "@motion-tool/core";

type RenderPreviewInput = {
  source: MotionSource;
  manifest: MotionManifest;
  patch: MotionPatch;
};

function inlineLocalAssets(html: string, files: Record<string, string>): string {
  return html
    .replace(/<link\b[^>]*>/g, (tag) => {
      if (!/\brel=["']stylesheet["']/.test(tag)) return tag;

      const href = tag.match(/\bhref=["']\.?\/?([^"']+)["']/)?.[1];
      if (!href) return tag;

      const content = files[`source/${href}`] ?? files[href] ?? "";
      return `<style>${content}</style>`;
    })
    .replace(/<script\b[^>]*\bsrc=["']\.?\/?([^"']+)["'][^>]*><\/script>/g, (_match, src: string) => {
      const content = files[`source/${src}`] ?? files[src] ?? "";
      return `<script>${content}</script>`;
    });
}

export function renderPreviewHtml({ source, manifest, patch }: RenderPreviewInput): string {
  const files = Object.fromEntries(source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({ files, manifest, patch });
  return inlineLocalAssets(patchedFiles[source.entry] ?? "", patchedFiles);
}
