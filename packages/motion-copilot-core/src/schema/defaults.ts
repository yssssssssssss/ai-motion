import {
  createClassicEasing,
  createSpringEasing,
  layerById,
  primaryElement,
  type LayerOrderAction,
  type MotionDocument,
  type MotionDocumentPatch,
  type MotionElement,
  type MotionLayer,
  type MotionLayerLayout,
  type MotionLayerMotion,
  type MotionRole,
  type MotionState,
  type MotionTimeline
} from "./document";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function baseDocument(
  element: MotionElement,
  timeline: MotionTimeline,
  layers: MotionLayer[]
): MotionDocument {
  const selectedLayerId = layers.find((layer) => layer.editable)?.id;
  return {
    version: "0.1",
    stage: {
      mode: "mobile",
      width: 430,
      height: 720,
      background: "#eef2f6",
      backgroundFit: "cover",
      backgroundPosition: "center",
      showSafeArea: false
    },
    elements: [element],
    layers,
    ...(selectedLayerId ? { selectedLayerId } : {}),
    appliedPresets: [],
    presetResolutions: [],
    timeline,
    guidelineSuggestions: []
  };
}

const modalLayers: MotionLayer[] = [
  { id: "modal-container", name: "弹窗容器", kind: "group", editable: false },
  {
    id: "modal-title",
    name: "标题",
    kind: "text",
    parentId: "modal-container",
    editable: true,
    content: { text: "新品上线提醒" },
    style: { fontSize: 16, fontWeight: 780, lineHeight: 1.4, textAlign: "left" }
  },
  {
    id: "modal-body",
    name: "正文",
    kind: "text",
    parentId: "modal-container",
    editable: true,
    content: { text: "这里展示关键说明，帮助用户快速理解当前状态。" },
    style: { fontSize: 13, fontWeight: 400, lineHeight: 1.5, textAlign: "left" }
  },
  {
    id: "modal-image",
    name: "图片位",
    kind: "image",
    parentId: "modal-container",
    editable: true,
    content: { alt: "弹窗图片" },
    style: { background: "#d8e8e0", radius: 12, fit: "cover", position: "center" }
  },
  {
    id: "modal-secondary",
    name: "次按钮",
    kind: "button",
    parentId: "modal-container",
    editable: true,
    content: { text: "稍后再说" },
    style: { background: "#eef2f6", color: "#57606a", radius: 8 }
  },
  {
    id: "modal-primary",
    name: "主按钮",
    kind: "button",
    parentId: "modal-container",
    editable: true,
    content: { text: "立即查看" },
    style: { background: "#1f7a63", color: "#ffffff", radius: 8 }
  }
];

const toastLayers: MotionLayer[] = [
  {
    id: "toast-icon",
    name: "图标",
    kind: "icon",
    editable: true,
    content: { icon: "check" },
    style: { color: "#54d6a4" }
  },
  {
    id: "toast-title",
    name: "主文案",
    kind: "text",
    editable: true,
    content: { text: "操作已完成" },
    style: { fontSize: 14, fontWeight: 760, lineHeight: 1.4, textAlign: "center" }
  },
  {
    id: "toast-message",
    name: "副文案",
    kind: "text",
    editable: true,
    content: { text: "系统已同步当前修改。" },
    style: { fontSize: 12, fontWeight: 400, lineHeight: 1.5, textAlign: "center" }
  },
  {
    id: "toast-background",
    name: "背景",
    kind: "shape",
    editable: true,
    style: { background: "#17202a", radius: 14, opacity: 1 }
  }
];

const buttonLayers: MotionLayer[] = [
  {
    id: "button-label",
    name: "按钮文案",
    kind: "button",
    editable: true,
    content: { text: "立即查看" },
    style: { background: "#0f5c8a", color: "#ffffff", radius: 14 }
  },
  {
    id: "button-icon",
    name: "按钮图标",
    kind: "icon",
    editable: true,
    hidden: true,
    content: { icon: "arrow" },
    style: { color: "#ffffff" }
  }
];

const defaultDocuments: Record<MotionRole, MotionDocument> = {
  modal: baseDocument(
    {
      id: "primary",
      name: "Modal",
      role: "modal",
      size: "medium",
      initial: { y: 24, scale: 0.96, opacity: 0, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "load",
      direction: "enter",
      durationMs: 260,
      delayMs: 0,
      easing: createClassicEasing("decelerate"),
      repeat: "none"
    },
    modalLayers
  ),
  toast: baseDocument(
    {
      id: "primary",
      name: "Toast",
      role: "toast",
      size: "small",
      initial: { y: 12, scale: 1, opacity: 0, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "load",
      direction: "enter",
      durationMs: 180,
      delayMs: 0,
      easing: createClassicEasing("decelerate"),
      repeat: "none"
    },
    toastLayers
  ),
  button: baseDocument(
    {
      id: "primary",
      name: "Button",
      role: "button",
      size: "small",
      initial: { y: 0, scale: 1, opacity: 1, blur: 0 },
      animate: { y: 0, scale: 0.96, opacity: 1, blur: 0 }
    },
    {
      trigger: "click",
      direction: "move-inside",
      durationMs: 160,
      delayMs: 0,
      easing: createSpringEasing(),
      repeat: "none"
    },
    buttonLayers
  ),
  card: baseDocument(
    {
      id: "primary",
      name: "Card",
      role: "card",
      size: "medium",
      initial: { y: 16, scale: 0.96, opacity: 0, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "click",
      direction: "enter",
      durationMs: 280,
      delayMs: 0,
      easing: createSpringEasing({ stiffness: 200, damping: 20 }),
      repeat: "none"
    },
    [{ id: "card-content", name: "卡片内容", kind: "group", editable: true, content: { text: "商品卡片" } }]
  ),
  list: baseDocument(
    {
      id: "primary",
      name: "List",
      role: "list",
      size: "medium",
      initial: { y: 12, scale: 1, opacity: 0, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "load",
      direction: "enter",
      durationMs: 220,
      delayMs: 0,
      easing: createClassicEasing("decelerate"),
      repeat: "none"
    },
    [{ id: "list-item", name: "列表项", kind: "text", editable: true, content: { text: "列表内容" } }]
  ),
  nav: baseDocument(
    {
      id: "primary",
      name: "NavBar",
      role: "nav",
      size: "small",
      initial: { y: 0, scale: 1, opacity: 1, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "load",
      direction: "move-inside",
      durationMs: 120,
      delayMs: 0,
      easing: createClassicEasing("standard"),
      repeat: "none"
    },
    [{ id: "nav-title", name: "导航标题", kind: "text", editable: true, content: { text: "页面标题" } }]
  ),
  "tab-bar": baseDocument(
    {
      id: "primary",
      name: "TabBar",
      role: "tab-bar",
      size: "small",
      initial: { y: 0, scale: 1, opacity: 1, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "click",
      direction: "move-inside",
      durationMs: 150,
      delayMs: 0,
      easing: createClassicEasing("standard"),
      repeat: "none"
    },
    [
      {
        id: "tab-indicator",
        name: "指示器",
        kind: "shape",
        editable: true,
        style: { background: "#1f7a63", radius: 2 }
      }
    ]
  ),
  fab: baseDocument(
    {
      id: "primary",
      name: "FAB",
      role: "fab",
      size: "small",
      initial: { y: 8, scale: 0.9, opacity: 0, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "load",
      direction: "enter",
      durationMs: 180,
      delayMs: 0,
      easing: createClassicEasing("decelerate"),
      repeat: "none"
    },
    [
      {
        id: "fab-icon",
        name: "图标",
        kind: "icon",
        editable: true,
        content: { icon: "arrow" },
        style: { color: "#ffffff" }
      }
    ]
  ),
  background: baseDocument(
    {
      id: "primary",
      name: "Background",
      role: "background",
      size: "large",
      initial: { y: 0, scale: 1, opacity: 0, blur: 0 },
      animate: { y: 0, scale: 1, opacity: 1, blur: 0 }
    },
    {
      trigger: "load",
      direction: "enter",
      durationMs: 300,
      delayMs: 0,
      easing: createClassicEasing("standard"),
      repeat: "none"
    },
    [
      {
        id: "bg-layer",
        name: "背景层",
        kind: "shape",
        editable: true,
        style: { background: "#f6f8fa", radius: 0 }
      }
    ]
  )
};

function mergeState(base: MotionState, patch?: Partial<MotionState>): MotionState {
  return patch ? { ...base, ...patch } : { ...base };
}

function mergeLayout(
  base: MotionLayerLayout | undefined,
  patch: Partial<MotionLayerLayout>
): MotionLayerLayout {
  const zIndex = patch.zIndex ?? base?.zIndex;
  const aspectLocked = patch.aspectLocked ?? base?.aspectLocked;
  return {
    x: patch.x ?? base?.x ?? 0,
    y: patch.y ?? base?.y ?? 0,
    width: patch.width ?? base?.width ?? 120,
    height: patch.height ?? base?.height ?? 80,
    ...(typeof aspectLocked === "boolean" ? { aspectLocked } : {}),
    ...(typeof zIndex === "number" ? { zIndex } : {})
  };
}

function mergeLayerMotion(
  base: MotionLayerMotion | undefined,
  patch: Partial<MotionLayerMotion>
): MotionLayerMotion {
  const direction = patch.direction ?? base?.direction;
  const distance = patch.distance ?? base?.distance;
  const scaleFrom = patch.scaleFrom ?? base?.scaleFrom;
  const opacityFrom = patch.opacityFrom ?? base?.opacityFrom;
  const opacityTo = patch.opacityTo ?? base?.opacityTo;
  const easing = patch.easing ?? base?.easing;
  const result: MotionLayerMotion = {
    preset: patch.preset ?? base?.preset ?? "none",
    durationMs: patch.durationMs ?? base?.durationMs ?? 220,
    delayMs: patch.delayMs ?? base?.delayMs ?? 0
  };
  if (direction) result.direction = direction;
  if (typeof distance === "number") result.distance = distance;
  if (typeof scaleFrom === "number") result.scaleFrom = scaleFrom;
  if (typeof opacityFrom === "number") result.opacityFrom = opacityFrom;
  if (typeof opacityTo === "number") result.opacityTo = opacityTo;
  if (easing) result.easing = easing;
  return result;
}

function applyElementPatch(
  element: MotionElement,
  patch: NonNullable<MotionDocumentPatch["element"]>
): MotionElement {
  return {
    ...element,
    ...(patch.id ? { id: patch.id } : {}),
    ...(patch.name ? { name: patch.name } : {}),
    ...(patch.role ? { role: patch.role } : {}),
    ...(patch.size ? { size: patch.size } : {}),
    initial: mergeState(element.initial, patch.initial),
    animate: mergeState(element.animate, patch.animate)
  };
}

function applyLayerPatch(
  layers: MotionLayer[],
  patch: NonNullable<MotionDocumentPatch["layer"]>
): MotionLayer[] {
  return layers.map((layer) => {
    if (layer.id !== patch.id) return layer;
    return {
      ...layer,
      ...(patch.name ? { name: patch.name } : {}),
      ...(typeof patch.hidden === "boolean" ? { hidden: patch.hidden } : {}),
      ...(typeof patch.locked === "boolean" ? { locked: patch.locked } : {}),
      ...(patch.content ? { content: { ...(layer.content ?? {}), ...patch.content } } : {}),
      ...(patch.style ? { style: { ...(layer.style ?? {}), ...patch.style } } : {}),
      ...(patch.layout ? { layout: mergeLayout(layer.layout, patch.layout) } : {}),
      ...(patch.motion ? { motion: mergeLayerMotion(layer.motion, patch.motion) } : {})
    };
  });
}

function isLayerDescendant(layer: MotionLayer, removedId: string, layers: MotionLayer[]): boolean {
  let parentId = layer.parentId;
  while (parentId) {
    if (parentId === removedId) return true;
    parentId = layers.find((item) => item.id === parentId)?.parentId;
  }
  return false;
}

function applyLayerAddRemove(layers: MotionLayer[], patch: MotionDocumentPatch): MotionLayer[] {
  const removedId = patch.removeLayerId;
  const removed = removedId
    ? layers.filter((layer) => layer.id !== removedId && !isLayerDescendant(layer, removedId, layers))
    : layers;

  if (!patch.addLayer) return removed;
  if (removed.some((layer) => layer.id === patch.addLayer?.id)) return removed;
  return [...removed, clone(patch.addLayer)];
}

function moveIndex(index: number, action: LayerOrderAction, length: number): number {
  if (action === "front") return length - 1;
  if (action === "back") return 0;
  if (action === "forward") return Math.min(length - 1, index + 1);
  return Math.max(0, index - 1);
}

function applyLayerReorder(layers: MotionLayer[], patch: MotionDocumentPatch): MotionLayer[] {
  if (!patch.reorderLayer) return layers;

  const orderedLayoutLayers = layers
    .filter((layer) => layer.layout)
    .sort((left, right) => (left.layout?.zIndex ?? 0) - (right.layout?.zIndex ?? 0));
  const from = orderedLayoutLayers.findIndex((layer) => layer.id === patch.reorderLayer?.id);
  if (from < 0) return layers;

  const to = moveIndex(from, patch.reorderLayer.action, orderedLayoutLayers.length);
  if (to === from) return layers;

  const moved = [...orderedLayoutLayers];
  const [layer] = moved.splice(from, 1);
  if (!layer) return layers;
  moved.splice(to, 0, layer);

  const zIndexById = new Map(moved.map((item, index) => [item.id, 31 + index]));
  return layers.map((layerItem) => {
    const zIndex = zIndexById.get(layerItem.id);
    return typeof zIndex === "number" && layerItem.layout
      ? { ...layerItem, layout: { ...layerItem.layout, zIndex } }
      : layerItem;
  });
}

export function createDefaultDocument(role: MotionRole = "modal"): MotionDocument {
  return clone(defaultDocuments[role]);
}

export function applyDocumentPatch(document: MotionDocument, patch: MotionDocumentPatch): MotionDocument {
  const nextBase =
    patch.element?.role && patch.element.role !== primaryElement(document).role
      ? createDefaultDocument(patch.element.role)
      : clone(document);

  const current = primaryElement(nextBase);
  const nextElement = patch.element ? applyElementPatch(current, patch.element) : current;
  const patchedLayers = patch.layer ? applyLayerPatch(nextBase.layers, patch.layer) : nextBase.layers;
  const nextLayers = applyLayerReorder(applyLayerAddRemove(patchedLayers, patch), patch);
  const requestedLayerId =
    patch.selectedLayerId ?? patch.addLayer?.id ?? patch.reorderLayer?.id ?? nextBase.selectedLayerId;
  const selectedLayerId =
    requestedLayerId && layerById({ ...nextBase, layers: nextLayers }, requestedLayerId)
      ? requestedLayerId
      : nextLayers.find((layer) => layer.editable)?.id;

  const visualSource =
    patch.removeLayerId && nextBase.visualSource && !nextLayers.some((layer) => layer.editable)
      ? undefined
      : nextBase.visualSource;

  const result: MotionDocument = {
    ...nextBase,
    ...(patch.stage ? { stage: { ...nextBase.stage, ...patch.stage } } : {}),
    elements: [nextElement],
    layers: nextLayers,
    appliedPresets: patch.appliedPresets ? clone(patch.appliedPresets) : (nextBase.appliedPresets ?? []),
    presetResolutions: patch.presetResolutions
      ? clone(patch.presetResolutions)
      : (nextBase.presetResolutions ?? []),
    timeline: patch.timeline ? { ...nextBase.timeline, ...patch.timeline } : nextBase.timeline,
    guidelineSuggestions: [],
    ...(visualSource ? { visualSource } : {})
  };
  if (selectedLayerId) result.selectedLayerId = selectedLayerId;
  else delete result.selectedLayerId;
  if (!visualSource) delete result.visualSource;
  return result;
}
