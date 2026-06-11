import type { MotionComponent } from "../library/componentLibrary";
import { findDesignSpecSkill, type DesignSpecSkill } from "../library/designSpecs";
import { analyzeGenerationReadiness, inferDesignSpecBindings } from "../library/generationReadiness";
import type { MotionParam, MotionTarget } from "../manifest/types";
import { createFallbackBriefIntent, type ParsedBriefIntent } from "./briefIntent";
import { paramConceptIds, type ParamConceptId } from "./paramConcepts";
import { derivePlusControls } from "./plusControls";
import { recommendComponents } from "./recommend";

export type GenerationAllowedChangeSet = {
  paramIds: string[];
  layerIds: string[];
  sourceFiles: string[];
  sourceTargetKinds: MotionTarget["kind"][];
};

export type GenerationPlanCandidate = {
  componentId: string;
  score: number;
  reason: string;
  readinessStatus: ReturnType<typeof analyzeGenerationReadiness>["status"];
  specSkillIds: string[];
  specSkills: DesignSpecSkill[];
  plusControlIds: string[];
  allowed: GenerationAllowedChangeSet;
  paramConcepts: Array<{ paramId: string; concepts: ParamConceptId[] }>;
  blockers: string[];
};

export type GenerationAcceptanceRule = {
  id: string;
  label: string;
  description: string;
};

export type GenerationPlan = {
  intent: ParsedBriefIntent;
  candidates: GenerationPlanCandidate[];
  acceptanceRules: GenerationAcceptanceRule[];
  fallback: {
    action: "edit-candidates" | "select-component-first";
    reason: string;
  };
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function targetFile(target: MotionTarget): string | null {
  return "file" in target ? target.file : null;
}

function confirmedParams(component: MotionComponent): MotionParam[] {
  return component.manifest.params.filter((param) => param.status === "confirmed");
}

function sourceFilesForParams(params: MotionParam[]): string[] {
  return unique(
    params.flatMap((param) => param.targets.map(targetFile)).filter((file): file is string => Boolean(file))
  );
}

function targetKindsForParams(params: MotionParam[]): MotionTarget["kind"][] {
  return unique(params.flatMap((param) => param.targets.map((target) => target.kind)));
}

function readinessBoost(status: ReturnType<typeof analyzeGenerationReadiness>["status"]): number {
  if (status === "ready") return 24;
  if (status === "partial") return 8;
  return -18;
}

function plusCoverageScore(component: MotionComponent): number {
  const paramCount = Math.max(1, confirmedParams(component).length);
  const mapped = unique(
    derivePlusControls(component.manifest).flatMap((control) => control.mappedParamIds)
  ).length;
  return Math.round((mapped / paramCount) * 12 * 10) / 10;
}

function specMatchScore(intent: ParsedBriefIntent, component: MotionComponent): number {
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
  ]
    .join(" ")
    .toLowerCase();

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
  })
    ? 10
    : 0;
}

function candidateFromComponent(input: {
  component: MotionComponent;
  baseScore: number;
  reason: string;
  intent: ParsedBriefIntent;
}): GenerationPlanCandidate {
  const readiness = analyzeGenerationReadiness(input.component);
  const params = confirmedParams(input.component);
  const controls = derivePlusControls(input.component.manifest);
  const specBindings = inferDesignSpecBindings(input.component);
  const specSkills = specBindings
    .map((binding) => findDesignSpecSkill(binding.id))
    .filter((skill): skill is DesignSpecSkill => Boolean(skill));
  const allowedParamIds = readiness.allowedParamIds;
  const allowedLayerIds = readiness.replaceableLayerIds;
  const allowedSourceFiles = unique([
    ...sourceFilesForParams(params.filter((param) => allowedParamIds.includes(param.id))),
    ...readiness.layerProfile.layers
      .flatMap((layer) => layer.targets.map(targetFile))
      .filter((file): file is string => Boolean(file))
  ]);
  const blockers = readiness.checks.filter((check) => check.status !== "pass").map((check) => check.id);
  const score =
    input.baseScore +
    readinessBoost(readiness.status) +
    specMatchScore(input.intent, input.component) +
    plusCoverageScore(input.component);

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

const ACCEPTANCE_RULES: GenerationAcceptanceRule[] = [
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

export function createGenerationPlan(input: {
  brief?: string;
  intent?: ParsedBriefIntent;
  components: MotionComponent[];
  limit?: number;
}): GenerationPlan {
  const intent = input.intent ?? createFallbackBriefIntent(input.brief ?? "");
  const limit = input.limit ?? 3;
  const recommendations = recommendComponents({
    intent,
    components: input.components,
    limit: Math.max(6, input.components.length)
  });
  const recommendedById = new Map(recommendations.map((item) => [item.componentId, item]));
  const scored = input.components
    .map((component) => {
      const recommendation = recommendedById.get(component.id);
      return candidateFromComponent({
        component,
        baseScore: recommendation?.score ?? 0,
        reason: recommendation?.reason ?? "作为受控生成候选评估。",
        intent
      });
    })
    .filter((candidate) => candidate.readinessStatus !== "blocked")
    .filter((candidate) => candidate.allowed.paramIds.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return {
    intent,
    candidates: scored,
    acceptanceRules: ACCEPTANCE_RULES,
    fallback:
      scored.length > 0
        ? { action: "edit-candidates", reason: "生成失败时回到候选组件的参数和图层编辑流程" }
        : { action: "select-component-first", reason: "没有满足门禁的候选组件，需先补齐规范、图层或参数" }
  };
}
