import type { MotionRecipe } from "../generation/motionRecipe";

export type DesignerMotionRow = {
  element: string;
  motionPreview?: string | undefined;
  variant: string;
  variantPreview?: string | undefined;
  targetLayer: string;
  token: string;
  value: string;
  delay: string;
  animationType: string;
  propertyChange: string;
  cssValue: string;
  rowNumber: number;
};

export type AtomicMotionProperty = "scale" | "opacity" | "position" | "roundness" | "size" | "color";

export type ScalarKeyframe = number | { value: number; offsetMs?: number };

export type ObjectKeyframe = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  offsetMs?: number;
};

export type AtomicMotionToken = {
  id: string;
  family: string;
  sourceElement: string;
  variant: string;
  sourceVariant: string;
  targetRole: "modal" | "card" | "screen" | "container" | "unknown";
  targetLayer: string;
  token: string;
  property: AtomicMotionProperty;
  durationMs: number;
  delayMs: number;
  easing: string;
  keyframes: ScalarKeyframe[] | string[] | ObjectKeyframe[];
  metadata: {
    animationType: string;
    sourceChange: string;
    sourceValue: string;
    sourceDelay: string;
    sourceCssValue: string;
  };
};

export type MotionSkillRecipe = {
  id: string;
  name: string;
  family: string;
  sourceElement: string;
  variant: string;
  sourceVariant: string;
  targetRole: AtomicMotionToken["targetRole"];
  targetLayer: string;
  trigger: MotionRecipe["trigger"];
  tokenIds: string[];
};

export type MotionSkillElement = {
  id: string;
  label: string;
  latestVersion: string;
  active: boolean;
  variants: string[];
  packPath: string;
  status?: "active" | "incomplete" | undefined;
  reason?: string | undefined;
};

export type MotionSkillRegistry = {
  version: "1.0";
  elements: MotionSkillElement[];
};

export type MotionSkillManifest = {
  id: string;
  name: string;
  version: string;
  source: "designer-csv";
  variants: string[];
  defaultVariant: string;
  tokenFile: string;
  recipeFile: string;
  skillFile: string;
};

export type MotionSkillTokenFile = {
  tokens: AtomicMotionToken[];
};

export type MotionSkillRecipeFile = {
  recipes: MotionSkillRecipe[];
};

export type MotionSkillPack = {
  manifest: MotionSkillManifest;
  tokens: AtomicMotionToken[];
  recipes: MotionSkillRecipe[];
};
