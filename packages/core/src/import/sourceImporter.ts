import type { MotionSource, SourceFile } from "../library/componentLibrary";

export type ImportWarning = {
  code: "missing-entry" | "unsupported-file" | "unsafe-content" | "sub-directory-entry";
  message: string;
};

export type ImportResult = {
  source: MotionSource;
  warnings: ImportWarning[];
};

function fileKind(path: string): SourceFile["kind"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}

// 安全校验：扫描上传源中的高风险内容，返回警告列表
function scanUnsafeContent(files: Record<string, string>): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".html") && !path.endsWith(".js")) continue;
    const lower = content.toLowerCase();

    // 检测外域脚本引用
    const externalScriptPattern = /<script[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>/gi;
    for (const match of content.matchAll(externalScriptPattern)) {
      const src = match[0].match(/src=["']([^"']+)["']/)?.[1] ?? "";
      warnings.push({
        code: "unsafe-content",
        message: `${path}: 外域脚本引用已移除 — ${src}`
      });
    }

    // 检测 document.cookie 访问
    if (lower.includes("document.cookie")) {
      warnings.push({
        code: "unsafe-content",
        message: `${path}: 包含 document.cookie 访问，将在预览中拦截`
      });
    }

    // 检测 eval / new Function
    if (/\beval\s*\(/.test(lower) || /\bnew\s+Function\s*\(/.test(lower)) {
      warnings.push({
        code: "unsafe-content",
        message: `${path}: 包含 eval/new Function 调用，将在预览中拦截`
      });
    }
  }

  return warnings;
}

// 移除上传源中的外域 script 标签，降低 XSS 风险
function sanitizeHtml(html: string): string {
  return html.replace(/<script[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>/gi, "");
}

// 查找 HTML 入口：优先根目录 index.html，其次根目录任意 .html，再搜索子目录
function findEntry(paths: string[]): { entry: string; isSubDirectory: boolean } | null {
  // 根目录 index.html
  const rootIndex = paths.find((p) => p === "index.html");
  if (rootIndex) return { entry: rootIndex, isSubDirectory: false };

  // 根目录任意 .html
  const rootHtml = paths.find((p) => !p.includes("/") && p.endsWith(".html"));
  if (rootHtml) return { entry: rootHtml, isSubDirectory: false };

  // 子目录中的 index.html（优先更浅的目录）
  const subdirIndexes = paths
    .filter((p) => p.endsWith("/index.html") || p.includes("/index.html"))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  if (subdirIndexes.length > 0) return { entry: subdirIndexes[0]!, isSubDirectory: true };

  // 子目录中任意 .html
  const subdirHtmls = paths
    .filter((p) => p.includes("/") && p.endsWith(".html"))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  if (subdirHtmls.length > 0) return { entry: subdirHtmls[0]!, isSubDirectory: true };

  return null;
}

export function importMotionSourceFromFiles(files: Record<string, string>): ImportResult {
  const paths = Object.keys(files);
  const warnings: ImportWarning[] = [...scanUnsafeContent(files)];

  const entryResult = findEntry(paths);
  if (!entryResult) {
    warnings.push({ code: "missing-entry", message: "未找到 HTML 入口文件" });
  } else if (entryResult.isSubDirectory) {
    warnings.push({
      code: "sub-directory-entry",
      message: `入口文件位于子目录：${entryResult.entry}`
    });
  }

  const entry = entryResult?.entry ?? paths[0] ?? "";

  const hasCssOrJs = paths.some((path) => path.endsWith(".css") || path.endsWith(".js"));
  const hasSvgOnly =
    paths.length > 0 && paths.every((path) => path.endsWith(".svg") || path.endsWith(".css"));
  const kind = hasSvgOnly ? "css-svg" : hasCssOrJs ? "html-package" : "single-html";

  // 对 HTML 文件执行安全清理（移除外域 script）
  const sanitizedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    sanitizedFiles[path] = path.endsWith(".html") ? sanitizeHtml(content) : content;
  }

  return {
    warnings,
    source: {
      id: "imported-source",
      origin: "imported",
      kind,
      files: paths.map((path) => ({ path, content: sanitizedFiles[path] ?? "", kind: fileKind(path) })),
      entry
    }
  };
}
