import { useRef, useState } from "react";
import type { MotionComponent } from "@motion-tool/core";
import { readSourceUploadFiles } from "./ImportPanel";
import { createVideoMotionComponentFromFile } from "./VideoMotionPanel";

type UploadPipeline = "video" | "source";

type Props = {
  onImportFiles: (files: Record<string, string>) => void;
  onVideoComponentReady: (component: MotionComponent) => void;
  disabled?: boolean;
};

export const SUPPORTED_UPLOAD_ACCEPT =
  "video/mp4,video/quicktime,video/webm,image/gif,image/png,.html,.css,.js,.json,.svg,.zip";

const MEDIA_EXTENSIONS = [".mp4", ".mov", ".webm", ".gif", ".png"];
const MEDIA_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "image/gif", "image/png"]);

function hasMediaExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return MEDIA_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isMotionMediaFile(file: File): boolean {
  return MEDIA_MIME_TYPES.has(file.type) || hasMediaExtension(file.name);
}

export function classifyUploadFiles(files: readonly File[]): UploadPipeline {
  if (files.length === 1 && files[0] && isMotionMediaFile(files[0])) return "video";
  return "source";
}

export function UnifiedUploadPanel({ onImportFiles, onVideoComponentReady, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("等待上传文件");

  async function processFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || disabled) return;

    const files = Array.from(fileList);
    setIsProcessing(true);
    try {
      if (classifyUploadFiles(files) === "video") {
        setStatus("正在分析媒体并生成代码组件...");
        const component = await createVideoMotionComponentFromFile(files[0]!);
        setStatus(`已生成 ${component.name}，请确认参数与图层`);
        onVideoComponentReady(component);
      } else {
        setStatus("正在读取源码文件...");
        const result = await readSourceUploadFiles(files);
        setStatus(result.summary);
        onImportFiles(result.files);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传处理失败");
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDragOver(event: React.DragEvent) {
    if (disabled || isProcessing) return;
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent) {
    if (disabled || isProcessing) return;
    event.preventDefault();
    setIsDragging(false);
    void processFiles(event.dataTransfer.files);
  }

  const dropZoneClass = [
    "import-drop-zone",
    isDragging ? "is-dragging" : "",
    disabled || isProcessing ? "is-disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="import-panel unified-upload-panel" aria-label="上传动效案例">
      <div
        className={dropZoneClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="import-drop-hint">
          拖拽或选择动效文件
          <br />
          <small>支持 MP4 / MOV / WebM / GIF / PNG / HTML / CSS / JS / JSON / SVG / ZIP</small>
        </p>
        <input
          ref={inputRef}
          id="unified-motion-file-input"
          className="file-input"
          type="file"
          multiple
          accept={SUPPORTED_UPLOAD_ACCEPT}
          disabled={disabled || isProcessing}
          onChange={(event) => void processFiles(event.currentTarget.files)}
        />
        <label
          className="primary-action file-import-button unified-upload-button"
          htmlFor="unified-motion-file-input"
        >
          {isProcessing ? "处理中..." : "选择文件"}
        </label>
      </div>
      <p className="import-summary">{status}</p>
    </section>
  );
}
