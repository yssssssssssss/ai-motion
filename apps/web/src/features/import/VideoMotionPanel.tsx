import { useRef, useState } from "react";
import type { MotionComponent, UploadedVideoInput } from "@motion-tool/core";
import { createVideoMotionComponentDraft } from "@motion-tool/core";

type Props = {
  onComponentReady: (component: MotionComponent) => void;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("视频文件读取失败"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("视频文件读取失败")));
    reader.readAsDataURL(file);
  });
}

function componentName(file: File): string {
  return file.name.replace(/\.[^.]+$/, "") || "上传视频动效";
}

function isStaticImageInput(file: File): boolean {
  const name = file.name.toLowerCase();
  if (file.type === "image/gif" || name.endsWith(".gif")) return false;
  if (file.type === "image/png" || name.endsWith(".png")) return false;
  return file.type.startsWith("image/");
}

export function loadVideoMetadata(url: string): Promise<{
  width: number;
  height: number;
  durationMs: number;
  posterDataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let isSettled = false;
    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    const captureFrame = () => {
      if (isSettled) return;
      isSettled = true;

      try {
        const width = video.videoWidth || 390;
        const height = video.videoHeight || 844;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
        const posterDataUrl = canvas.toDataURL("image/png");

        cleanup();
        resolve({
          width,
          height,
          durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 1200,
          posterDataUrl
        });
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error("视频首帧提取失败"));
      }
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener(
      "loadedmetadata",
      () => {
        const seekTarget =
          Number.isFinite(video.duration) && video.duration > 0 ? Math.min(video.duration * 0.25, 0.4) : 0;

        if (seekTarget === 0) {
          video.addEventListener("loadeddata", captureFrame, { once: true });
        }
        video.currentTime = seekTarget;
      },
      { once: true }
    );
    video.addEventListener("seeked", captureFrame, { once: true });
    video.addEventListener(
      "error",
      () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(new Error("视频元数据读取失败"));
      },
      { once: true }
    );
    video.src = url;
  });
}

function loadImageMetadata(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener(
      "load",
      () => resolve({ width: image.naturalWidth || 390, height: image.naturalHeight || 844 }),
      { once: true }
    );
    image.addEventListener("error", () => reject(new Error("图片尺寸读取失败")), { once: true });
    image.src = url;
  });
}

type UploadInspection = {
  width?: number;
  height?: number;
  durationMs?: number;
  fps?: number;
  posterDataUrl: string;
  frames?: UploadedVideoInput["frames"];
  contactSheetDataUrl?: string;
  motionHints?: UploadedVideoInput["motionHints"];
};

function isMotionHints(value: unknown): value is NonNullable<UploadedVideoInput["motionHints"]> {
  if (!value || typeof value !== "object") return false;
  const hints = value as Partial<NonNullable<UploadedVideoInput["motionHints"]>>;
  return (
    (hints.direction === "none" ||
      hints.direction === "left" ||
      hints.direction === "right" ||
      hints.direction === "up" ||
      hints.direction === "down") &&
    typeof hints.confidence === "number" &&
    typeof hints.startX === "number" &&
    typeof hints.startY === "number" &&
    typeof hints.endX === "number" &&
    typeof hints.endY === "number"
  );
}

export async function analyzeVideoOnServer(file: File, dataUrl: string): Promise<UploadInspection> {
  const response = await fetch("/api/video/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, dataUrl })
  });

  if (!response.ok) throw new Error("服务端视频解析失败");

  const payload = (await response.json()) as Partial<UploadInspection>;
  if (typeof payload.posterDataUrl !== "string") throw new Error("服务端视频解析结果无效");

  const result: UploadInspection = { posterDataUrl: payload.posterDataUrl };
  if (typeof payload.width === "number") result.width = payload.width;
  if (typeof payload.height === "number") result.height = payload.height;
  if (typeof payload.durationMs === "number") result.durationMs = payload.durationMs;
  if (typeof payload.fps === "number") result.fps = payload.fps;
  if (Array.isArray(payload.frames)) result.frames = payload.frames;
  if (typeof payload.contactSheetDataUrl === "string")
    result.contactSheetDataUrl = payload.contactSheetDataUrl;
  if (isMotionHints(payload.motionHints)) result.motionHints = payload.motionHints;
  return result;
}

export async function inspectUpload(file: File, dataUrl: string): Promise<UploadInspection> {
  if (isStaticImageInput(file)) {
    const image = await loadImageMetadata(dataUrl);

    return {
      width: image.width,
      height: image.height,
      posterDataUrl: dataUrl
    };
  }

  try {
    return await analyzeVideoOnServer(file, dataUrl);
  } catch {
    if (file.type.startsWith("image/")) {
      const image = await loadImageMetadata(dataUrl);

      return {
        width: image.width,
        height: image.height,
        posterDataUrl: dataUrl
      };
    }

    return loadVideoMetadata(dataUrl);
  }
}

export async function createVideoMotionComponentFromFile(file: File): Promise<MotionComponent> {
  const dataUrl = await readAsDataUrl(file);
  const upload = await inspectUpload(file, dataUrl);
  const id = `video-${Date.now()}`;
  const videoInput: UploadedVideoInput = {
    fileName: file.name,
    mimeType: file.type || "video/mp4",
    dataUrl,
    posterDataUrl: upload.posterDataUrl
  };

  if (upload.width !== undefined) videoInput.width = upload.width;
  if (upload.height !== undefined) videoInput.height = upload.height;
  if (upload.durationMs !== undefined) videoInput.durationMs = upload.durationMs;
  if (upload.fps !== undefined) videoInput.fps = upload.fps;
  if (upload.frames !== undefined) videoInput.frames = upload.frames;
  if (upload.contactSheetDataUrl !== undefined) videoInput.contactSheetDataUrl = upload.contactSheetDataUrl;
  if (upload.motionHints !== undefined) videoInput.motionHints = upload.motionHints;

  return createVideoMotionComponentDraft({
    id,
    name: componentName(file),
    video: videoInput
  }).component;
}

export function VideoMotionPanel({ onComponentReady }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("等待上传视频");
  const [isProcessing, setIsProcessing] = useState(false);

  async function processVideo(file: File | undefined) {
    if (!file) return;

    setIsProcessing(true);
    setStatus("正在读取视频并生成首版代码动效...");
    try {
      const component = await createVideoMotionComponentFromFile(file);
      setStatus("代码动效已生成");
      onComponentReady(component);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "视频生成失败");
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="video-motion-panel" aria-label="视频生成动效">
      <div>
        <p className="eyebrow">视频转动效</p>
        <h3>上传视频生成代码组件</h3>
        <p className="muted">
          当前先生成可预览、可调参、可导出的首版代码动效，后续可接入 Worker 与 LLM 精修。
        </p>
      </div>
      <input
        ref={inputRef}
        id="video-motion-file-input"
        className="file-input"
        type="file"
        accept="video/mp4,video/quicktime,video/webm,image/gif,image/png"
        disabled={isProcessing}
        onChange={(event) => void processVideo(event.currentTarget.files?.[0])}
      />
      <label
        className="primary-action file-import-button video-motion-button"
        htmlFor="video-motion-file-input"
      >
        {isProcessing ? "生成中..." : "选择视频"}
      </label>
      <p className="import-summary">{status}</p>
    </section>
  );
}
