import type { FrameElement, FrameElementKind, FrameElementStyle, FrameSnapshot } from "./schema";

const frameSnapshotSchemaVersion = "motion-copilot.frame-snapshot.v1";
const elementKinds = new Set<FrameElementKind>(["group", "rect", "text", "vector", "image"]);

export class FrameSnapshotValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid FrameSnapshot: ${issues.join("; ")}`);
    this.name = "FrameSnapshotValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): string | undefined {
  const value = source[key];
  if (typeof value === "string" && value.trim().length > 0) return value;
  issues.push(`${path}.${key} must be a non-empty string`);
  return undefined;
}

function optionalStringField(
  source: Record<string, unknown>,
  key: string,
  issues: string[],
  path: string
): string | undefined {
  const value = source[key];
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim().length > 0) return value;
  issues.push(`${path}.${key} must be a non-empty string when provided`);
  return undefined;
}

function numberField(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
  options: { min?: number; max?: number; fallback?: number } = {}
): number | undefined {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    if (options.fallback != null) return options.fallback;
    issues.push(`${path}.${key} must be a finite number`);
    return undefined;
  }
  if (options.min != null && value < options.min) {
    issues.push(`${path}.${key} must be >= ${options.min}`);
    return undefined;
  }
  if (options.max != null && value > options.max) {
    issues.push(`${path}.${key} must be <= ${options.max}`);
    return undefined;
  }
  return value;
}

function normalizeStyle(input: unknown, path: string, issues: string[]): FrameElementStyle | undefined {
  if (input == null) return undefined;
  if (!isRecord(input)) {
    issues.push(`${path}.style must be an object when provided`);
    return undefined;
  }

  const style: FrameElementStyle = {};
  for (const key of [
    "background",
    "color",
    "borderColor",
    "boxShadow",
    "fontFamily",
    "textDecoration"
  ] as const) {
    const value = input[key];
    if (value == null) continue;
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push(`${path}.style.${key} must be a non-empty string when provided`);
      continue;
    }
    style[key] = value;
  }

  for (const key of ["radius", "borderWidth", "fontSize", "fontWeight", "lineHeight"] as const) {
    const value = input[key];
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(`${path}.style.${key} must be a finite number when provided`);
      continue;
    }
    style[key] = value;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function normalizeElement(input: unknown, index: number, issues: string[]): FrameElement | undefined {
  const path = `$.elements[${index}]`;
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }

  const nodeId = stringField(input, "nodeId", path, issues);
  const key = typeof input.key === "string" && input.key.trim().length > 0 ? input.key : nodeId;
  if (!key) issues.push(`${path}.key must be a non-empty string when nodeId is missing`);

  const name = stringField(input, "name", path, issues);
  const kind = input.kind;
  if (typeof kind !== "string" || !elementKinds.has(kind as FrameElementKind)) {
    issues.push(`${path}.kind must be one of ${Array.from(elementKinds).join(", ")}`);
  }

  const x = numberField(input, "x", path, issues);
  const y = numberField(input, "y", path, issues);
  const w = numberField(input, "w", path, issues, { min: 0 });
  const h = numberField(input, "h", path, issues, { min: 0 });
  const opacity = numberField(input, "opacity", path, issues, { min: 0, max: 1, fallback: 1 });
  const zIndex = numberField(input, "zIndex", path, issues, { fallback: index });

  if (
    !key ||
    !nodeId ||
    !name ||
    !elementKinds.has(kind as FrameElementKind) ||
    x == null ||
    y == null ||
    w == null ||
    h == null ||
    opacity == null ||
    zIndex == null
  ) {
    return undefined;
  }

  const element: FrameElement = {
    key,
    nodeId,
    name,
    kind: kind as FrameElementKind,
    x,
    y,
    w,
    h,
    opacity,
    zIndex
  };

  const parentKey = optionalStringField(input, "parentKey", issues, path);
  if (parentKey) element.parentKey = parentKey;
  const text = optionalStringField(input, "text", issues, path);
  if (text) element.text = text;
  const assetUrl = optionalStringField(input, "assetUrl", issues, path);
  if (assetUrl) element.assetUrl = assetUrl;
  const style = normalizeStyle(input.style, path, issues);
  if (style) element.style = style;

  return element;
}

export function normalizeFrameSnapshot(input: unknown): FrameSnapshot {
  const issues: string[] = [];
  if (!isRecord(input)) throw new FrameSnapshotValidationError(["$ must be an object"]);

  if (input.schemaVersion !== frameSnapshotSchemaVersion) {
    issues.push(`$.schemaVersion must be ${frameSnapshotSchemaVersion}`);
  }
  const frameId = stringField(input, "frameId", "$", issues);
  const name = stringField(input, "name", "$", issues);
  const width = numberField(input, "width", "$", issues, { min: 1 });
  const height = numberField(input, "height", "$", issues, { min: 1 });
  const screenshotUrl = optionalStringField(input, "screenshotUrl", issues, "$");

  const rawElements = input.elements;
  if (!Array.isArray(rawElements)) {
    issues.push("$.elements must be an array");
  }
  const elements = Array.isArray(rawElements)
    ? rawElements
        .map((item, index) => normalizeElement(item, index, issues))
        .filter((item): item is FrameElement => Boolean(item))
    : [];

  const seenKeys = new Set<string>();
  for (const element of elements) {
    if (seenKeys.has(element.key)) issues.push(`$.elements key must be unique: ${element.key}`);
    seenKeys.add(element.key);
  }

  if (issues.length > 0 || !frameId || !name || width == null || height == null) {
    throw new FrameSnapshotValidationError(issues);
  }

  return {
    schemaVersion: frameSnapshotSchemaVersion,
    frameId,
    name,
    width,
    height,
    ...(screenshotUrl ? { screenshotUrl } : {}),
    elements
  };
}
