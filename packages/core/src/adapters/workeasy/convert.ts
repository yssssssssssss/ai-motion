import { scanSourceForParams } from "../../analyze/ruleScanner";
import { confirmValidParams } from "../../analyze/validator";
import type { MotionComponent, MotionComponentMetadata, MotionSource } from "../../library/componentLibrary";
import type { MotionManifest } from "../../manifest/types";
import { localizeWorkEasyCss, localizeWorkEasyHtml } from "./localizeHtml";
import type { WorkEasyConversionInput, WorkEasySkip } from "./types";

type ConvertResult = { ok: true; component: MotionComponent } | { ok: false; skip: WorkEasySkip };

function skip(input: WorkEasyConversionInput, issue: WorkEasySkip["issue"], message: string): ConvertResult {
  return {
    ok: false,
    skip: { id: input.record.id, category: input.category, issue, message }
  };
}

function categoryToMotionCategory(
  category: WorkEasyConversionInput["category"]
): MotionComponentMetadata["category"] {
  if (category === "cards") return "layout";
  if (category === "checkboxes") return "interaction";
  return "interaction";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildHtml(title: string, htmlContent: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    ${htmlContent}
  </body>
</html>`;
}

export function convertWorkEasyComponent(input: WorkEasyConversionInput): ConvertResult {
  const { category, record } = input;

  if (record.type !== "html" || (record.framework && record.framework !== "vanilla")) {
    return skip(input, "unsupported-type", "Only vanilla HTML/CSS components are supported in phase 1.");
  }

  if (!record.htmlContent?.trim()) {
    return skip(input, "missing-html", "WorkEasy component is missing htmlContent.");
  }

  if (!record.cssContent?.trim()) {
    return skip(input, "missing-css", "WorkEasy component is missing cssContent.");
  }

  const id = `workeasy-${category}-${record.id}`;
  const source: MotionSource = {
    id,
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: buildHtml(record.title, localizeWorkEasyHtml(record.htmlContent))
      },
      { path: "source/style.css", kind: "css", content: localizeWorkEasyCss(record.cssContent) }
    ]
  };

  const detected = scanSourceForParams(source);
  const validation = confirmValidParams({ source, params: detected });
  const capabilities: MotionManifest["capabilities"] =
    validation.confirmed.length > 0 ? ["builtin", "editable", "export-html"] : ["builtin", "export-html"];

  const manifest: MotionManifest = {
    version: "1.0",
    id,
    name: record.title,
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: validation.confirmed,
    capabilities
  };

  return {
    ok: true,
    component: {
      id,
      name: record.title,
      category: categoryToMotionCategory(category),
      tags: [...new Set([...record.tags, category, "workeasy"])],
      useCases: [category],
      moods: ["interactive"],
      source,
      manifest
    }
  };
}
