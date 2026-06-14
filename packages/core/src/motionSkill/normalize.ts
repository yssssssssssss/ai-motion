import type { AtomicMotionProperty, DesignerMotionRow, ObjectKeyframe, ScalarKeyframe } from "./types";

type CsvRow = Record<string, unknown>;

const HEADER_ALIASES: Record<keyof Omit<DesignerMotionRow, "rowNumber">, string[]> = {
  element: ["元素"],
  motionPreview: ["动态示意"],
  variant: ["梯度"],
  variantPreview: ["示意"],
  targetLayer: ["作用图层", "目标图层"],
  token: ["Token", "token"],
  value: ["Value", "值", "时长"],
  delay: ["Delay", "延迟"],
  animationType: ["动画类型"],
  propertyChange: ["关键属性变化"],
  cssValue: ["CSS Value", "CSSValue", "曲线"]
};

const SLUG_ALIASES: Record<string, string> = {
  弹窗反馈: "popup-feedback",
  弹窗关闭: "popup-close",
  内容反馈: "content-feedback",
  关闭: "close",
  容器变换: "container-transform",
  前后进场: "front-back-entry",
  横向切换: "horizontal-switch",
  容器加载: "container-loading",
  内容加载: "content-loading",
  大型尺寸: "large",
  中型尺寸: "medium",
  小型尺寸: "small",
  "大型尺寸（高度<360）": "large",
  "中型尺寸（200<高度<360）": "medium",
  "小型尺寸(吐司)（高度<200）": "toast",
  商卡: "product-card",
  二级页跳转: "detail-page",
  半弹层: "half-sheet",
  动作面板: "action-panel",
  滑动操作: "swipe-action",
  Tab导航: "tab-navigation",
  频道Tab: "channel-tab",
  Tabbar底导: "tabbar",
  开关: "switch",
  指示器: "indicator",
  分段: "segmented",
  气泡: "bubble",
  "单选/多选": "selection",
  骨架: "skeleton",
  全局: "global",
  下拉: "dropdown",
  all: "all"
};

function cell(row: CsvRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function normalizeDesignerMotionRows(rows: CsvRow[]): DesignerMotionRow[] {
  const last: Partial<DesignerMotionRow> = {};
  return rows.map((row, index) => {
    const explicitElement = cell(row, HEADER_ALIASES.element);
    const startsNewElement = Boolean(explicitElement && explicitElement !== last.element);
    const next: DesignerMotionRow = {
      element: explicitElement || last.element || "",
      motionPreview:
        cell(row, HEADER_ALIASES.motionPreview) || (startsNewElement ? undefined : last.motionPreview),
      variant: cell(row, HEADER_ALIASES.variant) || (startsNewElement ? "" : last.variant || ""),
      variantPreview:
        cell(row, HEADER_ALIASES.variantPreview) || (startsNewElement ? undefined : last.variantPreview),
      targetLayer:
        cell(row, HEADER_ALIASES.targetLayer) || (startsNewElement ? "前景层" : last.targetLayer || "前景层"),
      token: cell(row, HEADER_ALIASES.token) || last.token || "",
      value: cell(row, HEADER_ALIASES.value),
      delay: cell(row, HEADER_ALIASES.delay),
      animationType: cell(row, HEADER_ALIASES.animationType),
      propertyChange: cell(row, HEADER_ALIASES.propertyChange),
      cssValue: cell(row, HEADER_ALIASES.cssValue),
      rowNumber: index + 2
    };

    last.element = next.element;
    last.motionPreview = next.motionPreview;
    last.variant = next.variant;
    last.variantPreview = next.variantPreview;
    last.targetLayer = next.targetLayer;
    last.token = next.token;
    return next;
  });
}

export function parseMilliseconds(value: string): number {
  const normalized = value.trim();
  const match = normalized.match(/^-?\d+(?:\.\d+)?/);
  if (!match?.[0]) throw new Error(`Invalid time value: ${value}`);

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid time value: ${value}`);
  return /s$/i.test(normalized) && !/ms$/i.test(normalized) ? Math.round(parsed * 1000) : Math.round(parsed);
}

export function parseCssEasing(value: string): string {
  const trimmed = value.trim();
  if (/^cubic-bezier\(/i.test(trimmed)) return trimmed.replace(/\s+/g, " ");

  const tuple = trimmed.match(
    /^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/
  );
  if (tuple) {
    const values = tuple.slice(1).map((item) => String(Number(item)));
    return `cubic-bezier(${values.join(", ")})`;
  }
  if (/ease\s*out/i.test(trimmed)) return "ease-out";
  if (/ease\s*in/i.test(trimmed)) return "ease-in";
  return trimmed;
}

export function propertyFromAnimationType(value: string): AtomicMotionProperty {
  if (/透明度|opacity/i.test(value)) return "opacity";
  if (/颜色|color/i.test(value)) return "color";
  if (/横向缩放|对角缩放|尺寸|size|宽|高/i.test(value)) return "size";
  if (/缩放|scale/i.test(value)) return "scale";
  if (/位移|position|translate/i.test(value)) return "position";
  if (/圆度|圆角|roundness|radius/i.test(value)) return "roundness";
  throw new Error(`Unsupported animation type: ${value}`);
}

function normalizePercentNumber(raw: string, property: AtomicMotionProperty): number {
  const hasPercent = raw.includes("%");
  const parsed = Number(raw.replace("%", ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid keyframe value: ${raw}`);
  if ((property === "scale" || property === "opacity") && (hasPercent || Math.abs(parsed) > 1)) {
    return parsed / 100;
  }
  return parsed;
}

type ParsedKeyframes = ScalarKeyframe[] | string[] | ObjectKeyframe[];

function keyframeBody(value: string): string {
  const normalized = value.replaceAll("：", ":").replaceAll("→", "->");
  const separator = normalized.indexOf(":");
  return (separator >= 0 ? normalized.slice(separator + 1) : normalized).trim();
}

function parseNumberSequence(value: string, property: AtomicMotionProperty): number[] {
  return parseNumberFrames(value, property).map((frame) => (typeof frame === "number" ? frame : frame.value));
}

function parseNumberFrames(value: string, property: AtomicMotionProperty): ScalarKeyframe[] {
  const frames = value
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/(-?\d+(?:\.\d+)?%?)(?:\s*[（(]\s*(\d+)\s*ms\s*[）)])?/i);
      if (!match?.[0]) throw new Error(`Invalid keyframe value: ${item}`);
      const value = normalizePercentNumber(match[1]!, property);
      const offsetMs = match[2] ? Number(match[2]) : undefined;
      return offsetMs === undefined ? value : { value, offsetMs };
    });
  return frames.some((frame) => typeof frame !== "number" && typeof frame.offsetMs === "number")
    ? frames
    : frames.map((frame) => (typeof frame === "number" ? frame : frame.value));
}

function parseColorSequence(value: string): string[] {
  return value
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/#?[0-9a-f]{6}\b/i);
      if (!match?.[0]) throw new Error(`Invalid color keyframe value: ${item}`);
      return `#${match[0].replace("#", "").toLowerCase()}`;
    });
}

function parseSizeKeyframes(body: string): ObjectKeyframe[] {
  const lanes = body
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (lanes.length !== 2) throw new Error(`Invalid size keyframes: ${body}`);

  const widths = parseNumberFrames(lanes[0]!, "size");
  const heights = parseNumberFrames(lanes[1]!, "size");
  if (widths.length !== heights.length || widths.length < 2)
    throw new Error(`Invalid size keyframes: ${body}`);

  return widths.map((widthFrame, index) => {
    const heightFrame = heights[index]!;
    const width = typeof widthFrame === "number" ? widthFrame : widthFrame.value;
    const height = typeof heightFrame === "number" ? heightFrame : heightFrame.value;
    const offsetMs =
      typeof widthFrame === "number"
        ? typeof heightFrame === "number"
          ? undefined
          : heightFrame.offsetMs
        : widthFrame.offsetMs;
    return offsetMs === undefined ? { width, height } : { width, height, offsetMs };
  });
}

function parsePositionKeyframes(body: string): ObjectKeyframe[] {
  const lanes = body
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (lanes.length !== 2) throw new Error(`Invalid position keyframes: ${body}`);

  const xLane = lanes.find((item) => /^x\b/i.test(item)) ?? lanes[0]!;
  const yLane = lanes.find((item) => /^y\b/i.test(item)) ?? lanes[1]!;
  const xs = parseNumberSequence(xLane, "position");
  const ys = parseNumberSequence(yLane, "position");
  if (xs.length !== ys.length || xs.length < 2) throw new Error(`Invalid position keyframes: ${body}`);

  return xs.map((x, index) => ({ x, y: ys[index]! }));
}

export function parseKeyframes(value: string, property: AtomicMotionProperty): ParsedKeyframes {
  const body = keyframeBody(value);
  if (property === "color") {
    const colors = parseColorSequence(body);
    if (colors.length < 2) throw new Error(`Invalid keyframes: ${value}`);
    return colors;
  }
  if (property === "size" && body.includes("|")) return parseSizeKeyframes(body);
  if (property === "position" && body.includes("|")) return parsePositionKeyframes(body);

  const values = parseNumberFrames(body, property);
  if (values.length < 2) throw new Error(`Invalid keyframes: ${value}`);
  return values;
}

export function slugMotionId(value: string): string {
  const trimmed = value.trim();
  if (SLUG_ALIASES[trimmed]) return SLUG_ALIASES[trimmed];
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
