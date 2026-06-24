import { z } from "zod";

const runtimeDependencySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  url: z.string().optional()
});

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("css-variable"), file: z.string(), selector: z.string(), name: z.string() }),
  z.object({ kind: z.literal("css-property"), file: z.string(), selector: z.string(), property: z.string() }),
  z.object({ kind: z.literal("html-text"), file: z.string(), selector: z.string() }),
  z.object({
    kind: z.literal("html-attribute"),
    file: z.string(),
    selector: z.string(),
    attribute: z.string()
  }),
  z.object({
    kind: z.literal("svg-attribute"),
    file: z.string(),
    selector: z.string(),
    attribute: z.string()
  }),
  z.object({ kind: z.literal("js-config"), file: z.string(), path: z.string() }),
  z.object({ kind: z.literal("component-prop"), component: z.string(), prop: z.string() })
]);

export const motionParamSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.enum([
    "color",
    "number",
    "range",
    "text",
    "image",
    "toggle",
    "select",
    "easing",
    "duration",
    "position",
    "transform"
  ]),
  default: z.unknown(),
  value: z.unknown().optional(),
  status: z.enum(["detected", "suggested", "confirmed", "rejected"]),
  confidence: z.number().min(0).max(1).optional(),
  constraints: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
      unit: z.enum(["px", "%", "ms", "s", "deg", "rem", "em", "vh", "vw", "vmin"]).optional(),
      options: z
        .array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }))
        .optional(),
      allowedFileTypes: z.array(z.string()).optional(),
      maxLength: z.number().int().positive().optional()
    })
    .optional(),
  targets: z.array(targetSchema),
  ui: z
    .object({
      group: z.string().optional(),
      order: z.number().optional(),
      helperText: z.string().optional()
    })
    .optional()
});

const designSpecBindingSchema = z.object({
  id: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  required: z.boolean().optional()
});

const motionRecipeBindingSchema = z.object({
  recipeId: z.string().min(1),
  recipeName: z.string().min(1).optional(),
  category: z.enum(["entrance", "feedback", "transition", "loop"]).optional(),
  targetLayerIds: z.array(z.string().min(1)),
  targetRoles: z.array(z.string().min(1)).optional(),
  targetSelectors: z.array(z.string().min(1)).optional(),
  paramIds: z.array(z.string().min(1)),
  trigger: z.enum(["load", "hover", "click", "loop", "swipe"]),
  source: z.enum(["builtin", "extracted", "model", "fallback"]).optional(),
  confidence: z.number().min(0).max(1).optional()
});

const motionSkillTokenBindingSchema = z
  .object({
    id: z.string().min(1),
    token: z.string(),
    animationType: z.string().min(1),
    targetLayer: z.string().min(1),
    value: z.string().min(1),
    delay: z.string().min(1),
    propertyChange: z.string().min(1),
    cssValue: z.string().min(1),
    property: z.string().min(1),
    durationParamId: z.string().min(1),
    delayParamId: z.string().min(1),
    easingParamId: z.string().min(1),
    keyframeParamIds: z.array(z.string().min(1))
  })
  .strict();

const motionSkillTargetBindingSchema = z
  .object({
    layerId: z.string().min(1),
    label: z.string().min(1),
    role: z.string().min(1),
    selector: z.string().min(1)
  })
  .strict();

const motionSkillBindingSchema = z.object({
  source: z.literal("designer-csv"),
  element: z.string().min(1),
  variant: z.string().min(1),
  family: z.string().min(1),
  version: z.string().min(1),
  recipeId: z.string().min(1),
  tokenIds: z.array(z.string().min(1)),
  tokens: z.array(motionSkillTokenBindingSchema).optional(),
  target: motionSkillTargetBindingSchema.optional()
});

const layerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["image", "text", "structure"]),
  replaceable: z.boolean(),
  required: z.boolean().optional(),
  paramId: z.string().min(1).optional(),
  targets: z.array(targetSchema)
});

export const motionManifestSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  sourceKind: z.enum(["builtin-component", "single-html", "html-package", "css-svg", "component-lite"]),
  runtime: z.object({
    engine: z.literal("html"),
    entry: z.string().min(1),
    sandbox: z.literal("iframe"),
    dependencies: z.array(runtimeDependencySchema).optional()
  }),
  params: z.array(motionParamSchema),
  groups: z.array(z.object({ id: z.string(), label: z.string(), params: z.array(z.string()) })).optional(),
  designSpecs: z.array(designSpecBindingSchema).optional(),
  motionRecipes: z.array(motionRecipeBindingSchema).optional(),
  motionSkill: motionSkillBindingSchema.optional(),
  layers: z.array(layerSchema).optional(),
  presets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        patch: z.object({ id: z.string(), sourceManifestId: z.string(), values: z.record(z.unknown()) })
      })
    )
    .optional(),
  capabilities: z.array(z.enum(["editable", "export-html", "imported", "builtin"])).optional()
});
