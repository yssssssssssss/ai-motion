import type { MotionSkillPack, MotionSkillRegistry } from "@motion-tool/core";
import registry from "../../../../motion-skills/registry.json";
import containerTransformManifest from "../../../../motion-skills/container-transform/manifest.json";
import containerTransformRecipes from "../../../../motion-skills/container-transform/recipes.json";
import containerTransformTokens from "../../../../motion-skills/container-transform/tokens.json";
import closeManifest from "../../../../motion-skills/close/manifest.json";
import closeRecipes from "../../../../motion-skills/close/recipes.json";
import closeTokens from "../../../../motion-skills/close/tokens.json";
import contentFeedbackManifest from "../../../../motion-skills/content-feedback/manifest.json";
import contentFeedbackRecipes from "../../../../motion-skills/content-feedback/recipes.json";
import contentFeedbackTokens from "../../../../motion-skills/content-feedback/tokens.json";
import contentLoadingManifest from "../../../../motion-skills/content-loading/manifest.json";
import contentLoadingRecipes from "../../../../motion-skills/content-loading/recipes.json";
import contentLoadingTokens from "../../../../motion-skills/content-loading/tokens.json";
import frontBackEntryManifest from "../../../../motion-skills/front-back-entry/manifest.json";
import frontBackEntryRecipes from "../../../../motion-skills/front-back-entry/recipes.json";
import frontBackEntryTokens from "../../../../motion-skills/front-back-entry/tokens.json";
import horizontalSwitchManifest from "../../../../motion-skills/horizontal-switch/manifest.json";
import horizontalSwitchRecipes from "../../../../motion-skills/horizontal-switch/recipes.json";
import horizontalSwitchTokens from "../../../../motion-skills/horizontal-switch/tokens.json";
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
  "front-back-entry": {
    manifest: frontBackEntryManifest,
    tokens: frontBackEntryTokens.tokens,
    recipes: frontBackEntryRecipes.recipes
  } as MotionSkillPack,
  "horizontal-switch": {
    manifest: horizontalSwitchManifest,
    tokens: horizontalSwitchTokens.tokens,
    recipes: horizontalSwitchRecipes.recipes
  } as MotionSkillPack,
  "content-feedback": {
    manifest: contentFeedbackManifest,
    tokens: contentFeedbackTokens.tokens,
    recipes: contentFeedbackRecipes.recipes
  } as MotionSkillPack,
  "content-loading": {
    manifest: contentLoadingManifest,
    tokens: contentLoadingTokens.tokens,
    recipes: contentLoadingRecipes.recipes
  } as MotionSkillPack,
  close: {
    manifest: closeManifest,
    tokens: closeTokens.tokens,
    recipes: closeRecipes.recipes
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
