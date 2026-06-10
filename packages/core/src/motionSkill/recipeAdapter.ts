import type { MotionRecipe, MotionRecipeCategory, MotionRecipeParam } from "../generation/motionRecipe";
import type { MotionTarget } from "../manifest/types";
import type { AtomicMotionToken, MotionSkillManifest, MotionSkillRecipe } from "./types";

function rootTarget(name: string): MotionTarget {
  return { kind: "css-variable", file: "source/style.css", selector: ":root", name };
}

function upperFirst(value: string): string {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : "";
}

function camelId(parts: string[]): string {
  const words = parts.flatMap((part) => part.split(/[^a-z0-9]+/i).filter(Boolean));
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : upperFirst(lower);
    })
    .join("");
}

function cssVarName(token: AtomicMotionToken, suffix: string): string {
  return `--${token.family}-${token.variant}-${token.property}-${suffix}`;
}

export function motionSkillParamId(token: AtomicMotionToken, suffix: string): string {
  return camelId([token.family, token.variant, token.property, suffix]);
}

type KeyframeParamDescriptor = {
  idSuffix: string;
  cssSuffix: string;
  labelSuffix: string;
  kind: MotionRecipeParam["kind"];
  default: number;
};

function keyframeParamDescriptors(token: AtomicMotionToken): KeyframeParamDescriptor[] {
  if (!Array.isArray(token.keyframes)) return [];

  if (token.keyframes.every((item) => typeof item === "number")) {
    return token.keyframes.map((value, index) => ({
      idSuffix: `keyframe${index}`,
      cssSuffix: `keyframe-${index}`,
      labelSuffix: `关键帧 ${index + 1}`,
      kind:
        token.property === "opacity"
          ? ("opacity" as const)
          : token.property === "scale"
            ? ("scale" as const)
            : ("distance" as const),
      default: value
    }));
  }

  return token.keyframes.flatMap((frame, index) => {
    const descriptors: KeyframeParamDescriptor[] = [];
    if (typeof frame.width === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-width`,
        cssSuffix: `keyframe-${index}-width`,
        labelSuffix: `关键帧 ${index + 1}宽度`,
        kind: "distance",
        default: frame.width
      });
    }
    if (typeof frame.height === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-height`,
        cssSuffix: `keyframe-${index}-height`,
        labelSuffix: `关键帧 ${index + 1}高度`,
        kind: "distance",
        default: frame.height
      });
    }
    if (typeof frame.x === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-x`,
        cssSuffix: `keyframe-${index}-x`,
        labelSuffix: `关键帧 ${index + 1}X`,
        kind: "distance",
        default: frame.x
      });
    }
    if (typeof frame.y === "number") {
      descriptors.push({
        idSuffix: `keyframe-${index}-y`,
        cssSuffix: `keyframe-${index}-y`,
        labelSuffix: `关键帧 ${index + 1}Y`,
        kind: "distance",
        default: frame.y
      });
    }
    return descriptors;
  });
}

export function motionSkillKeyframeParamIds(token: AtomicMotionToken): string[] {
  return keyframeParamDescriptors(token).map((descriptor) =>
    motionSkillParamId(token, descriptor.idSuffix)
  );
}

function categoryFor(recipe: MotionSkillRecipe): MotionRecipeCategory {
  return /popup|弹窗/i.test(`${recipe.family} ${recipe.sourceElement}`) ? "feedback" : "entrance";
}

function tokenParams(token: AtomicMotionToken): MotionRecipeParam[] {
  const baseLabel = `${token.sourceVariant} ${token.metadata.animationType}`;
  const params: MotionRecipeParam[] = [
    {
      id: motionSkillParamId(token, "duration"),
      label: `${baseLabel}时长`,
      kind: "duration",
      default: token.durationMs,
      target: rootTarget(cssVarName(token, "duration"))
    },
    {
      id: motionSkillParamId(token, "delay"),
      label: `${baseLabel}延迟`,
      kind: "delay",
      default: token.delayMs,
      target: rootTarget(cssVarName(token, "delay"))
    },
    {
      id: motionSkillParamId(token, "easing"),
      label: `${baseLabel}曲线`,
      kind: "easing",
      default: token.easing,
      target: rootTarget(cssVarName(token, "easing"))
    }
  ];

  params.push(
    ...keyframeParamDescriptors(token).map((descriptor) => ({
      id: motionSkillParamId(token, descriptor.idSuffix),
      label: `${baseLabel}${descriptor.labelSuffix}`,
      kind: descriptor.kind,
      default: descriptor.default,
      target: rootTarget(cssVarName(token, descriptor.cssSuffix))
    }))
  );

  return params;
}

export function motionSkillRecipeToMotionRecipe(input: {
  manifest: MotionSkillManifest;
  recipe: MotionSkillRecipe;
  tokens: AtomicMotionToken[];
}): MotionRecipe {
  const tokens = input.recipe.tokenIds.flatMap(
    (tokenId) => input.tokens.find((token) => token.id === tokenId) ?? []
  );
  const selector = "[data-motion=foregroundLayer]";
  const keyframes = tokens.map((token) => `${token.family}-${token.variant}-${token.property}`);
  const params = tokens.flatMap(tokenParams);

  return {
    id: input.recipe.id,
    name: `${input.manifest.name} / ${input.recipe.sourceVariant}`,
    category: categoryFor(input.recipe),
    trigger: input.recipe.trigger,
    timeline: {
      keyframes,
      durationParamId: tokens[0] ? motionSkillParamId(tokens[0], "duration") : "motionDuration",
      easingParamId: tokens[0] ? motionSkillParamId(tokens[0], "easing") : "motionEasing",
      loop: input.recipe.trigger === "loop"
    },
    targets: [
      {
        id: "foregroundLayer",
        role: "foreground",
        required: true,
        replaceable: true,
        selector,
        acceptedKinds: ["image", "structure"]
      }
    ],
    params,
    bindings: {
      cssVariables: params.flatMap((param) =>
        param.target?.kind === "css-variable" ? [param.target.name] : []
      ),
      keyframes,
      selectors: [selector],
      replay: true
    },
    constraints: { requiresReplaceableTargets: true },
    source: "model"
  };
}
