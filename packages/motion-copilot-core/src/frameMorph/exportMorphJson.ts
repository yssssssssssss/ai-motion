import type { MorphPlan } from "./schema";

export type MorphPlanJsonV1 = MorphPlan;

export function exportMorphJson(plan: MorphPlan): string {
  return JSON.stringify(plan, null, 2);
}
