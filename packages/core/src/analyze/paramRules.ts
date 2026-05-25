import type { MotionParam } from "../manifest/types";

type ParamShape = Pick<MotionParam, "type" | "constraints">;
type MotionParamConstraints = NonNullable<MotionParam["constraints"]>;

// 这两个常量数组通过 typeof 推导联合类型，eslint 误报为未使用
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LENGTH_UNITS = ["px", "rem", "%", "vh", "vw"] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DURATION_UNITS = ["ms", "s"] as const;

export const SAFE_HTML_ATTRIBUTES = ["alt", "title", "aria-label"] as const;
export const SAFE_SVG_ATTRIBUTES = ["fill", "stroke"] as const;

const CSS_PROPERTY_LABELS: Record<string, string> = {
  "animation-duration": "动画时长",
  "background-color": "背景色",
  "border-radius": "圆角",
  color: "颜色",
  "font-size": "字号",
  gap: "间距",
  opacity: "透明度",
  "transition-duration": "过渡时长"
};

const HTML_ATTRIBUTE_LABELS: Record<string, string> = {
  "aria-label": "辅助标签",
  alt: "替代文本",
  title: "标题"
};

const SVG_ATTRIBUTE_LABELS: Record<string, string> = {
  fill: "填充色",
  stroke: "描边色"
};

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
    return {
      type: "range",
      constraints: lengthConstraints(length.unit, property === "border-radius" ? 100 : 200)
    };
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
  return /^[.#[]/.test(trimmed);
}

export function isSimpleColorValue(value: string): boolean {
  return simpleColor(value);
}

export function cssPropertyLabel(property: string): string {
  return CSS_PROPERTY_LABELS[property] ?? "样式参数";
}

export function cssVariableLabel(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("background") && normalized.includes("color")) return "背景色";
  if (normalized.includes("text") && normalized.includes("color")) return "文本色";
  if (normalized.includes("hover") && normalized.includes("color")) return "悬停色";
  if (normalized.includes("color")) return "颜色";
  if (normalized.includes("duration")) return "时长";
  if (normalized.includes("radius")) return "圆角";
  if (normalized.includes("size")) return "尺寸";
  if (normalized.includes("width")) return "宽度";
  if (normalized.includes("height")) return "高度";
  if (normalized.includes("border")) return "边框";
  return "参数";
}

export function htmlAttributeLabel(attribute: string): string {
  return HTML_ATTRIBUTE_LABELS[attribute] ?? "文本属性";
}

export function svgAttributeLabel(attribute: string): string {
  return SVG_ATTRIBUTE_LABELS[attribute] ?? "图形属性";
}
