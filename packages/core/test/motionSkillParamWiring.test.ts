import { describe, expect, it } from "vitest";
import { createMotionSkillDraftComponent } from "../src/motionSkill/mockComponent";
import type { MotionComponent, MotionParam, MotionSkillPack, MotionSkillRegistry, MotionTarget } from "../src";
import registry from "../../../motion-skills/registry.json";
import containerTransformManifest from "../../../motion-skills/container-transform/manifest.json";
import containerTransformRecipes from "../../../motion-skills/container-transform/recipes.json";
import containerTransformTokens from "../../../motion-skills/container-transform/tokens.json";
import contentFeedbackManifest from "../../../motion-skills/content-feedback/manifest.json";
import contentFeedbackRecipes from "../../../motion-skills/content-feedback/recipes.json";
import contentFeedbackTokens from "../../../motion-skills/content-feedback/tokens.json";
import contentLoadingManifest from "../../../motion-skills/content-loading/manifest.json";
import contentLoadingRecipes from "../../../motion-skills/content-loading/recipes.json";
import contentLoadingTokens from "../../../motion-skills/content-loading/tokens.json";
import frontBackEntryManifest from "../../../motion-skills/front-back-entry/manifest.json";
import frontBackEntryRecipes from "../../../motion-skills/front-back-entry/recipes.json";
import frontBackEntryTokens from "../../../motion-skills/front-back-entry/tokens.json";
import horizontalSwitchManifest from "../../../motion-skills/horizontal-switch/manifest.json";
import horizontalSwitchRecipes from "../../../motion-skills/horizontal-switch/recipes.json";
import horizontalSwitchTokens from "../../../motion-skills/horizontal-switch/tokens.json";
import popupCloseManifest from "../../../motion-skills/popup-close/manifest.json";
import popupCloseRecipes from "../../../motion-skills/popup-close/recipes.json";
import popupCloseTokens from "../../../motion-skills/popup-close/tokens.json";
import popupFeedbackManifest from "../../../motion-skills/popup-feedback/manifest.json";
import popupFeedbackRecipes from "../../../motion-skills/popup-feedback/recipes.json";
import popupFeedbackTokens from "../../../motion-skills/popup-feedback/tokens.json";

const motionSkillRegistry = registry as MotionSkillRegistry;

const packs: Record<string, MotionSkillPack> = {
  "container-transform": {
    manifest: containerTransformManifest,
    tokens: containerTransformTokens.tokens,
    recipes: containerTransformRecipes.recipes
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
  "popup-close": {
    manifest: popupCloseManifest,
    tokens: popupCloseTokens.tokens,
    recipes: popupCloseRecipes.recipes
  } as MotionSkillPack,
  "popup-feedback": {
    manifest: popupFeedbackManifest,
    tokens: popupFeedbackTokens.tokens,
    recipes: popupFeedbackRecipes.recipes
  } as MotionSkillPack
};

function sourceText(component: MotionComponent): string {
  return component.source.files.map((file) => file.content).join("\n");
}

function tokenParamIds(component: MotionComponent): string[] {
  return [
    ...new Set(
      (component.manifest.motionSkill?.tokens ?? []).flatMap((token) => [
        token.durationParamId,
        token.delayParamId,
        token.easingParamId,
        ...token.keyframeParamIds
      ])
    )
  ].filter(Boolean);
}

function cssVariableTarget(param: MotionParam): string | null {
  for (const target of param.targets) {
    if (target.kind === "css-variable") return target.name;
  }
  return null;
}

function variableIsConsumed(source: string, variableName: string): boolean {
  const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`var\\(\\s*${escaped}\\b`).test(source);
}

function selectorExists(source: string, selector: string): boolean {
  const dataMotion = selector.match(/^\[data-motion=([^\]]+)\]$/)?.[1];
  if (dataMotion) return source.includes(`data-motion="${dataMotion}"`);
  const className = selector.match(/^\.([a-z0-9_-]+)$/i)?.[1];
  if (className) return new RegExp(`class="[^"]*\\b${className}\\b`).test(source);
  return source.includes(selector);
}

function targetIsLive(source: string, target: MotionTarget): boolean {
  if (target.kind === "css-variable") {
    return source.includes(`${target.name}:`) || variableIsConsumed(source, target.name);
  }
  if (target.kind === "html-attribute" || target.kind === "svg-attribute" || target.kind === "html-text") {
    return selectorExists(source, target.selector);
  }
  if (target.kind === "css-property") {
    return source.includes(target.selector) && source.includes(`${target.property}:`);
  }
  return true;
}

function generatedAtomicComponents(): MotionComponent[] {
  return motionSkillRegistry.elements.flatMap((element) => {
    if (!element.active || element.status === "incomplete") return [];
    const pack = packs[element.id];
    if (!pack) return [];

    return pack.recipes.map((recipe) =>
      createMotionSkillDraftComponent({
        registry: motionSkillRegistry,
        pack,
        recipeId: recipe.id,
        now: 1717747200000
      })
    );
  });
}

function componentByName(name: string): MotionComponent {
  const component = generatedAtomicComponents().find((item) => item.name === name);
  if (!component) throw new Error(`Missing generated atomic component: ${name}`);
  return component;
}

describe("motion skill parameter wiring", () => {
  it("wires every atomic token parameter to a CSS variable consumed by the generated source", () => {
    const issues = generatedAtomicComponents().flatMap((component) => {
      const source = sourceText(component);
      const paramsById = new Map(component.manifest.params.map((param) => [param.id, param]));

      return tokenParamIds(component).flatMap((paramId) => {
        const param = paramsById.get(paramId);
        if (!param) return [`${component.name}: missing token param ${paramId}`];
        const variableName = cssVariableTarget(param);
        if (!variableName) return [`${component.name}: token param ${paramId} has no css-variable target`];
        if (!variableIsConsumed(source, variableName)) {
          return [`${component.name}: token param ${paramId} writes unused ${variableName}`];
        }
        return [];
      });
    });

    expect(issues).toEqual([]);
  });

  it("wires every atomic layer upload entry to a real generated layer target", () => {
    const issues = generatedAtomicComponents().flatMap((component) => {
      const source = sourceText(component);
      const paramsById = new Map(component.manifest.params.map((param) => [param.id, param]));

      return (component.manifest.layers ?? []).flatMap((layer) => {
        if (!layer.paramId) return [];
        const param = paramsById.get(layer.paramId);
        if (!param) return [`${component.name}: layer ${layer.id} points to missing param ${layer.paramId}`];
        if (param.type !== "image" && param.type !== "text") {
          return [`${component.name}: layer ${layer.id} points to non-upload param ${param.id}`];
        }
        if (param.targets.length === 0) return [`${component.name}: layer param ${param.id} has no targets`];
        return param.targets
          .filter((target) => !targetIsLive(source, target))
          .map((target) => `${component.name}: layer param ${param.id} has dead ${target.kind} target`);
      });
    });

    expect(issues).toEqual([]);
  });

  it("keeps only live token controls in the atomic parameter panel", () => {
    expect(componentByName("横向切换 / 分段").manifest.motionSkill?.tokens).toEqual([
      expect.objectContaining({
        id: "horizontal-switch.segmented.position",
        durationParamId: "horizontalSwitchSegmentedPositionDuration",
        delayParamId: "",
        easingParamId: "horizontalSwitchSegmentedPositionEasing",
        keyframeParamIds: [
          "horizontalSwitchSegmentedPositionKeyframe0",
          "horizontalSwitchSegmentedPositionKeyframe1"
        ]
      }),
      expect.objectContaining({
        id: "horizontal-switch.segmented.size",
        durationParamId: "",
        delayParamId: "",
        easingParamId: "",
        keyframeParamIds: [
          "horizontalSwitchSegmentedSizeKeyframe0Width",
          "horizontalSwitchSegmentedSizeKeyframe0Height",
          "horizontalSwitchSegmentedSizeKeyframe1Width",
          "horizontalSwitchSegmentedSizeKeyframe2Width"
        ]
      })
    ]);

    expect(componentByName("横向切换 / Tabbar底导").manifest.motionSkill?.tokens).toEqual([]);
    expect(componentByName("前后进场 / 滑动操作").manifest.motionSkill?.tokens).toEqual([
      expect.objectContaining({
        id: "front-back-entry.swipe-action.position-5",
        durationParamId: "frontBackEntrySwipeActionPosition5Duration",
        delayParamId: "",
        easingParamId: "frontBackEntrySwipeActionPosition5Easing",
        keyframeParamIds: []
      })
    ]);
  });
});
