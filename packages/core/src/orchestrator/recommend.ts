import type { MotionComponent } from "../library/componentLibrary";
import type { MotionPatch } from "../manifest/types";

export type Recommendation = {
  componentId: string;
  score: number;
  reason: string;
  initialPatch: MotionPatch;
};

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\W+/).filter(Boolean);
}

export function recommendComponents(input: {
  brief: string;
  components: MotionComponent[];
  limit?: number;
}): Recommendation[] {
  const terms = tokenize(input.brief);

  return input.components
    .map((component) => {
      const haystack = [
        component.name,
        component.category,
        ...component.tags,
        ...component.useCases,
        ...component.moods
      ]
        .join(" ")
        .toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);

      return {
        componentId: component.id,
        score,
        reason: score > 0 ? "Matches the brief metadata." : "Included as a fallback candidate.",
        initialPatch: {
          id: `${component.id}-initial`,
          sourceManifestId: component.manifest.id,
          values: {}
        }
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? 6);
}
