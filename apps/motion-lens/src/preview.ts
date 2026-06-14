import type { CSSProperties } from "react";
import type { MotionOpportunity, MotionPreviewSpec } from "@motion-lens/core";

export type PreviewTemplate =
  | "cta"
  | "press"
  | "spotlight"
  | "reveal"
  | "modal"
  | "toast"
  | "sequence"
  | "cart"
  | "favorite"
  | "ceremony"
  | "progress"
  | "empty"
  | "rating"
  | "badge";

export function easingLabel(easing: MotionOpportunity["recommendedParams"]["easing"]): string {
  if (easing === "standard") return "标准缓动";
  if (easing === "decelerate") return "减速缓动";
  if (easing === "accelerate") return "加速缓动";
  if (easing === "sharp") return "锐利缓动";
  return "弹性缓动";
}

export function repeatLabel(repeat: MotionOpportunity["recommendedParams"]["repeat"]): string {
  if (repeat === "none") return "不循环";
  if (repeat === "limited") return "有限次数";
  return "循环";
}

export function paramLabel(opportunity: MotionOpportunity): string {
  const { durationMs, delayMs, easing, transform, repeat } = opportunity.recommendedParams;
  return [
    transform,
    `${durationMs}ms`,
    delayMs ? `延迟 ${delayMs}ms` : "",
    easingLabel(easing),
    `重复 ${repeatLabel(repeat)}`
  ]
    .filter(Boolean)
    .join(" · ");
}

export function previewTemplateFor(spec: MotionPreviewSpec, opportunity: MotionOpportunity): PreviewTemplate {
  const key = `${spec.patternId} ${opportunity.patternName}`.toLowerCase();

  if (key.includes("add-to-cart") || key.includes("加购") || key.includes("购物车")) return "cart";
  if (key.includes("favorite") || key.includes("heartbeat") || key.includes("收藏") || key.includes("心跳")) {
    return "favorite";
  }
  if (
    key.includes("payment-success") ||
    key.includes("ceremony") ||
    key.includes("支付成功") ||
    key.includes("仪式感")
  ) {
    return "ceremony";
  }
  if (key.includes("logistics") || key.includes("progress") || key.includes("物流") || key.includes("进度")) {
    return "progress";
  }
  if (key.includes("empty-state") || key.includes("缺省") || key.includes("空状态")) return "empty";
  if (key.includes("rating") || key.includes("评分") || key.includes("表情")) return "rating";
  if (key.includes("badge") || key.includes("角标") || key.includes("利益点")) return "badge";
  if (key.includes("press") || key.includes("压感") || key.includes("确认")) return "press";
  if (key.includes("cta") || key.includes("highlight") || key.includes("强调") || key.includes("加购")) {
    return "cta";
  }
  if (key.includes("spotlight") || key.includes("focus") || key.includes("聚焦")) return "spotlight";
  if (key.includes("stagger") || key.includes("reveal") || key.includes("入场") || key.includes("揭示")) {
    return "reveal";
  }
  if (spec.role === "modal" || key.includes("modal") || key.includes("弹窗")) return "modal";
  if (spec.role === "toast" || key.includes("toast") || key.includes("反馈") || key.includes("成功")) {
    return "toast";
  }

  return "sequence";
}

export function previewTimingStyle(
  opportunity: MotionOpportunity,
  template: PreviewTemplate,
  options: { paused?: boolean } = {}
): CSSProperties {
  const duration = clampNumber(opportunity.recommendedParams.durationMs * 5, 900, 2600);
  const delay = clampNumber(opportunity.recommendedParams.delayMs ?? 0, 0, 1200);

  return {
    "--preview-duration": `${duration}ms`,
    "--preview-easing": easingCss(opportunity.recommendedParams.easing),
    "--preview-transform": previewTransform(template),
    animationDelay: `${delay}ms`,
    animationIterationCount: "infinite",
    animationPlayState: options.paused ? "paused" : "running"
  } as CSSProperties;
}

function previewTransform(template: PreviewTemplate): string {
  if (template === "press") return "scale(0.96)";
  if (template === "favorite" || template === "rating") return "scale(1.14)";
  if (template === "cta" || template === "spotlight" || template === "badge") return "scale(1.035)";
  if (template === "cart") return "translate(118px, -34px) scale(0.72)";
  if (
    template === "toast" ||
    template === "reveal" ||
    template === "sequence" ||
    template === "progress" ||
    template === "empty" ||
    template === "ceremony"
  ) {
    return "translateY(0)";
  }
  return "scale(1)";
}

function easingCss(easing: MotionOpportunity["recommendedParams"]["easing"]): string {
  if (easing === "standard") return "cubic-bezier(0.2, 0, 0, 1)";
  if (easing === "decelerate") return "cubic-bezier(0, 0, 0.2, 1)";
  if (easing === "accelerate") return "cubic-bezier(0.4, 0, 1, 1)";
  if (easing === "sharp") return "cubic-bezier(0.4, 0, 0.6, 1)";
  return "cubic-bezier(0.2, 1.35, 0.2, 1)";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
