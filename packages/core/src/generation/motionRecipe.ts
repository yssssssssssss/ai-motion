import { z } from "zod";
import type { MotionComponent, SourceFile } from "../library/componentLibrary";
import type {
  MotionLayer,
  MotionCapability,
  MotionParam,
  MotionRecipeBinding,
  MotionTarget
} from "../manifest/types";
import type {
  SemanticIntentV2,
  SemanticIntentV2LayerRole,
  SemanticIntentV2MotionType
} from "./semanticIntentV2";

export const motionRecipeCategories = [
  "entrance",
  "feedback",
  "transition",
  "loop"
] as const;

export const motionRecipeParamKinds = [
  "duration",
  "delay",
  "easing",
  "distance",
  "scale",
  "opacity",
  "rotate",
  "stagger",
  "loop",
  "direction",
  "transformOrigin"
] as const;

export type MotionRecipeCategory = (typeof motionRecipeCategories)[number];
export type MotionRecipeParamKind = (typeof motionRecipeParamKinds)[number];
export type MotionRecipeSource = "builtin" | "extracted" | "model" | "fallback";
export type MotionRecipeComposition = "single" | "sequence" | "parallel";

export type MotionRecipeParam = {
  id: string;
  label: string;
  kind: MotionRecipeParamKind;
  default: string | number | boolean;
  target?: MotionTarget | undefined;
};

export type MotionRecipeTarget = {
  id: string;
  role: SemanticIntentV2LayerRole;
  required: boolean;
  replaceable: boolean;
  selector: string;
  acceptedKinds: Array<MotionLayer["kind"]>;
};

export type MotionRecipeTimeline = {
  keyframes: string[];
  durationParamId: string;
  easingParamId: string;
  loop: boolean;
};

export type MotionRecipe = {
  id: string;
  name: string;
  category: MotionRecipeCategory;
  trigger: "load" | "hover" | "click" | "loop";
  timeline: MotionRecipeTimeline;
  targets: MotionRecipeTarget[];
  params: MotionRecipeParam[];
  bindings: {
    cssVariables: string[];
    keyframes: string[];
    selectors: string[];
    replay: true;
  };
  constraints: {
    requiresReplaceableTargets: true;
  };
  source: MotionRecipeSource;
};

export type MotionRecipeRequest = {
  recipeId: string;
  trigger: MotionRecipe["trigger"];
  targetRoles: SemanticIntentV2LayerRole[];
  motionTypes: SemanticIntentV2MotionType[];
  composition: MotionRecipeComposition;
  source: SemanticIntentV2["source"];
  confidence: number;
  raw: string;
};

export type AppliedMotionRecipe = {
  recipe: MotionRecipe;
  binding: MotionRecipeBinding;
  params: MotionParam[];
  layers: MotionLayer[];
  files?: SourceFile[] | undefined;
};

export type ExtractedMotionRecipe = {
  recipe: MotionRecipe;
  confidence: number;
  issues: string[];
};

export type MotionRecipeCacheEntry = ExtractedMotionRecipe & {
  componentId: string;
  componentName: string;
  hints: string[];
};

export type ApplyMotionRecipeToComponentInput = {
  sourceComponent: MotionComponent;
  targetComponent: MotionComponent;
  targetLayerId: string;
  id?: string;
  name?: string;
};

const motionRecipeParamSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(motionRecipeParamKinds),
  default: z.union([z.string(), z.number(), z.boolean()])
});

const motionRecipeTargetSchema = z.object({
  id: z.string().min(1),
  role: z.enum([
    "foreground",
    "background",
    "text",
    "image",
    "button",
    "screen",
    "card",
    "badge",
    "loader",
    "modal",
    "unknown"
  ]),
  required: z.boolean(),
  replaceable: z.literal(true),
  selector: z.string().min(1),
  acceptedKinds: z.array(z.enum(["image", "text", "structure"])).min(1)
});

export const motionRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(motionRecipeCategories),
  trigger: z.enum(["load", "hover", "click", "loop"]),
  timeline: z.object({
    keyframes: z.array(z.string().min(1)).min(1),
    durationParamId: z.string().min(1),
    easingParamId: z.string().min(1),
    loop: z.boolean()
  }),
  targets: z.array(motionRecipeTargetSchema).min(1),
  params: z.array(motionRecipeParamSchema).min(1),
  bindings: z.object({
    cssVariables: z.array(z.string().min(1)).min(1),
    keyframes: z.array(z.string().min(1)).min(1),
    selectors: z.array(z.string().min(1)).min(1),
    replay: z.literal(true)
  }),
  constraints: z.object({
    requiresReplaceableTargets: z.literal(true)
  }),
  source: z.enum(["builtin", "extracted", "model", "fallback"])
});

const rootTarget = (name: string): MotionTarget => ({
  kind: "css-variable",
  file: "source/style.css",
  selector: ":root",
  name
});

const recipeTextParam = (param: MotionRecipeParam): MotionParam => {
  const type =
    param.kind === "duration"
      ? "duration"
      : param.kind === "easing"
        ? "easing"
        : param.kind === "loop"
          ? "toggle"
          : param.kind === "direction"
            ? "select"
            : param.kind === "transformOrigin"
              ? "text"
              : "range";
  const constraints =
    param.kind === "duration"
      ? { min: 120, max: 6000, step: 20, unit: "ms" as const }
      : param.kind === "delay"
        ? { min: 0, max: 3000, step: 20, unit: "ms" as const }
        : param.kind === "distance"
          ? { min: -1200, max: 1200, step: 1, unit: "px" as const }
          : param.kind === "scale"
            ? { min: 0.2, max: 2, step: 0.01 }
            : param.kind === "opacity"
              ? { min: 0, max: 1, step: 0.01 }
              : param.kind === "rotate"
                ? { min: -360, max: 360, step: 1, unit: "deg" as const }
                : param.kind === "stagger"
                  ? { min: 0, max: 1000, step: 20, unit: "ms" as const }
                  : param.kind === "direction"
                    ? {
                        options: [
                          { label: "从左到右", value: "left-to-right" },
                          { label: "从右到左", value: "right-to-left" },
                          { label: "从上到下", value: "top-to-bottom" },
                          { label: "从下到上", value: "bottom-to-top" }
                        ]
                      }
                    : undefined;
  const group =
    param.kind === "duration" || param.kind === "delay" || param.kind === "stagger"
      ? "时间"
      : param.kind === "easing"
        ? "缓动"
      : param.kind === "distance" || param.kind === "direction"
        ? "轨迹"
        : param.kind === "opacity"
          ? "透明度"
          : param.kind === "scale"
            ? "缩放"
            : param.kind === "rotate" || param.kind === "transformOrigin"
              ? "变换"
              : param.kind === "loop"
                ? "循环"
                : "动效";
  return {
    id: param.id,
    label: param.label,
    type,
    default: param.default,
    status: "confirmed",
    ...(constraints ? { constraints } : {}),
    targets: param.target ? [param.target] : [],
    ui: { group }
  };
};

export const builtinMotionRecipes: MotionRecipe[] = [
  {
    id: "scale-entrance",
    name: "缩放入场",
    category: "entrance",
    trigger: "load",
    timeline: {
      keyframes: ["generated-load-foreground-scale", "generated-load-scale"],
      durationParamId: "motionDuration",
      easingParamId: "motionEasing",
      loop: false
    },
    targets: [
      {
        id: "primaryLayer",
        role: "foreground",
        required: true,
        replaceable: true,
        selector: "[data-motion=foregroundLayer], [data-motion=cardRoot], [data-motion=mobileScreen]",
        acceptedKinds: ["image", "structure"]
      }
    ],
    params: [
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 900, target: rootTarget("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-out", target: rootTarget("--motion-easing") },
      { id: "foregroundScaleStart", label: "入场初始缩放", kind: "scale", default: 0.72, target: rootTarget("--foreground-scale-start") },
      { id: "foregroundScaleEnd", label: "入场结束缩放", kind: "scale", default: 1, target: rootTarget("--foreground-scale-end") },
      { id: "opacityStart", label: "入场初始透明度", kind: "opacity", default: 0, target: rootTarget("--opacity-start") },
      { id: "opacityEnd", label: "入场结束透明度", kind: "opacity", default: 1, target: rootTarget("--opacity-end") },
      { id: "transformOrigin", label: "变换原点", kind: "transformOrigin", default: "50% 72%", target: rootTarget("--transform-origin") }
    ],
    bindings: {
      cssVariables: ["--motion-duration", "--motion-easing", "--foreground-scale-start", "--foreground-scale-end"],
      keyframes: ["generated-load-foreground-scale", "generated-load-scale"],
      selectors: ["[data-motion=foregroundLayer]", "[data-motion=cardRoot]", "[data-motion=mobileScreen]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  },
  {
    id: "slide-entrance",
    name: "滑入入场",
    category: "entrance",
    trigger: "load",
    timeline: {
      keyframes: ["generated-load-slide"],
      durationParamId: "motionDuration",
      easingParamId: "motionEasing",
      loop: false
    },
    targets: [
      {
        id: "primaryLayer",
        role: "foreground",
        required: true,
        replaceable: true,
        selector: "[data-motion=foregroundLayer], [data-motion=cardRoot], [data-motion=buttonLabel]",
        acceptedKinds: ["image", "text", "structure"]
      }
    ],
    params: [
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 820, target: rootTarget("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-out", target: rootTarget("--motion-easing") },
      { id: "slideDistance", label: "滑入距离", kind: "distance", default: 80, target: rootTarget("--slide-distance") },
      { id: "slideDirection", label: "滑入方向", kind: "direction", default: "left-to-right", target: rootTarget("--slide-direction") },
      { id: "opacityStart", label: "入场初始透明度", kind: "opacity", default: 0, target: rootTarget("--opacity-start") },
      { id: "opacityEnd", label: "入场结束透明度", kind: "opacity", default: 1, target: rootTarget("--opacity-end") }
    ],
    bindings: {
      cssVariables: ["--motion-duration", "--motion-easing", "--slide-distance", "--slide-direction", "--opacity-start", "--opacity-end"],
      keyframes: ["generated-load-slide"],
      selectors: ["[data-motion=foregroundLayer]", "[data-motion=cardRoot]", "[data-motion=buttonLabel]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  },
  {
    id: "bounce-feedback",
    name: "弹动反馈",
    category: "feedback",
    trigger: "click",
    timeline: {
      keyframes: ["generated-click-bounce", "generated-hover-bounce"],
      durationParamId: "motionDuration",
      easingParamId: "motionEasing",
      loop: false
    },
    targets: [
      {
        id: "interactiveLayer",
        role: "button",
        required: true,
        replaceable: true,
        selector: "[data-motion=buttonLabel], [data-motion=cardRoot], [data-motion=badgeText]",
        acceptedKinds: ["text", "structure"]
      }
    ],
    params: [
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 620, target: rootTarget("--motion-duration") },
      {
        id: "motionEasing",
        label: "弹性缓动",
        kind: "easing",
        default: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        target: rootTarget("--motion-easing")
      },
      { id: "bounceIntensity", label: "弹动强度", kind: "scale", default: 1.14, target: rootTarget("--bounce-scale") },
      { id: "settleScale", label: "回落缩放", kind: "scale", default: 0.97, target: rootTarget("--settle-scale") }
    ],
    bindings: {
      cssVariables: ["--motion-duration", "--motion-easing", "--bounce-scale"],
      keyframes: ["generated-click-bounce", "generated-hover-bounce"],
      selectors: ["[data-motion=buttonLabel]", "[data-motion=cardRoot]", "[data-motion=badgeText]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  },
  {
    id: "fade-entrance",
    name: "淡入入场",
    category: "entrance",
    trigger: "load",
    timeline: {
      keyframes: ["generated-load-fade"],
      durationParamId: "motionDuration",
      easingParamId: "motionEasing",
      loop: false
    },
    targets: [
      {
        id: "primaryLayer",
        role: "foreground",
        required: true,
        replaceable: true,
        selector: "[data-motion=foregroundLayer], [data-motion=textContent], [data-motion=cardRoot]",
        acceptedKinds: ["image", "text", "structure"]
      }
    ],
    params: [
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 900, target: rootTarget("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-out", target: rootTarget("--motion-easing") },
      { id: "opacityStart", label: "初始透明度", kind: "opacity", default: 0, target: rootTarget("--opacity-start") },
      { id: "opacityEnd", label: "结束透明度", kind: "opacity", default: 1, target: rootTarget("--opacity-end") },
      { id: "motionDelay", label: "延迟时间", kind: "delay", default: 0, target: rootTarget("--motion-delay") }
    ],
    bindings: {
      cssVariables: ["--motion-duration", "--motion-easing", "--opacity-start", "--opacity-end", "--motion-delay"],
      keyframes: ["generated-load-fade"],
      selectors: ["[data-motion=foregroundLayer]", "[data-motion=textContent]", "[data-motion=cardRoot]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  },
  {
    id: "float-loop",
    name: "漂浮循环",
    category: "loop",
    trigger: "loop",
    timeline: {
      keyframes: ["generated-loop-float"],
      durationParamId: "floatDuration",
      easingParamId: "motionEasing",
      loop: true
    },
    targets: [
      {
        id: "floatingLayer",
        role: "background",
        required: true,
        replaceable: true,
        selector: "[data-motion=backgroundLayer], [data-motion=foregroundLayer], [data-motion=cardRoot]",
        acceptedKinds: ["image", "structure"]
      }
    ],
    params: [
      { id: "floatDuration", label: "漂浮周期", kind: "duration", default: 3200, target: rootTarget("--float-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-in-out", target: rootTarget("--motion-easing") },
      { id: "floatAmplitude", label: "漂浮幅度", kind: "distance", default: 22, target: rootTarget("--float-amplitude") },
      { id: "floatDirection", label: "漂浮方向", kind: "direction", default: "bottom-to-top", target: rootTarget("--float-direction") },
      { id: "motionLoop", label: "循环播放", kind: "loop", default: true, target: rootTarget("--motion-loop") }
    ],
    bindings: {
      cssVariables: ["--float-duration", "--motion-easing", "--float-amplitude", "--float-direction", "--motion-loop"],
      keyframes: ["generated-loop-float"],
      selectors: ["[data-motion=backgroundLayer]", "[data-motion=foregroundLayer]", "[data-motion=cardRoot]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  },
  {
    id: "pulse-loop",
    name: "脉冲循环",
    category: "loop",
    trigger: "loop",
    timeline: {
      keyframes: ["generated-loop-pulse"],
      durationParamId: "motionDuration",
      easingParamId: "motionEasing",
      loop: true
    },
    targets: [
      {
        id: "pulseLayer",
        role: "badge",
        required: true,
        replaceable: true,
        selector: "[data-motion=badgeText], [data-motion=loaderRoot], [data-motion=buttonLabel]",
        acceptedKinds: ["text", "structure"]
      }
    ],
    params: [
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 1200, target: rootTarget("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-in-out", target: rootTarget("--motion-easing") },
      { id: "pulseScale", label: "脉冲缩放", kind: "scale", default: 1.08, target: rootTarget("--pulse-scale") },
      { id: "opacityStart", label: "低点透明度", kind: "opacity", default: 0.72, target: rootTarget("--opacity-start") },
      { id: "opacityEnd", label: "高点透明度", kind: "opacity", default: 1, target: rootTarget("--opacity-end") },
      { id: "motionLoop", label: "循环播放", kind: "loop", default: true, target: rootTarget("--motion-loop") }
    ],
    bindings: {
      cssVariables: ["--motion-duration", "--motion-easing", "--pulse-scale", "--opacity-start", "--opacity-end", "--motion-loop"],
      keyframes: ["generated-loop-pulse"],
      selectors: ["[data-motion=badgeText]", "[data-motion=loaderRoot]", "[data-motion=buttonLabel]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  },
  {
    id: "page-front-back-transition",
    name: "前后页面转场",
    category: "transition",
    trigger: "loop",
    timeline: {
      keyframes: ["mine-exit", "orders-enter", "transition-wash"],
      durationParamId: "cycleDuration",
      easingParamId: "easing",
      loop: true
    },
    targets: [
      {
        id: "frontPage",
        role: "screen",
        required: true,
        replaceable: true,
        selector: "[data-motion=frontPage]",
        acceptedKinds: ["image", "structure"]
      },
      {
        id: "backPage",
        role: "screen",
        required: true,
        replaceable: true,
        selector: "[data-motion=backPage]",
        acceptedKinds: ["image", "structure"]
      }
    ],
    params: [
      { id: "cycleDuration", label: "循环时长", kind: "duration", default: 2640, target: rootTarget("--cycle-duration") },
      { id: "easing", label: "缓动曲线", kind: "easing", default: "cubic-bezier(0.18, 0.86, 0.22, 1)", target: rootTarget("--motion-easing") },
      { id: "enterDistance", label: "进入距离", kind: "distance", default: 520, target: rootTarget("--enter-distance") },
      { id: "exitDistance", label: "退出距离", kind: "distance", default: -520, target: rootTarget("--exit-distance") },
      { id: "transitionOpacity", label: "过渡泛白", kind: "opacity", default: 0.72, target: rootTarget("--transition-opacity") },
      { id: "windowRadius", label: "屏幕圆角", kind: "distance", default: 92, target: rootTarget("--window-radius") }
    ],
    bindings: {
      cssVariables: ["--cycle-duration", "--motion-easing", "--enter-distance", "--exit-distance", "--transition-opacity"],
      keyframes: ["mine-exit", "orders-enter", "transition-wash"],
      selectors: ["[data-motion=frontPage]", "[data-motion=backPage]", "[data-motion=transitionWash]"],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "builtin"
  }
];

export function validateMotionRecipe(recipe: MotionRecipe): { valid: boolean; issues: string[] } {
  const parsed = motionRecipeSchema.safeParse(recipe);
  const issues: string[] = [];
  if (!parsed.success) issues.push("recipe schema 校验失败");
  if (recipe.targets.length === 0) issues.push("缺少目标图层");
  if (!recipe.bindings.replay) issues.push("缺少 replay 绑定");
  if (recipe.targets.some((target) => !target.replaceable)) issues.push("存在不可替换目标图层");
  return { valid: issues.length === 0, issues };
}

export function motionRecipeRequestFromSemanticIntent(intent: SemanticIntentV2): MotionRecipeRequest {
  const motionTypes = intent.motions.map((motion) => motion.type);
  const targetRoles = [...intent.targetRoles, ...intent.layers.map((layer) => layer.role)];
  let recipeId = "scale-entrance";

  if (intent.target.kind === "page-transition" || motionTypes.includes("transition")) {
    recipeId = "page-front-back-transition";
  } else if (motionTypes.includes("float")) {
    recipeId = "float-loop";
  } else if (motionTypes.includes("pulse")) {
    recipeId = "pulse-loop";
  } else if (motionTypes.includes("bounce") || motionTypes.includes("elastic")) {
    recipeId = "bounce-feedback";
  } else if (motionTypes.includes("fade")) {
    recipeId = "fade-entrance";
  } else if (motionTypes.includes("slide")) {
    recipeId = "slide-entrance";
  } else if (motionTypes.includes("scale")) {
    recipeId = "scale-entrance";
  }
  const loopRecipe = recipeId === "page-front-back-transition" || recipeId === "float-loop" || recipeId === "pulse-loop";

  return {
    recipeId,
    trigger: loopRecipe ? "loop" : intent.trigger,
    targetRoles: targetRoles.length > 0 ? [...new Set(targetRoles)] : ["foreground"],
    motionTypes,
    composition: intent.composition,
    source: intent.source,
    confidence: intent.confidence,
    raw: intent.raw
  };
}

export function resolveMotionRecipe(request: MotionRecipeRequest): MotionRecipe {
  const recipe = builtinMotionRecipes.find((item) => item.id === request.recipeId) ?? builtinMotionRecipes[0];
  if (!recipe) throw new Error("No builtin motion recipe is registered.");
  return recipe;
}

function dataMotionValue(selector: string): string | null {
  return selector.match(/\[data-motion=([^\]\s,]+)\]/)?.[1] ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectorExists(html: string, selector: string): boolean {
  const value = dataMotionValue(selector);
  if (value) return html.includes(`data-motion="${value}"`) || html.includes(`data-motion='${value}'`);

  const className = selector.match(/^\.([a-z0-9_-]+)$/i)?.[1];
  if (className) {
    for (const match of html.matchAll(/class=["']([^"']*)["']/gi)) {
      const classes = match[1]?.split(/\s+/).filter(Boolean) ?? [];
      if (classes.includes(className)) return true;
    }
    return false;
  }

  const id = selector.match(/^#([a-z0-9_-]+)$/i)?.[1];
  if (id) return new RegExp(`id=["']${escapeRegExp(id)}["']`, "i").test(html);

  return false;
}

function firstExistingSelector(html: string, selectors: string[]): string | undefined {
  return selectors.find((selector) => selectorExists(html, selector));
}

function selectorForRecipe(input: {
  html: string;
  recipe: MotionRecipe;
  request?: MotionRecipeRequest | undefined;
}): string {
  const preferredRole = input.request?.targetRoles.find((role) => role !== "unknown");
  const target =
    input.recipe.targets.find((item) => item.role === preferredRole) ??
    input.recipe.targets.find((item) => item.required) ??
    input.recipe.targets[0];
  const selectors = [
    ...(target?.selector.split(",").map((selector) => selector.trim()).filter(Boolean) ?? []),
    ...input.recipe.bindings.selectors
  ];
  return firstExistingSelector(input.html, selectors) ?? selectors[0] ?? "[data-motion=motionLayer]";
}

function ensureHtmlTarget(html: string, selector: string): string {
  if (selectorExists(html, selector)) return html;
  const value = dataMotionValue(selector) ?? "motionLayer";
  const layer = `\n      <div class="motion-recipe-layer" data-motion="${value}" aria-hidden="true"></div>`;
  if (/<main\b[^>]*>/i.test(html)) {
    return html.replace(/(<main\b[^>]*>)/i, `$1${layer}`);
  }
  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/(<body\b[^>]*>)/i, `$1\n    <main data-motion-root>${layer}\n    </main>`);
  }
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main data-motion-root>${layer}
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
}

function cssValue(param: MotionRecipeParam): string {
  if (param.kind === "duration" || param.kind === "delay" || param.kind === "stagger") return `${param.default}ms`;
  if (param.kind === "distance") return `${param.default}px`;
  if (param.kind === "rotate") return `${param.default}deg`;
  if (typeof param.default === "boolean") return param.default ? "1" : "0";
  return String(param.default);
}

function cssVarEntries(recipe: MotionRecipe): string[] {
  return recipe.params.flatMap((param) => {
    const target = param.target;
    return target?.kind === "css-variable" ? [`  ${target.name}: ${cssValue(param)};`] : [];
  });
}

function injectRootVariables(css: string, recipe: MotionRecipe): string {
  const entries = cssVarEntries(recipe).filter((entry) => {
    const name = entry.match(/(--[a-z0-9-]+)\s*:/i)?.[1];
    return name ? !new RegExp(`${name}\\s*:`, "i").test(css) : true;
  });
  if (entries.length === 0) return css;
  if (/:root\s*\{/i.test(css)) {
    return css.replace(/:root\s*\{/, (match) => `${match}\n${entries.join("\n")}`);
  }
  return `:root {\n${entries.join("\n")}\n}\n\n${css}`;
}

function keyframeBlock(name: string): string {
  if (name.includes("slide")) {
    return `@keyframes ${name} {
  0% { opacity: var(--opacity-start, 0); transform: translate3d(calc(var(--slide-distance, 80px) * -1), 0, 0); }
  100% { opacity: var(--opacity-end, 1); transform: translate3d(0, 0, 0); }
}`;
  }
  if (name.includes("fade")) {
    return `@keyframes ${name} {
  0% { opacity: var(--opacity-start, 0); }
  100% { opacity: var(--opacity-end, 1); }
}`;
  }
  if (name.includes("bounce")) {
    return `@keyframes ${name} {
  0% { transform: scale(1); }
  48% { transform: scale(var(--bounce-scale, 1.14)); }
  72% { transform: scale(var(--settle-scale, 0.97)); }
  100% { transform: scale(1); }
}`;
  }
  if (name.includes("float")) {
    return `@keyframes ${name} {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, calc(var(--float-amplitude, 22px) * -1), 0); }
}`;
  }
  if (name.includes("pulse")) {
    return `@keyframes ${name} {
  0%, 100% { opacity: var(--opacity-start, 0.72); transform: scale(1); }
  50% { opacity: var(--opacity-end, 1); transform: scale(var(--pulse-scale, 1.08)); }
}`;
  }
  if (name === "mine-exit") {
    return `@keyframes mine-exit {
  0%, 39% { opacity: 1; transform: translate3d(0, 0, 0); }
  53%, 100% { opacity: 0; transform: translate3d(var(--exit-distance, -520px), 0, 0); }
}`;
  }
  if (name === "orders-enter") {
    return `@keyframes orders-enter {
  0%, 39% { opacity: 0; transform: translate3d(var(--enter-distance, 520px), 0, 0); }
  53%, 100% { opacity: 1; transform: translate3d(0, 0, 0); }
}`;
  }
  if (name === "transition-wash") {
    return `@keyframes transition-wash {
  0%, 39%, 54%, 100% { opacity: 0; }
  46% { opacity: var(--transition-opacity, 0.72); }
}`;
  }
  return `@keyframes ${name} {
  0% { opacity: var(--opacity-start, 0); transform: scale(var(--foreground-scale-start, 0.72)); }
  100% { opacity: var(--opacity-end, 1); transform: scale(var(--foreground-scale-end, 1)); }
}`;
}

function injectKeyframes(css: string, recipe: MotionRecipe): string {
  const missing = recipe.bindings.keyframes.filter(
    (name) => !new RegExp(`@keyframes\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(css)
  );
  if (missing.length === 0) return css;
  return `${css.trimEnd()}\n\n${missing.map(keyframeBlock).join("\n\n")}\n`;
}

function animationNameForRecipe(recipe: MotionRecipe, trigger: MotionRecipe["trigger"]): string {
  if (recipe.id === "bounce-feedback") return trigger === "hover" ? "generated-hover-bounce" : "generated-click-bounce";
  return recipe.timeline.keyframes[0] ?? recipe.bindings.keyframes[0] ?? "generated-motion-recipe";
}

function injectAnimationRule(input: {
  css: string;
  selector: string;
  recipe: MotionRecipe;
  trigger: MotionRecipe["trigger"];
}): string {
  const animationName = animationNameForRecipe(input.recipe, input.trigger);
  const durationVar = input.recipe.timeline.durationParamId === "floatDuration" ? "--float-duration" : "--motion-duration";
  const duration = input.recipe.id === "page-front-back-transition" ? "var(--cycle-duration, 2640ms)" : `var(${durationVar}, 900ms)`;
  const easing = input.recipe.id === "page-front-back-transition" ? "var(--motion-easing, ease-out)" : "var(--motion-easing, ease-out)";
  const loop = input.recipe.timeline.loop || input.trigger === "loop" ? " infinite" : "";
  const playSelector =
    input.trigger === "hover" ? `${input.selector}:hover` : `.is-playing ${input.selector}`;
  const rule = `${playSelector} {
  animation: ${animationName} ${duration} ${easing} both${loop};
  will-change: transform, opacity;
}`;
  if (input.css.includes(`animation: ${animationName}`)) return input.css;
  return `${input.css.trimEnd()}\n\n${rule}\n`;
}

function replayProtocol(trigger: MotionRecipe["trigger"], selector: string): string {
  const escapedSelector = selector.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const target = document.querySelector("${escapedSelector}");

  function replay() {
    if (!(root instanceof HTMLElement)) return;
    root.classList.remove("is-playing");
    void root.offsetWidth;
    root.classList.add("is-playing");
  }

  window.motionReplay = replay;
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };

  ${trigger === "click" ? "if (target instanceof HTMLElement) target.addEventListener(\"click\", replay);" : ""}
  ${trigger === "load" || trigger === "loop" ? "requestAnimationFrame(replay);" : ""}
})();`;
}

function ensureReplayProtocol(js: string, trigger: MotionRecipe["trigger"], selector: string): string {
  if (/window\.motionReplay|motionReplay\s*=/.test(js)) return js;
  return `${js.trimEnd()}\n\n${replayProtocol(trigger, selector)}\n`;
}

function kindForPath(path: string): SourceFile["kind"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}

function upsertFile(files: SourceFile[], path: string, content: string): SourceFile[] {
  const found = files.some((file) => file.path === path);
  if (found) {
    return files.map((file) => (file.path === path ? { ...file, content } : file));
  }
  return [...files, { path, kind: kindForPath(path), content }];
}

function applyMotionRecipeToFiles(input: {
  recipe: MotionRecipe;
  request?: MotionRecipeRequest | undefined;
  sourceFiles: SourceFile[];
  trigger: MotionRecipe["trigger"];
  targetSelector?: string | undefined;
}): SourceFile[] {
  const htmlFile = input.sourceFiles.find((file) => file.path === "source/index.html" || file.kind === "html");
  const cssFile = input.sourceFiles.find((file) => file.path === "source/style.css" || file.kind === "css");
  const jsFile = input.sourceFiles.find((file) => file.path === "source/script.js" || file.kind === "js");
  const selector = selectorForRecipe({
    html: htmlFile?.content ?? "",
    recipe: input.recipe,
    request: input.request
  });
  const targetSelector = input.targetSelector ?? selector;
  const html = ensureHtmlTarget(htmlFile?.content ?? "", targetSelector);
  const cssWithVars = injectRootVariables(cssFile?.content ?? "", input.recipe);
  const cssWithKeyframes = injectKeyframes(cssWithVars, input.recipe);
  const css = injectAnimationRule({
    css: cssWithKeyframes,
    selector: targetSelector,
    recipe: input.recipe,
    trigger: input.trigger
  });
  const js = ensureReplayProtocol(jsFile?.content ?? "", input.trigger, targetSelector);

  return upsertFile(
    upsertFile(upsertFile(input.sourceFiles, htmlFile?.path ?? "source/index.html", html), cssFile?.path ?? "source/style.css", css),
    jsFile?.path ?? "source/script.js",
    js
  );
}

export function applyMotionRecipe(input: {
  recipe: MotionRecipe;
  request?: MotionRecipeRequest;
  params: MotionParam[];
  layers: MotionLayer[];
  sourceFiles?: SourceFile[];
  targetLayerIds?: string[];
  targetSelector?: string;
  source?: MotionRecipeSource;
  confidence?: number;
}): AppliedMotionRecipe {
  const recipeParamIds = new Set(input.recipe.params.map((param) => param.id));
  const recipeParamById = new Map(input.recipe.params.map((param) => [param.id, recipeTextParam(param)]));
  const paramIds = new Set(input.params.map((param) => param.id));
  const layerIds = new Set(input.layers.map((layer) => layer.id));
  const recipeParams = input.recipe.params
    .filter((param) => !paramIds.has(param.id))
    .map(recipeTextParam);
  const recipeLayers = input.recipe.targets
    .filter((target) => !layerIds.has(target.id))
    .map(
      (target): MotionLayer => ({
        id: target.id,
        label: target.id,
        kind: target.acceptedKinds[0] ?? "structure",
        replaceable: true,
        required: target.required,
        targets: [{ kind: "html-attribute", file: "source/index.html", selector: target.selector, attribute: "class" }]
      })
    );
  const layers = [...input.layers, ...recipeLayers].map((layer) => ({ ...layer, replaceable: true }));
  const params: MotionParam[] = [
    ...input.params.map((param): MotionParam => {
      const recipeParam = recipeParamById.get(param.id);
      if (!recipeParam) return param;
      const constraints = param.constraints ?? recipeParam.constraints;
      const ui = param.ui ?? recipeParam.ui;
      return {
        ...param,
        targets: param.targets.length > 0 ? param.targets : recipeParam.targets,
        ...(constraints ? { constraints } : {}),
        ...(ui ? { ui } : {})
      };
    }),
    ...recipeParams
  ];
  const trigger = input.request?.trigger ?? input.recipe.trigger;
  const files = input.sourceFiles
    ? applyMotionRecipeToFiles({
        recipe: input.recipe,
        request: input.request,
        sourceFiles: input.sourceFiles,
        trigger,
        targetSelector: input.targetSelector
      })
    : undefined;
  const bindingTargetLayerIds = input.targetLayerIds && input.targetLayerIds.length > 0
    ? input.targetLayerIds
    : input.recipe.targets.map((target) => target.id);
  const targetSelectors = input.targetSelector ? [input.targetSelector] : input.recipe.bindings.selectors;

  return {
    recipe: input.recipe,
    binding: {
      recipeId: input.recipe.id,
      recipeName: input.recipe.name,
      category: input.recipe.category,
      targetLayerIds: bindingTargetLayerIds,
      targetRoles: input.recipe.targets.map((target) => target.role),
      targetSelectors,
      paramIds: params.filter((param) => recipeParamIds.has(param.id)).map((param) => param.id),
      trigger,
      source: input.source ?? input.recipe.source,
      ...(input.confidence === undefined ? {} : { confidence: input.confidence })
    },
    params,
    layers,
    ...(files ? { files } : {})
  };
}

export function validateRecipeApplication(input: {
  binding: MotionRecipeBinding;
  params: MotionParam[];
  layers: MotionLayer[];
  sourceText: string;
}): { valid: boolean; issues: string[] } {
  const paramIds = new Set(input.params.map((param) => param.id));
  const layerIds = new Set(input.layers.map((layer) => layer.id));
  const issues: string[] = [];

  if (!input.binding.paramIds.every((paramId) => paramIds.has(paramId))) {
    issues.push("recipe 参数未完整写入 manifest");
  }
  if (!input.binding.targetLayerIds.every((layerId) => layerIds.has(layerId))) {
    issues.push("recipe 图层未完整写入 manifest");
  }
  if (input.layers.some((layer) => !layer.replaceable)) {
    issues.push("存在不可替换图层");
  }
  if (!/window\.motionReplay|motionReplay\s*=/.test(input.sourceText)) {
    issues.push("缺少 replay 协议");
  }
  const recipe = builtinMotionRecipes.find((item) => item.id === input.binding.recipeId);
  if (recipe) {
    const selectors = input.binding.targetSelectors?.length ? input.binding.targetSelectors : recipe.bindings.selectors;
    const hasSelector = selectors.some((selector) => selectorExists(input.sourceText, selector));
    if (!hasSelector) issues.push("recipe selector 未绑定到源码图层");
    if (!recipe.bindings.keyframes.some((name) => input.sourceText.includes(`@keyframes ${name}`))) {
      issues.push("recipe keyframes 未写入源码");
    }
    if (!recipe.bindings.keyframes.some((name) => input.sourceText.includes(`animation: ${name}`))) {
      issues.push("recipe animation 未绑定到目标图层");
    }
  }

  return { valid: issues.length === 0, issues };
}

function sourceText(component: MotionComponent): string {
  return component.source.files.map((file) => file.content).join("\n");
}

function recipeById(id: string): MotionRecipe {
  const recipe = builtinMotionRecipes.find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown motion recipe: ${id}`);
  return recipe;
}

function extractedBuiltinRecipe(id: string): MotionRecipe {
  const recipe = recipeById(id);
  return {
    ...recipe,
    timeline: { ...recipe.timeline, keyframes: [...recipe.timeline.keyframes] },
    targets: recipe.targets.map((target) => ({ ...target, acceptedKinds: [...target.acceptedKinds] })),
    params: recipe.params.map((param) => ({ ...param, ...(param.target ? { target: { ...param.target } } : {}) })),
    bindings: {
      cssVariables: [...recipe.bindings.cssVariables],
      keyframes: [...recipe.bindings.keyframes],
      selectors: [...recipe.bindings.selectors],
      replay: true
    },
    constraints: { ...recipe.constraints },
    source: "extracted"
  };
}

function keyframeNames(css: string): string[] {
  return [...css.matchAll(/@keyframes\s+([a-z0-9_-]+)/gi)].flatMap((match) => (match[1] ? [match[1]] : []));
}

function cssVariables(css: string): string[] {
  return [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].flatMap((match) => (match[1] ? [match[1]] : []));
}

function sourceHasReplay(text: string): boolean {
  return /window\.motionReplay|motionReplay\s*=/.test(text);
}

function cssVariableValueMap(css: string): Map<string, string> {
  return new Map(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].flatMap((match) =>
      match[1] && match[2] ? [[match[1], match[2].trim()] as const] : []
    )
  );
}

function paramCssVariableName(param: MotionRecipeParam): string | null {
  return param.target?.kind === "css-variable" ? param.target.name : null;
}

function numberFromCssValue(value: unknown, kind: MotionRecipeParamKind): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const match = trimmed.match(/^-?\d+(?:\.\d+)?/);
  if (!match?.[0]) return null;

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  if (
    (kind === "duration" || kind === "delay" || kind === "stagger") &&
    /^-?\d+(?:\.\d+)?s$/i.test(trimmed)
  ) {
    return parsed * 1000;
  }
  return parsed;
}

function recipeDefaultFromValue(
  value: unknown,
  kind: MotionRecipeParamKind
): MotionRecipeParam["default"] | undefined {
  if (kind === "easing" || kind === "direction" || kind === "transformOrigin") {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
  if (kind === "loop") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (/^(true|1|infinite)$/i.test(value.trim())) return true;
      if (/^(false|0|none)$/i.test(value.trim())) return false;
    }
    return undefined;
  }

  return numberFromCssValue(value, kind) ?? undefined;
}

function manifestParamDefault(component: MotionComponent, recipeParam: MotionRecipeParam): MotionRecipeParam["default"] | undefined {
  const variableName = paramCssVariableName(recipeParam);
  const matched = component.manifest.params.find((param) => {
    if (param.id === recipeParam.id) return true;
    return (
      variableName !== null &&
      param.targets.some((target) => target.kind === "css-variable" && target.name === variableName)
    );
  });
  if (!matched) return undefined;
  return recipeDefaultFromValue(matched.value ?? matched.default, recipeParam.kind);
}

function cssParamDefault(cssValues: Map<string, string>, recipeParam: MotionRecipeParam): MotionRecipeParam["default"] | undefined {
  const variableName = paramCssVariableName(recipeParam);
  if (!variableName) return undefined;
  const value = cssValues.get(variableName);
  return value === undefined ? undefined : recipeDefaultFromValue(value, recipeParam.kind);
}

function withExtractedParamDefaults(recipe: MotionRecipe, component: MotionComponent, css: string): MotionRecipe {
  const cssValues = cssVariableValueMap(css);
  return {
    ...recipe,
    params: recipe.params.map((param) => {
      const defaultValue = manifestParamDefault(component, param) ?? cssParamDefault(cssValues, param);
      return defaultValue === undefined ? param : { ...param, default: defaultValue };
    })
  };
}

function firstLayerSelector(layer: MotionLayer): string | null {
  for (const target of layer.targets) {
    if ("selector" in target && typeof target.selector === "string" && target.selector.trim()) {
      return target.selector;
    }
  }
  return null;
}

function sourceSelectorForTarget(component: MotionComponent, target: MotionRecipeTarget): string | null {
  const exactLayer = component.manifest.layers?.find((layer) => layer.id === target.id);
  const exactLayerSelector = exactLayer ? firstLayerSelector(exactLayer) : null;
  if (exactLayerSelector) return exactLayerSelector;

  const compatibleLayer = component.manifest.layers?.find(
    (layer) => layer.replaceable && target.acceptedKinds.includes(layer.kind)
  );
  const compatibleLayerSelector = compatibleLayer ? firstLayerSelector(compatibleLayer) : null;
  if (compatibleLayerSelector) return compatibleLayerSelector;

  const html = component.source.files.filter((file) => file.kind === "html").map((file) => file.content).join("\n");
  if (html.includes(`data-motion="${target.id}"`) || html.includes(`data-motion='${target.id}'`)) {
    return `[data-motion=${target.id}]`;
  }
  if (target.id === "frontPage" && selectorExists(html, ".mine-content")) return ".mine-content";
  if (target.id === "backPage" && selectorExists(html, ".orders-content")) return ".orders-content";

  return null;
}

function sourceBindingSelectors(component: MotionComponent): string[] {
  const html = component.source.files.filter((file) => file.kind === "html").map((file) => file.content).join("\n");
  return [
    ...(selectorExists(html, ".mine-content") ? [".mine-content"] : []),
    ...(selectorExists(html, ".orders-content") ? [".orders-content"] : []),
    ...(selectorExists(html, ".screen-wash") ? [".screen-wash"] : [])
  ];
}

function mergeSelectors(selectors: string[]): string[] {
  return [...new Set(selectors.flatMap((selector) => selector.split(",").map((item) => item.trim())).filter(Boolean))];
}

function withExtractedSelectors(recipe: MotionRecipe, component: MotionComponent): MotionRecipe {
  const targets = recipe.targets.map((target) => {
    const sourceSelector = sourceSelectorForTarget(component, target);
    return sourceSelector ? { ...target, selector: mergeSelectors([sourceSelector, target.selector]).join(", ") } : target;
  });
  return {
    ...recipe,
    targets,
    bindings: {
      ...recipe.bindings,
      selectors: mergeSelectors([
        ...sourceBindingSelectors(component),
        ...targets.map((target) => target.selector),
        ...recipe.bindings.selectors
      ])
    }
  };
}

function extractedRecipeWithEvidence(component: MotionComponent, recipeId: string): MotionRecipe {
  const css = component.source.files.filter((file) => file.kind === "css").map((file) => file.content).join("\n");
  return withExtractedSelectors(withExtractedParamDefaults(extractedBuiltinRecipe(recipeId), component, css), component);
}

export function extractMotionRecipeFromComponent(component: MotionComponent): ExtractedMotionRecipe | null {
  const text = sourceText(component);
  const identityText = [component.id, component.name, ...component.tags, ...component.useCases].join(" ");
  if (
    /(jd-front-back-entry-transition|前后进场|页面转场|page-transition)/i.test(identityText) ||
    (/mine-exit/.test(text) && /orders-enter/.test(text) && /transition-wash/.test(text))
  ) {
    const issues: string[] = [];
    if (!sourceHasReplay(text)) issues.push("参考组件缺少 replay 协议");
    if (!/data-motion=["']frontPage["']/.test(text)) issues.push("参考组件未显式标注前页图层");
    if (!/data-motion=["']backPage["']/.test(text)) issues.push("参考组件未显式标注后页图层");
    return {
      recipe: extractedRecipeWithEvidence(component, "page-front-back-transition"),
      confidence: issues.length === 0 ? 0.94 : 0.82,
      issues
    };
  }

  const css = component.source.files.filter((file) => file.kind === "css").map((file) => file.content).join("\n");
  const names = keyframeNames(css);
  if (names.length === 0 && !/transition\s*:/.test(css)) return null;

  let recipeId = "scale-entrance";
  if (/float/i.test(css) || /translateY|translate3d\(0/i.test(css)) recipeId = "float-loop";
  else if (/pulse|scale\(/i.test(css) && /infinite/i.test(css)) recipeId = "pulse-loop";
  else if (/bounce|cubic-bezier\(0\.34,\s*1\.56/i.test(css)) recipeId = "bounce-feedback";
  else if (/translate/i.test(css)) recipeId = "slide-entrance";
  else if (/opacity/i.test(css)) recipeId = "fade-entrance";

  const issues: string[] = [];
  if (!sourceHasReplay(text)) issues.push("参考组件缺少 replay 协议");
  if (cssVariables(css).length === 0) issues.push("参考组件缺少 CSS 变量参数");
  if ((component.manifest.layers ?? []).some((layer) => !layer.replaceable)) issues.push("参考组件存在不可替换图层");

  return {
    recipe: extractedRecipeWithEvidence(component, recipeId),
    confidence: Math.max(0.45, 0.78 - issues.length * 0.12),
    issues
  };
}

export function createMotionRecipeCache(components: MotionComponent[]): MotionRecipeCacheEntry[] {
  return components.flatMap((component) => {
    const extracted = extractMotionRecipeFromComponent(component);
    if (!extracted) return [];
    return [
      {
        ...extracted,
        componentId: component.id,
        componentName: component.name,
        hints: [component.id, component.name, ...component.tags, ...component.useCases]
      }
    ];
  });
}

export function findCachedMotionRecipe(input: {
  cache: MotionRecipeCacheEntry[];
  raw: string;
  recipeId?: string;
}): MotionRecipeCacheEntry | null {
  const raw = input.raw.toLowerCase();
  return (
    input.cache.find((entry) => input.recipeId && entry.recipe.id === input.recipeId && entry.hints.some((hint) => raw.includes(hint.toLowerCase()))) ??
    input.cache.find((entry) => entry.hints.some((hint) => raw.includes(hint.toLowerCase()))) ??
    null
  );
}

export function applyMotionRecipeToComponent(input: ApplyMotionRecipeToComponentInput): MotionComponent {
  const extracted = extractMotionRecipeFromComponent(input.sourceComponent);
  if (!extracted) throw new Error("源组件没有可提取的 MotionRecipe。");
  const targetLayer = input.targetComponent.manifest.layers?.find((layer) => layer.id === input.targetLayerId);
  if (!targetLayer) throw new Error("目标图层不存在。");
  const targetSelector = firstLayerSelector(targetLayer);
  if (!targetSelector) throw new Error("目标图层缺少可绑定 selector。");

  const applied = applyMotionRecipe({
    recipe: extracted.recipe,
    params: input.targetComponent.manifest.params,
    layers: input.targetComponent.manifest.layers ?? [],
    sourceFiles: input.targetComponent.source.files,
    targetLayerIds: [targetLayer.id],
    targetSelector,
    source: "extracted",
    confidence: extracted.confidence
  });
  const id = input.id ?? `generated-recipe-${input.sourceComponent.id}-to-${input.targetComponent.id}`;
  const capabilities = [
    ...new Set<MotionCapability>([...(input.targetComponent.manifest.capabilities ?? []), "editable", "export-html"])
  ];

  return {
    ...input.targetComponent,
    id,
    name: input.name ?? `${input.targetComponent.name} + ${extracted.recipe.name}`,
    tags: [...new Set([...input.targetComponent.tags, "recipe-applied", `recipe:${extracted.recipe.id}`])],
    manifest: {
      ...input.targetComponent.manifest,
      id: `${id}-manifest`,
      name: input.name ?? `${input.targetComponent.manifest.name} + ${extracted.recipe.name}`,
      motionRecipes: [applied.binding],
      params: applied.params,
      layers: applied.layers,
      capabilities
    },
    source: {
      ...input.targetComponent.source,
      id,
      origin: "generated",
      files: applied.files ?? input.targetComponent.source.files
    }
  };
}
