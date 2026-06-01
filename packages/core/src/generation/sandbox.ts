import { motionManifestSchema } from "../manifest/schema";
import type { MotionComponent } from "../library/componentLibrary";
import { analyzeComponentHealth } from "../library/componentHealth";
import { analyzeGenerationReadiness } from "../library/generationReadiness";
import {
  validateGenerationDiff,
  type GenerationAllowedDiff,
  type ValidateGenerationDiffInput,
  type GenerationDiffViolation
} from "../orchestrator/generationDiff";

export type SandboxCheckStatus = "pass" | "fail";

export type SandboxCheck = {
  id: "schema-valid" | "source-whitelist" | "preview-playable" | "readiness-gate";
  status: SandboxCheckStatus;
  message: string;
};

export type GeneratedComponentValidationResult = {
  valid: boolean;
  checks: SandboxCheck[];
  diffViolations: GenerationDiffViolation[];
};

export type GeneratedComponentEvaluationItem = {
  id: "spec-compliance" | "loopable-motion" | "replaceable-layers" | "export-runnable";
  passed: boolean;
  message: string;
};

export type GeneratedComponentEvaluation = {
  passed: boolean;
  items: GeneratedComponentEvaluationItem[];
};

function sourceText(component: MotionComponent): string {
  return component.source.files.map((file) => file.content).join("\n");
}

function hasUnsafeSource(component: MotionComponent): boolean {
  return /\bfetch\s*\(|\bXMLHttpRequest\b|\bdocument\.cookie\b|\beval\s*\(|\bnew\s+Function\s*\(/i.test(
    sourceText(component)
  );
}

function check(id: SandboxCheck["id"], status: SandboxCheckStatus, message: string): SandboxCheck {
  return { id, status, message };
}

export function validateGeneratedComponent(input: {
  component: MotionComponent;
  allowed: GenerationAllowedDiff;
  beforeFiles?: ValidateGenerationDiffInput["beforeFiles"];
  afterFiles?: ValidateGenerationDiffInput["afterFiles"];
  patchValues?: ValidateGenerationDiffInput["patchValues"];
  layerReplacements?: ValidateGenerationDiffInput["layerReplacements"];
}): GeneratedComponentValidationResult {
  const schema = motionManifestSchema.safeParse(input.component.manifest);
  const diffInput: ValidateGenerationDiffInput = { allowed: input.allowed };
  if (input.beforeFiles) diffInput.beforeFiles = input.beforeFiles;
  if (input.afterFiles) diffInput.afterFiles = input.afterFiles;
  if (input.patchValues) diffInput.patchValues = input.patchValues;
  if (input.layerReplacements) diffInput.layerReplacements = input.layerReplacements;
  const diff = validateGenerationDiff(diffInput);
  const health = analyzeComponentHealth(input.component);
  const readiness = analyzeGenerationReadiness(input.component);
  const previewOk = health.checks.every((item) => item.id !== "renderable-source" || item.status === "pass");
  const checks: SandboxCheck[] = [
    schema.success
      ? check("schema-valid", "pass", "manifest schema 校验通过")
      : check("schema-valid", "fail", "manifest schema 校验失败"),
    diff.valid && !hasUnsafeSource(input.component)
      ? check("source-whitelist", "pass", "源码修改位于白名单内")
      : check("source-whitelist", "fail", "源码修改超出白名单或包含高风险调用"),
    previewOk
      ? check("preview-playable", "pass", "预览入口可渲染")
      : check("preview-playable", "fail", "预览入口不可渲染"),
    readiness.status !== "blocked"
      ? check("readiness-gate", "pass", "生成就绪度满足最低门禁")
      : check("readiness-gate", "fail", "生成就绪度未通过门禁")
  ];

  return {
    valid: checks.every((item) => item.status === "pass"),
    checks,
    diffViolations: diff.violations
  };
}

export function generationFailureFallback(result: GeneratedComponentValidationResult): {
  action: "edit-candidates";
  reason: string;
} {
  const failed = result.checks.find((item) => item.status === "fail");
  return {
    action: "edit-candidates",
    reason: failed?.message ?? "生成未通过门禁，返回候选组件参数编辑"
  };
}

export function evaluateGeneratedComponent(component: MotionComponent): GeneratedComponentEvaluation {
  const health = analyzeComponentHealth(component);
  const readiness = analyzeGenerationReadiness(component);
  const text = sourceText(component);
  const items: GeneratedComponentEvaluationItem[] = [
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
      passed:
        component.manifest.capabilities?.includes("export-html") === true &&
        health.checks.some((item) => item.id === "renderable-source" && item.status === "pass"),
      message: "检查导出能力和入口源码"
    }
  ];

  return {
    passed: items.every((item) => item.passed),
    items
  };
}
