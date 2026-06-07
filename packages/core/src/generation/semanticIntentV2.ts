import { z } from "zod";
import {
  parseSemanticGenerationIntent,
  type SemanticGenerationColor,
  type SemanticGenerationDirection,
  type SemanticGenerationEffect,
  type SemanticGenerationIntent,
  type SemanticGenerationRole,
  type SemanticGenerationSpeed,
  type SemanticGenerationTrigger
} from "./semanticIntent";

export const semanticIntentV2TargetKinds = [
  "button",
  "card",
  "text",
  "badge",
  "loader",
  "page-transition",
  "mobile-page",
  "modal",
  "unknown"
] as const;

export const semanticIntentV2LayerRoles = [
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
] as const;

export const semanticIntentV2MotionTypes = [
  "scale",
  "slide",
  "fade",
  "bounce",
  "elastic",
  "rotate",
  "pulse",
  "glow",
  "float",
  "transition"
] as const;

export const semanticIntentV2MotionCategories = [
  "entrance",
  "feedback",
  "transition",
  "loop"
] as const;

export const semanticIntentV2Compositions = ["single", "sequence", "parallel"] as const;

export type SemanticIntentV2TargetKind = (typeof semanticIntentV2TargetKinds)[number];
export type SemanticIntentV2LayerRole = (typeof semanticIntentV2LayerRoles)[number];
export type SemanticIntentV2MotionType = (typeof semanticIntentV2MotionTypes)[number];
export type SemanticIntentV2MotionCategory = (typeof semanticIntentV2MotionCategories)[number];
export type SemanticIntentV2Composition = (typeof semanticIntentV2Compositions)[number];

export type SemanticIntentV2Layer = {
  role: SemanticIntentV2LayerRole;
  label?: string | undefined;
};

export type SemanticIntentV2Motion = {
  type: SemanticIntentV2MotionType;
  target?: SemanticIntentV2LayerRole | undefined;
  trigger?: SemanticGenerationTrigger | undefined;
  direction?: SemanticGenerationDirection | undefined;
  speed?: SemanticGenerationSpeed | undefined;
  description?: string | undefined;
};

export type SemanticIntentV2 = {
  version: 2;
  target: {
    kind: SemanticIntentV2TargetKind;
    label?: string | undefined;
  };
  layers: SemanticIntentV2Layer[];
  motions: SemanticIntentV2Motion[];
  colors: SemanticGenerationColor[];
  text: string | null;
  trigger: SemanticGenerationTrigger;
  speed: SemanticGenerationSpeed;
  motionCategory: SemanticIntentV2MotionCategory | null;
  targetRoles: SemanticIntentV2LayerRole[];
  composition: SemanticIntentV2Composition;
  migrationIntent: boolean;
  referenceRecipeHints: string[];
  negativeConstraints: string[];
  referenceHints: string[];
  source: "model" | "fallback";
  confidence: number;
  raw: string;
};

const colorSchema = z.object({
  target: z.enum(["background", "text", "border", "accent"]).default("background"),
  label: z.string().min(1).max(40),
  value: z.string().regex(/^#[0-9a-f]{6}$/i)
});

const semanticIntentV2Schema = z.object({
  version: z.literal(2).default(2),
  target: z.object({
    kind: z.enum(semanticIntentV2TargetKinds),
    label: z.string().min(1).max(80).nullable().optional()
  }),
  layers: z
    .array(
      z.object({
        role: z.enum(semanticIntentV2LayerRoles),
        label: z.string().min(1).max(80).nullable().optional()
      })
    )
    .default([]),
  motions: z
    .array(
      z.object({
        type: z.enum(semanticIntentV2MotionTypes),
        target: z.enum(semanticIntentV2LayerRoles).nullable().optional(),
        trigger: z.enum(["load", "hover", "click", "loop"]).nullable().optional(),
        direction: z.enum(["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"]).nullable().optional(),
        speed: z.enum(["fast", "normal", "slow"]).nullable().optional(),
        description: z.string().min(1).max(160).nullable().optional()
      })
    )
    .default([]),
  colors: z.array(colorSchema).default([]),
  text: z.string().min(1).max(100).nullable().default(null),
  trigger: z.enum(["load", "hover", "click", "loop"]).default("load"),
  speed: z.enum(["fast", "normal", "slow"]).default("normal"),
  motionCategory: z.enum(semanticIntentV2MotionCategories).nullable().default(null),
  targetRoles: z.array(z.enum(semanticIntentV2LayerRoles)).default([]),
  composition: z.enum(semanticIntentV2Compositions).default("single"),
  migrationIntent: z.boolean().default(false),
  referenceRecipeHints: z.array(z.string().min(1).max(120)).default([]),
  negativeConstraints: z.array(z.string().min(1).max(120)).default([]),
  referenceHints: z.array(z.string().min(1).max(120)).default([]),
  source: z.enum(["model", "fallback"]).default("fallback"),
  confidence: z.number().min(0).max(1).default(0.55),
  raw: z.string().default("")
});

export function parseSemanticIntentV2Payload(value: unknown, raw: string): SemanticIntentV2 | undefined {
  const parsed = semanticIntentV2Schema.safeParse(value);
  if (!parsed.success) return undefined;

  return {
    ...parsed.data,
    version: 2,
    target: {
      kind: parsed.data.target.kind,
      label: parsed.data.target.label ?? undefined
    },
    layers: parsed.data.layers.map((layer) => ({
      role: layer.role,
      label: layer.label ?? undefined
    })),
    motions: parsed.data.motions.map((motion) => ({
      type: motion.type,
      target: motion.target ?? undefined,
      trigger: motion.trigger ?? undefined,
      direction: motion.direction ?? undefined,
      speed: motion.speed ?? undefined,
      description: motion.description ?? undefined
    })),
    targetRoles: unique([
      ...parsed.data.targetRoles,
      ...parsed.data.layers.map((layer) => layer.role),
      ...parsed.data.motions.flatMap((motion) => (motion.target ? [motion.target] : []))
    ]),
    referenceRecipeHints: unique([...parsed.data.referenceRecipeHints, ...parsed.data.referenceHints]),
    raw: parsed.data.raw.trim() || raw.trim()
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function targetKindFromLegacy(intent: SemanticGenerationIntent): SemanticIntentV2TargetKind {
  return intent.role ?? "unknown";
}

function layerRolesFromRaw(raw: string, role: SemanticIntentV2TargetKind): SemanticIntentV2LayerRole[] {
  const layers: SemanticIntentV2LayerRole[] = [];
  if (/(前景|foreground)/i.test(raw)) layers.push("foreground");
  if (/(背景|background)/i.test(raw)) layers.push("background");
  if (/(图片|图像|image|photo)/i.test(raw)) layers.push("image");
  if (/(文字|标题|文案|text|headline|title)/i.test(raw)) layers.push("text");
  if (/(按钮|button|cta)/i.test(raw)) layers.push("button");
  if (/(屏幕|页面|screen|page)/i.test(raw)) layers.push("screen");
  if (/(卡片|card)/i.test(raw)) layers.push("card");
  if (/(标签|徽章|badge|tag|pill)/i.test(raw)) layers.push("badge");
  if (/(加载|loader|loading|spinner)/i.test(raw)) layers.push("loader");
  if (/(弹窗|浮层|modal|dialog)/i.test(raw)) layers.push("modal");
  if (layers.length === 0 && role === "button") layers.push("button");
  if (layers.length === 0 && role === "card") layers.push("card");
  if (layers.length === 0 && role === "text") layers.push("text");
  if (layers.length === 0 && role === "badge") layers.push("badge");
  if (layers.length === 0 && role === "loader") layers.push("loader");
  if (layers.length === 0 && role === "modal") layers.push("modal");
  if (layers.length === 0 && role === "mobile-page") layers.push("screen");
  return unique(layers);
}

function motionTypesFromLegacy(intent: SemanticGenerationIntent): SemanticIntentV2MotionType[] {
  const types = intent.effects.map((effect): SemanticIntentV2MotionType => effect);
  if (intent.role === "page-transition" && !types.includes("transition")) types.push("transition");
  return unique(types);
}

function targetRoleForMotion(layers: SemanticIntentV2LayerRole[]): SemanticIntentV2LayerRole | undefined {
  return (
    layers.find(
      (layer) =>
        layer === "foreground" ||
        layer === "background" ||
        layer === "image" ||
        layer === "button" ||
        layer === "card" ||
        layer === "badge" ||
        layer === "loader"
    ) ??
    layers[0]
  );
}

function motionCategoryForTypes(types: SemanticIntentV2MotionType[]): SemanticIntentV2MotionCategory {
  if (types.includes("transition")) return "transition";
  if (types.includes("float") || types.includes("pulse")) return "loop";
  if (types.includes("bounce") || types.includes("elastic") || types.includes("glow")) return "feedback";
  return "entrance";
}

function compositionFromRaw(raw: string, motionCount: number): SemanticIntentV2Composition {
  if (/(同时|一起|并行|parallel)/i.test(raw)) return "parallel";
  if (/(然后|接着|先.*再|sequence|依次)/i.test(raw)) return "sequence";
  return motionCount > 1 ? "sequence" : "single";
}

function migrationIntentFromRaw(raw: string): boolean {
  return /(迁移|套用|应用到|复用|借用|基于|参考|像.*动效|把.*动效.*到|改到|替换到|apply|reuse)/i.test(raw);
}

function inferConfidence(intent: SemanticGenerationIntent): number {
  let confidence = 0.35;
  if (intent.role) confidence += 0.25;
  if (intent.effects.length > 0) confidence += 0.2;
  if (intent.colors.length > 0) confidence += 0.1;
  if (intent.referenceHints.length > 0) confidence += 0.1;
  return Math.min(0.62, confidence);
}

export function parseSemanticIntentV2Fallback(brief: string): SemanticIntentV2 {
  const legacy = parseSemanticGenerationIntent(brief);
  const targetKind = targetKindFromLegacy(legacy);
  const layers = layerRolesFromRaw(legacy.raw, targetKind);
  const motionTarget = targetRoleForMotion(layers);
  const motionTypes = motionTypesFromLegacy(legacy);
  const motions = motionTypes.map((type) => ({
    type,
    target: motionTarget,
    trigger: legacy.trigger,
    direction: legacy.direction ?? undefined,
    speed: legacy.speed
  }));

  return {
    version: 2,
    target: { kind: targetKind },
    layers: layers.map((role) => ({ role })),
    motions,
    colors: legacy.colors,
    text: legacy.text,
    trigger: legacy.trigger,
    speed: legacy.speed,
    motionCategory: motionCategoryForTypes(motionTypes),
    targetRoles: layers,
    composition: compositionFromRaw(legacy.raw, motionTypes.length),
    migrationIntent: migrationIntentFromRaw(legacy.raw),
    referenceRecipeHints: legacy.referenceHints,
    negativeConstraints: legacy.negativePreferences,
    referenceHints: legacy.referenceHints,
    source: "fallback",
    confidence: inferConfidence(legacy),
    raw: legacy.raw
  };
}

function legacyRoleFromV2(intent: SemanticIntentV2): SemanticGenerationRole | null {
  if (intent.target.kind === "modal" || intent.target.kind === "unknown") return null;
  return intent.target.kind;
}

function legacyEffectsFromV2(intent: SemanticIntentV2): SemanticGenerationEffect[] {
  const effects = intent.motions
    .map((motion) => motion.type)
    .filter((type): type is SemanticGenerationEffect =>
      ["bounce", "elastic", "slide", "scale", "glow", "fade", "rotate", "pulse", "float"].includes(type)
    );
  if (intent.motions.some((motion) => motion.type === "transition") && !effects.includes("slide")) {
    effects.push("slide");
  }
  return unique(effects);
}

export function semanticIntentV2ToLegacyIntent(intent: SemanticIntentV2): SemanticGenerationIntent {
  const fallback = parseSemanticGenerationIntent(intent.raw);
  const direction = intent.motions.find((motion) => motion.direction)?.direction ?? fallback.direction;
  const effects = legacyEffectsFromV2(intent);

  return {
    role: legacyRoleFromV2(intent) ?? fallback.role,
    colors: intent.colors.length > 0 ? intent.colors : fallback.colors,
    effects: effects.length > 0 ? effects : fallback.effects,
    direction,
    trigger: intent.trigger,
    speed: intent.speed,
    text: intent.text ?? fallback.text,
    softPreferences: unique([
      intent.target.kind,
      ...intent.layers.map((layer) => layer.role),
      ...intent.targetRoles,
      ...intent.motions.map((motion) => motion.type),
      ...(intent.motionCategory ? [intent.motionCategory] : []),
      intent.composition,
      ...(intent.migrationIntent ? ["migration"] : []),
      ...(direction ? [direction] : []),
      intent.trigger,
      intent.speed,
      ...intent.referenceRecipeHints,
      ...intent.referenceHints
    ]),
    negativePreferences: unique([...intent.negativeConstraints, ...fallback.negativePreferences]),
    referenceHints: unique([...intent.referenceHints, ...intent.referenceRecipeHints, ...fallback.referenceHints]),
    raw: intent.raw
  };
}
