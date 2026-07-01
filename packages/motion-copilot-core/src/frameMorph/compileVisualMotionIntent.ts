import { createClassicEasing, createSpringEasing } from "../schema/document";
import type { VisualMotionIntent } from "./schema";

function includesAny(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

export function compileVisualMotionIntent(prompt: string): VisualMotionIntent {
  const text = prompt.trim().toLowerCase();
  const wantsFast = includesAny(text, ["快", "快速", "干脆", "利落"]);
  const wantsSlow = includesAny(text, ["慢", "缓慢", "舒缓"]);
  const wantsElastic = includesAny(text, ["弹", "弹性", "回弹", "q弹", "bounce", "spring"]);
  const wantsSmooth = includesAny(text, ["丝滑", "柔和", "顺滑", "smooth"]);
  const wantsStagger = includesAny(text, ["错峰", "依次", "逐个", "分批", "stagger"]);

  const durationMs = wantsSlow ? 520 : wantsFast ? 220 : wantsElastic ? 420 : wantsSmooth ? 360 : 320;
  const easing = wantsElastic
    ? createSpringEasing()
    : createClassicEasing(wantsFast ? "standard" : "decelerate");
  const staggerMs = wantsStagger ? 48 : 0;
  const translateY = includesAny(text, ["上移", "上浮", "升起"]) ? 8 : 0;

  return {
    durationMs,
    easing,
    staggerMs,
    enter: {
      opacityFrom: 0,
      translateY,
      delayMs: staggerMs
    },
    exit: {
      opacityTo: 0,
      translateY: -translateY,
      delayMs: 0
    }
  };
}
