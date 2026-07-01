import type { ZeroVisualNodeOverride } from "./schema";

function cssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

type OverrideRule = {
  nodeId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  opacity?: number;
  forceBox?: boolean;
};

type OverrideNode = {
  nodeId: string;
  kind: string;
  bounds: { x: number; y: number; w: number; h: number };
};

function px(name: string, value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${name}:${value}px!important;` : "";
}

function scalar(name: string, value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${name}:${value}!important;` : "";
}

export function createZeroVisualNodeOverrideCss(
  overrides: ZeroVisualNodeOverride[] | undefined,
  nodes?: OverrideNode[],
  scope = ""
): string {
  if (!overrides?.length) return "";
  const rules = nodes?.length ? overrides.flatMap((override) => rulesForStructuredOverride(override, nodes)) : overrides;
  return rules
    .map((rule) => ruleCss(rule, scope))
    .filter(Boolean)
    .join("\n");
}

function ruleCss(rule: OverrideRule, scope: string): string {
  const selectorPrefix = scope.trim();
  const selector = `${selectorPrefix ? `${selectorPrefix} ` : ""}[data-node-id="${cssAttributeValue(rule.nodeId)}"]`;
  const body = [
    rule.forceBox ? "position:absolute!important;display:block!important;box-sizing:border-box!important;" : "",
    px("left", rule.x),
    px("top", rule.y),
    px("width", rule.width),
    px("height", rule.height),
    px("border-radius", rule.radius),
    scalar("opacity", rule.opacity),
    rule.forceBox && rule.radius !== undefined ? "overflow:hidden!important;" : ""
  ].join("");
  return body ? `${selector}{${body}}` : "";
}

function rulesForStructuredOverride(
  override: ZeroVisualNodeOverride,
  nodes: OverrideNode[]
): OverrideRule[] {
  const base = nodes.find((node) => node.nodeId === override.nodeId);
  if (!base) return [override];
  const x = override.x ?? base.bounds.x;
  const y = override.y ?? base.bounds.y;
  const width = override.width ?? base.bounds.w;
  const height = override.height ?? base.bounds.h;
  const scaleX = width / Math.max(base.bounds.w, 1);
  const scaleY = height / Math.max(base.bounds.h, 1);
  const childRules = containedNodes(base, nodes).map((child) => ({
    nodeId: child.nodeId,
    x: x + (child.bounds.x - base.bounds.x) * scaleX,
    y: y + (child.bounds.y - base.bounds.y) * scaleY,
    width: child.bounds.w * scaleX,
    height: child.bounds.h * scaleY,
    forceBox: true
  }));
  return [
    {
      ...override,
      x,
      y,
      width,
      height,
      forceBox: true
    },
    ...childRules
  ];
}

function containedNodes(base: OverrideNode, nodes: OverrideNode[]): OverrideNode[] {
  const left = base.bounds.x;
  const top = base.bounds.y;
  const right = base.bounds.x + base.bounds.w;
  const bottom = base.bounds.y + base.bounds.h;
  return nodes.filter((node) => {
    if (node.nodeId === base.nodeId) return false;
    if (node.kind === "group") return false;
    return (
      node.bounds.x >= left &&
      node.bounds.y >= top &&
      node.bounds.x + node.bounds.w <= right &&
      node.bounds.y + node.bounds.h <= bottom
    );
  });
}
