const DISPLAY_LABELS: Record<string, string> = {
  animation: "动画",
  blue: "蓝色",
  blur: "模糊",
  button: "按钮",
  buttons: "按钮",
  campaign: "活动页",
  "campaign-page": "活动页",
  card: "卡片",
  cards: "卡片",
  checkbox: "选择控件",
  checkboxes: "选择控件",
  checklist: "选择控件",
  "call to action": "转化入口",
  cta: "转化入口",
  dark: "深色",
  expressive: "强表现",
  form: "表单",
  glow: "发光",
  gradient: "渐变",
  hero: "首屏",
  hover: "悬停",
  interaction: "交互",
  landing: "落地页",
  "landing-page": "落地页",
  layout: "布局",
  magnetic: "磁吸",
  marketing: "营销页",
  micro: "微交互",
  "micro interaction": "微交互",
  "micro-interaction": "微交互",
  native: "内置",
  orange: "橙色",
  premium: "精致",
  promotion: "活动页",
  purple: "紫色",
  rainbow: "彩虹",
  red: "红色",
  reveal: "入场",
  rotate: "旋转",
  saas: "软件服务",
  scale: "缩放",
  shadow: "阴影",
  slide: "位移",
  subtle: "克制",
  tech: "科技感",
  text: "文字",
  transform: "变换",
  transition: "过渡",
  violet: "紫色",
  white: "白色",
  workeasy: "工作易",
  "work easy": "工作易"
};

export function displayLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  return DISPLAY_LABELS[normalized] ?? value;
}

export function displayLabels(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map(displayLabel)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ];
}
