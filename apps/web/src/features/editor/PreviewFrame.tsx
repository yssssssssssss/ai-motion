import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { renderPreviewHtml } from "./previewHtml";

type Props = {
  source: MotionSource | null;
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
};

export function PreviewFrame({ source, manifest, patch }: Props) {
  if (!source || !manifest || !patch) {
    return <div className="preview-empty">Select or import a motion source.</div>;
  }

  const html = renderPreviewHtml({ source, manifest, patch });

  return <iframe title="Motion preview" sandbox="allow-scripts" srcDoc={html} className="preview-frame" />;
}
