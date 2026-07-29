import type { ZeroLayerNode } from "./schema";

/**
 * Zero 图层动效的 layerId 权威拼接。生产端(compile/recipes/ordering)与
 * 消费端(export 反查、UI 渲染)必须共用此函数,否则同一 nodeId 经不同 slug
 * 规则会产出不同 layerId,导致 step 反查落空、enter/exit 动画静默丢失。
 */
export function layerIdFromNodeId(nodeId: string): string {
  const slug = nodeId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `zero-layer-${slug || "node"}`;
}

export function layerIdForNode(node: ZeroLayerNode): string {
  return layerIdFromNodeId(node.nodeId);
}
