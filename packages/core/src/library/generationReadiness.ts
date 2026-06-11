import type { MotionComponent } from "./componentLibrary";
import type { ComponentHealthStatus } from "./componentHealth";
import type { MotionLayer, MotionParam, MotionTarget } from "../manifest/types";
import { derivePlusControls } from "../orchestrator/plusControls";
import { designSpecSkills, findDesignSpecSkill } from "./designSpecs";

export type GenerationReadinessStatus = "ready" | "partial" | "blocked";

export type GenerationLayerKind = "image" | "text" | "structure";

export type GenerationLayer = {
  id: string;
  label: string;
  kind: GenerationLayerKind;
  source: "param" | "source";
  paramId: string | null;
  sourceFile: string | null;
  replaceable: boolean;
  targets: MotionTarget[];
};

export type GenerationLayerProfile = {
  layers: GenerationLayer[];
  replaceableCount: number;
};

export type DesignSpecBinding = {
  id: string;
  label: string;
  confidence: number;
  matchedTerms: string[];
};

export type GenerationReadinessCheck = {
  id: string;
  label: string;
  status: ComponentHealthStatus;
  message: string;
};

export type GenerationReadinessReport = {
  status: GenerationReadinessStatus;
  score: number;
  checks: GenerationReadinessCheck[];
  allowedParamIds: string[];
  replaceableLayerIds: string[];
  plusControlCount: number;
  specBindings: DesignSpecBinding[];
  layerProfile: GenerationLayerProfile;
};

export type GenerationGateResult = {
  allowed: boolean;
  blockers: GenerationReadinessCheck[];
  report: GenerationReadinessReport;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function textForComponent(component: MotionComponent): string {
  return [
    component.id,
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    component.manifest.id,
    component.manifest.name
  ]
    .join(" ")
    .toLowerCase();
}

function confirmedParams(component: MotionComponent): MotionParam[] {
  return component.manifest.params.filter((param) => param.status === "confirmed");
}

function layerKindFromParam(param: MotionParam): GenerationLayerKind | null {
  if (param.type === "image") return "image";
  if (param.type === "text") return "text";
  return null;
}

function layerKindFromId(id: string): GenerationLayerKind {
  if (/(headline|title|text|copy|label)/i.test(id)) return "text";
  if (/(image|poster|frame|screen|card|face|media|popup|shell|content)/i.test(id)) return "image";
  return "structure";
}

function labelFromId(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function layerFromParam(param: MotionParam): GenerationLayer | null {
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

function targetFile(target: MotionTarget | undefined): string | null {
  return target && "file" in target ? target.file : null;
}

function layerFromManifest(layer: MotionLayer): GenerationLayer {
  return {
    id: layer.id,
    label: layer.label,
    kind: layer.kind,
    source: "source",
    paramId: layer.paramId ?? null,
    sourceFile: targetFile(layer.targets[0]),
    replaceable: layer.replaceable,
    targets: layer.targets
  };
}

function sourceText(component: MotionComponent, kind: "html" | "css"): string {
  return component.source.files
    .filter((file) => file.kind === kind)
    .map((file) => file.content)
    .join("\n");
}

function isLayerToken(token: string): boolean {
  if (token.length < 3 || token.length > 48) return false;
  if (/^(is-playing|active|hidden|visible|root|main)$/i.test(token)) return false;
  return /(layer|frame|card|screen|poster|image|media|popup|modal|shell|stage|face|content|headline|title)/i.test(
    token
  );
}

function collectHtmlClassLayers(component: MotionComponent): GenerationLayer[] {
  const html = sourceText(component, "html");
  const sourceFile = component.source.files.find((file) => file.kind === "html")?.path ?? null;
  const ids: string[] = [];

  for (const match of html.matchAll(/class=["']([^"']+)["']/g)) {
    const classList = match[1];
    if (!classList) continue;
    ids.push(...classList.split(/\s+/).filter(isLayerToken));
  }

  return unique(ids).map((id) => ({
    id,
    label: labelFromId(id),
    kind: layerKindFromId(id),
    source: "source" as const,
    paramId: null,
    sourceFile,
    replaceable: false,
    targets: []
  }));
}

function collectCssBackgroundLayers(component: MotionComponent): GenerationLayer[] {
  const css = sourceText(component, "css");
  const sourceFile = component.source.files.find((file) => file.kind === "css")?.path ?? null;
  const ids: string[] = [];

  for (const match of css.matchAll(/\.([A-Za-z_-][\w-]*)\s*{[^}]*background(?:-image)?:\s*var\(/g)) {
    const className = match[1];
    if (className && isLayerToken(className)) ids.push(className);
  }

  return unique(ids).map((id) => ({
    id,
    label: labelFromId(id),
    kind: layerKindFromId(id),
    source: "source" as const,
    paramId: null,
    sourceFile,
    replaceable: false,
    targets: []
  }));
}

export function analyzeLayerProfile(component: MotionComponent): GenerationLayerProfile {
  if (component.manifest.layers && component.manifest.layers.length > 0) {
    const layers = component.manifest.layers.map(layerFromManifest);
    return {
      layers,
      replaceableCount: layers.filter((layer) => layer.replaceable).length
    };
  }

  const layersById = new Map<string, GenerationLayer>();

  for (const param of confirmedParams(component)) {
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

export function inferDesignSpecBindings(component: MotionComponent): DesignSpecBinding[] {
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

function check(
  id: string,
  label: string,
  status: ComponentHealthStatus,
  message: string
): GenerationReadinessCheck {
  return { id, label, status, message };
}

function scoreChecks(checks: GenerationReadinessCheck[]): number {
  const points = checks.reduce((total, item) => {
    if (item.status === "pass") return total + 1;
    if (item.status === "warn") return total + 0.5;
    return total;
  }, 0);
  return Math.round((points / checks.length) * 100);
}

function statusFromReport(input: {
  score: number;
  checks: GenerationReadinessCheck[];
  replaceableLayerIds: string[];
  plusControlCount: number;
  specBindings: DesignSpecBinding[];
}): GenerationReadinessStatus {
  const gateFailed = input.checks.some(
    (item) => item.status === "fail" && ["bounded-params", "layer-inventory"].includes(item.id)
  );
  if (gateFailed || input.score < 60) return "blocked";

  if (input.replaceableLayerIds.length > 0 && input.plusControlCount > 0 && input.specBindings.length > 0) {
    return "ready";
  }

  return "partial";
}

export function analyzeGenerationReadiness(component: MotionComponent): GenerationReadinessReport {
  const allowedParamIds = confirmedParams(component).map((param) => param.id);
  const layerProfile = analyzeLayerProfile(component);
  const replaceableLayerIds = layerProfile.layers
    .filter((layer) => layer.replaceable)
    .map((layer) => layer.id);
  const plusControlCount = derivePlusControls(component.manifest).length;
  const specBindings = inferDesignSpecBindings(component);

  const checks: GenerationReadinessCheck[] = [
    allowedParamIds.length > 0
      ? check("bounded-params", "受控参数", "pass", `包含 ${allowedParamIds.length} 个已确认参数`)
      : check("bounded-params", "受控参数", "fail", "没有已确认参数，无法限制生成边界"),
    layerProfile.layers.length > 0
      ? check("layer-inventory", "图层画像", "pass", `识别到 ${layerProfile.layers.length} 个候选图层`)
      : check("layer-inventory", "图层画像", "fail", "未识别到可复用图层"),
    replaceableLayerIds.length > 0
      ? check("replaceable-layers", "可替换图层", "pass", `包含 ${replaceableLayerIds.length} 个可替换图层`)
      : layerProfile.layers.length > 0
        ? check("replaceable-layers", "可替换图层", "warn", "有结构图层，但未声明图片或文案替换位")
        : check("replaceable-layers", "可替换图层", "fail", "没有可替换图层"),
    plusControlCount > 0
      ? check("plus-controls", "Plus 控制", "pass", `可聚合为 ${plusControlCount} 个自然语言控制项`)
      : allowedParamIds.length > 0
        ? check("plus-controls", "Plus 控制", "warn", "参数存在，但暂不能聚合为 Plus 控制")
        : check("plus-controls", "Plus 控制", "fail", "没有可聚合参数"),
    specBindings.length > 0
      ? check("spec-binding", "规范 Skill", "pass", `匹配 ${specBindings.length} 条生成规范`)
      : check("spec-binding", "规范 Skill", "warn", "未匹配到明确规范，生成时需要人工选择")
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

export function canGenerateFromComponent(component: MotionComponent): GenerationGateResult {
  const report = analyzeGenerationReadiness(component);
  const blockers = report.checks.filter(
    (item) =>
      item.status === "fail" ||
      (item.status === "warn" && ["replaceable-layers", "spec-binding"].includes(item.id))
  );

  return {
    allowed: blockers.length === 0,
    blockers,
    report
  };
}
