import type { CompositionStep } from "../schema/document";

function identity(step: CompositionStep): string {
  // Visual compiler ids contain array indices; bindings can shift those indices.
  return JSON.stringify([step.layerId ?? null, step.presetId]);
}

export function mergeRecompiledSteps(
  current: CompositionStep[],
  fresh: CompositionStep[]
): CompositionStep[] {
  const available = new Map<string, number[]>();
  current.forEach((step, index) => {
    const key = identity(step);
    const indices = available.get(key) ?? [];
    indices.push(index);
    available.set(key, indices);
  });
  const retained = new Set<number>();
  const added: CompositionStep[] = [];
  for (const step of fresh) {
    const index = available.get(identity(step))?.shift();
    if (index === undefined) added.push(step);
    else retained.add(index);
  }
  // Keep the user's ordering, ids and all overrides, including absent optional fields.
  return [...current.filter((_, index) => retained.has(index)), ...added];
}
