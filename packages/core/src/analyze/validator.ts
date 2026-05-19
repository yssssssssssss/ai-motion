import type { MotionParam } from "../manifest/types";
import type { MotionSource } from "../library/componentLibrary";
import { cssPropertyParam, cssVariableParam, isAllowedCssProperty, isSafeCssSelector, isSafeHtmlAttribute, isSafeSvgAttribute } from "./paramRules";

export type ValidationResult = {
  confirmed: MotionParam[];
  rejected: MotionParam[];
  warnings: string[];
};

function dataMotionSelectorValue(selector: string): string | null {
  return selector.match(/^\[data-motion=([^\]]+)\]$/)?.[1]?.replace(/^["']|["']$/g, "") ?? null;
}

function ruleBody(content: string, selector: string): string | null {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m");
  return pattern.exec(content)?.[1] ?? null;
}

function cssDeclarationValue(content: string, selector: string, property: string): string | null {
  const body = ruleBody(content, selector);
  if (!body) return null;

  const pattern = new RegExp(`(?:^|;)\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+)`, "m");
  return pattern.exec(body)?.[1]?.trim() ?? null;
}

function cssVariableValue(content: string, name: string): string | null {
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+)`);
  return pattern.exec(content)?.[1]?.trim() ?? null;
}

function paramTypeMatches(param: MotionParam, type: MotionParam["type"]): boolean {
  if (type === "range") return param.type === "range" || param.type === "number";
  return param.type === type;
}

function hasDataMotionElement(content: string, selector: string): boolean {
  const dataMotion = dataMotionSelectorValue(selector);
  if (!dataMotion) return false;

  return content.includes(`data-motion="${dataMotion}"`) || content.includes(`data-motion='${dataMotion}'`);
}

function hasDataMotionAttribute(content: string, selector: string, attribute: string): boolean {
  const dataMotion = dataMotionSelectorValue(selector);
  if (!dataMotion) return false;

  const elementPattern = new RegExp(`<[^>]*\\bdata-motion=["']${dataMotion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
  const element = elementPattern.exec(content)?.[0];
  if (!element) return false;

  return new RegExp(`\\b${attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`, "i").test(element);
}

function targetExists(source: MotionSource, param: MotionParam): boolean {
  return param.targets.every((target) => {
    if (!("file" in target)) return false;

    const file = source.files.find((item) => item.path === target.file);
    if (!file) return false;

    if (target.kind === "css-variable") {
      const value = cssVariableValue(file.content, target.name);
      return value !== null && paramTypeMatches(param, cssVariableParam(value).type);
    }

    if (target.kind === "css-property") {
      if (!isAllowedCssProperty(target.property) || !isSafeCssSelector(target.selector)) return false;

      const value = cssDeclarationValue(file.content, target.selector, target.property);
      const shape = value === null ? null : cssPropertyParam(target.property, value);
      return shape !== null && paramTypeMatches(param, shape.type);
    }

    if (target.kind === "html-text") {
      return hasDataMotionElement(file.content, target.selector);
    }

    if (target.kind === "html-attribute") {
      return isSafeHtmlAttribute(target.attribute) && hasDataMotionAttribute(file.content, target.selector, target.attribute);
    }

    if (target.kind === "svg-attribute") {
      return isSafeSvgAttribute(target.attribute) && hasDataMotionAttribute(file.content, target.selector, target.attribute);
    }

    return false;
  });
}

export function confirmValidParams(input: { source: MotionSource; params: MotionParam[] }): ValidationResult {
  const confirmed: MotionParam[] = [];
  const rejected: MotionParam[] = [];
  const warnings: string[] = [];

  for (const param of input.params) {
    if (targetExists(input.source, param)) {
      confirmed.push({ ...param, status: "confirmed" });
    } else {
      rejected.push({ ...param, status: "rejected" });
      warnings.push(`Param ${param.id} has a missing target.`);
    }
  }

  return { confirmed, rejected, warnings };
}
