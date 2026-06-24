import { z } from "zod";

const targetRoleSchema = z.enum(["modal", "card", "screen", "container", "unknown"]);

export const atomicMotionTokenSchema = z
  .object({
    id: z.string().min(1),
    family: z.string().min(1),
    sourceElement: z.string().min(1),
    variant: z.string().min(1),
    sourceVariant: z.string().min(1),
    targetRole: targetRoleSchema,
    targetLayer: z.string().min(1),
    token: z.string(),
    property: z.enum(["scale", "opacity", "position", "roundness", "size", "color"]),
    durationMs: z.number().int().nonnegative(),
    delayMs: z.number().int().nonnegative(),
    easing: z.string().min(1),
    keyframes: z.union([
      z.array(z.number()),
      z.array(z.object({ value: z.number(), offsetMs: z.number().optional() })),
      z.array(z.string()),
      z.array(
        z.object({
          x: z.number().optional(),
          y: z.number().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          offsetMs: z.number().optional()
        })
      )
    ]),
    metadata: z.object({
      animationType: z.string().min(1),
      sourceChange: z.string().min(1),
      sourceValue: z.string().min(1),
      sourceDelay: z.string().min(1),
      sourceCssValue: z.string().min(1)
    })
  })
  .strict();

const motionSkillRecipeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    family: z.string().min(1),
    sourceElement: z.string().min(1),
    variant: z.string().min(1),
    sourceVariant: z.string().min(1),
    targetRole: targetRoleSchema,
    targetLayer: z.string().min(1),
    trigger: z.enum(["load", "hover", "click", "loop", "swipe"]),
    tokenIds: z.array(z.string().min(1)).min(1)
  })
  .strict();

const motionSkillElementSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    latestVersion: z.string().min(1),
    active: z.boolean(),
    variants: z.array(z.string().min(1)),
    packPath: z.string(),
    status: z.enum(["active", "incomplete"]).optional(),
    reason: z.string().optional()
  })
  .strict();

const motionSkillManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    source: z.literal("designer-csv"),
    variants: z.array(z.string().min(1)),
    defaultVariant: z.string().min(1),
    tokenFile: z.string().min(1),
    recipeFile: z.string().min(1),
    skillFile: z.string().min(1)
  })
  .strict();

const lockTokenSchema = z
  .object({
    fingerprint: z.string().min(1),
    status: z.enum(["active", "archived"])
  })
  .strict();

const lockFamilySchema = z
  .object({
    latestVersion: z.string().min(1),
    tokens: z.record(lockTokenSchema)
  })
  .strict();

export const motionSkillRegistrySchema = z
  .object({
    version: z.literal("1.0"),
    elements: z.array(motionSkillElementSchema)
  })
  .strict();

export const motionSkillTokenFileSchema = z.object({ tokens: z.array(atomicMotionTokenSchema) }).strict();
export const motionSkillRecipeFileSchema = z.object({ recipes: z.array(motionSkillRecipeSchema) }).strict();
export const motionSkillPackSchema = z
  .object({
    manifest: motionSkillManifestSchema,
    tokens: z.array(atomicMotionTokenSchema),
    recipes: z.array(motionSkillRecipeSchema)
  })
  .strict();
export const motionSkillLockSchema = z
  .object({
    version: z.literal("1.0"),
    families: z.record(lockFamilySchema)
  })
  .strict();
