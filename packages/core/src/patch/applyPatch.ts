import type { MotionManifest, MotionParam, MotionPatch, MotionTarget } from "../manifest/types";

type ApplyPatchInput = {
  files: Record<string, string>;
  manifest: MotionManifest;
  patch: MotionPatch;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function applyHtmlText(content: string, selector: string, value: unknown): string {
  const motionMatch = selector.match(/^\[data-motion=([^\]]+)\]$/);
  if (!motionMatch) return content;

  const key = motionMatch[1]?.replace(/^["']|["']$/g, "");
  if (!key) return content;

  const pattern = new RegExp(`(<[^>]+data-motion=["']${escapeRegExp(key)}["'][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`);
  return content.replace(pattern, `$1${escapeHtmlText(value)}$3`);
}

function formatCssValue(param: MotionParam, value: unknown): string {
  if (typeof value === "number" && param.constraints?.unit) {
    return `${value}${param.constraints.unit}`;
  }

  return String(value);
}

function applyCssVariable(content: string, name: string, value: string): string {
  const pattern = new RegExp(`(${escapeRegExp(name)}\\s*:\\s*)[^;]+`);
  return content.replace(pattern, `$1${value}`);
}

function applyTarget(content: string, target: MotionTarget, param: MotionParam, value: unknown): string {
  if (target.kind === "html-text") return applyHtmlText(content, target.selector, value);
  if (target.kind === "css-variable") return applyCssVariable(content, target.name, formatCssValue(param, value));
  return content;
}

export function applyPatchToFiles(input: ApplyPatchInput): Record<string, string> {
  const output = { ...input.files };

  for (const param of input.manifest.params) {
    if (!(param.id in input.patch.values)) continue;

    const value = input.patch.values[param.id];
    for (const target of param.targets) {
      const filePath = "file" in target ? target.file : undefined;
      if (!filePath || output[filePath] === undefined) continue;
      output[filePath] = applyTarget(output[filePath], target, param, value);
    }
  }

  return output;
}
