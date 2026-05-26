import type { MotionComponent } from "../library/componentLibrary";
import type { ParsedBriefIntent } from "./briefIntent";
import { createSearchProfile } from "./searchProfile";

export type ComponentSemanticProfile = {
  componentId: string;
  role: string;
  category: string;
  source: "workeasy" | "uploaded" | "native";
  scenes: string[];
  intents: string[];
  motion: {
    triggers: string[];
    primitives: string[];
    intensity: "low" | "medium" | "high";
  };
  visual: {
    colors: string[];
    style: string[];
    shape: string[];
    density: "compact" | "normal" | "rich";
  };
  editable: {
    paramCount: number;
    editableFields: string[];
  };
  searchText: string;
  confidence: number;
};

export type QuerySemanticProfile = {
  roles: string[];
  categories: string[];
  sources: string[];
  scenes: string[];
  intents: string[];
  motion: {
    triggers: string[];
    primitives: string[];
  };
  visual: {
    colors: string[];
    style: string[];
    shape: string[];
  };
  must: string[];
  should: string[];
  mustNot: string[];
  searchText: string;
};

export const SEMANTIC_ALIAS_GROUPS = [
  ["button", "按钮", "buttons", "cta", "call to action", "转化入口", "提交"],
  ["card", "卡片", "cards", "内容展示"],
  ["checkbox", "选择控件", "checkboxes", "checklist", "表单"],
  ["text", "文字", "hero", "标题"],
  ["media", "媒体", "video", "视频"],
  ["layout", "布局"],
  ["background", "背景", "backgrounds"],
  ["interaction", "交互", "interactive"],
  ["hover", "悬停"],
  ["click", "点击"],
  ["load", "入场", "出现", "reveal"],
  ["loop", "循环", "looping"],
  ["scale", "缩放", "放大"],
  ["glow", "发光", "shadow", "霓虹"],
  ["slide", "位移", "滑动", "translate"],
  ["rotate", "旋转"],
  ["blur", "模糊"],
  ["particle", "粒子", "particles"],
  ["explosion", "爆炸"],
  ["gift-rain", "礼物雨"],
  ["pill", "胶囊"],
  ["circle", "圆形"],
  ["outline", "描边"],
  ["flat", "扁平"],
  ["glass", "毛玻璃"],
  ["gradient", "渐变"],
  ["purple", "紫色", "violet", "magenta"],
  ["blue", "蓝色", "cyan"],
  ["red", "红色", "pink"],
  ["orange", "橙色", "coral"],
  ["yellow", "黄色", "gold", "金色"],
  ["green", "绿色", "lime"],
  ["black", "黑色", "深色", "dark"],
  ["white", "白色"],
  ["gray", "灰色", "grey"],
  ["campaign", "活动页", "campaign-page", "promotion"],
  ["landing", "落地页", "landing-page"],
  ["marketing", "营销页", "转化场景"],
  ["saas", "软件服务首页", "软件服务", "首页"],
  ["ecommerce", "电商", "商品", "商城", "product"],
  ["live", "直播间", "直播"],
  ["tech", "科技感"],
  ["workeasy", "工作易", "work easy"],
  ["native", "内置"],
  ["uploaded", "上传", "imported"]
] as const;

const ROLE_GROUPS: Record<string, string[]> = {
  button: ["button"],
  card: ["card"],
  checkbox: ["checkbox"],
  text: ["text"],
  media: ["media"],
  layout: ["layout"],
  background: ["background"]
};

const CATEGORY_BY_ROLE: Record<string, string> = {
  button: "interaction",
  checkbox: "interaction",
  card: "layout",
  text: "text",
  media: "media",
  layout: "layout",
  background: "background"
};

const SCENE_GROUPS: Record<string, string[]> = {
  活动页: ["campaign"],
  落地页: ["landing"],
  营销页: ["marketing"],
  软件服务首页: ["saas"],
  电商: ["ecommerce"],
  直播间: ["live"],
  科技感: ["tech"],
  表单: ["checkbox"]
};

const COLOR_GROUPS: Record<string, string[]> = {
  紫色: ["purple"],
  蓝色: ["blue"],
  红色: ["red"],
  橙色: ["orange"],
  黄色: ["yellow"],
  绿色: ["green"],
  黑色: ["black"],
  白色: ["white"],
  灰色: ["gray"]
};

const MOTION_TRIGGER_GROUPS: Record<string, string[]> = {
  hover: ["hover"],
  click: ["click"],
  load: ["load"],
  loop: ["loop"]
};

const MOTION_PRIMITIVE_GROUPS: Record<string, string[]> = {
  scale: ["scale"],
  glow: ["glow"],
  slide: ["slide"],
  rotate: ["rotate"],
  blur: ["blur"],
  reveal: ["load"],
  particle: ["particle"],
  explosion: ["explosion"],
  "gift-rain": ["gift-rain"]
};

const VISUAL_STYLE_GROUPS: Record<string, string[]> = {
  渐变: ["gradient"],
  发光: ["glow"],
  科技感: ["tech"],
  毛玻璃: ["glass"],
  描边: ["outline"],
  扁平: ["flat"],
  深色: ["black"]
};

const SHAPE_GROUPS: Record<string, string[]> = {
  胶囊: ["pill"],
  圆形: ["circle"],
  描边: ["outline"],
  扁平: ["flat"]
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function expandSemanticTerm(value: string): string[] {
  const normalized = normalize(value);
  const terms = [normalized, ...tokenize(normalized)];

  for (const group of SEMANTIC_ALIAS_GROUPS) {
    if (group.some((alias) => normalized.includes(normalize(alias)))) {
      terms.push(...group.map(normalize));
    }
  }

  return unique(terms);
}

export function semanticTermMatches(values: string[], term: string): boolean {
  const expandedTerm = expandSemanticTerm(term);
  return values.some((value) => {
    const expandedValue = expandSemanticTerm(value);
    return (
      expandedValue.some((candidate) => expandedTerm.includes(candidate)) ||
      expandedTerm.some((candidate) => expandedValue.includes(candidate))
    );
  });
}

function valuesFromIntent(intent: ParsedBriefIntent): string[] {
  return unique([
    intent.query,
    intent.semanticQuery,
    ...intent.categories,
    ...intent.componentKinds,
    ...intent.motionStyles,
    ...intent.sources,
    ...intent.keywords,
    ...intent.softPreferences,
    ...intent.hardConstraints,
    ...intent.reasoningHints
  ]);
}

function canonicalMatches(values: string[], groups: Record<string, string[]>): string[] {
  return unique(
    Object.entries(groups).flatMap(([canonical, aliases]) =>
      values.some((value) => aliases.some((alias) => semanticTermMatches([value], alias))) ? [canonical] : []
    )
  );
}

function localizedMatches(values: string[], groups: Record<string, string[]>): string[] {
  return unique(
    Object.entries(groups).flatMap(([label, aliases]) =>
      values.some((value) => aliases.some((alias) => semanticTermMatches([value], alias))) ? [label] : []
    )
  );
}

function componentSource(component: MotionComponent): ComponentSemanticProfile["source"] {
  if (component.source.origin === "imported") return "uploaded";
  return component.tags.includes("workeasy") ? "workeasy" : "native";
}

function inferRole(component: MotionComponent, values: string[]): string {
  const roles = canonicalMatches(values, ROLE_GROUPS);
  if (roles[0]) return roles[0];
  return component.category;
}

function inferIntent(values: string[]): string[] {
  const intents: string[] = [];
  if (semanticTermMatches(values, "cta") || semanticTermMatches(values, "营销页")) intents.push("转化");
  if (semanticTermMatches(values, "hover") || semanticTermMatches(values, "click")) intents.push("反馈");
  if (semanticTermMatches(values, "reveal") || semanticTermMatches(values, "入场")) intents.push("引导");
  if (semanticTermMatches(values, "background")) intents.push("装饰");
  if (semanticTermMatches(values, "form") || semanticTermMatches(values, "submit")) intents.push("提交");
  return unique(intents);
}

function inferIntensity(primitives: string[], triggers: string[]): ComponentSemanticProfile["motion"]["intensity"] {
  if (primitives.includes("glow") || primitives.includes("particle") || primitives.includes("explosion")) return "high";
  if (primitives.length >= 2 || triggers.includes("hover")) return "medium";
  return "low";
}

export function createComponentSemanticProfile(component: MotionComponent): ComponentSemanticProfile {
  const searchProfile = createSearchProfile(component);
  const baseValues = unique([
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    ...searchProfile.functionTraits,
    ...searchProfile.sceneTraits,
    ...searchProfile.motionTraits,
    ...searchProfile.structuralTags,
    ...searchProfile.colorTraits,
    searchProfile.rawText
  ]);
  const role = inferRole(component, baseValues);
  const scenes = localizedMatches(baseValues, SCENE_GROUPS);
  const triggers = canonicalMatches(baseValues, MOTION_TRIGGER_GROUPS);
  const primitives = canonicalMatches(baseValues, MOTION_PRIMITIVE_GROUPS);
  const colors = unique([searchProfile.colorFacet.primary, ...searchProfile.colorFacet.secondary]).filter(
    (color) => color !== "多彩"
  );
  const style = unique([
    ...localizedMatches(baseValues, VISUAL_STYLE_GROUPS),
    ...(searchProfile.colorFacet.isGradient ? ["渐变"] : [])
  ]);
  const shape = localizedMatches(baseValues, SHAPE_GROUPS);
  const intents = inferIntent([...baseValues, ...scenes, ...triggers, ...primitives, ...style]);
  const editableFields = searchProfile.editableTraits;
  const searchText = unique([
    component.name,
    role,
    component.category,
    componentSource(component),
    ...scenes,
    ...intents,
    ...triggers,
    ...primitives,
    ...colors,
    ...style,
    ...shape,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    ...editableFields
  ]).join(" ");

  return {
    componentId: component.id,
    role,
    category: component.category,
    source: componentSource(component),
    scenes,
    intents,
    motion: {
      triggers,
      primitives,
      intensity: inferIntensity(primitives, triggers)
    },
    visual: {
      colors,
      style,
      shape,
      density: component.manifest.params.length > 6 ? "rich" : component.manifest.params.length > 2 ? "normal" : "compact"
    },
    editable: {
      paramCount: component.manifest.params.length,
      editableFields
    },
    searchText,
    confidence: searchText.length > 0 ? 0.7 : 0.2
  };
}

export function createQuerySemanticProfile(intent: ParsedBriefIntent): QuerySemanticProfile {
  const values = valuesFromIntent(intent);
  const roles = canonicalMatches(values, ROLE_GROUPS);
  const derivedCategories = roles
    .map((role) => CATEGORY_BY_ROLE[role])
    .filter((category): category is string => Boolean(category));
  const categories = unique([...intent.categories, ...derivedCategories]);
  const sources = canonicalMatches(values, {
    workeasy: ["workeasy"],
    native: ["native"],
    uploaded: ["uploaded"]
  });
  const scenes = localizedMatches(values, SCENE_GROUPS);
  const triggers = canonicalMatches(values, MOTION_TRIGGER_GROUPS);
  const primitives = canonicalMatches(values, MOTION_PRIMITIVE_GROUPS);
  const colors = localizedMatches(values, COLOR_GROUPS);
  const style = localizedMatches(values, VISUAL_STYLE_GROUPS);
  const shape = localizedMatches(values, SHAPE_GROUPS);
  const intents = inferIntent([...values, ...scenes, ...triggers, ...primitives, ...style]);
  const should = unique([
    ...intent.softPreferences,
    ...intent.motionStyles,
    ...intent.keywords,
    ...scenes,
    ...triggers,
    ...primitives,
    ...colors,
    ...style,
    ...shape,
    ...intents
  ]);

  return {
    roles,
    categories,
    sources,
    scenes,
    intents,
    motion: {
      triggers,
      primitives
    },
    visual: {
      colors,
      style,
      shape
    },
    must: unique([...intent.componentKinds, ...intent.hardConstraints]),
    should,
    mustNot: unique(intent.negativePreferences),
    searchText: unique([...values, ...should]).join(" ")
  };
}
