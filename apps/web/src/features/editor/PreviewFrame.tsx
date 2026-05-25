import { useMemo } from "react";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { renderPreviewHtml } from "./previewHtml";

type Props = {
  source: MotionSource | null;
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
};

export function PreviewFrame({ source, manifest, patch }: Props) {
  // 仅当 source / manifest / patch.values 真的变化时才重新生成 srcDoc
  // 避免 React 父组件无关 re-render 导致 iframe 重载、动画从头播放
  const html = useMemo(() => {
    if (!source || !manifest || !patch) return null;
    return renderPreviewHtml({ source, manifest, patch, mode: "editor" });
  }, [source, manifest, patch]);

  if (!html) {
    return <div className="preview-empty">请选择或导入一个动效源。</div>;
  }

  return <iframe title="动效预览" sandbox="allow-scripts" srcDoc={html} className="preview-frame" />;
}
