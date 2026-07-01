import type {
  Bounds,
  FrameElement,
  FrameObject,
  FrameObjectKind,
  FrameObjectModel,
  FrameSnapshot,
  ZeroVisualNode,
  ZeroVisualSnapshot
} from "./schema";

function isFrameSnapshot(snap: ZeroVisualSnapshot | FrameSnapshot): snap is FrameSnapshot {
  return "elements" in snap;
}

function boundsContains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.w <= outer.x + outer.w + 1 &&
    inner.y + inner.h <= outer.y + outer.h + 1
  );
}

function mergeBounds(items: Bounds[]): Bounds {
  if (items.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of items) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function inferObjectName(elements: Array<{ kind: string; text?: string; name: string }>): string {
  const textEl = elements.find((e) => e.kind === "text" && e.text);
  if (textEl?.text) {
    const trimmed = textEl.text.trim();
    return trimmed.length > 20 ? trimmed.slice(0, 20) + "…" : trimmed;
  }
  const nonGeneric = elements.find((e) => !isGenericName(e.name));
  if (nonGeneric) return nonGeneric.name;
  return elements[0]?.name ?? "对象";
}

function isGenericName(name: string): boolean {
  return /^(组|矩形|圆形|文字|图片|线段)\s*\d*$/.test(name);
}

function classifyKind(
  element: FrameElement,
  children: FrameElement[]
): FrameObjectKind {
  if (element.kind === "text") return "text";
  if (element.kind === "image" || (element.kind === "vector" && !children.length)) return "asset";
  if (element.kind === "group" || element.kind === "rect") {
    if (children.length > 0) return "container";
    if (element.style?.background || element.kind === "rect") return "asset";
  }
  return "unknown";
}

function classifyZeroNodeKind(node: ZeroVisualNode, contained: ZeroVisualNode[]): FrameObjectKind {
  if (node.kind === "text") return "text";
  if (node.kind === "image" || (node.kind === "vector" && !contained.length)) return "asset";
  if (node.kind === "group") {
    if (contained.length > 0) return "container";
    return "asset";
  }
  return "unknown";
}

interface TreeNode {
  element: FrameElement;
  children: TreeNode[];
}

function buildTree(elements: FrameElement[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const el of elements) {
    map.set(el.key, { element: el, children: [] });
  }

  for (const el of elements) {
    const node = map.get(el.key)!;
    if (el.parentKey && map.has(el.parentKey)) {
      map.get(el.parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function treeNodeToObject(node: TreeNode, idCounter: { n: number }): FrameObject {
  const id = `obj-${idCounter.n++}`;
  const allDescendants = collectDescendants(node);
  const kind = classifyKind(node.element, node.children.map((c) => c.element));

  const childObjects: FrameObject[] = [];
  const nodeIds: string[] = [node.element.nodeId];

  if (kind === "container" && node.children.length > 0) {
    for (const child of node.children) {
      const childObj = treeNodeToObject(child, idCounter);
      if (childObj.kind === "asset" && isBackgroundElement(child.element, node.element)) {
        nodeIds.push(child.element.nodeId);
      } else {
        childObjects.push(childObj);
      }
    }
  } else {
    for (const desc of allDescendants) {
      nodeIds.push(desc.element.nodeId);
    }
  }

  const bounds: Bounds = { x: node.element.x, y: node.element.y, w: node.element.w, h: node.element.h };
  const nameElements = [node.element, ...allDescendants.map((d) => d.element)];
  const name = inferObjectName(nameElements);
  const confidence = kind === "unknown" ? 50 : 85;

  return { id, kind, name, nodeIds, bounds, children: childObjects, confidence };
}

function isBackgroundElement(child: FrameElement, parent: FrameElement): boolean {
  const wRatio = child.w / Math.max(parent.w, 1);
  const hRatio = child.h / Math.max(parent.h, 1);
  return (
    wRatio > 0.9 &&
    hRatio > 0.9 &&
    (child.kind === "rect" || child.kind === "vector") &&
    (!!child.style?.background || child.kind === "vector")
  );
}

function collectDescendants(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  for (const child of node.children) {
    result.push(child);
    result.push(...collectDescendants(child));
  }
  return result;
}

function buildFromFrameSnapshot(snapshot: FrameSnapshot): FrameObjectModel {
  const tree = buildTree(snapshot.elements);
  const idCounter = { n: 1 };
  const objects: FrameObject[] = [];
  const allNodeIds = new Set(snapshot.elements.map((e) => e.nodeId));
  const resolvedNodeIds = new Set<string>();

  for (const root of tree) {
    const obj = treeNodeToObject(root, idCounter);
    objects.push(obj);
    for (const nid of obj.nodeIds) resolvedNodeIds.add(nid);
    for (const child of flattenObjects(obj.children)) {
      for (const nid of child.nodeIds) resolvedNodeIds.add(nid);
    }
  }

  const unresolvedNodeIds = [...allNodeIds].filter((id) => !resolvedNodeIds.has(id));
  return { frameId: snapshot.frameId, objects, unresolvedNodeIds };
}

function flattenObjects(objects: FrameObject[]): FrameObject[] {
  const result: FrameObject[] = [];
  for (const obj of objects) {
    result.push(obj);
    result.push(...flattenObjects(obj.children));
  }
  return result;
}

function buildFromZeroVisualSnapshot(snapshot: ZeroVisualSnapshot): FrameObjectModel {
  const nodes = snapshot.nodes;
  const idCounter = { n: 1 };
  const objects: FrameObject[] = [];
  const resolvedNodeIds = new Set<string>();

  const sorted = [...nodes].sort((a, b) => (b.bounds.w * b.bounds.h) - (a.bounds.w * a.bounds.h));
  const assigned = new Set<string>();

  for (const node of sorted) {
    if (assigned.has(node.nodeId)) continue;

    const contained = nodes.filter(
      (n) => n.nodeId !== node.nodeId && !assigned.has(n.nodeId) && boundsContains(node.bounds, n.bounds)
    );

    const kind = classifyZeroNodeKind(node, contained);
    const nodeIds = [node.nodeId];
    const childObjects: FrameObject[] = [];

    if (kind === "container" && contained.length > 0) {
      for (const child of contained) {
        if (assigned.has(child.nodeId)) continue;
        const childContained = nodes.filter(
          (n) => n.nodeId !== child.nodeId && !assigned.has(n.nodeId) && boundsContains(child.bounds, n.bounds)
        );
        const childKind = classifyZeroNodeKind(child, childContained);

        if (isZeroBackground(child, node)) {
          nodeIds.push(child.nodeId);
          assigned.add(child.nodeId);
        } else {
          const childNodeIds = [child.nodeId];
          assigned.add(child.nodeId);
          const childName = child.text?.trim() || child.name;
          childObjects.push({
            id: `obj-${idCounter.n++}`,
            kind: childKind,
            name: childName.length > 20 ? childName.slice(0, 20) + "…" : childName,
            nodeIds: childNodeIds,
            bounds: child.bounds,
            children: [],
            confidence: childKind === "unknown" ? 50 : 80
          });
          resolvedNodeIds.add(child.nodeId);
        }
      }
    }

    assigned.add(node.nodeId);
    resolvedNodeIds.add(node.nodeId);

    const name = node.text?.trim() || (isGenericName(node.name) ? `${kind}-${idCounter.n}` : node.name);
    objects.push({
      id: `obj-${idCounter.n++}`,
      kind,
      name: name.length > 20 ? name.slice(0, 20) + "…" : name,
      nodeIds,
      bounds: node.bounds,
      children: childObjects,
      confidence: kind === "unknown" ? 50 : 80
    });
  }

  const unresolvedNodeIds = nodes
    .filter((n) => !resolvedNodeIds.has(n.nodeId))
    .map((n) => n.nodeId);

  return { frameId: snapshot.frameId, objects, unresolvedNodeIds };
}

function isZeroBackground(child: ZeroVisualNode, parent: ZeroVisualNode): boolean {
  const wRatio = child.bounds.w / Math.max(parent.bounds.w, 1);
  const hRatio = child.bounds.h / Math.max(parent.bounds.h, 1);
  return wRatio > 0.9 && hRatio > 0.9 && (child.kind === "rect" || child.kind === "vector");
}

export function buildFrameObjectModel(snapshot: ZeroVisualSnapshot | FrameSnapshot): FrameObjectModel {
  if (isFrameSnapshot(snapshot)) {
    return buildFromFrameSnapshot(snapshot);
  }
  return buildFromZeroVisualSnapshot(snapshot);
}
