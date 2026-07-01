import type { Bounds, FrameElementKind, ZeroVisualAsset, ZeroVisualNode, ZeroVisualSnapshot } from "./schema";

const zeroVisualSnapshotSchemaVersion = "motion-copilot.zero-visual-snapshot.v1";
const elementKinds = new Set<FrameElementKind>(["group", "rect", "text", "vector", "image"]);
const assetTypes = new Set<ZeroVisualAsset["type"]>(["svg", "png", "jpg", "webp", "group"]);

export class ZeroVisualSnapshotValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid ZeroVisualSnapshot: ${issues.join("; ")}`);
    this.name = "ZeroVisualSnapshotValidationError";
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
  path: string,
  issues: string[]
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
  options: { min?: number } = {}
): number | undefined {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path}.${key} must be a finite number`);
    return undefined;
  }
  if (options.min != null && value < options.min) {
    issues.push(`${path}.${key} must be >= ${options.min}`);
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
  const w = numberField(input, "w", path, issues, { min: 0 });
  const h = numberField(input, "h", path, issues, { min: 0 });
  if (x == null || y == null || w == null || h == null) return undefined;
  return { x, y, w, h };
}

function normalizeAsset(input: unknown, index: number, issues: string[]): ZeroVisualAsset | undefined {
  const path = `$.assets[${index}]`;
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }

  const id = stringField(input, "id", path, issues);
  const url = stringField(input, "url", path, issues);
  const type = input.type;
  if (typeof type !== "string" || !assetTypes.has(type as ZeroVisualAsset["type"])) {
    issues.push(`${path}.type must be one of ${Array.from(assetTypes).join(", ")}`);
  }
  if (!id || !url || !assetTypes.has(type as ZeroVisualAsset["type"])) return undefined;

  const asset: ZeroVisualAsset = { id, type: type as ZeroVisualAsset["type"], url };
  const nodeId = optionalStringField(input, "nodeId", path, issues);
  if (nodeId) asset.nodeId = nodeId;
  const width = input.width;
  if (width != null) {
    if (typeof width !== "number" || !Number.isFinite(width) || width < 0) {
      issues.push(`${path}.width must be a finite number >= 0 when provided`);
    } else {
      asset.width = width;
    }
  }
  const height = input.height;
  if (height != null) {
    if (typeof height !== "number" || !Number.isFinite(height) || height < 0) {
      issues.push(`${path}.height must be a finite number >= 0 when provided`);
    } else {
      asset.height = height;
    }
  }
  return asset;
}

function normalizeNode(input: unknown, index: number, issues: string[]): ZeroVisualNode | undefined {
  const path = `$.nodes[${index}]`;
  if (!isRecord(input)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }

  const nodeId = stringField(input, "nodeId", path, issues);
  const name = stringField(input, "name", path, issues);
  const kind = input.kind;
  if (typeof kind !== "string" || !elementKinds.has(kind as FrameElementKind)) {
    issues.push(`${path}.kind must be one of ${Array.from(elementKinds).join(", ")}`);
  }
  const bounds = normalizeBounds(input.bounds, `${path}.bounds`, issues);
  if (!nodeId || !name || !elementKinds.has(kind as FrameElementKind) || !bounds) return undefined;

  const node: ZeroVisualNode = { nodeId, name, kind: kind as FrameElementKind, bounds };
  const text = optionalStringField(input, "text", path, issues);
  if (text) node.text = text;
  const assetId = optionalStringField(input, "assetId", path, issues);
  if (assetId) node.assetId = assetId;
  return node;
}

function htmlNodeIds(html: string): string[] {
  return [...html.matchAll(/\bdata-node-id\s*=\s*["']([^"']+)["']/g)].map((match) => match[1] ?? "");
}

export function normalizeZeroVisualSnapshot(input: unknown): ZeroVisualSnapshot {
  const issues: string[] = [];
  if (!isRecord(input)) throw new ZeroVisualSnapshotValidationError(["$ must be an object"]);

  if (input.schemaVersion !== zeroVisualSnapshotSchemaVersion) {
    issues.push(`$.schemaVersion must be ${zeroVisualSnapshotSchemaVersion}`);
  }
  const frameId = stringField(input, "frameId", "$", issues);
  const nodeId = stringField(input, "nodeId", "$", issues);
  const name = stringField(input, "name", "$", issues);
  const width = numberField(input, "width", "$", issues, { min: 1 });
  const height = numberField(input, "height", "$", issues, { min: 1 });
  // The screenshot is a best-effort pixel-diff/preview reference, not a render input — the morph
  // renders from html+css. visualCheck / createRestorationReport / FrameMorphPanel all guard for
  // an absent screenshotUrl, so an empty string is a valid degraded value, not a failure.
  let screenshotUrl = "";
  if (input.screenshotUrl != null && typeof input.screenshotUrl !== "string") {
    issues.push("$.screenshotUrl must be a string when provided");
  } else if (typeof input.screenshotUrl === "string") {
    screenshotUrl = input.screenshotUrl;
  }
  const html = stringField(input, "html", "$", issues);
  const css = typeof input.css === "string" ? input.css : undefined;
  if (css == null) issues.push("$.css must be a string");

  const rawAssets = input.assets;
  if (!Array.isArray(rawAssets)) issues.push("$.assets must be an array");
  const assets = Array.isArray(rawAssets)
    ? rawAssets
        .map((item, index) => normalizeAsset(item, index, issues))
        .filter((item): item is ZeroVisualAsset => Boolean(item))
    : [];

  const rawNodes = input.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) issues.push("$.nodes must be a non-empty array");
  const nodes = Array.isArray(rawNodes)
    ? rawNodes
        .map((item, index) => normalizeNode(item, index, issues))
        .filter((item): item is ZeroVisualNode => Boolean(item))
    : [];

  if (html && !html.includes("data-node-id")) {
    issues.push("$.html must preserve Zero node bindings with data-node-id attributes");
  }

  if (html) {
    const htmlIds = new Set(htmlNodeIds(html));
    const nodeIds = new Set(nodes.map((node) => node.nodeId));
    for (const id of htmlIds) {
      if (!nodeIds.has(id)) issues.push(`$.html data-node-id is missing from $.nodes: ${id}`);
    }
    for (const id of nodeIds) {
      if (!htmlIds.has(id)) issues.push(`$.nodes nodeId is missing from $.html data-node-id: ${id}`);
    }
  }

  const assetIds = new Set(assets.map((asset) => asset.id));
  for (const node of nodes) {
    if (node.assetId && !assetIds.has(node.assetId)) {
      issues.push(`$.nodes assetId must reference an existing asset: ${node.assetId}`);
    }
  }

  if (
    issues.length > 0 ||
    !frameId ||
    !nodeId ||
    !name ||
    width == null ||
    height == null ||
    !html ||
    css == null
  ) {
    throw new ZeroVisualSnapshotValidationError(issues);
  }

  return {
    schemaVersion: zeroVisualSnapshotSchemaVersion,
    frameId,
    nodeId,
    name,
    width,
    height,
    screenshotUrl,
    html,
    css,
    assets,
    nodes
  };
}
