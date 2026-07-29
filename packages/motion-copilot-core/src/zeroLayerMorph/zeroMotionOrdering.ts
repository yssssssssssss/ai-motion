import type { CompositionStep } from "../schema/document";
import { layerIdForNode } from "./layerId";
import type { ZeroLayerMorphSource, ZeroLayerNode } from "./schema";
import {
  classifyZeroLayerRoles,
  type ZeroLayerRoleClassification,
  type ZeroLayerSemanticRole
} from "./zeroLayerRoleClassifier";
import type { ZeroMotionSpec } from "./zeroMotionSpec";

export type ZeroMotionOrderGroup =
  | "foundation"
  | "structure"
  | "exit-content"
  | "enter-content"
  | "emphasis"
  | "decorative";

export type ZeroMotionOrderItem = {
  layerId: string;
  nodeId: string;
  toNodeId?: string;
  name: string;
  group: ZeroMotionOrderGroup;
  role: ZeroLayerSemanticRole;
  confidence: number;
  order: number;
  delayMs: number;
  reasons: string[];
};

export type ZeroMotionOrderPlan = {
  schemaVersion: "motion-copilot.zero-motion-order-plan.v1";
  groups: Record<ZeroMotionOrderGroup, ZeroMotionOrderItem[]>;
  items: ZeroMotionOrderItem[];
  roleByLayerId: Record<string, ZeroLayerSemanticRole>;
  summary: string;
};

const groupBaseDelay: Record<ZeroMotionOrderGroup, number> = {
  foundation: 0,
  structure: 24,
  "exit-content": 0,
  "enter-content": 132,
  emphasis: 172,
  decorative: 210
};

const roleGroup: Record<ZeroLayerSemanticRole, ZeroMotionOrderGroup> = {
  "root-container": "foundation",
  background: "foundation",
  surface: "structure",
  mask: "foundation",
  "content-text": "enter-content",
  icon: "emphasis",
  action: "emphasis",
  badge: "emphasis",
  divider: "decorative",
  decorative: "decorative",
  unknown: "decorative"
};

function byNodeId(nodes: ZeroLayerNode[]): Map<string, ZeroLayerNode> {
  return new Map(nodes.map((node) => [node.nodeId, node]));
}

function byRoleNodeId(roles: ZeroLayerRoleClassification[]): Map<string, ZeroLayerRoleClassification> {
  return new Map(roles.map((role) => [role.nodeId, role]));
}

function readingOrder(a: ZeroLayerNode, b: ZeroLayerNode): number {
  const rowA = Math.round(a.bounds.y / 12);
  const rowB = Math.round(b.bounds.y / 12);
  return rowA - rowB || a.bounds.x - b.bounds.x || a.nodeId.localeCompare(b.nodeId);
}

function confidenceFor(role: ZeroLayerRoleClassification | undefined): number {
  return role?.confidence ?? 0;
}

function roleFor(
  fromRole: ZeroLayerRoleClassification | undefined,
  toRole: ZeroLayerRoleClassification | undefined
): ZeroLayerRoleClassification | undefined {
  if (!fromRole) return toRole;
  if (!toRole) return fromRole;
  return confidenceFor(toRole) >= confidenceFor(fromRole) ? toRole : fromRole;
}

function groupForStepType(step: CompositionStep, role: ZeroLayerSemanticRole): ZeroMotionOrderGroup {
  if (step.id.startsWith("zero-layer-exit"))
    return role === "surface" || role === "background" ? "structure" : "exit-content";
  if (step.id.startsWith("zero-layer-enter")) return roleGroup[role];
  return roleGroup[role] === "enter-content" ? "structure" : roleGroup[role];
}

function nodeName(node: ZeroLayerNode | undefined, fallback: string): string {
  return node ? node.text?.trim() || node.name || fallback : fallback;
}

export function createZeroMotionOrderPlan(
  source: ZeroLayerMorphSource,
  steps: CompositionStep[],
  spec?: ZeroMotionSpec
): ZeroMotionOrderPlan {
  const roleResult = classifyZeroLayerRoles(source);
  const fromRoles = byRoleNodeId(roleResult.from);
  const toRoles = byRoleNodeId(roleResult.to);
  const fromNodes = byNodeId(source.from.layers);
  const toNodes = byNodeId(source.to.layers);
  const bindingByLayerId = new Map(
    source.bindingResult.bindings.map((binding) => [binding.layerId, binding])
  );
  const enterByLayerId = new Map(source.bindingResult.enter.map((node) => [layerIdForNode(node), node]));
  const exitByLayerId = new Map(source.bindingResult.exit.map((node) => [layerIdForNode(node), node]));
  const nodesForOrdering = new Map<string, ZeroLayerNode>();
  const rawItems = steps
    .map((step) => {
      if (!step.layerId) return undefined;
      const binding = bindingByLayerId.get(step.layerId);
      const enterNode = enterByLayerId.get(step.layerId);
      const exitNode = exitByLayerId.get(step.layerId);
      const fromNode = binding ? fromNodes.get(binding.nodeId) : exitNode;
      const toNode = binding ? toNodes.get(binding.toNodeId) : enterNode;
      const role = roleFor(
        fromNode ? fromRoles.get(fromNode.nodeId) : undefined,
        toNode ? toRoles.get(toNode.nodeId) : undefined
      );
      const semanticRole = role?.role ?? "unknown";
      const group = groupForStepType(step, semanticRole);
      const node = toNode ?? fromNode;
      nodesForOrdering.set(
        step.layerId,
        node ??
          ({ nodeId: step.layerId, name: step.layerId, bounds: { x: 0, y: 0, w: 0, h: 0 } } as ZeroLayerNode)
      );
      return {
        layerId: step.layerId,
        nodeId: fromNode?.nodeId ?? toNode?.nodeId ?? step.layerId,
        ...(toNode?.nodeId && fromNode?.nodeId && toNode.nodeId !== fromNode.nodeId
          ? { toNodeId: toNode.nodeId }
          : {}),
        name: nodeName(node, step.layerName ?? step.layerId),
        group,
        role: semanticRole,
        confidence: role?.confidence ?? 0,
        order: 0,
        delayMs: 0,
        reasons: role?.reasons ?? ["未找到图层角色识别结果"]
      } satisfies ZeroMotionOrderItem;
    })
    .filter((item): item is ZeroMotionOrderItem => Boolean(item));

  const itemsByGroup = new Map<ZeroMotionOrderGroup, ZeroMotionOrderItem[]>();
  for (const group of Object.keys(groupBaseDelay) as ZeroMotionOrderGroup[]) itemsByGroup.set(group, []);
  for (const item of rawItems) itemsByGroup.get(item.group)!.push(item);

  const items: ZeroMotionOrderItem[] = [];
  for (const [group, groupItems] of itemsByGroup.entries()) {
    const sorted = [...groupItems].sort((a, b) => {
      const nodeA = nodesForOrdering.get(a.layerId);
      const nodeB = nodesForOrdering.get(b.layerId);
      if (!nodeA || !nodeB) return a.layerId.localeCompare(b.layerId);
      return readingOrder(nodeA, nodeB);
    });
    sorted.forEach((item, index) => {
      const next = {
        ...item,
        order: index,
        delayMs: groupBaseDelay[group] + index * (group === "enter-content" ? 34 : 22)
      };
      items.push(next);
    });
  }

  const groups = {
    foundation: items.filter((item) => item.group === "foundation"),
    structure: items.filter((item) => item.group === "structure"),
    "exit-content": items.filter((item) => item.group === "exit-content"),
    "enter-content": items.filter((item) => item.group === "enter-content"),
    emphasis: items.filter((item) => item.group === "emphasis"),
    decorative: items.filter((item) => item.group === "decorative")
  } satisfies Record<ZeroMotionOrderGroup, ZeroMotionOrderItem[]>;
  const roleByLayerId = Object.fromEntries(items.map((item) => [item.layerId, item.role]));
  const summary = [
    `foundation ${groups.foundation.length}`,
    `structure ${groups.structure.length}`,
    `exit ${groups["exit-content"].length}`,
    `enter ${groups["enter-content"].length}`,
    `emphasis ${groups.emphasis.length}`,
    spec ? spec.scene.type : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    schemaVersion: "motion-copilot.zero-motion-order-plan.v1",
    groups,
    items,
    roleByLayerId,
    summary
  };
}

export function orderItemForStep(
  plan: ZeroMotionOrderPlan | undefined,
  step: CompositionStep
): ZeroMotionOrderItem | undefined {
  if (!step.layerId) return undefined;
  return plan?.items.find((item) => item.layerId === step.layerId);
}
