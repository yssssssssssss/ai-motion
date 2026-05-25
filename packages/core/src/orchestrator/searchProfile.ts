import type { MotionComponent } from "../library/componentLibrary";

export type SearchProfile = {
  summary: string;
  colorTraits: string[];
  motionTraits: string[];
  functionTraits: string[];
  sceneTraits: string[];
  editableTraits: string[];
  rawText: string;
};

type TraitBucket = keyof Omit<SearchProfile, "summary" | "rawText">;

const COLOR_NAMES: Record<string, string[]> = {
  black: ["黑色", "深色", "black", "dark"],
  white: ["白色", "white"],
  gold: ["金色", "gold"],
  transparent: ["透明", "transparent"]
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sourceContent(component: MotionComponent, kind: "html" | "css"): string {
  return component.source.files
    .filter((file) => file.kind === kind)
    .map((file) => file.content)
    .join("\n");
}

function visibleHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 3 && normalized.length !== 6) return null;

  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => part + part)
          .join("")
      : normalized;
  const intValue = Number.parseInt(value, 16);
  if (!Number.isFinite(intValue)) return null;

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
}

function rgbToHue({ r, g, b }: { r: number; g: number; b: number }): number {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) return 0;
  if (max === red) return ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
  if (max === green) return ((blue - red) / delta + 2) * 60;
  return ((red - green) / delta + 4) * 60;
}

function colorTraitsFromHex(hex: string): string[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];

  const hue = rgbToHue(rgb);
  const brightness = (rgb.r + rgb.g + rgb.b) / 3;
  const traits: string[] = [];

  if (brightness < 48) traits.push("黑色", "深色", "dark");
  if (brightness > 228) traits.push("白色", "white");
  if (hue >= 250 && hue <= 315) traits.push("紫色", "purple", "violet");
  if (hue >= 190 && hue < 250) traits.push("蓝色", "blue");
  if (hue >= 330 || hue < 20) traits.push("红色", "red");
  if (hue >= 20 && hue < 55) traits.push("橙色", "orange");
  if (hue >= 55 && hue < 80) traits.push("黄色", "yellow");
  if (hue >= 80 && hue < 170) traits.push("绿色", "green");

  return traits;
}

function collectColorTraits(css: string): string[] {
  const traits: string[] = [];
  const lower = css.toLowerCase();

  if (lower.includes("gradient")) traits.push("渐变", "gradient");
  for (const [name, values] of Object.entries(COLOR_NAMES)) {
    if (lower.includes(name)) traits.push(...values);
  }
  for (const match of lower.matchAll(/#[0-9a-f]{3,8}\b/g)) {
    traits.push(...colorTraitsFromHex(match[0]));
  }

  return unique(traits);
}

function collectMotionTraits(css: string): string[] {
  const lower = css.toLowerCase();
  const traits: string[] = [];

  if (lower.includes(":hover")) traits.push("hover", "悬停");
  if (lower.includes("transition")) traits.push("transition", "过渡");
  if (lower.includes("animation") || lower.includes("@keyframes")) traits.push("animation", "动画");
  if (lower.includes("transform")) traits.push("transform", "变换");
  if (lower.includes("scale")) traits.push("scale", "缩放");
  if (lower.includes("rotate")) traits.push("rotate", "旋转");
  if (lower.includes("translate")) traits.push("slide", "位移");
  if (lower.includes("box-shadow") || lower.includes("drop-shadow") || lower.includes("text-shadow")) {
    traits.push("shadow", "阴影", "glow", "发光");
  }
  if (lower.includes("blur")) traits.push("blur", "模糊");

  return unique(traits);
}

function collectFunctionTraits(component: MotionComponent, html: string): string[] {
  const lower = [component.name, component.category, ...component.tags, ...component.useCases, html]
    .join(" ")
    .toLowerCase();
  const traits: string[] = [];

  if (lower.includes("button") || lower.includes("<button")) traits.push("按钮", "button");
  if (
    lower.includes("cta") ||
    lower.includes("join") ||
    lower.includes("register") ||
    lower.includes("submit")
  ) {
    traits.push("CTA", "转化入口", "提交");
  }
  if (lower.includes("card")) traits.push("卡片", "card", "内容展示");
  if (lower.includes("checkbox") || lower.includes("checklist") || lower.includes('type="checkbox"')) {
    traits.push("选择控件", "checkbox", "表单");
  }
  if (lower.includes("hero") || lower.includes("text")) traits.push("文字", "text", "标题");

  return unique(traits);
}

function collectSceneTraits(component: MotionComponent, htmlText: string): string[] {
  const lower = [
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    htmlText
  ]
    .join(" ")
    .toLowerCase();
  const traits: string[] = [];

  if (lower.includes("campaign")) traits.push("活动页", "campaign");
  if (lower.includes("landing")) traits.push("落地页", "landing-page");
  if (lower.includes("cta") || lower.includes("marketing")) traits.push("营销页", "转化场景");
  if (lower.includes("saas") || lower.includes("hero")) traits.push("软件服务首页", "首页");
  if (lower.includes("form") || lower.includes("checkbox")) traits.push("表单");
  if (lower.includes("tech")) traits.push("科技感", "tech");

  return unique(traits);
}

function collectEditableTraits(component: MotionComponent): string[] {
  return unique(
    component.manifest.params.flatMap((param) => [
      param.label,
      param.id,
      param.type,
      typeof param.default === "string" ? param.default : ""
    ])
  );
}

// 仅抽取 class 名 / data-motion key 等结构信号，避免把整段 css 塞进检索文本
function extractStructuralTokens(html: string, css: string): string[] {
  const tokens: string[] = [];
  for (const match of html.matchAll(/class=["']([^"']+)["']/g)) {
    const classList = match[1];
    if (classList) tokens.push(...classList.split(/\s+/));
  }
  for (const match of html.matchAll(/data-motion=["']([^"']+)["']/g)) {
    const key = match[1];
    if (key) tokens.push(key);
  }
  // 从 CSS 中提取关键字属性名（不带值）作为弱信号
  for (const match of css.matchAll(/@keyframes\s+([A-Za-z_-][\w-]*)/g)) {
    const keyframeName = match[1];
    if (keyframeName) tokens.push(keyframeName);
  }
  return unique(tokens.filter((token) => token.length > 1 && token.length < 32));
}

export function createSearchProfile(component: MotionComponent): SearchProfile {
  const css = sourceContent(component, "css");
  const html = sourceContent(component, "html");
  const htmlText = visibleHtmlText(html);
  const structural = extractStructuralTokens(html, css);
  const buckets: Record<TraitBucket, string[]> = {
    colorTraits: collectColorTraits(css),
    motionTraits: collectMotionTraits(css),
    functionTraits: collectFunctionTraits(component, html),
    sceneTraits: collectSceneTraits(component, htmlText),
    editableTraits: collectEditableTraits(component)
  };
  const summary = unique([
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    ...buckets.colorTraits,
    ...buckets.motionTraits,
    ...buckets.functionTraits,
    ...buckets.sceneTraits
  ]).join(" ");

  return {
    summary,
    ...buckets,
    // rawText 只放语义文本 + 结构性 token，避免把整段 css/html 当作语料
    rawText: [
      component.name,
      component.category,
      ...component.tags,
      ...component.useCases,
      ...component.moods,
      htmlText,
      ...structural,
      ...buckets.editableTraits
    ].join(" ")
  };
}
