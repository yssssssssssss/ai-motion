import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";

type Props = {
  onImport: (files: Record<string, string>) => void;
  disabled?: boolean;
  compact?: boolean;
};

export type SourceUploadReadResult = {
  files: Record<string, string>;
  summary: string;
};

// 从 zip 包解压所有文件为 path→content 映射
async function extractZip(file: File): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(file);
  const entries: Record<string, string> = {};

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    // 跳过隐藏文件和 macOS 元数据
    const segments = relativePath.split("/");
    if (segments.some((seg) => seg.startsWith(".") || seg === "__MACOSX")) continue;
    entries[relativePath] = await zipEntry.async("string");
  }

  return entries;
}

export async function readSourceUploadFiles(fileList: FileList | File[]): Promise<SourceUploadReadResult> {
  const files = Array.from(fileList);
  const singleFile = files[0];

  if (files.length === 1 && singleFile?.name.endsWith(".zip")) {
    const extracted = await extractZip(singleFile);
    const count = Object.keys(extracted).length;
    return { files: extracted, summary: `已解压 ${singleFile.name}（${count} 个文件）` };
  }

  const entries: Record<string, string> = {};
  for (const file of files) {
    entries[file.name] = await file.text();
  }
  const exts = new Set(Object.keys(entries).map((p) => p.split(".").pop() ?? ""));
  return {
    files: entries,
    summary: `已加载 ${Object.keys(entries).length} 个文件（${[...exts].join(", ")}）`
  };
}

export function ImportPanel({ onImport, disabled, compact = false }: Props) {
  const inputId = "motion-source-file-input";
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileSummary, setFileSummary] = useState<string | null>(null);

  const processFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      setIsProcessing(true);
      try {
        const result = await readSourceUploadFiles(fileList);
        setFileSummary(result.summary);
        onImport(result.files);
      } finally {
        setIsProcessing(false);
        // 清空 input 以便重复上传同名文件
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onImport]
  );

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    void processFiles(event.dataTransfer.files);
  }

  return (
    <section
      className={compact ? "import-panel" : "tool-section"}
      id={compact ? undefined : "import"}
      aria-label={compact ? "上传案例" : undefined}
    >
      {!compact && <h2>上传案例</h2>}
      <div
        className={isDragging ? "import-drop-zone is-dragging" : "import-drop-zone"}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="import-drop-hint">
          拖拽文件到此处，或点击选择
          <br />
          <small>支持 HTML / CSS / JS / JSON / SVG / ZIP 包</small>
        </p>
        <input
          ref={inputRef}
          id={inputId}
          className="file-input"
          type="file"
          multiple
          accept=".html,.css,.js,.json,.svg,.zip"
          disabled={disabled || isProcessing}
          onChange={(event) => void processFiles(event.target.files)}
        />
        <label className="secondary-action file-import-button" htmlFor={inputId}>
          {isProcessing ? "处理中…" : "选择文件"}
        </label>
      </div>
      {fileSummary && <p className="import-summary">{fileSummary}</p>}
    </section>
  );
}
