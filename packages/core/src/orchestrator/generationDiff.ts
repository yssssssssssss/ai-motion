export type GenerationAllowedDiff = {
  paramIds: readonly string[];
  layerIds: readonly string[];
  sourceFiles: readonly string[];
  sourceTargetKinds?: readonly string[];
};

export type GenerationDiffViolationCode =
  | "param-not-whitelisted"
  | "layer-not-whitelisted"
  | "source-file-not-whitelisted";

export type GenerationDiffViolation = {
  code: GenerationDiffViolationCode;
  id: string;
  message: string;
};

export type ValidateGenerationDiffInput = {
  allowed: GenerationAllowedDiff;
  patchValues?: Record<string, unknown>;
  layerReplacements?: Record<string, unknown>;
  beforeFiles?: Record<string, string>;
  afterFiles?: Record<string, string>;
};

export type ValidateGenerationDiffResult = {
  valid: boolean;
  violations: GenerationDiffViolation[];
};

function changedFiles(beforeFiles: Record<string, string>, afterFiles: Record<string, string>): string[] {
  const paths = new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)]);
  return [...paths].filter((path) => beforeFiles[path] !== afterFiles[path]);
}

export function validateGenerationDiff(input: ValidateGenerationDiffInput): ValidateGenerationDiffResult {
  const allowedParams = new Set(input.allowed.paramIds);
  const allowedLayers = new Set(input.allowed.layerIds);
  const allowedFiles = new Set(input.allowed.sourceFiles);
  const violations: GenerationDiffViolation[] = [];

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
