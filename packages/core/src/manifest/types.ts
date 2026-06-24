export type SourceKind = "builtin-component" | "single-html" | "html-package" | "css-svg" | "component-lite";

export type MotionRuntime = {
  engine: "html";
  entry: string;
  sandbox: "iframe";
  dependencies?: RuntimeDependency[];
};

export type RuntimeDependency = {
  name: string;
  version?: string;
  url?: string;
};

export type MotionParamType =
  | "color"
  | "number"
  | "range"
  | "text"
  | "image"
  | "toggle"
  | "select"
  | "easing"
  | "duration"
  | "position"
  | "transform";

export type MotionParamStatus = "detected" | "suggested" | "confirmed" | "rejected";

export type MotionParamConstraints = {
  min?: number;
  max?: number;
  step?: number;
  unit?: "px" | "%" | "ms" | "s" | "deg" | "rem" | "em" | "vh" | "vw" | "vmin";
  options?: { label: string; value: string | number | boolean }[];
  allowedFileTypes?: string[];
  maxLength?: number;
};

export type MotionTarget =
  | { kind: "css-variable"; file: string; selector: string; name: string }
  | { kind: "css-property"; file: string; selector: string; property: string }
  | { kind: "html-text"; file: string; selector: string }
  | { kind: "html-attribute"; file: string; selector: string; attribute: string }
  | { kind: "svg-attribute"; file: string; selector: string; attribute: string }
  | { kind: "js-config"; file: string; path: string }
  | { kind: "component-prop"; component: string; prop: string };

export type MotionParamUI = {
  group?: string;
  order?: number;
  helperText?: string;
};

export type MotionParam = {
  id: string;
  label: string;
  description?: string;
  type: MotionParamType;
  default: unknown;
  value?: unknown;
  status: MotionParamStatus;
  confidence?: number;
  constraints?: MotionParamConstraints;
  targets: MotionTarget[];
  ui?: MotionParamUI;
};

export type MotionParamGroup = {
  id: string;
  label: string;
  params: string[];
};

export type MotionDesignSpecBinding = {
  id: string;
  confidence?: number;
  required?: boolean;
};

export type MotionTrigger = "load" | "hover" | "click" | "loop" | "swipe";

export type MotionRecipeBinding = {
  recipeId: string;
  recipeName?: string;
  category?: "entrance" | "feedback" | "transition" | "loop";
  targetLayerIds: string[];
  targetRoles?: string[];
  targetSelectors?: string[];
  paramIds: string[];
  trigger: MotionTrigger;
  source?: "builtin" | "extracted" | "model" | "fallback";
  confidence?: number;
};

export type MotionSkillTokenBinding = {
  id: string;
  token: string;
  animationType: string;
  targetLayer: string;
  value: string;
  delay: string;
  propertyChange: string;
  cssValue: string;
  property: string;
  durationParamId: string;
  delayParamId: string;
  easingParamId: string;
  keyframeParamIds: string[];
};

export type MotionSkillTargetBinding = {
  layerId: string;
  label: string;
  role: string;
  selector: string;
};

export type MotionSkillBinding = {
  source: "designer-csv";
  element: string;
  variant: string;
  family: string;
  version: string;
  recipeId: string;
  tokenIds: string[];
  tokens?: MotionSkillTokenBinding[];
  target?: MotionSkillTargetBinding;
};

export type MotionLayerKind = "image" | "text" | "structure";

export type MotionLayer = {
  id: string;
  label: string;
  kind: MotionLayerKind;
  replaceable: boolean;
  required?: boolean;
  paramId?: string;
  targets: MotionTarget[];
};

export type MotionPatch = {
  id: string;
  sourceManifestId: string;
  values: Record<string, unknown>;
};

export type MotionPreset = {
  id: string;
  name: string;
  patch: MotionPatch;
};

export type MotionCapability = "editable" | "export-html" | "imported" | "builtin";

export type MotionManifest = {
  version: "1.0";
  id: string;
  name: string;
  sourceKind: SourceKind;
  runtime: MotionRuntime;
  params: MotionParam[];
  groups?: MotionParamGroup[];
  designSpecs?: MotionDesignSpecBinding[];
  motionRecipes?: MotionRecipeBinding[];
  motionSkill?: MotionSkillBinding;
  layers?: MotionLayer[];
  presets?: MotionPreset[];
  capabilities?: MotionCapability[];
};
