import {
  createMotionSkillDraftComponent,
  type AtomicMotionToken,
  type MotionComponent
} from "@motion-tool/core";
import { motionSkillPacks, motionSkillRegistry } from "../data/motionSkills";

export const motionSkillElements = motionSkillRegistry.elements;

function keyframeLabel(frame: AtomicMotionToken["keyframes"][number]): string {
  if (typeof frame === "number") return String(frame);
  if (typeof frame === "string") return frame;

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

  return createMotionSkillDraftComponent({
    registry: motionSkillRegistry,
    pack,
    recipeId: recipe.id,
    ...(input.now === undefined ? {} : { now: input.now })
  });
}
