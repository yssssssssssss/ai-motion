import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";
import { renderPreviewHtml, shouldPreviewAutoplay } from "./previewHtml";

export type PreviewPlaybackState = "playing" | "paused";
export { shouldPreviewAutoplay };

type Props = {
  source: MotionSource | null;
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  playbackState: PreviewPlaybackState;
  replayToken?: number;
  resetToken?: number;
};

export function previewPatchValues(manifest: MotionManifest, patch: MotionPatch): MotionPatch["values"] {
  return Object.fromEntries(
    manifest.params.map((param) => [param.id, patch.values[param.id] ?? param.default])
  );
}

function imagePatchValues(manifest: MotionManifest, patch: MotionPatch | null): MotionPatch["values"] {
  if (!patch) return {};
  return Object.fromEntries(
    manifest.params
      .filter((param) => param.type === "image" && param.id in patch.values)
      .map((param) => [param.id, patch.values[param.id]])
  );
}

export function PreviewFrame({
  source,
  manifest,
  patch,
  playbackState,
  replayToken = 0,
  resetToken = 0
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastReplayTokenRef = useRef(replayToken);
  const lastResetTokenRef = useRef(resetToken);
  // 参数变化通过 postMessage 送进 iframe，srcDoc 只随源码/manifest 改变。
  // 这样拖动滑杆时不会重载 iframe，也就不会出现白屏闪烁。
  const html = useMemo(() => {
    if (!source || !manifest) return null;
    return renderPreviewHtml({
      source,
      manifest,
      patch: {
        id: `${manifest.id}-preview-base`,
        sourceManifestId: manifest.id,
        values: imagePatchValues(manifest, patch)
      },
      mode: "editor"
    });
  }, [source, manifest, patch]);

  const postPlaybackState = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "motion-preview:playback",
        action: playbackState === "playing" ? "play" : "pause"
      },
      "*"
    );
  }, [playbackState]);

  const postReplay = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "motion-preview:playback",
        action: "replay"
      },
      "*"
    );
  }, []);

  const postReset = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "motion-preview:reset"
      },
      "*"
    );
  }, []);

  const postPatch = useCallback(() => {
    if (!manifest || !patch) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "motion-preview:patch",
        values: previewPatchValues(manifest, patch),
        params: manifest.params
      },
      "*"
    );
  }, [manifest, patch]);

  useEffect(() => {
    if (shouldPreviewAutoplay(manifest)) postPlaybackState();
    else postReset();
  }, [manifest, postPlaybackState, postReset]);

  useEffect(() => {
    postPatch();
  }, [postPatch]);

  useEffect(() => {
    if (lastReplayTokenRef.current === replayToken) return;
    lastReplayTokenRef.current = replayToken;
    postReplay();
  }, [postReplay, replayToken]);

  useEffect(() => {
    if (lastResetTokenRef.current === resetToken) return;
    lastResetTokenRef.current = resetToken;
    postReset();
  }, [postReset, resetToken]);

  if (!html) {
    return <div className="preview-empty">请选择或导入一个动效源。</div>;
  }

  return (
    <iframe
      ref={iframeRef}
      title="动效预览"
      sandbox="allow-scripts"
      srcDoc={html}
      className="preview-frame"
      onLoad={() => {
        postPatch();
        if (shouldPreviewAutoplay(manifest)) postPlaybackState();
        else postReset();
      }}
    />
  );
}
