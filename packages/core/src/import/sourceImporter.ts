import type { MotionSource, SourceFile } from "../library/componentLibrary";
import { z } from "zod";
import { motionManifestSchema } from "../manifest/schema";
import type { MotionManifest, MotionPatch } from "../manifest/types";

export type ImportWarning = {
  code: "missing-entry" | "unsupported-file" | "unsafe-content" | "sub-directory-entry" | "ignored-project";
  message: string;
};

export type ImportResult = {
  source: MotionSource;
  warnings: ImportWarning[];
};

export type EditablePackageImport = ImportResult & {
  manifest: MotionManifest;
  metadata: Record<string, unknown>;
  patch: MotionPatch | null;
};

const patchSchema = z.object({
  id: z.string(),
  sourceManifestId: z.string(),
  values: z.record(z.unknown())
});

function parseJson(content: string | undefined): unknown {
  try {
    return JSON.parse(content ?? "");
  } catch {
    return null;
  }
}

function packageManifestPath(files: Record<string, string>): string | undefined {
  return (
    Object.keys(files).find((path) => path === "motion.manifest.json") ??
    Object.keys(files).find((path) => /^[^/]+\/motion\.manifest\.json$/.test(path))
  );
}

function readPackageManifest(
  files: Record<string, string>
): { root: string; manifest: MotionManifest } | null {
  const path = packageManifestPath(files);
  if (!path) return null;
  const result = motionManifestSchema.safeParse(parseJson(files[path]));
  if (!result.success) return null;
  const root = path.slice(0, -"motion.manifest.json".length);
  if (!Object.hasOwn(files, root + result.data.runtime.entry)) return null;
  return { root, manifest: result.data as MotionManifest };
}

export function importEditablePackageFromFiles(files: Record<string, string>): EditablePackageImport | null {
  const project = readPackageManifest(files);
  if (!project) return null;
  const { root, manifest } = project;
  const projectFiles = new Set(["motion.manifest.json", "metadata.json", "motion.patch.json"]);
  const sourceFiles = Object.fromEntries(
    Object.entries(files)
      .filter(([path]) => path.startsWith(root) && !projectFiles.has(path.slice(root.length)))
      .map(([path, content]) => [path.slice(root.length), content])
  );
  const imported = importMotionSourceFromFiles(sourceFiles);
  const patchResult = patchSchema.safeParse(parseJson(files[root + "motion.patch.json"]));
  const patch = patchResult.success ? patchResult.data : null;
  const metadata = parseJson(files[root + "metadata.json"]);
  return {
    ...imported,
    warnings: imported.warnings.filter((warning) => warning.code !== "sub-directory-entry"),
    source: { ...imported.source, kind: manifest.sourceKind, entry: manifest.runtime.entry },
    manifest: {
      ...manifest,
      // 导出的源码已包含补丁，只更新编辑基线。
      params: manifest.params.map((param) =>
        patch && Object.hasOwn(patch.values, param.id)
          ? { ...param, default: patch.values[param.id], value: patch.values[param.id] }
          : param
      )
    },
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    patch
  };
}

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
  if (packageManifestPath(files) && !readPackageManifest(files)) {
    warnings.push({
      code: "ignored-project",
      message: "项目文件已忽略：motion.manifest.json 损坏、格式无效或缺少运行入口，已重新扫描源码"
    });
  }

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
