import type { MotionComponent } from "../library/componentLibrary";
import { analyzeColors, type ColorFacet } from "./colorAnalysis";

export type SearchProfile = {
  summary: string;
  colorFacet: ColorFacet;
  colorTraits: string[];
  motionTraits: string[];
  functionTraits: string[];
  sceneTraits: string[];
  structuralTags: string[];
  editableTraits: string[];
  rawText: string;
};

type TraitBucket = keyof Omit<SearchProfile, "summary" | "rawText" | "colorFacet">;

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

function inferStructuralTags(css: string): string[] {
  const tags: string[] = [];
  if (/\bborder-radius:\s*(50%|9999px)\b/i.test(css)) tags.push("圆形", "circle");
  else if (/\bborder-radius:\s*(\d+)px\b/i.test(css)) {
    const r = Number(css.match(/\bborder-radius:\s*(\d+)px\b/i)?.[1]);
    if (r >= 20) tags.push("胶囊", "pill");
  }
  if (/\btransform:\s*skew\b/i.test(css)) tags.push("倾斜", "skewed");
  if (/\bbox-shadow[^;]*inset/i.test(css) && (css.match(/\bbox-shadow\b/g) || []).length > 1) tags.push("立体", "3d");
  if (/\bbackdrop-filter:\s*blur\b/i.test(css)) tags.push("毛玻璃", "glass");
  if (/\blinear-gradient\b/i.test(css)) tags.push("渐变", "gradient");
  if (/\bborder:\s*none\b/i.test(css) && !/\bbackground:\s*transparent\b/i.test(css)) tags.push("扁平", "flat");
  if (/\bbackground:\s*(transparent|none)\b/i.test(css) && /\bborder:\s*\d+px\b/i.test(css)) tags.push("描边", "outline");
  if (/:hover[^}]*\btransform:[^}]*scale\b/i.test(css)) tags.push("悬停放大", "hover-grow");
  if (/:hover[^}]*\b(width|height)\b/i.test(css)) tags.push("悬停展开", "hover-expand");
  if (/:active[^}]*\bscale\s*\(\s*0\./i.test(css)) tags.push("按下收缩", "press-shrink");
  if (/::(before|after)[^}]*\banimation\b/i.test(css)) tags.push("伪元素动画", "pseudo-animate");
  return unique(tags);
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
  const colorFacet = analyzeColors(css);
  const buckets: Record<TraitBucket, string[]> = {
    colorTraits: colorFacet.traits,
    motionTraits: collectMotionTraits(css),
    functionTraits: collectFunctionTraits(component, html),
    sceneTraits: collectSceneTraits(component, htmlText),
    structuralTags: inferStructuralTags(css),
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
    colorFacet,
    ...buckets,
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
