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
import { FRONT_BACK_SWIPE_BACKGROUND_IMAGE, FRONT_BACK_SWIPE_FOREGROUND_IMAGE } from "./swipeActionAssets";
import { CHANNEL_TAB_ACTIVE_BACKGROUND_DATA_URI, CHANNEL_TAB_ICON_DATA_URIS } from "./channelTabAssets";
import { TABBAR_ICON_DATA_URIS } from "./tabbarAssets";

const EMPTY_IMAGE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
const CONTENT_FEEDBACK_SELECTION_ACTIVE_BG =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20version%3D%221.1%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20fill%3D%22none%22%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%2016%2016%22%20preserveAspectRatio%3D%22none%22%20overflow%3D%22visible%22%20style%3D%22display%3A%20block%3B%22%3E%3Cpath%20d%3D%22M8%200C12.418278%200%2016%203.5817218%2016%208C16%2012.418278%2012.418278%2016%208%2016C3.5817218%2016%200%2012.418278%200%208C0%203.5817218%203.5817218%200%208%200Z%22%20fill%3D%22%23ff0f23%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E";
const CONTENT_FEEDBACK_SELECTION_CHECK =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20version%3D%221.1%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20fill%3D%22none%22%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%207.682%207.518%22%20preserveAspectRatio%3D%22none%22%20overflow%3D%22visible%22%20style%3D%22display%3A%20block%3B%22%3E%3Cpath%20d%3D%22M2.3929999%207.2490001L0.088%204.4980001C-0.046%204.3390002%20-0.025%204.1020002%200.13500001%203.9679999L0.71200001%203.484C0.87099999%203.3510001%201.108%203.372%201.242%203.5309999L2.8929999%205.5019999L6.3590002%200.171C6.473%20-0.003%206.7049999%20-0.052000001%206.8800001%200.061000001L7.5110002%200.472C7.6849999%200.58499998%207.7350001%200.81800002%207.6209998%200.99199998L3.6010001%207.1750002C3.325%207.5999999%202.7179999%207.6370001%202.3929999%207.2490001Z%22%20fill-rule%3D%22evenodd%22%20fill%3D%22%23ffffff%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E";
const CONTENT_LOADING_GLOBAL_SHAPE_PATH =
  "M 4.639 -126.844 C -65.602 -126.128 -110.974 -89.549 -110.974 -89.549 C -110.974 -89.549 -122.633 -110.427 -154.383 -107.677 C -176.472 -105.764 -188.352 -84.735 -193.928 -71.025 C -202.631 -49.625 -208.027 -42.246 -219.041 -18.511 C -227.631 0 -246.13 32.717 -247.771 42.417 C -251.692 65.601 -241.166 75.752 -223.914 83.622 C -192.129 98.122 -157.496 85.69 -157.496 85.69 C -157.496 85.69 -152.68 95.436 -152.68 95.436 C -152.68 95.436 -112.315 180.65 8.684 179.812 C 133.459 178.947 174.072 84.316 174.072 84.316 C 174.072 84.316 205.966 95.721 232.7 86.697 C 257.331 78.383 268.461 62.41 263.019 40.84 C 259.022 25 227.379 -30.91 217.056 -56.041 C 201.316 -94.361 189.426 -109.968 161.071 -108.191 C 138.346 -106.767 127.008 -87.167 127.008 -87.167 C 127.008 -87.167 77.836 -127.59 4.639 -126.844 Z";
const DEFAULT_STAGE_SIZE = {
  stageWidth: 375,
  stageHeight: 812,
  backgroundLayerWidth: 375,
  backgroundLayerHeight: 812
};
const HORIZONTAL_SWITCH_STAGE_SIZES: Record<string, typeof DEFAULT_STAGE_SIZE> = {
  "tab-navigation": {
    stageWidth: 374,
    stageHeight: 60,
    backgroundLayerWidth: 374,
    backgroundLayerHeight: 60
  },
  tabbar: { stageWidth: 375, stageHeight: 52, backgroundLayerWidth: 375, backgroundLayerHeight: 52 },
  switch: { stageWidth: 120, stageHeight: 60, backgroundLayerWidth: 120, backgroundLayerHeight: 60 },
  indicator: { stageWidth: 120, stageHeight: 60, backgroundLayerWidth: 120, backgroundLayerHeight: 60 },
  segmented: { stageWidth: 240, stageHeight: 120, backgroundLayerWidth: 240, backgroundLayerHeight: 120 },
  "channel-tab": { stageWidth: 375, stageHeight: 75, backgroundLayerWidth: 375, backgroundLayerHeight: 75 }
};
const CONTENT_LOADING_STAGE_SIZES: Record<string, typeof DEFAULT_STAGE_SIZE> = {
  global: { stageWidth: 712, stageHeight: 582, backgroundLayerWidth: 712, backgroundLayerHeight: 582 }
};
const CONTAINER_TRANSFORM_STAGE_SIZE = {
  stageWidth: 374,
  stageHeight: 812,
  backgroundLayerWidth: 374,
  backgroundLayerHeight: 812
};
const FRONT_BACK_ENTRY_STAGE_SIZES: Record<string, typeof DEFAULT_STAGE_SIZE> = {
  "detail-page": {
    stageWidth: 374,
    stageHeight: 812,
    backgroundLayerWidth: 374,
    backgroundLayerHeight: 812
  },
  "half-sheet": {
    stageWidth: 374,
    stageHeight: 812,
    backgroundLayerWidth: 374,
    backgroundLayerHeight: 812
  },
  "action-panel": {
    stageWidth: 374,
    stageHeight: 812,
    backgroundLayerWidth: 374,
    backgroundLayerHeight: 812
  },
  "swipe-action": {
    stageWidth: 750,
    stageHeight: 324,
    backgroundLayerWidth: 750,
    backgroundLayerHeight: 324
  }
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
  selection: { width: 32, height: 32 }
};
const HORIZONTAL_SWITCH_FOREGROUND_LAYER_SIZES: Record<string, typeof DEFAULT_FOREGROUND_LAYER_SIZE> = {
  "tab-navigation": { width: 16, height: 2.5 },
  tabbar: { width: 65.4, height: 44 },
  switch: { width: 64, height: 40 },
  indicator: { width: 18, height: 4 },
  segmented: { width: 72, height: 40 },
  "channel-tab": { width: 104, height: 148 }
};
const FRONT_BACK_ENTRY_FOREGROUND_LAYER_SIZES: Record<string, typeof DEFAULT_FOREGROUND_LAYER_SIZE> = {
  "detail-page": { width: 374, height: 812 },
  "half-sheet": { width: 374, height: 406 },
  "action-panel": { width: 374, height: 160 },
  "swipe-action": { width: 750, height: 324 }
};
const CONTENT_LOADING_FOREGROUND_LAYER_SIZES: Record<string, typeof DEFAULT_FOREGROUND_LAYER_SIZE> = {
  global: { width: 640, height: 448 }
};
const FRONT_BACK_SWIPE_ACTION = {
  stageWidth: 750,
  stageHeight: 324,
  itemWidth: 112,
  itemHeight: 216,
  bottomInset: 12,
  endRightInset: 16,
  radius: 16,
  iconSize: 32,
  labelWidth: 80,
  labelFontSize: 20,
  labelLineHeight: 28,
  gap: 12
};
const FRONT_BACK_SWIPE_ACTION_WIDTH = FRONT_BACK_SWIPE_ACTION.itemWidth * 5;
const FRONT_BACK_SWIPE_ACTION_TOP =
  FRONT_BACK_SWIPE_ACTION.stageHeight -
  FRONT_BACK_SWIPE_ACTION.itemHeight -
  FRONT_BACK_SWIPE_ACTION.bottomInset;
const FRONT_BACK_SWIPE_ACTION_OPEN_DISTANCE = -(
  FRONT_BACK_SWIPE_ACTION_WIDTH + FRONT_BACK_SWIPE_ACTION.endRightInset
);

function stageSize(recipe: MotionSkillRecipe): typeof DEFAULT_STAGE_SIZE {
  if (recipe.family === "horizontal-switch") {
    return HORIZONTAL_SWITCH_STAGE_SIZES[recipe.variant] ?? DEFAULT_STAGE_SIZE;
  }
  if (recipe.family === "front-back-entry") {
    return FRONT_BACK_ENTRY_STAGE_SIZES[recipe.variant] ?? DEFAULT_STAGE_SIZE;
  }
  if (recipe.family === "content-loading") {
    return CONTENT_LOADING_STAGE_SIZES[recipe.variant] ?? DEFAULT_STAGE_SIZE;
  }
  if (recipe.family === "container-transform") return CONTAINER_TRANSFORM_STAGE_SIZE;
  return DEFAULT_STAGE_SIZE;
}

function cssVariableTarget(name: string) {
  return { kind: "css-variable" as const, file: "source/style.css", selector: ".motion-skill-stage", name };
}

function tokenCssId(token: AtomicMotionToken): string {
  return token.id.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "");
}

function cssVarName(token: AtomicMotionToken, suffix: string): string {
  return `--${tokenCssId(token)}-${suffix}`;
}

function keyframeName(token: AtomicMotionToken): string {
  return tokenCssId(token);
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
    (token.variant === "tab-navigation" ||
      token.variant === "indicator" ||
      token.variant === "switch" ||
      token.variant === "channel-tab")
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
  if (variant === "channel-tab")
    return [0, positiveStep, positiveStep * 2, positiveStep * 3, positiveStep * 4];
  if (variant === "segmented") return [0, positiveStep];
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

function isObjectKeyframe(value: unknown): value is ObjectKeyframe {
  return typeof value === "object" && value !== null && !("value" in value);
}

function horizontalSwitchObjectKeyframes(token: AtomicMotionToken): string | null {
  if (token.family !== "horizontal-switch" || token.property !== "size") return null;
  if (!Array.isArray(token.keyframes) || token.keyframes.every(isScalarKeyframe)) return null;

  if (token.variant === "switch") {
    return `@keyframes ${keyframeName(token)} {
  0% { width: 42px; height: 22px; }
  8.25% { width: 54px; height: 22px; }
  50% { width: 42px; height: 22px; }
  58.25% { width: 54px; height: 22px; }
  100% { width: 42px; height: 22px; }
}`;
  }

  if (token.variant === "indicator") {
    return `@keyframes ${keyframeName(token)} {
  0% { width: 18px; height: 4px; }
  25% { width: 24px; height: 4px; }
  50% { width: 18px; height: 4px; }
  75% { width: 24px; height: 4px; }
  100% { width: 18px; height: 4px; }
}`;
  }

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

function lastObjectFrame(token: AtomicMotionToken): ObjectKeyframe | null {
  const frames = token.keyframes;
  if (!Array.isArray(frames) || frames.length === 0 || !frames.every(isObjectKeyframe)) return null;
  return frames[frames.length - 1] ?? null;
}

function frontBackEntryTransformBody(token: AtomicMotionToken, frame: ObjectKeyframe, index: number): string {
  if (token.variant === "detail-page") {
    const size = FRONT_BACK_ENTRY_STAGE_SIZES["detail-page"] ?? DEFAULT_STAGE_SIZE;
    const x = typeof frame.x === "number" ? frame.x : 0;
    const finalFrame = lastObjectFrame(token);
    const finalX = typeof finalFrame?.x === "number" ? finalFrame.x : -size.backgroundLayerWidth;
    const travel = Math.abs(finalX) || size.backgroundLayerWidth;
    return `transform: translateX(${formatPercent(((x - finalX) / travel) * 100)});`;
  }

  if (token.variant === "half-sheet") {
    const size = FRONT_BACK_ENTRY_STAGE_SIZES["half-sheet"] ?? DEFAULT_STAGE_SIZE;
    const finalFrame = lastObjectFrame(token);
    const finalY = typeof finalFrame?.y === "number" ? finalFrame.y : 0;
    const y = typeof frame.y === "number" ? frame.y : 0;
    const defaultHeight = size.backgroundLayerHeight / 2 + 48;
    return `transform: translateY(${formatPercent(((finalY - y) / defaultHeight) * 100)});`;
  }

  if (token.variant === "action-panel") {
    const size = FRONT_BACK_ENTRY_STAGE_SIZES["action-panel"] ?? DEFAULT_STAGE_SIZE;
    const finalFrame = lastObjectFrame(token);
    const finalY = typeof finalFrame?.y === "number" ? finalFrame.y : 0;
    const y = typeof frame.y === "number" ? frame.y : 0;
    const defaultHeight = size.backgroundLayerHeight / 5;
    return `transform: translateY(${formatPercent(((y - finalY) / defaultHeight) * 100)});`;
  }

  const x = cssVarValue(token, `keyframe-${index}-x`, typeof frame.x === "number" ? frame.x : 0, "px");
  return `transform: translateX(${x});`;
}

function frontBackEntryKeyframes(token: AtomicMotionToken): string {
  if (!Array.isArray(token.keyframes)) return "";

  if (token.property === "position" && !token.keyframes.every(isScalarKeyframe)) {
    if (token.variant === "swipe-action") return "";

    const frames = (token.keyframes as ObjectKeyframe[])
      .map((frame, index) => {
        const body = frontBackEntryTransformBody(token, frame, index);
        return `  ${keyframePercentage(index, token.keyframes.length, token.durationMs, frame.offsetMs)} { ${body} }`;
      })
      .join("\n");
    return `@keyframes ${keyframeName(token)} {\n${frames}\n}`;
  }

  return tokenKeyframes(token);
}

function frontBackEntrySwipeTokenIndex(token: AtomicMotionToken): number {
  const match = token.id.match(/position-(\d+)$/);
  const tokenIndex = Number(match?.[1] ?? "1");
  if (!Number.isFinite(tokenIndex)) return 1;
  return Math.min(5, Math.max(1, tokenIndex));
}

function frontBackEntrySwipeVisualIndex(token: AtomicMotionToken): number {
  return 6 - frontBackEntrySwipeTokenIndex(token);
}

function frontBackEntrySelector(token: AtomicMotionToken): string {
  if (token.variant !== "swipe-action") return "[data-motion=foregroundLayer]";
  return `[data-motion=swipeLayer${frontBackEntrySwipeVisualIndex(token)}]`;
}

function frontBackEntryAnimationLine(token: AtomicMotionToken): string {
  if (token.variant !== "swipe-action") return animationLine(token);

  const tokenIndex = frontBackEntrySwipeTokenIndex(token);
  const visualIndex = frontBackEntrySwipeVisualIndex(token);
  const staggerMs = Math.max(0, visualIndex - 1) * 12;
  const duration =
    tokenIndex === 1
      ? `var(${cssVarName(token, "duration")}, 200ms)`
      : `var(${cssVarName(token, "duration")}, ${token.durationMs}ms)`;
  const delay = `calc(var(${cssVarName(token, "delay")}, ${token.delayMs}ms) + ${staggerMs}ms)`;
  return `${keyframeName(token)} ${duration} var(${cssVarName(token, "easing")}, ${token.easing}) ${delay} both`;
}

function frontBackEntrySyntheticCss(tokens: AtomicMotionToken[]): string {
  if (!tokens.some((token) => token.variant === "swipe-action" && token.property === "position")) return "";

  return `.motion-skill-front-back-entry-swipe-action.is-settling .motion-skill-foreground,
.motion-skill-front-back-entry-swipe-action.is-settling .front-back-swipe-actions {
  transition: transform var(--front-back-entry-swipe-action-position-5-duration, 200ms) var(--front-back-entry-swipe-action-position-5-easing, cubic-bezier(0, 0, 0.15, 1));
}

.motion-skill-front-back-entry-swipe-action.is-dragging .motion-skill-foreground,
.motion-skill-front-back-entry-swipe-action.is-dragging .front-back-swipe-actions {
  transition: none;
}`;
}

function frontBackEntryTokenCss(tokens: AtomicMotionToken[]): string {
  if (tokens[0]?.variant === "swipe-action") return frontBackEntrySyntheticCss(tokens);

  const keyframes = [...tokens.map(frontBackEntryKeyframes), frontBackEntrySyntheticCss(tokens)].filter(
    Boolean
  );
  const animationLinesBySelector = new Map<string, string[]>();

  for (const token of tokens) {
    const selector = frontBackEntrySelector(token);
    animationLinesBySelector.set(selector, [
      ...(animationLinesBySelector.get(selector) ?? []),
      frontBackEntryAnimationLine(token)
    ]);
  }

  const animationRules = [...animationLinesBySelector.entries()]
    .map(
      ([selector, animationLines]) => `.is-playing ${selector} {
  animation: ${animationLines.join(",\n    ")};
  will-change: transform, opacity;
}`
    )
    .join("\n\n");

  return `${keyframes.join("\n\n")}\n\n${animationRules}`;
}

function tokenCss(tokens: AtomicMotionToken[]): string {
  if (tokens[0]?.family === "front-back-entry") return frontBackEntryTokenCss(tokens);
  if (tokens[0]?.family === "content-feedback" && tokens[0]?.variant === "selection")
    return contentFeedbackSelectionTokenCss(tokens);
  if (tokens[0]?.family === "horizontal-switch" && tokens[0]?.variant === "switch") {
    return horizontalSwitchToggleCss(tokens);
  }
  if (tokens[0]?.family === "horizontal-switch" && tokens[0]?.variant === "indicator") {
    return horizontalSwitchIndicatorCss(tokens);
  }
  if (tokens[0]?.family === "horizontal-switch" && tokens[0]?.variant === "channel-tab") {
    return horizontalSwitchChannelTabCss(tokens);
  }
  if (tokens[0]?.family === "horizontal-switch" && tokens[0]?.variant === "tab-navigation") {
    return horizontalSwitchTabNavigationCss(tokens);
  }
  if (tokens[0]?.family === "horizontal-switch" && tokens[0]?.variant === "tabbar") {
    return "";
  }

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

function contentFeedbackSelectionTokenCss(tokens: AtomicMotionToken[]): string {
  const keyframes = tokens.map(tokenKeyframes).filter(Boolean);
  const animationLines = tokens.map(animationLine);
  return `${keyframes.join("\n\n")}

.is-playing [data-motion=selectionChecked] {
  animation: ${animationLines.join(",\n    ")};
  will-change: transform, opacity;
}`;
}

function horizontalSwitchToggleCss(tokens: AtomicMotionToken[]): string {
  const firstToken = tokens[0];
  if (!firstToken) return "";
  const positionToken = tokens.find((token) => token.property === "position") ?? firstToken;
  const sizeToken = tokens.find((token) => token.property === "size") ?? positionToken;
  const colorToken = tokens.find((token) => token.property === "color") ?? positionToken;
  const duration = `var(${cssVarName(positionToken, "duration")}, ${positionToken.durationMs}ms)`;
  const easing = `var(${cssVarName(positionToken, "easing")}, ${positionToken.easing})`;
  const colorDuration = `var(${cssVarName(colorToken, "duration")}, ${colorToken.durationMs}ms)`;
  const colorEasing = `var(${cssVarName(colorToken, "easing")}, ${colorToken.easing})`;
  const inactive = colorVarValue(colorToken, "keyframe-0", "#b4b8bf");
  const active = "var(--motion-active-color, #ff2338)";

  return `@keyframes ${keyframeName(positionToken)} {
  0% { transform: translateX(0); }
  100% { transform: translateX(var(--switch-travel, 40px)); }
}

@keyframes ${keyframeName(positionToken)}-reverse {
  0% { transform: translateX(var(--switch-travel, 40px)); }
  100% { transform: translateX(0); }
}

@keyframes ${keyframeName(sizeToken)} {
  0% { width: var(--foreground-layer-width, 64px); }
  16.5% { width: 77px; }
  100% { width: var(--foreground-layer-width, 64px); }
}

@keyframes ${keyframeName(sizeToken)}-reverse {
  0% { width: var(--foreground-layer-width, 64px); }
  16.5% { width: 77px; transform: translateX(calc(var(--switch-travel, 40px) - 13px)); }
  100% { width: var(--foreground-layer-width, 64px); transform: translateX(0); }
}

@keyframes ${keyframeName(colorToken)} {
  0% { background-color: ${inactive}; }
  100% { background-color: ${active}; }
}

@keyframes ${keyframeName(colorToken)}-reverse {
  0% { background-color: ${active}; }
  100% { background-color: ${inactive}; }
}

.motion-skill-horizontal-switch-switch.is-toggling-on [data-motion=foregroundLayer] {
  animation:
    ${keyframeName(positionToken)} ${duration} ${easing} 0ms both,
    ${keyframeName(sizeToken)} ${duration} ${easing} 0ms both;
  will-change: transform, width;
}

.motion-skill-horizontal-switch-switch.is-toggling-off [data-motion=foregroundLayer] {
  animation:
    ${keyframeName(positionToken)}-reverse ${duration} ${easing} 0ms both,
    ${keyframeName(sizeToken)}-reverse ${duration} ${easing} 0ms both;
  will-change: transform, width;
}

.motion-skill-horizontal-switch-switch.is-toggling-on .motion-switch-track {
  animation: ${keyframeName(colorToken)} ${colorDuration} ${colorEasing} 0ms both;
}

.motion-skill-horizontal-switch-switch.is-toggling-off .motion-switch-track {
  animation: ${keyframeName(colorToken)}-reverse ${colorDuration} ${colorEasing} 0ms both;
}

.motion-skill-horizontal-switch-switch.is-on .motion-switch-track {
  background-color: ${active};
}

.motion-skill-horizontal-switch-switch.is-on [data-motion=foregroundLayer] {
  transform: translateX(var(--switch-travel, 40px));
}`;
}

function horizontalSwitchIndicatorCss(tokens: AtomicMotionToken[]): string {
  const firstToken = tokens[0];
  if (!firstToken) return "";
  const sizeToken = tokens.find((token) => token.property === "size") ?? firstToken;
  const colorToken = tokens.find((token) => token.property === "color") ?? firstToken;
  const duration = `var(${cssVarName(sizeToken, "duration")}, ${sizeToken.durationMs}ms)`;
  const easing = `var(${cssVarName(sizeToken, "easing")}, ${sizeToken.easing})`;
  const colorDuration = `var(${cssVarName(colorToken, "duration")}, ${colorToken.durationMs}ms)`;
  const colorEasing = `var(${cssVarName(colorToken, "easing")}, ${colorToken.easing})`;
  const inactive = colorVarValue(colorToken, "keyframe-1", "#f0f0f5");
  const active = "var(--motion-active-color, #ff2338)";

  return `@keyframes ${keyframeName(sizeToken)} {
  0% { width: 8px; }
  100% { width: 14px; }
}

@keyframes ${keyframeName(sizeToken)}-shrink {
  0% { width: 14px; }
  100% { width: 8px; }
}

@keyframes ${keyframeName(colorToken)} {
  0% { background-color: ${inactive}; }
  100% { background-color: ${active}; }
}

@keyframes ${keyframeName(colorToken)}-fade {
  0% { background-color: ${active}; }
  100% { background-color: ${inactive}; }
}

.motion-switch-indicator-dot.is-active {
  width: 14px;
  background-color: ${active};
}

.motion-switch-indicator-dot.is-growing {
  animation:
    ${keyframeName(sizeToken)} ${duration} ${easing} 0ms both,
    ${keyframeName(colorToken)} ${colorDuration} ${colorEasing} 0ms both;
}

.motion-switch-indicator-dot.is-shrinking {
  animation:
    ${keyframeName(sizeToken)}-shrink ${duration} ${easing} 0ms both,
    ${keyframeName(colorToken)}-fade ${colorDuration} ${colorEasing} 0ms both;
}`;
}

function horizontalSwitchChannelTabCss(tokens: AtomicMotionToken[]): string {
  const firstToken = tokens[0];
  if (!firstToken) return "";
  const positionToken = tokens.find((token) => token.property === "position") ?? firstToken;
  const sizeToken = tokens.find((token) => token.property === "size") ?? positionToken;
  const opacityToken = tokens.find((token) => token.property === "opacity") ?? positionToken;
  const positionDuration = `var(${cssVarName(positionToken, "duration")}, ${positionToken.durationMs}ms)`;
  const positionEasing = `var(${cssVarName(positionToken, "easing")}, ${positionToken.easing})`;
  const sizeDuration = `var(${cssVarName(sizeToken, "duration")}, ${sizeToken.durationMs}ms)`;
  const sizeEasing = `var(${cssVarName(sizeToken, "easing")}, ${sizeToken.easing})`;
  const opacityDuration = `var(${cssVarName(opacityToken, "duration")}, ${opacityToken.durationMs}ms)`;
  const opacityEasing = `var(${cssVarName(opacityToken, "easing")}, ${opacityToken.easing})`;
  const fromX = cssVarValue(positionToken, "keyframe-0-x", 34, "px");
  const overshootX = cssVarValue(positionToken, "keyframe-1-x", 110.4, "px");
  const toX = cssVarValue(positionToken, "keyframe-2-x", 106.4, "px");
  const inactiveSize = cssVarValue(sizeToken, "keyframe-0-width", 36, "px");
  const overshootSize = cssVarValue(sizeToken, "keyframe-1-width", 46, "px");
  const activeSize = cssVarValue(sizeToken, "keyframe-2-width", 44, "px");
  const opacityFrom = cssVarValue(opacityToken, "keyframe-0", 0);
  const opacityTo = cssVarValue(opacityToken, "keyframe-1", 1);

  return `@keyframes horizontal-switch-channel-tab-active-bg {
  0% { transform: translateX(var(--channel-active-bg-from-x, ${fromX})); }
  50% { transform: translateX(var(--channel-active-bg-overshoot-x, ${overshootX})); }
  100% { transform: translateX(var(--channel-active-bg-to-x, ${toX})); }
}

@keyframes horizontal-switch-channel-tab-icon-size {
  0% { width: ${inactiveSize}; height: ${inactiveSize}; transform: translateY(0); }
  40% { width: ${overshootSize}; height: ${overshootSize}; transform: translateY(-4px); }
  100% { width: ${activeSize}; height: ${activeSize}; transform: translateY(-2px); }
}

@keyframes horizontal-switch-channel-tab-icon-size-reverse {
  0% { width: ${activeSize}; height: ${activeSize}; transform: translateY(-2px); }
  40% { width: ${overshootSize}; height: ${overshootSize}; transform: translateY(-4px); }
  100% { width: ${inactiveSize}; height: ${inactiveSize}; transform: translateY(0); }
}

@keyframes horizontal-switch-channel-tab-name {
  0% { opacity: ${opacityFrom}; }
  100% { opacity: ${opacityTo}; }
}

@keyframes horizontal-switch-channel-tab-name-fade {
  0% { opacity: ${opacityTo}; }
  100% { opacity: ${opacityFrom}; }
}

.motion-switch-channel-active-bg.is-moving {
  animation: horizontal-switch-channel-tab-active-bg ${positionDuration} ${positionEasing} 0ms both;
}

.motion-switch-channel-tab.is-activating b {
  animation: horizontal-switch-channel-tab-icon-size ${sizeDuration} ${sizeEasing} 0ms both;
}

.motion-switch-channel-tab.is-deactivating b {
  animation: horizontal-switch-channel-tab-icon-size-reverse ${sizeDuration} ${sizeEasing} 0ms both;
}

.motion-switch-channel-tab.is-activating em {
  animation: horizontal-switch-channel-tab-name ${opacityDuration} ${opacityEasing} 0ms both;
}

.motion-switch-channel-tab.is-deactivating em {
  animation: horizontal-switch-channel-tab-name-fade ${opacityDuration} ${opacityEasing} 0ms both;
}`;
}

function horizontalSwitchTabNavigationCss(tokens: AtomicMotionToken[]): string {
  const firstToken = tokens[0];
  if (!firstToken) return "";
  const positionToken = tokens.find((token) => token.property === "position") ?? firstToken;
  const sizeToken = tokens.find((token) => token.property === "size") ?? positionToken;
  const colorToken = tokens.find((token) => token.property === "color") ?? positionToken;
  const positionDuration = `var(${cssVarName(positionToken, "duration")}, ${positionToken.durationMs}ms)`;
  const positionEasing = `var(${cssVarName(positionToken, "easing")}, ${positionToken.easing})`;
  const sizeDuration = `var(${cssVarName(sizeToken, "duration")}, ${sizeToken.durationMs}ms)`;
  const sizeEasing = `var(${cssVarName(sizeToken, "easing")}, ${sizeToken.easing})`;
  const colorDuration = `var(${cssVarName(colorToken, "duration")}, ${colorToken.durationMs}ms)`;
  const colorDelay = `var(${cssVarName(colorToken, "delay")}, ${colorToken.delayMs}ms)`;
  const colorEasing = `var(${cssVarName(colorToken, "easing")}, ${colorToken.easing})`;
  const underlineWidth = cssVarValue(sizeToken, "keyframe-0-width", 16, "px");
  const stretchWidth = cssVarValue(sizeToken, "keyframe-1-width", 32, "px");

  return `@keyframes horizontal-switch-tab-navigation-underline-size {
  0% { width: ${underlineWidth}; }
  26.667% { width: ${stretchWidth}; }
  100% { width: ${underlineWidth}; }
}

.motion-switch-text-tabs.is-moving .motion-switch-text-tab-indicator {
  animation: horizontal-switch-tab-navigation-underline-size ${sizeDuration} ${sizeEasing} 0ms both;
}

.motion-switch-text-tab {
  transition: color ${colorDuration} ${colorEasing} ${colorDelay};
}

.motion-switch-text-tabs {
  --tab-navigation-active-index: 1;
  --tab-navigation-tab-width: calc(100% / 4);
  --tab-navigation-indicator-left: calc(
    var(--tab-navigation-active-index) * var(--tab-navigation-tab-width) +
    (var(--tab-navigation-tab-width) - var(--foreground-layer-width, 16px)) / 2
  );
}

.motion-switch-text-tabs[data-active-index="0"] { --tab-navigation-active-index: 0; }
.motion-switch-text-tabs[data-active-index="1"] { --tab-navigation-active-index: 1; }
.motion-switch-text-tabs[data-active-index="2"] { --tab-navigation-active-index: 2; }
.motion-switch-text-tabs[data-active-index="3"] { --tab-navigation-active-index: 3; }

.motion-switch-text-tab-indicator {
  left: var(--tab-navigation-indicator-left);
  transition:
    left ${positionDuration} ${positionEasing},
    width ${sizeDuration} ${sizeEasing};
}`;
}

function targetBinding(recipe?: MotionSkillRecipe): MotionSkillTargetBinding {
  if (recipe?.family === "horizontal-switch" && recipe.variant === "tabbar") {
    return {
      layerId: "tabbarLayer",
      label: "Tabbar 底导",
      role: "foreground",
      selector: "[data-motion=tabbarLayer]"
    };
  }

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
  if (recipe.family === "content-loading") {
    return CONTENT_LOADING_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  if (recipe.family === "horizontal-switch") {
    return HORIZONTAL_SWITCH_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  if (recipe.family === "front-back-entry") {
    return FRONT_BACK_ENTRY_FOREGROUND_LAYER_SIZES[recipe.variant] ?? DEFAULT_FOREGROUND_LAYER_SIZE;
  }
  if (recipe.family === "container-transform") {
    return { width: 176, height: 176 };
  }
  return DEFAULT_FOREGROUND_LAYER_SIZE;
}

function foregroundLayerRadius(recipe: MotionSkillRecipe): number {
  if (recipe.family === "container-transform") return 8;
  if (recipe.family === "content-feedback" && recipe.variant === "selection") return 999;
  if (recipe.family === "front-back-entry") {
    if (recipe.variant === "half-sheet") return 10;
    if (recipe.variant === "action-panel") return 8;
    return 0;
  }
  if (recipe.family === "horizontal-switch") {
    if (recipe.variant === "channel-tab") return 10;
    if (recipe.variant === "switch" || recipe.variant === "indicator" || recipe.variant === "tab-navigation")
      return 999;
  }
  return 24;
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
  const foregroundSize = foregroundLayerSize(recipe);
  const foregroundRadius = foregroundLayerRadius(recipe);
  const isFrontBackSwipeAction = recipe.family === "front-back-entry" && recipe.variant === "swipe-action";
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
  const foregroundRadiusConstraints = {
    min: 0,
    max: Math.max(120, foregroundRadius),
    step: 1,
    unit: "px" as const
  };
  const foregroundWidthConstraints = {
    min: Math.min(16, foregroundSize.width),
    max: Math.max(720, foregroundSize.width),
    step: 1,
    unit: "px" as const
  };
  const foregroundHeightConstraints = {
    min: Math.min(2, foregroundSize.height),
    max: Math.max(1280, foregroundSize.height),
    step: 1,
    unit: "px" as const
  };
  const params: MotionParam[] = [
    {
      id: "backgroundImage",
      label: "背景层",
      type: "image",
      default: isFrontBackSwipeAction ? FRONT_BACK_SWIPE_BACKGROUND_IMAGE : "",
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
      default: isFrontBackSwipeAction ? FRONT_BACK_SWIPE_FOREGROUND_IMAGE : "",
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
      id: "foregroundLayerRadius",
      label: "前景层圆角",
      type: "range",
      default: foregroundRadius,
      status: "confirmed",
      constraints: foregroundRadiusConstraints,
      targets: [cssVariableTarget("--foreground-layer-radius")]
    },
    {
      id: "foregroundLayerWidth",
      label: "前景层宽度",
      type: "range",
      default: foregroundSize.width,
      status: "confirmed",
      constraints: foregroundWidthConstraints,
      targets: [cssVariableTarget("--foreground-layer-width")]
    },
    {
      id: "foregroundLayerHeight",
      label: "前景层高度",
      type: "range",
      default: foregroundSize.height,
      status: "confirmed",
      constraints: foregroundHeightConstraints,
      targets: [cssVariableTarget("--foreground-layer-height")]
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

  if (recipe.family === "horizontal-switch" && recipe.variant === "channel-tab") {
    const defaults = ["推荐", "秒杀", "月黑风高", "京东指数", "大牌奥莱", "临期清仓"];
    params.push(
      ...defaults.map(
        (label, index): MotionParam => ({
          id: `channelTabLabel${index + 1}`,
          label: `频道文案 ${index + 1}`,
          type: "text",
          default: label,
          status: "confirmed",
          targets: [
            {
              kind: "html-text",
              file: "source/index.html",
              selector: `[data-motion=channelTabLabel${index + 1}]`
            }
          ]
        })
      )
    );
  }

  if (recipe.family === "content-loading" && recipe.variant === "global") {
    params.push({
      id: "contentLoadingGlobalScaleDuration",
      label: "循环时长",
      type: "duration",
      default: 1467,
      status: "confirmed",
      constraints: { min: 300, max: 6000, step: 20, unit: "ms" },
      targets: [cssVariableTarget("--content-loading-global-scale-duration")]
    });
  }

  return params;
}

function assetLayers(recipe: MotionSkillRecipe): MotionLayer[] {
  const layers: MotionLayer[] = [
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

  if (recipe.family === "front-back-entry" && recipe.variant === "swipe-action") {
    layers.push(
      ...[1, 2, 3, 4, 5].map(
        (index): MotionLayer => ({
          id: `swipeLayer${index}`,
          label: `滑块${index}`,
          kind: "structure",
          replaceable: true,
          required: false,
          targets: [
            {
              kind: "css-property",
              file: "source/style.css",
              selector: `[data-motion=swipeLayer${index}]`,
              property: "transform"
            }
          ]
        })
      )
    );
  }

  return layers;
}

function stageClassName(recipe: MotionSkillRecipe): string {
  return `motion-skill-stage motion-skill-${recipe.family} motion-skill-${recipe.family}-${recipe.variant}`;
}

function horizontalSwitchBackgroundMarkup(variant: string): string {
  if (variant === "segmented") {
    return `
        <div class="motion-switch-segmented-track" role="group" aria-label="分段选项">
          <button class="motion-switch-segmented-option is-active" type="button" data-segmented-index="0" aria-pressed="true">类型</button>
          <button class="motion-switch-segmented-option" type="button" data-segmented-index="1" aria-pressed="false">类型</button>
        </div>`;
  }
  if (variant === "switch") return `<div class="motion-switch-track" aria-hidden="true"></div>`;
  if (variant === "indicator") {
    return `
        <div class="motion-switch-indicators" aria-label="指示器选项">
          <button class="motion-switch-indicator-dot is-active" type="button" data-indicator-index="0" aria-label="选择第 1 项" aria-pressed="true"></button>
          <button class="motion-switch-indicator-dot" type="button" data-indicator-index="1" aria-label="选择第 2 项" aria-pressed="false"></button>
          <button class="motion-switch-indicator-dot" type="button" data-indicator-index="2" aria-label="选择第 3 项" aria-pressed="false"></button>
        </div>`;
  }
  if (variant === "tabbar") {
    return `
        <span class="motion-switch-joy-agent" aria-hidden="true">
          <img class="motion-switch-joy-agent-image" src="${TABBAR_ICON_DATA_URIS.joyAgent}" alt="" />
        </span>
        <div class="motion-switch-tabbar-shell" data-motion="tabbarLayer" aria-label="底部导航">
          <span class="motion-switch-tabbar-active-bg" aria-hidden="true"></span>
          <button class="is-active" type="button" data-tabbar-index="0" aria-pressed="true"><b></b><em>文案</em></button>
          <button type="button" data-tabbar-index="1" aria-pressed="false"><b></b><em>文案</em></button>
          <button type="button" data-tabbar-index="2" aria-pressed="false"><b></b><em>文案</em></button>
          <button type="button" data-tabbar-index="3" aria-pressed="false"><b></b><em>文案</em></button>
          <button type="button" data-tabbar-index="4" aria-pressed="false"><b></b><em>文案</em></button>
        </div>`;
  }
  if (variant === "channel-tab") {
    return `
        <div class="motion-switch-channel-tabs" aria-label="频道 Tab">
          <span class="motion-switch-channel-active-bg" aria-hidden="true"></span>
          <button class="motion-switch-channel-tab" type="button" data-channel-index="0" aria-pressed="false">
            <b class="channel-icon channel-icon-star" aria-hidden="true"></b>
            <em data-motion="channelTabLabel1">推荐</em>
          </button>
          <button class="motion-switch-channel-tab is-active" type="button" data-channel-index="1" aria-pressed="true">
            <b class="channel-icon channel-icon-alarm" aria-hidden="true"></b>
            <em data-motion="channelTabLabel2">秒杀</em>
          </button>
          <button class="motion-switch-channel-tab" type="button" data-channel-index="2" aria-pressed="false">
            <b class="channel-icon channel-icon-moon" aria-hidden="true"></b>
            <em data-motion="channelTabLabel3">月黑风高</em>
          </button>
          <button class="motion-switch-channel-tab" type="button" data-channel-index="3" aria-pressed="false">
            <b class="channel-icon channel-icon-chart" aria-hidden="true"></b>
            <em data-motion="channelTabLabel4">京东指数</em>
          </button>
          <button class="motion-switch-channel-tab" type="button" data-channel-index="4" aria-pressed="false">
            <b class="channel-icon channel-icon-sale" aria-hidden="true"></b>
            <em data-motion="channelTabLabel5">大牌奥莱</em>
          </button>
          <button class="motion-switch-channel-tab" type="button" data-channel-index="5" aria-pressed="false">
            <b class="channel-icon channel-icon-basket" aria-hidden="true"></b>
            <em data-motion="channelTabLabel6">临期清仓</em>
          </button>
        </div>`;
  }
  if (variant === "tab-navigation") {
    return `
        <div class="motion-switch-text-tabs" data-active-index="1" aria-label="Tab 导航">
          <button class="motion-switch-text-tab" type="button" data-tab-index="0" data-motion="tabNavigationLabel1" aria-pressed="false">内容名称</button>
          <button class="motion-switch-text-tab is-active" type="button" data-tab-index="1" data-motion="tabNavigationLabel2" aria-pressed="true">内容名称</button>
          <button class="motion-switch-text-tab" type="button" data-tab-index="2" data-motion="tabNavigationLabel3" aria-pressed="false">内容名称</button>
          <button class="motion-switch-text-tab" type="button" data-tab-index="3" data-motion="tabNavigationLabel4" aria-pressed="false">内容名称</button>
          <span class="motion-switch-text-tab-indicator" aria-hidden="true"></span>
        </div>`;
  }
  return "";
}

function frontBackEntryBackgroundMarkup(variant: string): string {
  if (variant === "swipe-action") {
    return `
        <div class="front-back-swipe-actions" aria-hidden="true">
          <span class="front-back-swipe-action is-muted" data-motion="swipeLayer1" data-icon="↑" data-label="置顶"></span>
          <span class="front-back-swipe-action is-dark" data-motion="swipeLayer2" data-icon="+" data-label="加常买"></span>
          <span class="front-back-swipe-action is-yellow" data-motion="swipeLayer3" data-icon="★" data-label="收藏"></span>
          <span class="front-back-swipe-action is-orange" data-motion="swipeLayer4" data-icon="⌕" data-label="看相似"></span>
          <span class="front-back-swipe-action is-red" data-motion="swipeLayer5" data-icon="×" data-label="删除"></span>
        </div>`;
  }
  return "";
}

function foregroundMarkup(recipe: MotionSkillRecipe): string {
  if (recipe.family === "front-back-entry") return frontBackEntryForegroundMarkup(recipe.variant);
  if (recipe.family === "content-loading") return contentLoadingForegroundMarkup(recipe.variant);
  if (recipe.family === "content-feedback" && recipe.variant === "selection")
    return contentFeedbackSelectionForegroundMarkup();
  if (recipe.family !== "horizontal-switch") return "";
  if (recipe.variant === "segmented") return `<span>类型</span>`;
  if (recipe.variant === "tabbar") return `<b></b><em>文案</em>`;
  return "";
}

function contentFeedbackSelectionForegroundMarkup(): string {
  return `
        <span class="content-feedback-selection-control" aria-hidden="true">
          <span class="content-feedback-selection-unchecked"></span>
          <span class="content-feedback-selection-checked" data-motion="selectionChecked">
            <img class="content-feedback-selection-active-bg" src="${CONTENT_FEEDBACK_SELECTION_ACTIVE_BG}" alt="" />
            <img class="content-feedback-selection-check" src="${CONTENT_FEEDBACK_SELECTION_CHECK}" alt="" />
          </span>
        </span>`;
}

function contentLoadingForegroundMarkup(variant: string): string {
  if (variant !== "global") return "";

  return `
        <svg class="content-loading-global-mark" viewBox="-320 -224 640 448" aria-hidden="true">
          <defs>
            <linearGradient id="content-loading-global-fill" x1="321.053" y1="-369.173" x2="-3.008" y2="200.752" gradientUnits="userSpaceOnUse">
              <stop offset="50%" stop-color="#f2f2f2" />
              <stop offset="100%" stop-color="#dcdcdc" />
            </linearGradient>
            <linearGradient id="content-loading-global-stroke" x1="321.053" y1="-369.173" x2="-3.008" y2="200.752" gradientUnits="userSpaceOnUse">
              <stop offset="50%" stop-color="#f2f2f2" />
              <stop offset="100%" stop-color="#dcdcdc" />
            </linearGradient>
          </defs>
          <path class="content-loading-global-fill" d="${CONTENT_LOADING_GLOBAL_SHAPE_PATH}" />
          <path class="content-loading-global-highlight" d="${CONTENT_LOADING_GLOBAL_SHAPE_PATH}" />
        </svg>`;
}

function frontBackEntryForegroundMarkup(variant: string): string {
  if (variant === "detail-page") {
    return `
        <div class="front-back-detail-page" aria-hidden="true">
          <div class="front-back-detail-grid">
            <span></span><span></span><span></span><span></span>
          </div>
          <i></i><i></i><i></i>
          <div class="front-back-detail-block"></div>
        </div>`;
  }

  if (variant === "half-sheet") {
    return `
        <div class="front-back-sheet-handle" aria-hidden="true"></div>
        <div class="front-back-sheet-content" aria-hidden="true"></div>`;
  }

  if (variant === "action-panel") {
    return `
        <div class="front-back-action-panel" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>`;
  }

  if (variant === "swipe-action") {
    return "";
  }

  return "";
}

function backgroundMarkup(recipe: MotionSkillRecipe): string {
  if (recipe.family === "horizontal-switch") return horizontalSwitchBackgroundMarkup(recipe.variant);
  if (recipe.family === "front-back-entry") return frontBackEntryBackgroundMarkup(recipe.variant);
  return "";
}

function foregroundLayerOverrides(recipe: MotionSkillRecipe): string {
  if (recipe.family === "front-back-entry") return frontBackEntryVariantCss(recipe.variant);
  if (recipe.family === "horizontal-switch") return horizontalSwitchVariantCss(recipe.variant);
  if (recipe.family === "content-loading") return contentLoadingVariantCss(recipe.variant);
  if (recipe.family === "container-transform") {
    return `
.motion-skill-container-transform-product-card {
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: none;
  max-height: none;
  transform-origin: center;
  background: transparent;
  box-shadow: none;
}

.motion-skill-container-transform-product-card .motion-skill-background {
  left: calc((100% - var(--background-layer-width)) / 2);
  top: calc((100% - var(--background-layer-height)) / 2);
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  border-radius: 32px;
  overflow: hidden;
  background: #3f3f46;
}

.motion-skill-foreground {
  left: var(--container-transform-card-anchor-left, 8px);
  right: auto;
  top: auto;
  bottom: var(--container-transform-card-anchor-bottom, 34px);
  translate: none;
  border-radius: var(--foreground-layer-radius, 8px);
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  transform-origin: left bottom;
}`;
  }
  if (recipe.family === "content-feedback" && recipe.variant === "selection") {
    return `
.motion-skill-foreground {
  display: block;
  width: 32px;
  height: 32px;
  border-radius: var(--foreground-layer-radius, 8px);
  background: transparent;
  border: 0;
  box-shadow: none;
  cursor: pointer;
}

.motion-skill-foreground .motion-skill-layer-image {
  display: none;
}

.content-feedback-selection-control,
.content-feedback-selection-unchecked,
.content-feedback-selection-checked {
  position: absolute;
  inset: 0;
  display: block;
}

.content-feedback-selection-unchecked {
  border: 2px solid #b4b8bf;
  border-radius: 16px;
  background: #ffffff;
}

.content-feedback-selection-checked {
  opacity: 0;
  transform: scale(0.5);
  transform-origin: center;
}

.content-feedback-selection-active-bg {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.content-feedback-selection-check {
  position: absolute;
  left: 8.368px;
  top: 8.41px;
  display: block;
  width: 15.364px;
  height: 15.036px;
}

.motion-skill-content-feedback-selection.is-selected .content-feedback-selection-checked {
  opacity: 1;
  transform: scale(1);
}`;
  }
  return "";
}

function contentLoadingVariantCss(variant: string): string {
  if (variant !== "global") return "";

  return `
.motion-skill-content-loading-global {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  overflow: visible;
}

.motion-skill-content-loading-global .motion-skill-background {
  display: none;
}

.motion-skill-content-loading-global .motion-skill-foreground {
  width: min(var(--foreground-layer-width), calc(100% - 48px));
  height: auto;
  aspect-ratio: 640 / 448;
  max-width: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.content-loading-global-mark {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.content-loading-global-fill {
  fill: url(#content-loading-global-fill);
  opacity: 0;
}

.content-loading-global-highlight {
  fill: transparent;
  stroke: url(#content-loading-global-stroke);
  stroke-width: 36;
  stroke-linecap: round;
  stroke-linejoin: miter;
  opacity: 1;
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(1);
}

.is-playing .content-loading-global-fill {
  animation: content-loading-global-fade var(--content-loading-global-scale-duration, 1467ms) var(--content-loading-global-opacity-easing, cubic-bezier(0.79, 0, 0.714, 1)) var(--content-loading-global-opacity-delay, 0ms) both infinite;
}

@keyframes content-loading-global-fade {
  0% { opacity: var(--content-loading-global-opacity-keyframe-0, 0); }
  34.091%, 100% { opacity: var(--content-loading-global-opacity-keyframe-1, 1); }
}`;
}

function frontBackEntryVariantCss(variant: string): string {
  const stageScale =
    variant === "swipe-action" ? "scale(min(1, calc(82vw / 750px), calc(82vh / 324px)))" : "none";
  const common = `
.motion-skill-front-back-entry {
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: none;
  max-height: none;
  transform: ${stageScale};
  transform-origin: center;
  background: transparent;
  box-shadow: none;
}

.motion-skill-front-back-entry .motion-skill-background {
  left: calc((100% - var(--background-layer-width)) / 2);
  top: calc((100% - var(--background-layer-height)) / 2);
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  border-radius: 32px;
  overflow: hidden;
  background: #3f3f46;
}

.motion-skill-front-back-entry .motion-skill-foreground {
  left: 0;
  top: 0;
  translate: none;
  width: var(--foreground-layer-width);
  height: var(--foreground-layer-height);
  max-width: none;
  border-radius: var(--foreground-layer-radius, 0px);
  background: #f7f7f8;
  box-shadow: none;
  overflow: hidden;
}`;

  if (variant === "detail-page") {
    return `${common}

.motion-skill-front-back-entry-detail-page .motion-skill-foreground {
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  transform: translateX(var(--stage-width));
  background: #ffffff;
}

.front-back-detail-page {
  position: absolute;
  inset: 8px 6px;
}

.front-back-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 62px);
  gap: 6px;
  margin-bottom: 18px;
}

.front-back-detail-grid span,
.front-back-detail-block,
.front-back-detail-page i {
  display: block;
  border-radius: 3px;
  background: #e5e5e5;
}

.front-back-detail-grid span {
  height: 62px;
}

.front-back-detail-page i {
  width: 152px;
  height: 7px;
  margin-top: 8px;
}

.front-back-detail-page i:first-of-type {
  width: 50px;
}

.front-back-detail-block {
  width: 152px;
  height: 152px;
  margin-top: 16px;
}`;
  }

  if (variant === "half-sheet") {
    return `${common}

.motion-skill-front-back-entry-half-sheet .motion-skill-foreground {
  left: calc((100% - var(--background-layer-width)) / 2 + 12px);
  top: calc((100% - var(--background-layer-height)) / 2 + var(--background-layer-height) / 2 + 12px);
  bottom: auto;
  width: calc(var(--background-layer-width) - 24px);
  height: calc(var(--background-layer-height) / 2 + 48px);
  border-radius: var(--foreground-layer-radius, 10px) var(--foreground-layer-radius, 10px) 0 0;
  background: #f7f7f8;
  transform: translateY(100%);
}

.front-back-sheet-handle {
  width: 42px;
  height: 4px;
  margin: 12px auto 20px;
  border-radius: 999px;
  background: #d7d9de;
}

.front-back-sheet-content {
  height: calc(100% - 44px);
  margin: 0 18px;
  border-radius: 8px;
  background: linear-gradient(#eeeeef, #eeeeef) 0 0 / 58% 14px no-repeat,
    linear-gradient(#eeeeef, #eeeeef) 0 34px / 100% 12px no-repeat,
    linear-gradient(#eeeeef, #eeeeef) 0 58px / 88% 12px no-repeat;
}`;
  }

  if (variant === "action-panel") {
    return `${common}

.motion-skill-front-back-entry-action-panel .motion-skill-foreground {
  left: calc((100% - var(--background-layer-width)) / 2 + var(--background-layer-width) / 31.1667);
  top: calc((100% - var(--background-layer-height)) / 2 + var(--background-layer-height) / 50.75);
  bottom: auto;
  width: calc(var(--background-layer-width) - var(--background-layer-width) / 15.5833);
  height: calc(var(--background-layer-height) / 5);
  box-sizing: border-box;
  border-radius: 0 0 var(--foreground-layer-radius, 8px) var(--foreground-layer-radius, 8px);
  background: #f7f7f8;
  transform: translateY(calc(-100% - var(--background-layer-height) / 50.75));
}

.front-back-action-panel {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: calc(var(--background-layer-width) / 31.1667);
  box-sizing: border-box;
  height: 100%;
  padding: calc(var(--background-layer-height) / 40.6) calc(var(--background-layer-width) / 20.7778);
}

.front-back-action-panel span {
  height: 46%;
  border-radius: 8px;
  background: #e6e8eb;
}

.front-back-action-panel span::after {
  display: block;
  width: 58%;
  height: 10.8%;
  margin: 18% auto 0;
  border-radius: 999px;
  background: #e6e8eb;
  content: "";
}`;
  }

  if (variant === "swipe-action") {
    return `${common}

.motion-skill-front-back-entry-swipe-action {
  background: #ffffff;
  border-radius: 0;
  box-shadow: none;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.motion-skill-front-back-entry-swipe-action .motion-skill-background {
  background: #ffffff;
  overflow: hidden;
}

.motion-skill-front-back-entry-swipe-action .motion-skill-foreground {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  transform: translateX(var(--swipe-foreground-x, 0px));
  will-change: transform;
}

.front-back-swipe-actions {
  position: absolute;
  left: 100%;
  top: ${FRONT_BACK_SWIPE_ACTION_TOP}px;
  display: flex;
  width: ${FRONT_BACK_SWIPE_ACTION_WIDTH}px;
  height: ${FRONT_BACK_SWIPE_ACTION.itemHeight}px;
  overflow: hidden;
  border-radius: ${FRONT_BACK_SWIPE_ACTION.radius}px;
  transform: translateX(var(--swipe-foreground-x, 0px));
  will-change: transform;
}

.front-back-swipe-action {
  flex: 0 0 ${FRONT_BACK_SWIPE_ACTION.itemWidth}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${FRONT_BACK_SWIPE_ACTION.gap}px;
  width: ${FRONT_BACK_SWIPE_ACTION.itemWidth}px;
  height: ${FRONT_BACK_SWIPE_ACTION.itemHeight}px;
  color: #ffffff;
  font-size: ${FRONT_BACK_SWIPE_ACTION.labelFontSize}px;
  line-height: ${FRONT_BACK_SWIPE_ACTION.labelLineHeight}px;
  font-weight: 800;
  transform: translateX(0);
  user-select: none;
  -webkit-user-select: none;
}

.front-back-swipe-action::before {
  display: block;
  width: ${FRONT_BACK_SWIPE_ACTION.iconSize}px;
  height: ${FRONT_BACK_SWIPE_ACTION.iconSize}px;
  font-size: ${FRONT_BACK_SWIPE_ACTION.iconSize}px;
  line-height: ${FRONT_BACK_SWIPE_ACTION.iconSize}px;
  text-align: center;
  content: attr(data-icon);
}

.front-back-swipe-action::after {
  display: block;
  width: ${FRONT_BACK_SWIPE_ACTION.labelWidth}px;
  text-align: center;
  content: attr(data-label);
}

.front-back-swipe-action.is-muted {
  background: #8e98aa;
}
.front-back-swipe-action.is-dark { background: #4f5a6c; }
.front-back-swipe-action.is-yellow { background: #ffb000; }
.front-back-swipe-action.is-orange { background: #ff7a1a; }
.front-back-swipe-action.is-red {
  background: #ff2457;
}`;
  }

  return common;
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
  left: 44px;
  top: 38px;
  display: grid;
  grid-template-columns: repeat(2, 72px);
  height: 44px;
  border-radius: 10px;
  background: #9da0a5;
  color: #ffffff;
  font-size: 26px;
  font-weight: 700;
  line-height: 44px;
  text-align: center;
  overflow: hidden;
  cursor: pointer;
}

.motion-switch-segmented-track::after {
  position: absolute;
  left: 2px;
  top: 2px;
  z-index: 2;
  width: 72px;
  height: 40px;
  border-radius: 8px;
  background: #565b62;
  content: "";
  transform: translateX(0);
}

.motion-switch-segmented-track[data-active-index="1"]::after {
  transform: translateX(var(--horizontal-switch-segmented-position-keyframe-1, 72px));
}

.motion-switch-segmented-track.is-moving-right::after {
  animation: horizontal-switch-segmented-to-right var(--horizontal-switch-segmented-position-duration, 200ms) var(--horizontal-switch-segmented-position-easing, cubic-bezier(0.38, 0, 0.24, 1)) both;
}

.motion-switch-segmented-track.is-moving-left::after {
  animation: horizontal-switch-segmented-to-left var(--horizontal-switch-segmented-position-duration, 200ms) var(--horizontal-switch-segmented-position-easing, cubic-bezier(0.38, 0, 0.24, 1)) both;
}

@keyframes horizontal-switch-segmented-to-right {
  0% { transform: translateX(0); width: 72px; }
  40% { width: var(--horizontal-switch-segmented-size-keyframe-1-width, 92px); }
  100% { transform: translateX(72px); width: 72px; }
}

@keyframes horizontal-switch-segmented-to-left {
  0% { transform: translateX(72px); width: 72px; }
  40% { width: var(--horizontal-switch-segmented-size-keyframe-1-width, 92px); }
  100% { transform: translateX(0); width: 72px; }
}

.motion-switch-segmented-option {
  position: relative;
  z-index: 1;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.motion-switch-segmented-option.is-active {
  z-index: 3;
}

.motion-skill-horizontal-switch-segmented .motion-skill-foreground {
  display: none;
}

.motion-skill-horizontal-switch-segmented .motion-skill-foreground span {
  display: none;
}`;
  }
  if (variant === "switch") {
    return `
.motion-skill-horizontal-switch-switch {
  --switch-travel: 40px;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
}

.motion-skill-horizontal-switch-switch .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}

.motion-switch-track {
  position: absolute;
  left: 4px;
  top: 6px;
  width: 112px;
  height: 48px;
  border-radius: 999px;
  background: #b4b8bf;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}

.motion-skill-horizontal-switch-switch .motion-skill-foreground {
  left: 8px;
  top: 10px;
  translate: none;
  transform: translateX(0);
  transform-origin: left center;
  border: 0;
  border-radius: var(--foreground-layer-radius, 999px);
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
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
  background: #ffffff;
}

.motion-switch-indicators {
  position: absolute;
  left: 33px;
  top: 28px;
  display: flex;
  gap: 7px;
  align-items: center;
}

.motion-switch-indicator-dot {
  width: 8px;
  height: 4px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #f0f0f5;
  cursor: pointer;
}

.motion-skill-horizontal-switch-indicator .motion-skill-foreground {
  display: none;
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
  background: transparent;
}

.motion-switch-joy-agent {
  position: absolute;
  left: 0;
  top: 0;
  width: 52px;
  height: 52px;
  display: block;
  overflow: hidden;
  border: 0.5px solid #ffffff;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
}

.motion-switch-joy-agent-image {
  position: absolute;
  left: -24px;
  top: -24px;
  width: 100px;
  height: 100px;
  display: block;
  max-width: none;
  object-fit: contain;
  pointer-events: none;
}

.motion-switch-tabbar-shell {
  --tabbar-icon-inactive: url("${TABBAR_ICON_DATA_URIS.inactive}");
  --tabbar-icon-active: url("${TABBAR_ICON_DATA_URIS.active}");
  --tabbar-icon-active-detail: url("${TABBAR_ICON_DATA_URIS.activeDetail}");
  --tabbar-item-step: 61.4px;
  --tabbar-item-width: 65.4px;
  --tabbar-item-height: 44px;
  --tabbar-item-overshoot-width: 80.4px;
  --tabbar-active-index: 0;
  position: absolute;
  left: 56px;
  top: 0;
  width: 319px;
  height: 52px;
  padding: 4px;
  border-radius: 16px;
  background: linear-gradient(rgba(245, 245, 245, 0.6), rgba(245, 245, 245, 0.6)), #ffffff;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.motion-switch-tabbar-active-bg {
  position: absolute;
  left: 4px;
  top: 4px;
  z-index: 0;
  width: var(--tabbar-item-width);
  height: var(--tabbar-item-height);
  border-radius: 12px;
  background: var(--tabbar-active-background, #f2f4f7);
  pointer-events: none;
  transform: translateX(calc(var(--tabbar-active-index) * var(--tabbar-item-step)));
  transform-origin: center;
}

.motion-switch-tabbar-shell button,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  color: #2f3338;
  font-size: 10px;
  font-weight: 400;
  line-height: 14px;
}

.motion-switch-tabbar-shell button {
  position: absolute;
  top: 4px;
  z-index: 1;
  width: var(--tabbar-item-width);
  height: var(--tabbar-item-height);
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.motion-switch-tabbar-shell button:nth-of-type(1) {
  left: 4px;
}

.motion-switch-tabbar-shell button:nth-of-type(2) {
  left: calc(4px + var(--tabbar-item-step));
}

.motion-switch-tabbar-shell button:nth-of-type(3) {
  left: calc(4px + (var(--tabbar-item-step) * 2));
}

.motion-switch-tabbar-shell button:nth-of-type(4) {
  left: calc(4px + (var(--tabbar-item-step) * 3));
}

.motion-switch-tabbar-shell button:nth-of-type(5) {
  left: calc(4px + (var(--tabbar-item-step) * 4));
}

.motion-switch-tabbar-shell b,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground b {
  position: relative;
  width: 19.918px;
  height: 18.896px;
  font-size: 0;
  line-height: 1;
  background-image: var(--tabbar-icon-inactive);
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.motion-switch-tabbar-shell b::after,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground b::after {
  position: absolute;
  left: 6.597px;
  top: 11.842px;
  width: 6.724px;
  height: 2.471px;
  background-image: var(--tabbar-icon-active-detail);
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  content: "";
  opacity: 0;
}

.motion-switch-tabbar-shell button.is-active b,
.motion-switch-tabbar-shell button.is-activating b,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground b {
  background-image: var(--tabbar-icon-active);
}

.motion-switch-tabbar-shell button.is-active b::after,
.motion-switch-tabbar-shell button.is-activating b::after,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground b::after {
  opacity: 1;
}

.motion-switch-tabbar-shell em,
.motion-skill-horizontal-switch-tabbar .motion-skill-foreground em {
  font-style: normal;
}

.motion-skill-horizontal-switch-tabbar .motion-skill-foreground {
  display: none;
}

.motion-switch-tabbar-shell button.is-active,
.motion-switch-tabbar-shell button.is-activating {
  color: var(--motion-active-color, #ff0f23);
  font-weight: 600;
}

.motion-switch-tabbar-active-bg.is-moving {
  animation: motion-switch-tabbar-bg-move 300ms cubic-bezier(0.38, 0, 0.24, 1) both;
}

.motion-switch-tabbar-active-bg.is-moving::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: inherit;
  content: "";
  animation: motion-switch-tabbar-bg-size 300ms cubic-bezier(0.8, 0, 0.24, 1) both;
}

.motion-switch-tabbar-shell button.is-activating b {
  animation: motion-switch-tabbar-icon-in 300ms cubic-bezier(0.38, 0, 0.24, 1) both;
}

@keyframes motion-switch-tabbar-bg-move {
  0% {
    transform: translateX(var(--tabbar-bg-from-x, 0px));
  }

  100% {
    transform: translateX(var(--tabbar-bg-to-x, 0px));
  }
}

@keyframes motion-switch-tabbar-bg-size {
  0% {
    transform: scaleX(1);
  }

  26.666% {
    transform: scaleX(calc(var(--tabbar-item-overshoot-width) / var(--tabbar-item-width)));
  }

  100% {
    transform: scaleX(1);
  }
}

@keyframes motion-switch-tabbar-icon-in {
  0% {
    transform: translateY(0) scale(1);
  }

  26.666% {
    transform: translateY(-1px) scale(1.08);
  }

  100% {
    transform: translateY(0) scale(1);
  }
}

`;
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
  left: 24px;
  right: 24px;
  top: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  color: #11141a;
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.motion-switch-text-tab {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #11141a;
  font: inherit;
  cursor: pointer;
}

.motion-switch-text-tab.is-active {
  color: var(--motion-active-color, #e60012);
}

.motion-switch-text-tab-indicator {
  position: absolute;
  left: var(--tab-navigation-indicator-left);
  bottom: 15.5px;
  width: var(--foreground-layer-width, 16px);
  height: var(--foreground-layer-height, 2.5px);
  border-radius: var(--foreground-layer-radius, 999px);
  background: var(--motion-active-color, #e60012);
  content: "";
}

.motion-skill-horizontal-switch-tab-navigation .motion-skill-foreground {
  left: 0;
  top: 0;
  translate: none;
  transform: none;
  transform-origin: center;
  border-radius: var(--foreground-layer-radius, 999px);
  background: transparent;
  box-shadow: none;
  pointer-events: none;
}`;
  }
  if (variant === "channel-tab") {
    return `
main.motion-skill-horizontal-switch-channel-tab {
  --motion-active-color: #ff0031;
  border-radius: 0;
  background: #ff0031;
  box-shadow: none;
  overflow: hidden;
}

.motion-skill-horizontal-switch-channel-tab .motion-skill-background {
  inset: 0;
  width: 100%;
  height: 100%;
  background: #ff0031;
}

.motion-switch-channel-tabs {
  position: absolute;
  left: 0;
  top: 0;
  width: 375px;
  height: 75px;
  overflow: hidden;
  color: #ffffff;
  font: 700 12px/12px Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.motion-switch-channel-active-bg {
  position: absolute;
  z-index: 0;
  left: 0;
  top: 1px;
  width: 128px;
  height: 74px;
  background-image: url("${CHANNEL_TAB_ACTIVE_BACKGROUND_DATA_URI}");
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  pointer-events: none;
  transform: translateX(42px);
}

.motion-switch-channel-tab {
  position: absolute;
  top: 1px;
  z-index: 1;
  width: 68px;
  height: 74px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.motion-switch-channel-tab:nth-of-type(1) {
  left: 0;
}

.motion-switch-channel-tab:nth-of-type(2) {
  left: 72px;
}

.motion-switch-channel-tab:nth-of-type(3) {
  left: 144px;
}

.motion-switch-channel-tab:nth-of-type(4) {
  left: 212px;
}

.motion-switch-channel-tab:nth-of-type(5) {
  left: 280px;
}

.motion-switch-channel-tab:nth-of-type(6) {
  left: 348px;
}

.motion-switch-channel-tab.is-active,
.motion-switch-channel-tab.is-activating,
.motion-switch-channel-tab.is-deactivating {
  z-index: 2;
}

.motion-switch-channel-tab b,
.motion-switch-channel-tab em {
  position: absolute;
  z-index: 2;
  left: 50%;
  translate: -50% 0;
}

.motion-switch-channel-tab b {
  top: 7px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  filter: drop-shadow(0 6px 8px rgba(94, 0, 28, 0.18));
  transform-origin: center bottom;
}

.motion-switch-channel-tab.is-active b {
  width: 44px;
  height: 44px;
  transform: translateY(-2px);
}

.motion-switch-channel-tab em {
  top: 52px;
  box-sizing: border-box;
  min-width: 50px;
  max-width: 78px;
  height: 20px;
  padding: 4px 10px;
  overflow: hidden;
  border-radius: 999px;
  color: #ffffff;
  font-style: normal;
  line-height: 12px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.motion-switch-channel-tab.is-active em,
.motion-switch-channel-tab.is-activating em,
.motion-switch-channel-tab.is-deactivating em {
  background: var(--motion-active-color, #ff003d);
}

.motion-switch-channel-tab:not(.is-active):not(.is-activating):not(.is-deactivating) em {
  background: transparent;
}

.motion-switch-channel-tab.is-activating em {
  opacity: 0;
}

.motion-skill-horizontal-switch-channel-tab .motion-skill-foreground {
  display: none;
}

.channel-icon-star {
  background-image: url("${CHANNEL_TAB_ICON_DATA_URIS.star}");
}

.channel-icon-alarm {
  background-image: url("${CHANNEL_TAB_ICON_DATA_URIS.alarm}");
}

.channel-icon-moon {
  background-image: url("${CHANNEL_TAB_ICON_DATA_URIS.moon}");
}

.channel-icon-chart {
  background-image: url("${CHANNEL_TAB_ICON_DATA_URIS.chart}");
}

.channel-icon-sale {
  background-image: url("${CHANNEL_TAB_ICON_DATA_URIS.sale}");
}

.channel-icon-basket {
  background-image: url("${CHANNEL_TAB_ICON_DATA_URIS.basket}");
}`;
  }
  return "";
}

function baseFiles(tokens: AtomicMotionToken[], recipe: MotionSkillRecipe): SourceFile[] {
  const foregroundSize = foregroundLayerSize(recipe);
  const size = stageSize(recipe);
  const defaultBackgroundImage =
    recipe.family === "front-back-entry" && recipe.variant === "swipe-action"
      ? FRONT_BACK_SWIPE_BACKGROUND_IMAGE
      : EMPTY_IMAGE_SRC;
  const defaultForegroundImage =
    recipe.family === "front-back-entry" && recipe.variant === "swipe-action"
      ? FRONT_BACK_SWIPE_FOREGROUND_IMAGE
      : EMPTY_IMAGE_SRC;

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
        <img class="motion-skill-layer-image" data-motion="backgroundImage" src="${defaultBackgroundImage}" alt="" />
${backgroundMarkup(recipe)}
      </section>
      <section class="motion-skill-foreground" data-motion="foregroundLayer">
        <img class="motion-skill-layer-image" data-motion="foregroundImage" src="${defaultForegroundImage}" alt="" />
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
  --foreground-layer-radius: ${foregroundLayerRadius(recipe)}px;
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
  border-radius: var(--foreground-layer-radius, 24px);
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

function motionTargetLayerIds(recipe: MotionSkillRecipe): string[] {
  if (recipe.family === "front-back-entry" && recipe.variant === "swipe-action") {
    return ["foregroundLayer", "swipeLayer1", "swipeLayer2", "swipeLayer3", "swipeLayer4", "swipeLayer5"];
  }
  if (recipe.family === "horizontal-switch" && recipe.variant === "tabbar") return ["tabbarLayer"];
  return ["foregroundLayer"];
}

function motionTargetSelector(recipe: MotionSkillRecipe): string {
  if (recipe.family === "front-back-entry" && recipe.variant === "swipe-action")
    return "[data-motion=swipeLayer1]";
  if (recipe.family === "horizontal-switch" && recipe.variant === "tabbar")
    return "[data-motion=tabbarLayer]";
  return "[data-motion=foregroundLayer]";
}

function frontBackEntrySwipeActionScript(): string {
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const swipeThresholdPx = 48;
  const openDistance = ${FRONT_BACK_SWIPE_ACTION_OPEN_DISTANCE};
  let startX = 0;
  let startY = 0;
  let dragStartX = 0;
  let currentX = 0;
  let isDragging = false;
  let settleTimer;

  function setDragPosition(x) {
    if (!(root instanceof HTMLElement)) return;
    const clamped = Math.min(0, Math.max(openDistance, x));
    root.style.setProperty("--swipe-foreground-x", \`\${clamped}px\`);
    currentX = clamped;
  }

  function settleTo(x) {
    if (!(root instanceof HTMLElement)) return;
    window.clearTimeout(settleTimer);
    root.classList.remove("is-dragging");
    root.classList.add("is-settling");
    setDragPosition(x);
    settleTimer = window.setTimeout(() => {
      root.classList.remove("is-settling");
    }, 240);
  }

  function replay() {
    settleTo(openDistance);
  }

  function reverse() {
    settleTo(0);
  }

  if (root instanceof HTMLElement) {
    root.style.setProperty("--swipe-open-distance", \`\${openDistance}px\`);
    root.addEventListener("selectstart", (event) => event.preventDefault());
    root.addEventListener("pointerdown", (event) => {
      window.clearTimeout(settleTimer);
      isDragging = true;
      dragStartX = event.clientX;
      startX = event.clientX - currentX;
      startY = event.clientY;
      root.classList.remove("is-settling");
      root.classList.add("is-dragging");
      event.preventDefault();
      root.setPointerCapture?.(event.pointerId);
    });
    root.addEventListener("pointermove", (event) => {
      if (!isDragging) return;
      const nextX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(nextX - currentX) <= Math.abs(deltaY) && Math.abs(deltaY) > swipeThresholdPx) return;
      event.preventDefault();
      setDragPosition(nextX);
    });
    root.addEventListener("pointerup", (event) => {
      if (!isDragging) return;
      isDragging = false;
      root.releasePointerCapture?.(event.pointerId);
      const deltaX = event.clientX - dragStartX;
      if (deltaX > swipeThresholdPx) reverse();
      else if (currentX <= openDistance / 2 || deltaX < -swipeThresholdPx) replay();
      else reverse();
    });
    root.addEventListener("pointercancel", () => {
      isDragging = false;
      reverse();
    });
  }

  window.motionReplay = replay;
  window.motionReverse = reverse;
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function horizontalSwitchToggleScript(): string {
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const DURATION_MS = 220;
  let isOn = false;
  let timeoutId;

  function clearToggleClasses() {
    if (!(root instanceof HTMLElement)) return;
    root.classList.remove("is-playing", "is-toggling-on", "is-toggling-off");
  }

  function settle(nextIsOn) {
    if (!(root instanceof HTMLElement)) return;
    clearToggleClasses();
    isOn = nextIsOn;
    root.classList.toggle("is-on", isOn);
    root.setAttribute("aria-checked", String(isOn));
  }

  function play(nextIsOn) {
    if (!(root instanceof HTMLElement)) return;
    window.clearTimeout(timeoutId);
    clearToggleClasses();
    root.classList.toggle("is-on", !nextIsOn);
    void root.offsetWidth;
    root.classList.add(nextIsOn ? "is-toggling-on" : "is-toggling-off");
    timeoutId = window.setTimeout(() => settle(nextIsOn), DURATION_MS);
  }

  function toggle() {
    play(!isOn);
  }

  if (root instanceof HTMLElement) {
    root.setAttribute("role", "switch");
    root.setAttribute("aria-checked", "false");
    root.tabIndex = 0;
    root.addEventListener("click", toggle);
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  }

  window.motionReplay = function motionReplay() {
    play(true);
  };
  window.motionReverse = function motionReverse() {
    play(false);
  };
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function horizontalSwitchSegmentedScript(): string {
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const track = document.querySelector(".motion-switch-segmented-track");
  const options = Array.from(document.querySelectorAll(".motion-switch-segmented-option"));
  const DURATION_MS = 200;
  let activeIndex = 0;
  let timeoutId;

  function clearMotionClasses() {
    if (!(track instanceof HTMLElement)) return;
    track.classList.remove("is-moving-left", "is-moving-right");
  }

  function render(nextIndex) {
    if (!(track instanceof HTMLElement)) return;
    activeIndex = nextIndex;
    track.dataset.activeIndex = String(activeIndex);
    options.forEach((option, index) => {
      option.classList.toggle("is-active", index === activeIndex);
      option.setAttribute("aria-pressed", String(index === activeIndex));
    });
  }

  function settle() {
    clearMotionClasses();
  }

  function select(nextIndex) {
    if (!(track instanceof HTMLElement)) return;
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= options.length) return;
    window.clearTimeout(timeoutId);
    const directionClass = nextIndex > activeIndex ? "is-moving-right" : "is-moving-left";
    root?.classList.remove("is-playing");
    clearMotionClasses();
    void track.offsetWidth;
    track.classList.add(directionClass);
    render(nextIndex);
    timeoutId = window.setTimeout(settle, DURATION_MS);
  }

  options.forEach((option, index) => {
    option.addEventListener("click", () => select(index));
  });

  window.motionReplay = function motionReplay() {
    select(1);
  };
  window.motionReverse = function motionReverse() {
    select(0);
  };
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function horizontalSwitchIndicatorScript(): string {
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const dots = Array.from(document.querySelectorAll(".motion-switch-indicator-dot"));
  const DURATION_MS = 220;
  let activeIndex = 0;
  let timeoutId;

  function clearMotionClasses() {
    for (const dot of dots) {
      dot.classList.remove("is-growing", "is-shrinking");
    }
  }

  function settle(nextIndex) {
    clearMotionClasses();
    activeIndex = nextIndex;
    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeIndex);
      dot.setAttribute("aria-pressed", String(index === activeIndex));
    });
  }

  function select(nextIndex) {
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= dots.length) return;
    window.clearTimeout(timeoutId);
    const previousDot = dots[activeIndex];
    const nextDot = dots[nextIndex];
    if (!previousDot || !nextDot) return;
    clearMotionClasses();
    previousDot.classList.remove("is-active");
    previousDot.classList.add("is-shrinking");
    nextDot.classList.add("is-growing");
    timeoutId = window.setTimeout(() => settle(nextIndex), DURATION_MS);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => select(index));
  });

  window.motionReplay = function motionReplay() {
    select(Math.min(activeIndex + 1, dots.length - 1));
  };
  window.motionReverse = function motionReverse() {
    select(Math.max(activeIndex - 1, 0));
  };
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function horizontalSwitchChannelTabScript(): string {
  return `(() => {
  const tabs = Array.from(document.querySelectorAll(".motion-switch-channel-tab"));
  const activeBg = document.querySelector(".motion-switch-channel-active-bg");
  const DURATION_MS = 220;
  const ACTIVE_BG_WIDTH = 128;
  let activeIndex = Math.max(0, tabs.findIndex((tab) => tab.classList.contains("is-active")));
  let timeoutId;

  function clearMotionClasses() {
    for (const tab of tabs) tab.classList.remove("is-activating", "is-deactivating");
    activeBg?.classList.remove("is-moving");
    activeBg?.style.removeProperty("--channel-active-bg-from-x");
    activeBg?.style.removeProperty("--channel-active-bg-to-x");
    activeBg?.style.removeProperty("--channel-active-bg-overshoot-x");
  }

  function activeBgX(tab) {
    return tab.offsetLeft + tab.offsetWidth / 2 - ACTIVE_BG_WIDTH / 2;
  }

  function moveActiveBg(previousTab, nextTab) {
    if (!(activeBg instanceof HTMLElement)) return;
    const fromX = activeBgX(previousTab);
    const toX = activeBgX(nextTab);
    const delta = toX - fromX;
    const overshootX = delta === 0 ? toX : toX + Math.sign(delta) * 4;
    activeBg.style.setProperty("--channel-active-bg-from-x", fromX + "px");
    activeBg.style.setProperty("--channel-active-bg-to-x", toX + "px");
    activeBg.style.setProperty("--channel-active-bg-overshoot-x", overshootX + "px");
    activeBg.classList.remove("is-moving");
    void activeBg.offsetWidth;
    activeBg.classList.add("is-moving");
  }

  function settle(nextIndex) {
    clearMotionClasses();
    activeIndex = nextIndex;
    tabs.forEach((tab, index) => {
      tab.classList.toggle("is-active", index === activeIndex);
      tab.setAttribute("aria-pressed", String(index === activeIndex));
    });
    const activeTab = tabs[activeIndex];
    if (activeBg instanceof HTMLElement && activeTab instanceof HTMLElement) {
      activeBg.style.transform = "translateX(" + activeBgX(activeTab) + "px)";
    }
  }

  function select(nextIndex) {
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= tabs.length) return;
    window.clearTimeout(timeoutId);
    const previousTab = tabs[activeIndex];
    const nextTab = tabs[nextIndex];
    if (!previousTab || !nextTab) return;
    clearMotionClasses();
    moveActiveBg(previousTab, nextTab);
    previousTab.classList.add("is-deactivating");
    nextTab.classList.add("is-activating");
    timeoutId = window.setTimeout(() => settle(nextIndex), DURATION_MS);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index));
  });

  window.motionReplay = function motionReplay() {
    select(Math.min(activeIndex + 1, tabs.length - 1));
  };
  window.motionReverse = function motionReverse() {
    select(Math.max(activeIndex - 1, 0));
  };
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function horizontalSwitchTabbarScript(): string {
  return `(() => {
  const shell = document.querySelector(".motion-switch-tabbar-shell");
  const activeBg = document.querySelector(".motion-switch-tabbar-active-bg");
  const items = Array.from(document.querySelectorAll(".motion-switch-tabbar-shell button"));
  const DURATION_MS = 300;
  const ITEM_STEP = 61.4;
  let activeIndex = Math.max(0, items.findIndex((item) => item.classList.contains("is-active")));
  let timeoutId;

  function clearMotionClasses() {
    for (const item of items) item.classList.remove("is-activating", "is-deactivating");
    activeBg?.classList.remove("is-moving");
    activeBg?.style.removeProperty("--tabbar-bg-from-x");
    activeBg?.style.removeProperty("--tabbar-bg-to-x");
  }

  function render(nextIndex) {
    activeIndex = nextIndex;
    if (shell instanceof HTMLElement) {
      shell.style.setProperty("--tabbar-active-index", String(activeIndex));
    }
    items.forEach((item, index) => {
      item.classList.toggle("is-active", index === activeIndex);
      item.setAttribute("aria-pressed", String(index === activeIndex));
    });
  }

  function moveActiveBg(previousIndex, nextIndex) {
    if (!(activeBg instanceof HTMLElement)) return;
    activeBg.style.setProperty("--tabbar-bg-from-x", previousIndex * ITEM_STEP + "px");
    activeBg.style.setProperty("--tabbar-bg-to-x", nextIndex * ITEM_STEP + "px");
    activeBg.classList.remove("is-moving");
    void activeBg.offsetWidth;
    activeBg.classList.add("is-moving");
  }

  function settle(nextIndex) {
    clearMotionClasses();
    render(nextIndex);
  }

  function select(nextIndex) {
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= items.length) return;
    window.clearTimeout(timeoutId);
    const previousItem = items[activeIndex];
    const nextItem = items[nextIndex];
    if (!previousItem || !nextItem) return;
    clearMotionClasses();
    previousItem.classList.remove("is-active");
    previousItem.classList.add("is-deactivating");
    nextItem.classList.add("is-activating");
    moveActiveBg(activeIndex, nextIndex);
    timeoutId = window.setTimeout(() => settle(nextIndex), DURATION_MS);
  }

  items.forEach((item, index) => {
    item.addEventListener("click", () => select(index));
  });
  render(activeIndex);

  window.motionReplay = function motionReplay() {
    render(activeIndex);
  };
  window.motionReverse = function motionReverse() {
    render(activeIndex);
  };
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function horizontalSwitchTabNavigationScript(): string {
  return `(() => {
  const tabList = document.querySelector(".motion-switch-text-tabs");
  const tabs = Array.from(document.querySelectorAll(".motion-switch-text-tab"));
  const DURATION_MS = 300;
  let activeIndex = Math.max(0, tabs.findIndex((tab) => tab.classList.contains("is-active")));
  let timeoutId;

  function settle(nextIndex) {
    if (!(tabList instanceof HTMLElement)) return;
    activeIndex = nextIndex;
    tabList.dataset.activeIndex = String(activeIndex);
    tabList.classList.remove("is-moving");
    tabs.forEach((tab, index) => {
      tab.classList.toggle("is-active", index === activeIndex);
      tab.setAttribute("aria-pressed", String(index === activeIndex));
    });
  }

  function select(nextIndex) {
    if (!(tabList instanceof HTMLElement)) return;
    if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= tabs.length) return;
    window.clearTimeout(timeoutId);
    tabList.dataset.activeIndex = String(nextIndex);
    tabList.classList.remove("is-moving");
    void tabList.offsetWidth;
    tabList.classList.add("is-moving");
    tabs.forEach((tab, index) => {
      tab.classList.toggle("is-active", index === nextIndex);
      tab.setAttribute("aria-pressed", String(index === nextIndex));
    });
    timeoutId = window.setTimeout(() => settle(nextIndex), DURATION_MS);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index));
  });

  window.motionReplay = function motionReplay() {
    select(Math.min(activeIndex + 1, tabs.length - 1));
  };
  window.motionReverse = function motionReverse() {
    select(Math.max(activeIndex - 1, 0));
  };
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function contentLoadingGlobalScript(): string {
  return `(() => {
  const root = document.querySelector("[data-motion-root]");

  function replay() {
    if (!(root instanceof HTMLElement)) return;
    root.classList.remove("is-playing");
    void root.offsetWidth;
    root.classList.add("is-playing");
  }

  window.motionReplay = replay;
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };

  requestAnimationFrame(replay);
})();`;
}

function contentFeedbackSelectionScript(): string {
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const target = document.querySelector("[data-motion=foregroundLayer]");

  function playSelected() {
    if (!(root instanceof HTMLElement)) return;
    root.classList.add("is-selected");
    root.classList.remove("is-playing");
    void root.offsetWidth;
    root.classList.add("is-playing");
  }

  function resetSelected() {
    if (!(root instanceof HTMLElement)) return;
    root.classList.remove("is-selected", "is-playing");
    if (target instanceof HTMLElement) target.setAttribute("aria-checked", "false");
  }

  function toggleSelected() {
    if (!(root instanceof HTMLElement)) return;
    if (root.classList.contains("is-selected")) {
      resetSelected();
      return;
    }
    playSelected();
    if (target instanceof HTMLElement) target.setAttribute("aria-checked", "true");
  }

  if (target instanceof HTMLElement) {
    target.setAttribute("role", "checkbox");
    target.setAttribute("aria-checked", "false");
    target.tabIndex = 0;
    target.addEventListener("click", toggleSelected);
    target.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleSelected();
    });
  }

  window.motionReplay = playSelected;
  window.motionReverse = resetSelected;
  window.motionPause = function motionPause() {
    for (const animation of document.getAnimations({ subtree: true })) animation.pause();
  };
  window.motionSeek = function motionSeek(progress) {
    const nextProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    for (const animation of document.getAnimations({ subtree: true })) {
      if (!animation.effect) continue;
      const timing = animation.effect.getComputedTiming();
      if (Number.isFinite(timing.duration)) animation.currentTime = timing.duration * nextProgress;
    }
  };
})();`;
}

function filesWithVariantOverrides(files: SourceFile[], recipe: MotionSkillRecipe): SourceFile[] {
  if (recipe.family === "content-feedback" && recipe.variant === "selection") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: contentFeedbackSelectionScript() } : file
    );
  }
  if (recipe.family === "content-loading" && recipe.variant === "global") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: contentLoadingGlobalScript() } : file
    );
  }
  if (recipe.family === "front-back-entry" && recipe.variant === "swipe-action") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: frontBackEntrySwipeActionScript() } : file
    );
  }
  if (recipe.family !== "horizontal-switch") return files;
  if (recipe.variant === "tab-navigation") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: horizontalSwitchTabNavigationScript() } : file
    );
  }
  if (recipe.variant === "channel-tab") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: horizontalSwitchChannelTabScript() } : file
    );
  }
  if (recipe.variant === "tabbar") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: horizontalSwitchTabbarScript() } : file
    );
  }
  if (recipe.variant === "indicator") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: horizontalSwitchIndicatorScript() } : file
    );
  }
  if (recipe.variant === "segmented") {
    return files.map((file) =>
      file.path === "source/script.js" ? { ...file, content: horizontalSwitchSegmentedScript() } : file
    );
  }
  if (recipe.variant !== "switch") return files;
  return files.map((file) =>
    file.path === "source/script.js" ? { ...file, content: horizontalSwitchToggleScript() } : file
  );
}

function usesCustomSwipeActionFiles(recipe: MotionSkillRecipe): boolean {
  return recipe.family === "front-back-entry" && recipe.variant === "swipe-action";
}

export function createMotionSkillDraftComponent(input: {
  registry: MotionSkillRegistry;
  pack: MotionSkillPack;
  recipeId: string;
  trigger?: MotionSkillRecipe["trigger"];
  replayMode?: "once";
  now?: number;
}): MotionComponent {
  const recipe = input.pack.recipes.find((item) => item.id === input.recipeId);
  if (!recipe) throw new Error(`Unknown motion skill recipe: ${input.recipeId}`);
  const recipeWithTrigger = input.trigger ? { ...recipe, trigger: input.trigger } : recipe;

  const tokens = recipe.tokenIds.flatMap(
    (tokenId) => input.pack.tokens.find((token) => token.id === tokenId) ?? []
  );
  const motionRecipe = motionSkillRecipeToMotionRecipe({
    manifest: input.pack.manifest,
    recipe: recipeWithTrigger,
    tokens: input.pack.tokens
  });
  const replayableRecipe = input.replayMode
    ? {
        ...motionRecipe,
        bindings: {
          ...motionRecipe.bindings,
          replayMode: input.replayMode
        }
      }
    : motionRecipe;
  const layers = assetLayers(recipeWithTrigger);
  const sourceFiles = baseFiles(tokens, recipeWithTrigger);
  const applied = applyMotionRecipe({
    recipe: replayableRecipe,
    params: assetParams(recipeWithTrigger),
    layers,
    ...(usesCustomSwipeActionFiles(recipeWithTrigger) ? {} : { sourceFiles }),
    targetSelector: motionTargetSelector(recipeWithTrigger),
    targetLayerIds: motionTargetLayerIds(recipeWithTrigger),
    source: "model",
    confidence: 1
  });
  const files = filesWithVariantOverrides(applied.files ?? sourceFiles, recipeWithTrigger);
  const id = `generated-${input.pack.manifest.id}-${recipe.variant}-${input.now ?? Date.now()}`;
  const registryElement = input.registry.elements.find((element) => element.id === input.pack.manifest.id);
  const target = targetBinding(recipeWithTrigger);

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
      files
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
