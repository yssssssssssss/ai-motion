import {
  zeroLayerExpressionStrategies,
  type ZeroLayerExpressionStrategyId
} from "./zeroLayerExpressionStrategies";
import type { ZeroLayerMotionRecipeCategory, ZeroLayerMotionRecipeId } from "./zeroLayerMotionRecipes";
import type { ZeroMotionSceneType } from "./zeroMotionSpec";

export type ZeroLayerRecipeIntent =
  | "state-transition"
  | "continuity"
  | "reveal"
  | "attention"
  | "navigation"
  | "feedback";

export type ZeroLayerRecipeTarget =
  | "container"
  | "text"
  | "list"
  | "tab"
  | "sheet"
  | "popover"
  | "card"
  | "status"
  | "mixed";

export type ZeroLayerRecipeManifest = {
  id: ZeroLayerMotionRecipeId;
  label: string;
  summary: string;
  category: ZeroLayerMotionRecipeCategory;
  sceneTypes: ZeroMotionSceneType[];
  targets: ZeroLayerRecipeTarget[];
  intent: ZeroLayerRecipeIntent;
  bestFor: string[];
  avoidWhen: string[];
  restraint: {
    maxPerView: number;
    intensity: "subtle" | "balanced" | "strong";
    notes: string;
  };
  expressionStrategies: ZeroLayerExpressionStrategyId[];
  capabilities: {
    handlesEnterExit: boolean;
    handlesReorder: boolean;
    handlesSubtleMotion: boolean;
    requiresMatchedGeometry: boolean;
    safeFallback: boolean;
  };
  safety: {
    tailLock: true;
    corridorPolicy: "strict";
    reducedMotion: "crossfade" | "shorten" | "none";
  };
  mobileGuidance: {
    expectedFeel: string;
    inspectionChecklist: string[];
  };
};

export type ZeroLayerRecipeManifestValidation = {
  code:
    | "MANIFEST_RECIPE_COUNT_MISMATCH"
    | "MANIFEST_RECIPE_ID_DUPLICATE"
    | "MANIFEST_RECIPE_ID_MISSING"
    | "MANIFEST_RECIPE_ID_UNKNOWN"
    | "MANIFEST_EXPRESSION_STRATEGY_UNKNOWN"
    | "MANIFEST_SAFETY_POLICY_INVALID"
    | "MANIFEST_MOBILE_GUIDANCE_MISSING";
  severity: "warning" | "error";
  recipeId?: ZeroLayerMotionRecipeId;
  message: string;
};

export const zeroLayerRecipeManifestIds = [
  "smooth-morph",
  "spring-expand",
  "status-switch",
  "container-first",
  "content-stagger",
  "mask-reveal",
  "dropdown-reveal",
  "anchored-popover",
  "focus-guide",
  "axis-expand",
  "list-reorder",
  "tab-indicator-slide",
  "card-expand-reveal",
  "list-insert-push",
  "bottom-sheet-rise",
  "content-replace"
] as const satisfies readonly ZeroLayerMotionRecipeId[];

export const zeroLayerRecipeManifests = [
  {
    id: "smooth-morph",
    label: "丝滑形变",
    category: "state",
    summary: "适合常规状态变化：位置、尺寸、透明度一起平顺过渡。",
    sceneTypes: ["unknown", "complex-state-change"],
    targets: ["mixed"],
    intent: "state-transition",
    bestFor: ["首尾帧关系不明确时保持稳妥过渡", "复杂组件需要先保证尾帧还原", "低置信图层匹配的安全兜底"],
    avoidWhen: ["用户需要强烈的方向感或空间展开感", "列表、Tab、底部面板等结构已经很明确"],
    restraint: {
      maxPerView: 2,
      intensity: "subtle",
      notes: "作为安全兜底使用，不承担强表现。"
    },
    expressionStrategies: ["subtle-snap", "linear-morph"],
    capabilities: {
      handlesEnterExit: false,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: true,
      safeFallback: true
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "真机上应是稳定、轻量的首尾形变，不抢注意力。",
      inspectionChecklist: ["尾帧位置和尺寸必须与 Zero 一致", "中段不能出现明显越界或跳变"]
    }
  },
  {
    id: "spring-expand",
    label: "弹性展开",
    category: "expand",
    summary: "适合容器展开：主容器使用一次弹性，其余内容轻微跟随。",
    sceneTypes: ["horizontal-expand", "vertical-expand", "card-enter"],
    targets: ["container", "card"],
    intent: "continuity",
    bestFor: ["主容器尺寸变化明显", "卡片或胶囊从小状态展开", "需要比线性形变更有落位感"],
    avoidWhen: ["页面内已有多个强动效同时发生", "首尾帧几何差异极小"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "弹性感只用于主对象，不能让内容跟着夸张摆动。"
    },
    expressionStrategies: ["spring-settle-contained", "strong-reveal", "axis-expand-contained"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "主容器先快速接近尾帧，再短促稳定到位。",
      inspectionChecklist: ["弹性不能超过首尾帧 corridor", "内容应跟随但不能早于容器抢先出现"]
    }
  },
  {
    id: "status-switch",
    label: "状态切换",
    category: "state",
    summary: "适合标签、按钮、状态文案切换：弱化位移，突出内容替换。",
    sceneTypes: ["tab-switch", "complex-state-change"],
    targets: ["status", "text"],
    intent: "feedback",
    bestFor: ["按钮或状态文案发生替换", "位移不明显但语义状态变化明确", "需要轻量反馈而不是空间展开"],
    avoidWhen: ["主容器存在大幅扩展", "列表项发生明显插入或重排"],
    restraint: {
      maxPerView: 2,
      intensity: "subtle",
      notes: "状态切换应短促明确，避免做成普通淡入淡出。"
    },
    expressionStrategies: ["subtle-snap", "status-snap-replace", "content-cross-replace"],
    capabilities: {
      handlesEnterExit: false,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "状态变化应像一次明确的轻触反馈，文字和高亮稳定替换。",
      inspectionChecklist: ["文案可读性不能被中段透明度破坏", "尾帧状态必须清晰稳定"]
    }
  },
  {
    id: "container-first",
    label: "容器优先",
    category: "expand",
    summary: "适合卡片、胶囊、底板展开：容器先到位，内容再跟随出现。",
    sceneTypes: ["horizontal-expand", "vertical-expand", "card-enter", "modal-enter"],
    targets: ["container", "card", "mixed"],
    intent: "continuity",
    bestFor: ["用户需要先理解承载空间变化", "容器和内容都有变化", "信息卡片或胶囊展开"],
    avoidWhen: ["只有文本替换没有容器变化", "列表插入导致多项需要让位"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "容器先行是主叙事，内容延迟只做辅助。"
    },
    expressionStrategies: ["container-hold-content-rise", "staged-container", "delayed-follow"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "先看到底板扩展，再看到内容进入，空间关系清楚。",
      inspectionChecklist: ["容器层不应被内容层盖住", "新增内容应在容器稳定后出现"]
    }
  },
  {
    id: "content-stagger",
    label: "内容错峰",
    category: "content",
    summary: "适合多文字、多图标组件：按阅读顺序分批进入。",
    sceneTypes: ["horizontal-expand", "vertical-expand", "list-reorder", "tab-switch"],
    targets: ["text", "list", "mixed"],
    intent: "reveal",
    bestFor: ["多个内容元素同时变化", "需要按照阅读顺序呈现", "内容比容器更重要"],
    avoidWhen: ["只有一个主对象变化", "需要强空间推开或底部面板上升"],
    restraint: {
      maxPerView: 2,
      intensity: "subtle",
      notes: "错峰间隔要短，避免真机上显得拖沓。"
    },
    expressionStrategies: ["vertical-stack-reveal", "delayed-follow", "content-cross-replace"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "内容按阅读顺序轻微错峰进入，但整体仍是一段紧凑动效。",
      inspectionChecklist: ["错峰顺序应符合从上到下或从左到右", "最后一项不能明显晚于尾帧稳定"]
    }
  },
  {
    id: "mask-reveal",
    label: "遮罩揭示",
    category: "overlay",
    summary: "适合弹层和信息展开：在目标空间内逐步揭示内容。",
    sceneTypes: ["vertical-expand", "card-enter", "modal-enter"],
    targets: ["container", "popover", "card"],
    intent: "reveal",
    bestFor: ["新增内容需要被容器裁切揭示", "卡片或浮层从已有空间展开", "避免内容直接淡入显得松散"],
    avoidWhen: ["首尾帧没有明确容器边界", "列表需要真实推开其他项目"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "遮罩只能服务于目标空间揭示，不做额外扫光装饰。"
    },
    expressionStrategies: ["strong-reveal", "mask-scan-reveal", "clip-reveal-y"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "内容像被目标容器打开一样出现，而不是凭空淡入。",
      inspectionChecklist: ["揭示方向应符合组件展开方向", "裁切范围不能露出尾帧外内容"]
    }
  },
  {
    id: "dropdown-reveal",
    label: "下拉展开",
    category: "overlay",
    summary: "适合菜单和下拉层：容器从触发点向下展开，内容随后进入。",
    sceneTypes: ["modal-enter", "vertical-expand"],
    targets: ["popover", "list", "container"],
    intent: "reveal",
    bestFor: ["筛选、菜单、信息块从触发区下方展开", "尾帧新增内容集中在下方", "需要表达折叠到展开"],
    avoidWhen: ["变化主要发生在横向", "浮层从底部屏幕边缘进入"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "下拉只沿尾帧定义的垂直空间展开，不能额外下坠。"
    },
    expressionStrategies: ["vertical-stack-reveal", "dropdown-accordion-y", "clip-reveal-y"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "真机上应明显感到下拉空间被打开，内容在下拉区域内补入。",
      inspectionChecklist: ["顶部锚点应保持稳定", "下拉内容不能超过尾帧底部范围"]
    }
  },
  {
    id: "anchored-popover",
    label: "锚点浮层",
    category: "overlay",
    summary: "适合锚定触发控件的浮层：从锚点轻微弹出并落位。",
    sceneTypes: ["modal-enter", "card-enter"],
    targets: ["popover", "container"],
    intent: "reveal",
    bestFor: ["浮层与触发按钮位置相邻", "用户需要理解浮层来源", "小型菜单或提示层出现"],
    avoidWhen: ["浮层覆盖整屏或从底部进入", "没有可识别的触发锚点"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "锚点弹出不能变成大幅弹跳，只强调来源关系。"
    },
    expressionStrategies: ["anchor-scale-pop", "anchor-pop-contained", "spring-settle-contained"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "浮层从触发点附近建立存在感，然后稳定到尾帧位置。",
      inspectionChecklist: ["锚点方向不能反", "浮层最终圆角、位置和透明度必须回到尾帧"]
    }
  },
  {
    id: "focus-guide",
    label: "焦点引导",
    category: "navigation",
    summary: "适合导航、状态焦点变化：主对象先动，次级内容随后响应。",
    sceneTypes: ["tab-switch", "complex-state-change"],
    targets: ["tab", "status", "mixed"],
    intent: "navigation",
    bestFor: [
      "当前焦点从一个对象转移到另一个对象",
      "高亮底板或主对象需要先行",
      "页面局部状态变化需要引导视线"
    ],
    avoidWhen: ["没有明确焦点对象", "需要容器大面积展开"],
    restraint: {
      maxPerView: 2,
      intensity: "subtle",
      notes: "焦点引导只突出主对象，避免所有层同时抢动。"
    },
    expressionStrategies: ["focus-snap-shift", "focus-shift-contained", "indicator-slide"],
    capabilities: {
      handlesEnterExit: false,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "视线会被主焦点带到尾帧目标，然后内容稳定跟随。",
      inspectionChecklist: ["焦点对象应先于辅助内容完成主要位移", "焦点变化不能破坏可读性"]
    }
  },
  {
    id: "axis-expand",
    label: "轴向展开",
    category: "expand",
    summary: "适合胶囊、列表项、底部栏：沿主要变化方向完成形变。",
    sceneTypes: ["horizontal-expand", "vertical-expand"],
    targets: ["container", "card", "mixed"],
    intent: "continuity",
    bestFor: ["变化主要集中在单一方向", "横向胶囊或纵向详情展开", "需要比普通形变更明确的方向感"],
    avoidWhen: ["首尾帧同时存在复杂横纵变化", "仅发生文案替换"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "轴向只强化主方向，不添加额外斜向运动。"
    },
    expressionStrategies: [
      "horizontal-stretch-reveal",
      "axis-expand-contained",
      "clip-reveal-x",
      "clip-reveal-y"
    ],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "用户能明显感到组件沿主轴扩展，而不是散乱地变形。",
      inspectionChecklist: ["主轴判断要符合首尾帧最大变化方向", "副轴变化应保持克制"]
    }
  },
  {
    id: "list-reorder",
    label: "列表重排",
    category: "list",
    summary: "适合多个元素重排：按空间顺序依次移动和补位。",
    sceneTypes: ["list-reorder"],
    targets: ["list"],
    intent: "continuity",
    bestFor: ["多个列表项位置发生变化", "用户需要理解项目顺序改变", "没有明显新增项但有重排"],
    avoidWhen: ["只有一个容器展开", "列表新增项需要推开补位"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "重排应服务于位置关系，不做过多透明度变化。"
    },
    expressionStrategies: ["list-displace-push", "list-reorder-cascade"],
    capabilities: {
      handlesEnterExit: false,
      handlesReorder: true,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "列表项按空间关系让位和归位，顺序变化可被感知。",
      inspectionChecklist: ["同列项目不能交叉穿插", "最终层级和位置要与 Zero 尾帧一致"]
    }
  },
  {
    id: "tab-indicator-slide",
    label: "Tab 指示滑移",
    category: "navigation",
    summary: "适合 Tab 或分段控件切换：指示器/高亮底板先横向滑动，内容随后替换。",
    sceneTypes: ["tab-switch", "horizontal-expand"],
    targets: ["tab", "status"],
    intent: "navigation",
    bestFor: ["Tab 或分段控件切换", "高亮底板从一个选项移动到另一个选项", "内容区需要跟随状态替换"],
    avoidWhen: ["没有指示器或高亮底板", "变化主要是纵向展开"],
    restraint: {
      maxPerView: 2,
      intensity: "subtle",
      notes: "指示器先动，内容随后替换，避免所有元素一起淡。"
    },
    expressionStrategies: ["focus-snap-shift", "indicator-slide", "focus-shift-contained"],
    capabilities: {
      handlesEnterExit: false,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "指示器横向滑到目标选项，用户能看懂选中态转移。",
      inspectionChecklist: ["指示器不应越过尾帧范围", "文案替换不能早于指示器主体移动"]
    }
  },
  {
    id: "card-expand-reveal",
    label: "卡片展开揭示",
    category: "expand",
    summary: "适合卡片收起到展开：容器先在首尾空间内扩展，内容被裁切揭示。",
    sceneTypes: ["card-enter", "vertical-expand", "horizontal-expand"],
    targets: ["card", "container"],
    intent: "reveal",
    bestFor: ["卡片从简略态展开到详情态", "卡片内部新增内容较多", "需要同时表达容器扩展和内容出现"],
    avoidWhen: ["没有卡片边界或圆角底板", "只是状态文案替换"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "卡片容器是主角，内部内容应被揭示而不是单纯淡入。"
    },
    expressionStrategies: [
      "container-hold-content-rise",
      "clip-reveal-x",
      "clip-reveal-y",
      "staged-container"
    ],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: true,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "卡片边界先打开，详情内容在卡片内被逐步看见。",
      inspectionChecklist: ["圆角和背景层必须跟随卡片尾帧", "内部内容不能先于卡片边界出现"]
    }
  },
  {
    id: "list-insert-push",
    label: "列表插入推开",
    category: "list",
    summary: "适合新增列表项：已有项按顺序让位，新项从目标空间内补位进入。",
    sceneTypes: ["list-reorder", "vertical-expand"],
    targets: ["list"],
    intent: "continuity",
    bestFor: ["列表出现新增项", "已有项需要为新增内容让位", "用户需要理解空间被插入"],
    avoidWhen: ["没有新增项只有纯排序", "主变化是 Tab 指示器移动"],
    restraint: {
      maxPerView: 1,
      intensity: "balanced",
      notes: "推开补位必须沿列表方向，不能让列表项互相覆盖。"
    },
    expressionStrategies: ["list-displace-push", "list-push-insert", "list-reorder-cascade"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: true,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "已有列表项先让出位置，新项在目标位置补入。",
      inspectionChecklist: ["新增项不能从尾帧范围外飞入", "相邻列表项不能重叠"]
    }
  },
  {
    id: "bottom-sheet-rise",
    label: "底部面板上升",
    category: "overlay",
    summary: "适合底部浮层：蒙层先稳定，面板从尾帧底部空间内上升，内容随后出现。",
    sceneTypes: ["modal-enter", "vertical-expand"],
    targets: ["sheet", "container"],
    intent: "reveal",
    bestFor: ["底部面板或操作抽屉出现", "尾帧内容贴近屏幕底部", "需要表达从底部承载区进入"],
    avoidWhen: ["浮层锚定在按钮附近", "内容从触发区下方下拉"],
    restraint: {
      maxPerView: 1,
      intensity: "strong",
      notes: "强表现只作用于面板进入，尾帧必须锁死。"
    },
    expressionStrategies: ["sheet-dock-rise", "sheet-rise-contained", "delayed-follow"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: false,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "shorten" },
    mobileGuidance: {
      expectedFeel: "底部面板从屏幕底部承载区上升，内容随后稳定出现。",
      inspectionChecklist: ["面板不能越过尾帧顶部", "蒙层和面板层级要保持正确"]
    }
  },
  {
    id: "content-replace",
    label: "内容替换",
    category: "transition",
    summary: "适合文案、局部状态替换：旧内容先收起，新内容按阅读顺序补入。",
    sceneTypes: ["tab-switch", "complex-state-change"],
    targets: ["text", "status", "mixed"],
    intent: "state-transition",
    bestFor: ["文案或图标内容变化明显", "布局变化小但信息变化大", "需要避免所有内容直接渐隐渐显"],
    avoidWhen: ["容器尺寸变化是主变化", "新增列表项需要推开其他内容"],
    restraint: {
      maxPerView: 2,
      intensity: "subtle",
      notes: "替换节奏要短，保持内容可读。"
    },
    expressionStrategies: ["content-exit-replace", "content-cross-replace", "status-snap-replace"],
    capabilities: {
      handlesEnterExit: true,
      handlesReorder: false,
      handlesSubtleMotion: true,
      requiresMatchedGeometry: false,
      safeFallback: false
    },
    safety: { tailLock: true, corridorPolicy: "strict", reducedMotion: "crossfade" },
    mobileGuidance: {
      expectedFeel: "旧内容收起，新内容在同一信息区域补入，变化比普通淡入更明确。",
      inspectionChecklist: ["新旧内容不能长时间叠在一起", "尾帧文案必须完整可读"]
    }
  }
] as const satisfies readonly ZeroLayerRecipeManifest[];

const manifestById = new Map<ZeroLayerMotionRecipeId, ZeroLayerRecipeManifest>(
  zeroLayerRecipeManifests.map((manifest) => [manifest.id, manifest])
);

export function getZeroLayerRecipeManifest(id: ZeroLayerMotionRecipeId): ZeroLayerRecipeManifest | undefined {
  return manifestById.get(id);
}

export function requireZeroLayerRecipeManifest(id: ZeroLayerMotionRecipeId): ZeroLayerRecipeManifest {
  const manifest = getZeroLayerRecipeManifest(id);
  if (!manifest) throw new Error(`Unknown Zero layer recipe manifest: ${id}`);
  return manifest;
}

export function validateZeroLayerRecipeManifestRegistry(): ZeroLayerRecipeManifestValidation[] {
  const issues: ZeroLayerRecipeManifestValidation[] = [];
  const expectedIds = new Set<ZeroLayerMotionRecipeId>(zeroLayerRecipeManifestIds);
  const seenIds = new Set<ZeroLayerMotionRecipeId>();
  const strategyIds = new Set(zeroLayerExpressionStrategies.map((strategy) => strategy.id));

  if (zeroLayerRecipeManifests.length !== zeroLayerRecipeManifestIds.length) {
    issues.push({
      code: "MANIFEST_RECIPE_COUNT_MISMATCH",
      severity: "error",
      message: `Expected ${zeroLayerRecipeManifestIds.length} Zero layer recipe manifests, got ${zeroLayerRecipeManifests.length}.`
    });
  }

  for (const manifest of zeroLayerRecipeManifests) {
    if (seenIds.has(manifest.id)) {
      issues.push({
        code: "MANIFEST_RECIPE_ID_DUPLICATE",
        severity: "error",
        recipeId: manifest.id,
        message: `${manifest.id} is declared more than once.`
      });
    }
    seenIds.add(manifest.id);

    if (!expectedIds.has(manifest.id)) {
      issues.push({
        code: "MANIFEST_RECIPE_ID_UNKNOWN",
        severity: "error",
        recipeId: manifest.id,
        message: `${manifest.id} is not part of the supported Zero layer recipe list.`
      });
    }

    for (const strategyId of manifest.expressionStrategies) {
      if (!strategyIds.has(strategyId)) {
        issues.push({
          code: "MANIFEST_EXPRESSION_STRATEGY_UNKNOWN",
          severity: "error",
          recipeId: manifest.id,
          message: `${manifest.id} references unknown expression strategy ${strategyId}.`
        });
      }
    }

    if (manifest.safety.tailLock !== true || manifest.safety.corridorPolicy !== "strict") {
      issues.push({
        code: "MANIFEST_SAFETY_POLICY_INVALID",
        severity: "error",
        recipeId: manifest.id,
        message: `${manifest.id} must keep tailLock=true and corridorPolicy=strict.`
      });
    }

    if (
      !manifest.mobileGuidance.expectedFeel.trim() ||
      manifest.mobileGuidance.inspectionChecklist.length < 2
    ) {
      issues.push({
        code: "MANIFEST_MOBILE_GUIDANCE_MISSING",
        severity: "error",
        recipeId: manifest.id,
        message: `${manifest.id} must explain expected mobile feel and at least two inspection checks.`
      });
    }
  }

  for (const recipeId of zeroLayerRecipeManifestIds) {
    if (!seenIds.has(recipeId)) {
      issues.push({
        code: "MANIFEST_RECIPE_ID_MISSING",
        severity: "error",
        recipeId,
        message: `${recipeId} is missing a Zero layer recipe manifest.`
      });
    }
  }

  return issues;
}
