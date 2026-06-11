import type { MotionComponent } from "../library/componentLibrary";
import type { MotionParam, MotionParamConstraints, MotionPatch } from "../manifest/types";
import { createGenerationPlan, type GenerationPlan, type GenerationPlanCandidate } from "../orchestrator/generationPlan";
import type { ParamConceptId } from "../orchestrator/paramConcepts";
import { applyPatchToFiles } from "../patch/applyPatch";
import { validateGeneratedComponent, type GeneratedComponentValidationResult } from "./sandbox";

export type ControlledGenerationPatch = {
  baseComponentId: string;
  paramValues: Record<string, unknown>;
  metadata: {
    name: string;
    tags: string[];
    generationBrief: string;
  };
};

type ControlledGenerationParamSummary = {
  id: string;
  label: string;
  type: MotionParam["type"];
  default: unknown;
  constraints?: MotionParamConstraints;
  concepts: ParamConceptId[];
};

export type ControlledGenerationRequest = {
  brief: string;
  plan: GenerationPlan;
  candidates: Array<{
    componentId: string;
    allowed: GenerationPlanCandidate["allowed"];
    skills: GenerationPlanCandidate["specSkills"];
    paramConcepts: GenerationPlanCandidate["paramConcepts"];
    params: ControlledGenerationParamSummary[];
  }>;
  outputContract: {
    allowedKeys: ["baseComponentId", "paramValues", "metadata"];
  };
};

export type GeneratedComponentFromPatch = {
  component: MotionComponent;
  patch: ControlledGenerationPatch;
  validation: GeneratedComponentValidationResult;
};

function numericDefault(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function clamp(value: number, constraints?: MotionParamConstraints): number {
  const minimum = constraints?.min ?? value;
  const maximum = constraints?.max ?? value;
  return Math.min(maximum, Math.max(minimum, value));
}

function shorterValue(param: ControlledGenerationParamSummary): number | null {
  const current = numericDefault(param.default);
  if (current === null) return null;
  const step = param.constraints?.step ?? (param.type === "duration" ? 50 : 1);
  const multiplier = param.type === "duration" ? 4 : 6;
  return clamp(current - step * multiplier, param.constraints);
}

function subtleVariantValue(param: ControlledGenerationParamSummary): number | null {
  const current = numericDefault(param.default);
  if (current === null) return null;
  const step = param.constraints?.step ?? (param.type === "duration" ? 50 : 1);
  const multiplier = param.type === "duration" ? 2 : 4;
  return clamp(current - step * multiplier, param.constraints);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function paramSummaries(component: MotionComponent, candidate: GenerationPlanCandidate): ControlledGenerationParamSummary[] {
  const conceptsByParam = new Map(candidate.paramConcepts.map((item) => [item.paramId, item.concepts]));
  return component.manifest.params
    .filter((param) => candidate.allowed.paramIds.includes(param.id))
    .map((param) => {
      const summary: ControlledGenerationParamSummary = {
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

function wantsShorterMotion(brief: string): boolean {
  return /短|快|紧凑|收敛|short|fast|faster|compact/i.test(brief);
}

function shouldShortenParam(param: ControlledGenerationParamSummary): boolean {
  return param.concepts.some((concept) => concept === "speed" || concept === "rhythm" || concept === "trajectory");
}

function isTextParam(param: ControlledGenerationParamSummary): boolean {
  return param.type === "text";
}

function extractQuotedText(brief: string): string | null {
  const match = brief.match(/[「『“"]([^」』”"]{1,80})[」』”"]/);
  return match?.[1]?.trim() || null;
}

function extractLabeledText(brief: string): string | null {
  const match = brief.match(/(?:标题文案|标题|文案|文字|内容)\s*(?:是|为|:|：)\s*([^，。；;\n]{1,80})/);
  const value = match?.[1]?.trim().replace(/^["'「『“]+|["'」』”]+$/g, "");
  return value || null;
}

function extractTextValue(brief: string): string | null {
  return extractQuotedText(brief) ?? extractLabeledText(brief);
}

function shouldUseDefaultVariant(param: ControlledGenerationParamSummary): boolean {
  if (param.type === "text" || param.type === "image" || param.type === "color") return false;
  return param.concepts.some(
    (concept) => concept === "speed" || concept === "rhythm" || concept === "trajectory" || concept === "intensity"
  );
}

export function buildControlledGenerationRequest(input: {
  brief: string;
  components: MotionComponent[];
}): ControlledGenerationRequest {
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

export function compileSemanticPatch(request: ControlledGenerationRequest): ControlledGenerationPatch {
  const candidate = request.candidates[0];
  if (!candidate) throw new Error("没有可用于受控生成的候选组件");

  const paramValues: Record<string, unknown> = {};
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

function fileMap(component: MotionComponent): Record<string, string> {
  return Object.fromEntries(component.source.files.map((file) => [file.path, file.content]));
}

function patchedParams(component: MotionComponent, values: Record<string, unknown>): MotionParam[] {
  return component.manifest.params.map((param) => {
    if (!(param.id in values)) return param;
    return { ...param, value: values[param.id] };
  });
}

export function createGeneratedComponentFromPatch(input: {
  brief: string;
  baseComponent: MotionComponent;
  candidate: GenerationPlanCandidate;
  patch: ControlledGenerationPatch;
}): GeneratedComponentFromPatch {
  const motionPatch: MotionPatch = {
    id: `generated-patch-${Date.now()}`,
    sourceManifestId: input.baseComponent.manifest.id,
    values: input.patch.paramValues
  };
  const beforeFiles = fileMap(input.baseComponent);
  const afterFiles = applyPatchToFiles({
    files: beforeFiles,
    manifest: input.baseComponent.manifest,
    patch: motionPatch
  });
  const id = `generated-${input.baseComponent.id}-${Date.now()}`;
  const component: MotionComponent = {
    ...input.baseComponent,
    id,
    name: input.patch.metadata.name,
    tags: unique([...input.baseComponent.tags, ...input.patch.metadata.tags]),
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
      capabilities: unique([...(input.baseComponent.manifest.capabilities ?? []), "editable", "export-html"])
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
