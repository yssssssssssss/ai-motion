// 公共 API 入口：仅暴露被外部消费方使用的类型与函数。
// 内部子模块的其他导出请通过具体子路径访问（如有需要）。
// 修改对外契约时请同步更新本文件 + 调用方。

// ---- manifest ----
export type {
  SourceKind,
  MotionRuntime,
  RuntimeDependency,
  MotionParamType,
  MotionParamStatus,
  MotionParamConstraints,
  MotionTarget,
  MotionParamUI,
  MotionParam,
  MotionParamGroup,
  MotionDesignSpecBinding,
  MotionLayerKind,
  MotionLayer,
  MotionPatch,
  MotionPreset,
  MotionCapability,
  MotionManifest
} from "./manifest/types";
export { motionManifestSchema } from "./manifest/schema";

// ---- library / source ----
export type {
  SourceFile,
  MotionSource,
  MotionComponentMetadata,
  MotionComponent
} from "./library/componentLibrary";
export { loadMotionComponentFromFiles } from "./library/componentLibrary";
export type {
  ComponentHealthCheck,
  ComponentHealthReport,
  ComponentHealthStatus
} from "./library/componentHealth";
export { analyzeComponentHealth } from "./library/componentHealth";
export type {
  DesignSpecBinding,
  GenerationLayer,
  GenerationLayerKind,
  GenerationLayerProfile,
  GenerationGateResult,
  GenerationReadinessCheck,
  GenerationReadinessReport,
  GenerationReadinessStatus
} from "./library/generationReadiness";
export {
  analyzeGenerationReadiness,
  analyzeLayerProfile,
  canGenerateFromComponent,
  inferDesignSpecBindings
} from "./library/generationReadiness";
export type { DesignSpecSkill } from "./library/designSpecs";
export { designSpecSkills, findDesignSpecSkill } from "./library/designSpecs";

// ---- patch ----
export { applyPatchToFiles } from "./patch/applyPatch";

// ---- orchestrator ----
export type { ParsedBriefIntent, BriefParseResult } from "./orchestrator/briefIntent";
export { createFallbackBriefIntent, isParsedBriefIntent } from "./orchestrator/briefIntent";
export { displayLabels } from "./orchestrator/displayLabels";
export type { Recommendation } from "./orchestrator/recommend";
export { recommendComponents } from "./orchestrator/recommend";
export type { SearchProfile } from "./orchestrator/searchProfile";
export { createSearchProfile } from "./orchestrator/searchProfile";
export type { ColorFacet } from "./orchestrator/colorAnalysis";
export type {
  CompilePlusPatchInput,
  CompilePlusPatchResult,
  PlusControl,
  PlusControlKind,
  PlusControlOption,
  PlusControlValue,
  PlusPatchValues
} from "./orchestrator/plusControls";
export { compilePlusPatch, derivePlusControls } from "./orchestrator/plusControls";
export type { ParamConcept, ParamConceptId } from "./orchestrator/paramConcepts";
export { describeParamConcepts, paramConceptIds } from "./orchestrator/paramConcepts";
export type {
  GenerationAllowedChangeSet,
  GenerationAcceptanceRule,
  GenerationPlan,
  GenerationPlanCandidate
} from "./orchestrator/generationPlan";
export { createGenerationPlan } from "./orchestrator/generationPlan";
export type {
  GenerationAllowedDiff,
  GenerationDiffViolation,
  GenerationDiffViolationCode,
  ValidateGenerationDiffInput,
  ValidateGenerationDiffResult
} from "./orchestrator/generationDiff";
export { validateGenerationDiff } from "./orchestrator/generationDiff";
export type { ConversionProtocol, ConversionSourceKind } from "./generation/conversionProtocols";
export { conversionProtocols } from "./generation/conversionProtocols";
export type {
  GeneratedComponentEvaluation,
  GeneratedComponentEvaluationItem,
  GeneratedComponentValidationResult,
  SandboxCheck,
  SandboxCheckStatus
} from "./generation/sandbox";
export {
  evaluateGeneratedComponent,
  generationFailureFallback,
  validateGeneratedComponent
} from "./generation/sandbox";

// ---- import / analyze / export ----
export type { ImportWarning, ImportResult } from "./import/sourceImporter";
export { importMotionSourceFromFiles } from "./import/sourceImporter";
export { scanSourceForParams } from "./analyze/ruleScanner";
export { scanSourceForLayers } from "./analyze/layerScanner";
export { suggestParams } from "./analyze/paramAdvisor";
export { confirmValidParams } from "./analyze/validator";
export { composeEditablePackageFiles, composeStandaloneHtmlFile } from "./export/exportPackage";

// ---- video conversion ----
export type {
  VideoConversionStatus,
  UploadedVideoInput,
  VideoMotionDirection,
  VideoMotionHints,
  VideoConversionJob,
  MotionPlan,
  VerificationCheck,
  VerificationReport,
  VideoMotionComponentDraft
} from "./video/types";
export { createVideoMotionComponentDraft } from "./video/createVideoMotionComponentDraft";

// ---- adapters/workeasy ----
export type { WorkEasyCategory, WorkEasyComponentRecord, WorkEasySkip } from "./adapters/workeasy/types";
export { convertWorkEasyComponent } from "./adapters/workeasy/convert";
