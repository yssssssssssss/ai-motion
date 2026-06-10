import { applyMotionRecipe } from "../generation/motionRecipe";
import type { MotionComponent, SourceFile } from "../library/componentLibrary";
import type {
  MotionLayer,
  MotionParam,
  MotionSkillTargetBinding,
  MotionSkillTokenBinding
} from "../manifest/types";
import type { AtomicMotionToken, MotionSkillPack, MotionSkillRecipe, MotionSkillRegistry } from "./types";
import {
  motionSkillKeyframeParamIds,
  motionSkillParamId,
  motionSkillRecipeToMotionRecipe
} from "./recipeAdapter";

const EMPTY_IMAGE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
const DEFAULT_STAGE_SIZE = {
  stageWidth: 430,
  stageHeight: 932,
  backgroundLayerWidth: 500,
  backgroundLayerHeight: 1060
};
const DEFAULT_FOREGROUND_LAYER_SIZE = {
  width: 280,
  height: 180
};
const POPUP_FEEDBACK_FOREGROUND_LAYER_SIZES: Record<string, typeof DEFAULT_FOREGROUND_LAYER_SIZE> = {
  large: { width: 380, height: 420 },
  medium: { width: 330, height: 300 },
  small: DEFAULT_FOREGROUND_LAYER_SIZE
};

function cssVariableTarget(name: string) {
  return { kind: "css-variable" as const, file: "source/style.css", selector: ".motion-skill-stage", name };
}

function cssVarName(token: AtomicMotionToken, suffix: string): string {
  return `--${token.family}-${token.variant}-${token.property}-${suffix}`;
}

function keyframeName(token: AtomicMotionToken): string {
  return `${token.family}-${token.variant}-${token.property}`;
}

function percentage(index: number, length: number): number {
  if (length <= 1) return 100;
  return Math.round((index / (length - 1)) * 100);
}

function cssVarValue(token: AtomicMotionToken, suffix: string, fallback: number, unit = ""): string {
  return `var(${cssVarName(token, suffix)}, ${fallback}${unit})`;
}

function objectKeyframeBody(
  token: AtomicMotionToken,
  frame: { x?: number; y?: number; width?: number; height?: number },
  index: number
): string {
  if (token.property === "size") {
    return [
      typeof frame.width === "number"
        ? `width: ${cssVarValue(token, `keyframe-${index}-width`, frame.width, "px")};`
        : "",
      typeof frame.height === "number"
        ? `height: ${cssVarValue(token, `keyframe-${index}-height`, frame.height, "px")};`
        : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (token.property === "position") {
    return [
      typeof frame.x === "number"
        ? `left: ${cssVarValue(token, `keyframe-${index}-x`, frame.x, "px")};`
        : "",
      typeof frame.y === "number"
        ? `top: ${cssVarValue(token, `keyframe-${index}-y`, frame.y, "px")};`
        : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function tokenKeyframes(token: AtomicMotionToken): string {
  if (!Array.isArray(token.keyframes)) return "";
  if (!token.keyframes.every((item) => typeof item === "number")) {
    const frames = token.keyframes
      .map((frame, index) => {
        const body = objectKeyframeBody(token, frame, index);
        return body ? `  ${percentage(index, token.keyframes.length)}% { ${body} }` : "";
      })
      .filter(Boolean)
      .join("\n");
    return frames ? `@keyframes ${keyframeName(token)} {\n${frames}\n}` : "";
  }

  const numericKeyframes = token.keyframes as number[];
  const frames = numericKeyframes
    .map((_, index) => {
      const frameValue = numericKeyframes[index] ?? 0;
      const value = cssVarValue(token, `keyframe-${index}`, frameValue);
      const body =
        token.property === "opacity"
          ? `opacity: ${value};`
          : token.property === "scale"
            ? `transform: scale(${value});`
            : token.property === "roundness"
              ? `border-radius: ${cssVarValue(token, `keyframe-${index}`, frameValue, "px")};`
              : `left: ${cssVarValue(token, `keyframe-${index}`, frameValue, "px")};`;
      return `  ${percentage(index, numericKeyframes.length)}% { ${body} }`;
    })
    .join("\n");
  return `@keyframes ${keyframeName(token)} {\n${frames}\n}`;
}

function animationLine(token: AtomicMotionToken): string {
  return `${keyframeName(token)} var(${cssVarName(token, "duration")}, ${token.durationMs}ms) var(${cssVarName(token, "easing")}, ${token.easing}) var(${cssVarName(token, "delay")}, ${token.delayMs}ms) both`;
}

function tokenCss(tokens: AtomicMotionToken[]): string {
  return `${tokens.map(tokenKeyframes).filter(Boolean).join("\n\n")}

.is-playing [data-motion=foregroundLayer] {
  animation: ${tokens.map(animationLine).join(",\n    ")};
  will-change: transform, opacity, width, height, left, top, border-radius;
}`;
}

function targetBinding(): MotionSkillTargetBinding {
  return {
    layerId: "foregroundLayer",
    label: "前景层",
    role: "foreground",
    selector: "[data-motion=foregroundLayer]"
  };
}

function foregroundLayerSize(recipe: MotionSkillRecipe): typeof DEFAULT_FOREGROUND_LAYER_SIZE {
  if (recipe.family === "popup-feedback") {
    return POPUP_FEEDBACK_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  return DEFAULT_FOREGROUND_LAYER_SIZE;
}

function tokenBinding(token: AtomicMotionToken): MotionSkillTokenBinding {
  return {
    id: token.id,
    token: token.token,
    animationType: token.metadata.animationType,
    targetLayer: token.targetLayer,
    value: token.metadata.sourceValue,
    delay: token.metadata.sourceDelay,
    propertyChange: token.metadata.sourceChange,
    cssValue: token.metadata.sourceCssValue,
    property: token.property,
    durationParamId: motionSkillParamId(token, "duration"),
    delayParamId: motionSkillParamId(token, "delay"),
    easingParamId: motionSkillParamId(token, "easing"),
    keyframeParamIds: motionSkillKeyframeParamIds(token)
  };
}

function assetParams(): MotionParam[] {
  return [
    {
      id: "backgroundImage",
      label: "背景层",
      type: "image",
      default: "",
      status: "confirmed",
      constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=backgroundImage]",
          attribute: "src"
        }
      ]
    },
    {
      id: "foregroundImage",
      label: "前景层",
      type: "image",
      default: "",
      status: "confirmed",
      constraints: { allowedFileTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=foregroundImage]",
          attribute: "src"
        }
      ]
    },
    {
      id: "stageWidth",
      label: "页面宽度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.stageWidth,
      status: "confirmed",
      constraints: { min: 320, max: 520, step: 1, unit: "px" },
      targets: [cssVariableTarget("--stage-width")]
    },
    {
      id: "stageHeight",
      label: "页面高度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.stageHeight,
      status: "confirmed",
      constraints: { min: 700, max: 1200, step: 1, unit: "px" },
      targets: [cssVariableTarget("--stage-height")]
    },
    {
      id: "backgroundLayerWidth",
      label: "背景层宽度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.backgroundLayerWidth,
      status: "confirmed",
      constraints: { min: 360, max: 640, step: 1, unit: "px" },
      targets: [cssVariableTarget("--background-layer-width")]
    },
    {
      id: "backgroundLayerHeight",
      label: "背景层高度",
      type: "range",
      default: DEFAULT_STAGE_SIZE.backgroundLayerHeight,
      status: "confirmed",
      constraints: { min: 800, max: 1280, step: 1, unit: "px" },
      targets: [cssVariableTarget("--background-layer-height")]
    }
  ];
}

function assetLayers(): MotionLayer[] {
  return [
    {
      id: "backgroundLayer",
      label: "背景层",
      kind: "image",
      replaceable: true,
      required: false,
      paramId: "backgroundImage",
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=backgroundImage]",
          attribute: "src"
        }
      ]
    },
    {
      id: "foregroundLayer",
      label: "前景层",
      kind: "image",
      replaceable: true,
      required: true,
      paramId: "foregroundImage",
      targets: [
        {
          kind: "html-attribute",
          file: "source/index.html",
          selector: "[data-motion=foregroundImage]",
          attribute: "src"
        }
      ]
    }
  ];
}

function baseFiles(tokens: AtomicMotionToken[], recipe: MotionSkillRecipe): SourceFile[] {
  const foregroundSize = foregroundLayerSize(recipe);

  return [
    {
      path: "source/index.html",
      kind: "html",
      content: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="motion-skill-stage" data-motion-root>
      <section class="motion-skill-background" data-motion="backgroundLayer">
        <img class="motion-skill-layer-image" data-motion="backgroundImage" src="${EMPTY_IMAGE_SRC}" alt="" />
      </section>
      <section class="motion-skill-foreground" data-motion="foregroundLayer">
        <img class="motion-skill-layer-image" data-motion="foregroundImage" src="${EMPTY_IMAGE_SRC}" alt="" />
      </section>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`
    },
    {
      path: "source/style.css",
      kind: "css",
      content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f8f5ff;
}

.motion-skill-stage {
  --stage-width: ${DEFAULT_STAGE_SIZE.stageWidth}px;
  --stage-height: ${DEFAULT_STAGE_SIZE.stageHeight}px;
  --background-layer-width: ${DEFAULT_STAGE_SIZE.backgroundLayerWidth}px;
  --background-layer-height: ${DEFAULT_STAGE_SIZE.backgroundLayerHeight}px;
  --foreground-layer-width: ${foregroundSize.width}px;
  --foreground-layer-height: ${foregroundSize.height}px;
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: 82vw;
  max-height: 82vh;
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(135deg, #ffffff 0%, #f2e7ff 100%);
  box-shadow: 0 24px 90px rgba(79, 70, 229, 0.18);
}

.motion-skill-background,
.motion-skill-foreground {
  position: absolute;
}

.motion-skill-background {
  left: calc((100% - var(--background-layer-width)) / 2);
  top: calc((100% - var(--background-layer-height)) / 2);
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  background: #3f3f46;
}

.motion-skill-foreground {
  width: min(var(--foreground-layer-width), 88%);
  height: var(--foreground-layer-height);
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  border-radius: 24px;
  background: #e5e7eb;
  box-shadow: 0 24px 80px rgba(126, 34, 206, 0.22);
}

.motion-skill-layer-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  object-position: center;
  pointer-events: none;
}

.motion-skill-foreground .motion-skill-layer-image {
  border-radius: inherit;
}

${tokenCss(tokens)}`
    },
    { path: "source/script.js", kind: "js", content: "" }
  ];
}

export function createMotionSkillDraftComponent(input: {
  registry: MotionSkillRegistry;
  pack: MotionSkillPack;
  recipeId: string;
  now?: number;
}): MotionComponent {
  const recipe = input.pack.recipes.find((item) => item.id === input.recipeId);
  if (!recipe) throw new Error(`Unknown motion skill recipe: ${input.recipeId}`);

  const tokens = recipe.tokenIds.flatMap(
    (tokenId) => input.pack.tokens.find((token) => token.id === tokenId) ?? []
  );
  const motionRecipe = motionSkillRecipeToMotionRecipe({
    manifest: input.pack.manifest,
    recipe,
    tokens: input.pack.tokens
  });
  const applied = applyMotionRecipe({
    recipe: motionRecipe,
    params: assetParams(),
    layers: assetLayers(),
    sourceFiles: baseFiles(tokens, recipe),
    targetSelector: "[data-motion=foregroundLayer]",
    source: "model",
    confidence: 1
  });
  const id = `generated-${input.pack.manifest.id}-${recipe.variant}-${input.now ?? Date.now()}`;
  const registryElement = input.registry.elements.find((element) => element.id === input.pack.manifest.id);
  const target = targetBinding();

  return {
    id,
    name: `${recipe.sourceElement} / ${recipe.sourceVariant}`,
    category: "interaction",
    tags: ["generated", "atomic-motion", input.pack.manifest.id],
    useCases: ["atomic-motion"],
    moods: ["designer-motion"],
    source: {
      id,
      origin: "generated",
      kind: "builtin-component",
      entry: "source/index.html",
      files: applied.files ?? baseFiles(tokens, recipe)
    },
    manifest: {
      version: "1.0",
      id: `${id}-manifest`,
      name: `${recipe.sourceElement} / ${recipe.sourceVariant}`,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: applied.params,
      layers: applied.layers,
      motionRecipes: [applied.binding],
      designSpecs: [{ id: "interactive-control-motion-skill", confidence: 0.9, required: true }],
      capabilities: ["editable", "export-html"],
      motionSkill: {
        source: "designer-csv",
        element: registryElement?.label ?? recipe.sourceElement,
        variant: recipe.sourceVariant,
        family: input.pack.manifest.id,
        version: input.pack.manifest.version,
        recipeId: recipe.id,
        tokenIds: recipe.tokenIds,
        tokens: tokens.map(tokenBinding),
        target
      }
    }
  };
}
