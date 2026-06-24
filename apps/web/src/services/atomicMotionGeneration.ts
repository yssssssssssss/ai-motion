import {
  createMotionSkillDraftComponent,
  type AtomicMotionToken,
  type MotionTrigger,
  type MotionComponent
} from "@motion-tool/core";
import { motionSkillPacks, motionSkillRegistry } from "../data/motionSkills";

export const motionSkillElements = motionSkillRegistry.elements;

export type AtomicMotionTriggerRule = {
  defaultTrigger: MotionTrigger;
  allowedTriggers: MotionTrigger[];
};

const DEFAULT_TRIGGER_RULE: AtomicMotionTriggerRule = {
  defaultTrigger: "load",
  allowedTriggers: ["load", "click", "hover", "loop", "swipe"]
};

const triggerRulesByElementId: Record<string, AtomicMotionTriggerRule> = {
  "container-transform": {
    defaultTrigger: "click",
    allowedTriggers: ["click"]
  },
  "popup-close": {
    defaultTrigger: "click",
    allowedTriggers: ["click"]
  }
};

function isFrontBackSwipeAction(elementId: string, variant?: string): boolean {
  return elementId === "front-back-entry" && (variant === "滑动操作" || variant === "swipe-action");
}

function isContentFeedbackSelection(elementId: string, variant?: string): boolean {
  return elementId === "content-feedback" && (variant === "单选/多选" || variant === "selection");
}

function isContentLoadingGlobal(elementId: string, variant?: string): boolean {
  return elementId === "content-loading" && (variant === "全局" || variant === "global");
}

export function atomicMotionTriggerRule(elementId: string, variant?: string): AtomicMotionTriggerRule {
  if (
    elementId === "horizontal-switch" &&
    (variant === "开关" ||
      variant === "指示器" ||
      variant === "频道Tab" ||
      variant === "Tab导航" ||
      variant === "分段")
  ) {
    return {
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    };
  }

  if (isFrontBackSwipeAction(elementId, variant)) {
    return {
      defaultTrigger: "swipe",
      allowedTriggers: ["swipe"]
    };
  }

  if (isContentFeedbackSelection(elementId, variant)) {
    return {
      defaultTrigger: "click",
      allowedTriggers: ["click"]
    };
  }

  if (isContentLoadingGlobal(elementId, variant)) {
    return {
      defaultTrigger: "loop",
      allowedTriggers: ["loop"]
    };
  }

  return triggerRulesByElementId[elementId] ?? DEFAULT_TRIGGER_RULE;
}

function keyframeLabel(frame: AtomicMotionToken["keyframes"][number]): string {
  if (typeof frame === "number") return String(frame);
  if (typeof frame === "string") return frame;
  if ("value" in frame) return String(frame.value);

  const parts = [];
  if (typeof frame.width === "number") parts.push(`width ${frame.width}`);
  if (typeof frame.height === "number") parts.push(`height ${frame.height}`);
  if (typeof frame.x === "number") parts.push(`x ${frame.x}`);
  if (typeof frame.y === "number") parts.push(`y ${frame.y}`);
  return parts.join(" / ");
}

export function motionSkillTokenSummary(input: { elementId: string; variant: string }): string[] {
  const pack = motionSkillPacks[input.elementId];
  if (!pack) return [];
  const recipe = pack.recipes.find((item) => item.sourceVariant === input.variant);
  if (!recipe) return [];
  const tokens = recipe.tokenIds.flatMap(
    (tokenId) => pack.tokens.find((token) => token.id === tokenId) ?? []
  );

  return tokens.map((token: AtomicMotionToken) => {
    const frames = Array.isArray(token.keyframes) ? token.keyframes.map(keyframeLabel).join(" -> ") : "";
    return `${token.metadata.animationType} · ${token.durationMs}ms · delay ${token.delayMs}ms · ${frames}`;
  });
}

export function motionSkillTargetLabel(input: { elementId: string; variant: string }): string {
  const pack = motionSkillPacks[input.elementId];
  const recipe = pack?.recipes.find((item) => item.sourceVariant === input.variant);
  if (!recipe) return "动效图层";
  if (recipe.targetRole === "modal") return "弹窗图层";
  if (recipe.targetRole === "screen") return "页面图层";
  if (recipe.targetRole === "container") return "容器图层";
  if (recipe.targetRole === "card") return "卡片图层";
  return "动效图层";
}

export function generateAtomicMotionComponent(input: {
  elementId: string;
  variant: string;
  trigger?: MotionTrigger;
  now?: number;
}): MotionComponent {
  const element = motionSkillRegistry.elements.find((item) => item.id === input.elementId);
  if (!element || !element.active || element.status === "incomplete") {
    throw new Error(
      element?.reason ? `原子动效参数未完整：${element.reason}` : "原子动效参数未完整，暂不可生成"
    );
  }

  const pack = motionSkillPacks[input.elementId];
  if (!pack) throw new Error("未找到原子动效能力包");

  const recipe = pack.recipes.find((item) => item.sourceVariant === input.variant);
  if (!recipe) throw new Error("未找到所选梯度的动效参数");
  const triggerRule = atomicMotionTriggerRule(input.elementId, input.variant);
  const trigger =
    input.trigger && triggerRule.allowedTriggers.includes(input.trigger)
      ? input.trigger
      : triggerRule.defaultTrigger;

  return createMotionSkillDraftComponent({
    registry: motionSkillRegistry,
    pack,
    recipeId: recipe.id,
    trigger,
    ...(input.elementId === "popup-close" ? { replayMode: "once" as const } : {}),
    ...(input.now === undefined ? {} : { now: input.now })
  });
}

export const atomicMotionFeedComponents: MotionComponent[] = motionSkillRegistry.elements.flatMap(
  (element) => {
    if (!element.active || element.status === "incomplete") return [];
    const pack = motionSkillPacks[element.id];
    if (!pack) return [];

    return element.variants.flatMap((variant) => {
      if (!pack.recipes.some((recipe) => recipe.sourceVariant === variant)) return [];
      return generateAtomicMotionComponent({
        elementId: element.id,
        variant,
        now: 0
      });
    });
  }
);
