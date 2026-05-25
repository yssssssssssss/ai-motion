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
      unit: z.enum(["px", "%", "ms", "s", "deg", "rem", "vh", "vw"]).optional(),
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
