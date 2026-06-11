import type { MotionSkillPack, MotionSkillRegistry } from "@motion-tool/core";
import registry from "../../../../motion-skills/registry.json";
import containerTransformManifest from "../../../../motion-skills/container-transform/manifest.json";
import containerTransformRecipes from "../../../../motion-skills/container-transform/recipes.json";
import containerTransformTokens from "../../../../motion-skills/container-transform/tokens.json";
import popupCloseManifest from "../../../../motion-skills/popup-close/manifest.json";
import popupCloseRecipes from "../../../../motion-skills/popup-close/recipes.json";
import popupCloseTokens from "../../../../motion-skills/popup-close/tokens.json";
import popupFeedbackManifest from "../../../../motion-skills/popup-feedback/manifest.json";
import popupFeedbackRecipes from "../../../../motion-skills/popup-feedback/recipes.json";
import popupFeedbackTokens from "../../../../motion-skills/popup-feedback/tokens.json";

export const motionSkillRegistry = registry as MotionSkillRegistry;

export const motionSkillPacks: Record<string, MotionSkillPack> = {
  "container-transform": {
    manifest: containerTransformManifest,
    tokens: containerTransformTokens.tokens,
    recipes: containerTransformRecipes.recipes
  } as MotionSkillPack,
  "popup-feedback": {
    manifest: popupFeedbackManifest,
    tokens: popupFeedbackTokens.tokens,
    recipes: popupFeedbackRecipes.recipes
  } as MotionSkillPack,
  "popup-close": {
    manifest: popupCloseManifest,
    tokens: popupCloseTokens.tokens,
    recipes: popupCloseRecipes.recipes
  } as MotionSkillPack
};
