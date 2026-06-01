export type DesignSpecSkill = {
  id: string;
  label: string;
  terms: string[];
};

export const designSpecSkills: DesignSpecSkill[] = [
  {
    id: "ecommerce-transition-motion-skill",
    label: "电商转场动效规范",
    terms: ["ecommerce", "product", "商品", "详情", "transition", "转场"]
  },
  {
    id: "campaign-motion-skill",
    label: "营销活动动效规范",
    terms: ["campaign", "landing", "hero", "活动", "营销", "主视觉"]
  },
  {
    id: "interactive-control-motion-skill",
    label: "交互控件动效规范",
    terms: ["button", "checkbox", "hover", "click", "按钮", "选择控件", "悬停", "点击"]
  },
  {
    id: "text-reveal-motion-skill",
    label: "文字入场动效规范",
    terms: ["text", "headline", "title", "文字", "标题", "入场"]
  },
  {
    id: "media-layer-motion-skill",
    label: "媒体图层动效规范",
    terms: ["media", "video", "image", "poster", "媒体", "视频", "图片"]
  }
];

export function findDesignSpecSkill(id: string): DesignSpecSkill | undefined {
  return designSpecSkills.find((skill) => skill.id === id);
}
