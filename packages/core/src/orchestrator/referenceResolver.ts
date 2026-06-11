import type { MotionComponent } from "../library/componentLibrary";

export type ResolvedReferenceComponent = {
  componentId: string;
  name: string;
  score: number;
  reason: string;
};

export type ResolveReferenceComponentsInput = {
  brief: string;
  components: MotionComponent[];
  limit?: number;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function componentText(component: MotionComponent): string {
  return [
    component.id,
    component.name,
    component.category,
    ...component.tags,
    ...component.useCases,
    ...component.moods,
    component.manifest.id,
    component.manifest.name
  ]
    .join(" ")
    .toLowerCase();
}

function pageTransitionRequested(brief: string): boolean {
  return /(jd-front-back-entry-transition|前后进场|页面转场|页面切换|前页|后页|移动端.*转场|page-transition|screen-transition)/i.test(
    brief
  );
}

function referencePhraseTargets(brief: string): string[] {
  return [...brief.matchAll(/(?:基于|参考|像|按照|以|用)\s*([^，。；;,.!！?？\n]{2,80})/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
}

function scoreReference(component: MotionComponent, brief: string): ResolvedReferenceComponent | null {
  const lowerBrief = normalize(brief);
  const text = componentText(component);
  let score = 0;
  const reasons: string[] = [];

  if (lowerBrief.includes(normalize(component.id))) {
    score += 120;
    reasons.push(`命中组件 ID ${component.id}`);
  }
  if (lowerBrief.includes(normalize(component.name))) {
    score += 110;
    reasons.push(`命中组件名 ${component.name}`);
  }

  for (const target of referencePhraseTargets(brief)) {
    const normalizedTarget = normalize(target);
    if (normalizedTarget && text.includes(normalizedTarget)) {
      score += 90;
      reasons.push(`命中参考描述 ${target}`);
    }
  }

  if (pageTransitionRequested(brief) && text.includes("page-transition")) {
    score += 80;
    reasons.push("命中页面转场意图");
  }
  if (pageTransitionRequested(brief) && component.id === "jd-front-back-entry-transition") {
    score += 40;
    reasons.push("命中前后进场内置组件");
  }

  if (score < 40) return null;
  return {
    componentId: component.id,
    name: component.name,
    score,
    reason: reasons.join("；")
  };
}

export function resolveReferenceComponents({
  brief,
  components,
  limit = 3
}: ResolveReferenceComponentsInput): ResolvedReferenceComponent[] {
  if (!brief.trim()) return [];

  return components
    .map((component) => scoreReference(component, brief))
    .filter((item): item is ResolvedReferenceComponent => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
