import type { MotionComponent, SourceFile } from "../library/componentLibrary";
import type { MotionLayer, MotionManifest, MotionParam, MotionParamGroup } from "../manifest/types";
import { applyPatchToFiles } from "../patch/applyPatch";
import {
  applyMotionRecipe,
  createMotionRecipeCache,
  extractMotionRecipeFromComponent,
  findCachedMotionRecipe,
  motionRecipeRequestFromSemanticIntent,
  resolveMotionRecipe,
  validateRecipeApplication
} from "./motionRecipe";
import { validateGeneratedComponent, type GeneratedComponentValidationResult } from "./sandbox";
import {
  parseSemanticGenerationIntent,
  type SemanticGenerationColor,
  type SemanticGenerationDirection,
  type SemanticGenerationIntent,
  type SemanticGenerationRole
} from "./semanticIntent";
import {
  parseSemanticIntentV2Fallback,
  semanticIntentV2ToLegacyIntent,
  type SemanticIntentV2
} from "./semanticIntentV2";

export type ReferenceGuidedGenerationCoverage = {
  satisfied: string[];
  missing: string[];
};

export type ReferenceGuidedGenerationResult = {
  component: MotionComponent;
  intent: SemanticGenerationIntent;
  intentV2: SemanticIntentV2;
  coverage: ReferenceGuidedGenerationCoverage;
  validation: GeneratedComponentValidationResult;
  references: Array<{ id: string; name: string }>;
};

export type ReferenceGuidedSourceDraft = {
  html: string;
  css: string;
  js: string;
};

export type CreateReferenceGuidedComponentInput = {
  brief: string;
  references?: MotionComponent[];
  now?: number;
  sourceDraft?: ReferenceGuidedSourceDraft;
  intentV2?: SemanticIntentV2;
};

const DEFAULT_BUTTON_TEXT = "立即行动";
const DEFAULT_BUTTON_COLOR: SemanticGenerationColor = {
  target: "background",
  label: "蓝色",
  value: "#2563eb"
};
const DEFAULT_MOBILE_PAGE_SIZE = {
  stageWidth: 375,
  stageHeight: 812,
  backgroundLayerWidth: 375,
  backgroundLayerHeight: 812
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function cssDirectionVariables(direction: SemanticGenerationDirection | null): {
  xStart: string;
  xEnd: string;
  yStart: string;
  yEnd: string;
  label: string;
} {
  if (direction === "right-to-left") {
    return {
      xStart: "var(--travel-distance)",
      xEnd: "calc(var(--travel-distance) * -1)",
      yStart: "0",
      yEnd: "0",
      label: "right-to-left"
    };
  }
  if (direction === "top-to-bottom") {
    return {
      xStart: "0",
      xEnd: "0",
      yStart: "calc(var(--travel-distance) * -1)",
      yEnd: "var(--travel-distance)",
      label: "top-to-bottom"
    };
  }
  if (direction === "bottom-to-top") {
    return {
      xStart: "0",
      xEnd: "0",
      yStart: "var(--travel-distance)",
      yEnd: "calc(var(--travel-distance) * -1)",
      label: "bottom-to-top"
    };
  }
  return {
    xStart: "calc(var(--travel-distance) * -1)",
    xEnd: "var(--travel-distance)",
    yStart: "0",
    yEnd: "0",
    label: "left-to-right"
  };
}

function durationForIntent(intent: SemanticGenerationIntent): number {
  if (intent.speed === "fast") return 620;
  if (intent.speed === "slow") return 1200;
  return 900;
}

function easingForIntent(intent: SemanticGenerationIntent): string {
  return intent.effects.includes("elastic") || intent.effects.includes("bounce")
    ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
    : "ease-out";
}

function motionKindForIntent(intent: SemanticGenerationIntent): string {
  const hasBounce = intent.effects.includes("bounce") || intent.effects.includes("elastic");
  const hasSlide = intent.effects.includes("slide") || intent.direction !== null;
  if (hasSlide && hasBounce) return "slide-bounce";
  if (hasSlide) return "slide";
  if (hasBounce) return "bounce";
  if (intent.effects.includes("rotate")) return "rotate";
  if (intent.effects.includes("fade")) return "fade";
  if (intent.effects.includes("glow")) return "glow";
  if (intent.effects.includes("pulse")) return "pulse";
  if (intent.effects.includes("scale")) return "scale";
  return "scale";
}

function animationNameForIntent(input: {
  intent: SemanticGenerationIntent;
  directionLabel: string;
  motionKind: string;
}): string {
  if (
    input.motionKind === "slide-bounce" &&
    input.intent.trigger !== "click" &&
    input.intent.trigger !== "hover"
  ) {
    return `generated-${input.directionLabel}-slide-bounce`;
  }
  return `generated-${input.intent.trigger}-${input.motionKind}`;
}

function keyframesForMotion(input: {
  name: string;
  motionKind: string;
  glow: boolean;
}): string {
  if (input.motionKind === "slide-bounce") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0;
    transform: translate(var(--travel-x-start), var(--travel-y-start)) scale(0.96);
  }
  58% {
    opacity: 1;
    transform: translate(0, 0) scale(var(--bounce-scale));
  }
  76% {
    opacity: 1;
    transform: translate(calc(var(--travel-x-end) * 0.16), calc(var(--travel-y-end) * 0.16)) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translate(var(--travel-x-end), var(--travel-y-end)) scale(1);
  }
}`;
  }
  if (input.motionKind === "slide") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0;
    transform: translate(var(--travel-x-start), var(--travel-y-start)) scale(1);
  }
  100% {
    opacity: 1;
    transform: translate(var(--travel-x-end), var(--travel-y-end)) scale(1);
  }
}`;
  }
  if (input.motionKind === "rotate") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0.88;
    transform: scale(0.96) rotate(0deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(360deg);
  }
}`;
  }
  if (input.motionKind === "fade") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0;
    transform: scale(0.98);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}`;
  }
  if (input.motionKind === "glow") {
    return `@keyframes ${input.name} {
  0% {
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.16);
    transform: scale(1);
  }
  55% {
    box-shadow: 0 22px 54px color-mix(in srgb, var(--button-bg) 52%, transparent);
    transform: scale(1.04);
  }
  100% {
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.18);
    transform: scale(1);
  }
}`;
  }
  if (input.motionKind === "scale") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0.92;
    transform: scale(0.86);
  }
  70% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}`;
  }
  if (input.motionKind === "pulse") {
    return `@keyframes ${input.name} {
  0% {
    opacity: 0.72;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 0.72;
    transform: scale(0.92);
  }
}`;
  }
  return `@keyframes ${input.name} {
  0% {
    opacity: 0.92;
    transform: scale(0.92);
  }
  55% {
    opacity: 1;
    transform: scale(var(--bounce-scale));
  }
  78% {
    opacity: 1;
    transform: scale(0.97);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}`;
}

function sourceFilesForButton(intent: SemanticGenerationIntent): SourceFile[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const label = escapeHtml(intent.text ?? DEFAULT_BUTTON_TEXT);
  const direction = cssDirectionVariables(intent.direction);
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const glow = intent.effects.includes("glow");
  const motionKind = motionKindForIntent(intent);
  const animationName = animationNameForIntent({ intent, directionLabel: direction.label, motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow });
  const hasTravel = motionKind === "slide" || motionKind === "slide-bounce";
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const playSelector = intent.trigger === "hover" ? ".semantic-button:hover" : ".semantic-stage.is-playing .semantic-button";
  const baseTransform = hasTravel
    ? "translate(var(--travel-x-start), var(--travel-y-start)) scale(1)"
    : "scale(1) rotate(0deg)";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成按钮</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成按钮">
      <button class="semantic-button" data-motion="buttonLabel" type="button">${label}</button>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --button-bg: ${color.value};
  --button-text: #ffffff;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --travel-distance: 42vw;
  --bounce-scale: 1.14;
  --travel-x-start: ${direction.xStart};
  --travel-x-end: ${direction.xEnd};
  --travel-y-start: ${direction.yStart};
  --travel-y-end: ${direction.yEnd};
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  --stage-width: 390px;
  --stage-height: 220px;
  display: grid;
  place-items: center;
  width: var(--stage-width);
  height: var(--stage-height);
}

.semantic-button {
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  min-width: 132px;
  padding: 16px 24px;
  box-shadow: ${glow ? "0 18px 48px color-mix(in srgb, var(--button-bg) 42%, transparent)" : "0 14px 28px rgba(15, 23, 42, 0.18)"};
  transform: ${baseTransform};
  transform-origin: center;
  will-change: transform, opacity, box-shadow;
}

${playSelector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

.semantic-button:hover {
  filter: brightness(1.04);
}

${keyframes}`;
  const js = `(() => {
  const root = document.querySelector("[data-motion-root]");
  const button = document.querySelector("[data-motion=buttonLabel]");

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

  ${intent.trigger === "click" ? 'if (button instanceof HTMLElement) button.addEventListener("click", replay);' : ""}
  ${intent.trigger === "load" || intent.trigger === "loop" ? "requestAnimationFrame(replay);" : ""}
})();`;

  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: js }
  ];
}

function cardDescriptionForIntent(intent: SemanticGenerationIntent): string {
  const match = intent.raw.match(/(?:描述|说明|内容|副标题|description)\s*(?:是|为|:|：)?\s*([^，。；;\n]{1,80})/i);
  return match?.[1]?.trim().replace(/^["'「『“]+|["'」』”]+$/g, "") || "用清晰的层次呈现关键信息";
}

function replayScript(input: {
  targetSelector: string;
  trigger: SemanticGenerationIntent["trigger"];
  autoReplay?: boolean;
}): string {
  const shouldAutoReplay = input.autoReplay ?? (input.trigger === "load" || input.trigger === "loop");
  return `(() => {
  const root = document.querySelector("[data-motion-root]");
  const target = document.querySelector("${input.targetSelector}");

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

  ${input.trigger === "click" ? 'if (target instanceof HTMLElement) target.addEventListener("click", replay);' : ""}
  ${shouldAutoReplay ? "requestAnimationFrame(replay);" : ""}
})();`;
}

function sourceFilesForText(intent: SemanticGenerationIntent): SourceFile[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const label = escapeHtml(intent.text ?? "精彩标题");
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const motionKind = motionKindForIntent(intent);
  const animationName = animationNameForIntent({ intent, directionLabel: "text", motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow: intent.effects.includes("glow") });
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const selector = intent.trigger === "hover" ? ".semantic-text:hover" : ".semantic-stage.is-playing .semantic-text";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成标题</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成标题">
      <h1 class="semantic-text" data-motion="textContent">${label}</h1>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --text-color: ${color.value};
  --font-size: 42px;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --travel-distance: 24px;
  --bounce-scale: 1.08;
  --travel-x-start: 0;
  --travel-x-end: 0;
  --travel-y-start: 24px;
  --travel-y-end: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 320px;
  min-height: 180px;
}

.semantic-text {
  margin: 0;
  color: var(--text-color);
  font-size: var(--font-size);
  font-weight: 800;
  line-height: 1.1;
  transform: scale(1);
  will-change: transform, opacity, box-shadow;
}

${selector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

${keyframes}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=textContent]", trigger: intent.trigger }) }
  ];
}

function sourceFilesForCard(intent: SemanticGenerationIntent): SourceFile[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const title = escapeHtml(intent.text ?? "信息卡片");
  const description = escapeHtml(cardDescriptionForIntent(intent));
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const motionKind = motionKindForIntent(intent);
  const animationName = animationNameForIntent({ intent, directionLabel: "card", motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow: intent.effects.includes("glow") });
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const selector = intent.trigger === "hover" ? ".semantic-card:hover" : ".semantic-stage.is-playing .semantic-card";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成卡片</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成卡片">
      <article class="semantic-card" data-motion="cardRoot">
        <h2 data-motion="cardTitle">${title}</h2>
        <p data-motion="cardDescription">${description}</p>
      </article>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --card-bg: ${color.value};
  --card-text: #ffffff;
  --card-radius: 18px;
  --card-shadow: 28px;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --travel-distance: 28px;
  --bounce-scale: 1.06;
  --travel-x-start: 0;
  --travel-x-end: 0;
  --travel-y-start: 26px;
  --travel-y-end: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 360px;
  min-height: 240px;
}

.semantic-card {
  width: min(320px, 86vw);
  border-radius: var(--card-radius);
  background: var(--card-bg);
  color: var(--card-text);
  padding: 28px;
  box-shadow: 0 var(--card-shadow) 60px color-mix(in srgb, var(--card-bg) 28%, transparent);
  transform: scale(1);
  will-change: transform, opacity, box-shadow;
}

.semantic-card h2 {
  margin: 0 0 10px;
  font-size: 24px;
}

.semantic-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.6;
}

${selector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

${keyframes}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=cardRoot]", trigger: intent.trigger }) }
  ];
}

function sourceFilesForBadge(intent: SemanticGenerationIntent): SourceFile[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const label = escapeHtml(intent.text ?? "标签");
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const pulseIntent: SemanticGenerationIntent = intent.effects.length > 0 ? intent : { ...intent, effects: ["pulse"] };
  const motionKind = motionKindForIntent(pulseIntent);
  const animationName = animationNameForIntent({ intent, directionLabel: "badge", motionKind });
  const keyframes = keyframesForMotion({ name: animationName, motionKind, glow: intent.effects.includes("glow") });
  const stageClass = intent.trigger === "click" || intent.trigger === "hover" ? "semantic-stage" : "semantic-stage is-playing";
  const selector = intent.trigger === "hover" ? ".semantic-badge:hover" : ".semantic-stage.is-playing .semantic-badge";
  const loop = intent.trigger === "loop" ? " infinite" : "";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成标签</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="${stageClass}" data-motion-root aria-label="语义生成标签">
      <span class="semantic-badge" data-motion="badgeText">${label}</span>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --badge-bg: ${color.value};
  --badge-text: #ffffff;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
  --bounce-scale: 1.12;
  --travel-x-start: 0;
  --travel-x-end: 0;
  --travel-y-start: 0;
  --travel-y-end: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 260px;
  min-height: 160px;
}

.semantic-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--badge-bg);
  color: var(--badge-text);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0;
  min-width: 64px;
  padding: 10px 18px;
  box-shadow: 0 14px 34px color-mix(in srgb, var(--badge-bg) 34%, transparent);
  transform: scale(1);
  will-change: transform, opacity, box-shadow;
}

${selector} {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both${loop};
}

${keyframes}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=badgeText]", trigger: intent.trigger }) }
  ];
}

function sourceFilesForLoader(intent: SemanticGenerationIntent): SourceFile[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const duration = durationForIntent({ ...intent, speed: intent.speed === "normal" ? "fast" : intent.speed });
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成加载动画</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-stage is-playing" data-motion-root aria-label="语义生成加载动画">
      <div class="semantic-loader semantic-loader-dots" data-motion="loaderRoot" role="status" aria-label="加载中">
        <span class="semantic-loader-dot"></span>
        <span class="semantic-loader-dot"></span>
        <span class="semantic-loader-dot"></span>
      </div>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --loader-color: ${color.value};
  --loader-size: 16px;
  --motion-duration: ${duration}ms;
  --motion-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  background: transparent;
}

.semantic-stage {
  display: grid;
  place-items: center;
  min-width: 240px;
  min-height: 160px;
}

.semantic-loader {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--loader-size) * 0.55);
}

.semantic-loader-dot {
  width: var(--loader-size);
  height: var(--loader-size);
  border-radius: 999px;
  background: var(--loader-color);
  animation: generated-loop-dots var(--motion-duration) var(--motion-easing) infinite;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--loader-color) 34%, transparent);
}

.semantic-loader-dot:nth-child(2) {
  animation-delay: calc(var(--motion-duration) * 0.16);
}

.semantic-loader-dot:nth-child(3) {
  animation-delay: calc(var(--motion-duration) * 0.32);
}

@keyframes generated-loop-dots {
  0%,
  80%,
  100% {
    opacity: 0.5;
    transform: translateY(0) scale(0.86);
  }
  40% {
    opacity: 1;
    transform: translateY(-14px) scale(1.08);
  }
}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion=loaderRoot]", trigger: "loop" }) }
  ];
}

function sourceFilesForMobilePage(intent: SemanticGenerationIntent): SourceFile[] {
  const color = intent.colors[0] ?? {
    target: "background",
    label: "紫色",
    value: "#8b5cf6"
  };
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const animationName = "generated-load-foreground-scale";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>语义生成移动端页面</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-mobile-page is-playing" data-motion-root aria-label="语义生成移动端页面">
      <section class="mobile-screen" data-motion="mobileScreen">
        <div class="background-layer" data-motion="backgroundLayer"></div>
        <div class="foreground-layer" data-motion="foregroundLayer">
          <span class="foreground-title"></span>
          <span class="foreground-line is-wide"></span>
          <span class="foreground-line"></span>
        </div>
      </section>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --stage-width: ${DEFAULT_MOBILE_PAGE_SIZE.stageWidth}px;
  --stage-height: ${DEFAULT_MOBILE_PAGE_SIZE.stageHeight}px;
  --background-layer-width: ${DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerWidth}px;
  --background-layer-height: ${DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerHeight}px;
  --page-bg: #f8fafc;
  --foreground-bg: ${color.value};
  --foreground-scale-start: 0.72;
  --foreground-scale-end: 1;
  --motion-duration: ${duration}ms;
  --motion-easing: ${easing};
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: transparent;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-mobile-page {
  display: grid;
  place-items: center;
  width: var(--stage-width);
  height: var(--stage-height);
  max-width: 92vw;
  max-height: 92vh;
}

.mobile-screen {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 42px;
  background: var(--page-bg);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
  isolation: isolate;
}

.background-layer,
.foreground-layer {
  position: absolute;
}

.background-layer {
  left: calc((100% - var(--background-layer-width)) / 2);
  top: calc((100% - var(--background-layer-height)) / 2);
  width: var(--background-layer-width);
  height: var(--background-layer-height);
  background:
    radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--foreground-bg) 20%, transparent), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #eef2ff 100%);
}

.foreground-layer {
  right: 28px;
  bottom: 92px;
  left: 28px;
  display: grid;
  gap: 14px;
  min-height: 220px;
  border-radius: 32px;
  background: var(--foreground-bg);
  padding: 28px;
  box-shadow: 0 28px 70px color-mix(in srgb, var(--foreground-bg) 30%, transparent);
  opacity: 0;
  transform: scale(var(--foreground-scale-start));
  transform-origin: 50% 72%;
  will-change: opacity, transform;
}

.foreground-title,
.foreground-line {
  display: block;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
}

.foreground-title {
  width: 52%;
  height: 28px;
}

.foreground-line {
  width: 58%;
  height: 14px;
}

.foreground-line.is-wide {
  width: 82%;
}

.is-playing .foreground-layer {
  animation: ${animationName} var(--motion-duration) var(--motion-easing) both;
}

@keyframes ${animationName} {
  0% {
    opacity: 0;
    transform: scale(var(--foreground-scale-start)) translateY(28px);
  }
  68% {
    opacity: 1;
    transform: scale(1.04) translateY(0);
  }
  100% {
    opacity: 1;
    transform: scale(var(--foreground-scale-end)) translateY(0);
  }
}`;
  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    {
      path: "source/script.js",
      kind: "js",
      content: replayScript({ targetSelector: "[data-motion=foregroundLayer]", trigger: intent.trigger })
    }
  ];
}

function explicitNumberAfter(raw: string, label: RegExp): number | null {
  const match = raw.match(label);
  const value = match?.[1] ? Number(match[1]) : NaN;
  return Number.isFinite(value) ? value : null;
}

function pageTransitionValues(intent: SemanticGenerationIntent): Record<string, unknown> {
  const raw = intent.raw;
  const explicitDuration = explicitNumberAfter(raw, /(?:循环时长|时长|duration)[^\d]{0,12}(\d{3,5})\s*ms/i);
  const explicitEnterDistance = explicitNumberAfter(raw, /(?:进入距离|enterDistance|enter distance)[^\d]{0,12}(\d{2,4})\s*px/i);
  const explicitOpacity = explicitNumberAfter(raw, /(?:泛白|过渡泛白|transitionOpacity|opacity)[^\d]{0,12}(0?\.\d+)/i);
  const explicitRadius = explicitNumberAfter(raw, /(?:圆角|windowRadius|radius)[^\d]{0,12}(\d{1,3})\s*px?/i);
  const wantsShorterTravel = /(距离.*短|短一点|更短|轨迹.*短|滑动.*短)/i.test(raw);
  const wantsLongerTravel = /(距离.*长|长一点|更长|轨迹.*长|滑动.*长)/i.test(raw);
  const wantsWeakerWash = /(泛白.*弱|泛白.*轻|过渡.*轻|更轻|降低.*泛白|泛白降低|弱一点)/i.test(raw);
  const wantsStrongerWash = /(泛白.*强|更强.*泛白|过渡.*明显)/i.test(raw);
  const wantsSmallerRadius = /(圆角.*小|更小.*圆角|圆角小|方一点|更方)/i.test(raw);
  const wantsLargerRadius = /(圆角.*大|更圆|圆润)/i.test(raw);
  const avoidsOvershoot = /(无过冲|不要.*过冲|别.*过冲|不需要.*过冲|干脆)/i.test(raw);

  const enterDistance = clamp(
    explicitEnterDistance ?? (wantsShorterTravel ? 360 : wantsLongerTravel ? 680 : 520),
    0,
    1118
  );
  const cycleDuration = clamp(
    explicitDuration ?? (intent.speed === "fast" ? 1840 : intent.speed === "slow" ? 3600 : 2640),
    1400,
    5000
  );
  const transitionOpacity = clamp(
    explicitOpacity ?? (wantsWeakerWash ? 0.35 : wantsStrongerWash ? 0.82 : 0.72),
    0,
    0.9
  );
  const windowRadius = clamp(
    explicitRadius ?? (wantsSmallerRadius ? 48 : wantsLargerRadius ? 120 : 92),
    0,
    160
  );

  return {
    cycleDuration,
    enterDistance,
    exitDistance: -enterDistance,
    transitionOpacity,
    windowRadius,
    easing: avoidsOvershoot ? "cubic-bezier(0.2, 0.82, 0.2, 1)" : "cubic-bezier(0.18, 0.86, 0.22, 1)"
  };
}

function sourceFilesForPageTransition(intent: SemanticGenerationIntent): SourceFile[] {
  const values = pageTransitionValues(intent);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>语义生成页面转场</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-page-transition is-playing" data-motion-root aria-label="语义生成页面转场">
      <section class="screen-window" data-motion="screenWindow">
        <div class="screen-layer mine-content" data-motion="frontPage"></div>
        <div class="screen-layer orders-content" data-motion="backPage"></div>
        <div class="screen-wash" data-motion="transitionWash"></div>
      </section>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --cycle-duration: ${values.cycleDuration}ms;
  --enter-distance: ${values.enterDistance}px;
  --exit-distance: ${values.exitDistance}px;
  --transition-opacity: ${values.transitionOpacity};
  --window-radius: ${values.windowRadius}px;
  --motion-easing: ${values.easing};
  --page-background: #fff8f9;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--page-background);
}

.semantic-page-transition {
  width: min(390px, 92vw);
  aspect-ratio: 390 / 844;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fafc 0%, #fff1f2 100%);
}

.screen-window,
.screen-layer,
.screen-wash {
  position: absolute;
}

.screen-window {
  inset: 34px 18px;
  overflow: hidden;
  border-radius: var(--window-radius);
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
  isolation: isolate;
}

.screen-layer,
.screen-wash {
  inset: 0;
}

.screen-layer {
  will-change: opacity, transform;
}

.mine-content {
  background:
    linear-gradient(180deg, rgba(239, 68, 68, 0.14), transparent 34%),
    repeating-linear-gradient(180deg, #ffffff 0 82px, #f8fafc 82px 98px);
}

.orders-content {
  opacity: 0;
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.14), transparent 36%),
    repeating-linear-gradient(180deg, #ffffff 0 76px, #eef2ff 76px 94px);
  transform: translate3d(var(--enter-distance), 0, 0);
}

.screen-wash {
  opacity: 0;
  background: #f7f9fc;
  pointer-events: none;
  will-change: opacity;
}

.is-playing .mine-content {
  animation: mine-exit var(--cycle-duration) var(--motion-easing) infinite;
}

.is-playing .orders-content {
  animation: orders-enter var(--cycle-duration) var(--motion-easing) infinite;
}

.is-playing .screen-wash {
  animation: transition-wash var(--cycle-duration) linear infinite;
}

@keyframes mine-exit {
  0%,
  39% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
  46% {
    opacity: 0.42;
    transform: translate3d(calc(var(--exit-distance) * 0.55), 0, 0);
  }
  53%,
  100% {
    opacity: 0;
    transform: translate3d(var(--exit-distance), 0, 0);
  }
}

@keyframes orders-enter {
  0%,
  39% {
    opacity: 0;
    transform: translate3d(var(--enter-distance), 0, 0);
  }
  46% {
    opacity: 0.34;
    transform: translate3d(calc(var(--enter-distance) * 0.4), 0, 0);
  }
  53%,
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes transition-wash {
  0%,
  39% {
    opacity: 0;
  }
  46% {
    opacity: var(--transition-opacity);
  }
  54%,
  100% {
    opacity: 0;
  }
}`;

  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: replayScript({ targetSelector: "[data-motion-root]", trigger: "loop" }) }
  ];
}

function sourceFilesForProductCardTransition(intent: SemanticGenerationIntent): SourceFile[] {
  const values = pageTransitionValues(intent);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>语义生成商品卡片转场</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="semantic-product-transition" data-motion-root aria-label="语义生成商品卡片转场">
      <section class="product-stage" data-motion="screenWindow">
        <article class="product-card product-card-front" data-motion="frontPage">
          <span class="product-image"></span>
          <strong>经典好物</strong>
          <small>限时优惠</small>
        </article>
        <article class="product-card product-card-back" data-motion="backPage">
          <span class="product-image is-alt"></span>
          <strong>新品上架</strong>
          <small>立即查看</small>
        </article>
        <div class="screen-wash" data-motion="transitionWash"></div>
      </section>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`;
  const css = `:root {
  --cycle-duration: ${values.cycleDuration}ms;
  --enter-distance: ${values.enterDistance}px;
  --exit-distance: ${values.exitDistance}px;
  --transition-opacity: ${values.transitionOpacity};
  --window-radius: ${values.windowRadius}px;
  --motion-easing: ${values.easing};
  --product-primary: #ef4444;
  --product-secondary: #2563eb;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.semantic-product-transition {
  display: grid;
  place-items: center;
  width: min(390px, 92vw);
  min-height: 520px;
}

.product-stage {
  position: relative;
  width: min(320px, 84vw);
  height: 410px;
  overflow: hidden;
  border-radius: var(--window-radius);
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
  isolation: isolate;
}

.product-card,
.screen-wash {
  position: absolute;
  inset: 24px;
}

.product-card {
  display: grid;
  align-content: end;
  gap: 10px;
  border-radius: 28px;
  background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  padding: 22px;
  will-change: opacity, transform;
}

.product-card-back {
  opacity: 0;
  transform: translate3d(var(--enter-distance), 0, 0);
}

.product-image {
  position: absolute;
  inset: 22px 22px auto;
  height: 190px;
  border-radius: 24px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--product-primary) 28%, white), var(--product-primary));
}

.product-image.is-alt {
  background: linear-gradient(135deg, color-mix(in srgb, var(--product-secondary) 24%, white), var(--product-secondary));
}

.product-card strong {
  color: #111827;
  font-size: 26px;
  line-height: 1.1;
}

.product-card small {
  color: #6b7280;
  font-size: 15px;
}

.screen-wash {
  inset: 0;
  opacity: 0;
  background: #f7f9fc;
  pointer-events: none;
  will-change: opacity;
}`;

  return [
    { path: "source/index.html", kind: "html", content: html },
    { path: "source/style.css", kind: "css", content: css },
    { path: "source/script.js", kind: "js", content: "" }
  ];
}

function sourceFilesFromDraft(draft: ReferenceGuidedSourceDraft): SourceFile[] {
  return [
    { path: "source/index.html", kind: "html", content: draft.html },
    { path: "source/style.css", kind: "css", content: draft.css },
    { path: "source/script.js", kind: "js", content: draft.js }
  ];
}

function buttonParams(intent: SemanticGenerationIntent): MotionParam[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  const label = intent.text ?? DEFAULT_BUTTON_TEXT;

  return [
    {
      id: "buttonBackgroundColor",
      label: "按钮背景色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--button-bg" }]
    },
    {
      id: "buttonTextColor",
      label: "按钮文本色",
      type: "color",
      default: "#ffffff",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--button-text" }]
    },
    {
      id: "motionDuration",
      label: "动画时长",
      type: "duration",
      default: duration,
      status: "confirmed",
      constraints: { min: 220, max: 2400, step: 20, unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
    },
    {
      id: "motionEasing",
      label: "弹性缓动",
      type: "easing",
      default: easing,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    },
    {
      id: "travelDistance",
      label: "移动距离",
      type: "range",
      default: 42,
      status: "confirmed",
      constraints: { min: 0, max: 80, step: 1, unit: "vw" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--travel-distance" }]
    },
    {
      id: "bounceIntensity",
      label: "弹动强度",
      type: "range",
      default: 1.14,
      status: "confirmed",
      constraints: { min: 1, max: 1.32, step: 0.01 },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--bounce-scale" }]
    },
    {
      id: "buttonLabel",
      label: "按钮文案",
      type: "text",
      default: label,
      status: "confirmed",
      constraints: { maxLength: 40 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=buttonLabel]" }]
    }
  ];
}

function buttonLayers(): MotionLayer[] {
  return [
    {
      id: "buttonLabel",
      label: "按钮文案",
      kind: "text",
      replaceable: true,
      paramId: "buttonLabel",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=buttonLabel]" }]
    }
  ];
}

function textParams(intent: SemanticGenerationIntent): MotionParam[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "textContent",
      label: "标题文案",
      type: "text",
      default: intent.text ?? "精彩标题",
      status: "confirmed",
      constraints: { maxLength: 60 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=textContent]" }]
    },
    {
      id: "textColor",
      label: "文字颜色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--text-color" }]
    },
    {
      id: "fontSize",
      label: "字号",
      type: "range",
      default: 42,
      status: "confirmed",
      constraints: { min: 18, max: 72, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--font-size" }]
    },
    ...motionParams(intent)
  ];
}

function cardParams(intent: SemanticGenerationIntent): MotionParam[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "cardTitle",
      label: "卡片标题",
      type: "text",
      default: intent.text ?? "信息卡片",
      status: "confirmed",
      constraints: { maxLength: 50 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardTitle]" }]
    },
    {
      id: "cardDescription",
      label: "卡片描述",
      type: "text",
      default: cardDescriptionForIntent(intent),
      status: "confirmed",
      constraints: { maxLength: 90 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardDescription]" }]
    },
    {
      id: "cardBackgroundColor",
      label: "卡片背景色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--card-bg" }]
    },
    {
      id: "cardRadius",
      label: "圆角",
      type: "range",
      default: 18,
      status: "confirmed",
      constraints: { min: 0, max: 36, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--card-radius" }]
    },
    {
      id: "cardShadow",
      label: "阴影强度",
      type: "range",
      default: 28,
      status: "confirmed",
      constraints: { min: 0, max: 48, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--card-shadow" }]
    },
    ...motionParams(intent)
  ];
}

function badgeParams(intent: SemanticGenerationIntent): MotionParam[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "badgeText",
      label: "标签文案",
      type: "text",
      default: intent.text ?? "标签",
      status: "confirmed",
      constraints: { maxLength: 30 },
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=badgeText]" }]
    },
    {
      id: "badgeBackgroundColor",
      label: "标签背景色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--badge-bg" }]
    },
    {
      id: "badgeTextColor",
      label: "标签文字色",
      type: "color",
      default: "#ffffff",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--badge-text" }]
    },
    ...motionParams(intent)
  ];
}

function loaderParams(intent: SemanticGenerationIntent): MotionParam[] {
  const color = intent.colors[0] ?? DEFAULT_BUTTON_COLOR;
  return [
    {
      id: "loaderColor",
      label: "加载器颜色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--loader-color" }]
    },
    {
      id: "loaderSize",
      label: "加载点尺寸",
      type: "range",
      default: 16,
      status: "confirmed",
      constraints: { min: 8, max: 32, step: 1, unit: "px" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--loader-size" }]
    },
    ...motionParams({ ...intent, speed: intent.speed === "normal" ? "fast" : intent.speed })
  ];
}

function mobilePageParams(intent: SemanticGenerationIntent): MotionParam[] {
  const color = intent.colors[0] ?? {
    target: "background",
    label: "紫色",
    value: "#8b5cf6"
  };
  return [
    {
      id: "pageBackgroundColor",
      label: "页面背景色",
      type: "color",
      default: "#f8fafc",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--page-bg" }]
    },
    {
      id: "foregroundColor",
      label: "前景图层颜色",
      type: "color",
      default: color.value,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--foreground-bg" }]
    },
    {
      id: "foregroundScaleStart",
      label: "入场初始缩放",
      type: "range",
      default: 0.72,
      constraints: { min: 0.4, max: 1, step: 0.01 },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--foreground-scale-start" }]
    },
    {
      id: "stageWidth",
      label: "页面宽度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.stageWidth,
      constraints: { min: 320, max: 520, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--stage-width" }]
    },
    {
      id: "stageHeight",
      label: "页面高度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.stageHeight,
      constraints: { min: 700, max: 1200, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--stage-height" }]
    },
    {
      id: "backgroundLayerWidth",
      label: "背景层宽度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerWidth,
      constraints: { min: 360, max: 640, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--background-layer-width" }]
    },
    {
      id: "backgroundLayerHeight",
      label: "背景层高度",
      type: "range",
      default: DEFAULT_MOBILE_PAGE_SIZE.backgroundLayerHeight,
      constraints: { min: 800, max: 1280, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--background-layer-height" }]
    },
    ...motionParams(intent)
  ];
}

function pageTransitionParams(intent: SemanticGenerationIntent): MotionParam[] {
  const values = pageTransitionValues(intent);
  return [
    {
      id: "cycleDuration",
      label: "循环时长",
      type: "duration",
      default: values.cycleDuration,
      constraints: { min: 1400, max: 5000, step: 40, unit: "ms" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--cycle-duration" }]
    },
    {
      id: "enterDistance",
      label: "进入距离",
      type: "range",
      default: values.enterDistance,
      constraints: { min: 0, max: 1118, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--enter-distance" }]
    },
    {
      id: "exitDistance",
      label: "退出距离",
      type: "range",
      default: values.exitDistance,
      constraints: { min: -1118, max: 0, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--exit-distance" }]
    },
    {
      id: "transitionOpacity",
      label: "过渡泛白",
      type: "range",
      default: values.transitionOpacity,
      constraints: { min: 0, max: 0.9, step: 0.01 },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--transition-opacity" }]
    },
    {
      id: "windowRadius",
      label: "屏幕圆角",
      type: "range",
      default: values.windowRadius,
      constraints: { min: 0, max: 160, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--window-radius" }]
    },
    {
      id: "easing",
      label: "缓动曲线",
      type: "easing",
      default: values.easing,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    }
  ];
}

function motionParams(intent: SemanticGenerationIntent): MotionParam[] {
  const duration = durationForIntent(intent);
  const easing = easingForIntent(intent);
  return [
    {
      id: "motionDuration",
      label: "动画时长",
      type: "duration",
      default: duration,
      status: "confirmed",
      constraints: { min: 220, max: 2400, step: 20, unit: "ms" },
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
    },
    {
      id: "motionEasing",
      label: "动效缓动",
      type: "easing",
      default: easing,
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    }
  ];
}

function roleParams(role: SemanticGenerationRole, intent: SemanticGenerationIntent): MotionParam[] {
  if (role === "text") return textParams(intent);
  if (role === "card") return cardParams(intent);
  if (role === "badge") return badgeParams(intent);
  if (role === "loader") return loaderParams(intent);
  if (role === "page-transition") return pageTransitionParams(intent);
  if (role === "mobile-page") return mobilePageParams(intent);
  return buttonParams(intent);
}

function textLayers(): MotionLayer[] {
  return [
    {
      id: "textContent",
      label: "标题文案",
      kind: "text",
      replaceable: true,
      paramId: "textContent",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=textContent]" }]
    }
  ];
}

function cardLayers(): MotionLayer[] {
  return [
    {
      id: "cardTitle",
      label: "卡片标题",
      kind: "text",
      replaceable: true,
      paramId: "cardTitle",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardTitle]" }]
    },
    {
      id: "cardDescription",
      label: "卡片描述",
      kind: "text",
      replaceable: true,
      paramId: "cardDescription",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=cardDescription]" }]
    }
  ];
}

function badgeLayers(): MotionLayer[] {
  return [
    {
      id: "badgeText",
      label: "标签文案",
      kind: "text",
      replaceable: true,
      paramId: "badgeText",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=badgeText]" }]
    }
  ];
}

function loaderLayers(): MotionLayer[] {
  return [
    {
      id: "loaderRoot",
      label: "加载器结构",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=loaderRoot]", attribute: "class" }]
    }
  ];
}

function pageTransitionLayers(): MotionLayer[] {
  return [
    {
      id: "frontPage",
      label: "前页",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=frontPage]", attribute: "class" }]
    },
    {
      id: "backPage",
      label: "后页",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=backPage]", attribute: "class" }]
    },
    {
      id: "transitionWash",
      label: "过渡泛白",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=transitionWash]", attribute: "class" }]
    }
  ];
}

function mobilePageLayers(): MotionLayer[] {
  return [
    {
      id: "backgroundLayer",
      label: "背景图层",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=backgroundLayer]", attribute: "class" }]
    },
    {
      id: "foregroundLayer",
      label: "前景图层",
      kind: "structure",
      replaceable: false,
      targets: [{ kind: "html-attribute", file: "source/index.html", selector: "[data-motion=foregroundLayer]", attribute: "class" }]
    }
  ];
}

function roleLayers(role: SemanticGenerationRole): MotionLayer[] {
  if (role === "text") return textLayers();
  if (role === "card") return cardLayers();
  if (role === "badge") return badgeLayers();
  if (role === "loader") return loaderLayers();
  if (role === "page-transition") return pageTransitionLayers();
  if (role === "mobile-page") return mobilePageLayers();
  return buttonLayers();
}

function generatedRoleLayers(role: SemanticGenerationRole): MotionLayer[] {
  return roleLayers(role).map((layer) => ({ ...layer, replaceable: true }));
}

function roleGroups(role: SemanticGenerationRole): MotionParamGroup[] {
  if (role === "text") {
    return [
      { id: "content", label: "内容", params: ["textContent", "textColor", "fontSize"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "card") {
    return [
      { id: "content", label: "内容", params: ["cardTitle", "cardDescription"] },
      { id: "appearance", label: "外观", params: ["cardBackgroundColor", "cardRadius", "cardShadow"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "badge") {
    return [
      { id: "content", label: "内容", params: ["badgeText"] },
      { id: "appearance", label: "外观", params: ["badgeBackgroundColor", "badgeTextColor"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "loader") {
    return [
      { id: "appearance", label: "外观", params: ["loaderColor", "loaderSize"] },
      { id: "motion", label: "动效", params: ["motionDuration", "motionEasing"] }
    ];
  }
  if (role === "page-transition") {
    return [
      { id: "timing", label: "速度", params: ["cycleDuration", "easing"] },
      { id: "trajectory", label: "轨迹", params: ["enterDistance", "exitDistance"] },
      { id: "visual", label: "视觉", params: ["transitionOpacity", "windowRadius"] }
    ];
  }
  if (role === "mobile-page") {
    return [
      { id: "layout", label: "页面", params: ["pageBackgroundColor", "foregroundColor"] },
      {
        id: "backgroundLayerSize",
        label: "背景层尺寸",
        params: ["stageWidth", "stageHeight", "backgroundLayerWidth", "backgroundLayerHeight"]
      },
      { id: "motion", label: "动效", params: ["foregroundScaleStart", "motionDuration", "motionEasing"] }
    ];
  }
  return [
    {
      id: "appearance",
      label: "外观",
      params: ["buttonBackgroundColor", "buttonTextColor", "buttonLabel"]
    },
    {
      id: "motion",
      label: "动效",
      params: ["motionDuration", "motionEasing", "travelDistance", "bounceIntensity"]
    }
  ];
}

function roleName(role: SemanticGenerationRole): string {
  if (role === "text") return "语义生成标题";
  if (role === "card") return "语义生成卡片";
  if (role === "badge") return "语义生成标签";
  if (role === "loader") return "语义生成加载动画";
  if (role === "page-transition") return "语义生成页面转场";
  if (role === "mobile-page") return "语义生成移动端页面";
  return "语义生成按钮";
}

function generatedManifest(input: {
  id: string;
  intent: SemanticGenerationIntent;
  intentV2: SemanticIntentV2;
  role: SemanticGenerationRole;
  files: SourceFile[];
}): { manifest: MotionManifest; files: SourceFile[] } {
  const designSpec =
    input.role === "page-transition"
      ? { id: "ecommerce-transition-motion-skill", confidence: 0.9, required: true }
      : { id: "interactive-control-motion-skill", confidence: 0.9, required: true };
  const recipeRequest = motionRecipeRequestFromSemanticIntent(input.intentV2);
  const recipe = resolveMotionRecipe(recipeRequest);
  const appliedRecipe = applyMotionRecipe({
    recipe,
    request: recipeRequest,
    params: roleParams(input.role, input.intent),
    layers: generatedRoleLayers(input.role),
    sourceFiles: input.files,
    source: input.intentV2.source,
    confidence: input.intentV2.confidence
  });

  return {
    manifest: {
      version: "1.0",
      id: `${input.id}-manifest`,
      name: roleName(input.role),
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      designSpecs: [designSpec],
      motionRecipes: [appliedRecipe.binding],
      params: appliedRecipe.params,
      groups: roleGroups(input.role),
      layers: appliedRecipe.layers,
      capabilities: ["editable", "export-html"]
    },
    files: appliedRecipe.files ?? input.files
  };
}

function fileMap(files: SourceFile[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file.path, file.content]));
}

function pageTransitionReference(references: MotionComponent[]): MotionComponent | null {
  return (
    references.find((reference) => reference.id === "jd-front-back-entry-transition") ??
    references.find((reference) =>
      [reference.name, ...reference.tags, ...reference.useCases].some((value) =>
        /(前后进场|页面转场|页面切换|page-transition)/i.test(value)
      )
    ) ??
    null
  );
}

function sourceFilesWithPatchedValues(input: {
  reference: MotionComponent;
  values: Record<string, unknown>;
  patchId: string;
}): SourceFile[] {
  const beforeFiles = fileMap(input.reference.source.files);
  const afterFiles = applyPatchToFiles({
    files: beforeFiles,
    manifest: input.reference.manifest,
    patch: {
      id: input.patchId,
      sourceManifestId: input.reference.manifest.id,
      values: input.values
    }
  });

  return input.reference.source.files.map((file) => ({
    ...file,
    content: afterFiles[file.path] ?? file.content
  }));
}

function pageTransitionFromReference(input: {
  id: string;
  intent: SemanticGenerationIntent;
  intentV2: SemanticIntentV2;
  reference: MotionComponent;
  files: SourceFile[];
}): { manifest: MotionManifest; files: SourceFile[] } {
  const values = pageTransitionValues(input.intent);
  const recipeRequest = motionRecipeRequestFromSemanticIntent(input.intentV2);
  const cache = createMotionRecipeCache([input.reference]);
  const cached = findCachedMotionRecipe({ cache, raw: input.intent.raw, recipeId: recipeRequest.recipeId });
  const extracted = cached ?? extractMotionRecipeFromComponent(input.reference);
  const recipe = extracted?.recipe ?? resolveMotionRecipe(recipeRequest);
  const appliedRecipe = applyMotionRecipe({
    recipe,
    request: recipeRequest,
    params: input.reference.manifest.params.map((param) =>
      param.id in values ? { ...param, default: values[param.id], value: values[param.id] } : param
    ),
    layers: generatedRoleLayers("page-transition"),
    sourceFiles: input.files,
    source: extracted?.recipe.source ?? input.intentV2.source,
    confidence: extracted?.confidence ?? input.intentV2.confidence
  });
  return {
    manifest: {
      ...input.reference.manifest,
      id: `${input.id}-manifest`,
      name: "语义生成页面转场",
      designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.92, required: true }],
      motionRecipes: [appliedRecipe.binding],
      layers: appliedRecipe.layers,
      params: appliedRecipe.params,
      capabilities: unique([...(input.reference.manifest.capabilities ?? []), "editable", "export-html"])
    },
    files: appliedRecipe.files ?? input.files
  };
}

function pageTransitionVariantFromReference(input: {
  id: string;
  intent: SemanticGenerationIntent;
  intentV2: SemanticIntentV2;
  references: MotionComponent[];
}): { manifest: MotionManifest; files: SourceFile[] } | null {
  const reference = pageTransitionReference(input.references);
  if (!reference) return null;
  const values = pageTransitionValues(input.intent);
  const appliesToProductCards = /(商品|产品|货品|卡片|product|card)/i.test(input.intent.raw);
  const files = appliesToProductCards
    ? sourceFilesForProductCardTransition(input.intent)
    : sourceFilesWithPatchedValues({
        reference,
        values,
        patchId: `${input.id}-page-transition-variant`
      });
  return pageTransitionFromReference({ id: input.id, intent: input.intent, intentV2: input.intentV2, reference, files });
}

function sourceText(component: MotionComponent): string {
  return component.source.files.map((file) => file.content).join("\n");
}

function sourceFilesForRole(role: SemanticGenerationRole, intent: SemanticGenerationIntent): SourceFile[] {
  if (role === "text") return sourceFilesForText(intent);
  if (role === "card") return sourceFilesForCard(intent);
  if (role === "badge") return sourceFilesForBadge(intent);
  if (role === "loader") return sourceFilesForLoader(intent);
  if (role === "page-transition") return sourceFilesForPageTransition(intent);
  if (role === "mobile-page") return sourceFilesForMobilePage(intent);
  return sourceFilesForButton(intent);
}

function categoryForRole(role: SemanticGenerationRole): MotionComponent["category"] {
  if (role === "text") return "text";
  if (role === "card") return "layout";
  if (role === "badge") return "interaction";
  if (role === "loader") return "data";
  if (role === "page-transition") return "interaction";
  if (role === "mobile-page") return "layout";
  return "interaction";
}

function coverageFor(input: {
  component: MotionComponent;
  intent: SemanticGenerationIntent;
}): ReferenceGuidedGenerationCoverage {
  const text = sourceText(input.component).toLowerCase();
  const satisfied: string[] = [];
  const missing: string[] = [];

  if (input.intent.role === "button") {
    text.includes("<button") ? satisfied.push("button") : missing.push("button");
  } else if (input.intent.role === "text") {
    text.includes("<h1") && text.includes("semantic-text") ? satisfied.push("text") : missing.push("text");
  } else if (input.intent.role === "card") {
    text.includes("semantic-card") && text.includes("cardtitle") && text.includes("carddescription")
      ? satisfied.push("card")
      : missing.push("card");
  } else if (input.intent.role === "badge") {
    text.includes("semantic-badge") ? satisfied.push("badge") : missing.push("badge");
  } else if (input.intent.role === "loader") {
    text.includes("semantic-loader") && text.includes("generated-loop-dots")
      ? satisfied.push("loader")
      : missing.push("loader");
  } else if (input.intent.role === "page-transition") {
    const hasScreenLayers =
      (text.includes("mine-content") && text.includes("orders-content")) ||
      (text.includes("frontpage") && text.includes("backpage"));
    const hasTransitionMotion =
      text.includes("mine-exit") &&
      text.includes("orders-enter") &&
      text.includes("transition-wash") &&
      text.includes("--enter-distance") &&
      text.includes("--exit-distance");
    hasScreenLayers && hasTransitionMotion ? satisfied.push("page-transition") : missing.push("page-transition");
  } else if (input.intent.role === "mobile-page") {
    const hasMobilePage = text.includes("semantic-mobile-page") && text.includes("foreground-layer");
    const hasEntranceMotion = text.includes("generated-load-foreground-scale") && text.includes("scale(");
    hasMobilePage && hasEntranceMotion ? satisfied.push("mobile-page") : missing.push("mobile-page");
  }
  for (const negative of input.intent.negativePreferences) {
    if (/(按钮|button|cta)/i.test(negative)) {
      !text.includes("<button") ? satisfied.push("不要按钮") : missing.push("不要按钮");
    }
  }
  for (const color of input.intent.colors) {
    text.includes(color.value.toLowerCase()) ? satisfied.push(color.label) : missing.push(color.label);
  }
  for (const effect of input.intent.effects) {
    const ok =
      input.intent.role === "page-transition" && effect === "slide"
        ? text.includes("translate3d") || text.includes("--enter-distance")
        : input.intent.role === "page-transition" && effect === "fade"
          ? text.includes("opacity") || text.includes("transition-wash")
          : effect === "bounce"
            ? text.includes("bounce")
            : effect === "elastic"
              ? text.includes("cubic-bezier(0.34, 1.56, 0.64, 1)")
              : effect === "pulse"
                ? text.includes("pulse") || text.includes("generated-loop-dots")
                : effect === "float"
                  ? text.includes("float") && text.includes("infinite")
                : text.includes(effect);
    ok ? satisfied.push(effect) : missing.push(effect);
  }
  if (input.intent.direction) {
    const ok =
      input.intent.role === "page-transition"
        ? text.includes("--enter-distance") && text.includes("--exit-distance")
        : text.includes(input.intent.direction);
    ok ? satisfied.push(input.intent.direction) : missing.push(input.intent.direction);
  }
  if (input.intent.trigger === "click") {
    text.includes('addeventlistener("click"') ? satisfied.push("click") : missing.push("click");
  } else if (input.intent.trigger === "hover") {
    text.includes(":hover") ? satisfied.push("hover") : missing.push("hover");
  } else if (input.intent.trigger === "loop") {
    text.includes("infinite") ? satisfied.push("loop") : missing.push("loop");
  }
  if (text.includes("window.motionreplay")) satisfied.push("motionReplay");
  else missing.push("motionReplay");
  if (text.includes("window.motionpause")) satisfied.push("motionPause");
  else missing.push("motionPause");
  if (text.includes("window.motionseek")) satisfied.push("motionSeek");
  else missing.push("motionSeek");

  return { satisfied: unique(satisfied), missing: unique(missing) };
}

function buildComponent(input: {
  id: string;
  role: SemanticGenerationRole;
  intent: SemanticGenerationIntent;
  references: MotionComponent[];
  files: SourceFile[];
  manifest: MotionManifest;
}): MotionComponent {
  return {
    id: input.id,
    name: input.manifest.name,
    category: categoryForRole(input.role),
    tags: unique([
      "generated",
      "reference-guided",
      input.role,
      ...input.intent.effects,
      ...input.intent.colors.map((color) => color.label),
      ...input.references.slice(0, 3).map((reference) => `ref:${reference.id}`)
    ]),
    useCases: ["semantic-generation"],
    moods: ["generated"],
    manifest: input.manifest,
    source: {
      id: input.id,
      origin: "generated",
      kind: "builtin-component",
      entry: "source/index.html",
      files: input.files
    }
  };
}

function validateReferenceGuidedComponent(input: {
  component: MotionComponent;
  intent: SemanticGenerationIntent;
}): {
  validation: GeneratedComponentValidationResult;
  coverage: ReferenceGuidedGenerationCoverage;
} {
  const files = input.component.source.files;
  const afterFiles = fileMap(files);
  const recipeBinding = input.component.manifest.motionRecipes?.[0];
  const recipeGate = recipeBinding
    ? validateRecipeApplication({
        binding: recipeBinding,
        params: input.component.manifest.params,
        layers: input.component.manifest.layers ?? [],
        sourceText: sourceText(input.component)
      })
    : { valid: false, issues: ["缺少 motion recipe 绑定"] };
  const validation = validateGeneratedComponent({
    component: input.component,
    allowed: {
      paramIds: input.component.manifest.params.map((param) => param.id),
      layerIds: input.component.manifest.layers?.map((layer) => layer.id) ?? [],
      sourceFiles: files.map((file) => file.path),
      sourceTargetKinds: ["css-variable", "html-text"]
    },
    beforeFiles: {},
    afterFiles
  });
  const coverage = coverageFor({ component: input.component, intent: input.intent });

  return {
    coverage,
    validation: {
      ...validation,
      valid: validation.valid && coverage.missing.length === 0 && recipeGate.valid,
      checks: recipeGate.valid
        ? validation.checks
        : [
            ...validation.checks,
            {
              id: "readiness-gate",
              status: "fail",
              message: `MotionRecipe 门禁失败：${recipeGate.issues.join("；")}`
            }
          ]
    }
  };
}

export function createReferenceGuidedComponent(
  input: CreateReferenceGuidedComponentInput
): ReferenceGuidedGenerationResult {
  const intentV2 = input.intentV2 ?? parseSemanticIntentV2Fallback(input.brief);
  const intent = input.intentV2 ? semanticIntentV2ToLegacyIntent(input.intentV2) : parseSemanticGenerationIntent(input.brief);
  const role = intent.role ?? "mobile-page";
  const id = `generated-reference-${role}-${input.now ?? Date.now()}`;
  const references = input.references ?? [];

  if (input.sourceDraft) {
    const draftFiles = sourceFilesFromDraft(input.sourceDraft);
    const draftGenerated = generatedManifest({ id, intent, intentV2, role, files: draftFiles });
    const draftComponent = buildComponent({
      id,
      role,
      intent,
      references,
      files: draftGenerated.files,
      manifest: draftGenerated.manifest
    });
    const draftGate = validateReferenceGuidedComponent({ component: draftComponent, intent });
    if (draftGate.validation.valid) {
      return {
        component: draftComponent,
        intent,
        intentV2,
        coverage: draftGate.coverage,
        validation: draftGate.validation,
        references: references.slice(0, 3).map((reference) => ({ id: reference.id, name: reference.name }))
      };
    }
  }

  if (role === "page-transition") {
    const variant = pageTransitionVariantFromReference({ id, intent, intentV2, references });
    if (variant) {
      const component = buildComponent({
        id,
        role,
        intent,
        references,
        files: variant.files,
        manifest: variant.manifest
      });
      const variantGate = validateReferenceGuidedComponent({ component, intent });

      return {
        component,
        intent,
        intentV2,
        coverage: variantGate.coverage,
        validation: variantGate.validation,
        references: references.slice(0, 3).map((reference) => ({ id: reference.id, name: reference.name }))
      };
    }
  }

  const files = sourceFilesForRole(role, intent);
  const generated = generatedManifest({ id, intent, intentV2, role, files });
  const component = buildComponent({
    id,
    role,
    intent,
    references,
    files: generated.files,
    manifest: generated.manifest
  });
  const fallbackGate = validateReferenceGuidedComponent({ component, intent });

  return {
    component,
    intent,
    intentV2,
    coverage: fallbackGate.coverage,
    validation: fallbackGate.validation,
    references: references.slice(0, 3).map((reference) => ({ id: reference.id, name: reference.name }))
  };
}
