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

function selectorToIdPrefix(selector: string): string {
  const cleaned = selector
    .replace(/^\./, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return toParamId(cleaned || "component");
}

function propertyToParamType(property: string, value: string): MotionParam["type"] | null {
  if (["color", "background-color"].includes(property) && /^(#|rgb|hsl)/.test(value.trim())) return "color";
  if (["transition-duration", "animation-duration"].includes(property)) return "duration";
  if (property === "border-radius") return "range";
  return null;
}

function propertyConstraints(property: string, value: string): MotionParam["constraints"] {
  const trimmed = value.trim();
  if (property === "border-radius") return { unit: "px", min: 0, max: 100, step: 1 };
  if (/(ms|s)$/.test(trimmed)) return { unit: trimmed.endsWith("ms") ? "ms" : "s" };
  return undefined;
}

function propertyToIdSuffix(property: string): string {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()).replace(/^./, (char) => char.toUpperCase());
}

function scanCssProperties(filePath: string, content: string): MotionParam[] {
  const params: MotionParam[] = [];
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;

  for (const rule of content.matchAll(rulePattern)) {
    const selector = rule[1]?.trim();
    const body = rule[2];
    if (!selector || !body || selector.includes(":") || selector.includes(",")) continue;

    const declarationPattern = /(color|background-color|transition-duration|animation-duration|border-radius)\s*:\s*([^;]+);/g;
    for (const declaration of body.matchAll(declarationPattern)) {
      const property = declaration[1];
      const value = declaration[2]?.trim();
      if (!property || !value) continue;

      const type = propertyToParamType(property, value);
      if (!type) continue;

      const param: MotionParam = {
        id: `${selectorToIdPrefix(selector)}${propertyToIdSuffix(property)}`,
        label: `${selectorToIdPrefix(selector)} ${property}`,
        type,
        default: value,
        status: "detected",
        confidence: 0.65,
        targets: [{ kind: "css-property", file: filePath, selector, property }]
      };
      const constraints = propertyConstraints(property, value);
      if (constraints) param.constraints = constraints;
      params.push(param);
    }
  }

  return params;
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

      params.push(...scanCssProperties(file.path, file.content));
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
