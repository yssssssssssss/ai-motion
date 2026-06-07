import type { ParamConceptId } from "../orchestrator/paramConcepts";

export type DesignSpecSkill = {
  id: string;
  label: string;
  version: string;
  terms: string[];
  appliesTo: string[];
  rules: string[];
  forbidden: string[];
  motionPrinciples: string[];
  preferredParamConcepts: ParamConceptId[];
  acceptanceChecks: string[];
};

export const designSpecSkills: DesignSpecSkill[] = [
  {
    id: "ecommerce-transition-motion-skill",
    label: "电商转场动效规范",
    version: "1.0",
    terms: ["ecommerce", "product", "商品", "详情", "transition", "转场"],
    appliesTo: ["商品详情页", "商品卡片", "商品媒体图层", "前后页转场"],
    rules: [
      "转场必须保持商品主体连续，不允许突然闪断或跳帧。",
      "商品图层位移应有明确方向，避免无意义抖动。",
      "转场节奏应短促清晰，默认时长控制在 220ms 到 1400ms。"
    ],
    forbidden: [
      "禁止生成与商品转场无关的装饰性漂浮元素。",
      "禁止修改未声明为可替换的结构层。",
      "禁止引入外部网络脚本或运行时依赖。"
    ],
    motionPrinciples: ["主体连续", "短促节奏", "方向明确", "可循环预览"],
    preferredParamConcepts: ["trajectory", "rhythm"],
    acceptanceChecks: ["主图层必须可替换。", "动效参数必须能映射到白名单。", "预览必须可重播。"]
  },
  {
    id: "campaign-motion-skill",
    label: "营销活动动效规范",
    version: "1.0",
    terms: ["campaign", "landing", "hero", "活动", "营销", "主视觉"],
    appliesTo: ["营销落地页", "活动首屏", "主视觉媒体"],
    rules: ["主视觉优先，动效不能遮挡核心利益点。", "入场节奏应有层次，但不应超过组件已声明参数。"],
    forbidden: ["禁止新增未声明图层。", "禁止生成影响文案可读性的高频闪烁。"],
    motionPrinciples: ["层次入场", "品牌克制", "可读优先"],
    preferredParamConcepts: ["rhythm", "intensity", "trajectory"],
    acceptanceChecks: ["文案或主视觉图层必须保留。", "动效可循环或可重播。"]
  },
  {
    id: "interactive-control-motion-skill",
    label: "交互控件动效规范",
    version: "1.0",
    terms: ["button", "checkbox", "hover", "click", "按钮", "选择控件", "悬停", "点击"],
    appliesTo: ["按钮", "表单控件", "hover 动效", "点击反馈"],
    rules: ["交互反馈必须响应明确，默认不改变布局尺寸。", "hover 与 click 的节奏应轻量。"],
    forbidden: ["禁止长时间阻塞交互。", "禁止生成需要用户理解额外操作说明的动效。"],
    motionPrinciples: ["响应明确", "轻量反馈", "布局稳定"],
    preferredParamConcepts: ["rhythm", "intensity"],
    acceptanceChecks: ["hover 或 click 状态必须可触发。", "按钮文本不能溢出。"]
  },
  {
    id: "text-reveal-motion-skill",
    label: "文字入场动效规范",
    version: "1.0",
    terms: ["text", "headline", "title", "文字", "标题", "入场"],
    appliesTo: ["标题", "正文", "SaaS hero 文案", "列表文案"],
    rules: ["文字动效必须优先保证可读性。", "入场位移和透明度变化应克制。"],
    forbidden: ["禁止生成大幅旋转文字。", "禁止让文字在结束态保持模糊。"],
    motionPrinciples: ["可读优先", "渐进显现", "结束态稳定"],
    preferredParamConcepts: ["rhythm", "trajectory", "intensity"],
    acceptanceChecks: ["文字结束态必须可读。", "动效结束后不能遮挡后续内容。"]
  },
  {
    id: "media-layer-motion-skill",
    label: "媒体图层动效规范",
    version: "1.0",
    terms: ["media", "video", "image", "poster", "媒体", "视频", "图片"],
    appliesTo: ["图片层", "视频首帧", "媒体卡片", "海报图层"],
    rules: ["媒体图层替换必须走声明的 image 参数或 layer target。", "默认只调整已声明的位移、缩放、透明度和圆角参数。"],
    forbidden: ["禁止从视频中臆造未识别出的独立图层。", "禁止把原始 video 标签作为最终生成结果。"],
    motionPrinciples: ["图层可替换", "单层可控", "抽帧可预览"],
    preferredParamConcepts: ["trajectory", "intensity", "rhythm"],
    acceptanceChecks: ["至少存在一个可替换媒体图层。", "生成结果不依赖原始 video 标签播放。"]
  }
];

export function findDesignSpecSkill(id: string): DesignSpecSkill | undefined {
  return designSpecSkills.find((skill) => skill.id === id);
}
