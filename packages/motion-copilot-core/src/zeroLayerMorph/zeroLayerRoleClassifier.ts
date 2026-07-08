import type { ZeroLayerMorphSource, ZeroLayerNode, ZeroLayerSnapshot } from "./schema";

export type ZeroLayerSemanticRole =
  | "root-container"
  | "background"
  | "surface"
  | "mask"
  | "content-text"
  | "icon"
  | "action"
  | "badge"
  | "divider"
  | "decorative"
  | "unknown";

export type ZeroLayerRoleClassification = {
  nodeId: string;
  role: ZeroLayerSemanticRole;
  confidence: number;
  reasons: string[];
};

export type ZeroLayerRoleClassificationResult = {
  schemaVersion: "motion-copilot.zero-layer-role-classification.v1";
  from: ZeroLayerRoleClassification[];
  to: ZeroLayerRoleClassification[];
};

const keywordRoles: Array<{ role: ZeroLayerSemanticRole; keywords: string[] }> = [
  {
    role: "mask",
    keywords: ["遮罩", "蒙层", "mask", "overlay"]
  },
  {
    role: "background",
    keywords: ["背景", "background", "bg"]
  },
  {
    role: "surface",
    keywords: ["底板", "容器", "卡片", "弹层", "面板", "container", "card", "panel", "sheet", "surface"]
  },
  {
    role: "content-text",
    keywords: ["标题", "正文", "文案", "文字", "文本", "title", "text", "label", "copy"]
  },
  {
    role: "action",
    keywords: ["按钮", "button", "action", "cta"]
  },
  {
    role: "icon",
    keywords: ["图标", "箭头", "icon", "arrow"]
  },
  {
    role: "badge",
    keywords: ["状态", "胶囊", "角标", "标签", "badge", "pill", "tag", "status"]
  },
  {
    role: "divider",
    keywords: ["分割线", "divider", "line", "separator"]
  }
];

function area(node: ZeroLayerNode): number {
  return Math.max(0, node.bounds.w) * Math.max(0, node.bounds.h);
}

function snapshotArea(snapshot: ZeroLayerSnapshot): number {
  return Math.max(1, snapshot.width * snapshot.height);
}

function isBlackish(color: string | undefined): boolean {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  return normalized === "#000" || normalized === "#000000" || normalized === "black" || normalized.includes("0,0,0");
}

function solidFillOpacity(node: ZeroLayerNode): number | undefined {
  const fill = node.fills?.find((item) => item.type === "solid");
  return fill?.opacity ?? node.opacity;
}

function solidFillColor(node: ZeroLayerNode): string | undefined {
  const fill = node.fills?.find((item) => item.type === "solid");
  return fill?.color;
}

function keywordRole(name: string): { role: ZeroLayerSemanticRole; keyword: string } | undefined {
  const lower = name.toLowerCase();
  for (const item of keywordRoles) {
    const keyword = item.keywords.find((candidate) => lower.includes(candidate.toLowerCase()));
    if (keyword) return { role: item.role, keyword };
  }
  return undefined;
}

function hasChildren(node: ZeroLayerNode): boolean {
  return (node.children?.length ?? 0) > 0;
}

function isPillLike(node: ZeroLayerNode): boolean {
  const radius = node.cornerRadius ?? 0;
  return node.bounds.w >= node.bounds.h * 1.8 && radius >= Math.max(8, node.bounds.h * 0.35);
}

function isLargeLayer(node: ZeroLayerNode, snapshot: ZeroLayerSnapshot): boolean {
  return area(node) / snapshotArea(snapshot) >= 0.55;
}

function classifyNode(snapshot: ZeroLayerSnapshot, node: ZeroLayerNode): ZeroLayerRoleClassification {
  const reasons: string[] = [];
  let role: ZeroLayerSemanticRole = "unknown";
  let confidence = 32;

  if (node.nodeId === snapshot.nodeId || node.nodeId === snapshot.frameId) {
    role = "root-container";
    confidence = 98;
    reasons.push("节点是当前 Zero 帧根节点");
    return { nodeId: node.nodeId, role, confidence, reasons };
  }

  const named = keywordRole(node.name);
  if (named && confidence < 92) {
    role = named.role;
    confidence = 88;
    reasons.push(`名称命中「${named.keyword}」`);
  }

  if (node.kind === "text") {
    role = "content-text";
    confidence = Math.max(confidence, 94);
    reasons.push("Zero kind 为 text");
  } else if (node.kind === "line" || node.bounds.w <= 2 || node.bounds.h <= 2) {
    role = "divider";
    confidence = Math.max(confidence, 82);
    reasons.push("线性或极细图层");
  } else if (node.kind === "vector" || node.kind === "boolean" || node.kind === "polygon" || node.kind === "star") {
    role = area(node) < snapshotArea(snapshot) * 0.08 ? "icon" : "decorative";
    confidence = Math.max(confidence, 76);
    reasons.push("矢量图层按面积识别");
  } else if (node.kind === "ellipse") {
    role = area(node) < snapshotArea(snapshot) * 0.06 ? "icon" : "decorative";
    confidence = Math.max(confidence, 68);
    reasons.push("椭圆图层按面积识别");
  }

  const opacity = solidFillOpacity(node);
  if (isLargeLayer(node, snapshot) && isBlackish(solidFillColor(node)) && opacity != null && opacity <= 0.55) {
    role = "mask";
    confidence = Math.max(confidence, 90);
    reasons.push("大面积低透明黑色层");
  } else if (node.kind !== "text" && isPillLike(node)) {
    role = named?.role === "action" ? "action" : "badge";
    confidence = Math.max(confidence, named ? 90 : 78);
    reasons.push("宽高比和圆角接近胶囊");
  } else if (
    node.kind !== "text" &&
    (node.kind === "frame" || node.kind === "group" || node.kind === "component" || node.kind === "instance") &&
    hasChildren(node)
  ) {
    role = named?.role === "action" || area(node) < snapshotArea(snapshot) * 0.18 ? "action" : "surface";
    confidence = Math.max(confidence, named ? 88 : 74);
    reasons.push("组合节点包含子内容");
  } else if (node.kind === "rect" && isLargeLayer(node, snapshot)) {
    role = node.bounds.x <= 2 && node.bounds.y <= 2 ? "background" : "surface";
    confidence = Math.max(confidence, 76);
    reasons.push("大面积矩形层");
  } else if (role === "unknown" && area(node) < snapshotArea(snapshot) * 0.015) {
    role = "decorative";
    confidence = 54;
    reasons.push("小面积非文本图层");
  }

  if (reasons.length === 0) reasons.push("未命中明确名称、结构或几何规则");
  return { nodeId: node.nodeId, role, confidence, reasons };
}

export function classifyZeroLayerSnapshotRoles(
  snapshot: ZeroLayerSnapshot
): ZeroLayerRoleClassification[] {
  return snapshot.layers.map((node) => classifyNode(snapshot, node));
}

export function classifyZeroLayerRoles(source: ZeroLayerMorphSource): ZeroLayerRoleClassificationResult {
  return {
    schemaVersion: "motion-copilot.zero-layer-role-classification.v1",
    from: classifyZeroLayerSnapshotRoles(source.from),
    to: classifyZeroLayerSnapshotRoles(source.to)
  };
}

export function zeroLayerRoleSummary(
  roles: ZeroLayerRoleClassification[]
): Record<ZeroLayerSemanticRole, number> {
  const summary = {
    "root-container": 0,
    background: 0,
    surface: 0,
    mask: 0,
    "content-text": 0,
    icon: 0,
    action: 0,
    badge: 0,
    divider: 0,
    decorative: 0,
    unknown: 0
  } satisfies Record<ZeroLayerSemanticRole, number>;
  for (const item of roles) summary[item.role] += 1;
  return summary;
}
