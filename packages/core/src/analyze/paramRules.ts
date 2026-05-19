import type { MotionParam } from "../manifest/types";

type ParamShape = Pick<MotionParam, "type" | "constraints">;
type MotionParamConstraints = NonNullable<MotionParam["constraints"]>;

const LENGTH_UNITS = ["px", "rem", "%", "vh", "vw"] as const;
const DURATION_UNITS = ["ms", "s"] as const;

export const SAFE_HTML_ATTRIBUTES = ["alt", "title", "aria-label"] as const;
export const SAFE_SVG_ATTRIBUTES = ["fill", "stroke"] as const;

type LengthUnit = (typeof LENGTH_UNITS)[number];
type DurationUnit = (typeof DURATION_UNITS)[number];

function simpleColor(value: string): boolean {
  return /^(#|rgb|rgba|hsl|hsla)\b/i.test(value.trim());
}

function parseNumber(value: string): number | null {
  const numeric = Number(value.trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function parseLength(value: string): { unit: LengthUnit } | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|%|vh|vw)$/);
  if (!match?.[1] || !match[2]) return null;
  return { unit: match[2] as LengthUnit };
}

function parseDuration(value: string): { unit: DurationUnit } | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(ms|s)$/);
  if (!match?.[1] || !match[2]) return null;
  return { unit: match[2] as DurationUnit };
}

function lengthConstraints(unit: LengthUnit, max = 200): MotionParamConstraints {
  return { unit, min: 0, max: unit === "%" ? 100 : max, step: unit === "rem" ? 0.1 : 1 };
}

function durationConstraints(unit: DurationUnit): MotionParamConstraints {
  return { unit, min: 0, max: unit === "ms" ? 5000 : 5, step: unit === "ms" ? 50 : 0.05 };
}

export function cssVariableParam(value: string): ParamShape {
  const trimmed = value.trim();
  if (simpleColor(trimmed)) return { type: "color" };

  const duration = parseDuration(trimmed);
  if (duration) return { type: "duration", constraints: durationConstraints(duration.unit) };

  const length = parseLength(trimmed);
  if (length) return { type: "range", constraints: lengthConstraints(length.unit) };

  return { type: "text" };
}

export function cssPropertyParam(property: string, value: string): ParamShape | null {
  const trimmed = value.trim();

  if (["color", "background-color"].includes(property)) {
    return simpleColor(trimmed) ? { type: "color" } : null;
  }

  if (["transition-duration", "animation-duration"].includes(property)) {
    const duration = parseDuration(trimmed);
    return duration ? { type: "duration", constraints: durationConstraints(duration.unit) } : null;
  }

  if (["border-radius", "font-size", "gap"].includes(property)) {
    const length = parseLength(trimmed);
    if (!length) return null;
    return { type: "range", constraints: lengthConstraints(length.unit, property === "border-radius" ? 100 : 200) };
  }

  if (property === "opacity") {
    const opacity = parseNumber(trimmed);
    if (opacity === null || opacity < 0 || opacity > 1) return null;
    return { type: "range", constraints: { min: 0, max: 1, step: 0.01 } };
  }

  return null;
}

export function isAllowedCssProperty(property: string): boolean {
  return [
    "color",
    "background-color",
    "transition-duration",
    "animation-duration",
    "border-radius",
    "font-size",
    "gap",
    "opacity"
  ].includes(property);
}

export function isSafeHtmlAttribute(attribute: string): boolean {
  return SAFE_HTML_ATTRIBUTES.includes(attribute as (typeof SAFE_HTML_ATTRIBUTES)[number]);
}

export function isSafeSvgAttribute(attribute: string): boolean {
  return SAFE_SVG_ATTRIBUTES.includes(attribute as (typeof SAFE_SVG_ATTRIBUTES)[number]);
}

export function isSafeCssSelector(selector: string): boolean {
  const trimmed = selector.trim();
  if (!trimmed || trimmed.includes(",") || trimmed.includes(":")) return false;
  return /^[.#\[]/.test(trimmed);
}

export function isSimpleColorValue(value: string): boolean {
  return simpleColor(value);
}
