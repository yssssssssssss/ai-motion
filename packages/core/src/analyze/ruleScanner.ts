import type { MotionParam } from "../manifest/types";
import type { MotionSource } from "../library/componentLibrary";

function toParamId(name: string): string {
  return name
    .replace(/^--/, "")
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function cssVariableType(value: string): MotionParam["type"] {
  const trimmed = value.trim();

  if (/^(#|rgb|hsl)/.test(trimmed)) return "color";
  if (/(ms|s)$/.test(trimmed)) return "duration";
  if (/(px|rem|%|vh|vw)$/.test(trimmed)) return "range";
  return "text";
}

function cssVariableConstraints(value: string): MotionParam["constraints"] {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|%|vh|vw|ms|s)$/);
  if (!match) return undefined;

  const unit = match[2] as NonNullable<MotionParam["constraints"]>["unit"] | undefined;
  if (!unit) return undefined;

  return { unit };
}

export function scanSourceForParams(source: MotionSource): MotionParam[] {
  const params: MotionParam[] = [];

  for (const file of source.files) {
    if (file.kind === "css") {
      const variablePattern = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
      for (const match of file.content.matchAll(variablePattern)) {
        const name = match[1];
        const value = match[2]?.trim();
        if (!name || !value) continue;

        const constraints = cssVariableConstraints(value);
        const param: MotionParam = {
          id: toParamId(name),
          label: toParamId(name),
          type: cssVariableType(value),
          default: value,
          status: "detected",
          confidence: 0.9,
          targets: [{ kind: "css-variable", file: file.path, selector: ":root", name }]
        };

        if (constraints) param.constraints = constraints;
        params.push(param);
      }
    }

    if (file.kind === "html") {
      const dataMotionPattern = /<([a-z0-9-]+)[^>]*data-motion=["']([^"']+)["'][^>]*>([^<]*)<\/\1>/gi;
      for (const match of file.content.matchAll(dataMotionPattern)) {
        const id = match[2];
        const text = match[3];
        if (!id || text === undefined) continue;

        params.push({
          id,
          label: id,
          type: "text",
          default: text,
          status: "detected",
          confidence: 0.8,
          targets: [{ kind: "html-text", file: file.path, selector: `[data-motion=${id}]` }]
        });
      }
    }
  }

  return params;
}
