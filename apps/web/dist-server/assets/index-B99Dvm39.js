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
const motionParamSchema = z.object({
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
  constraints: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    unit: z.enum(["px", "%", "ms", "s", "deg", "rem", "vh", "vw"]).optional(),
    options: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) })).optional(),
    allowedFileTypes: z.array(z.string()).optional(),
    maxLength: z.number().int().positive().optional()
  }).optional(),
  targets: z.array(targetSchema),
  ui: z.object({
    group: z.string().optional(),
    order: z.number().optional(),
    helperText: z.string().optional()
  }).optional()
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
  trigger: z.enum(["load", "hover", "click", "loop"]),
  source: z.enum(["builtin", "extracted", "model", "fallback"]).optional(),
  confidence: z.number().min(0).max(1).optional()
});
const motionSkillTokenBindingSchema = z.object({
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
}).strict();
const motionSkillTargetBindingSchema = z.object({
  layerId: z.string().min(1),
  label: z.string().min(1),
  role: z.string().min(1),
  selector: z.string().min(1)
}).strict();
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
const motionManifestSchema = z.object({
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
  presets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      patch: z.object({ id: z.string(), sourceManifestId: z.string(), values: z.record(z.unknown()) })
    })
  ).optional(),
  capabilities: z.array(z.enum(["editable", "export-html", "imported", "builtin"])).optional()
});
function fileKind$1(path) {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}
function loadMotionComponentFromFiles(files) {
  const metadataRaw = files["metadata.json"];
  const manifestRaw = files["motion.manifest.json"];
  if (!metadataRaw) throw new Error("metadata.json is required");
  if (!manifestRaw) throw new Error("motion.manifest.json is required");
  const metadata = JSON.parse(metadataRaw);
  const manifest = motionManifestSchema.parse(JSON.parse(manifestRaw));
  const sourceFiles = Object.entries(files).filter(([path]) => path.startsWith("source/")).map(([path, content]) => ({ path, content, kind: fileKind$1(path) }));
  if (!sourceFiles.some((file) => file.path === manifest.runtime.entry)) {
    throw new Error(`Runtime entry ${manifest.runtime.entry} is missing`);
  }
  return {
    ...metadata,
    manifest,
    source: {
      id: metadata.id,
      origin: "builtin",
      kind: "builtin-component",
      files: sourceFiles,
      entry: manifest.runtime.entry
    }
  };
}
function entryContent(component) {
  return component.source.files.find((file) => file.path === component.source.entry)?.content ?? "";
}
function sourceText$4(component) {
  return component.source.files.map((file) => file.content).join("\n");
}
function hasRenderableSource(component) {
  return entryContent(component).trim().length > 0;
}
function hasPlaybackProtocol(component) {
  const text = sourceText$4(component);
  return /window\.motionReplay|function\s+motionReplay|motionReplay\s*=/.test(text);
}
function hasLikelyAnimation(component) {
  const text = sourceText$4(component);
  return /@keyframes|\banimation\s*:|\btransition\s*:|requestAnimationFrame|setInterval|animate\s*\(/.test(
    text
  );
}
function analyzeComponentHealth(component) {
  const checks = [
    hasRenderableSource(component) ? {
      id: "renderable-source",
      label: "可预览源码",
      status: "pass",
      message: "入口文件包含可渲染内容"
    } : {
      id: "renderable-source",
      label: "可预览源码",
      status: "fail",
      message: "入口文件仍是占位内容，需要先补全源码"
    },
    hasLikelyAnimation(component) ? {
      id: "motion-detected",
      label: "动效检测",
      status: "pass",
      message: "源码中检测到动画或过渡"
    } : {
      id: "motion-detected",
      label: "动效检测",
      status: "warn",
      message: "未检测到明显动画语义"
    },
    hasPlaybackProtocol(component) ? {
      id: "playback-protocol",
      label: "播放协议",
      status: "pass",
      message: "组件显式支持 motionReplay"
    } : {
      id: "playback-protocol",
      label: "播放协议",
      status: "warn",
      message: "组件依赖预览容器兜底重播"
    },
    component.manifest.params.length > 0 ? {
      id: "editable-params",
      label: "可编辑参数",
      status: "pass",
      message: `包含 ${component.manifest.params.length} 个参数`
    } : {
      id: "editable-params",
      label: "可编辑参数",
      status: "warn",
      message: "当前组件没有可编辑参数"
    },
    component.manifest.capabilities?.includes("export-html") ? {
      id: "exportable",
      label: "可导出",
      status: "pass",
      message: "manifest 标记支持 HTML 导出"
    } : {
      id: "exportable",
      label: "可导出",
      status: "warn",
      message: "manifest 未显式标记导出能力"
    }
  ];
  const score = Math.round(
    checks.reduce(
      (total, check2) => total + (check2.status === "pass" ? 1 : check2.status === "warn" ? 0.5 : 0),
      0
    ) / checks.length * 100
  );
  return { score, checks };
}
const CONCEPT_LABELS = {
  speed: "速度",
  easing: "缓动",
  intensity: "强度",
  trajectory: "轨迹",
  rhythm: "节奏",
  layer: "图层"
};
function normalize$3(value) {
  return value.trim().toLowerCase();
}
function paramText(param) {
  return normalize$3(`${param.id} ${param.label} ${param.type}`);
}
function isDimensionText(text) {
  return /(width|height|radius|size|popupwidth|popupheight|cardwidth|cardheight|宽度|高度|尺寸|圆角)/.test(
    text
  );
}
function isTrajectoryParam(param) {
  const text = paramText(param);
  if (!["range", "number", "position", "transform"].includes(param.type)) return false;
  if (isDimensionText(text)) return false;
  return /(midx|midy|endx|endy|startx|starty|offsetx|offsety|translate|distance|slidedistance|x$|y$|轨迹|位移|滑动|距离|起点|终点|中途)/.test(
    text
  );
}
function isRhythmParam(param) {
  const text = paramText(param);
  if (!["duration", "range", "number"].includes(param.type)) return false;
  return /(delay|interval|stagger|loop|cycle|repeat|hold|pause|startdelay|loopinterval|节奏|延迟|间隔|循环|停顿|错峰)/.test(
    text
  );
}
function isSpeedParam$1(param) {
  const text = paramText(param);
  return param.type === "duration" && /(duration|transitionduration|animationduration|时长|速度)/.test(text) && !isRhythmParam(param);
}
function isEasingParam$1(param) {
  if (param.type === "easing") return true;
  if (param.type !== "select") return false;
  return Boolean(
    param.constraints?.options?.some((option) => /ease|spring|bezier/.test(normalize$3(String(option.value))))
  );
}
function isIntensityParam$1(param) {
  const text = paramText(param);
  if (!["range", "number"].includes(param.type)) return false;
  if (isDimensionText(text) || isTrajectoryParam(param)) return false;
  return /(scale|opacity|dimopacity|blur|glow|shadow|强度|透明度|缩放|模糊|发光)/.test(text);
}
function isLayerParam(param) {
  return param.type === "image" || param.type === "text";
}
function paramConceptIds(param) {
  const concepts = [];
  if (isSpeedParam$1(param)) concepts.push("speed");
  if (isEasingParam$1(param)) concepts.push("easing");
  if (isIntensityParam$1(param)) concepts.push("intensity");
  if (isTrajectoryParam(param)) concepts.push("trajectory");
  if (isRhythmParam(param)) concepts.push("rhythm");
  if (isLayerParam(param)) concepts.push("layer");
  return concepts;
}
function describeParamConcepts(param) {
  return paramConceptIds(param).map((id) => ({ id, label: CONCEPT_LABELS[id] }));
}
function paramsForConcept(params, concept) {
  return params.filter((param) => paramConceptIds(param).includes(concept));
}
const SPEED_OPTIONS = [
  { id: "slow", label: "慢", value: "slow" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "fast", label: "快", value: "fast" }
];
const EASING_OPTIONS = [
  { id: "soft", label: "柔和", value: "soft" },
  { id: "crisp", label: "利落", value: "crisp" },
  { id: "elastic", label: "弹性", value: "elastic" },
  { id: "ease-out", label: "快入慢出", value: "ease-out" },
  { id: "ease-in", label: "慢入快出", value: "ease-in" }
];
const INTENSITY_OPTIONS = [
  { id: "subtle", label: "克制", value: "subtle" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "expressive", label: "强表现", value: "expressive" }
];
const TRAJECTORY_OPTIONS = [
  { id: "short", label: "短轨迹", value: "short" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "long", label: "长轨迹", value: "long" }
];
const RHYTHM_OPTIONS = [
  { id: "tight", label: "紧凑", value: "tight" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "relaxed", label: "舒缓", value: "relaxed" }
];
function confirmedParams$2(manifest) {
  return manifest.params.filter((param) => param.status === "confirmed");
}
function isSpeedParam(param) {
  return paramsForConcept([param], "speed").length > 0;
}
function isEasingParam(param) {
  return paramsForConcept([param], "easing").length > 0;
}
function isIntensityParam(param) {
  return paramsForConcept([param], "intensity").length > 0;
}
function buildControl(id, label, options, sliderLabel, mappedParamIds, confidence) {
  if (mappedParamIds.length === 0) return null;
  return {
    id,
    label,
    options,
    defaultOption: options.find((option) => option.id === "normal")?.value ?? options[0]?.value ?? "",
    sliderLabel,
    defaultAmount: 50,
    confidence,
    mappedParamIds
  };
}
function derivePlusControls(manifest) {
  const params = confirmedParams$2(manifest);
  const controls = [
    buildControl(
      "speed",
      "速度",
      SPEED_OPTIONS,
      "速度感",
      params.filter(isSpeedParam).map((param) => param.id),
      0.85
    ),
    buildControl(
      "easing",
      "进出效果",
      EASING_OPTIONS,
      "曲线强度",
      params.filter(isEasingParam).map((param) => param.id),
      0.85
    ),
    buildControl(
      "intensity",
      "动效强度",
      INTENSITY_OPTIONS,
      "表现强度",
      params.filter(isIntensityParam).map((param) => param.id),
      0.75
    ),
    buildControl(
      "trajectory",
      "运动轨迹",
      TRAJECTORY_OPTIONS,
      "轨迹幅度",
      paramsForConcept(params, "trajectory").map((param) => param.id),
      0.72
    ),
    buildControl(
      "rhythm",
      "节奏",
      RHYTHM_OPTIONS,
      "节奏微调",
      paramsForConcept(params, "rhythm").map((param) => param.id),
      0.7
    )
  ];
  return controls.filter((control) => Boolean(control));
}
function clamp$2(value, param) {
  const min = param.constraints?.min ?? Number.NEGATIVE_INFINITY;
  const max = param.constraints?.max ?? Number.POSITIVE_INFINITY;
  const step = param.constraints?.step;
  const bounded = Math.min(max, Math.max(min, value));
  if (!step) return Math.round(bounded * 1e3) / 1e3;
  const rounded = Math.round(bounded / step) * step;
  return Math.round(Math.min(max, Math.max(min, rounded)) * 1e3) / 1e3;
}
function defaultNumber(param) {
  const value = param.default;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
    if (match?.[0]) return Number(match[0]);
  }
  return 0;
}
function speedFactor(value) {
  const optionFactor = value.option === "fast" ? 0.78 : value.option === "slow" ? 1.22 : 1;
  const fineTune = 1 - (value.amount - 50) / 50 * 0.18;
  return optionFactor * fineTune;
}
function intensityFactor(value) {
  const optionFactor = value.option === "expressive" ? 1.25 : value.option === "subtle" ? 0.72 : 1;
  const fineTune = 1 + (value.amount - 50) / 50 * 0.2;
  return optionFactor * fineTune;
}
function trajectoryFactor(value) {
  const optionFactor = value.option === "long" ? 1.22 : value.option === "short" ? 0.78 : 1;
  const fineTune = 1 + (value.amount - 50) / 50 * 0.18;
  return optionFactor * fineTune;
}
function rhythmFactor(value) {
  const optionFactor = value.option === "relaxed" ? 1.2 : value.option === "tight" ? 0.76 : 1;
  const fineTune = 1 + (value.amount - 50) / 50 * 0.16;
  return optionFactor * fineTune;
}
function easingValue(value) {
  if (value.option === "crisp") return "ease-out";
  if (value.option === "elastic") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
  if (value.option === "ease-in") return "ease-in";
  if (value.option === "ease-out") return "ease-out";
  return "ease-in-out";
}
function supportedEasingValue(param, value) {
  const desired = easingValue(value);
  if (param.type !== "select") return desired;
  const optionValues = param.constraints?.options?.map((option) => String(option.value)) ?? [];
  if (optionValues.includes(desired)) return desired;
  if (typeof param.default === "string" && optionValues.includes(param.default)) return param.default;
  return optionValues[0] ?? desired;
}
function compilePlusPatch(input) {
  const paramsById = new Map(input.manifest.params.map((param) => [param.id, param]));
  const values = { ...input.baseValues ?? {} };
  const affectedParamIds = [];
  for (const control of derivePlusControls(input.manifest)) {
    const plusValue = input.plusValues[control.id];
    if (!plusValue) continue;
    for (const paramId of control.mappedParamIds) {
      const param = paramsById.get(paramId);
      if (!param) continue;
      if (control.id === "speed") {
        values[param.id] = clamp$2(defaultNumber(param) * speedFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }
      if (control.id === "easing") {
        values[param.id] = supportedEasingValue(param, plusValue);
        affectedParamIds.push(param.id);
      }
      if (control.id === "intensity") {
        values[param.id] = clamp$2(defaultNumber(param) * intensityFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }
      if (control.id === "trajectory") {
        values[param.id] = clamp$2(defaultNumber(param) * trajectoryFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }
      if (control.id === "rhythm") {
        values[param.id] = clamp$2(defaultNumber(param) * rhythmFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }
    }
  }
  return { values, affectedParamIds: [...new Set(affectedParamIds)] };
}
const designSpecSkills = [
  {
    id: "ecommerce-transition-motion-skill",
    label: "电商转场动效规范",
    version: "1.0",
    terms: ["ecommerce", "product", "商品", "详情", "transition", "转场"],
    appliesTo: ["商品详情页", "商品卡片", "商品媒体图层", "前后页转场"],
    rules: [
      "转场必须保持商品主体连续，不允许突然闪断或跳帧。",
      "商品图层位移应有明确方向，避免无意义抖动。",
      "转场节奏应短促清晰，默认时长控制在 220ms 到 1400ms。"
    ],
    forbidden: [
      "禁止生成与商品转场无关的装饰性漂浮元素。",
      "禁止修改未声明为可替换的结构层。",
      "禁止引入外部网络脚本或运行时依赖。"
    ],
    motionPrinciples: ["主体连续", "短促节奏", "方向明确", "可循环预览"],
    preferredParamConcepts: ["trajectory", "rhythm"],
    acceptanceChecks: ["主图层必须可替换。", "动效参数必须能映射到白名单。", "预览必须可重播。"]
  },
  {
    id: "campaign-motion-skill",
    label: "营销活动动效规范",
    version: "1.0",
    terms: ["campaign", "landing", "hero", "活动", "营销", "主视觉"],
    appliesTo: ["营销落地页", "活动首屏", "主视觉媒体"],
    rules: ["主视觉优先，动效不能遮挡核心利益点。", "入场节奏应有层次，但不应超过组件已声明参数。"],
    forbidden: ["禁止新增未声明图层。", "禁止生成影响文案可读性的高频闪烁。"],
    motionPrinciples: ["层次入场", "品牌克制", "可读优先"],
    preferredParamConcepts: ["rhythm", "intensity", "trajectory"],
    acceptanceChecks: ["文案或主视觉图层必须保留。", "动效可循环或可重播。"]
  },
  {
    id: "interactive-control-motion-skill",
    label: "交互控件动效规范",
    version: "1.0",
    terms: ["button", "checkbox", "hover", "click", "按钮", "选择控件", "悬停", "点击"],
    appliesTo: ["按钮", "表单控件", "hover 动效", "点击反馈"],
    rules: ["交互反馈必须响应明确，默认不改变布局尺寸。", "hover 与 click 的节奏应轻量。"],
    forbidden: ["禁止长时间阻塞交互。", "禁止生成需要用户理解额外操作说明的动效。"],
    motionPrinciples: ["响应明确", "轻量反馈", "布局稳定"],
    preferredParamConcepts: ["rhythm", "intensity"],
    acceptanceChecks: ["hover 或 click 状态必须可触发。", "按钮文本不能溢出。"]
  },
  {
    id: "text-reveal-motion-skill",
    label: "文字入场动效规范",
    version: "1.0",
    terms: ["text", "headline", "title", "文字", "标题", "入场"],
    appliesTo: ["标题", "正文", "SaaS hero 文案", "列表文案"],
    rules: ["文字动效必须优先保证可读性。", "入场位移和透明度变化应克制。"],
    forbidden: ["禁止生成大幅旋转文字。", "禁止让文字在结束态保持模糊。"],
    motionPrinciples: ["可读优先", "渐进显现", "结束态稳定"],
    preferredParamConcepts: ["rhythm", "trajectory", "intensity"],
    acceptanceChecks: ["文字结束态必须可读。", "动效结束后不能遮挡后续内容。"]
  },
  {
    id: "media-layer-motion-skill",
    label: "媒体图层动效规范",
    version: "1.0",
    terms: ["media", "video", "image", "poster", "媒体", "视频", "图片"],
    appliesTo: ["图片层", "视频首帧", "媒体卡片", "海报图层"],
    rules: ["媒体图层替换必须走声明的 image 参数或 layer target。", "默认只调整已声明的位移、缩放、透明度和圆角参数。"],
    forbidden: ["禁止从视频中臆造未识别出的独立图层。", "禁止把原始 video 标签作为最终生成结果。"],
    motionPrinciples: ["图层可替换", "单层可控", "抽帧可预览"],
    preferredParamConcepts: ["trajectory", "intensity", "rhythm"],
    acceptanceChecks: ["至少存在一个可替换媒体图层。", "生成结果不依赖原始 video 标签播放。"]
  }
];
function findDesignSpecSkill(id) {
  return designSpecSkills.find((skill) => skill.id === id);
}
function unique$a(values) {
  return [...new Set(values)];
}
function textForComponent(component) {
  return [
    component.id,
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    component.manifest.id,
    component.manifest.name
  ].join(" ").toLowerCase();
}
function confirmedParams$1(component) {
  return component.manifest.params.filter((param) => param.status === "confirmed");
}
function layerKindFromParam(param) {
  if (param.type === "image") return "image";
  if (param.type === "text") return "text";
  return null;
}
function layerKindFromId(id) {
  if (/(headline|title|text|copy|label)/i.test(id)) return "text";
  if (/(image|poster|frame|screen|card|face|media|popup|shell|content)/i.test(id)) return "image";
  return "structure";
}
function labelFromId$1(id) {
  return id.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}
function layerFromParam(param) {
  const kind = layerKindFromParam(param);
  if (!kind) return null;
  return {
    id: param.id,
    label: param.label,
    kind,
    source: "param",
    paramId: param.id,
    sourceFile: null,
    replaceable: true,
    targets: param.targets
  };
}
function targetFile$1(target) {
  return target && "file" in target ? target.file : null;
}
function layerFromManifest(layer) {
  return {
    id: layer.id,
    label: layer.label,
    kind: layer.kind,
    source: "source",
    paramId: layer.paramId ?? null,
    sourceFile: targetFile$1(layer.targets[0]),
    replaceable: layer.replaceable,
    targets: layer.targets
  };
}
function sourceText$3(component, kind) {
  return component.source.files.filter((file) => file.kind === kind).map((file) => file.content).join("\n");
}
function isLayerToken$1(token) {
  if (token.length < 3 || token.length > 48) return false;
  if (/^(is-playing|active|hidden|visible|root|main)$/i.test(token)) return false;
  return /(layer|frame|card|screen|poster|image|media|popup|modal|shell|stage|face|content|headline|title)/i.test(
    token
  );
}
function collectHtmlClassLayers(component) {
  const html = sourceText$3(component, "html");
  const sourceFile = component.source.files.find((file) => file.kind === "html")?.path ?? null;
  const ids = [];
  for (const match of html.matchAll(/class=["']([^"']+)["']/g)) {
    const classList = match[1];
    if (!classList) continue;
    ids.push(...classList.split(/\s+/).filter(isLayerToken$1));
  }
  return unique$a(ids).map((id) => ({
    id,
    label: labelFromId$1(id),
    kind: layerKindFromId(id),
    source: "source",
    paramId: null,
    sourceFile,
    replaceable: false,
    targets: []
  }));
}
function collectCssBackgroundLayers(component) {
  const css = sourceText$3(component, "css");
  const sourceFile = component.source.files.find((file) => file.kind === "css")?.path ?? null;
  const ids = [];
  for (const match of css.matchAll(/\.([A-Za-z_-][\w-]*)\s*{[^}]*background(?:-image)?:\s*var\(/g)) {
    const className = match[1];
    if (className && isLayerToken$1(className)) ids.push(className);
  }
  return unique$a(ids).map((id) => ({
    id,
    label: labelFromId$1(id),
    kind: layerKindFromId(id),
    source: "source",
    paramId: null,
    sourceFile,
    replaceable: false,
    targets: []
  }));
}
function analyzeLayerProfile(component) {
  if (component.manifest.layers && component.manifest.layers.length > 0) {
    const layers2 = component.manifest.layers.map(layerFromManifest);
    return {
      layers: layers2,
      replaceableCount: layers2.filter((layer) => layer.replaceable).length
    };
  }
  const layersById = /* @__PURE__ */ new Map();
  for (const param of confirmedParams$1(component)) {
    const layer = layerFromParam(param);
    if (layer) layersById.set(layer.id, layer);
  }
  for (const layer of [...collectHtmlClassLayers(component), ...collectCssBackgroundLayers(component)]) {
    if (!layersById.has(layer.id)) layersById.set(layer.id, layer);
  }
  const layers = [...layersById.values()];
  return {
    layers,
    replaceableCount: layers.filter((layer) => layer.replaceable).length
  };
}
function inferDesignSpecBindings(component) {
  if (component.manifest.designSpecs && component.manifest.designSpecs.length > 0) {
    return component.manifest.designSpecs.map((binding) => {
      const skill = findDesignSpecSkill(binding.id);
      return {
        id: binding.id,
        label: skill?.label ?? binding.id,
        confidence: binding.confidence ?? 1,
        matchedTerms: []
      };
    });
  }
  const text = textForComponent(component);
  return designSpecSkills.flatMap((rule) => {
    const matchedTerms = rule.terms.filter((term) => text.includes(term.toLowerCase()));
    if (matchedTerms.length === 0) return [];
    return [
      {
        id: rule.id,
        label: rule.label,
        confidence: Math.min(0.95, 0.55 + matchedTerms.length * 0.1),
        matchedTerms
      }
    ];
  });
}
function check$1(id, label, status, message) {
  return { id, label, status, message };
}
function scoreChecks(checks) {
  const points = checks.reduce((total, item) => {
    if (item.status === "pass") return total + 1;
    if (item.status === "warn") return total + 0.5;
    return total;
  }, 0);
  return Math.round(points / checks.length * 100);
}
function statusFromReport(input) {
  const gateFailed = input.checks.some(
    (item) => item.status === "fail" && ["bounded-params", "layer-inventory"].includes(item.id)
  );
  if (gateFailed || input.score < 60) return "blocked";
  if (input.replaceableLayerIds.length > 0 && input.plusControlCount > 0 && input.specBindings.length > 0) {
    return "ready";
  }
  return "partial";
}
function analyzeGenerationReadiness(component) {
  const allowedParamIds = confirmedParams$1(component).map((param) => param.id);
  const layerProfile = analyzeLayerProfile(component);
  const replaceableLayerIds = layerProfile.layers.filter((layer) => layer.replaceable).map((layer) => layer.id);
  const plusControlCount = derivePlusControls(component.manifest).length;
  const specBindings = inferDesignSpecBindings(component);
  const checks = [
    allowedParamIds.length > 0 ? check$1("bounded-params", "受控参数", "pass", `包含 ${allowedParamIds.length} 个已确认参数`) : check$1("bounded-params", "受控参数", "fail", "没有已确认参数，无法限制生成边界"),
    layerProfile.layers.length > 0 ? check$1("layer-inventory", "图层画像", "pass", `识别到 ${layerProfile.layers.length} 个候选图层`) : check$1("layer-inventory", "图层画像", "fail", "未识别到可复用图层"),
    replaceableLayerIds.length > 0 ? check$1("replaceable-layers", "可替换图层", "pass", `包含 ${replaceableLayerIds.length} 个可替换图层`) : layerProfile.layers.length > 0 ? check$1("replaceable-layers", "可替换图层", "warn", "有结构图层，但未声明图片或文案替换位") : check$1("replaceable-layers", "可替换图层", "fail", "没有可替换图层"),
    plusControlCount > 0 ? check$1("plus-controls", "Plus 控制", "pass", `可聚合为 ${plusControlCount} 个自然语言控制项`) : allowedParamIds.length > 0 ? check$1("plus-controls", "Plus 控制", "warn", "参数存在，但暂不能聚合为 Plus 控制") : check$1("plus-controls", "Plus 控制", "fail", "没有可聚合参数"),
    specBindings.length > 0 ? check$1("spec-binding", "规范 Skill", "pass", `匹配 ${specBindings.length} 条生成规范`) : check$1("spec-binding", "规范 Skill", "warn", "未匹配到明确规范，生成时需要人工选择")
  ];
  const score = scoreChecks(checks);
  return {
    status: statusFromReport({ score, checks, replaceableLayerIds, plusControlCount, specBindings }),
    score,
    checks,
    allowedParamIds,
    replaceableLayerIds,
    plusControlCount,
    specBindings,
    layerProfile
  };
}
function canGenerateFromComponent(component) {
  const report = analyzeGenerationReadiness(component);
  const blockers = report.checks.filter(
    (item) => item.status === "fail" || item.status === "warn" && ["replaceable-layers", "spec-binding"].includes(item.id)
  );
  return {
    allowed: blockers.length === 0,
    blockers,
    report
  };
}
function escapeRegExp$1(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeHtmlText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replaceAll('"', "&quot;");
}
function applyHtmlText(content, selector, value) {
  const motionMatch = selector.match(/^\[data-motion=([^\]]+)\]$/);
  if (!motionMatch) return content;
  const key = motionMatch[1]?.replace(/^["']|["']$/g, "");
  if (!key) return content;
  const pattern = new RegExp(
    `(<[^>]+data-motion=["']${escapeRegExp$1(key)}["'][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`
  );
  return content.replace(pattern, `$1${escapeHtmlText(value)}$3`);
}
function applyAttribute(content, selector, attribute, value) {
  const motionMatch = selector.match(/^\[data-motion=([^\]]+)\]$/);
  if (!motionMatch) return content;
  const key = motionMatch[1]?.replace(/^["']|["']$/g, "");
  if (!key) return content;
  const elementPattern = new RegExp(`<[^>]*data-motion=["']${escapeRegExp$1(key)}["'][^>]*>`);
  return content.replace(elementPattern, (element) => {
    const attributePattern = new RegExp(`\\s${escapeRegExp$1(attribute)}\\s*=\\s*(["'])`, "i");
    const match = attributePattern.exec(element);
    const escapedValue = escapeHtmlAttribute(value);
    if (!match) {
      return element.replace(/\/?>$/, (end) => ` ${attribute}="${escapedValue}"${end}`);
    }
    const quote = match[1];
    if (!quote) return element;
    const valueStart = match.index + match[0].length;
    const valueEnd = element.indexOf(quote, valueStart);
    if (valueEnd === -1) return element;
    return `${element.slice(0, valueStart)}${escapedValue}${element.slice(valueEnd)}`;
  });
}
function formatCssValue(param, value) {
  if (param.type === "image") {
    const rawValue = String(value).trim();
    if (!rawValue) return "";
    if (/^url\(/i.test(rawValue)) return rawValue;
    return `url("${rawValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}")`;
  }
  if (typeof value === "number" && param.constraints?.unit) {
    return `${value}${param.constraints.unit}`;
  }
  return String(value);
}
function findCssDeclarationEnd(content, start) {
  let quote = null;
  let parenthesisDepth = 0;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenthesisDepth += 1;
      continue;
    }
    if (char === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      continue;
    }
    if (char === ";" && parenthesisDepth === 0) return index;
  }
  return -1;
}
function applyCssVariable(content, name, value) {
  const pattern = new RegExp(`${escapeRegExp$1(name)}\\s*:\\s*`);
  const match = pattern.exec(content);
  if (!match) return `:root { ${name}: ${value}; }
${content}`;
  const valueStart = match.index + match[0].length;
  const valueEnd = findCssDeclarationEnd(content, valueStart);
  if (valueEnd === -1) return content;
  return `${content.slice(0, valueStart)}${value}${content.slice(valueEnd)}`;
}
function applyCssProperty(content, selector, property, value) {
  const pattern = new RegExp(
    `(${escapeRegExp$1(selector)}\\s*\\{[^}]*?${escapeRegExp$1(property)}\\s*:\\s*)[^;]+`,
    "gm"
  );
  return content.replace(pattern, `$1${value}`);
}
function applyTarget(content, target, param, value) {
  if (target.kind === "html-text") return applyHtmlText(content, target.selector, value);
  if (target.kind === "html-attribute")
    return applyAttribute(content, target.selector, target.attribute, value);
  if (target.kind === "svg-attribute")
    return applyAttribute(content, target.selector, target.attribute, value);
  if (target.kind === "css-variable")
    return applyCssVariable(content, target.name, formatCssValue(param, value));
  if (target.kind === "css-property") {
    return applyCssProperty(content, target.selector, target.property, formatCssValue(param, value));
  }
  return content;
}
function applyPatchToFiles(input) {
  const output = { ...input.files };
  for (const param of input.manifest.params) {
    if (!(param.id in input.patch.values)) continue;
    const value = input.patch.values[param.id];
    for (const target of param.targets) {
      const filePath = "file" in target ? target.file : void 0;
      if (!filePath || output[filePath] === void 0) continue;
      output[filePath] = applyTarget(output[filePath], target, param, value);
    }
  }
  return output;
}
const KIND_TERMS = ["button", "card", "checkbox", "hero", "text"];
const MOTION_TERMS = ["hover", "reveal", "transition", "page-transition", "animation", "micro", "magnetic", "rainbow"];
const SOURCE_TERMS = ["workeasy", "native"];
const CATEGORY_BY_KIND = {
  button: "interaction",
  checkbox: "interaction",
  card: "layout",
  hero: "text",
  text: "text"
};
const PREFERENCE_GROUPS = [
  ["按钮", "button", "cta"],
  ["卡片", "card"],
  ["选择控件", "checkbox", "checklist", "表单"],
  ["文字", "text", "hero", "reveal"],
  ["页面转场", "页面切换", "前后进场", "page-transition", "screen-transition"],
  ["hover", "悬停"],
  ["紫色", "purple", "violet"],
  ["蓝色", "blue"],
  ["渐变", "gradient"],
  ["发光", "glow", "shadow", "霓虹"],
  ["活动页", "campaign", "营销页"],
  ["落地页", "landing-page", "landing"],
  ["科技感", "tech", "saas"]
];
function tokenize$2(value) {
  return value.toLowerCase().split(/\W+/).filter(Boolean);
}
function unique$9(values) {
  return [...new Set(values.filter(Boolean))];
}
function preferenceTerms(value) {
  const lower = value.toLowerCase();
  const terms = tokenize$2(value);
  for (const group of PREFERENCE_GROUPS) {
    if (group.some((term) => lower.includes(term.toLowerCase()))) {
      terms.push(...group);
    }
  }
  return unique$9(terms);
}
const NEGATED_CLAUSE_PATTERN$1 = /(?:不要|别|不需要|无需|不是|排除|禁止|别再|不要再)\s*([^，。；;,.!！?？\n]{1,80})/gi;
function negativeClauses$1(value) {
  return [...value.matchAll(NEGATED_CLAUSE_PATTERN$1)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}
function positiveText$1(value) {
  return value.replace(NEGATED_CLAUSE_PATTERN$1, " ").trim();
}
function createFallbackBriefIntent(brief) {
  const positive = positiveText$1(brief) || brief;
  const negatives = negativeClauses$1(brief);
  const tokens = tokenize$2(positive);
  const componentKinds = unique$9(tokens.filter((token) => KIND_TERMS.includes(token)));
  const motionStyles = unique$9(tokens.filter((token) => MOTION_TERMS.includes(token)));
  const sources = unique$9(tokens.filter((token) => SOURCE_TERMS.includes(token)));
  const categories = unique$9(componentKinds.map((kind) => CATEGORY_BY_KIND[kind] ?? ""));
  const reserved = /* @__PURE__ */ new Set([...componentKinds, ...motionStyles, ...sources, ...categories]);
  const keywords = unique$9(tokens.filter((token) => !reserved.has(token)).slice(0, 8));
  return {
    query: positive,
    semanticQuery: positive,
    categories,
    componentKinds,
    motionStyles,
    sources,
    keywords,
    softPreferences: unique$9([
      ...componentKinds,
      ...motionStyles,
      ...sources,
      ...keywords,
      ...preferenceTerms(positive)
    ]).slice(0, 16),
    hardConstraints: [],
    negativePreferences: unique$9([...negatives, ...negatives.flatMap(preferenceTerms)]).slice(0, 16),
    reasoningHints: [],
    confidence: tokens.length > 0 ? 0.35 : 0
  };
}
function isParsedBriefIntent(value) {
  if (!value || typeof value !== "object") return false;
  const item = value;
  return typeof item.query === "string" && typeof item.semanticQuery === "string" && Array.isArray(item.categories) && Array.isArray(item.componentKinds) && Array.isArray(item.motionStyles) && Array.isArray(item.sources) && Array.isArray(item.keywords) && Array.isArray(item.softPreferences) && Array.isArray(item.hardConstraints) && Array.isArray(item.negativePreferences) && Array.isArray(item.reasoningHints) && typeof item.confidence === "number";
}
const DISPLAY_LABELS = {
  animation: "动画",
  background: "背景",
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
  circle: "圆形",
  click: "点击",
  cta: "转化入口",
  dark: "深色",
  ecommerce: "电商",
  expressive: "强表现",
  explosion: "爆炸",
  fade: "淡入",
  flat: "扁平",
  form: "表单",
  "gift-rain": "礼物雨",
  glass: "毛玻璃",
  glow: "发光",
  gradient: "渐变",
  gray: "灰色",
  green: "绿色",
  hero: "首屏",
  hover: "悬停",
  interaction: "交互",
  landing: "落地页",
  "landing-page": "落地页",
  layout: "布局",
  live: "直播间",
  load: "入场",
  loop: "循环",
  magnetic: "磁吸",
  marketing: "营销页",
  media: "媒体",
  micro: "微交互",
  "micro interaction": "微交互",
  "micro-interaction": "微交互",
  "mobile-page": "移动端页面",
  "mobile screen": "移动端页面",
  native: "内置",
  orange: "橙色",
  outline: "描边",
  "page-transition": "页面转场",
  particle: "粒子",
  pill: "胶囊",
  premium: "精致",
  promotion: "活动页",
  purple: "紫色",
  rainbow: "彩虹",
  red: "红色",
  reveal: "入场",
  rotate: "旋转",
  "right-to-left": "右进左出",
  saas: "软件服务",
  scale: "缩放",
  shadow: "阴影",
  slide: "位移",
  slow: "慢速",
  "screen-transition": "页面转场",
  subtle: "克制",
  tech: "科技感",
  text: "文字",
  transform: "变换",
  transition: "过渡",
  fast: "快速",
  normal: "常规",
  "left-to-right": "左进右出",
  "top-to-bottom": "上进下出",
  "bottom-to-top": "下进上出",
  uploaded: "上传",
  violet: "紫色",
  white: "白色",
  workeasy: "工作易",
  "work easy": "工作易",
  yellow: "黄色"
};
function displayLabel(value) {
  const normalized = value.trim().toLowerCase();
  return DISPLAY_LABELS[normalized] ?? value;
}
function displayLabels(values) {
  return [
    ...new Set(
      values.map(displayLabel).map((value) => value.trim()).filter(Boolean)
    )
  ];
}
function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 3 && normalized.length !== 6) return null;
  const value = normalized.length === 3 ? normalized.split("").map((p) => p + p).join("") : normalized;
  const intValue = Number.parseInt(value, 16);
  if (!Number.isFinite(intValue)) return null;
  return {
    r: intValue >> 16 & 255,
    g: intValue >> 8 & 255,
    b: intValue & 255
  };
}
function rgbToHue({ r, g, b }) {
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
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h / 60 % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}
function parseColor(value) {
  const trimmed = value.trim().toLowerCase();
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) return hexToRgb(hexMatch[0]);
  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    if (!r || !g || !b) return null;
    return { r: +r, g: +g, b: +b };
  }
  const hslMatch = trimmed.match(/^hsla?\((\d+),\s*(\d+)%,\s*(\d+)/);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    if (!h || !s || !l) return null;
    return hslToRgb(+h, +s, +l);
  }
  return null;
}
function hueToTraits(hue, brightness) {
  if (brightness < 48) return ["黑色", "深色", "black", "dark"];
  if (brightness > 228) return ["白色", "white"];
  if (hue >= 250 && hue <= 315) return ["紫色", "purple", "violet", "magenta"];
  if (hue >= 190 && hue < 250) return ["蓝色", "blue", "cyan"];
  if (hue >= 330 || hue < 10) return ["红色", "red", "pink"];
  if (hue >= 10 && hue < 45) return ["橙色", "orange", "coral"];
  if (hue >= 45 && hue < 70) return ["黄色", "yellow", "gold"];
  if (hue >= 70 && hue < 160) return ["绿色", "green", "lime"];
  if (hue >= 160 && hue < 190) return ["青色", "cyan", "teal"];
  return ["灰色", "gray"];
}
const NAMED_COLORS = {
  red: ["红色", "red"],
  orange: ["橙色", "orange"],
  yellow: ["黄色", "yellow"],
  green: ["绿色", "green"],
  blue: ["蓝色", "blue"],
  purple: ["紫色", "purple"],
  pink: ["粉色", "pink"],
  black: ["黑色", "black"],
  white: ["白色", "white"],
  gray: ["灰色", "gray"],
  grey: ["灰色", "grey"],
  cyan: ["青色", "cyan"],
  teal: ["青色", "teal"],
  magenta: ["紫色", "magenta"],
  violet: ["紫色", "violet"],
  lime: ["绿色", "lime"],
  coral: ["橙色", "coral"],
  gold: ["金色", "gold"],
  silver: ["银色", "silver"],
  brown: ["棕色", "brown"]
};
function analyzeColors(css) {
  const counts = /* @__PURE__ */ new Map();
  let isGradient = false;
  const colorProps = [
    { names: ["background", "background-color"], weight: 3 },
    { names: ["color"], weight: 2 },
    { names: ["border", "border-color", "border-top-color", "border-bottom-color", "border-left-color", "border-right-color"], weight: 1.5 },
    { names: ["box-shadow", "text-shadow"], weight: 0.8 },
    { names: ["fill", "stroke"], weight: 1 }
  ];
  for (const { names, weight } of colorProps) {
    const pattern = new RegExp(`(?:${names.join("|")})\\s*:\\s*([^;]+)`, "gi");
    for (const match of css.matchAll(pattern)) {
      const value = match[1];
      if (!value) continue;
      const parsed = parseColor(value);
      if (parsed) {
        const key = `${parsed.r},${parsed.g},${parsed.b}`;
        const existing = counts.get(key);
        counts.set(key, { weight: (existing?.weight ?? 0) + weight, rgb: key });
      }
    }
  }
  for (const match of css.matchAll(/linear-gradient\(([^)]+)\)/gi)) {
    const gradientBody = match[1];
    if (!gradientBody) continue;
    isGradient = true;
    const stops = gradientBody.split(/,(?![^(]*\))/);
    for (const stop of stops) {
      const colorPart = stop.trim().replace(/^\d+%\s*/, "").trim();
      const parsed = parseColor(colorPart);
      if (parsed) {
        const key = `${parsed.r},${parsed.g},${parsed.b}`;
        const existing = counts.get(key);
        counts.set(key, { weight: (existing?.weight ?? 0) + 1, rgb: key });
      }
    }
  }
  for (const [name, labels] of Object.entries(NAMED_COLORS)) {
    const re = new RegExp(`\\b${name}\\b`, "gi");
    if (re.test(css)) {
      for (const label of labels) {
        counts.set(`named:${name}:${label}`, { weight: 1.5, rgb: "" });
      }
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1].weight - a[1].weight).slice(0, 5);
  const allTraits = [];
  let primary = "多彩";
  let isDark = false;
  for (const [key] of sorted) {
    if (key.startsWith("named:")) {
      const label = key.split(":")[2];
      if (label) allTraits.push(label);
      continue;
    }
    const [r, g, b] = key.split(",").map(Number);
    if (r === void 0 || g === void 0 || b === void 0) continue;
    const hue = rgbToHue({ r, g, b });
    const brightness = (r + g + b) / 3;
    allTraits.push(...hueToTraits(hue, brightness));
    if (sorted[0]?.[0] === key) {
      primary = hueToTraits(hue, brightness)[0] ?? primary;
      isDark = brightness < 80;
    }
  }
  const uniqueTraits = [.../* @__PURE__ */ new Set([...allTraits, ...isGradient ? ["渐变", "gradient"] : []])];
  return {
    primary,
    secondary: uniqueTraits.filter((t) => t !== primary).slice(0, 4),
    isDark,
    isGradient,
    traits: uniqueTraits
  };
}
function unique$8(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function sourceContent(component, kind) {
  return component.source.files.filter((file) => file.kind === kind).map((file) => file.content).join("\n");
}
function visibleHtmlText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function collectMotionTraits(css) {
  const lower = css.toLowerCase();
  const traits = [];
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
  return unique$8(traits);
}
function collectFunctionTraits(component, html) {
  const lower = [component.name, component.category, ...component.tags, ...component.useCases, html].join(" ").toLowerCase();
  const traits = [];
  if (lower.includes("button") || lower.includes("<button")) traits.push("按钮", "button");
  if (lower.includes("cta") || lower.includes("join") || lower.includes("register") || lower.includes("submit")) {
    traits.push("CTA", "转化入口", "提交");
  }
  if (lower.includes("card")) traits.push("卡片", "card", "内容展示");
  if (lower.includes("checkbox") || lower.includes("checklist") || lower.includes('type="checkbox"')) {
    traits.push("选择控件", "checkbox", "表单");
  }
  if (lower.includes("hero") || lower.includes("text")) traits.push("文字", "text", "标题");
  return unique$8(traits);
}
function collectSceneTraits(component, htmlText) {
  const lower = [
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    htmlText
  ].join(" ").toLowerCase();
  const traits = [];
  if (lower.includes("campaign")) traits.push("活动页", "campaign");
  if (lower.includes("landing")) traits.push("落地页", "landing-page");
  if (lower.includes("cta") || lower.includes("marketing")) traits.push("营销页", "转化场景");
  if (lower.includes("saas") || lower.includes("hero")) traits.push("软件服务首页", "首页");
  if (lower.includes("form") || lower.includes("checkbox")) traits.push("表单");
  if (lower.includes("tech")) traits.push("科技感", "tech");
  return unique$8(traits);
}
function collectEditableTraits(component) {
  return unique$8(
    component.manifest.params.flatMap((param) => [
      param.label,
      param.id,
      param.type,
      typeof param.default === "string" ? param.default : ""
    ])
  );
}
function inferStructuralTags(css) {
  const tags = [];
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
  return unique$8(tags);
}
function extractStructuralTokens(html, css) {
  const tokens = [];
  for (const match of html.matchAll(/class=["']([^"']+)["']/g)) {
    const classList = match[1];
    if (classList) tokens.push(...classList.split(/\s+/));
  }
  for (const match of html.matchAll(/data-motion=["']([^"']+)["']/g)) {
    const key = match[1];
    if (key) tokens.push(key);
  }
  for (const match of css.matchAll(/@keyframes\s+([A-Za-z_-][\w-]*)/g)) {
    const keyframeName2 = match[1];
    if (keyframeName2) tokens.push(keyframeName2);
  }
  return unique$8(tokens.filter((token) => token.length > 1 && token.length < 32));
}
function createSearchProfile(component) {
  const css = sourceContent(component, "css");
  const html = sourceContent(component, "html");
  const htmlText = visibleHtmlText(html);
  const structural = extractStructuralTokens(html, css);
  const colorFacet = analyzeColors(css);
  const buckets = {
    colorTraits: colorFacet.traits,
    motionTraits: collectMotionTraits(css),
    functionTraits: collectFunctionTraits(component, html),
    sceneTraits: collectSceneTraits(component, htmlText),
    structuralTags: inferStructuralTags(css),
    editableTraits: collectEditableTraits(component)
  };
  const summary = unique$8([
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
const SEMANTIC_ALIAS_GROUPS = [
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
];
const ROLE_GROUPS = {
  button: ["button"],
  card: ["card"],
  checkbox: ["checkbox"],
  text: ["text"],
  media: ["media"],
  layout: ["layout"],
  background: ["background"]
};
const CATEGORY_BY_ROLE = {
  button: "interaction",
  checkbox: "interaction",
  card: "layout",
  text: "text",
  media: "media",
  layout: "layout",
  background: "background"
};
const SCENE_GROUPS = {
  活动页: ["campaign"],
  落地页: ["landing"],
  营销页: ["marketing"],
  软件服务首页: ["saas"],
  电商: ["ecommerce"],
  直播间: ["live"],
  科技感: ["tech"],
  表单: ["checkbox"]
};
const COLOR_GROUPS = {
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
const MOTION_TRIGGER_GROUPS = {
  hover: ["hover"],
  click: ["click"],
  load: ["load"],
  loop: ["loop"]
};
const MOTION_PRIMITIVE_GROUPS = {
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
const VISUAL_STYLE_GROUPS = {
  渐变: ["gradient"],
  发光: ["glow"],
  科技感: ["tech"],
  毛玻璃: ["glass"],
  描边: ["outline"],
  扁平: ["flat"],
  深色: ["black"]
};
const SHAPE_GROUPS = {
  胶囊: ["pill"],
  圆形: ["circle"],
  描边: ["outline"],
  扁平: ["flat"]
};
function normalize$2(value) {
  return value.trim().toLowerCase();
}
function tokenize$1(value) {
  return value.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}
function unique$7(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function expandSemanticTerm(value) {
  const normalized = normalize$2(value);
  const terms = [normalized, ...tokenize$1(normalized)];
  for (const group of SEMANTIC_ALIAS_GROUPS) {
    if (group.some((alias) => normalized.includes(normalize$2(alias)))) {
      terms.push(...group.map(normalize$2));
    }
  }
  return unique$7(terms);
}
function semanticTermMatches(values, term) {
  const expandedTerm = expandSemanticTerm(term);
  return values.some((value) => {
    const expandedValue = expandSemanticTerm(value);
    return expandedValue.some((candidate) => expandedTerm.includes(candidate)) || expandedTerm.some((candidate) => expandedValue.includes(candidate));
  });
}
function valuesFromIntent(intent) {
  return unique$7([
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
function canonicalMatches(values, groups) {
  return unique$7(
    Object.entries(groups).flatMap(
      ([canonical, aliases]) => values.some((value) => aliases.some((alias) => semanticTermMatches([value], alias))) ? [canonical] : []
    )
  );
}
function localizedMatches(values, groups) {
  return unique$7(
    Object.entries(groups).flatMap(
      ([label, aliases]) => values.some((value) => aliases.some((alias) => semanticTermMatches([value], alias))) ? [label] : []
    )
  );
}
function recognizedRoleTerms(values) {
  return values.filter((value) => canonicalMatches([value], ROLE_GROUPS).length > 0);
}
function componentSource$1(component) {
  if (component.source.origin === "imported") return "uploaded";
  return component.tags.includes("workeasy") ? "workeasy" : "native";
}
function inferRole(component, values) {
  const roles = canonicalMatches(values, ROLE_GROUPS);
  if (roles[0]) return roles[0];
  return component.category;
}
function inferIntent(values) {
  const intents = [];
  if (semanticTermMatches(values, "cta") || semanticTermMatches(values, "营销页")) intents.push("转化");
  if (semanticTermMatches(values, "hover") || semanticTermMatches(values, "click")) intents.push("反馈");
  if (semanticTermMatches(values, "reveal") || semanticTermMatches(values, "入场")) intents.push("引导");
  if (semanticTermMatches(values, "background")) intents.push("装饰");
  if (semanticTermMatches(values, "form") || semanticTermMatches(values, "submit")) intents.push("提交");
  return unique$7(intents);
}
function inferIntensity(primitives, triggers) {
  if (primitives.includes("glow") || primitives.includes("particle") || primitives.includes("explosion"))
    return "high";
  if (primitives.length >= 2 || triggers.includes("hover")) return "medium";
  return "low";
}
function createComponentSemanticProfile(component) {
  const searchProfile = createSearchProfile(component);
  const baseValues = unique$7([
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
  const colors = unique$7([searchProfile.colorFacet.primary, ...searchProfile.colorFacet.secondary]).filter(
    (color) => color !== "多彩"
  );
  const style = unique$7([
    ...localizedMatches(baseValues, VISUAL_STYLE_GROUPS),
    ...searchProfile.colorFacet.isGradient ? ["渐变"] : []
  ]);
  const shape = localizedMatches(baseValues, SHAPE_GROUPS);
  const intents = inferIntent([...baseValues, ...scenes, ...triggers, ...primitives, ...style]);
  const editableFields = searchProfile.editableTraits;
  const searchText = unique$7([
    component.name,
    role,
    component.category,
    componentSource$1(component),
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
    source: componentSource$1(component),
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
function createQuerySemanticProfile(intent) {
  const values = valuesFromIntent(intent);
  const roles = canonicalMatches(values, ROLE_GROUPS);
  const derivedCategories = roles.map((role) => CATEGORY_BY_ROLE[role]).filter((category) => Boolean(category));
  const categories = unique$7([...intent.categories, ...derivedCategories]);
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
  const recognizedComponentKinds = recognizedRoleTerms(intent.componentKinds);
  const unrecognizedComponentKinds = intent.componentKinds.filter(
    (value) => !recognizedComponentKinds.includes(value)
  );
  const should = unique$7([
    ...unrecognizedComponentKinds,
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
    must: unique$7([...recognizedComponentKinds, ...intent.hardConstraints]),
    should,
    mustNot: unique$7(intent.negativePreferences),
    searchText: unique$7([...values, ...should]).join(" ")
  };
}
const profileCache = /* @__PURE__ */ new WeakMap();
const semanticProfileCache = /* @__PURE__ */ new WeakMap();
function getProfile(component) {
  const cached = profileCache.get(component);
  if (cached) return cached;
  const profile = createSearchProfile(component);
  profileCache.set(component, profile);
  return profile;
}
function getSemanticProfile(component) {
  const cached = semanticProfileCache.get(component);
  if (cached) return cached;
  const profile = createComponentSemanticProfile(component);
  semanticProfileCache.set(component, profile);
  return profile;
}
const ALIAS_GROUPS = SEMANTIC_ALIAS_GROUPS;
function tokenize(value) {
  return value.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}
function normalize$1(value) {
  return value.trim().toLowerCase();
}
function unique$6(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function expandTerm(value) {
  const normalized = normalize$1(value);
  const terms = [normalized, ...tokenize(normalized)];
  for (const group of ALIAS_GROUPS) {
    if (group.some((alias) => normalized.includes(normalize$1(alias)))) {
      terms.push(...group.map(normalize$1));
    }
  }
  return unique$6(terms);
}
function extractKnownTerms(value) {
  const normalized = normalize$1(value);
  if (!normalized) return [];
  return ALIAS_GROUPS.flatMap((group) => {
    const canonical = group[0];
    return canonical && group.some((alias) => normalized.includes(normalize$1(alias))) ? [canonical] : [];
  });
}
function extractIntentTerms(intent) {
  return unique$6([
    ...[intent.query, intent.semanticQuery].flatMap((value) => [...tokenize(value), ...extractKnownTerms(value)]),
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
function componentSource(component) {
  if (component.source.origin === "imported") return "uploaded";
  return component.tags.includes("workeasy") ? "workeasy" : "native";
}
function componentHaystack(component) {
  return [
    component.name,
    component.category,
    componentSource(component),
    ...component.tags,
    ...component.useCases,
    ...component.moods
  ].join(" ").toLowerCase();
}
function textMatches(text, term) {
  const haystack = normalize$1(text);
  return expandTerm(term).some((candidate) => candidate && haystack.includes(candidate));
}
function traitMatch(traits, term) {
  const expandedTerm = expandTerm(term);
  const normalizedTerm = normalize$1(term);
  for (const trait of traits) {
    if (normalize$1(trait) === normalizedTerm) return trait;
  }
  for (const trait of traits) {
    const expandedTrait = expandTerm(trait);
    if (expandedTrait.some((candidate) => expandedTerm.includes(candidate)) || expandedTerm.some((candidate) => expandedTrait.includes(candidate))) {
      return trait;
    }
  }
  return null;
}
function computeIdfWeights(components) {
  const df = /* @__PURE__ */ new Map();
  for (const component of components) {
    const profile = getProfile(component);
    const allTraits = [
      ...profile.colorTraits,
      ...profile.motionTraits,
      ...profile.functionTraits,
      ...profile.sceneTraits,
      ...profile.structuralTags,
      ...profile.editableTraits
    ];
    const seen = /* @__PURE__ */ new Set();
    for (const trait of allTraits) {
      const n = normalize$1(trait);
      if (!seen.has(n)) {
        seen.add(n);
        df.set(n, (df.get(n) ?? 0) + 1);
      }
    }
  }
  const N = components.length || 1;
  const weights = /* @__PURE__ */ new Map();
  for (const [term, count] of df) {
    weights.set(term, Math.log(N / count) + 1);
  }
  return weights;
}
function scoreTerm(term, profile, haystack, idfWeights) {
  const idf = idfWeights.get(normalize$1(term)) ?? 1;
  const functionMatch = traitMatch(profile.functionTraits, term);
  if (functionMatch) return { score: Math.round(4 * idf * 10) / 10, match: functionMatch };
  const primaryColorHit = traitMatch([profile.colorFacet.primary], term);
  if (primaryColorHit) return { score: Math.round(6 * idf * 10) / 10, match: primaryColorHit };
  const secondaryColorHit = traitMatch(profile.colorFacet.secondary, term);
  if (secondaryColorHit) return { score: Math.round(3 * idf * 10) / 10, match: secondaryColorHit };
  const sceneMatch = traitMatch(profile.sceneTraits, term);
  if (sceneMatch) return { score: Math.round(3 * idf * 10) / 10, match: sceneMatch };
  const motionMatch = traitMatch(profile.motionTraits, term);
  if (motionMatch) return { score: Math.round(3 * idf * 10) / 10, match: motionMatch };
  const structuralMatch = traitMatch(profile.structuralTags, term);
  if (structuralMatch) return { score: Math.round(2.5 * idf * 10) / 10, match: structuralMatch };
  const colorMatch = traitMatch(profile.colorTraits, term);
  if (colorMatch) return { score: Math.round(2 * idf * 10) / 10, match: colorMatch };
  const editableMatch = traitMatch(profile.editableTraits, term);
  if (editableMatch) return { score: Math.round(1 * idf * 10) / 10, match: editableMatch };
  if (textMatches(`${profile.summary} ${profile.rawText} ${haystack}`, term))
    return { score: Math.round(1 * idf * 10) / 10, match: term };
  return { score: 0, match: null };
}
function semanticValues(profile) {
  return [
    profile.role,
    profile.category,
    profile.source,
    ...profile.scenes,
    ...profile.intents,
    ...profile.motion.triggers,
    ...profile.motion.primitives,
    profile.motion.intensity,
    ...profile.visual.colors,
    ...profile.visual.style,
    ...profile.visual.shape,
    profile.visual.density,
    ...profile.editable.editableFields
  ];
}
function componentSatisfiesTerm(profile, term) {
  return semanticTermMatches(semanticValues(profile), term);
}
function strictFilter(components, predicate) {
  return components.filter((component) => predicate(getSemanticProfile(component)));
}
function sourceFilterWithFallback(components, sources) {
  if (sources.length === 0) return components;
  const filtered = strictFilter(components, (profile) => sources.includes(profile.source));
  return filtered.length > 0 ? filtered : components;
}
function countMatches(needles, haystack) {
  return needles.filter((term) => semanticTermMatches(haystack, term)).length;
}
function semanticScore(query, profile) {
  const values = semanticValues(profile);
  let score = 0;
  if (query.roles.includes(profile.role)) score += 12;
  if (query.categories.includes(profile.category)) score += 4;
  if (query.sources.includes(profile.source)) score += 2;
  score += countMatches(query.scenes, profile.scenes) * 4;
  score += countMatches(query.intents, profile.intents) * 3;
  score += countMatches(query.motion.triggers, profile.motion.triggers) * 4;
  score += countMatches(query.motion.primitives, profile.motion.primitives) * 3;
  score += countMatches(query.visual.colors, profile.visual.colors) * 4;
  score += countMatches(query.visual.style, profile.visual.style) * 2;
  score += countMatches(query.visual.shape, profile.visual.shape) * 2;
  score += countMatches(query.should, values) * 1.5;
  return Math.round(score * 10) / 10;
}
function hasSearchIntent(intent, query) {
  return Boolean(
    intent.query.trim() || intent.semanticQuery.trim() || query.roles.length || query.categories.length || query.scenes.length || query.intents.length || query.motion.triggers.length || query.motion.primitives.length || query.visual.colors.length || query.visual.style.length || query.visual.shape.length || query.must.length || query.should.length
  );
}
function recommendComponents(input) {
  const intent = input.intent ?? createFallbackBriefIntent(input.brief ?? "");
  const queryProfile = createQuerySemanticProfile(intent);
  const terms = extractIntentTerms(intent);
  const negativeTerms = unique$6(intent.negativePreferences);
  const hardConstraints = unique$6(queryProfile.must);
  let candidates = input.components;
  if (queryProfile.roles.length > 0) {
    candidates = strictFilter(candidates, (profile) => queryProfile.roles.includes(profile.role));
  }
  if (queryProfile.categories.length > 0) {
    candidates = strictFilter(candidates, (profile) => queryProfile.categories.includes(profile.category));
  }
  if (hardConstraints.length > 0) {
    candidates = strictFilter(
      candidates,
      (profile) => hardConstraints.every((constraint) => componentSatisfiesTerm(profile, constraint))
    );
  }
  if (queryProfile.mustNot.length > 0) {
    candidates = strictFilter(
      candidates,
      (profile) => queryProfile.mustNot.every((constraint) => !componentSatisfiesTerm(profile, constraint))
    );
  }
  candidates = sourceFilterWithFallback(candidates, queryProfile.sources);
  if (candidates.length === 0) return [];
  const idfWeights = computeIdfWeights(candidates.length > 0 ? candidates : input.components);
  const requiresPositiveScore = hasSearchIntent(intent, queryProfile);
  return candidates.map((component) => {
    const profile = getProfile(component);
    const semanticProfile = getSemanticProfile(component);
    const haystack = componentHaystack(component);
    const matches = /* @__PURE__ */ new Map();
    const missing = [];
    const positiveScore = terms.reduce((total, term) => {
      const result = scoreTerm(term, profile, haystack, idfWeights);
      if (result.match) {
        const label = displayLabel(result.match);
        matches.set(label, Math.max(matches.get(label) ?? 0, result.score));
      }
      return total + result.score;
    }, 0);
    for (const term of [...queryProfile.must, ...queryProfile.should]) {
      if (componentSatisfiesTerm(semanticProfile, term)) {
        const label = displayLabel(term);
        matches.set(label, Math.max(matches.get(label) ?? 0, 1.5));
      }
    }
    const penalty = negativeTerms.reduce((total, term) => {
      return total + (scoreTerm(term, profile, haystack, idfWeights).score > 0 ? 5 : 0);
    }, 0);
    for (const constraint of hardConstraints) {
      if (!componentSatisfiesTerm(semanticProfile, constraint)) missing.push(displayLabel(constraint));
    }
    const dedupedScore = [...matches.values()].reduce((total, score2) => total + score2, 0);
    const score = (dedupedScore || positiveScore) + semanticScore(queryProfile, semanticProfile) - penalty;
    const uniqueMatches = displayLabels([...matches.keys()]).slice(0, 8);
    const uniqueMissing = displayLabels(unique$6(missing));
    const reason = uniqueMatches.length > 0 ? `命中：${uniqueMatches.join("、")}` : "作为兜底候选展示。";
    return {
      componentId: component.id,
      score,
      reason,
      matches: uniqueMatches,
      ...uniqueMissing.length > 0 ? { missing: uniqueMissing } : {},
      initialPatch: {
        id: `${component.id}-initial`,
        sourceManifestId: component.manifest.id,
        values: {}
      }
    };
  }).filter((item) => !requiresPositiveScore || item.score > 0).sort((left, right) => right.score - left.score).slice(0, input.limit ?? 6);
}
function normalize(value) {
  return value.trim().toLowerCase();
}
function componentText(component) {
  return [
    component.id,
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    component.manifest.id,
    component.manifest.name
  ].join(" ").toLowerCase();
}
function pageTransitionRequested(brief) {
  return /(jd-front-back-entry-transition|前后进场|页面转场|页面切换|前页|后页|移动端.*转场|page-transition|screen-transition)/i.test(
    brief
  );
}
function referencePhraseTargets(brief) {
  return [...brief.matchAll(/(?:基于|参考|像|按照|以|用)\s*([^，。；;,.!！?？\n]{2,80})/gi)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}
function scoreReference(component, brief) {
  const lowerBrief = normalize(brief);
  const text = componentText(component);
  let score = 0;
  const reasons = [];
  if (lowerBrief.includes(normalize(component.id))) {
    score += 120;
    reasons.push(`命中组件 ID ${component.id}`);
  }
  if (lowerBrief.includes(normalize(component.name))) {
    score += 110;
    reasons.push(`命中组件名 ${component.name}`);
  }
  for (const target of referencePhraseTargets(brief)) {
    const normalizedTarget = normalize(target);
    if (normalizedTarget && text.includes(normalizedTarget)) {
      score += 90;
      reasons.push(`命中参考描述 ${target}`);
    }
  }
  if (pageTransitionRequested(brief) && text.includes("page-transition")) {
    score += 80;
    reasons.push("命中页面转场意图");
  }
  if (pageTransitionRequested(brief) && component.id === "jd-front-back-entry-transition") {
    score += 40;
    reasons.push("命中前后进场内置组件");
  }
  if (score < 40) return null;
  return {
    componentId: component.id,
    name: component.name,
    score,
    reason: reasons.join("；")
  };
}
function resolveReferenceComponents({
  brief,
  components,
  limit = 3
}) {
  if (!brief.trim()) return [];
  return components.map((component) => scoreReference(component, brief)).filter((item) => Boolean(item)).sort((left, right) => right.score - left.score).slice(0, limit);
}
function unique$5(values) {
  return [...new Set(values)];
}
function targetFile(target) {
  return "file" in target ? target.file : null;
}
function confirmedParams(component) {
  return component.manifest.params.filter((param) => param.status === "confirmed");
}
function sourceFilesForParams(params) {
  return unique$5(
    params.flatMap((param) => param.targets.map(targetFile)).filter((file) => Boolean(file))
  );
}
function targetKindsForParams(params) {
  return unique$5(params.flatMap((param) => param.targets.map((target) => target.kind)));
}
function readinessBoost(status) {
  if (status === "ready") return 24;
  if (status === "partial") return 8;
  return -18;
}
function plusCoverageScore(component) {
  const paramCount = Math.max(1, confirmedParams(component).length);
  const mapped = unique$5(
    derivePlusControls(component.manifest).flatMap((control) => control.mappedParamIds)
  ).length;
  return Math.round(mapped / paramCount * 12 * 10) / 10;
}
function specMatchScore(intent, component) {
  const text = [
    intent.query,
    intent.semanticQuery,
    ...intent.categories,
    ...intent.componentKinds,
    ...intent.motionStyles,
    ...intent.keywords,
    ...intent.softPreferences,
    ...intent.hardConstraints,
    ...intent.reasoningHints
  ].join(" ").toLowerCase();
  return inferDesignSpecBindings(component).some((binding) => {
    if (text.includes("商品") || text.includes("product") || text.includes("ecommerce")) {
      return binding.id === "ecommerce-transition-motion-skill";
    }
    if (text.includes("活动") || text.includes("campaign") || text.includes("landing")) {
      return binding.id === "campaign-motion-skill";
    }
    if (text.includes("按钮") || text.includes("hover") || text.includes("点击")) {
      return binding.id === "interactive-control-motion-skill";
    }
    if (text.includes("文字") || text.includes("标题") || text.includes("text")) {
      return binding.id === "text-reveal-motion-skill";
    }
    return false;
  }) ? 10 : 0;
}
function candidateFromComponent(input) {
  const readiness = analyzeGenerationReadiness(input.component);
  const params = confirmedParams(input.component);
  const controls = derivePlusControls(input.component.manifest);
  const specBindings = inferDesignSpecBindings(input.component);
  const specSkills = specBindings.map((binding) => findDesignSpecSkill(binding.id)).filter((skill) => Boolean(skill));
  const allowedParamIds = readiness.allowedParamIds;
  const allowedLayerIds = readiness.replaceableLayerIds;
  const allowedSourceFiles = unique$5([
    ...sourceFilesForParams(params.filter((param) => allowedParamIds.includes(param.id))),
    ...readiness.layerProfile.layers.flatMap((layer) => layer.targets.map(targetFile)).filter((file) => Boolean(file))
  ]);
  const blockers = readiness.checks.filter((check2) => check2.status !== "pass").map((check2) => check2.id);
  const score = input.baseScore + readinessBoost(readiness.status) + specMatchScore(input.intent, input.component) + plusCoverageScore(input.component);
  return {
    componentId: input.component.id,
    score: Math.round(score * 10) / 10,
    reason: input.reason,
    readinessStatus: readiness.status,
    specSkillIds: specBindings.map((binding) => binding.id),
    specSkills,
    plusControlIds: controls.map((control) => control.id),
    allowed: {
      paramIds: allowedParamIds,
      layerIds: allowedLayerIds,
      sourceFiles: allowedSourceFiles,
      sourceTargetKinds: targetKindsForParams(params)
    },
    paramConcepts: params.map((param) => ({ paramId: param.id, concepts: paramConceptIds(param) })),
    blockers
  };
}
const ACCEPTANCE_RULES = [
  {
    id: "schema-valid",
    label: "Manifest 校验",
    description: "生成结果必须通过 MotionManifest schema 校验"
  },
  {
    id: "spec-bound",
    label: "规范绑定",
    description: "生成过程必须引用候选组件声明或推断出的设计规范 Skill"
  },
  {
    id: "diff-whitelist",
    label: "白名单 diff",
    description: "AI 只能修改候选组件允许的参数、图层和源码文件"
  },
  {
    id: "preview-playable",
    label: "预览可播放",
    description: "生成后必须保留可渲染入口和预览播放协议"
  },
  {
    id: "loopable-motion",
    label: "可循环动效",
    description: "缩略图与编辑器预览必须能重播或循环"
  }
];
function createGenerationPlan(input) {
  const intent = input.intent ?? createFallbackBriefIntent(input.brief ?? "");
  const limit = input.limit ?? 3;
  const recommendations = recommendComponents({
    intent,
    components: input.components,
    limit: Math.max(6, input.components.length)
  });
  const recommendedById = new Map(recommendations.map((item) => [item.componentId, item]));
  const scored = input.components.map((component) => {
    const recommendation = recommendedById.get(component.id);
    return candidateFromComponent({
      component,
      baseScore: recommendation?.score ?? 0,
      reason: recommendation?.reason ?? "作为受控生成候选评估。",
      intent
    });
  }).filter((candidate) => candidate.readinessStatus !== "blocked").filter((candidate) => candidate.allowed.paramIds.length > 0).sort((left, right) => right.score - left.score).slice(0, limit);
  return {
    intent,
    candidates: scored,
    acceptanceRules: ACCEPTANCE_RULES,
    fallback: scored.length > 0 ? { action: "edit-candidates", reason: "生成失败时回到候选组件的参数和图层编辑流程" } : { action: "select-component-first", reason: "没有满足门禁的候选组件，需先补齐规范、图层或参数" }
  };
}
function changedFiles(beforeFiles, afterFiles) {
  const paths = /* @__PURE__ */ new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)]);
  return [...paths].filter((path) => beforeFiles[path] !== afterFiles[path]);
}
function validateGenerationDiff(input) {
  const allowedParams = new Set(input.allowed.paramIds);
  const allowedLayers = new Set(input.allowed.layerIds);
  const allowedFiles = new Set(input.allowed.sourceFiles);
  const violations = [];
  for (const paramId of Object.keys(input.patchValues ?? {})) {
    if (allowedParams.has(paramId)) continue;
    violations.push({
      code: "param-not-whitelisted",
      id: paramId,
      message: `参数 ${paramId} 不在当前候选组件允许修改列表中`
    });
  }
  for (const layerId of Object.keys(input.layerReplacements ?? {})) {
    if (allowedLayers.has(layerId)) continue;
    violations.push({
      code: "layer-not-whitelisted",
      id: layerId,
      message: `图层 ${layerId} 不在当前候选组件允许替换列表中`
    });
  }
  const beforeFiles = input.beforeFiles ?? {};
  const afterFiles = input.afterFiles ?? {};
  for (const filePath of changedFiles(beforeFiles, afterFiles)) {
    if (allowedFiles.has(filePath)) continue;
    violations.push({
      code: "source-file-not-whitelisted",
      id: filePath,
      message: `源码文件 ${filePath} 不在当前候选组件允许修改区域中`
    });
  }
  return { valid: violations.length === 0, violations };
}
const commonOutputs = ["source/index.html", "source/style.css", "motion.manifest.json", "metadata.json"];
const conversionProtocols = [
  {
    sourceKind: "video",
    requiredInputs: ["mp4/mov/gif/webm file", "frame or layer extraction hints"],
    requiredOutputs: commonOutputs,
    constraints: [
      "must expose editable timing params",
      "must create replaceable layer declarations when layers are detected"
    ]
  },
  {
    sourceKind: "html-css",
    requiredInputs: ["html entry", "local css/js/assets"],
    requiredOutputs: commonOutputs,
    constraints: ["must remove external scripts", "must map editable CSS variables into confirmed params"]
  },
  {
    sourceKind: "react",
    requiredInputs: ["component source", "style source"],
    requiredOutputs: commonOutputs,
    constraints: ["must render as static iframe HTML", "must convert props into manifest params"]
  },
  {
    sourceKind: "nextjs",
    requiredInputs: ["page/component source", "style source", "public assets"],
    requiredOutputs: commonOutputs,
    constraints: ["must remove server-only APIs", "must flatten route assets into source files"]
  }
];
function sourceText$2(component) {
  return component.source.files.map((file) => file.content).join("\n");
}
function hasUnsafeSource(component) {
  const text = sourceText$2(component);
  return /\bfetch\s*\(|\bXMLHttpRequest\b|\bdocument\.cookie\b|\beval\s*\(|\bnew\s+Function\s*\(/i.test(text) || /\b(?:src|href)\s*=\s*["']https?:\/\//i.test(text) || /\burl\(\s*["']?https?:\/\//i.test(text) || /@import\s+["']https?:\/\//i.test(text);
}
function check(id, status, message) {
  return { id, status, message };
}
function validateGeneratedComponent(input) {
  const schema = motionManifestSchema.safeParse(input.component.manifest);
  const diffInput = { allowed: input.allowed };
  if (input.beforeFiles) diffInput.beforeFiles = input.beforeFiles;
  if (input.afterFiles) diffInput.afterFiles = input.afterFiles;
  if (input.patchValues) diffInput.patchValues = input.patchValues;
  if (input.layerReplacements) diffInput.layerReplacements = input.layerReplacements;
  const diff = validateGenerationDiff(diffInput);
  const health = analyzeComponentHealth(input.component);
  const readiness = analyzeGenerationReadiness(input.component);
  const previewOk = health.checks.every((item) => item.id !== "renderable-source" || item.status === "pass");
  const checks = [
    schema.success ? check("schema-valid", "pass", "manifest schema 校验通过") : check("schema-valid", "fail", "manifest schema 校验失败"),
    diff.valid && !hasUnsafeSource(input.component) ? check("source-whitelist", "pass", "源码修改位于白名单内") : check("source-whitelist", "fail", "源码修改超出白名单或包含高风险调用"),
    previewOk ? check("preview-playable", "pass", "预览入口可渲染") : check("preview-playable", "fail", "预览入口不可渲染"),
    readiness.status !== "blocked" ? check("readiness-gate", "pass", "生成就绪度满足最低门禁") : check("readiness-gate", "fail", "生成就绪度未通过门禁")
  ];
  return {
    valid: checks.every((item) => item.status === "pass"),
    checks,
    diffViolations: diff.violations
  };
}
function generationFailureFallback(result) {
  const failed = result.checks.find((item) => item.status === "fail");
  return {
    action: "edit-candidates",
    reason: failed?.message ?? "生成未通过门禁，返回候选组件参数编辑"
  };
}
function evaluateGeneratedComponent(component) {
  const health = analyzeComponentHealth(component);
  const readiness = analyzeGenerationReadiness(component);
  const text = sourceText$2(component);
  const items = [
    {
      id: "spec-compliance",
      passed: readiness.specBindings.length > 0,
      message: readiness.specBindings.length > 0 ? "已绑定规范" : "缺少规范绑定"
    },
    {
      id: "loopable-motion",
      passed: /infinite|window\.motionReplay|motionReplay\s*=/.test(text),
      message: "检查循环或重播协议"
    },
    {
      id: "replaceable-layers",
      passed: readiness.replaceableLayerIds.length > 0,
      message: readiness.replaceableLayerIds.length > 0 ? "存在可替换图层" : "缺少可替换图层"
    },
    {
      id: "export-runnable",
      passed: component.manifest.capabilities?.includes("export-html") === true && health.checks.some((item) => item.id === "renderable-source" && item.status === "pass"),
      message: "检查导出能力和入口源码"
    }
  ];
  return {
    passed: items.every((item) => item.passed),
    items
  };
}
function numericDefault(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}
function clamp$1(value, constraints) {
  const minimum = constraints?.min ?? value;
  const maximum = constraints?.max ?? value;
  return Math.min(maximum, Math.max(minimum, value));
}
function shorterValue(param) {
  const current = numericDefault(param.default);
  if (current === null) return null;
  const step = param.constraints?.step ?? (param.type === "duration" ? 50 : 1);
  const multiplier = param.type === "duration" ? 4 : 6;
  return clamp$1(current - step * multiplier, param.constraints);
}
function subtleVariantValue(param) {
  const current = numericDefault(param.default);
  if (current === null) return null;
  const step = param.constraints?.step ?? (param.type === "duration" ? 50 : 1);
  const multiplier = param.type === "duration" ? 2 : 4;
  return clamp$1(current - step * multiplier, param.constraints);
}
function unique$4(values) {
  return [...new Set(values)];
}
function paramSummaries(component, candidate) {
  const conceptsByParam = new Map(candidate.paramConcepts.map((item) => [item.paramId, item.concepts]));
  return component.manifest.params.filter((param) => candidate.allowed.paramIds.includes(param.id)).map((param) => {
    const summary = {
      id: param.id,
      label: param.label,
      type: param.type,
      default: param.value ?? param.default,
      concepts: conceptsByParam.get(param.id) ?? []
    };
    if (param.constraints) summary.constraints = param.constraints;
    return summary;
  });
}
function wantsShorterMotion(brief) {
  return /短|快|紧凑|收敛|short|fast|faster|compact/i.test(brief);
}
function shouldShortenParam(param) {
  return param.concepts.some((concept) => concept === "speed" || concept === "rhythm" || concept === "trajectory");
}
function isTextParam(param) {
  return param.type === "text";
}
function extractQuotedText$1(brief) {
  const match = brief.match(/[「『“"]([^」』”"]{1,80})[」』”"]/);
  return match?.[1]?.trim() || null;
}
function extractLabeledText$1(brief) {
  const match = brief.match(/(?:标题文案|标题|文案|文字|内容)\s*(?:是|为|:|：)\s*([^，。；;\n]{1,80})/);
  const value = match?.[1]?.trim().replace(/^["'「『“]+|["'」』”]+$/g, "");
  return value || null;
}
function extractTextValue(brief) {
  return extractQuotedText$1(brief) ?? extractLabeledText$1(brief);
}
function shouldUseDefaultVariant(param) {
  if (param.type === "text" || param.type === "image" || param.type === "color") return false;
  return param.concepts.some(
    (concept) => concept === "speed" || concept === "rhythm" || concept === "trajectory" || concept === "intensity"
  );
}
function buildControlledGenerationRequest(input) {
  const plan = createGenerationPlan({ brief: input.brief, components: input.components, limit: 3 });
  const componentsById = new Map(input.components.map((component) => [component.id, component]));
  return {
    brief: input.brief,
    plan,
    candidates: plan.candidates.map((candidate) => {
      const component = componentsById.get(candidate.componentId);
      return {
        componentId: candidate.componentId,
        allowed: candidate.allowed,
        skills: candidate.specSkills,
        paramConcepts: candidate.paramConcepts,
        params: component ? paramSummaries(component, candidate) : []
      };
    }),
    outputContract: {
      allowedKeys: ["baseComponentId", "paramValues", "metadata"]
    }
  };
}
function compileSemanticPatch(request) {
  const candidate = request.candidates[0];
  if (!candidate) throw new Error("没有可用于受控生成的候选组件");
  const paramValues = {};
  const textValue = extractTextValue(request.brief);
  if (textValue) {
    for (const param of candidate.params) {
      if (!candidate.allowed.paramIds.includes(param.id) || !isTextParam(param)) continue;
      paramValues[param.id] = textValue;
      break;
    }
  }
  if (wantsShorterMotion(request.brief)) {
    for (const param of candidate.params) {
      if (!candidate.allowed.paramIds.includes(param.id) || !shouldShortenParam(param)) continue;
      const nextValue = shorterValue(param);
      if (nextValue !== null) paramValues[param.id] = nextValue;
    }
  }
  if (Object.keys(paramValues).length === 0) {
    for (const param of candidate.params) {
      if (!candidate.allowed.paramIds.includes(param.id) || !shouldUseDefaultVariant(param)) continue;
      const nextValue = subtleVariantValue(param);
      if (nextValue === null) continue;
      paramValues[param.id] = nextValue;
      break;
    }
  }
  if (Object.keys(paramValues).length === 0) {
    throw new Error("没有生成有效差异");
  }
  return {
    baseComponentId: candidate.componentId,
    paramValues,
    metadata: {
      name: `${candidate.componentId} 生成版本`,
      tags: ["generated", "controlled"],
      generationBrief: request.brief
    }
  };
}
function fileMap$1(component) {
  return Object.fromEntries(component.source.files.map((file) => [file.path, file.content]));
}
function patchedParams(component, values) {
  return component.manifest.params.map((param) => {
    if (!(param.id in values)) return param;
    return { ...param, value: values[param.id] };
  });
}
function createGeneratedComponentFromPatch(input) {
  const motionPatch = {
    id: `generated-patch-${Date.now()}`,
    sourceManifestId: input.baseComponent.manifest.id,
    values: input.patch.paramValues
  };
  const beforeFiles = fileMap$1(input.baseComponent);
  const afterFiles = applyPatchToFiles({
    files: beforeFiles,
    manifest: input.baseComponent.manifest,
    patch: motionPatch
  });
  const id = `generated-${input.baseComponent.id}-${Date.now()}`;
  const component = {
    ...input.baseComponent,
    id,
    name: input.patch.metadata.name,
    tags: unique$4([...input.baseComponent.tags, ...input.patch.metadata.tags]),
    source: {
      ...input.baseComponent.source,
      id,
      origin: "generated",
      files: input.baseComponent.source.files.map((file) => ({
        ...file,
        content: afterFiles[file.path] ?? file.content
      }))
    },
    manifest: {
      ...input.baseComponent.manifest,
      id: `${id}-manifest`,
      name: input.patch.metadata.name,
      params: patchedParams(input.baseComponent, input.patch.paramValues),
      capabilities: unique$4([...input.baseComponent.manifest.capabilities ?? [], "editable", "export-html"])
    }
  };
  const validation = validateGeneratedComponent({
    component,
    allowed: input.candidate.allowed,
    beforeFiles,
    afterFiles,
    patchValues: input.patch.paramValues
  });
  return { component, patch: input.patch, validation };
}
const COLOR_ALIASES = [
  { labels: ["红色", "red", "粉红", "pink"], label: "红色", value: "#ef4444" },
  { labels: ["蓝色", "blue"], label: "蓝色", value: "#2563eb" },
  { labels: ["紫色", "purple", "violet"], label: "紫色", value: "#7c3aed" },
  { labels: ["绿色", "green"], label: "绿色", value: "#16a34a" },
  { labels: ["橙色", "orange"], label: "橙色", value: "#f97316" },
  { labels: ["黄色", "yellow", "金色", "gold"], label: "黄色", value: "#facc15" },
  { labels: ["黑色", "black", "深色"], label: "黑色", value: "#111827" },
  { labels: ["白色", "white"], label: "白色", value: "#ffffff" },
  { labels: ["灰色", "gray", "grey"], label: "灰色", value: "#6b7280" }
];
function includesAny(value, aliases) {
  return aliases.some((alias) => value.includes(alias.toLowerCase()));
}
function unique$3(values) {
  return [...new Set(values)];
}
function extractQuotedText(brief) {
  const match = brief.match(/[「『“"]([^」』”"]{1,80})[」』”"]/);
  return match?.[1]?.trim() || null;
}
function extractLabeledText(brief) {
  const match = brief.match(/(?:按钮文案|标题文案|文案|文字|内容|label)\s*(?:是|为|:|：)\s*([^，。；;\n]{1,80})/i);
  const value = match?.[1]?.trim().replace(/^["'「『“]+|["'」』”]+$/g, "");
  return value || null;
}
function colorTarget(lower) {
  if (/(文字|文本|text|font)/i.test(lower)) return "text";
  if (/(边框|描边|border|stroke)/i.test(lower)) return "border";
  if (/(强调|点缀|accent)/i.test(lower)) return "accent";
  return "background";
}
const NEGATED_CLAUSE_PATTERN = /(?:不要|别|不需要|无需|不是|排除|禁止|别再|不要再)\s*([^，。；;,.!！?？\n]{1,80})/gi;
function negativeClauses(raw) {
  return [...raw.matchAll(NEGATED_CLAUSE_PATTERN)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}
function positiveText(raw) {
  return raw.replace(NEGATED_CLAUSE_PATTERN, " ");
}
function referenceHints(raw) {
  const hints = [];
  for (const match of raw.matchAll(/(?:基于|参考|像|按照|以|用)\s*([^，。；;,.!！?？\n]{2,80})/gi)) {
    const value = match[1]?.trim();
    if (value) hints.push(value);
  }
  if (/(jd-front-back-entry-transition|前后进场代码动效|前后进场|前后切换|页面转场|页面切换|页面.*切换|page-transition|screen-transition)/i.test(raw)) {
    hints.push("jd-front-back-entry-transition", "前后进场代码动效", "page-transition");
  }
  return unique$3(hints);
}
function isPageTransitionIntent(value) {
  return /(jd-front-back-entry-transition|前后进场|前后切换|页面转场|页面切换|页面.*切换|前页|后页|移动端.*转场|page-transition|screen-transition|front.*back.*entry)/i.test(
    value
  );
}
function isMobilePageIntent(value) {
  return /(移动端页面|手机页面|移动页面|app页面|mobile page|mobile screen|页面.*图层|页面.*背景层|页面.*前景层|页面.*漂浮|前景图层|背景图层|前景层|背景层|图层.*入场)/i.test(
    value
  );
}
function parseSemanticGenerationIntent(brief) {
  const raw = brief.trim();
  const positive = positiveText(raw);
  const motionText = positive.replace(/移动端页面|移动端|移动页面|移动设备/gi, " ");
  const lower = positive.toLowerCase();
  const negatives = negativeClauses(raw);
  const refs = referenceHints(raw);
  const effects = [];
  if (/(弹动|弹性|弹跳|bounce|spring|elastic)/i.test(motionText)) effects.push("bounce", "elastic");
  if (/(滑动|位移|移动|进入距离|退出距离|translate|slide|左侧|右侧|上方|下方|前页|后页)/i.test(motionText))
    effects.push("slide");
  if (/(缩放|放大|scale)/i.test(motionText)) effects.push("scale");
  if (/(发光|光晕|glow|shadow|霓虹)/i.test(motionText)) effects.push("glow");
  if (/(淡入|淡出|fade|透明|泛白)/i.test(motionText)) effects.push("fade");
  if (/(旋转|rotate)/i.test(motionText)) effects.push("rotate");
  if (/(脉冲|呼吸|pulse|pulsing)/i.test(motionText)) effects.push("pulse");
  if (/(漂浮|浮动|float|floating|缓慢飘|轻微飘)/i.test(motionText)) effects.push("float");
  let role = null;
  if (isPageTransitionIntent(positive)) role = "page-transition";
  else if (isMobilePageIntent(positive)) role = "mobile-page";
  else if (/(按钮|button|cta)/i.test(positive)) role = "button";
  else if (/(卡片|card)/i.test(positive)) role = "card";
  else if (/(标签|徽章|badge|tag|pill)/i.test(positive)) role = "badge";
  else if (/(加载|载入|loading|loader|spinner|进度条)/i.test(positive)) role = "loader";
  else if (/(文字|标题|text|headline|title)/i.test(positive)) role = "text";
  let direction = null;
  if (/(前页.*左.*后页.*右|后页.*右.*进|右.*左|right.*left|from\s+right|right-to-left)/i.test(positive))
    direction = "right-to-left";
  else if (/(左.*右|left.*right|from\s+left|left-to-right)/i.test(positive)) direction = "left-to-right";
  else if (/(上.*下|top.*bottom|from\s+top|top-to-bottom)/i.test(positive)) direction = "top-to-bottom";
  else if (/(下.*上|bottom.*top|from\s+bottom|bottom-to-top)/i.test(positive)) direction = "bottom-to-top";
  const colors = COLOR_ALIASES.flatMap(
    (item) => includesAny(lower, item.labels) ? [{ target: colorTarget(lower), label: item.label, value: item.value }] : []
  );
  let trigger = "load";
  if (/(悬停|hover)/i.test(positive)) trigger = "hover";
  else if (/(点击|click|tap)/i.test(positive)) trigger = "click";
  else if (/(循环|loop|infinite|加载|载入|loading|loader|spinner|进度条)/i.test(positive)) trigger = "loop";
  else if (effects.includes("float") || effects.includes("pulse")) trigger = "loop";
  let speed = "normal";
  if (/(快|快速|紧凑|fast|faster|quick)/i.test(positive)) speed = "fast";
  else if (/(慢|舒缓|slow|relaxed)/i.test(positive)) speed = "slow";
  return {
    role,
    colors,
    effects: unique$3(effects),
    direction,
    trigger,
    speed,
    text: extractQuotedText(raw) ?? extractLabeledText(raw),
    softPreferences: unique$3([
      ...role ? [role] : [],
      ...colors.map((color) => color.label),
      ...effects,
      ...direction ? [direction] : [],
      trigger,
      speed,
      ...refs
    ]),
    negativePreferences: unique$3(negatives),
    referenceHints: refs,
    raw
  };
}
const semanticIntentV2TargetKinds = [
  "button",
  "card",
  "text",
  "badge",
  "loader",
  "page-transition",
  "mobile-page",
  "modal",
  "unknown"
];
const semanticIntentV2LayerRoles = [
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
];
const semanticIntentV2MotionTypes = [
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
];
const semanticIntentV2MotionCategories = [
  "entrance",
  "feedback",
  "transition",
  "loop"
];
const semanticIntentV2Compositions = ["single", "sequence", "parallel"];
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
  layers: z.array(
    z.object({
      role: z.enum(semanticIntentV2LayerRoles),
      label: z.string().min(1).max(80).nullable().optional()
    })
  ).default([]),
  motions: z.array(
    z.object({
      type: z.enum(semanticIntentV2MotionTypes),
      target: z.enum(semanticIntentV2LayerRoles).nullable().optional(),
      trigger: z.enum(["load", "hover", "click", "loop"]).nullable().optional(),
      direction: z.enum(["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"]).nullable().optional(),
      speed: z.enum(["fast", "normal", "slow"]).nullable().optional(),
      description: z.string().min(1).max(160).nullable().optional()
    })
  ).default([]),
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
function parseSemanticIntentV2Payload(value, raw) {
  const parsed = semanticIntentV2Schema.safeParse(value);
  if (!parsed.success) return void 0;
  return {
    ...parsed.data,
    version: 2,
    target: {
      kind: parsed.data.target.kind,
      label: parsed.data.target.label ?? void 0
    },
    layers: parsed.data.layers.map((layer) => ({
      role: layer.role,
      label: layer.label ?? void 0
    })),
    motions: parsed.data.motions.map((motion) => ({
      type: motion.type,
      target: motion.target ?? void 0,
      trigger: motion.trigger ?? void 0,
      direction: motion.direction ?? void 0,
      speed: motion.speed ?? void 0,
      description: motion.description ?? void 0
    })),
    targetRoles: unique$2([
      ...parsed.data.targetRoles,
      ...parsed.data.layers.map((layer) => layer.role),
      ...parsed.data.motions.flatMap((motion) => motion.target ? [motion.target] : [])
    ]),
    referenceRecipeHints: unique$2([...parsed.data.referenceRecipeHints, ...parsed.data.referenceHints]),
    raw: parsed.data.raw.trim() || raw.trim()
  };
}
function unique$2(values) {
  return [...new Set(values)];
}
function targetKindFromLegacy(intent) {
  return intent.role ?? "unknown";
}
function layerRolesFromRaw(raw, role) {
  const layers = [];
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
  return unique$2(layers);
}
function motionTypesFromLegacy(intent) {
  const types = intent.effects.map((effect) => effect);
  if (intent.role === "page-transition" && !types.includes("transition")) types.push("transition");
  return unique$2(types);
}
function targetRoleForMotion(layers) {
  return layers.find(
    (layer) => layer === "foreground" || layer === "background" || layer === "image" || layer === "button" || layer === "card" || layer === "badge" || layer === "loader"
  ) ?? layers[0];
}
function motionCategoryForTypes(types) {
  if (types.includes("transition")) return "transition";
  if (types.includes("float") || types.includes("pulse")) return "loop";
  if (types.includes("bounce") || types.includes("elastic") || types.includes("glow")) return "feedback";
  return "entrance";
}
function compositionFromRaw(raw, motionCount) {
  if (/(同时|一起|并行|parallel)/i.test(raw)) return "parallel";
  if (/(然后|接着|先.*再|sequence|依次)/i.test(raw)) return "sequence";
  return motionCount > 1 ? "sequence" : "single";
}
function migrationIntentFromRaw(raw) {
  return /(迁移|套用|应用到|复用|借用|基于|参考|像.*动效|把.*动效.*到|改到|替换到|apply|reuse)/i.test(raw);
}
function inferConfidence(intent) {
  let confidence = 0.35;
  if (intent.role) confidence += 0.25;
  if (intent.effects.length > 0) confidence += 0.2;
  if (intent.colors.length > 0) confidence += 0.1;
  if (intent.referenceHints.length > 0) confidence += 0.1;
  return Math.min(0.62, confidence);
}
function parseSemanticIntentV2Fallback(brief) {
  const legacy = parseSemanticGenerationIntent(brief);
  const targetKind = targetKindFromLegacy(legacy);
  const layers = layerRolesFromRaw(legacy.raw, targetKind);
  const motionTarget = targetRoleForMotion(layers);
  const motionTypes = motionTypesFromLegacy(legacy);
  const motions = motionTypes.map((type) => ({
    type,
    target: motionTarget,
    trigger: legacy.trigger,
    direction: legacy.direction ?? void 0,
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
function legacyRoleFromV2(intent) {
  if (intent.target.kind === "modal" || intent.target.kind === "unknown") return null;
  return intent.target.kind;
}
function legacyEffectsFromV2(intent) {
  const effects = intent.motions.map((motion) => motion.type).filter(
    (type) => ["bounce", "elastic", "slide", "scale", "glow", "fade", "rotate", "pulse", "float"].includes(type)
  );
  if (intent.motions.some((motion) => motion.type === "transition") && !effects.includes("slide")) {
    effects.push("slide");
  }
  return unique$2(effects);
}
function semanticIntentV2ToLegacyIntent(intent) {
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
    softPreferences: unique$2([
      intent.target.kind,
      ...intent.layers.map((layer) => layer.role),
      ...intent.targetRoles,
      ...intent.motions.map((motion) => motion.type),
      ...intent.motionCategory ? [intent.motionCategory] : [],
      intent.composition,
      ...intent.migrationIntent ? ["migration"] : [],
      ...direction ? [direction] : [],
      intent.trigger,
      intent.speed,
      ...intent.referenceRecipeHints,
      ...intent.referenceHints
    ]),
    negativePreferences: unique$2([...intent.negativeConstraints, ...fallback.negativePreferences]),
    referenceHints: unique$2([...intent.referenceHints, ...intent.referenceRecipeHints, ...fallback.referenceHints]),
    raw: intent.raw
  };
}
const motionRecipeCategories = [
  "entrance",
  "feedback",
  "transition",
  "loop"
];
const motionRecipeParamKinds = [
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
];
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
const motionRecipeSchema = z.object({
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
const rootTarget$1 = (name) => ({
  kind: "css-variable",
  file: "source/style.css",
  selector: ":root",
  name
});
const recipeTextParam = (param) => {
  const type = param.kind === "duration" ? "duration" : param.kind === "easing" ? "easing" : param.kind === "loop" ? "toggle" : param.kind === "direction" ? "select" : param.kind === "transformOrigin" ? "text" : "range";
  const constraints = param.kind === "duration" ? { min: 120, max: 6e3, step: 20, unit: "ms" } : param.kind === "delay" ? { min: 0, max: 3e3, step: 20, unit: "ms" } : param.kind === "distance" ? { min: -1200, max: 1200, step: 1, unit: "px" } : param.kind === "scale" ? { min: 0.2, max: 2, step: 0.01 } : param.kind === "opacity" ? { min: 0, max: 1, step: 0.01 } : param.kind === "rotate" ? { min: -360, max: 360, step: 1, unit: "deg" } : param.kind === "stagger" ? { min: 0, max: 1e3, step: 20, unit: "ms" } : param.kind === "direction" ? {
    options: [
      { label: "从左到右", value: "left-to-right" },
      { label: "从右到左", value: "right-to-left" },
      { label: "从上到下", value: "top-to-bottom" },
      { label: "从下到上", value: "bottom-to-top" }
    ]
  } : void 0;
  const group = param.kind === "duration" || param.kind === "delay" || param.kind === "stagger" ? "时间" : param.kind === "easing" ? "缓动" : param.kind === "distance" || param.kind === "direction" ? "轨迹" : param.kind === "opacity" ? "透明度" : param.kind === "scale" ? "缩放" : param.kind === "rotate" || param.kind === "transformOrigin" ? "变换" : param.kind === "loop" ? "循环" : "动效";
  return {
    id: param.id,
    label: param.label,
    type,
    default: param.default,
    status: "confirmed",
    ...constraints ? { constraints } : {},
    targets: param.target ? [param.target] : [],
    ui: { group }
  };
};
const builtinMotionRecipes = [
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
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 900, target: rootTarget$1("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-out", target: rootTarget$1("--motion-easing") },
      { id: "foregroundScaleStart", label: "入场初始缩放", kind: "scale", default: 0.72, target: rootTarget$1("--foreground-scale-start") },
      { id: "foregroundScaleEnd", label: "入场结束缩放", kind: "scale", default: 1, target: rootTarget$1("--foreground-scale-end") },
      { id: "opacityStart", label: "入场初始透明度", kind: "opacity", default: 0, target: rootTarget$1("--opacity-start") },
      { id: "opacityEnd", label: "入场结束透明度", kind: "opacity", default: 1, target: rootTarget$1("--opacity-end") },
      { id: "transformOrigin", label: "变换原点", kind: "transformOrigin", default: "50% 72%", target: rootTarget$1("--transform-origin") }
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
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 820, target: rootTarget$1("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-out", target: rootTarget$1("--motion-easing") },
      { id: "slideDistance", label: "滑入距离", kind: "distance", default: 80, target: rootTarget$1("--slide-distance") },
      { id: "slideDirection", label: "滑入方向", kind: "direction", default: "left-to-right", target: rootTarget$1("--slide-direction") },
      { id: "opacityStart", label: "入场初始透明度", kind: "opacity", default: 0, target: rootTarget$1("--opacity-start") },
      { id: "opacityEnd", label: "入场结束透明度", kind: "opacity", default: 1, target: rootTarget$1("--opacity-end") }
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
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 620, target: rootTarget$1("--motion-duration") },
      {
        id: "motionEasing",
        label: "弹性缓动",
        kind: "easing",
        default: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        target: rootTarget$1("--motion-easing")
      },
      { id: "bounceIntensity", label: "弹动强度", kind: "scale", default: 1.14, target: rootTarget$1("--bounce-scale") },
      { id: "settleScale", label: "回落缩放", kind: "scale", default: 0.97, target: rootTarget$1("--settle-scale") }
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
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 900, target: rootTarget$1("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-out", target: rootTarget$1("--motion-easing") },
      { id: "opacityStart", label: "初始透明度", kind: "opacity", default: 0, target: rootTarget$1("--opacity-start") },
      { id: "opacityEnd", label: "结束透明度", kind: "opacity", default: 1, target: rootTarget$1("--opacity-end") },
      { id: "motionDelay", label: "延迟时间", kind: "delay", default: 0, target: rootTarget$1("--motion-delay") }
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
      { id: "floatDuration", label: "漂浮周期", kind: "duration", default: 3200, target: rootTarget$1("--float-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-in-out", target: rootTarget$1("--motion-easing") },
      { id: "floatAmplitude", label: "漂浮幅度", kind: "distance", default: 22, target: rootTarget$1("--float-amplitude") },
      { id: "floatDirection", label: "漂浮方向", kind: "direction", default: "bottom-to-top", target: rootTarget$1("--float-direction") },
      { id: "motionLoop", label: "循环播放", kind: "loop", default: true, target: rootTarget$1("--motion-loop") }
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
      { id: "motionDuration", label: "动画时长", kind: "duration", default: 1200, target: rootTarget$1("--motion-duration") },
      { id: "motionEasing", label: "动效缓动", kind: "easing", default: "ease-in-out", target: rootTarget$1("--motion-easing") },
      { id: "pulseScale", label: "脉冲缩放", kind: "scale", default: 1.08, target: rootTarget$1("--pulse-scale") },
      { id: "opacityStart", label: "低点透明度", kind: "opacity", default: 0.72, target: rootTarget$1("--opacity-start") },
      { id: "opacityEnd", label: "高点透明度", kind: "opacity", default: 1, target: rootTarget$1("--opacity-end") },
      { id: "motionLoop", label: "循环播放", kind: "loop", default: true, target: rootTarget$1("--motion-loop") }
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
      { id: "cycleDuration", label: "循环时长", kind: "duration", default: 2640, target: rootTarget$1("--cycle-duration") },
      { id: "easing", label: "缓动曲线", kind: "easing", default: "cubic-bezier(0.18, 0.86, 0.22, 1)", target: rootTarget$1("--motion-easing") },
      { id: "enterDistance", label: "进入距离", kind: "distance", default: 520, target: rootTarget$1("--enter-distance") },
      { id: "exitDistance", label: "退出距离", kind: "distance", default: -520, target: rootTarget$1("--exit-distance") },
      { id: "transitionOpacity", label: "过渡泛白", kind: "opacity", default: 0.72, target: rootTarget$1("--transition-opacity") },
      { id: "windowRadius", label: "屏幕圆角", kind: "distance", default: 92, target: rootTarget$1("--window-radius") }
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
function validateMotionRecipe(recipe) {
  const parsed = motionRecipeSchema.safeParse(recipe);
  const issues = [];
  if (!parsed.success) issues.push("recipe schema 校验失败");
  if (recipe.targets.length === 0) issues.push("缺少目标图层");
  if (!recipe.bindings.replay) issues.push("缺少 replay 绑定");
  if (recipe.targets.some((target) => !target.replaceable)) issues.push("存在不可替换目标图层");
  return { valid: issues.length === 0, issues };
}
function motionRecipeRequestFromSemanticIntent(intent) {
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
function resolveMotionRecipe(request) {
  const recipe = builtinMotionRecipes.find((item) => item.id === request.recipeId) ?? builtinMotionRecipes[0];
  if (!recipe) throw new Error("No builtin motion recipe is registered.");
  return recipe;
}
function dataMotionValue(selector) {
  return selector.match(/\[data-motion=([^\]\s,]+)\]/)?.[1] ?? null;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function selectorExists(html, selector) {
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
function firstExistingSelector(html, selectors) {
  return selectors.find((selector) => selectorExists(html, selector));
}
function selectorForRecipe(input) {
  const preferredRole = input.request?.targetRoles.find((role) => role !== "unknown");
  const target = input.recipe.targets.find((item) => item.role === preferredRole) ?? input.recipe.targets.find((item) => item.required) ?? input.recipe.targets[0];
  const selectors = [
    ...target?.selector.split(",").map((selector) => selector.trim()).filter(Boolean) ?? [],
    ...input.recipe.bindings.selectors
  ];
  return firstExistingSelector(input.html, selectors) ?? selectors[0] ?? "[data-motion=motionLayer]";
}
function ensureHtmlTarget(html, selector) {
  if (selectorExists(html, selector)) return html;
  const value = dataMotionValue(selector) ?? "motionLayer";
  const layer = `
      <div class="motion-recipe-layer" data-motion="${value}" aria-hidden="true"></div>`;
  if (/<main\b[^>]*>/i.test(html)) {
    return html.replace(/(<main\b[^>]*>)/i, `$1${layer}`);
  }
  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/(<body\b[^>]*>)/i, `$1
    <main data-motion-root>${layer}
    </main>`);
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
    <script src="./script.js"><\/script>
  </body>
</html>`;
}
function cssValue(param) {
  if (param.kind === "duration" || param.kind === "delay" || param.kind === "stagger") return `${param.default}ms`;
  if (param.kind === "distance") return `${param.default}px`;
  if (param.kind === "rotate") return `${param.default}deg`;
  if (typeof param.default === "boolean") return param.default ? "1" : "0";
  return String(param.default);
}
function cssVarEntries(recipe) {
  return recipe.params.flatMap((param) => {
    const target = param.target;
    return target?.kind === "css-variable" ? [`  ${target.name}: ${cssValue(param)};`] : [];
  });
}
function injectRootVariables(css, recipe) {
  const entries = cssVarEntries(recipe).filter((entry) => {
    const name = entry.match(/(--[a-z0-9-]+)\s*:/i)?.[1];
    return name ? !new RegExp(`${name}\\s*:`, "i").test(css) : true;
  });
  if (entries.length === 0) return css;
  if (/:root\s*\{/i.test(css)) {
    return css.replace(/:root\s*\{/, (match) => `${match}
${entries.join("\n")}`);
  }
  return `:root {
${entries.join("\n")}
}

${css}`;
}
function keyframeBlock(name) {
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
function injectKeyframes(css, recipe) {
  const missing = recipe.bindings.keyframes.filter(
    (name) => !new RegExp(`@keyframes\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(css)
  );
  if (missing.length === 0) return css;
  return `${css.trimEnd()}

${missing.map(keyframeBlock).join("\n\n")}
`;
}
function animationNameForRecipe(recipe, trigger) {
  if (recipe.id === "bounce-feedback") return trigger === "hover" ? "generated-hover-bounce" : "generated-click-bounce";
  return recipe.timeline.keyframes[0] ?? recipe.bindings.keyframes[0] ?? "generated-motion-recipe";
}
function injectAnimationRule(input) {
  const animationName = animationNameForRecipe(input.recipe, input.trigger);
  const durationVar = input.recipe.timeline.durationParamId === "floatDuration" ? "--float-duration" : "--motion-duration";
  const duration = input.recipe.id === "page-front-back-transition" ? "var(--cycle-duration, 2640ms)" : `var(${durationVar}, 900ms)`;
  const easing = input.recipe.id === "page-front-back-transition" ? "var(--motion-easing, ease-out)" : "var(--motion-easing, ease-out)";
  const loop = input.recipe.timeline.loop || input.trigger === "loop" ? " infinite" : "";
  const playSelector = input.trigger === "hover" ? `${input.selector}:hover` : `.is-playing ${input.selector}`;
  const rule = `${playSelector} {
  animation: ${animationName} ${duration} ${easing} both${loop};
  will-change: transform, opacity;
}`;
  if (input.css.includes(`animation: ${animationName}`)) return input.css;
  return `${input.css.trimEnd()}

${rule}
`;
}
function replayProtocol(trigger, selector) {
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

  ${trigger === "click" ? 'if (target instanceof HTMLElement) target.addEventListener("click", replay);' : ""}
  ${trigger === "load" || trigger === "loop" ? "requestAnimationFrame(replay);" : ""}
})();`;
}
function ensureReplayProtocol(js, trigger, selector) {
  if (/window\.motionReplay|motionReplay\s*=/.test(js)) return js;
  return `${js.trimEnd()}

${replayProtocol(trigger, selector)}
`;
}
function kindForPath(path) {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}
function upsertFile(files, path, content) {
  const found = files.some((file) => file.path === path);
  if (found) {
    return files.map((file) => file.path === path ? { ...file, content } : file);
  }
  return [...files, { path, kind: kindForPath(path), content }];
}
function applyMotionRecipeToFiles(input) {
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
function applyMotionRecipe(input) {
  const recipeParamIds = new Set(input.recipe.params.map((param) => param.id));
  const recipeParamById = new Map(input.recipe.params.map((param) => [param.id, recipeTextParam(param)]));
  const paramIds = new Set(input.params.map((param) => param.id));
  const layerIds = new Set(input.layers.map((layer) => layer.id));
  const recipeParams = input.recipe.params.filter((param) => !paramIds.has(param.id)).map(recipeTextParam);
  const recipeLayers = input.recipe.targets.filter((target) => !layerIds.has(target.id)).map(
    (target) => ({
      id: target.id,
      label: target.id,
      kind: target.acceptedKinds[0] ?? "structure",
      replaceable: true,
      required: target.required,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: target.selector, attribute: "class" }]
    })
  );
  const layers = [...input.layers, ...recipeLayers].map((layer) => ({ ...layer, replaceable: true }));
  const params = [
    ...input.params.map((param) => {
      const recipeParam = recipeParamById.get(param.id);
      if (!recipeParam) return param;
      const constraints = param.constraints ?? recipeParam.constraints;
      const ui = param.ui ?? recipeParam.ui;
      return {
        ...param,
        targets: param.targets.length > 0 ? param.targets : recipeParam.targets,
        ...constraints ? { constraints } : {},
        ...ui ? { ui } : {}
      };
    }),
    ...recipeParams
  ];
  const trigger = input.request?.trigger ?? input.recipe.trigger;
  const files = input.sourceFiles ? applyMotionRecipeToFiles({
    recipe: input.recipe,
    request: input.request,
    sourceFiles: input.sourceFiles,
    trigger,
    targetSelector: input.targetSelector
  }) : void 0;
  const bindingTargetLayerIds = input.targetLayerIds && input.targetLayerIds.length > 0 ? input.targetLayerIds : input.recipe.targets.map((target) => target.id);
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
      ...input.confidence === void 0 ? {} : { confidence: input.confidence }
    },
    params,
    layers,
    ...files ? { files } : {}
  };
}
function validateRecipeApplication(input) {
  const paramIds = new Set(input.params.map((param) => param.id));
  const layerIds = new Set(input.layers.map((layer) => layer.id));
  const issues = [];
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
function sourceText$1(component) {
  return component.source.files.map((file) => file.content).join("\n");
}
function recipeById(id) {
  const recipe = builtinMotionRecipes.find((item) => item.id === id);
  if (!recipe) throw new Error(`Unknown motion recipe: ${id}`);
  return recipe;
}
function extractedBuiltinRecipe(id) {
  const recipe = recipeById(id);
  return {
    ...recipe,
    timeline: { ...recipe.timeline, keyframes: [...recipe.timeline.keyframes] },
    targets: recipe.targets.map((target) => ({ ...target, acceptedKinds: [...target.acceptedKinds] })),
    params: recipe.params.map((param) => ({ ...param, ...param.target ? { target: { ...param.target } } : {} })),
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
function keyframeNames(css) {
  return [...css.matchAll(/@keyframes\s+([a-z0-9_-]+)/gi)].flatMap((match) => match[1] ? [match[1]] : []);
}
function cssVariables(css) {
  return [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].flatMap((match) => match[1] ? [match[1]] : []);
}
function sourceHasReplay(text) {
  return /window\.motionReplay|motionReplay\s*=/.test(text);
}
function cssVariableValueMap(css) {
  return new Map(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].flatMap(
      (match) => match[1] && match[2] ? [[match[1], match[2].trim()]] : []
    )
  );
}
function paramCssVariableName(param) {
  return param.target?.kind === "css-variable" ? param.target.name : null;
}
function numberFromCssValue(value, kind) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^-?\d+(?:\.\d+)?/);
  if (!match?.[0]) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  if ((kind === "duration" || kind === "delay" || kind === "stagger") && /^-?\d+(?:\.\d+)?s$/i.test(trimmed)) {
    return parsed * 1e3;
  }
  return parsed;
}
function recipeDefaultFromValue(value, kind) {
  if (kind === "easing" || kind === "direction" || kind === "transformOrigin") {
    return typeof value === "string" && value.trim() ? value.trim() : void 0;
  }
  if (kind === "loop") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (/^(true|1|infinite)$/i.test(value.trim())) return true;
      if (/^(false|0|none)$/i.test(value.trim())) return false;
    }
    return void 0;
  }
  return numberFromCssValue(value, kind) ?? void 0;
}
function manifestParamDefault(component, recipeParam) {
  const variableName = paramCssVariableName(recipeParam);
  const matched = component.manifest.params.find((param) => {
    if (param.id === recipeParam.id) return true;
    return variableName !== null && param.targets.some((target) => target.kind === "css-variable" && target.name === variableName);
  });
  if (!matched) return void 0;
  return recipeDefaultFromValue(matched.value ?? matched.default, recipeParam.kind);
}
function cssParamDefault(cssValues, recipeParam) {
  const variableName = paramCssVariableName(recipeParam);
  if (!variableName) return void 0;
  const value = cssValues.get(variableName);
  return value === void 0 ? void 0 : recipeDefaultFromValue(value, recipeParam.kind);
}
function withExtractedParamDefaults(recipe, component, css) {
  const cssValues = cssVariableValueMap(css);
  return {
    ...recipe,
    params: recipe.params.map((param) => {
      const defaultValue = manifestParamDefault(component, param) ?? cssParamDefault(cssValues, param);
      return defaultValue === void 0 ? param : { ...param, default: defaultValue };
    })
  };
}
function firstLayerSelector(layer) {
  for (const target of layer.targets) {
    if ("selector" in target && typeof target.selector === "string" && target.selector.trim()) {
      return target.selector;
    }
  }
  return null;
}
function sourceSelectorForTarget(component, target) {
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
function sourceBindingSelectors(component) {
  const html = component.source.files.filter((file) => file.kind === "html").map((file) => file.content).join("\n");
  return [
    ...selectorExists(html, ".mine-content") ? [".mine-content"] : [],
    ...selectorExists(html, ".orders-content") ? [".orders-content"] : [],
    ...selectorExists(html, ".screen-wash") ? [".screen-wash"] : []
  ];
}
function mergeSelectors(selectors) {
  return [...new Set(selectors.flatMap((selector) => selector.split(",").map((item) => item.trim())).filter(Boolean))];
}
function withExtractedSelectors(recipe, component) {
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
function extractedRecipeWithEvidence(component, recipeId) {
  const css = component.source.files.filter((file) => file.kind === "css").map((file) => file.content).join("\n");
  return withExtractedSelectors(withExtractedParamDefaults(extractedBuiltinRecipe(recipeId), component, css), component);
}
function extractMotionRecipeFromComponent(component) {
  const text = sourceText$1(component);
  const identityText = [component.id, component.name, ...component.tags, ...component.useCases].join(" ");
  if (/(jd-front-back-entry-transition|前后进场|页面转场|page-transition)/i.test(identityText) || /mine-exit/.test(text) && /orders-enter/.test(text) && /transition-wash/.test(text)) {
    const issues2 = [];
    if (!sourceHasReplay(text)) issues2.push("参考组件缺少 replay 协议");
    if (!/data-motion=["']frontPage["']/.test(text)) issues2.push("参考组件未显式标注前页图层");
    if (!/data-motion=["']backPage["']/.test(text)) issues2.push("参考组件未显式标注后页图层");
    return {
      recipe: extractedRecipeWithEvidence(component, "page-front-back-transition"),
      confidence: issues2.length === 0 ? 0.94 : 0.82,
      issues: issues2
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
  const issues = [];
  if (!sourceHasReplay(text)) issues.push("参考组件缺少 replay 协议");
  if (cssVariables(css).length === 0) issues.push("参考组件缺少 CSS 变量参数");
  if ((component.manifest.layers ?? []).some((layer) => !layer.replaceable)) issues.push("参考组件存在不可替换图层");
  return {
    recipe: extractedRecipeWithEvidence(component, recipeId),
    confidence: Math.max(0.45, 0.78 - issues.length * 0.12),
    issues
  };
}
function createMotionRecipeCache(components) {
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
function findCachedMotionRecipe(input) {
  const raw = input.raw.toLowerCase();
  return input.cache.find((entry) => input.recipeId && entry.recipe.id === input.recipeId && entry.hints.some((hint) => raw.includes(hint.toLowerCase()))) ?? input.cache.find((entry) => entry.hints.some((hint) => raw.includes(hint.toLowerCase()))) ?? null;
}
function applyMotionRecipeToComponent(input) {
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
    .../* @__PURE__ */ new Set([...input.targetComponent.manifest.capabilities ?? [], "editable", "export-html"])
  ];
  return {
    ...input.targetComponent,
    id,
    name: input.name ?? `${input.targetComponent.name} + ${extracted.recipe.name}`,
    tags: [.../* @__PURE__ */ new Set([...input.targetComponent.tags, "recipe-applied", `recipe:${extracted.recipe.id}`])],
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
const HEADER_ALIASES = {
  element: ["元素"],
  motionPreview: ["动态示意"],
  variant: ["梯度"],
  variantPreview: ["示意"],
  targetLayer: ["作用图层", "目标图层"],
  token: ["Token", "token"],
  value: ["Value", "值", "时长"],
  delay: ["Delay", "延迟"],
  animationType: ["动画类型"],
  propertyChange: ["关键属性变化"],
  cssValue: ["CSS Value", "CSSValue", "曲线"]
};
const SLUG_ALIASES = {
  弹窗反馈: "popup-feedback",
  弹窗关闭: "popup-close",
  容器变换: "container-transform",
  前后进场: "front-back-entry",
  横向切换: "horizontal-switch",
  容器加载: "container-loading",
  大型尺寸: "large",
  中型尺寸: "medium",
  小型尺寸: "small",
  商卡: "product-card",
  半弹层: "half-sheet",
  all: "all"
};
function cell(row, aliases) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== void 0 && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}
function normalizeDesignerMotionRows(rows) {
  const last = {};
  return rows.map((row, index) => {
    const explicitElement = cell(row, HEADER_ALIASES.element);
    const startsNewElement = Boolean(explicitElement && explicitElement !== last.element);
    const next = {
      element: explicitElement || last.element || "",
      motionPreview: cell(row, HEADER_ALIASES.motionPreview) || (startsNewElement ? void 0 : last.motionPreview),
      variant: cell(row, HEADER_ALIASES.variant) || (startsNewElement ? "" : last.variant || ""),
      variantPreview: cell(row, HEADER_ALIASES.variantPreview) || (startsNewElement ? void 0 : last.variantPreview),
      targetLayer: cell(row, HEADER_ALIASES.targetLayer) || (startsNewElement ? "前景层" : last.targetLayer || "前景层"),
      token: cell(row, HEADER_ALIASES.token) || last.token || "",
      value: cell(row, HEADER_ALIASES.value),
      delay: cell(row, HEADER_ALIASES.delay),
      animationType: cell(row, HEADER_ALIASES.animationType),
      propertyChange: cell(row, HEADER_ALIASES.propertyChange),
      cssValue: cell(row, HEADER_ALIASES.cssValue),
      rowNumber: index + 2
    };
    last.element = next.element;
    last.motionPreview = next.motionPreview;
    last.variant = next.variant;
    last.variantPreview = next.variantPreview;
    last.targetLayer = next.targetLayer;
    last.token = next.token;
    return next;
  });
}
function parseMilliseconds(value) {
  const normalized = value.trim();
  const match = normalized.match(/^-?\d+(?:\.\d+)?/);
  if (!match?.[0]) throw new Error(`Invalid time value: ${value}`);
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid time value: ${value}`);
  return /s$/i.test(normalized) && !/ms$/i.test(normalized) ? Math.round(parsed * 1e3) : Math.round(parsed);
}
function parseCssEasing(value) {
  const trimmed = value.trim();
  if (/^cubic-bezier\(/i.test(trimmed)) return trimmed.replace(/\s+/g, " ");
  const tuple = trimmed.match(
    /^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/
  );
  if (tuple) {
    const values = tuple.slice(1).map((item) => String(Number(item)));
    return `cubic-bezier(${values.join(", ")})`;
  }
  if (/ease\s*out/i.test(trimmed)) return "ease-out";
  if (/ease\s*in/i.test(trimmed)) return "ease-in";
  return trimmed;
}
function propertyFromAnimationType(value) {
  if (/透明度|opacity/i.test(value)) return "opacity";
  if (/对角缩放|尺寸|size|宽|高/i.test(value)) return "size";
  if (/缩放|scale/i.test(value)) return "scale";
  if (/位移|position|translate/i.test(value)) return "position";
  if (/圆度|圆角|roundness|radius/i.test(value)) return "roundness";
  throw new Error(`Unsupported animation type: ${value}`);
}
function normalizePercentNumber(raw, property) {
  const hasPercent = raw.includes("%");
  const parsed = Number(raw.replace("%", ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid keyframe value: ${raw}`);
  if ((property === "scale" || property === "opacity") && (hasPercent || Math.abs(parsed) > 1)) {
    return parsed / 100;
  }
  return parsed;
}
function keyframeBody(value) {
  const normalized = value.replaceAll("：", ":").replaceAll("→", "->");
  const separator = normalized.indexOf(":");
  return (separator >= 0 ? normalized.slice(separator + 1) : normalized).trim();
}
function parseNumberSequence(value, property) {
  return value.split("->").map((item) => item.trim()).filter(Boolean).map((item) => {
    const match = item.match(/-?\d+(?:\.\d+)?%?/);
    if (!match?.[0]) throw new Error(`Invalid keyframe value: ${item}`);
    return normalizePercentNumber(match[0], property);
  });
}
function parseSizeKeyframes(body) {
  const lanes = body.split("|").map((item) => item.trim()).filter(Boolean);
  if (lanes.length !== 2) throw new Error(`Invalid size keyframes: ${body}`);
  const widths = parseNumberSequence(lanes[0], "size");
  const heights = parseNumberSequence(lanes[1], "size");
  if (widths.length !== heights.length || widths.length < 2) throw new Error(`Invalid size keyframes: ${body}`);
  return widths.map((width, index) => ({ width, height: heights[index] }));
}
function parsePositionKeyframes(body) {
  const lanes = body.split("|").map((item) => item.trim()).filter(Boolean);
  if (lanes.length !== 2) throw new Error(`Invalid position keyframes: ${body}`);
  const xLane = lanes.find((item) => /^x\b/i.test(item)) ?? lanes[0];
  const yLane = lanes.find((item) => /^y\b/i.test(item)) ?? lanes[1];
  const xs = parseNumberSequence(xLane, "position");
  const ys = parseNumberSequence(yLane, "position");
  if (xs.length !== ys.length || xs.length < 2) throw new Error(`Invalid position keyframes: ${body}`);
  return xs.map((x, index) => ({ x, y: ys[index] }));
}
function parseKeyframes(value, property) {
  const body = keyframeBody(value);
  if (property === "size" && body.includes("|")) return parseSizeKeyframes(body);
  if (property === "position" && body.includes("|")) return parsePositionKeyframes(body);
  const values = parseNumberSequence(body, property);
  if (values.length < 2) throw new Error(`Invalid keyframes: ${value}`);
  return values;
}
function slugMotionId(value) {
  const trimmed = value.trim();
  if (SLUG_ALIASES[trimmed]) return SLUG_ALIASES[trimmed];
  return trimmed.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
}
function unique$1(values) {
  return [...new Set(values)];
}
function targetRoleForElement(element) {
  if (/弹窗|弹层|modal|popup/i.test(element)) return "modal";
  if (/卡片|card/i.test(element)) return "card";
  if (/前后|横向|页面|screen|page/i.test(element)) return "screen";
  if (/容器|container/i.test(element)) return "container";
  return "unknown";
}
function isCompleteTokenRow(row) {
  return Boolean(
    row.element && row.variant && row.value && row.delay && row.animationType && row.propertyChange && row.cssValue
  );
}
const REQUIRED_TOKEN_FIELDS = [
  { key: "value", label: "Value" },
  { key: "delay", label: "Delay" },
  { key: "animationType", label: "动画类型" },
  { key: "propertyChange", label: "关键属性变化" },
  { key: "cssValue", label: "CSS Value" }
];
function incompleteReason(rows) {
  const missing = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const field of REQUIRED_TOKEN_FIELDS) {
      if (!row[field.key]) missing.add(field.label);
    }
  }
  if (missing.size === 0) return "缺少完整 token 行";
  return `缺少完整 token 行：${[...missing].join(" / ")}`;
}
function tokenFromRow(row) {
  const family = slugMotionId(row.element);
  const variant = slugMotionId(row.variant);
  const property = propertyFromAnimationType(row.animationType);
  return {
    id: `${family}.${variant}.${property}`,
    family,
    sourceElement: row.element,
    variant,
    sourceVariant: row.variant,
    targetRole: targetRoleForElement(row.element),
    targetLayer: row.targetLayer || "前景层",
    token: row.token,
    property,
    durationMs: parseMilliseconds(row.value),
    delayMs: parseMilliseconds(row.delay),
    easing: parseCssEasing(row.cssValue),
    keyframes: parseKeyframes(row.propertyChange, property),
    metadata: {
      animationType: row.animationType,
      sourceChange: row.propertyChange,
      sourceValue: row.value,
      sourceDelay: row.delay,
      sourceCssValue: row.cssValue
    }
  };
}
function fingerprint(token) {
  return JSON.stringify({
    property: token.property,
    durationMs: token.durationMs,
    delayMs: token.delayMs,
    easing: token.easing,
    keyframes: token.keyframes
  });
}
function bumpMinor(version) {
  const [majorRaw = "1", minorRaw = "0"] = version.split(".");
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  return `${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor + 1 : 1}.0`;
}
function compileFamily(element, rows) {
  const family = slugMotionId(element);
  const completeRows = rows.filter(isCompleteTokenRow);
  const tokensById = /* @__PURE__ */ new Map();
  for (const row of completeRows) {
    const token = tokenFromRow(row);
    tokensById.set(token.id, token);
  }
  const tokens = [...tokensById.values()];
  const tokenIdsByVariant = /* @__PURE__ */ new Map();
  for (const token of tokens) {
    tokenIdsByVariant.set(token.variant, [...tokenIdsByVariant.get(token.variant) ?? [], token.id]);
  }
  const sourceVariantByVariant = new Map(tokens.map((token) => [token.variant, token.sourceVariant]));
  const targetRoleByVariant = new Map(tokens.map((token) => [token.variant, token.targetRole]));
  const targetLayerByVariant = new Map(tokens.map((token) => [token.variant, token.targetLayer]));
  const recipes = [...tokenIdsByVariant.entries()].map(([variant, tokenIds]) => ({
    id: `${family}.${variant}.enter`,
    name: `${element} / ${sourceVariantByVariant.get(variant) ?? variant}`,
    family,
    sourceElement: element,
    variant,
    sourceVariant: sourceVariantByVariant.get(variant) ?? variant,
    targetRole: targetRoleByVariant.get(variant) ?? "unknown",
    targetLayer: targetLayerByVariant.get(variant) ?? "前景层",
    trigger: "load",
    tokenIds
  }));
  return {
    element,
    family,
    tokens,
    recipes,
    incomplete: tokens.length === 0 || recipes.length === 0
  };
}
function hasTokenChanges(previous, nextTokens) {
  if (!previous) return true;
  const nextIds = new Set(nextTokens.map((token) => token.id));
  for (const token of nextTokens) {
    const previousToken = previous.tokens[token.id];
    if (!previousToken || previousToken.status !== "active" || previousToken.fingerprint !== fingerprint(token))
      return true;
  }
  for (const [tokenId, previousToken] of Object.entries(previous.tokens)) {
    if (previousToken.status === "active" && !nextIds.has(tokenId)) return true;
  }
  return false;
}
function nextLockTokens(previous, nextTokens) {
  const tokens = { ...previous?.tokens ?? {} };
  const nextIds = new Set(nextTokens.map((token) => token.id));
  for (const token of nextTokens) {
    tokens[token.id] = { fingerprint: fingerprint(token), status: "active" };
  }
  for (const [tokenId, previousToken] of Object.entries(previous?.tokens ?? {})) {
    if (previousToken.status === "active" && !nextIds.has(tokenId)) {
      tokens[tokenId] = { ...previousToken, status: "archived" };
    }
  }
  return tokens;
}
function compileMotionSkillsFromRows(input) {
  const normalized = normalizeDesignerMotionRows(input.rows).filter((row) => row.element);
  const rowsByElement = /* @__PURE__ */ new Map();
  const elementOrder = [];
  for (const row of normalized) {
    if (!rowsByElement.has(row.element)) {
      rowsByElement.set(row.element, []);
      elementOrder.push(row.element);
    }
    rowsByElement.get(row.element)?.push(row);
  }
  const previousLock = input.previousLock ?? { families: {} };
  const lock = { version: "1.0", families: { ...previousLock.families } };
  const elements = [];
  const packs = {};
  const reportLines = [];
  for (const element of elementOrder) {
    const compiled = compileFamily(element, rowsByElement.get(element) ?? []);
    const previousFamily = previousLock.families[compiled.family];
    if (compiled.incomplete) {
      const rows = rowsByElement.get(element) ?? [];
      elements.push({
        id: compiled.family,
        label: element,
        latestVersion: previousFamily?.latestVersion ?? "0.0.0",
        active: false,
        variants: unique$1(rows.map((row) => row.variant).filter(Boolean)),
        packPath: "",
        status: "incomplete",
        reason: incompleteReason(rows)
      });
      reportLines.push(`不完整元素: ${element}`);
      continue;
    }
    const changed = hasTokenChanges(previousFamily, compiled.tokens);
    const version = previousFamily ? changed ? bumpMinor(previousFamily.latestVersion) : previousFamily.latestVersion : "1.0.0";
    const variants = unique$1(compiled.recipes.map((recipe) => recipe.sourceVariant));
    lock.families[compiled.family] = {
      latestVersion: version,
      tokens: nextLockTokens(previousFamily, compiled.tokens)
    };
    elements.push({
      id: compiled.family,
      label: element,
      latestVersion: version,
      active: true,
      variants,
      packPath: `${compiled.family}/manifest.json`,
      status: "active"
    });
    packs[compiled.family] = {
      manifest: {
        id: compiled.family,
        name: element,
        version,
        source: "designer-csv",
        variants,
        defaultVariant: compiled.recipes[0]?.variant ?? variants[0] ?? "default",
        tokenFile: "tokens.json",
        recipeFile: "recipes.json",
        skillFile: "skill.md"
      },
      tokens: compiled.tokens,
      recipes: compiled.recipes
    };
    if (!previousFamily) reportLines.push(`新增元素: ${element}@${version}`);
    else if (changed) reportLines.push(`更新元素: ${element} ${previousFamily.latestVersion} -> ${version}`);
    else reportLines.push(`无变化: ${element}@${version}`);
  }
  return {
    registry: { version: "1.0", elements },
    lock,
    packs,
    report: reportLines.join("\n")
  };
}
const targetRoleSchema = z.enum(["modal", "card", "screen", "container", "unknown"]);
const atomicMotionTokenSchema = z.object({
  id: z.string().min(1),
  family: z.string().min(1),
  sourceElement: z.string().min(1),
  variant: z.string().min(1),
  sourceVariant: z.string().min(1),
  targetRole: targetRoleSchema,
  targetLayer: z.string().min(1),
  token: z.string(),
  property: z.enum(["scale", "opacity", "position", "roundness", "size"]),
  durationMs: z.number().int().nonnegative(),
  delayMs: z.number().int().nonnegative(),
  easing: z.string().min(1),
  keyframes: z.union([
    z.array(z.number()),
    z.array(
      z.object({
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional()
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
}).strict();
const motionSkillRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string().min(1),
  sourceElement: z.string().min(1),
  variant: z.string().min(1),
  sourceVariant: z.string().min(1),
  targetRole: targetRoleSchema,
  targetLayer: z.string().min(1),
  trigger: z.enum(["load", "hover", "click", "loop"]),
  tokenIds: z.array(z.string().min(1)).min(1)
}).strict();
const motionSkillElementSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  latestVersion: z.string().min(1),
  active: z.boolean(),
  variants: z.array(z.string().min(1)),
  packPath: z.string(),
  status: z.enum(["active", "incomplete"]).optional(),
  reason: z.string().optional()
}).strict();
const motionSkillManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  source: z.literal("designer-csv"),
  variants: z.array(z.string().min(1)),
  defaultVariant: z.string().min(1),
  tokenFile: z.string().min(1),
  recipeFile: z.string().min(1),
  skillFile: z.string().min(1)
}).strict();
const lockTokenSchema = z.object({
  fingerprint: z.string().min(1),
  status: z.enum(["active", "archived"])
}).strict();
const lockFamilySchema = z.object({
  latestVersion: z.string().min(1),
  tokens: z.record(lockTokenSchema)
}).strict();
const motionSkillRegistrySchema = z.object({
  version: z.literal("1.0"),
  elements: z.array(motionSkillElementSchema)
}).strict();
const motionSkillTokenFileSchema = z.object({ tokens: z.array(atomicMotionTokenSchema) }).strict();
const motionSkillRecipeFileSchema = z.object({ recipes: z.array(motionSkillRecipeSchema) }).strict();
const motionSkillPackSchema = z.object({
  manifest: motionSkillManifestSchema,
  tokens: z.array(atomicMotionTokenSchema),
  recipes: z.array(motionSkillRecipeSchema)
}).strict();
const motionSkillLockSchema = z.object({
  version: z.literal("1.0"),
  families: z.record(lockFamilySchema)
}).strict();
function rootTarget(name) {
  return { kind: "css-variable", file: "source/style.css", selector: ":root", name };
}
function upperFirst(value) {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : "";
}
function camelId(parts) {
  const words = parts.flatMap((part) => part.split(/[^a-z0-9]+/i).filter(Boolean));
  return words.map((word, index) => {
    const lower = word.toLowerCase();
    return index === 0 ? lower : upperFirst(lower);
  }).join("");
}
function cssVarName$1(token, suffix) {
  return `--${token.family}-${token.variant}-${token.property}-${suffix}`;
}
function motionSkillParamId(token, suffix) {
  return camelId([token.family, token.variant, token.property, suffix]);
}
function keyframeParamDescriptors(token) {
  if (!Array.isArray(token.keyframes)) return [];
  if (token.keyframes.every((item) => typeof item === "number")) {
    return token.keyframes.map((value, index) => ({
      idSuffix: `keyframe${index}`,
      cssSuffix: `keyframe-${index}`,
      labelSuffix: `关键帧 ${index + 1}`,
      kind: token.property === "opacity" ? "opacity" : token.property === "scale" ? "scale" : "distance",
      default: value
    }));
  }
  return token.keyframes.flatMap((frame, index) => {
    const descriptors = [];
    if (typeof frame.width === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-width`,
        cssSuffix: `keyframe-${index}-width`,
        labelSuffix: `关键帧 ${index + 1}宽度`,
        kind: "distance",
        default: frame.width
      });
    }
    if (typeof frame.height === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-height`,
        cssSuffix: `keyframe-${index}-height`,
        labelSuffix: `关键帧 ${index + 1}高度`,
        kind: "distance",
        default: frame.height
      });
    }
    if (typeof frame.x === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-x`,
        cssSuffix: `keyframe-${index}-x`,
        labelSuffix: `关键帧 ${index + 1}X`,
        kind: "distance",
        default: frame.x
      });
    }
    if (typeof frame.y === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-y`,
        cssSuffix: `keyframe-${index}-y`,
        labelSuffix: `关键帧 ${index + 1}Y`,
        kind: "distance",
        default: frame.y
      });
    }
    return descriptors;
  });
}
function motionSkillKeyframeParamIds(token) {
  return keyframeParamDescriptors(token).map(
    (descriptor) => motionSkillParamId(token, descriptor.idSuffix)
  );
}
function categoryFor(recipe) {
  return /popup|弹窗/i.test(`${recipe.family} ${recipe.sourceElement}`) ? "feedback" : "entrance";
}
function tokenParams(token) {
  const baseLabel = `${token.sourceVariant} ${token.metadata.animationType}`;
  const params = [
    {
      id: motionSkillParamId(token, "duration"),
      label: `${baseLabel}时长`,
      kind: "duration",
      default: token.durationMs,
      target: rootTarget(cssVarName$1(token, "duration"))
    },
    {
      id: motionSkillParamId(token, "delay"),
      label: `${baseLabel}延迟`,
      kind: "delay",
      default: token.delayMs,
      target: rootTarget(cssVarName$1(token, "delay"))
    },
    {
      id: motionSkillParamId(token, "easing"),
      label: `${baseLabel}曲线`,
      kind: "easing",
      default: token.easing,
      target: rootTarget(cssVarName$1(token, "easing"))
    }
  ];
  params.push(
    ...keyframeParamDescriptors(token).map((descriptor) => ({
      id: motionSkillParamId(token, descriptor.idSuffix),
      label: `${baseLabel}${descriptor.labelSuffix}`,
      kind: descriptor.kind,
      default: descriptor.default,
      target: rootTarget(cssVarName$1(token, descriptor.cssSuffix))
    }))
  );
  return params;
}
function motionSkillRecipeToMotionRecipe(input) {
  const tokens = input.recipe.tokenIds.flatMap(
    (tokenId) => input.tokens.find((token) => token.id === tokenId) ?? []
  );
  const selector = "[data-motion=foregroundLayer]";
  const keyframes = tokens.map((token) => `${token.family}-${token.variant}-${token.property}`);
  const params = tokens.flatMap(tokenParams);
  return {
    id: input.recipe.id,
    name: `${input.manifest.name} / ${input.recipe.sourceVariant}`,
    category: categoryFor(input.recipe),
    trigger: input.recipe.trigger,
    timeline: {
      keyframes,
      durationParamId: tokens[0] ? motionSkillParamId(tokens[0], "duration") : "motionDuration",
      easingParamId: tokens[0] ? motionSkillParamId(tokens[0], "easing") : "motionEasing",
      loop: input.recipe.trigger === "loop"
    },
    targets: [
      {
        id: "foregroundLayer",
        role: "foreground",
        required: true,
        replaceable: true,
        selector,
        acceptedKinds: ["image", "structure"]
      }
    ],
    params,
    bindings: {
      cssVariables: params.flatMap(
        (param) => param.target?.kind === "css-variable" ? [param.target.name] : []
      ),
      keyframes,
      selectors: [selector],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "model"
  };
}
const EMPTY_IMAGE_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
const DEFAULT_STAGE_SIZE = {
  stageWidth: 430,
  stageHeight: 932,
  backgroundLayerWidth: 500,
  backgroundLayerHeight: 1060
};
const DEFAULT_FOREGROUND_LAYER_SIZE = {
  width: 280,
  height: 180
};
const POPUP_FEEDBACK_FOREGROUND_LAYER_SIZES = {
  large: { width: 380, height: 420 },
  medium: { width: 330, height: 300 },
  small: DEFAULT_FOREGROUND_LAYER_SIZE
};
function cssVariableTarget(name) {
  return { kind: "css-variable", file: "source/style.css", selector: ".motion-skill-stage", name };
}
function cssVarName(token, suffix) {
  return `--${token.family}-${token.variant}-${token.property}-${suffix}`;
}
function keyframeName(token) {
  return `${token.family}-${token.variant}-${token.property}`;
}
function percentage(index, length) {
  if (length <= 1) return 100;
  return Math.round(index / (length - 1) * 100);
}
function cssVarValue(token, suffix, fallback, unit = "") {
  return `var(${cssVarName(token, suffix)}, ${fallback}${unit})`;
}
function objectKeyframeBody(token, frame, index) {
  if (token.property === "size") {
    return [
      typeof frame.width === "number" ? `width: ${cssVarValue(token, `keyframe-${index}-width`, frame.width, "px")};` : "",
      typeof frame.height === "number" ? `height: ${cssVarValue(token, `keyframe-${index}-height`, frame.height, "px")};` : ""
    ].filter(Boolean).join(" ");
  }
  if (token.property === "position") {
    return [
      typeof frame.x === "number" ? `left: ${cssVarValue(token, `keyframe-${index}-x`, frame.x, "px")};` : "",
      typeof frame.y === "number" ? `top: ${cssVarValue(token, `keyframe-${index}-y`, frame.y, "px")};` : ""
    ].filter(Boolean).join(" ");
  }
  return "";
}
function tokenKeyframes(token) {
  if (!Array.isArray(token.keyframes)) return "";
  if (!token.keyframes.every((item) => typeof item === "number")) {
    const frames2 = token.keyframes.map((frame, index) => {
      const body = objectKeyframeBody(token, frame, index);
      return body ? `  ${percentage(index, token.keyframes.length)}% { ${body} }` : "";
    }).filter(Boolean).join("\n");
    return frames2 ? `@keyframes ${keyframeName(token)} {
${frames2}
}` : "";
  }
  const numericKeyframes = token.keyframes;
  const frames = numericKeyframes.map((_, index) => {
    const frameValue = numericKeyframes[index] ?? 0;
    const value = cssVarValue(token, `keyframe-${index}`, frameValue);
    const body = token.property === "opacity" ? `opacity: ${value};` : token.property === "scale" ? `transform: scale(${value});` : token.property === "roundness" ? `border-radius: ${cssVarValue(token, `keyframe-${index}`, frameValue, "px")};` : `left: ${cssVarValue(token, `keyframe-${index}`, frameValue, "px")};`;
    return `  ${percentage(index, numericKeyframes.length)}% { ${body} }`;
  }).join("\n");
  return `@keyframes ${keyframeName(token)} {
${frames}
}`;
}
function animationLine(token) {
  return `${keyframeName(token)} var(${cssVarName(token, "duration")}, ${token.durationMs}ms) var(${cssVarName(token, "easing")}, ${token.easing}) var(${cssVarName(token, "delay")}, ${token.delayMs}ms) both`;
}
function tokenCss(tokens) {
  return `${tokens.map(tokenKeyframes).filter(Boolean).join("\n\n")}

.is-playing [data-motion=foregroundLayer] {
  animation: ${tokens.map(animationLine).join(",\n    ")};
  will-change: transform, opacity, width, height, left, top, border-radius;
}`;
}
function targetBinding() {
  return {
    layerId: "foregroundLayer",
    label: "前景层",
    role: "foreground",
    selector: "[data-motion=foregroundLayer]"
  };
}
function foregroundLayerSize(recipe) {
  if (recipe.family === "popup-feedback") {
    return POPUP_FEEDBACK_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  return DEFAULT_FOREGROUND_LAYER_SIZE;
}
function tokenBinding(token) {
  return {
    id: token.id,
    token: token.token,
    animationType: token.metadata.animationType,
    targetLayer: token.targetLayer,
    value: token.metadata.sourceValue,
    delay: token.metadata.sourceDelay,
    propertyChange: token.metadata.sourceChange,
    cssValue: token.metadata.sourceCssValue,
    property: token.property,
    durationParamId: motionSkillParamId(token, "duration"),
    delayParamId: motionSkillParamId(token, "delay"),
    easingParamId: motionSkillParamId(token, "easing"),
    keyframeParamIds: motionSkillKeyframeParamIds(token)
  };
}
function assetParams() {
  return [
    {
      id: "backgroundImage",
      label: "背景层",
      type: "image",
      default: "",
      status: "confirmed",
      constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=backgroundImage]",
          attribute: "src"
        }
      ]
    },
    {
      id: "foregroundImage",
      label: "前景层",
      type: "image",
      default: "",
      status: "confirmed",
      constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=foregroundImage]",
          attribute: "src"
        }
      ]
    },
    {
      id: "stageWidth",
      label: "页面宽度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.stageWidth,
      status: "confirmed",
      constraints: { min: 320, max: 520, step: 1, unit: "px" },
      targets: [cssVariableTarget("--stage-width")]
    },
    {
      id: "stageHeight",
      label: "页面高度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.stageHeight,
      status: "confirmed",
      constraints: { min: 700, max: 1200, step: 1, unit: "px" },
      targets: [cssVariableTarget("--stage-height")]
    },
    {
      id: "backgroundLayerWidth",
      label: "背景层宽度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.backgroundLayerWidth,
      status: "confirmed",
      constraints: { min: 360, max: 640, step: 1, unit: "px" },
      targets: [cssVariableTarget("--background-layer-width")]
    },
    {
      id: "backgroundLayerHeight",
      label: "背景层高度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.backgroundLayerHeight,
      status: "confirmed",
      constraints: { min: 800, max: 1280, step: 1, unit: "px" },
      targets: [cssVariableTarget("--background-layer-height")]
    }
  ];
}
function assetLayers() {
  return [
    {
      id: "backgroundLayer",
      label: "背景层",
      kind: "image",
      replaceable: true,
      required: false,
      paramId: "backgroundImage",
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=backgroundImage]",
          attribute: "src"
        }
      ]
    },
    {
      id: "foregroundLayer",
      label: "前景层",
      kind: "image",
      replaceable: true,
      required: true,
      paramId: "foregroundImage",
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=foregroundImage]",
          attribute: "src"
        }
      ]
    }
  ];
}
function baseFiles(tokens, recipe) {
  const foregroundSize = foregroundLayerSize(recipe);
  return [
    {
      path: "source/index.html",
      kind: "html",
      content: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="motion-skill-stage" data-motion-root>
      <section class="motion-skill-background" data-motion="backgroundLayer">
        <img class="motion-skill-layer-image" data-motion="backgroundImage" src="${EMPTY_IMAGE_SRC}" alt="" />
      </section>
      <section class="motion-skill-foreground" data-motion="foregroundLayer">
        <img class="motion-skill-layer-image" data-motion="foregroundImage" src="${EMPTY_IMAGE_SRC}" alt="" />
      </section>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`
    },
    {
      path: "source/style.css",
      kind: "css",
      content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f8f5ff;
}

.motion-skill-stage {
  --stage-width: ${DEFAULT_STAGE_SIZE.stageWidth}px;
  --stage-height: ${DEFAULT_STAGE_SIZE.stageHeight}px;
  --background-layer-width: ${DEFAULT_STAGE_SIZE.backgroundLayerWidth}px;
  --background-layer-height: ${DEFAULT_STAGE_SIZE.backgroundLayerHeight}px;
  --foreground-layer-width: ${foregroundSize.width}px;
  --foreground-layer-height: ${foregroundSize.height}px;
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: 82vw;
  max-height: 82vh;
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(135deg, #ffffff 0%, #f2e7ff 100%);
  box-shadow: 0 24px 90px rgba(79, 70, 229, 0.18);
}

.motion-skill-background,
.motion-skill-foreground {
  position: absolute;
}

.motion-skill-background {
  left: calc((100% - var(--background-layer-width)) / 2);
  top: calc((100% - var(--background-layer-height)) / 2);
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  background: #3f3f46;
}

.motion-skill-foreground {
  width: min(var(--foreground-layer-width), 88%);
  height: var(--foreground-layer-height);
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  border-radius: 24px;
  background: #e5e7eb;
  box-shadow: 0 24px 80px rgba(126, 34, 206, 0.22);
}

.motion-skill-layer-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  object-position: center;
  pointer-events: none;
}

.motion-skill-foreground .motion-skill-layer-image {
  border-radius: inherit;
}

${tokenCss(tokens)}`
    },
    { path: "source/script.js", kind: "js", content: "" }
  ];
}
function createMotionSkillDraftComponent(input) {
  const recipe = input.pack.recipes.find((item) => item.id === input.recipeId);
  if (!recipe) throw new Error(`Unknown motion skill recipe: ${input.recipeId}`);
  const tokens = recipe.tokenIds.flatMap(
    (tokenId) => input.pack.tokens.find((token) => token.id === tokenId) ?? []
  );
  const motionRecipe = motionSkillRecipeToMotionRecipe({
    manifest: input.pack.manifest,
    recipe,
    tokens: input.pack.tokens
  });
  const applied = applyMotionRecipe({
    recipe: motionRecipe,
    params: assetParams(),
    layers: assetLayers(),
    sourceFiles: baseFiles(tokens, recipe),
    targetSelector: "[data-motion=foregroundLayer]",
    source: "model",
    confidence: 1
  });
  const id = `generated-${input.pack.manifest.id}-${recipe.variant}-${input.now ?? Date.now()}`;
  const registryElement = input.registry.elements.find((element) => element.id === input.pack.manifest.id);
  const target = targetBinding();
  return {
    id,
    name: `${recipe.sourceElement} / ${recipe.sourceVariant}`,
    category: "interaction",
    tags: ["generated", "atomic-motion", input.pack.manifest.id],
    useCases: ["atomic-motion"],
    moods: ["designer-motion"],
    source: {
      id,
      origin: "generated",
      kind: "builtin-component",
      entry: "source/index.html",
      files: applied.files ?? baseFiles(tokens, recipe)
    },
    manifest: {
      version: "1.0",
      id: `${id}-manifest`,
      name: `${recipe.sourceElement} / ${recipe.sourceVariant}`,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: applied.params,
      layers: applied.layers,
      motionRecipes: [applied.binding],
      designSpecs: [{ id: "interactive-control-motion-skill", confidence: 0.9, required: true }],
      capabilities: ["editable", "export-html"],
      motionSkill: {
        source: "designer-csv",
        element: registryElement?.label ?? recipe.sourceElement,
        variant: recipe.sourceVariant,
        family: input.pack.manifest.id,
        version: input.pack.manifest.version,
        recipeId: recipe.id,
        tokenIds: recipe.tokenIds,
        tokens: tokens.map(tokenBinding),
        target
      }
    }
  };
}
const DEFAULT_BUTTON_TEXT = "立即行动";
const DEFAULT_BUTTON_COLOR = {
  value: "#2563eb"
};
const DEFAULT_MOBILE_PAGE_SIZE = {
  stageWidth: 430,
  stageHeight: 932,
  backgroundLayerWidth: 500,
  backgroundLayerHeight: 1060
};
function unique(values) {
  return [...new Set(values)];
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function escapeHtml$1(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function cssDirectionVariables(direction) {
  if (direction === "right-to-left") {
    return {
      xStart: "var(--travel-distance)",
      xEnd: "calc(var(--travel-distance) * -1)",
      yStart: "0",
      yEnd: "0",
      label: "right-to-left"
    };
  }
  if (direction === "top-to-bottom") {
    return {
      xStart: "0",
      xEnd: "0",
      yStart: "calc(var(--travel-distance) * -1)",
      yEnd: "var(--travel-distance)",
      label: "top-to-bottom"
    };
  }
  if (direction === "bottom-to-top") {
    return {
      xStart: "0",
      xEnd: "0",
      yStart: "var(--travel-distance)",
      yEnd: "calc(var(--travel-distance) * -1)",
      label: "bottom-to-top"
    };
  }
  return {
    xStart: "calc(var(--travel-distance) * -1)",
    xEnd: "var(--travel-distance)",
    yStart: "0",
    yEnd: "0",
    label: "left-to-right"
  };
}
function durationForIntent(intent) {
  if (intent.speed === "fast") return 620;
  if (intent.speed === "slow") return 1200;
  return 900;
}
function easingForIntent(intent) {
  return intent.effects.includes("elastic") || intent.effects.includes("bounce") ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : "ease-out";
}
function motionKindForIntent(intent) {
  const hasBounce = intent.effects.includes("bounce") || intent.effects.includes("elastic");
  const hasSlide = intent.effects.includes("slide") || intent.direction !== null;
  if (hasSlide && hasBounce) return "slide-bounce";
  if (hasSlide) return "slide";
  if (hasBounce) return "bounce";
  if (intent.effects.includes("rotate")) return "rotate";
  if (intent.effects.includes("fade")) return "fade";
  if (intent.effects.includes("glow")) return "glow";
  if (intent.effects.includes("pulse")) return "pulse";
  if (intent.effects.includes("scale")) return "scale";
  return "scale";
}
function animationNameForIntent(input) {
  if (input.motionKind === "slide-bounce" && input.intent.trigger !== "click" && input.intent.trigger !== "hover") {
    return `generated-${input.directionLabel}-slide-bounce`;
  }
  return `generated-${input.intent.trigger}-${input.motionKind}`;
}
function keyframesForMotion(input) {
  if (input.motionKind === "slide-bounce") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0;
    transform: translate(var(--travel-x-start), var(--travel-y-start)) scale(0.96);
  }
  58% {
    opacity: 1;
    transform: translate(0, 0) scale(var(--bounce-scale));
  }
  76% {
    opacity: 1;
    transform: translate(calc(var(--travel-x-end) * 0.16), calc(var(--travel-y-end) * 0.16)) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translate(var(--travel-x-end), var(--travel-y-end)) scale(1);
  }
}`;
  }
  if (input.motionKind === "slide") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0;
    transform: translate(var(--travel-x-start), var(--travel-y-start)) scale(1);
  }
  100% {
    opacity: 1;
    transform: translate(var(--travel-x-end), var(--travel-y-end)) scale(1);
  }
}`;
  }
  if (input.motionKind === "rotate") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0.88;
    transform: scale(0.96) rotate(0deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(360deg);
  }
}`;
  }
  if (input.motionKind === "fade") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0;
    transform: scale(0.98);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}`;
  }
  if (input.motionKind === "glow") {
    return `@keyframes ${input.name} {
  0% {
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.16);
    transform: scale(1);
  }
  55% {
    box-shadow: 0 22px 54px color-mix(in srgb, var(--button-bg) 52%, transparent);
    transform: scale(1.04);
  }
  100% {
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
    transform: scale(1);
  }
}`;
  }
  if (input.motionKind === "scale") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0.92;
    transform: scale(0.86);
  }
  70% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}`;
  }
  if (input.motionKind === "pulse") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0.72;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 0.72;
    transform: scale(0.92);
  }
}`;
  }
  return `@keyframes ${input.name} {
  0% {
    opacity: 0.92;
    transform: scale(0.92);
  }
  55% {
    opacity: 1;
    transform: scale(var(--bounce-scale));
  }
  78% {
    opacity: 1;
    transform: scale(0.97);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}`;
}
function sourceFilesForButton(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const label = escapeHtml$1(intent.text ?? DEFAULT_BUTTON_TEXT);
  const direction = cssDirectionVariables(intent.direction);
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const glow = intent.effects.includes("glow");
  const motionKind = motionKindForIntent(intent);
  const animationName = animationNameForIntent({ intent, directionLabel: direction.label, motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind });
  const hasTravel = motionKind === "slide" || motionKind === "slide-bounce";
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const playSelector = intent.trigger === "hover" ? ".semantic-button:hover" : ".semantic-stage.is-playing .semantic-button";
  const baseTransform = hasTravel ? "translate(var(--travel-x-start), var(--travel-y-start)) scale(1)" : "scale(1) rotate(0deg)";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成按钮</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成按钮">
      <button class="semantic-button" data-motion="buttonLabel" type="button">${label}</button>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --button-bg: ${color.value};
  --button-text: #ffffff;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --travel-distance: 42vw;
  --bounce-scale: 1.14;
  --travel-x-start: ${direction.xStart};
  --travel-x-end: ${direction.xEnd};
  --travel-y-start: ${direction.yStart};
  --travel-y-end: ${direction.yEnd};
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  --stage-width: 390px;
  --stage-height: 220px;
  display: grid;
  place-items: center;
  width: var(--stage-width);
  height: var(--stage-height);
}

.semantic-button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  min-width: 132px;
  padding: 16px 24px;
  box-shadow: ${glow ? "0 18px 48px color-mix(in srgb, var(--button-bg) 42%, transparent)" : "0 14px 28px rgba(15, 23, 42, 0.18)"};
  transform: ${baseTransform};
  transform-origin: center;
  will-change: transform, opacity, box-shadow;
}

${playSelector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

.semantic-button:hover {
  filter: brightness(1.04);
}

${keyframes}`;
  const js = `(() => {
  const root = document.querySelector("[data-motion-root]");
  const button = document.querySelector("[data-motion=buttonLabel]");

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

  ${intent.trigger === "click" ? 'if (button instanceof HTMLElement) button.addEventListener("click", replay);' : ""}
  ${intent.trigger === "load" || intent.trigger === "loop" ? "requestAnimationFrame(replay);" : ""}
})();`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: js }
  ];
}
function cardDescriptionForIntent(intent) {
  const match = intent.raw.match(/(?:描述|说明|内容|副标题|description)\s*(?:是|为|:|：)?\s*([^，。；;\n]{1,80})/i);
  return match?.[1]?.trim().replace(/^["'「『“]+|["'」』”]+$/g, "") || "用清晰的层次呈现关键信息";
}
function replayScript(input) {
  const shouldAutoReplay = input.autoReplay ?? (input.trigger === "load" || input.trigger === "loop");
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const target = document.querySelector("${input.targetSelector}");

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

  ${input.trigger === "click" ? 'if (target instanceof HTMLElement) target.addEventListener("click", replay);' : ""}
  ${shouldAutoReplay ? "requestAnimationFrame(replay);" : ""}
})();`;
}
function sourceFilesForText(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const label = escapeHtml$1(intent.text ?? "精彩标题");
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const motionKind = motionKindForIntent(intent);
  const animationName = animationNameForIntent({ intent, directionLabel: "text", motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow: intent.effects.includes("glow") });
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const selector = intent.trigger === "hover" ? ".semantic-text:hover" : ".semantic-stage.is-playing .semantic-text";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成标题</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成标题">
      <h1 class="semantic-text" data-motion="textContent">${label}</h1>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --text-color: ${color.value};
  --font-size: 42px;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --travel-distance: 24px;
  --bounce-scale: 1.08;
  --travel-x-start: 0;
  --travel-x-end: 0;
  --travel-y-start: 24px;
  --travel-y-end: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 320px;
  min-height: 180px;
}

.semantic-text {
  margin: 0;
  color: var(--text-color);
  font-size: var(--font-size);
  font-weight: 800;
  line-height: 1.1;
  transform: scale(1);
  will-change: transform, opacity, box-shadow;
}

${selector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

${keyframes}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=textContent]", trigger: intent.trigger }) }
  ];
}
function sourceFilesForCard(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const title = escapeHtml$1(intent.text ?? "信息卡片");
  const description = escapeHtml$1(cardDescriptionForIntent(intent));
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const motionKind = motionKindForIntent(intent);
  const animationName = animationNameForIntent({ intent, directionLabel: "card", motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow: intent.effects.includes("glow") });
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const selector = intent.trigger === "hover" ? ".semantic-card:hover" : ".semantic-stage.is-playing .semantic-card";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成卡片</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成卡片">
      <article class="semantic-card" data-motion="cardRoot">
        <h2 data-motion="cardTitle">${title}</h2>
        <p data-motion="cardDescription">${description}</p>
      </article>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --card-bg: ${color.value};
  --card-text: #ffffff;
  --card-radius: 18px;
  --card-shadow: 28px;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --travel-distance: 28px;
  --bounce-scale: 1.06;
  --travel-x-start: 0;
  --travel-x-end: 0;
  --travel-y-start: 26px;
  --travel-y-end: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 360px;
  min-height: 240px;
}

.semantic-card {
  width: min(320px, 86vw);
  border-radius: var(--card-radius);
  background: var(--card-bg);
  color: var(--card-text);
  padding: 28px;
  box-shadow: 0 var(--card-shadow) 60px color-mix(in srgb, var(--card-bg) 28%, transparent);
  transform: scale(1);
  will-change: transform, opacity, box-shadow;
}

.semantic-card h2 {
  margin: 0 0 10px;
  font-size: 24px;
}

.semantic-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
}

${selector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

${keyframes}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=cardRoot]", trigger: intent.trigger }) }
  ];
}
function sourceFilesForBadge(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const label = escapeHtml$1(intent.text ?? "标签");
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const pulseIntent = intent.effects.length > 0 ? intent : { ...intent, effects: ["pulse"] };
  const motionKind = motionKindForIntent(pulseIntent);
  const animationName = animationNameForIntent({ intent, directionLabel: "badge", motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow: intent.effects.includes("glow") });
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const selector = intent.trigger === "hover" ? ".semantic-badge:hover" : ".semantic-stage.is-playing .semantic-badge";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成标签</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成标签">
      <span class="semantic-badge" data-motion="badgeText">${label}</span>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --badge-bg: ${color.value};
  --badge-text: #ffffff;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --bounce-scale: 1.12;
  --travel-x-start: 0;
  --travel-x-end: 0;
  --travel-y-start: 0;
  --travel-y-end: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 260px;
  min-height: 160px;
}

.semantic-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--badge-bg);
  color: var(--badge-text);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0;
  min-width: 64px;
  padding: 10px 18px;
  box-shadow: 0 14px 34px color-mix(in srgb, var(--badge-bg) 34%, transparent);
  transform: scale(1);
  will-change: transform, opacity, box-shadow;
}

${selector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

${keyframes}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=badgeText]", trigger: intent.trigger }) }
  ];
}
function sourceFilesForLoader(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const duration = durationForIntent({ ...intent, speed: intent.speed === "normal" ? "fast" : intent.speed });
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成加载动画</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-stage is-playing" data-motion-root aria-label="语义生成加载动画">
      <div class="semantic-loader semantic-loader-dots" data-motion="loaderRoot" role="status" aria-label="加载中">
        <span class="semantic-loader-dot"></span>
        <span class="semantic-loader-dot"></span>
        <span class="semantic-loader-dot"></span>
      </div>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --loader-color: ${color.value};
  --loader-size: 16px;
  --motion-duration: ${duration}ms;
  --motion-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 240px;
  min-height: 160px;
}

.semantic-loader {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--loader-size) * 0.55);
}

.semantic-loader-dot {
  width: var(--loader-size);
  height: var(--loader-size);
  border-radius: 999px;
  background: var(--loader-color);
  animation: generated-loop-dots var(--motion-duration) var(--motion-easing) infinite;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--loader-color) 34%, transparent);
}

.semantic-loader-dot:nth-child(2) {
  animation-delay: calc(var(--motion-duration) * 0.16);
}

.semantic-loader-dot:nth-child(3) {
  animation-delay: calc(var(--motion-duration) * 0.32);
}

@keyframes generated-loop-dots {
  0%,
  80%,
  100% {
    opacity: 0.5;
    transform: translateY(0) scale(0.86);
  }
  40% {
    opacity: 1;
    transform: translateY(-14px) scale(1.08);
  }
}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=loaderRoot]", trigger: "loop" }) }
  ];
}
function sourceFilesForMobilePage(intent) {
  const color = intent.colors[0] ?? {
    value: "#8b5cf6"
  };
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const animationName = "generated-load-foreground-scale";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成移动端页面</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-mobile-page is-playing" data-motion-root aria-label="语义生成移动端页面">
      <section class="mobile-screen" data-motion="mobileScreen">
        <div class="background-layer" data-motion="backgroundLayer"></div>
        <div class="foreground-layer" data-motion="foregroundLayer">
          <span class="foreground-title"></span>
          <span class="foreground-line is-wide"></span>
          <span class="foreground-line"></span>
        </div>
      </section>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --stage-width: ${DEFAULT_MOBILE_PAGE_SIZE.stageWidth}px;
  --stage-height: ${DEFAULT_MOBILE_PAGE_SIZE.stageHeight}px;
  --background-layer-width: ${DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerWidth}px;
  --background-layer-height: ${DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerHeight}px;
  --page-bg: #f8fafc;
  --foreground-bg: ${color.value};
  --foreground-scale-start: 0.72;
  --foreground-scale-end: 1;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-mobile-page {
  display: grid;
  place-items: center;
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: 92vw;
  max-height: 92vh;
}

.mobile-screen {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 42px;
  background: var(--page-bg);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
  isolation: isolate;
}

.background-layer,
.foreground-layer {
  position: absolute;
}

.background-layer {
  left: calc((100% - var(--background-layer-width)) / 2);
  top: calc((100% - var(--background-layer-height)) / 2);
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  background:
    radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--foreground-bg) 20%, transparent), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #eef2ff 100%);
}

.foreground-layer {
  right: 28px;
  bottom: 92px;
  left: 28px;
  display: grid;
  gap: 14px;
  min-height: 220px;
  border-radius: 32px;
  background: var(--foreground-bg);
  padding: 28px;
  box-shadow: 0 28px 70px color-mix(in srgb, var(--foreground-bg) 30%, transparent);
  opacity: 0;
  transform: scale(var(--foreground-scale-start));
  transform-origin: 50% 72%;
  will-change: opacity, transform;
}

.foreground-title,
.foreground-line {
  display: block;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
}

.foreground-title {
  width: 52%;
  height: 28px;
}

.foreground-line {
  width: 58%;
  height: 14px;
}

.foreground-line.is-wide {
  width: 82%;
}

.is-playing .foreground-layer {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both;
}

@keyframes ${animationName} {
  0% {
    opacity: 0;
    transform: scale(var(--foreground-scale-start)) translateY(28px);
  }
  68% {
    opacity: 1;
    transform: scale(1.04) translateY(0);
  }
  100% {
    opacity: 1;
    transform: scale(var(--foreground-scale-end)) translateY(0);
  }
}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    {
      path: "source/script.js",
      kind: "js",
      content: replayScript({ targetSelector: "[data-motion=foregroundLayer]", trigger: intent.trigger })
    }
  ];
}
function explicitNumberAfter(raw, label) {
  const match = raw.match(label);
  const value = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(value) ? value : null;
}
function pageTransitionValues(intent) {
  const raw = intent.raw;
  const explicitDuration = explicitNumberAfter(raw, /(?:循环时长|时长|duration)[^\d]{0,12}(\d{3,5})\s*ms/i);
  const explicitEnterDistance = explicitNumberAfter(raw, /(?:进入距离|enterDistance|enter distance)[^\d]{0,12}(\d{2,4})\s*px/i);
  const explicitOpacity = explicitNumberAfter(raw, /(?:泛白|过渡泛白|transitionOpacity|opacity)[^\d]{0,12}(0?\.\d+)/i);
  const explicitRadius = explicitNumberAfter(raw, /(?:圆角|windowRadius|radius)[^\d]{0,12}(\d{1,3})\s*px?/i);
  const wantsShorterTravel = /(距离.*短|短一点|更短|轨迹.*短|滑动.*短)/i.test(raw);
  const wantsLongerTravel = /(距离.*长|长一点|更长|轨迹.*长|滑动.*长)/i.test(raw);
  const wantsWeakerWash = /(泛白.*弱|泛白.*轻|过渡.*轻|更轻|降低.*泛白|泛白降低|弱一点)/i.test(raw);
  const wantsStrongerWash = /(泛白.*强|更强.*泛白|过渡.*明显)/i.test(raw);
  const wantsSmallerRadius = /(圆角.*小|更小.*圆角|圆角小|方一点|更方)/i.test(raw);
  const wantsLargerRadius = /(圆角.*大|更圆|圆润)/i.test(raw);
  const avoidsOvershoot = /(无过冲|不要.*过冲|别.*过冲|不需要.*过冲|干脆)/i.test(raw);
  const enterDistance = clamp(
    explicitEnterDistance ?? (wantsShorterTravel ? 360 : wantsLongerTravel ? 680 : 520),
    0,
    1118
  );
  const cycleDuration = clamp(
    explicitDuration ?? (intent.speed === "fast" ? 1840 : intent.speed === "slow" ? 3600 : 2640),
    1400,
    5e3
  );
  const transitionOpacity = clamp(
    explicitOpacity ?? (wantsWeakerWash ? 0.35 : wantsStrongerWash ? 0.82 : 0.72),
    0,
    0.9
  );
  const windowRadius = clamp(
    explicitRadius ?? (wantsSmallerRadius ? 48 : wantsLargerRadius ? 120 : 92),
    0,
    160
  );
  return {
    cycleDuration,
    enterDistance,
    exitDistance: -enterDistance,
    transitionOpacity,
    windowRadius,
    easing: avoidsOvershoot ? "cubic-bezier(0.2, 0.82, 0.2, 1)" : "cubic-bezier(0.18, 0.86, 0.22, 1)"
  };
}
function sourceFilesForPageTransition(intent) {
  const values = pageTransitionValues(intent);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>语义生成页面转场</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-page-transition is-playing" data-motion-root aria-label="语义生成页面转场">
      <section class="screen-window" data-motion="screenWindow">
        <div class="screen-layer mine-content" data-motion="frontPage"></div>
        <div class="screen-layer orders-content" data-motion="backPage"></div>
        <div class="screen-wash" data-motion="transitionWash"></div>
      </section>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --cycle-duration: ${values.cycleDuration}ms;
  --enter-distance: ${values.enterDistance}px;
  --exit-distance: ${values.exitDistance}px;
  --transition-opacity: ${values.transitionOpacity};
  --window-radius: ${values.windowRadius}px;
  --motion-easing: ${values.easing};
  --page-background: #fff8f9;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--page-background);
}

.semantic-page-transition {
  width: min(390px, 92vw);
  aspect-ratio: 390 / 844;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fafc 0%, #fff1f2 100%);
}

.screen-window,
.screen-layer,
.screen-wash {
  position: absolute;
}

.screen-window {
  inset: 34px 18px;
  overflow: hidden;
  border-radius: var(--window-radius);
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
  isolation: isolate;
}

.screen-layer,
.screen-wash {
  inset: 0;
}

.screen-layer {
  will-change: opacity, transform;
}

.mine-content {
  background:
    linear-gradient(180deg, rgba(239, 68, 68, 0.14), transparent 34%),
    repeating-linear-gradient(180deg, #ffffff 0 82px, #f8fafc 82px 98px);
}

.orders-content {
  opacity: 0;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.14), transparent 36%),
    repeating-linear-gradient(180deg, #ffffff 0 76px, #eef2ff 76px 94px);
  transform: translate3d(var(--enter-distance), 0, 0);
}

.screen-wash {
  opacity: 0;
  background: #f7f9fc;
  pointer-events: none;
  will-change: opacity;
}

.is-playing .mine-content {
  animation: mine-exit var(--cycle-duration) var(--motion-easing) infinite;
}

.is-playing .orders-content {
  animation: orders-enter var(--cycle-duration) var(--motion-easing) infinite;
}

.is-playing .screen-wash {
  animation: transition-wash var(--cycle-duration) linear infinite;
}

@keyframes mine-exit {
  0%,
  39% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
  46% {
    opacity: 0.42;
    transform: translate3d(calc(var(--exit-distance) * 0.55), 0, 0);
  }
  53%,
  100% {
    opacity: 0;
    transform: translate3d(var(--exit-distance), 0, 0);
  }
}

@keyframes orders-enter {
  0%,
  39% {
    opacity: 0;
    transform: translate3d(var(--enter-distance), 0, 0);
  }
  46% {
    opacity: 0.34;
    transform: translate3d(calc(var(--enter-distance) * 0.4), 0, 0);
  }
  53%,
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes transition-wash {
  0%,
  39% {
    opacity: 0;
  }
  46% {
    opacity: var(--transition-opacity);
  }
  54%,
  100% {
    opacity: 0;
  }
}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion-root]", trigger: "loop" }) }
  ];
}
function sourceFilesForProductCardTransition(intent) {
  const values = pageTransitionValues(intent);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>语义生成商品卡片转场</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-product-transition" data-motion-root aria-label="语义生成商品卡片转场">
      <section class="product-stage" data-motion="screenWindow">
        <article class="product-card product-card-front" data-motion="frontPage">
          <span class="product-image"></span>
          <strong>经典好物</strong>
          <small>限时优惠</small>
        </article>
        <article class="product-card product-card-back" data-motion="backPage">
          <span class="product-image is-alt"></span>
          <strong>新品上架</strong>
          <small>立即查看</small>
        </article>
        <div class="screen-wash" data-motion="transitionWash"></div>
      </section>
    </main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const css = `:root {
  --cycle-duration: ${values.cycleDuration}ms;
  --enter-distance: ${values.enterDistance}px;
  --exit-distance: ${values.exitDistance}px;
  --transition-opacity: ${values.transitionOpacity};
  --window-radius: ${values.windowRadius}px;
  --motion-easing: ${values.easing};
  --product-primary: #ef4444;
  --product-secondary: #2563eb;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-product-transition {
  display: grid;
  place-items: center;
  width: min(390px, 92vw);
  min-height: 520px;
}

.product-stage {
  position: relative;
  width: min(320px, 84vw);
  height: 410px;
  overflow: hidden;
  border-radius: var(--window-radius);
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
  isolation: isolate;
}

.product-card,
.screen-wash {
  position: absolute;
  inset: 24px;
}

.product-card {
  display: grid;
  align-content: end;
  gap: 10px;
  border-radius: 28px;
  background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  padding: 22px;
  will-change: opacity, transform;
}

.product-card-back {
  opacity: 0;
  transform: translate3d(var(--enter-distance), 0, 0);
}

.product-image {
  position: absolute;
  inset: 22px 22px auto;
  height: 190px;
  border-radius: 24px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--product-primary) 28%, white), var(--product-primary));
}

.product-image.is-alt {
  background: linear-gradient(135deg, color-mix(in srgb, var(--product-secondary) 24%, white), var(--product-secondary));
}

.product-card strong {
  color: #111827;
  font-size: 26px;
  line-height: 1.1;
}

.product-card small {
  color: #6b7280;
  font-size: 15px;
}

.screen-wash {
  inset: 0;
  opacity: 0;
  background: #f7f9fc;
  pointer-events: none;
  will-change: opacity;
}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: "" }
  ];
}
function sourceFilesFromDraft(draft) {
  return [
    { path: "source/index.html", kind: "html", content: draft.html },
    { path: "source/style.css", kind: "css", content: draft.css },
    { path: "source/script.js", kind: "js", content: draft.js }
  ];
}
function buttonParams(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const label = intent.text ?? DEFAULT_BUTTON_TEXT;
  return [
    {
      id: "buttonBackgroundColor",
      label: "按钮背景色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--button-bg" }]
    },
    {
      id: "buttonTextColor",
      label: "按钮文本色",
      type: "color",
      default: "#ffffff",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--button-text" }]
    },
    {
      id: "motionDuration",
      label: "动画时长",
      type: "duration",
      default: duration,
      status: "confirmed",
      constraints: { min: 220, max: 2400, step: 20, unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
    },
    {
      id: "motionEasing",
      label: "弹性缓动",
      type: "easing",
      default: easing,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    },
    {
      id: "travelDistance",
      label: "移动距离",
      type: "range",
      default: 42,
      status: "confirmed",
      constraints: { min: 0, max: 80, step: 1, unit: "vw" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--travel-distance" }]
    },
    {
      id: "bounceIntensity",
      label: "弹动强度",
      type: "range",
      default: 1.14,
      status: "confirmed",
      constraints: { min: 1, max: 1.32, step: 0.01 },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--bounce-scale" }]
    },
    {
      id: "buttonLabel",
      label: "按钮文案",
      type: "text",
      default: label,
      status: "confirmed",
      constraints: { maxLength: 40 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=buttonLabel]" }]
    }
  ];
}
function buttonLayers() {
  return [
    {
      id: "buttonLabel",
      label: "按钮文案",
      kind: "text",
      replaceable: true,
      paramId: "buttonLabel",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=buttonLabel]" }]
    }
  ];
}
function textParams(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "textContent",
      label: "标题文案",
      type: "text",
      default: intent.text ?? "精彩标题",
      status: "confirmed",
      constraints: { maxLength: 60 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=textContent]" }]
    },
    {
      id: "textColor",
      label: "文字颜色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--text-color" }]
    },
    {
      id: "fontSize",
      label: "字号",
      type: "range",
      default: 42,
      status: "confirmed",
      constraints: { min: 18, max: 72, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--font-size" }]
    },
    ...motionParams(intent)
  ];
}
function cardParams(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "cardTitle",
      label: "卡片标题",
      type: "text",
      default: intent.text ?? "信息卡片",
      status: "confirmed",
      constraints: { maxLength: 50 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardTitle]" }]
    },
    {
      id: "cardDescription",
      label: "卡片描述",
      type: "text",
      default: cardDescriptionForIntent(intent),
      status: "confirmed",
      constraints: { maxLength: 90 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardDescription]" }]
    },
    {
      id: "cardBackgroundColor",
      label: "卡片背景色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--card-bg" }]
    },
    {
      id: "cardRadius",
      label: "圆角",
      type: "range",
      default: 18,
      status: "confirmed",
      constraints: { min: 0, max: 36, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--card-radius" }]
    },
    {
      id: "cardShadow",
      label: "阴影强度",
      type: "range",
      default: 28,
      status: "confirmed",
      constraints: { min: 0, max: 48, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--card-shadow" }]
    },
    ...motionParams(intent)
  ];
}
function badgeParams(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "badgeText",
      label: "标签文案",
      type: "text",
      default: intent.text ?? "标签",
      status: "confirmed",
      constraints: { maxLength: 30 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=badgeText]" }]
    },
    {
      id: "badgeBackgroundColor",
      label: "标签背景色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--badge-bg" }]
    },
    {
      id: "badgeTextColor",
      label: "标签文字色",
      type: "color",
      default: "#ffffff",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--badge-text" }]
    },
    ...motionParams(intent)
  ];
}
function loaderParams(intent) {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "loaderColor",
      label: "加载器颜色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--loader-color" }]
    },
    {
      id: "loaderSize",
      label: "加载点尺寸",
      type: "range",
      default: 16,
      status: "confirmed",
      constraints: { min: 8, max: 32, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--loader-size" }]
    },
    ...motionParams({ ...intent, speed: intent.speed === "normal" ? "fast" : intent.speed })
  ];
}
function mobilePageParams(intent) {
  const color = intent.colors[0] ?? {
    value: "#8b5cf6"
  };
  return [
    {
      id: "pageBackgroundColor",
      label: "页面背景色",
      type: "color",
      default: "#f8fafc",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--page-bg" }]
    },
    {
      id: "foregroundColor",
      label: "前景图层颜色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--foreground-bg" }]
    },
    {
      id: "foregroundScaleStart",
      label: "入场初始缩放",
      type: "range",
      default: 0.72,
      constraints: { min: 0.4, max: 1, step: 0.01 },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--foreground-scale-start" }]
    },
    {
      id: "stageWidth",
      label: "页面宽度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.stageWidth,
      constraints: { min: 320, max: 520, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--stage-width" }]
    },
    {
      id: "stageHeight",
      label: "页面高度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.stageHeight,
      constraints: { min: 700, max: 1200, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--stage-height" }]
    },
    {
      id: "backgroundLayerWidth",
      label: "背景层宽度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerWidth,
      constraints: { min: 360, max: 640, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--background-layer-width" }]
    },
    {
      id: "backgroundLayerHeight",
      label: "背景层高度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerHeight,
      constraints: { min: 800, max: 1280, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--background-layer-height" }]
    },
    ...motionParams(intent)
  ];
}
function pageTransitionParams(intent) {
  const values = pageTransitionValues(intent);
  return [
    {
      id: "cycleDuration",
      label: "循环时长",
      type: "duration",
      default: values.cycleDuration,
      constraints: { min: 1400, max: 5e3, step: 40, unit: "ms" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--cycle-duration" }]
    },
    {
      id: "enterDistance",
      label: "进入距离",
      type: "range",
      default: values.enterDistance,
      constraints: { min: 0, max: 1118, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--enter-distance" }]
    },
    {
      id: "exitDistance",
      label: "退出距离",
      type: "range",
      default: values.exitDistance,
      constraints: { min: -1118, max: 0, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--exit-distance" }]
    },
    {
      id: "transitionOpacity",
      label: "过渡泛白",
      type: "range",
      default: values.transitionOpacity,
      constraints: { min: 0, max: 0.9, step: 0.01 },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--transition-opacity" }]
    },
    {
      id: "windowRadius",
      label: "屏幕圆角",
      type: "range",
      default: values.windowRadius,
      constraints: { min: 0, max: 160, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--window-radius" }]
    },
    {
      id: "easing",
      label: "缓动曲线",
      type: "easing",
      default: values.easing,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    }
  ];
}
function motionParams(intent) {
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  return [
    {
      id: "motionDuration",
      label: "动画时长",
      type: "duration",
      default: duration,
      status: "confirmed",
      constraints: { min: 220, max: 2400, step: 20, unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
    },
    {
      id: "motionEasing",
      label: "动效缓动",
      type: "easing",
      default: easing,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    }
  ];
}
function roleParams(role, intent) {
  if (role === "text") return textParams(intent);
  if (role === "card") return cardParams(intent);
  if (role === "badge") return badgeParams(intent);
  if (role === "loader") return loaderParams(intent);
  if (role === "page-transition") return pageTransitionParams(intent);
  if (role === "mobile-page") return mobilePageParams(intent);
  return buttonParams(intent);
}
function textLayers() {
  return [
    {
      id: "textContent",
      label: "标题文案",
      kind: "text",
      replaceable: true,
      paramId: "textContent",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=textContent]" }]
    }
  ];
}
function cardLayers() {
  return [
    {
      id: "cardTitle",
      label: "卡片标题",
      kind: "text",
      replaceable: true,
      paramId: "cardTitle",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardTitle]" }]
    },
    {
      id: "cardDescription",
      label: "卡片描述",
      kind: "text",
      replaceable: true,
      paramId: "cardDescription",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardDescription]" }]
    }
  ];
}
function badgeLayers() {
  return [
    {
      id: "badgeText",
      label: "标签文案",
      kind: "text",
      replaceable: true,
      paramId: "badgeText",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=badgeText]" }]
    }
  ];
}
function loaderLayers() {
  return [
    {
      id: "loaderRoot",
      label: "加载器结构",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=loaderRoot]", attribute: "class" }]
    }
  ];
}
function pageTransitionLayers() {
  return [
    {
      id: "frontPage",
      label: "前页",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=frontPage]", attribute: "class" }]
    },
    {
      id: "backPage",
      label: "后页",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=backPage]", attribute: "class" }]
    },
    {
      id: "transitionWash",
      label: "过渡泛白",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=transitionWash]", attribute: "class" }]
    }
  ];
}
function mobilePageLayers() {
  return [
    {
      id: "backgroundLayer",
      label: "背景图层",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=backgroundLayer]", attribute: "class" }]
    },
    {
      id: "foregroundLayer",
      label: "前景图层",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=foregroundLayer]", attribute: "class" }]
    }
  ];
}
function roleLayers(role) {
  if (role === "text") return textLayers();
  if (role === "card") return cardLayers();
  if (role === "badge") return badgeLayers();
  if (role === "loader") return loaderLayers();
  if (role === "page-transition") return pageTransitionLayers();
  if (role === "mobile-page") return mobilePageLayers();
  return buttonLayers();
}
function generatedRoleLayers(role) {
  return roleLayers(role).map((layer) => ({ ...layer, replaceable: true }));
}
function roleGroups(role) {
  if (role === "text") {
    return [
      { id: "content", label: "内容", params: ["textContent", "textColor", "fontSize"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "card") {
    return [
      { id: "content", label: "内容", params: ["cardTitle", "cardDescription"] },
      { id: "appearance", label: "外观", params: ["cardBackgroundColor", "cardRadius", "cardShadow"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "badge") {
    return [
      { id: "content", label: "内容", params: ["badgeText"] },
      { id: "appearance", label: "外观", params: ["badgeBackgroundColor", "badgeTextColor"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "loader") {
    return [
      { id: "appearance", label: "外观", params: ["loaderColor", "loaderSize"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "page-transition") {
    return [
      { id: "timing", label: "速度", params: ["cycleDuration", "easing"] },
      { id: "trajectory", label: "轨迹", params: ["enterDistance", "exitDistance"] },
      { id: "visual", label: "视觉", params: ["transitionOpacity", "windowRadius"] }
    ];
  }
  if (role === "mobile-page") {
    return [
      { id: "layout", label: "页面", params: ["pageBackgroundColor", "foregroundColor"] },
      {
        id: "backgroundLayerSize",
        label: "背景层尺寸",
        params: ["stageWidth", "stageHeight", "backgroundLayerWidth", "backgroundLayerHeight"]
      },
      { id: "motion", label: "动效", params: ["foregroundScaleStart", "motionDuration", "motionEasing"] }
    ];
  }
  return [
    {
      id: "appearance",
      label: "外观",
      params: ["buttonBackgroundColor", "buttonTextColor", "buttonLabel"]
    },
    {
      id: "motion",
      label: "动效",
      params: ["motionDuration", "motionEasing", "travelDistance", "bounceIntensity"]
    }
  ];
}
function roleName(role) {
  if (role === "text") return "语义生成标题";
  if (role === "card") return "语义生成卡片";
  if (role === "badge") return "语义生成标签";
  if (role === "loader") return "语义生成加载动画";
  if (role === "page-transition") return "语义生成页面转场";
  if (role === "mobile-page") return "语义生成移动端页面";
  return "语义生成按钮";
}
function generatedManifest(input) {
  const designSpec = input.role === "page-transition" ? { id: "ecommerce-transition-motion-skill", confidence: 0.9, required: true } : { id: "interactive-control-motion-skill", confidence: 0.9, required: true };
  const recipeRequest = motionRecipeRequestFromSemanticIntent(input.intentV2);
  const recipe = resolveMotionRecipe(recipeRequest);
  const appliedRecipe = applyMotionRecipe({
    recipe,
    request: recipeRequest,
    params: roleParams(input.role, input.intent),
    layers: generatedRoleLayers(input.role),
    sourceFiles: input.files,
    source: input.intentV2.source,
    confidence: input.intentV2.confidence
  });
  return {
    manifest: {
      version: "1.0",
      id: `${input.id}-manifest`,
      name: roleName(input.role),
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      designSpecs: [designSpec],
      motionRecipes: [appliedRecipe.binding],
      params: appliedRecipe.params,
      groups: roleGroups(input.role),
      layers: appliedRecipe.layers,
      capabilities: ["editable", "export-html"]
    },
    files: appliedRecipe.files ?? input.files
  };
}
function fileMap(files) {
  return Object.fromEntries(files.map((file) => [file.path, file.content]));
}
function pageTransitionReference(references) {
  return references.find((reference) => reference.id === "jd-front-back-entry-transition") ?? references.find(
    (reference) => [reference.name, ...reference.tags, ...reference.useCases].some(
      (value) => /(前后进场|页面转场|页面切换|page-transition)/i.test(value)
    )
  ) ?? null;
}
function sourceFilesWithPatchedValues(input) {
  const beforeFiles = fileMap(input.reference.source.files);
  const afterFiles = applyPatchToFiles({
    files: beforeFiles,
    manifest: input.reference.manifest,
    patch: {
      id: input.patchId,
      sourceManifestId: input.reference.manifest.id,
      values: input.values
    }
  });
  return input.reference.source.files.map((file) => ({
    ...file,
    content: afterFiles[file.path] ?? file.content
  }));
}
function pageTransitionFromReference(input) {
  const values = pageTransitionValues(input.intent);
  const recipeRequest = motionRecipeRequestFromSemanticIntent(input.intentV2);
  const cache = createMotionRecipeCache([input.reference]);
  const cached = findCachedMotionRecipe({ cache, raw: input.intent.raw, recipeId: recipeRequest.recipeId });
  const extracted = cached ?? extractMotionRecipeFromComponent(input.reference);
  const recipe = extracted?.recipe ?? resolveMotionRecipe(recipeRequest);
  const appliedRecipe = applyMotionRecipe({
    recipe,
    request: recipeRequest,
    params: input.reference.manifest.params.map(
      (param) => param.id in values ? { ...param, default: values[param.id], value: values[param.id] } : param
    ),
    layers: generatedRoleLayers("page-transition"),
    sourceFiles: input.files,
    source: extracted?.recipe.source ?? input.intentV2.source,
    confidence: extracted?.confidence ?? input.intentV2.confidence
  });
  return {
    manifest: {
      ...input.reference.manifest,
      id: `${input.id}-manifest`,
      name: "语义生成页面转场",
      designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.92, required: true }],
      motionRecipes: [appliedRecipe.binding],
      layers: appliedRecipe.layers,
      params: appliedRecipe.params,
      capabilities: unique([...input.reference.manifest.capabilities ?? [], "editable", "export-html"])
    },
    files: appliedRecipe.files ?? input.files
  };
}
function pageTransitionVariantFromReference(input) {
  const reference = pageTransitionReference(input.references);
  if (!reference) return null;
  const values = pageTransitionValues(input.intent);
  const appliesToProductCards = /(商品|产品|货品|卡片|product|card)/i.test(input.intent.raw);
  const files = appliesToProductCards ? sourceFilesForProductCardTransition(input.intent) : sourceFilesWithPatchedValues({
    reference,
    values,
    patchId: `${input.id}-page-transition-variant`
  });
  return pageTransitionFromReference({ id: input.id, intent: input.intent, intentV2: input.intentV2, reference, files });
}
function sourceText(component) {
  return component.source.files.map((file) => file.content).join("\n");
}
function sourceFilesForRole(role, intent) {
  if (role === "text") return sourceFilesForText(intent);
  if (role === "card") return sourceFilesForCard(intent);
  if (role === "badge") return sourceFilesForBadge(intent);
  if (role === "loader") return sourceFilesForLoader(intent);
  if (role === "page-transition") return sourceFilesForPageTransition(intent);
  if (role === "mobile-page") return sourceFilesForMobilePage(intent);
  return sourceFilesForButton(intent);
}
function categoryForRole(role) {
  if (role === "text") return "text";
  if (role === "card") return "layout";
  if (role === "badge") return "interaction";
  if (role === "loader") return "data";
  if (role === "page-transition") return "interaction";
  if (role === "mobile-page") return "layout";
  return "interaction";
}
function coverageFor(input) {
  const text = sourceText(input.component).toLowerCase();
  const satisfied = [];
  const missing = [];
  if (input.intent.role === "button") {
    text.includes("<button") ? satisfied.push("button") : missing.push("button");
  } else if (input.intent.role === "text") {
    text.includes("<h1") && text.includes("semantic-text") ? satisfied.push("text") : missing.push("text");
  } else if (input.intent.role === "card") {
    text.includes("semantic-card") && text.includes("cardtitle") && text.includes("carddescription") ? satisfied.push("card") : missing.push("card");
  } else if (input.intent.role === "badge") {
    text.includes("semantic-badge") ? satisfied.push("badge") : missing.push("badge");
  } else if (input.intent.role === "loader") {
    text.includes("semantic-loader") && text.includes("generated-loop-dots") ? satisfied.push("loader") : missing.push("loader");
  } else if (input.intent.role === "page-transition") {
    const hasScreenLayers = text.includes("mine-content") && text.includes("orders-content") || text.includes("frontpage") && text.includes("backpage");
    const hasTransitionMotion = text.includes("mine-exit") && text.includes("orders-enter") && text.includes("transition-wash") && text.includes("--enter-distance") && text.includes("--exit-distance");
    hasScreenLayers && hasTransitionMotion ? satisfied.push("page-transition") : missing.push("page-transition");
  } else if (input.intent.role === "mobile-page") {
    const hasMobilePage = text.includes("semantic-mobile-page") && text.includes("foreground-layer");
    const hasEntranceMotion = text.includes("generated-load-foreground-scale") && text.includes("scale(");
    hasMobilePage && hasEntranceMotion ? satisfied.push("mobile-page") : missing.push("mobile-page");
  }
  for (const negative of input.intent.negativePreferences) {
    if (/(按钮|button|cta)/i.test(negative)) {
      !text.includes("<button") ? satisfied.push("不要按钮") : missing.push("不要按钮");
    }
  }
  for (const color of input.intent.colors) {
    text.includes(color.value.toLowerCase()) ? satisfied.push(color.label) : missing.push(color.label);
  }
  for (const effect of input.intent.effects) {
    const ok = input.intent.role === "page-transition" && effect === "slide" ? text.includes("translate3d") || text.includes("--enter-distance") : input.intent.role === "page-transition" && effect === "fade" ? text.includes("opacity") || text.includes("transition-wash") : effect === "bounce" ? text.includes("bounce") : effect === "elastic" ? text.includes("cubic-bezier(0.34, 1.56, 0.64, 1)") : effect === "pulse" ? text.includes("pulse") || text.includes("generated-loop-dots") : effect === "float" ? text.includes("float") && text.includes("infinite") : text.includes(effect);
    ok ? satisfied.push(effect) : missing.push(effect);
  }
  if (input.intent.direction) {
    const ok = input.intent.role === "page-transition" ? text.includes("--enter-distance") && text.includes("--exit-distance") : text.includes(input.intent.direction);
    ok ? satisfied.push(input.intent.direction) : missing.push(input.intent.direction);
  }
  if (input.intent.trigger === "click") {
    text.includes('addeventlistener("click"') ? satisfied.push("click") : missing.push("click");
  } else if (input.intent.trigger === "hover") {
    text.includes(":hover") ? satisfied.push("hover") : missing.push("hover");
  } else if (input.intent.trigger === "loop") {
    text.includes("infinite") ? satisfied.push("loop") : missing.push("loop");
  }
  if (text.includes("window.motionreplay")) satisfied.push("motionReplay");
  else missing.push("motionReplay");
  if (text.includes("window.motionpause")) satisfied.push("motionPause");
  else missing.push("motionPause");
  if (text.includes("window.motionseek")) satisfied.push("motionSeek");
  else missing.push("motionSeek");
  return { satisfied: unique(satisfied), missing: unique(missing) };
}
function buildComponent(input) {
  return {
    id: input.id,
    name: input.manifest.name,
    category: categoryForRole(input.role),
    tags: unique([
      "generated",
      "reference-guided",
      input.role,
      ...input.intent.effects,
      ...input.intent.colors.map((color) => color.label),
      ...input.references.slice(0, 3).map((reference) => `ref:${reference.id}`)
    ]),
    useCases: ["semantic-generation"],
    moods: ["generated"],
    manifest: input.manifest,
    source: {
      id: input.id,
      origin: "generated",
      kind: "builtin-component",
      entry: "source/index.html",
      files: input.files
    }
  };
}
function validateReferenceGuidedComponent(input) {
  const files = input.component.source.files;
  const afterFiles = fileMap(files);
  const recipeBinding = input.component.manifest.motionRecipes?.[0];
  const recipeGate = recipeBinding ? validateRecipeApplication({
    binding: recipeBinding,
    params: input.component.manifest.params,
    layers: input.component.manifest.layers ?? [],
    sourceText: sourceText(input.component)
  }) : { valid: false, issues: ["缺少 motion recipe 绑定"] };
  const validation = validateGeneratedComponent({
    component: input.component,
    allowed: {
      paramIds: input.component.manifest.params.map((param) => param.id),
      layerIds: input.component.manifest.layers?.map((layer) => layer.id) ?? [],
      sourceFiles: files.map((file) => file.path),
      sourceTargetKinds: ["css-variable", "html-text"]
    },
    beforeFiles: {},
    afterFiles
  });
  const coverage = coverageFor({ component: input.component, intent: input.intent });
  return {
    coverage,
    validation: {
      ...validation,
      valid: validation.valid && coverage.missing.length === 0 && recipeGate.valid,
      checks: recipeGate.valid ? validation.checks : [
        ...validation.checks,
        {
          id: "readiness-gate",
          status: "fail",
          message: `MotionRecipe 门禁失败：${recipeGate.issues.join("；")}`
        }
      ]
    }
  };
}
function createReferenceGuidedComponent(input) {
  const intentV2 = input.intentV2 ?? parseSemanticIntentV2Fallback(input.brief);
  const intent = input.intentV2 ? semanticIntentV2ToLegacyIntent(input.intentV2) : parseSemanticGenerationIntent(input.brief);
  const role = intent.role ?? "mobile-page";
  const id = `generated-reference-${role}-${input.now ?? Date.now()}`;
  const references = input.references ?? [];
  if (input.sourceDraft) {
    const draftFiles = sourceFilesFromDraft(input.sourceDraft);
    const draftGenerated = generatedManifest({ id, intent, intentV2, role, files: draftFiles });
    const draftComponent = buildComponent({
      id,
      role,
      intent,
      references,
      files: draftGenerated.files,
      manifest: draftGenerated.manifest
    });
    const draftGate = validateReferenceGuidedComponent({ component: draftComponent, intent });
    if (draftGate.validation.valid) {
      return {
        component: draftComponent,
        intent,
        intentV2,
        coverage: draftGate.coverage,
        validation: draftGate.validation,
        references: references.slice(0, 3).map((reference) => ({ id: reference.id, name: reference.name }))
      };
    }
  }
  if (role === "page-transition") {
    const variant = pageTransitionVariantFromReference({ id, intent, intentV2, references });
    if (variant) {
      const component2 = buildComponent({
        id,
        role,
        intent,
        references,
        files: variant.files,
        manifest: variant.manifest
      });
      const variantGate = validateReferenceGuidedComponent({ component: component2, intent });
      return {
        component: component2,
        intent,
        intentV2,
        coverage: variantGate.coverage,
        validation: variantGate.validation,
        references: references.slice(0, 3).map((reference) => ({ id: reference.id, name: reference.name }))
      };
    }
  }
  const files = sourceFilesForRole(role, intent);
  const generated = generatedManifest({ id, intent, intentV2, role, files });
  const component = buildComponent({
    id,
    role,
    intent,
    references,
    files: generated.files,
    manifest: generated.manifest
  });
  const fallbackGate = validateReferenceGuidedComponent({ component, intent });
  return {
    component,
    intent,
    intentV2,
    coverage: fallbackGate.coverage,
    validation: fallbackGate.validation,
    references: references.slice(0, 3).map((reference) => ({ id: reference.id, name: reference.name }))
  };
}
function fileKind(path) {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}
function scanUnsafeContent(files) {
  const warnings = [];
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith(".html") && !path.endsWith(".js")) continue;
    const lower = content.toLowerCase();
    const externalScriptPattern = /<script[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>/gi;
    for (const match of content.matchAll(externalScriptPattern)) {
      const src = match[0].match(/src=["']([^"']+)["']/)?.[1] ?? "";
      warnings.push({
        code: "unsafe-content",
        message: `${path}: 外域脚本引用已移除 — ${src}`
      });
    }
    if (lower.includes("document.cookie")) {
      warnings.push({
        code: "unsafe-content",
        message: `${path}: 包含 document.cookie 访问，将在预览中拦截`
      });
    }
    if (/\beval\s*\(/.test(lower) || /\bnew\s+Function\s*\(/.test(lower)) {
      warnings.push({
        code: "unsafe-content",
        message: `${path}: 包含 eval/new Function 调用，将在预览中拦截`
      });
    }
  }
  return warnings;
}
function sanitizeHtml(html) {
  return html.replace(/<script[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>/gi, "");
}
function findEntry(paths) {
  const rootIndex = paths.find((p) => p === "index.html");
  if (rootIndex) return { entry: rootIndex, isSubDirectory: false };
  const rootHtml = paths.find((p) => !p.includes("/") && p.endsWith(".html"));
  if (rootHtml) return { entry: rootHtml, isSubDirectory: false };
  const subdirIndexes = paths.filter((p) => p.endsWith("/index.html") || p.includes("/index.html")).sort((a, b) => a.split("/").length - b.split("/").length);
  if (subdirIndexes.length > 0) return { entry: subdirIndexes[0], isSubDirectory: true };
  const subdirHtmls = paths.filter((p) => p.includes("/") && p.endsWith(".html")).sort((a, b) => a.split("/").length - b.split("/").length);
  if (subdirHtmls.length > 0) return { entry: subdirHtmls[0], isSubDirectory: true };
  return null;
}
function importMotionSourceFromFiles(files) {
  const paths = Object.keys(files);
  const warnings = [...scanUnsafeContent(files)];
  const entryResult = findEntry(paths);
  if (!entryResult) {
    warnings.push({ code: "missing-entry", message: "未找到 HTML 入口文件" });
  } else if (entryResult.isSubDirectory) {
    warnings.push({
      code: "sub-directory-entry",
      message: `入口文件位于子目录：${entryResult.entry}`
    });
  }
  const entry = entryResult?.entry ?? paths[0] ?? "";
  const hasCssOrJs = paths.some((path) => path.endsWith(".css") || path.endsWith(".js"));
  const hasSvgOnly = paths.length > 0 && paths.every((path) => path.endsWith(".svg") || path.endsWith(".css"));
  const kind = hasSvgOnly ? "css-svg" : hasCssOrJs ? "html-package" : "single-html";
  const sanitizedFiles = {};
  for (const [path, content] of Object.entries(files)) {
    sanitizedFiles[path] = path.endsWith(".html") ? sanitizeHtml(content) : content;
  }
  return {
    warnings,
    source: {
      id: "imported-source",
      origin: "imported",
      kind,
      files: paths.map((path) => ({ path, content: sanitizedFiles[path] ?? "", kind: fileKind(path) })),
      entry
    }
  };
}
const SAFE_HTML_ATTRIBUTES = ["alt", "title", "aria-label"];
const SAFE_SVG_ATTRIBUTES = ["fill", "stroke"];
const CSS_PROPERTY_LABELS = {
  "animation-duration": "动画时长",
  "background-color": "背景色",
  "border-radius": "圆角",
  color: "颜色",
  "font-size": "字号",
  gap: "间距",
  opacity: "透明度",
  "transition-duration": "过渡时长"
};
const HTML_ATTRIBUTE_LABELS = {
  "aria-label": "辅助标签",
  alt: "替代文本",
  title: "标题"
};
const SVG_ATTRIBUTE_LABELS = {
  fill: "填充色",
  stroke: "描边色"
};
function simpleColor(value) {
  return /^(#|rgb|rgba|hsl|hsla)\b/i.test(value.trim());
}
function parseNumber(value) {
  const numeric = Number(value.trim());
  return Number.isFinite(numeric) ? numeric : null;
}
function parseLength(value) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|%|vh|vw)$/);
  if (!match?.[1] || !match[2]) return null;
  return { unit: match[2] };
}
function parseDuration(value) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(ms|s)$/);
  if (!match?.[1] || !match[2]) return null;
  return { unit: match[2] };
}
function lengthConstraints(unit, max = 200) {
  return { unit, min: 0, max: unit === "%" ? 100 : max, step: unit === "rem" ? 0.1 : 1 };
}
function durationConstraints(unit) {
  return { unit, min: 0, max: unit === "ms" ? 5e3 : 5, step: unit === "ms" ? 50 : 0.05 };
}
function cssVariableParam(value) {
  const trimmed = value.trim();
  if (simpleColor(trimmed)) return { type: "color" };
  const duration = parseDuration(trimmed);
  if (duration) return { type: "duration", constraints: durationConstraints(duration.unit) };
  const length = parseLength(trimmed);
  if (length) return { type: "range", constraints: lengthConstraints(length.unit) };
  return { type: "text" };
}
function cssPropertyParam(property, value) {
  const trimmed = value.trim();
  if (["color", "background-color"].includes(property)) {
    return simpleColor(trimmed) ? { type: "color" } : null;
  }
  if (["transition-duration", "animation-duration"].includes(property)) {
    const duration = parseDuration(trimmed);
    return duration ? { type: "duration", constraints: durationConstraints(duration.unit) } : null;
  }
  if (["border-radius", "font-size", "gap"].includes(property)) {
    const length = parseLength(trimmed);
    if (!length) return null;
    return {
      type: "range",
      constraints: lengthConstraints(length.unit, property === "border-radius" ? 100 : 200)
    };
  }
  if (property === "opacity") {
    const opacity = parseNumber(trimmed);
    if (opacity === null || opacity < 0 || opacity > 1) return null;
    return { type: "range", constraints: { min: 0, max: 1, step: 0.01 } };
  }
  return null;
}
function isAllowedCssProperty(property) {
  return [
    "color",
    "background-color",
    "transition-duration",
    "animation-duration",
    "border-radius",
    "font-size",
    "gap",
    "opacity"
  ].includes(property);
}
function isSafeHtmlAttribute(attribute) {
  return SAFE_HTML_ATTRIBUTES.includes(attribute);
}
function isSafeSvgAttribute(attribute) {
  return SAFE_SVG_ATTRIBUTES.includes(attribute);
}
function isSafeCssSelector(selector) {
  const trimmed = selector.trim();
  if (!trimmed || trimmed.includes(",") || trimmed.includes(":")) return false;
  return /^[.#[]/.test(trimmed);
}
function isSimpleColorValue(value) {
  return simpleColor(value);
}
function cssPropertyLabel(property) {
  return CSS_PROPERTY_LABELS[property] ?? "样式参数";
}
function cssVariableLabel(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes("background") && normalized.includes("color")) return "背景色";
  if (normalized.includes("text") && normalized.includes("color")) return "文本色";
  if (normalized.includes("hover") && normalized.includes("color")) return "悬停色";
  if (normalized.includes("color")) return "颜色";
  if (normalized.includes("duration")) return "时长";
  if (normalized.includes("radius")) return "圆角";
  if (normalized.includes("size")) return "尺寸";
  if (normalized.includes("width")) return "宽度";
  if (normalized.includes("height")) return "高度";
  if (normalized.includes("border")) return "边框";
  return "参数";
}
function htmlAttributeLabel(attribute) {
  return HTML_ATTRIBUTE_LABELS[attribute] ?? "文本属性";
}
function svgAttributeLabel(attribute) {
  return SVG_ATTRIBUTE_LABELS[attribute] ?? "图形属性";
}
function toParamId(name) {
  return name.replace(/^--/, "").replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}
function selectorToIdPrefix(selector) {
  const cleaned = selector.replace(/^\./, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return toParamId(cleaned || "component");
}
function propertyToIdSuffix(property) {
  return property.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()).replace(/^./, (char) => char.toUpperCase());
}
function attributeToIdSuffix(attribute) {
  return attribute.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()).replace(/^./, (char) => char.toUpperCase());
}
function scanCssProperties(filePath, content) {
  const params = [];
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;
  for (const rule of content.matchAll(rulePattern)) {
    const selector = rule[1]?.trim();
    const body = rule[2];
    if (!selector || !body || !isSafeCssSelector(selector)) continue;
    const declarationPattern = /([a-z-]+)\s*:\s*([^;]+);/g;
    for (const declaration of body.matchAll(declarationPattern)) {
      const property = declaration[1];
      const value = declaration[2]?.trim();
      if (!property || !value) continue;
      const shape = cssPropertyParam(property, value);
      if (!shape) continue;
      const param = {
        id: `${selectorToIdPrefix(selector)}${propertyToIdSuffix(property)}`,
        label: cssPropertyLabel(property),
        type: shape.type,
        default: value,
        status: "detected",
        confidence: 0.65,
        targets: [{ kind: "css-property", file: filePath, selector, property }]
      };
      if (shape.constraints) param.constraints = shape.constraints;
      params.push(param);
    }
  }
  return params;
}
function attributeValue(attributes, attribute) {
  const match = attributes.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}
function scanHtmlAttributeParams(filePath, content) {
  const params = [];
  const elementPattern = /<([a-z0-9-]+)\b([^>]*)>/gi;
  for (const element of content.matchAll(elementPattern)) {
    const attributes = element[2];
    if (!attributes) continue;
    const id = attributeValue(attributes, "data-motion");
    if (!id) continue;
    for (const attribute of SAFE_HTML_ATTRIBUTES) {
      const value = attributeValue(attributes, attribute);
      if (value === null) continue;
      params.push({
        id: `${id}${attributeToIdSuffix(attribute)}`,
        label: htmlAttributeLabel(attribute),
        type: "text",
        default: value,
        status: "detected",
        confidence: 0.75,
        targets: [{ kind: "html-attribute", file: filePath, selector: `[data-motion=${id}]`, attribute }]
      });
    }
    for (const attribute of SAFE_SVG_ATTRIBUTES) {
      const value = attributeValue(attributes, attribute);
      if (value === null || !isSimpleColorValue(value)) continue;
      params.push({
        id: `${id}${attributeToIdSuffix(attribute)}`,
        label: svgAttributeLabel(attribute),
        type: "color",
        default: value,
        status: "detected",
        confidence: 0.75,
        targets: [{ kind: "svg-attribute", file: filePath, selector: `[data-motion=${id}]`, attribute }]
      });
    }
  }
  return params;
}
function scanSourceForParams(source) {
  const params = [];
  for (const file of source.files) {
    if (file.kind === "css") {
      const variablePattern = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
      for (const match of file.content.matchAll(variablePattern)) {
        const name = match[1];
        const value = match[2]?.trim();
        if (!name || !value) continue;
        const shape = cssVariableParam(value);
        const param = {
          id: toParamId(name),
          label: cssVariableLabel(name),
          type: shape.type,
          default: value,
          status: "detected",
          confidence: 0.9,
          targets: [{ kind: "css-variable", file: file.path, selector: ":root", name }]
        };
        if (shape.constraints) param.constraints = shape.constraints;
        params.push(param);
      }
      params.push(...scanCssProperties(file.path, file.content));
    }
    if (file.kind === "html") {
      const dataMotionPattern = /<([a-z0-9-]+)[^>]*data-motion=["']([^"']+)["'][^>]*>([^<]*)<\/\1>/gi;
      for (const match of file.content.matchAll(dataMotionPattern)) {
        const id = match[2];
        const text = match[3];
        if (!id || text === void 0) continue;
        params.push({
          id,
          label: id,
          type: "text",
          default: text,
          status: "detected",
          confidence: 0.8,
          targets: [{ kind: "html-text", file: file.path, selector: `[data-motion=${id}]` }]
        });
      }
      params.push(...scanHtmlAttributeParams(file.path, file.content));
    }
  }
  return params;
}
function labelFromId(id) {
  return id.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}
function layerKind(id, tagName) {
  if (tagName === "h1" || tagName === "h2" || tagName === "p" || /(headline|title|text|copy|label)/i.test(id)) {
    return "text";
  }
  if (tagName === "img" || /(image|poster|frame|screen|card|media|popup|shell|content)/i.test(id)) {
    return "image";
  }
  return "structure";
}
function isLayerToken(token) {
  if (token.length < 3 || token.length > 48) return false;
  if (/^(active|hidden|visible|root|main)$/i.test(token)) return false;
  return /(layer|frame|card|screen|poster|image|media|popup|shell|content|headline|title)/i.test(token);
}
function upsertLayer(layers, layer) {
  if (!layers.has(layer.id)) layers.set(layer.id, layer);
}
function scanHtmlLayers(source, layers) {
  for (const file of source.files.filter((item) => item.kind === "html")) {
    for (const match of file.content.matchAll(
      /<([a-z0-9-]+)\b[^>]*\bdata-motion-layer=["']([^"']+)["'][^>]*>/gi
    )) {
      const tagName = match[1]?.toLowerCase();
      const id = match[2]?.trim();
      if (!id) continue;
      upsertLayer(layers, {
        id,
        label: id,
        kind: layerKind(id, tagName),
        replaceable: true,
        required: false,
        targets: []
      });
    }
    for (const match of file.content.matchAll(/class=["']([^"']+)["']/g)) {
      const classList = match[1];
      if (!classList) continue;
      for (const className of classList.split(/\s+/).filter(isLayerToken)) {
        upsertLayer(layers, {
          id: className,
          label: labelFromId(className),
          kind: layerKind(className),
          replaceable: false,
          required: false,
          targets: []
        });
      }
    }
  }
}
function scanCssLayers(source, layers) {
  for (const file of source.files.filter((item) => item.kind === "css")) {
    for (const match of file.content.matchAll(
      /\.([A-Za-z_-][\w-]*)\s*{[^}]*background(?:-image)?:\s*var\(/g
    )) {
      const className = match[1];
      if (!className || !isLayerToken(className)) continue;
      upsertLayer(layers, {
        id: className,
        label: labelFromId(className),
        kind: layerKind(className),
        replaceable: false,
        required: false,
        targets: []
      });
    }
  }
}
function scanSourceForLayers(source) {
  const layers = /* @__PURE__ */ new Map();
  scanHtmlLayers(source, layers);
  scanCssLayers(source, layers);
  return [...layers.values()];
}
function prettifyLabel(label) {
  return label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
function suggestParams(detected, maxParams = 10) {
  return detected.slice(0, maxParams).map((param) => ({
    ...param,
    label: prettifyLabel(param.label),
    status: "suggested",
    confidence: Math.min(1, param.confidence ?? 0.7)
  }));
}
function dataMotionSelectorValue(selector) {
  return selector.match(/^\[data-motion=([^\]]+)\]$/)?.[1]?.replace(/^["']|["']$/g, "") ?? null;
}
function ruleBody(content, selector) {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m");
  return pattern.exec(content)?.[1] ?? null;
}
function cssDeclarationValue(content, selector, property) {
  const body = ruleBody(content, selector);
  if (!body) return null;
  const pattern = new RegExp(
    `(?:^|;)\\s*${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+)`,
    "m"
  );
  return pattern.exec(body)?.[1]?.trim() ?? null;
}
function cssVariableValue(content, name) {
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+)`);
  return pattern.exec(content)?.[1]?.trim() ?? null;
}
function paramTypeMatches(param, type) {
  if (type === "range") return param.type === "range" || param.type === "number";
  return param.type === type;
}
function hasDataMotionElement(content, selector) {
  const dataMotion = dataMotionSelectorValue(selector);
  if (!dataMotion) return false;
  return content.includes(`data-motion="${dataMotion}"`) || content.includes(`data-motion='${dataMotion}'`);
}
function hasDataMotionAttribute(content, selector, attribute) {
  const dataMotion = dataMotionSelectorValue(selector);
  if (!dataMotion) return false;
  const elementPattern = new RegExp(
    `<[^>]*\\bdata-motion=["']${dataMotion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i"
  );
  const element = elementPattern.exec(content)?.[0];
  if (!element) return false;
  return new RegExp(`\\b${attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=`, "i").test(element);
}
function targetExists(source, param) {
  return param.targets.every((target) => {
    if (!("file" in target)) return false;
    const file = source.files.find((item) => item.path === target.file);
    if (!file) return false;
    if (target.kind === "css-variable") {
      const value = cssVariableValue(file.content, target.name);
      return value !== null && paramTypeMatches(param, cssVariableParam(value).type);
    }
    if (target.kind === "css-property") {
      if (!isAllowedCssProperty(target.property) || !isSafeCssSelector(target.selector)) return false;
      const value = cssDeclarationValue(file.content, target.selector, target.property);
      const shape = value === null ? null : cssPropertyParam(target.property, value);
      return shape !== null && paramTypeMatches(param, shape.type);
    }
    if (target.kind === "html-text") {
      return hasDataMotionElement(file.content, target.selector);
    }
    if (target.kind === "html-attribute") {
      return isSafeHtmlAttribute(target.attribute) && hasDataMotionAttribute(file.content, target.selector, target.attribute);
    }
    if (target.kind === "svg-attribute") {
      return isSafeSvgAttribute(target.attribute) && hasDataMotionAttribute(file.content, target.selector, target.attribute);
    }
    return false;
  });
}
function confirmValidParams(input) {
  const confirmed = [];
  const rejected = [];
  const warnings = [];
  for (const param of input.params) {
    if (targetExists(input.source, param)) {
      confirmed.push({ ...param, status: "confirmed" });
    } else {
      rejected.push({ ...param, status: "rejected" });
      warnings.push(`Param ${param.id} has a missing target.`);
    }
  }
  return { confirmed, rejected, warnings };
}
function composeEditablePackageFiles(input) {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });
  return {
    ...patchedFiles,
    "motion.manifest.json": JSON.stringify(input.manifest, null, 2),
    "metadata.json": JSON.stringify(input.metadata, null, 2),
    "motion.patch.json": JSON.stringify(input.patch, null, 2)
  };
}
function localAssetPath(path) {
  return path.replace(/^\.?\//, "");
}
function sourceLookupPath(path) {
  const normalized = localAssetPath(path);
  return normalized.startsWith("source/") ? normalized : `source/${normalized}`;
}
function composeStandaloneHtmlFile(input) {
  const patchedFiles = applyPatchToFiles({
    files: input.sourceFiles,
    manifest: input.manifest,
    patch: input.patch
  });
  const entry = patchedFiles[input.manifest.runtime.entry] ?? "";
  return entry.replace(/<link\b[^>]*>/g, (tag) => {
    if (!/\brel=["']stylesheet["']/.test(tag)) return tag;
    const href = tag.match(/\bhref=["']([^"']+)["']/)?.[1];
    if (!href) return tag;
    const content = patchedFiles[sourceLookupPath(href)] ?? patchedFiles[localAssetPath(href)];
    return content === void 0 ? tag : `<style>
${content}
</style>`;
  }).replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/g, (tag, src) => {
    const content = patchedFiles[sourceLookupPath(src)] ?? patchedFiles[localAssetPath(src)];
    return content === void 0 ? tag : `<script>${content}<\/script>`;
  });
}
function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
function toCssString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
function hasMotionHints(video) {
  return video.motionHints !== void 0 && video.motionHints.direction !== "none" && video.motionHints.confidence > 0;
}
function normalizedFrames(video) {
  const frames = video.frames?.filter((frame) => frame.dataUrl.trim().length > 0).slice(0, 6).map((frame, index) => ({
    id: frame.id || `frame-${index}`,
    timestampMs: clampNumber(frame.timestampMs, index, 0, 6e5),
    dataUrl: frame.dataUrl
  })) ?? [];
  if (frames.length > 0) return frames;
  if (video.posterDataUrl) return [{ id: "poster", timestampMs: 0, dataUrl: video.posterDataUrl }];
  return [];
}
function percent(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
function frameTimings(frames, durationMs) {
  if (frames.length === 0) return [];
  const sorted = [...frames].sort((a, b) => a.timestampMs - b.timestampMs);
  return sorted.map((frame, index) => {
    const next = sorted[index + 1];
    const startMs = clampNumber(frame.timestampMs, 0, 0, durationMs);
    const endMs = next ? clampNumber(next.timestampMs, durationMs, startMs, durationMs) : durationMs;
    return {
      ...frame,
      startPercent: startMs / durationMs * 100,
      endPercent: endMs / durationMs * 100
    };
  });
}
function frameKeyframes(frames) {
  return frames.map((frame, index) => {
    const start = percent(frame.startPercent);
    const end = percent(frame.endPercent);
    return `@keyframes frame-${index} {
  0%,
  100% { opacity: 0; }
  ${start}% { opacity: 1; }
  ${end}% { opacity: 1; }
}`;
  }).join("\n\n");
}
function createJob(id) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: `${id}-conversion`,
    status: "completed",
    progress: 100,
    currentStep: "completed",
    message: "已生成首版代码动效组件",
    startedAt: now,
    completedAt: now
  };
}
function createPlan(video) {
  const width = clampNumber(video.width, 390, 120, 1920);
  const height = clampNumber(video.height, 844, 120, 1920);
  const durationMs = clampNumber(video.durationMs, 1200, 120, 1e4);
  const fps = clampNumber(video.fps, 30, 1, 120);
  const shouldAnimateLayer = hasMotionHints(video);
  const motionHints = video.motionHints;
  return {
    artboard: { width, height },
    durationMs,
    fps,
    strategy: "single-layer-code-draft",
    cssDefaults: {
      startX: clampNumber(motionHints?.startX, 0, -320, 320),
      startY: clampNumber(motionHints?.startY, 0, -480, 480),
      startScale: shouldAnimateLayer ? 0.96 : 1,
      midScale: shouldAnimateLayer ? 1.03 : 1,
      endX: clampNumber(motionHints?.endX, 0, -320, 320),
      endY: clampNumber(motionHints?.endY, 0, -480, 480),
      opacity: 1,
      cornerRadius: 24,
      enterOpacity: shouldAnimateLayer ? 0 : 1
    },
    notes: [
      "首版工程化转换使用单图层代码动效草案。",
      "后续 worker 可用 ffmpeg 抽帧、多模态 LLM 识别和裁切图层替换该计划。"
    ]
  };
}
function createParams() {
  return [
    {
      id: "motionDuration",
      label: "动效时长",
      type: "duration",
      default: 1200,
      status: "confirmed",
      constraints: { min: 120, max: 5e3, step: 20, unit: "ms" },
      targets: [
        { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }
      ]
    },
    {
      id: "startDelay",
      label: "开始延迟",
      type: "duration",
      default: 0,
      status: "confirmed",
      constraints: { min: 0, max: 2e3, step: 20, unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-delay" }]
    },
    {
      id: "startX",
      label: "起点 X",
      type: "number",
      default: 0,
      status: "confirmed",
      constraints: { min: -320, max: 320, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-x" }]
    },
    {
      id: "startY",
      label: "起点 Y",
      type: "number",
      default: 68,
      status: "confirmed",
      constraints: { min: -480, max: 480, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--start-y" }]
    },
    {
      id: "midScale",
      label: "中段缩放",
      type: "range",
      default: 1.03,
      status: "confirmed",
      constraints: { min: 0.6, max: 1.6, step: 0.01 },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--mid-scale" }]
    },
    {
      id: "endX",
      label: "终点 X",
      type: "number",
      default: 0,
      status: "confirmed",
      constraints: { min: -320, max: 320, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--end-x" }]
    },
    {
      id: "endY",
      label: "终点 Y",
      type: "number",
      default: 0,
      status: "confirmed",
      constraints: { min: -480, max: 480, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--end-y" }]
    },
    {
      id: "layerOpacity",
      label: "图层透明度",
      type: "range",
      default: 1,
      status: "confirmed",
      constraints: { min: 0, max: 1, step: 0.01 },
      targets: [
        { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--layer-opacity" }
      ]
    },
    {
      id: "cornerRadius",
      label: "圆角",
      type: "number",
      default: 24,
      status: "confirmed",
      constraints: { min: 0, max: 80, step: 1, unit: "px" },
      targets: [
        { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--corner-radius" }
      ]
    },
    {
      id: "posterImage",
      label: "画面图层",
      type: "image",
      default: "",
      status: "confirmed",
      constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp"] },
      targets: [
        { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--video-poster" }
      ]
    }
  ];
}
function createSourceFiles(input, plan) {
  const videoName = toCssString(input.video.fileName);
  const poster = toCssString(input.video.posterDataUrl ?? "");
  const frames = normalizedFrames(input.video);
  const timedFrames = frameTimings(frames, plan.durationMs);
  const frameLayers = frames.map(
    (_frame, index) => `    <div class="motion-frame motion-frame-${index}" style="--frame-image: var(--frame-${index});"></div>`
  ).join("\n");
  const indexHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="./assets.css" />
    <link rel="stylesheet" href="./style.css" />
    <title>${input.name}</title>
  </head>
  <body>
<main class="motion-artboard" aria-label="${input.name}">
  <div class="motion-stage">
    <div class="motion-layer" role="img" aria-label="${videoName} generated motion layer">
${frameLayers || '      <div class="motion-frame fallback-frame" style="--frame-index: 0; --frame-image: var(--video-poster);"></div>'}
    </div>
  </div>
</main>
    <script src="./script.js"><\/script>
  </body>
</html>`;
  const styleCss = `:root {
  --artboard-width: ${plan.artboard.width}px;
  --artboard-height: ${plan.artboard.height}px;
  --motion-duration: ${plan.durationMs}ms;
  --start-delay: 0ms;
  --motion-easing: cubic-bezier(0.2, 0.8, 0.2, 1);
  --start-x: ${plan.cssDefaults.startX}px;
  --start-y: ${plan.cssDefaults.startY}px;
  --start-scale: ${plan.cssDefaults.startScale};
  --mid-scale: ${plan.cssDefaults.midScale};
  --end-x: ${plan.cssDefaults.endX}px;
  --end-y: ${plan.cssDefaults.endY}px;
  --layer-opacity: ${plan.cssDefaults.opacity};
  --enter-opacity: ${plan.cssDefaults.enterOpacity};
  --corner-radius: ${plan.cssDefaults.cornerRadius}px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f5f5f4;
}

.motion-artboard {
  width: var(--artboard-width);
  height: var(--artboard-height);
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #111111;
}

.motion-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}

.motion-layer {
  position: absolute;
  inset: 0;
  border-radius: var(--corner-radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
    linear-gradient(135deg, #1d1d1f, #3a3a38);
  opacity: var(--layer-opacity);
  animation: generated-motion var(--motion-duration) var(--motion-easing) var(--start-delay) infinite both;
  transform-origin: 50% 50%;
  overflow: hidden;
}

.motion-frame {
  position: absolute;
  inset: 0;
  background: var(--frame-image) center / cover no-repeat;
  opacity: 0;
  animation-duration: var(--motion-duration);
  animation-timing-function: linear;
  animation-delay: var(--start-delay);
  animation-iteration-count: infinite;
  animation-fill-mode: both;
}

${timedFrames.map((_frame, index) => `.motion-frame-${index} { animation-name: frame-${index}; }`).join("\n")}

.fallback-frame {
  opacity: 1;
}

@keyframes generated-motion {
  0% {
    transform: translate3d(var(--start-x), var(--start-y), 0) scale(var(--start-scale));
    opacity: var(--enter-opacity);
  }

  52% {
    transform: translate3d(calc(var(--end-x) * 0.4), calc(var(--end-y) * 0.4), 0) scale(var(--mid-scale));
    opacity: var(--layer-opacity);
  }

  100% {
    transform: translate3d(var(--end-x), var(--end-y), 0) scale(1);
    opacity: var(--layer-opacity);
  }
}

${frameKeyframes(timedFrames)}`;
  const scriptJs = `document.documentElement.dataset.motionComponent = "${input.id}";`;
  const frameVariables = frames.map((frame, index) => `  --frame-${index}: url("${toCssString(frame.dataUrl)}");`).join("\n");
  const assetsCss = `:root {
  --video-source-name: "${videoName}";
  --video-poster: ${poster ? `url("${poster}")` : "linear-gradient(135deg, #1d1d1f, #3a3a38)"};
${frameVariables}
}`;
  return [
    { path: "source/index.html", content: indexHtml, kind: "html" },
    { path: "source/style.css", content: styleCss, kind: "css" },
    { path: "source/script.js", content: scriptJs, kind: "js" },
    { path: "source/assets.css", content: assetsCss, kind: "css" }
  ];
}
function createManifest(input, params) {
  return {
    version: "1.0",
    id: `${input.id}-manifest`,
    name: input.name,
    sourceKind: "html-package",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params,
    groups: [
      {
        id: "motion",
        label: "动效",
        params: ["motionDuration", "startDelay", "startX", "startY", "midScale", "endX", "endY"]
      },
      { id: "appearance", label: "外观", params: ["layerOpacity", "cornerRadius", "posterImage"] }
    ],
    layers: [
      {
        id: "posterImage",
        label: "视频画面",
        kind: "image",
        replaceable: true,
        paramId: "posterImage",
        targets: [
          { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--video-poster" }
        ]
      }
    ],
    capabilities: ["imported", "editable", "export-html"]
  };
}
function verifyComponent(component) {
  const index = component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
  const style = component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
  return [
    {
      id: "entry-html",
      label: "入口 HTML",
      status: index.includes("motion-artboard") ? "pass" : "fail",
      message: "生成组件包含可预览入口"
    },
    {
      id: "no-video-wrapper",
      label: "非视频包装",
      status: /<video\b/i.test(index) ? "fail" : "pass",
      message: "生成结果不依赖原始 video 标签播放"
    },
    {
      id: "editable-vars",
      label: "可调变量",
      status: style.includes("--motion-duration") && style.includes("--start-x") ? "pass" : "fail",
      message: "CSS 暴露动效调节变量"
    }
  ];
}
function createVideoMotionComponentDraft(input) {
  const plan = createPlan(input.video);
  const params = createParams().map((param) => {
    if (param.id === "motionDuration") return { ...param, default: plan.durationMs };
    if (param.id === "startX") return { ...param, default: plan.cssDefaults.startX };
    if (param.id === "startY") return { ...param, default: plan.cssDefaults.startY };
    if (param.id === "endX") return { ...param, default: plan.cssDefaults.endX };
    if (param.id === "endY") return { ...param, default: plan.cssDefaults.endY };
    if (param.id === "posterImage") return { ...param, default: input.video.posterDataUrl ?? "" };
    return param;
  });
  const manifest = createManifest(input, params);
  const sourceFiles = createSourceFiles(input, plan);
  const component = {
    id: input.id,
    name: input.name,
    category: "media",
    tags: ["uploaded", "video-generated", "motion"],
    useCases: ["video-to-motion"],
    moods: ["generated"],
    source: {
      id: input.id,
      origin: "generated",
      kind: "html-package",
      files: sourceFiles,
      entry: "source/index.html"
    },
    manifest
  };
  const checks = verifyComponent(component);
  return {
    job: createJob(input.id),
    plan,
    component,
    report: { checks }
  };
}
const SAMPLE_TEXT = {
  "30 Mins &nbsp; | &nbsp; 1 Serving": "30 分钟 &nbsp; | &nbsp; 1 人份",
  "0x7A2C8B9F": "校验码",
  "1012 mbar": "1012 毫巴",
  "21 °C": "21 摄氏度",
  "23 °C": "23 摄氏度",
  "8 Km/h": "8 公里/小时",
  AQI: "空气质量指数",
  Actions: "操作",
  Awesome: "精彩",
  BACK: "返回",
  Back: "返回",
  "Back to Top": "返回顶部",
  B: "按",
  ball: "球",
  Bread: "面包",
  Button: "按钮",
  BUTTON: "按钮",
  "Buy Now": "立即购买",
  "Card title": "卡片标题",
  "Card Title": "卡片标题",
  Checkbox: "选择框",
  "Checkbox 1": "选择框一",
  "Checkbox 2": "选择框二",
  "Checkbox 3": "选择框三",
  "Checkbox 4": "选择框四",
  "Check me": "选中我",
  Cheese: "奶酪",
  Clone: "克隆",
  Code: "代码",
  Colloborators: "协作者",
  Coffee: "咖啡",
  "Continue Application": "继续申请",
  Cryptocurrency: "加密货币",
  "Create, share, and use beautiful custom elements made with CSS": "创建、分享和使用精美的样式自定义元素",
  Delete: "删除",
  Discord: "社区",
  Docs: "文档",
  Download: "下载",
  "Dunmore, Ireland": "邓莫尔，爱尔兰",
  Earn: "收益",
  Edit: "编辑",
  Ethereum: "以太坊",
  Facebook: "脸书",
  "FLIP CARD": "翻转卡片",
  "Follow me": "关注我",
  "Generate Site": "生成站点",
  "Get started": "开始使用",
  Github: "代码库",
  GLITCH: "故障",
  Game: "游戏",
  "HELLO !": "你好！",
  "Here are the details of the card": "这里是卡片的详细信息",
  Healthy: "健康",
  Hello: "你好",
  "Hover Me": "悬停查看",
  "Hover me": "悬停查看",
  "Hover Over": "悬停查看",
  "HOVER OVER :D": "悬停查看",
  "HOVER ME": "悬停查看",
  Humidity: "湿度",
  Instagram: "照片墙",
  "Learn More": "了解更多",
  "Leave Me": "离开我",
  Like: "喜欢",
  Likes: "喜欢",
  "Magic Link": "魔法链接",
  Logout: "退出",
  "Lorem Ipsum": "示例文案",
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.": "这是一段用于展示卡片排版的示例说明文案，可替换为真实业务内容。",
  MENU: "菜单",
  MikeAndrewDesigner: "设计师麦克",
  Morning: "早晨",
  "More info": "更多信息",
  "Modern Button": "现代按钮",
  "Neon Checkbox": "霓虹选择框",
  N: "钮",
  "New Transaction": "新交易",
  O: "键",
  "P L A Y": "播放",
  "PLAY NOW": "立即播放",
  "Popular this month": "本月热门",
  Pasta: "意面",
  Pay: "支付",
  "Powered By": "技术支持",
  "Press me": "点击我",
  Pressure: "气压",
  "Real Feel": "体感温度",
  Register: "注册",
  Send: "发送",
  "Shop now": "立即购买",
  SPACE: "空格",
  "STATUS: IDLE [0x4F]": "状态：待机",
  "SYNCH: PENDING": "同步：等待中",
  "SYSTEM ACTIVATED": "系统已激活",
  "SYSTEM DEACTIVATED": "系统已停用",
  Save: "保存",
  "Spaguetti Bolognese": "肉酱意面",
  to: "到",
  top: "顶部",
  T: "钮",
  Twitter: "推特",
  U: "钮",
  "UIVERSE (3D UI)": "界面宇宙（三维界面）",
  "UI / EX Designer": "界面体验设计师",
  Uiverse: "界面库",
  "Unlock Pro": "解锁专业版",
  "View more": "查看更多",
  "QUANTUM VERIFY: 82.6%": "量子校验：82.6%",
  "universe of ui": "界面宇宙",
  "uiverse.io": "界面库",
  like: "喜欢",
  Wind: "风速",
  "look mom,": "看这里，",
  "mouse hover tracker": "鼠标悬停追踪",
  "no JS": "不用脚本",
  "now!": "现在！",
  play: "播放",
  "|{f[4": "动效",
  "&nbsp;uiverse&nbsp;": "&nbsp;界面&nbsp;"
};
const LOCALIZED_ATTRIBUTES = ["aria-label", "alt", "data-label", "data-text", "title"];
function localizedSample(value) {
  return SAMPLE_TEXT[value.trim()] ?? value;
}
function localizeWorkEasyHtml(html) {
  let localized = html.replace(/>([^<>]*[A-Za-z][^<>]*)</g, (_match, text) => {
    const leading = text.match(/^\s*/)?.[0] ?? "";
    const trailing = text.match(/\s*$/)?.[0] ?? "";
    const core = text.slice(leading.length, text.length - trailing.length);
    const translated = SAMPLE_TEXT[core.trim()] ?? core;
    return `>${leading}${translated}${trailing}<`;
  });
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    localized = localized.replace(
      new RegExp(`\\b${attribute}="([^"]*[A-Za-z][^"]*)"`, "g"),
      (_match, value) => {
        return `${attribute}="${localizedSample(value)}"`;
      }
    );
  }
  return localized;
}
function localizeWorkEasyCss(css) {
  return css.replace(/content:\s*(["'])(.*?)\1/g, (_match, quote, value) => {
    return `content: ${quote}${localizedSample(value)}${quote}`;
  });
}
function skip(input, issue, message) {
  return {
    ok: false,
    skip: { id: input.record.id, category: input.category, issue, message }
  };
}
function categoryToMotionCategory(category) {
  if (category === "cards") return "layout";
  if (category === "checkboxes") return "interaction";
  return "interaction";
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function buildHtml(title, htmlContent) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    ${htmlContent}
  </body>
</html>`;
}
function convertWorkEasyComponent(input) {
  const { category, record } = input;
  if (record.type !== "html" || record.framework && record.framework !== "vanilla") {
    return skip(input, "unsupported-type", "Only vanilla HTML/CSS components are supported in phase 1.");
  }
  if (!record.htmlContent?.trim()) {
    return skip(input, "missing-html", "WorkEasy component is missing htmlContent.");
  }
  if (!record.cssContent?.trim()) {
    return skip(input, "missing-css", "WorkEasy component is missing cssContent.");
  }
  const id = `workeasy-${category}-${record.id}`;
  const source = {
    id,
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: buildHtml(record.title, localizeWorkEasyHtml(record.htmlContent))
      },
      { path: "source/style.css", kind: "css", content: localizeWorkEasyCss(record.cssContent) }
    ]
  };
  const detected = scanSourceForParams(source);
  const validation = confirmValidParams({ source, params: detected });
  const capabilities = validation.confirmed.length > 0 ? ["builtin", "editable", "export-html"] : ["builtin", "export-html"];
  const manifest = {
    version: "1.0",
    id,
    name: record.title,
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: validation.confirmed,
    capabilities
  };
  return {
    ok: true,
    component: {
      id,
      name: record.title,
      category: categoryToMotionCategory(category),
      tags: [.../* @__PURE__ */ new Set([...record.tags, category, "workeasy"])],
      useCases: [category],
      moods: ["interactive"],
      source,
      manifest
    }
  };
}
export {
  analyzeComponentHealth,
  analyzeGenerationReadiness,
  analyzeLayerProfile,
  applyMotionRecipe,
  applyMotionRecipeToComponent,
  applyPatchToFiles,
  atomicMotionTokenSchema,
  buildControlledGenerationRequest,
  builtinMotionRecipes,
  canGenerateFromComponent,
  compileMotionSkillsFromRows,
  compilePlusPatch,
  compileSemanticPatch,
  composeEditablePackageFiles,
  composeStandaloneHtmlFile,
  confirmValidParams,
  conversionProtocols,
  convertWorkEasyComponent,
  createFallbackBriefIntent,
  createGeneratedComponentFromPatch,
  createGenerationPlan,
  createMotionRecipeCache,
  createMotionSkillDraftComponent,
  createReferenceGuidedComponent,
  createSearchProfile,
  createVideoMotionComponentDraft,
  derivePlusControls,
  describeParamConcepts,
  designSpecSkills,
  displayLabels,
  evaluateGeneratedComponent,
  extractMotionRecipeFromComponent,
  findCachedMotionRecipe,
  findDesignSpecSkill,
  generationFailureFallback,
  importMotionSourceFromFiles,
  inferDesignSpecBindings,
  isParsedBriefIntent,
  loadMotionComponentFromFiles,
  motionManifestSchema,
  motionRecipeCategories,
  motionRecipeParamKinds,
  motionRecipeRequestFromSemanticIntent,
  motionRecipeSchema,
  motionSkillLockSchema,
  motionSkillPackSchema,
  motionSkillRecipeFileSchema,
  motionSkillRecipeToMotionRecipe,
  motionSkillRegistrySchema,
  motionSkillTokenFileSchema,
  normalizeDesignerMotionRows,
  paramConceptIds,
  parseCssEasing,
  parseKeyframes,
  parseMilliseconds,
  parseSemanticGenerationIntent,
  parseSemanticIntentV2Fallback,
  parseSemanticIntentV2Payload,
  propertyFromAnimationType,
  recommendComponents,
  resolveMotionRecipe,
  resolveReferenceComponents,
  scanSourceForLayers,
  scanSourceForParams,
  semanticIntentV2Compositions,
  semanticIntentV2LayerRoles,
  semanticIntentV2MotionCategories,
  semanticIntentV2MotionTypes,
  semanticIntentV2TargetKinds,
  semanticIntentV2ToLegacyIntent,
  slugMotionId,
  suggestParams,
  validateGeneratedComponent,
  validateGenerationDiff,
  validateMotionRecipe,
  validateRecipeApplication
};
