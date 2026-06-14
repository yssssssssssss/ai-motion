import { applyMotionRecipe } from "../generation/motionRecipe";
import type { MotionComponent, SourceFile } from "../library/componentLibrary";
import type {
  MotionLayer,
  MotionParam,
  MotionSkillTargetBinding,
  MotionSkillTokenBinding
} from "../manifest/types";
import type {
  AtomicMotionToken,
  ObjectKeyframe,
  MotionSkillPack,
  MotionSkillRecipe,
  MotionSkillRegistry,
  ScalarKeyframe
} from "./types";
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
const HORIZONTAL_SWITCH_STAGE_SIZES: Record<string, typeof DEFAULT_STAGE_SIZE> = {
  "tab-navigation": {
    stageWidth: 374,
    stageHeight: 60,
    backgroundLayerWidth: 374,
    backgroundLayerHeight: 60
  },
  tabbar: { stageWidth: 374, stageHeight: 140, backgroundLayerWidth: 374, backgroundLayerHeight: 140 },
  switch: { stageWidth: 120, stageHeight: 60, backgroundLayerWidth: 120, backgroundLayerHeight: 60 },
  indicator: { stageWidth: 120, stageHeight: 60, backgroundLayerWidth: 120, backgroundLayerHeight: 60 },
  segmented: { stageWidth: 120, stageHeight: 60, backgroundLayerWidth: 120, backgroundLayerHeight: 60 },
  "channel-tab": { stageWidth: 374, stageHeight: 74, backgroundLayerWidth: 374, backgroundLayerHeight: 74 }
};
const CONTAINER_TRANSFORM_STAGE_SIZE = {
  stageWidth: 374,
  stageHeight: 812,
  backgroundLayerWidth: 374,
  backgroundLayerHeight: 812
};
const CONTAINER_TRANSFORM_CARD_ANCHOR = {
  sourceX: 182,
  sourceY: 602,
  left: 8,
  bottom: 34
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

// 内容反馈各变体的前景层尺寸
const CONTENT_FEEDBACK_FOREGROUND_LAYER_SIZES: Record<string, typeof DEFAULT_FOREGROUND_LAYER_SIZE> = {
  large: { width: 380, height: 340 },
  medium: { width: 330, height: 260 },
  toast: { width: 280, height: 120 },
  bubble: { width: 200, height: 72 },
  selection: { width: 28, height: 28 }
};
const HORIZONTAL_SWITCH_FOREGROUND_LAYER_SIZES: Record<string, typeof DEFAULT_FOREGROUND_LAYER_SIZE> = {
  "tab-navigation": { width: 16, height: 2.5 },
  tabbar: { width: 65.4, height: 44 },
  switch: { width: 32, height: 40 },
  indicator: { width: 8, height: 4 },
  segmented: { width: 36, height: 20 },
  "channel-tab": { width: 62, height: 64 }
};

function stageSize(recipe: MotionSkillRecipe): typeof DEFAULT_STAGE_SIZE {
  if (recipe.family === "horizontal-switch") {
    return HORIZONTAL_SWITCH_STAGE_SIZES[recipe.variant] ?? DEFAULT_STAGE_SIZE;
  }
  if (recipe.family === "container-transform") return CONTAINER_TRANSFORM_STAGE_SIZE;
  return DEFAULT_STAGE_SIZE;
}

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

function keyframePercentage(index: number, length: number, durationMs: number, offsetMs?: number): string {
  if (typeof offsetMs === "number" && Number.isFinite(offsetMs) && durationMs > 0) {
    return `${Number(((offsetMs / durationMs) * 100).toFixed(3))}%`;
  }
  return `${percentage(index, length)}%`;
}

function cssVarValue(token: AtomicMotionToken, suffix: string, fallback: number, unit = ""): string {
  return `var(${cssVarName(token, suffix)}, ${fallback}${unit})`;
}

function colorVarValue(token: AtomicMotionToken, suffix: string, fallback: string): string {
  const activeFallback =
    token.family === "horizontal-switch" &&
    (token.variant === "tab-navigation" || token.variant === "indicator" || token.variant === "switch")
      ? `var(--motion-active-color, ${fallback})`
      : fallback;
  return `var(${cssVarName(token, suffix)}, ${activeFallback})`;
}

function isHorizontalSwitchPositionToken(token: AtomicMotionToken): boolean {
  return token.family === "horizontal-switch" && token.property === "position";
}

function horizontalSwitchOffsetPath(variant: string, step = 0): number[] {
  const positiveStep = Math.abs(step);
  if (variant === "tab-navigation") return [0, positiveStep, positiveStep * 2, positiveStep * 3];
  if (variant === "tabbar") return [0, positiveStep, positiveStep * 2, positiveStep * 3, positiveStep * 4];
  if (variant === "switch") return [0, positiveStep, 0];
  if (variant === "indicator") return [0, 15, 30];
  if (variant === "segmented") return [0, positiveStep, 0, positiveStep];
  return [];
}

function horizontalSwitchStep(token: AtomicMotionToken): number {
  if (!token.keyframes.every(isScalarKeyframe)) return 0;
  const [from, to] = token.keyframes.map(scalarValue);
  return typeof from === "number" && typeof to === "number" ? to - from : 0;
}

function horizontalSwitchSegmentCount(token: AtomicMotionToken): number {
  if (token.family !== "horizontal-switch") return 1;
  if (token.property === "position")
    return Math.max(1, horizontalSwitchOffsetPath(token.variant, horizontalSwitchStep(token)).length - 1);
  const path = horizontalSwitchOffsetPath(token.variant);
  return Math.max(1, path.length - 1);
}

function formatPercent(value: number): string {
  const rounded = Number(value.toFixed(3));
  return `${rounded}%`;
}

function repeatedDuration(value: string, count: number): string {
  if (count <= 1) return value;
  return `calc(${Array.from({ length: count }, () => value).join(" + ")})`;
}

function horizontalSwitchPositionKeyframes(token: AtomicMotionToken): string | null {
  const path = horizontalSwitchOffsetPath(token.variant, horizontalSwitchStep(token));
  if (path.length < 2) return null;

  const frames = path
    .map((offset, index) => {
      const percent = formatPercent((index / (path.length - 1)) * 100);
      return `  ${percent} { transform: translateX(${Number(offset.toFixed(3))}px); }`;
    })
    .join("\n");
  return `@keyframes ${keyframeName(token)} {\n${frames}\n}`;
}

function objectKeyframeBody(token: AtomicMotionToken, frame: ObjectKeyframe, index: number): string {
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
    if (token.family === "container-transform" && token.variant === "product-card") {
      return [
        typeof frame.x === "number"
          ? `left: calc(var(--container-transform-card-anchor-left, ${CONTAINER_TRANSFORM_CARD_ANCHOR.left}px) + (${cssVarValue(token, `keyframe-${index}-x`, frame.x, "px")} - ${CONTAINER_TRANSFORM_CARD_ANCHOR.sourceX}px));`
          : "",
        typeof frame.y === "number"
          ? `bottom: calc(var(--container-transform-card-anchor-bottom, ${CONTAINER_TRANSFORM_CARD_ANCHOR.bottom}px) - (${cssVarValue(token, `keyframe-${index}-y`, frame.y, "px")} - ${CONTAINER_TRANSFORM_CARD_ANCHOR.sourceY}px));`
          : ""
      ]
        .filter(Boolean)
        .join(" ");
    }

    return [
      typeof frame.x === "number" ? `left: ${cssVarValue(token, `keyframe-${index}-x`, frame.x, "px")};` : "",
      typeof frame.y === "number" ? `top: ${cssVarValue(token, `keyframe-${index}-y`, frame.y, "px")};` : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function isScalarKeyframe(value: unknown): value is ScalarKeyframe {
  return (
    typeof value === "number" ||
    (typeof value === "object" &&
      value !== null &&
      "value" in value &&
      typeof (value as { value?: unknown }).value === "number")
  );
}

function scalarValue(frame: ScalarKeyframe): number {
  return typeof frame === "number" ? frame : frame.value;
}

function scalarOffsetMs(frame: ScalarKeyframe): number | undefined {
  return typeof frame === "number" ? undefined : frame.offsetMs;
}

function horizontalSwitchObjectKeyframes(token: AtomicMotionToken): string | null {
  if (token.family !== "horizontal-switch" || token.property !== "size") return null;
  if (!Array.isArray(token.keyframes) || token.keyframes.every(isScalarKeyframe)) return null;

  const segmentCount = horizontalSwitchSegmentCount(token);
  if (segmentCount <= 1) return null;

  const keyframes = token.keyframes as ObjectKeyframe[];
  const frames = Array.from({ length: segmentCount }, (_, segmentIndex) =>
    keyframes.map((frame, index) => {
      const offsetRatio =
        typeof frame.offsetMs === "number" && Number.isFinite(frame.offsetMs) && token.durationMs > 0
          ? frame.offsetMs / token.durationMs
          : keyframes.length <= 1
            ? 1
            : index / (keyframes.length - 1);
      const percent = formatPercent(((segmentIndex + offsetRatio) / segmentCount) * 100);
      const body = objectKeyframeBody(token, frame, index);
      return body ? `  ${percent} { ${body} }` : "";
    })
  )
    .flat()
    .filter(Boolean)
    .join("\n");

  return frames ? `@keyframes ${keyframeName(token)} {\n${frames}\n}` : null;
}

function horizontalSwitchColorKeyframes(token: AtomicMotionToken): string | null {
  if (token.family !== "horizontal-switch" || token.property !== "color") return null;
  if (!Array.isArray(token.keyframes) || !token.keyframes.every((item) => typeof item === "string"))
    return null;

  if (token.variant === "switch") {
    const inactive = colorVarValue(token, "keyframe-0", (token.keyframes as string[])[0] ?? "#b4b8bf");
    const active = "var(--motion-active-color, #e60012)";
    return `@keyframes ${keyframeName(token)} {
  0% { border-color: ${inactive}; }
  50% { border-color: ${active}; }
  100% { border-color: ${inactive}; }
}`;
  }

  if (token.variant === "indicator" || token.variant === "tab-navigation") {
    return `@keyframes ${keyframeName(token)} {
  0%, 100% { background-color: var(--motion-active-color, #e60012); }
}`;
  }

  return null;
}

function tokenKeyframes(token: AtomicMotionToken): string {
  if (!Array.isArray(token.keyframes)) return "";
  if (isHorizontalSwitchPositionToken(token)) return horizontalSwitchPositionKeyframes(token) ?? "";
  const horizontalSwitchObjectFrames = horizontalSwitchObjectKeyframes(token);
  if (horizontalSwitchObjectFrames) return horizontalSwitchObjectFrames;
  const horizontalSwitchColorFrames = horizontalSwitchColorKeyframes(token);
  if (horizontalSwitchColorFrames) return horizontalSwitchColorFrames;

  if (token.keyframes.every((item) => typeof item === "string")) {
    const frames = token.keyframes
      .map((_, index) => {
        const frameValue = (token.keyframes as string[])[index] ?? "#e5e7eb";
        const value = colorVarValue(token, `keyframe-${index}`, frameValue);
        const property =
          token.family === "horizontal-switch" && token.variant === "switch"
            ? "border-color"
            : "background-color";
        return `  ${percentage(index, token.keyframes.length)}% { ${property}: ${value}; }`;
      })
      .join("\n");
    return `@keyframes ${keyframeName(token)} {\n${frames}\n}`;
  }
  if (!token.keyframes.every(isScalarKeyframe)) {
    const frames = token.keyframes
      .map((frame, index) => {
        const body = objectKeyframeBody(token, frame, index);
        return body
          ? `  ${keyframePercentage(index, token.keyframes.length, token.durationMs, frame.offsetMs)} { ${body} }`
          : "";
      })
      .filter(Boolean)
      .join("\n");
    return frames ? `@keyframes ${keyframeName(token)} {\n${frames}\n}` : "";
  }

  const numericKeyframes = token.keyframes as ScalarKeyframe[];
  const frames = numericKeyframes
    .map((frame, index) => {
      const frameValue = scalarValue(frame);
      const value = cssVarValue(token, `keyframe-${index}`, frameValue);
      const body = isHorizontalSwitchPositionToken(token)
        ? `transform: translateX(${cssVarValue(token, `keyframe-${index}`, frameValue, "px")});`
        : token.property === "opacity"
          ? `opacity: ${value};`
          : token.property === "scale"
            ? `transform: scale(${value});`
            : token.property === "roundness"
              ? `border-radius: ${cssVarValue(token, `keyframe-${index}`, frameValue, "px")};`
              : `left: ${cssVarValue(token, `keyframe-${index}`, frameValue, "px")};`;
      return `  ${keyframePercentage(index, numericKeyframes.length, token.durationMs, scalarOffsetMs(frame))} { ${body} }`;
    })
    .join("\n");
  return `@keyframes ${keyframeName(token)} {\n${frames}\n}`;
}

function animationLine(token: AtomicMotionToken): string {
  const shouldStretchDuration =
    token.family === "horizontal-switch" && (token.property === "position" || token.property === "size");
  const segmentCount = shouldStretchDuration ? horizontalSwitchSegmentCount(token) : 1;
  const baseDuration = `var(${cssVarName(token, "duration")}, ${token.durationMs}ms)`;
  const duration = segmentCount > 1 ? repeatedDuration(baseDuration, segmentCount) : baseDuration;
  return `${keyframeName(token)} ${duration} var(${cssVarName(token, "easing")}, ${token.easing}) var(${cssVarName(token, "delay")}, ${token.delayMs}ms) both`;
}

function syntheticHorizontalSwitchKeyframes(tokens: AtomicMotionToken[]): string {
  const firstToken = tokens[0];
  if (!firstToken || firstToken.family !== "horizontal-switch") return "";
  if (tokens.some(isHorizontalSwitchPositionToken)) return "";
  if (firstToken.variant !== "indicator") return "";

  const frames = horizontalSwitchOffsetPath("indicator")
    .map((offset, index, path) => {
      const percent = formatPercent((index / (path.length - 1)) * 100);
      return `  ${percent} { transform: translateX(${offset}px); }`;
    })
    .join("\n");
  return `@keyframes horizontal-switch-indicator-position {\n${frames}\n}`;
}

function syntheticHorizontalSwitchAnimationLines(tokens: AtomicMotionToken[]): string[] {
  const firstToken = tokens[0];
  if (!firstToken || firstToken.family !== "horizontal-switch") return [];
  if (tokens.some(isHorizontalSwitchPositionToken)) return [];
  if (firstToken.variant !== "indicator") return [];

  const segmentCount = horizontalSwitchOffsetPath("indicator").length - 1;
  const baseDuration = `var(${cssVarName(firstToken, "duration")}, ${firstToken.durationMs}ms)`;
  return [
    `horizontal-switch-indicator-position ${repeatedDuration(baseDuration, segmentCount)} var(${cssVarName(firstToken, "easing")}, ${firstToken.easing}) 0ms both`
  ];
}

function tokenCss(tokens: AtomicMotionToken[]): string {
  const keyframes = [...tokens.map(tokenKeyframes), syntheticHorizontalSwitchKeyframes(tokens)].filter(
    Boolean
  );
  const animationLines = [...tokens.map(animationLine), ...syntheticHorizontalSwitchAnimationLines(tokens)];
  return `${keyframes.join("\n\n")}

.is-playing [data-motion=foregroundLayer] {
  animation: ${animationLines.join(",\n    ")};
  will-change: transform, opacity, width, height, left, top, border-radius, background-color;
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
  if (recipe.family === "content-feedback") {
    return CONTENT_FEEDBACK_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  if (recipe.family === "horizontal-switch") {
    return HORIZONTAL_SWITCH_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  if (recipe.family === "container-transform") {
    return { width: 176, height: 176 };
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

function assetParams(recipe: MotionSkillRecipe): MotionParam[] {
  const size = stageSize(recipe);
  const stageWidthConstraints = {
    min: Math.min(80, size.stageWidth),
    max: Math.max(520, size.stageWidth),
    step: 1,
    unit: "px" as const
  };
  const stageHeightConstraints = {
    min: Math.min(48, size.stageHeight),
    max: Math.max(1200, size.stageHeight),
    step: 1,
    unit: "px" as const
  };
  const backgroundWidthConstraints = {
    min: Math.min(80, size.backgroundLayerWidth),
    max: Math.max(640, size.backgroundLayerWidth),
    step: 1,
    unit: "px" as const
  };
  const backgroundHeightConstraints = {
    min: Math.min(48, size.backgroundLayerHeight),
    max: Math.max(1280, size.backgroundLayerHeight),
    step: 1,
    unit: "px" as const
  };
  const params: MotionParam[] = [
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
      default: size.stageWidth,
      status: "confirmed",
      constraints: stageWidthConstraints,
      targets: [cssVariableTarget("--stage-width")]
    },
    {
      id: "stageHeight",
      label: "页面高度",
      type: "range",
      default: size.stageHeight,
      status: "confirmed",
      constraints: stageHeightConstraints,
      targets: [cssVariableTarget("--stage-height")]
    },
    {
      id: "backgroundLayerWidth",
      label: "背景层宽度",
      type: "range",
      default: size.backgroundLayerWidth,
      status: "confirmed",
      constraints: backgroundWidthConstraints,
      targets: [cssVariableTarget("--background-layer-width")]
    },
    {
      id: "backgroundLayerHeight",
      label: "背景层高度",
      type: "range",
      default: size.backgroundLayerHeight,
      status: "confirmed",
      constraints: backgroundHeightConstraints,
      targets: [cssVariableTarget("--background-layer-height")]
    }
  ];

  if (recipe.family === "horizontal-switch") {
    params.push({
      id: "activeColor",
      label: "选中高亮色",
      type: "color",
      default: "#e60012",
      status: "confirmed",
      targets: [cssVariableTarget("--motion-active-color")]
    });
  }

  if (recipe.family === "horizontal-switch" && recipe.variant === "tab-navigation") {
    params.push(
      ...[1, 2, 3, 4].map(
        (index): MotionParam => ({
          id: `tabNavigationLabel${index}`,
          label: `Tab 文案 ${index}`,
          type: "text",
          default: "内容名称",
          status: "confirmed",
          targets: [
            {
              kind: "html-text",
              file: "source/index.html",
              selector: `[data-motion=tabNavigationLabel${index}]`
            }
          ]
        })
      )
    );
  }

  return params;
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

function stageClassName(recipe: MotionSkillRecipe): string {
  return `motion-skill-stage motion-skill-${recipe.family} motion-skill-${recipe.family}-${recipe.variant}`;
}

function horizontalSwitchBackgroundMarkup(variant: string): string {
  if (variant === "segmented") {
    return `
        <div class="motion-switch-segmented-track" aria-hidden="true">
          <span>类型</span>
          <span>类型</span>
        </div>`;
  }
  if (variant === "switch") return `<div class="motion-switch-track" aria-hidden="true"></div>`;
  if (variant === "indicator") {
    return `
        <div class="motion-switch-indicators" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>`;
  }
  if (variant === "tabbar") {
    return `
        <div class="motion-switch-tabbar-shell" aria-hidden="true">
          <span><b>⌂</b><em>文案</em></span>
          <span><b>⌂</b><em>文案</em></span>
          <span><b>⌂</b><em>文案</em></span>
          <span><b>⌂</b><em>文案</em></span>
          <span><b>⌂</b><em>文案</em></span>
        </div>`;
  }
  if (variant === "channel-tab") {
    return `
        <div class="motion-switch-channel-tabs" aria-hidden="true">
          <span><b>🌱</b><em>推荐</em></span>
          <span><b>🧸</b><em>推荐</em></span>
          <span><b>📘</b><em>推荐</em></span>
          <span><b>👜</b><em>推荐</em></span>
          <span><b>🎋</b><em>推荐</em></span>
        </div>`;
  }
  if (variant === "tab-navigation") {
    return `
        <div class="motion-switch-text-tabs" aria-hidden="true">
          <span data-motion="tabNavigationLabel1">内容名称</span>
          <span data-motion="tabNavigationLabel2">内容名称</span>
          <span data-motion="tabNavigationLabel3">内容名称</span>
          <span data-motion="tabNavigationLabel4">内容名称</span>
        </div>`;
  }
  return "";
}

function foregroundMarkup(recipe: MotionSkillRecipe): string {
  if (recipe.family !== "horizontal-switch") return "";
  if (recipe.variant === "segmented") return `<span>类型</span>`;
  if (recipe.variant === "tabbar") return `<b>⌂</b><em>文案</em>`;
  if (recipe.variant === "channel-tab") return `<b>🌱</b><em>推荐</em>`;
  return "";
}

function backgroundMarkup(recipe: MotionSkillRecipe): string {
  if (recipe.family === "horizontal-switch") return horizontalSwitchBackgroundMarkup(recipe.variant);
  return "";
}

function foregroundLayerOverrides(recipe: MotionSkillRecipe): string {
  if (recipe.family === "horizontal-switch") return horizontalSwitchVariantCss(recipe.variant);
  if (recipe.family === "container-transform") {
    return `
.motion-skill-container-transform-product-card {
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: none;
  max-height: none;
  transform: scale(min(1, calc(82vw / 374px), calc(82vh / 812px)));
  transform-origin: center;
  background: #b7bcc3;
  border-radius: 0;
  box-shadow: none;
}

.motion-skill-container-transform-product-card .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #b7bcc3;
}

.motion-skill-foreground {
  left: var(--container-transform-card-anchor-left, 8px);
  right: auto;
  top: auto;
  bottom: var(--container-transform-card-anchor-bottom, 34px);
  translate: none;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  transform-origin: left bottom;
}`;
  }
  if (recipe.family === "content-feedback" && recipe.variant === "selection") {
    return `
.motion-skill-foreground {
  border-radius: 999px;
  background: transparent;
  border: 3px solid #FF465A;
  box-shadow: none;
}`;
  }
  return "";
}

function horizontalSwitchVariantCss(variant: string): string {
  if (variant === "segmented") {
    return `
.motion-skill-horizontal-switch-segmented {
  background: #ffffff;
  box-shadow: none;
}

.motion-skill-horizontal-switch-segmented .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
}

.motion-switch-segmented-track {
  position: absolute;
  left: 22px;
  top: 19px;
  display: grid;
  grid-template-columns: repeat(2, 36px);
  height: 22px;
  border-radius: 5px;
  background: #9da0a5;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
}

.motion-skill-horizontal-switch-segmented .motion-skill-foreground {
  left: 23px;
  top: 20px;
  translate: none;
  transform: translateX(0);
  transform-origin: center;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: #565b62;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
  font-size: 13px;
  font-weight: 800;
}`;
  }
  if (variant === "switch") {
    return `
.motion-skill-horizontal-switch-switch {
  background: #ffffff;
  box-shadow: none;
}

.motion-skill-horizontal-switch-switch .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
}

.motion-switch-track {
  position: absolute;
  left: 32px;
  top: 18px;
  width: 56px;
  height: 24px;
  border-radius: 999px;
  background: #b4b8bf;
  overflow: hidden;
}

.motion-switch-track::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 34px;
  border-radius: inherit;
  background: var(--motion-active-color, #e60012);
  content: "";
  opacity: 0;
}

.is-playing .motion-switch-track::before {
  animation: horizontal-switch-switch-fill calc(var(--horizontal-switch-switch-position-duration, 200ms) + var(--horizontal-switch-switch-position-duration, 200ms)) cubic-bezier(0.38, 0, 0.24, 1) both;
}

@keyframes horizontal-switch-switch-fill {
  0% { width: 24px; opacity: 0; }
  22.5% { width: 46px; opacity: 1; }
  50% { width: 56px; opacity: 1; }
  72.5% { width: 46px; opacity: 1; }
  100% { width: 24px; opacity: 0; }
}

.motion-skill-horizontal-switch-switch .motion-skill-foreground {
  left: 34px;
  top: 20px;
  translate: none;
  transform: translateX(0);
  transform-origin: center;
  border: 2px solid #b4b8bf;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14);
}`;
  }
  if (variant === "indicator") {
    return `
.motion-skill-horizontal-switch-indicator {
  background: #ffffff;
  box-shadow: none;
}

.motion-skill-horizontal-switch-indicator .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #9f9f9f;
}

.motion-switch-indicators {
  position: absolute;
  left: 42px;
  top: 28px;
  display: flex;
  gap: 7px;
}

.motion-switch-indicators span {
  width: 8px;
  height: 4px;
  border-radius: 999px;
  background: #ffffff;
}

.motion-skill-horizontal-switch-indicator .motion-skill-foreground {
  left: 42px;
  top: 28px;
  translate: none;
  transform: translateX(0);
  transform-origin: center;
  border-radius: 999px;
  background: var(--motion-active-color, #e60012);
  box-shadow: none;
}`;
  }
  if (variant === "tabbar") {
    return `
.motion-skill-horizontal-switch-tabbar {
  background: #ffffff;
  box-shadow: none;
}

.motion-skill-horizontal-switch-tabbar .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
}

.motion-switch-tabbar-shell {
  position: absolute;
  left: 28px;
  right: 12px;
  top: 75px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: 46px;
  align-items: center;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 2px 16px rgba(15, 23, 42, 0.12);
}

.motion-switch-tabbar-shell span,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground {
  display: grid;
  place-items: center;
  color: #2f3338;
  font-size: 10px;
  font-weight: 700;
}

.motion-switch-tabbar-shell b,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground b {
  font-size: 18px;
  line-height: 1;
}

.motion-switch-tabbar-shell em,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground em {
  font-style: normal;
}

.motion-skill-horizontal-switch-tabbar .motion-skill-foreground {
  left: 28px;
  top: 76px;
  translate: none;
  transform: translateX(0);
  transform-origin: center;
  border-radius: 12px;
  background: #eef0f3;
  color: var(--motion-active-color, #e60012);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.18);
}`;
  }
  if (variant === "tab-navigation") {
    return `
.motion-skill-horizontal-switch-tab-navigation {
  background: #ffffff;
  box-shadow: none;
}

.motion-skill-horizontal-switch-tab-navigation .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #ffffff;
}

.motion-switch-text-tabs {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  color: #11141a;
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.motion-switch-text-tabs span:first-child {
  color: var(--motion-active-color, #e60012);
}

.motion-skill-horizontal-switch-tab-navigation .motion-skill-foreground {
  left: 40px;
  top: 42px;
  translate: none;
  transform: translateX(0);
  transform-origin: center;
  border-radius: 999px;
  background: var(--motion-active-color, #e60012);
  box-shadow: none;
}`;
  }
  if (variant === "channel-tab") {
    return `
.motion-skill-horizontal-switch-channel-tab {
  background: #9b9b9b;
  box-shadow: none;
}

.motion-skill-horizontal-switch-channel-tab .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #9b9b9b;
}

.motion-switch-channel-tabs {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.motion-switch-channel-tabs span,
.motion-skill-horizontal-switch-channel-tab .motion-skill-foreground {
  display: grid;
  place-items: center;
  gap: 1px;
}

.motion-switch-channel-tabs b,
.motion-skill-horizontal-switch-channel-tab .motion-skill-foreground b {
  font-size: 25px;
  line-height: 1;
}

.motion-switch-channel-tabs em,
.motion-skill-horizontal-switch-channel-tab .motion-skill-foreground em {
  border-radius: 999px;
  font-style: normal;
  padding: 2px 8px;
}

.motion-skill-horizontal-switch-channel-tab .motion-skill-foreground {
  left: 7px;
  top: 2px;
  translate: none;
  transform: translateX(0);
  transform-origin: center;
  border-radius: 10px;
  background: #ffffff;
  color: #008b89;
  box-shadow: none;
}`;
  }
  return "";
}

function baseFiles(tokens: AtomicMotionToken[], recipe: MotionSkillRecipe): SourceFile[] {
  const foregroundSize = foregroundLayerSize(recipe);
  const size = stageSize(recipe);

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
    <main class="${stageClassName(recipe)}" data-motion-root>
      <section class="motion-skill-background" data-motion="backgroundLayer">
        <img class="motion-skill-layer-image" data-motion="backgroundImage" src="${EMPTY_IMAGE_SRC}" alt="" />
${backgroundMarkup(recipe)}
      </section>
      <section class="motion-skill-foreground" data-motion="foregroundLayer">
        <img class="motion-skill-layer-image" data-motion="foregroundImage" src="${EMPTY_IMAGE_SRC}" alt="" />
        ${foregroundMarkup(recipe)}
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
  --stage-width: ${size.stageWidth}px;
  --stage-height: ${size.stageHeight}px;
  --background-layer-width: ${size.backgroundLayerWidth}px;
  --background-layer-height: ${size.backgroundLayerHeight}px;
  --foreground-layer-width: ${foregroundSize.width}px;
  --foreground-layer-height: ${foregroundSize.height}px;
  --motion-active-color: #e60012;
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

.motion-skill-layer-image[src=""],
.motion-skill-layer-image[src="${EMPTY_IMAGE_SRC}"] {
  display: none;
}

.motion-skill-foreground .motion-skill-layer-image {
  border-radius: inherit;
}

${foregroundLayerOverrides(recipe)}
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
    params: assetParams(recipe),
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
