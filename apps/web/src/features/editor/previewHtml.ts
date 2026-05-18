import { applyPatchToFiles, type MotionManifest, type MotionPatch, type MotionSource } from "@motion-tool/core";

type RenderPreviewInput = {
  source: MotionSource;
  manifest: MotionManifest;
  patch: MotionPatch;
  mode?: "full" | "thumbnail";
};

const THUMBNAIL_STYLE = `<style data-motion-preview="thumbnail">
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 12px;
  box-sizing: border-box;
}

body > * {
  width: fit-content;
  max-width: 100%;
  max-height: 100%;
}
</style>`;

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

function addThumbnailLayout(html: string): string {
  if (/<\/head\s*>/i.test(html)) {
    return html.replace(/<\/head\s*>/i, `${THUMBNAIL_STYLE}</head>`);
  }

  return `${THUMBNAIL_STYLE}${html}`;
}

export function renderPreviewHtml({ source, manifest, patch, mode = "full" }: RenderPreviewInput): string {
  const files = Object.fromEntries(source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({ files, manifest, patch });
  const html = inlineLocalAssets(patchedFiles[source.entry] ?? "", patchedFiles);
  return mode === "thumbnail" ? addThumbnailLayout(html) : html;
}
