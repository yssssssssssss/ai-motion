import type { MotionSource, SourceFile } from "../library/componentLibrary";

export type ImportWarning = {
  code: "missing-entry" | "unsupported-file";
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

export function importMotionSourceFromFiles(files: Record<string, string>): ImportResult {
  const paths = Object.keys(files);
  const htmlFiles = paths.filter((path) => path.endsWith(".html"));
  const entry = htmlFiles.includes("index.html") ? "index.html" : htmlFiles[0];
  const warnings: ImportWarning[] = [];

  if (!entry) {
    warnings.push({ code: "missing-entry", message: "No HTML entry file was found." });
  }

  const hasCssOrJs = paths.some((path) => path.endsWith(".css") || path.endsWith(".js"));
  const hasSvgOnly = paths.length > 0 && paths.every((path) => path.endsWith(".svg") || path.endsWith(".css"));
  const kind = hasSvgOnly ? "css-svg" : hasCssOrJs ? "html-package" : "single-html";

  return {
    warnings,
    source: {
      id: "imported-source",
      origin: "imported",
      kind,
      files: paths.map((path) => ({ path, content: files[path] ?? "", kind: fileKind(path) })),
      entry: entry ?? paths[0] ?? ""
    }
  };
}
