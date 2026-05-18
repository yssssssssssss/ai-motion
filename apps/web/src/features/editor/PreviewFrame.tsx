import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { renderPreviewHtml } from "./previewHtml";

type Props = {
  source: MotionSource | null;
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
};

export function PreviewFrame({ source, manifest, patch }: Props) {
  if (!source || !manifest || !patch) {
    return <div className="preview-empty">请选择或导入一个动效源。</div>;
  }

  const html = renderPreviewHtml({ source, manifest, patch });

  return <iframe title="动效预览" sandbox="allow-scripts" srcDoc={html} className="preview-frame" />;
}
