import { describe, expect, it } from "vitest";
import { createMotionSkillDraftComponent } from "../src/motionSkill/mockComponent";
import type { MotionComponent, MotionSkillPack, MotionSkillRegistry } from "../src";
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

function visibleTokenParamCount(component: MotionComponent): number {
  return (component.manifest.motionSkill?.tokens ?? []).reduce(
    (count, token) =>
      count +
      [token.durationParamId, token.delayParamId, token.easingParamId, ...token.keyframeParamIds].filter(Boolean)
        .length,
    0
  );
}

function uploadParamIds(component: MotionComponent): string[] {
  const uploadTypes = new Set(["image", "text"]);
  const paramsById = new Map(component.manifest.params.map((param) => [param.id, param]));
  return [
    ...new Set(
      (component.manifest.layers ?? []).flatMap((layer) => {
        if (!layer.paramId) return [];
        const param = paramsById.get(layer.paramId);
        return param && uploadTypes.has(param.type) ? [param.id] : [];
      })
    )
  ];
}

function sizeParamIds(component: MotionComponent): string[] {
  const ids = new Set([
    "stageWidth",
    "stageHeight",
    "backgroundLayerWidth",
    "backgroundLayerHeight",
    "foregroundLayerWidth",
    "foregroundLayerHeight"
  ]);
  return component.manifest.params.flatMap((param) => (ids.has(param.id) ? [param.id] : []));
}

describe("motion skill inventory", () => {
  it("documents parameter and layer surfaces for every generated atomic component", () => {
    expect(
      generatedAtomicComponents().map((component) => ({
        name: component.name,
        tokenParamCount: visibleTokenParamCount(component),
        uploadParamIds: uploadParamIds(component),
        sizeParamIds: sizeParamIds(component)
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "name": "弹窗反馈 / 大型尺寸",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "弹窗反馈 / 中型尺寸",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "弹窗反馈 / 小型尺寸",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "弹窗关闭 / all",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 5,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "容器变换 / 商卡",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 19,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "前后进场 / 二级页跳转",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 3,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "前后进场 / 半弹层",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 8,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "前后进场 / 动作面板",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 3,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "前后进场 / 滑动操作",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 2,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "横向切换 / Tab导航",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 9,
          "uploadParamIds": [],
        },
        {
          "name": "横向切换 / 频道Tab",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 14,
          "uploadParamIds": [
            "channelTabIcon1",
            "channelTabIcon2",
            "channelTabIcon3",
            "channelTabIcon4",
            "channelTabIcon5",
            "channelTabIcon6",
          ],
        },
        {
          "name": "横向切换 / Tabbar底导",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 0,
          "uploadParamIds": [],
        },
        {
          "name": "横向切换 / 开关",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 5,
          "uploadParamIds": [
            "foregroundImage",
          ],
        },
        {
          "name": "横向切换 / 指示器",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 5,
          "uploadParamIds": [],
        },
        {
          "name": "横向切换 / 分段",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 8,
          "uploadParamIds": [],
        },
        {
          "name": "内容反馈 / 大型尺寸（高度<360）",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "内容反馈 / 中型尺寸（200<高度<360）",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "内容反馈 / 小型尺寸(吐司)（高度<200）",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 6,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "内容反馈 / 气泡",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 5,
          "uploadParamIds": [
            "backgroundImage",
            "foregroundImage",
          ],
        },
        {
          "name": "内容反馈 / 单选/多选",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [],
        },
        {
          "name": "内容加载 / 全局",
          "sizeParamIds": [
            "foregroundLayerWidth",
            "foregroundLayerHeight",
            "stageWidth",
            "stageHeight",
            "backgroundLayerWidth",
            "backgroundLayerHeight",
          ],
          "tokenParamCount": 11,
          "uploadParamIds": [],
        },
      ]
    `);
  });
});
