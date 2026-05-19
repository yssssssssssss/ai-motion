import type { MotionParam } from "../manifest/types";
import type { MotionSource } from "../library/componentLibrary";
import { cssPropertyParam, cssVariableParam, isSafeCssSelector, isSimpleColorValue, SAFE_HTML_ATTRIBUTES, SAFE_SVG_ATTRIBUTES } from "./paramRules";

function toParamId(name: string): string {
  return name
    .replace(/^--/, "")
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function selectorToIdPrefix(selector: string): string {
  const cleaned = selector
    .replace(/^\./, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return toParamId(cleaned || "component");
}

function propertyToIdSuffix(property: string): string {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()).replace(/^./, (char) => char.toUpperCase());
}

function attributeToIdSuffix(attribute: string): string {
  return attribute.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()).replace(/^./, (char) => char.toUpperCase());
}

function scanCssProperties(filePath: string, content: string): MotionParam[] {
  const params: MotionParam[] = [];
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;

  for (const rule of content.matchAll(rulePattern)) {
    const selector = rule[1]?.trim();
    const body = rule[2];
    if (!selector || !body || !isSafeCssSelector(selector)) continue;

    const declarationPattern = /([a-z-]+)\s*:\s*([^;]+);/g;
    for (const declaration of body.matchAll(declarationPattern)) {
      const property = declaration[1];
      const value = declaration[2]?.trim();
      if (!property || !value) continue;

      const shape = cssPropertyParam(property, value);
      if (!shape) continue;

      const param: MotionParam = {
        id: `${selectorToIdPrefix(selector)}${propertyToIdSuffix(property)}`,
        label: `${selectorToIdPrefix(selector)} ${property}`,
        type: shape.type,
        default: value,
        status: "detected",
        confidence: 0.65,
        targets: [{ kind: "css-property", file: filePath, selector, property }]
      };
      if (shape.constraints) param.constraints = shape.constraints;
      params.push(param);
    }
  }

  return params;
}

function attributeValue(attributes: string, attribute: string): string | null {
  const match = attributes.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function scanHtmlAttributeParams(filePath: string, content: string): MotionParam[] {
  const params: MotionParam[] = [];
  const elementPattern = /<([a-z0-9-]+)\b([^>]*)>/gi;

  for (const element of content.matchAll(elementPattern)) {
    const attributes = element[2];
    if (!attributes) continue;

    const id = attributeValue(attributes, "data-motion");
    if (!id) continue;

    for (const attribute of SAFE_HTML_ATTRIBUTES) {
      const value = attributeValue(attributes, attribute);
      if (value === null) continue;
      params.push({
        id: `${id}${attributeToIdSuffix(attribute)}`,
        label: `${id} ${attribute}`,
        type: "text",
        default: value,
        status: "detected",
        confidence: 0.75,
        targets: [{ kind: "html-attribute", file: filePath, selector: `[data-motion=${id}]`, attribute }]
      });
    }

    for (const attribute of SAFE_SVG_ATTRIBUTES) {
      const value = attributeValue(attributes, attribute);
      if (value === null || !isSimpleColorValue(value)) continue;
      params.push({
        id: `${id}${attributeToIdSuffix(attribute)}`,
        label: `${id} ${attribute}`,
        type: "color",
        default: value,
        status: "detected",
        confidence: 0.75,
        targets: [{ kind: "svg-attribute", file: filePath, selector: `[data-motion=${id}]`, attribute }]
      });
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

        const shape = cssVariableParam(value);
        const param: MotionParam = {
          id: toParamId(name),
          label: toParamId(name),
          type: shape.type,
          default: value,
          status: "detected",
          confidence: 0.9,
          targets: [{ kind: "css-variable", file: file.path, selector: ":root", name }]
        };

        if (shape.constraints) param.constraints = shape.constraints;
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

      params.push(...scanHtmlAttributeParams(file.path, file.content));
    }
  }

  return params;
}
