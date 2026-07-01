import type {
  ZeroLayerAsset,
  ZeroLayerEffect,
  ZeroLayerFill,
  ZeroLayerKind,
  ZeroLayerNode,
  ZeroLayerSnapshot,
  ZeroLayerStroke,
  ZeroLayerTextStyle
} from "./schema";
import type { Bounds } from "../frameMorph/schema";

const schemaVersion = "motion-copilot.zero-layer-snapshot.v1";
const layerKinds = new Set<ZeroLayerKind>([
  "frame",
  "group",
  "rect",
  "text",
  "vector",
  "image",
  "component",
  "instance",
  "boolean",
  "ellipse",
  "line",
  "polygon",
  "star",
  "section",
  "unknown"
]);
const assetTypes = new Set<ZeroLayerAsset["type"]>(["svg", "png", "jpg", "webp"]);

export class ZeroLayerSnapshotValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid ZeroLayerSnapshot: ${issues.join("; ")}`);
    this.name = "ZeroLayerSnapshotValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string, path: string, issues: string[]): string | undefined {
  const value = source[key];
  if (typeof value === "string" && value.trim()) return value;
  issues.push(`${path}.${key} must be a non-empty string`);
  return undefined;
}

function optionalStringField(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[]
): string | undefined {
  const value = source[key];
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim()) return value;
  issues.push(`${path}.${key} must be a non-empty string when provided`);
  return undefined;
}

function numberField(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
  min?: number
): number | undefined {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path}.${key} must be a finite number`);
    return undefined;
  }
  if (min != null && value < min) {
    issues.push(`${path}.${key} must be >= ${min}`);
    return undefined;
  }
  return value;
}

function optionalNumberField(
  source: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
  min?: number
): number | undefined {
  const value = source[key];
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path}.${key} must be a finite number when provided`);
    return undefined;
  }
  if (min != null && value < min) {
    issues.push(`${path}.${key} must be >= ${min}`);
    return undefined;
  }
  return value;
}

function normalizeBounds(input: unknown, path: string, issues: string[]): Bounds | undefined {
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  const x = numberField(input, "x", path, issues);
  const y = numberField(input, "y", path, issues);
  const w = numberField(input, "w", path, issues, 0);
  const h = numberField(input, "h", path, issues, 0);
  return x == null || y == null || w == null || h == null ? undefined : { x, y, w, h };
}

function normalizeFill(input: unknown, path: string, issues: string[]): ZeroLayerFill | undefined {
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  const type = input.type;
  if (type !== "solid" && type !== "image" && type !== "gradient") {
    issues.push(`${path}.type must be solid, image, or gradient`);
    return undefined;
  }
  const opacity = optionalNumberField(input, "opacity", path, issues, 0);
  if (type === "solid") {
    const color = stringField(input, "color", path, issues);
    return color ? { type, color, ...(opacity != null ? { opacity } : {}) } : undefined;
  }
  if (type === "image") {
    const assetId = optionalStringField(input, "assetId", path, issues);
    return { type, ...(assetId ? { assetId } : {}), ...(opacity != null ? { opacity } : {}) };
  }
  const css = optionalStringField(input, "css", path, issues);
  return { type, ...(css ? { css } : {}), ...(opacity != null ? { opacity } : {}) };
}

function normalizeStroke(input: unknown, path: string, issues: string[]): ZeroLayerStroke | undefined {
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  const color = stringField(input, "color", path, issues);
  const opacity = optionalNumberField(input, "opacity", path, issues, 0);
  const width = optionalNumberField(input, "width", path, issues, 0);
  return color ? { color, ...(opacity != null ? { opacity } : {}), ...(width != null ? { width } : {}) } : undefined;
}

function normalizeEffect(input: unknown, path: string, issues: string[]): ZeroLayerEffect | undefined {
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  const type = input.type;
  if (type !== "drop-shadow" && type !== "inner-shadow" && type !== "blur" && type !== "unknown") {
    issues.push(`${path}.type must be a supported effect type`);
    return undefined;
  }
  const css = optionalStringField(input, "css", path, issues);
  return { type, ...(css ? { css } : {}) };
}

function normalizeTextStyle(input: unknown, path: string, issues: string[]): ZeroLayerTextStyle | undefined {
  if (input == null) return undefined;
  if (!isRecord(input)) {
    issues.push(`${path} must be an object when provided`);
    return undefined;
  }
  const fontFamily = optionalStringField(input, "fontFamily", path, issues);
  const fontSize = optionalNumberField(input, "fontSize", path, issues, 0);
  const fontWeight = optionalNumberField(input, "fontWeight", path, issues, 0);
  const lineHeight = optionalNumberField(input, "lineHeight", path, issues, 0);
  const textAlignValue = input.textAlign;
  const textAlign =
    textAlignValue === "left" || textAlignValue === "center" || textAlignValue === "right"
      ? textAlignValue
      : undefined;
  if (textAlignValue != null && !textAlign) issues.push(`${path}.textAlign must be left, center, or right`);
  return {
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontSize != null ? { fontSize } : {}),
    ...(fontWeight != null ? { fontWeight } : {}),
    ...(lineHeight != null ? { lineHeight } : {}),
    ...(textAlign ? { textAlign } : {})
  };
}

function normalizeAsset(input: unknown, index: number, issues: string[]): ZeroLayerAsset | undefined {
  const path = `$.assets[${index}]`;
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  const id = stringField(input, "id", path, issues);
  const url = stringField(input, "url", path, issues);
  const type = input.type;
  if (typeof type !== "string" || !assetTypes.has(type as ZeroLayerAsset["type"])) {
    issues.push(`${path}.type must be one of ${Array.from(assetTypes).join(", ")}`);
  }
  if (!id || !url || !assetTypes.has(type as ZeroLayerAsset["type"])) return undefined;
  const nodeId = optionalStringField(input, "nodeId", path, issues);
  const width = optionalNumberField(input, "width", path, issues, 0);
  const height = optionalNumberField(input, "height", path, issues, 0);
  return {
    id,
    type: type as ZeroLayerAsset["type"],
    url,
    ...(nodeId ? { nodeId } : {}),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {})
  };
}

function normalizeLayer(input: unknown, index: number, issues: string[]): ZeroLayerNode | undefined {
  const path = `$.layers[${index}]`;
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  const nodeId = stringField(input, "nodeId", path, issues);
  const parentId = optionalStringField(input, "parentId", path, issues);
  const name = stringField(input, "name", path, issues);
  const kindValue = input.kind;
  const kind = typeof kindValue === "string" && layerKinds.has(kindValue as ZeroLayerKind) ? kindValue : undefined;
  if (!kind) issues.push(`${path}.kind must be one of ${Array.from(layerKinds).join(", ")}`);
  const bounds = normalizeBounds(input.bounds, `${path}.bounds`, issues);
  const opacity = optionalNumberField(input, "opacity", path, issues, 0) ?? 1;
  const visible = typeof input.visible === "boolean" ? input.visible : true;
  const clipsContent = typeof input.clipsContent === "boolean" ? input.clipsContent : undefined;
  const cornerRadius = optionalNumberField(input, "cornerRadius", path, issues, 0);
  const text = optionalStringField(input, "text", path, issues);
  const assetId = optionalStringField(input, "assetId", path, issues);
  const fills = Array.isArray(input.fills)
    ? input.fills.map((item, fillIndex) => normalizeFill(item, `${path}.fills[${fillIndex}]`, issues)).filter(Boolean)
    : undefined;
  const strokes = Array.isArray(input.strokes)
    ? input.strokes
        .map((item, strokeIndex) => normalizeStroke(item, `${path}.strokes[${strokeIndex}]`, issues))
        .filter(Boolean)
    : undefined;
  const effects = Array.isArray(input.effects)
    ? input.effects
        .map((item, effectIndex) => normalizeEffect(item, `${path}.effects[${effectIndex}]`, issues))
        .filter(Boolean)
    : undefined;
  const textStyle = normalizeTextStyle(input.textStyle, `${path}.textStyle`, issues);
  const children = Array.isArray(input.children)
    ? input.children.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;

  if (!nodeId || !name || !kind || !bounds) return undefined;
  return {
    nodeId,
    ...(parentId ? { parentId } : {}),
    name,
    kind: kind as ZeroLayerKind,
    bounds,
    opacity,
    visible,
    ...(clipsContent != null ? { clipsContent } : {}),
    ...(cornerRadius != null ? { cornerRadius } : {}),
    ...(fills?.length ? { fills: fills as ZeroLayerFill[] } : {}),
    ...(strokes?.length ? { strokes: strokes as ZeroLayerStroke[] } : {}),
    ...(effects?.length ? { effects: effects as ZeroLayerEffect[] } : {}),
    ...(text ? { text } : {}),
    ...(textStyle && Object.keys(textStyle).length > 0 ? { textStyle } : {}),
    ...(assetId ? { assetId } : {}),
    ...(children?.length ? { children } : {})
  };
}

export function normalizeZeroLayerSnapshot(input: unknown): ZeroLayerSnapshot {
  const issues: string[] = [];
  if (!isRecord(input)) throw new ZeroLayerSnapshotValidationError(["$ must be an object"]);
  if (input.schemaVersion !== schemaVersion) issues.push(`$.schemaVersion must be ${schemaVersion}`);
  const frameId = stringField(input, "frameId", "$", issues);
  const nodeId = stringField(input, "nodeId", "$", issues);
  const name = stringField(input, "name", "$", issues);
  const width = numberField(input, "width", "$", issues, 1);
  const height = numberField(input, "height", "$", issues, 1);
  const screenshotUrl = stringField(input, "screenshotUrl", "$", issues);
  const rawAssets = input.assets;
  if (!Array.isArray(rawAssets)) issues.push("$.assets must be an array");
  const assets = Array.isArray(rawAssets)
    ? rawAssets.map((item, index) => normalizeAsset(item, index, issues)).filter(Boolean)
    : [];
  const rawLayers = input.layers;
  if (!Array.isArray(rawLayers) || rawLayers.length === 0) issues.push("$.layers must be a non-empty array");
  const layers = Array.isArray(rawLayers)
    ? rawLayers.map((item, index) => normalizeLayer(item, index, issues)).filter(Boolean)
    : [];

  const layerIds = new Set(layers.map((layer) => layer?.nodeId).filter(Boolean));
  if (nodeId && !layerIds.has(nodeId)) issues.push("$.layers must include the root nodeId layer");
  const assetIds = new Set(assets.map((asset) => asset?.id).filter(Boolean));
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.parentId && !layerIds.has(layer.parentId)) {
      issues.push(`$.layers parentId must reference an existing layer: ${layer.parentId}`);
    }
    if (layer.assetId && !assetIds.has(layer.assetId)) {
      issues.push(`$.layers assetId must reference an existing asset: ${layer.assetId}`);
    }
  }

  if (
    issues.length > 0 ||
    !frameId ||
    !nodeId ||
    !name ||
    width == null ||
    height == null ||
    !screenshotUrl
  ) {
    throw new ZeroLayerSnapshotValidationError(issues);
  }

  return {
    schemaVersion,
    frameId,
    nodeId,
    name,
    width,
    height,
    screenshotUrl,
    assets: assets as ZeroLayerAsset[],
    layers: layers as ZeroLayerNode[]
  };
}
