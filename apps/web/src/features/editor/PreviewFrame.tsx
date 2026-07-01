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
    manifest.params.flatMap((param) => {
      if (param.id in patch.values) return [[param.id, patch.values[param.id]]];
      if (param.type === "image" && !String(param.default ?? "").trim()) return [];
      return [[param.id, param.default]];
    })
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

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function imagePatchSignature(manifest: MotionManifest | null, patch: MotionPatch | null): string {
  if (!manifest || !patch) return "";
  const serializedValues = JSON.stringify(imagePatchValues(manifest, patch));
  return `${serializedValues.length}:${hashString(serializedValues)}`;
}

function postToPreview(iframe: HTMLIFrameElement | null, message: unknown) {
  iframe?.contentWindow?.postMessage(message, "*");
}

function previewSandbox(source: MotionSource): string {
  if (source.origin === "imported") return "allow-scripts";
  return "allow-scripts allow-same-origin";
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
  // 图片参数例外：需要在初始 HTML 中注入，避免大图替换时闪回默认素材。
  const imageValuesKey = useMemo(() => imagePatchSignature(manifest, patch), [manifest, patch]);
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
  }, [source, manifest, imageValuesKey]);
  const iframeKey = `${manifest?.id ?? "empty"}:${imageValuesKey}`;

  const postPlaybackState = useCallback(() => {
    postToPreview(iframeRef.current, {
      type: "motion-preview:playback",
      action: playbackState === "playing" ? "play" : "pause"
    });
  }, [playbackState]);

  const postReplay = useCallback(() => {
    postToPreview(iframeRef.current, {
      type: "motion-preview:playback",
      action: "replay"
    });
  }, []);

  const postReset = useCallback(() => {
    postToPreview(iframeRef.current, {
      type: "motion-preview:reset"
    });
  }, []);

  const postPatch = useCallback(() => {
    if (!manifest || !patch) return;
    postToPreview(iframeRef.current, {
      type: "motion-preview:patch",
      values: previewPatchValues(manifest, patch),
      params: manifest.params
    });
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

  if (!html || !source) {
    return <div className="preview-empty">请选择或导入一个动效源。</div>;
  }

  return (
    <iframe
      key={iframeKey}
      ref={iframeRef}
      title="动效预览"
      sandbox={previewSandbox(source)}
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
