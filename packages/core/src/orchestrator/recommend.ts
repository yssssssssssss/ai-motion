import type { MotionComponent } from "../library/componentLibrary";
import type { MotionPatch } from "../manifest/types";
import { briefIntentTerms, type ParsedBriefIntent } from "./briefIntent";

export type Recommendation = {
  componentId: string;
  score: number;
  reason: string;
  initialPatch: MotionPatch;
};

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\W+/).filter(Boolean);
}

function componentHaystack(component: MotionComponent): string {
  const source = component.tags.includes("workeasy") ? "workeasy" : "native";
  return [
    component.name,
    component.category,
    source,
    ...component.tags,
    ...component.useCases,
    ...component.moods
  ]
    .join(" ")
    .toLowerCase();
}

export function recommendComponents(input: {
  brief?: string;
  intent?: ParsedBriefIntent;
  components: MotionComponent[];
  limit?: number;
}): Recommendation[] {
  const terms = input.intent ? briefIntentTerms(input.intent) : tokenize(input.brief ?? "");

  return input.components
    .map((component) => {
      const haystack = componentHaystack(component);
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      const reason =
        score > 0
          ? input.intent
            ? "Matches the parsed brief intent."
            : "Matches the brief metadata."
          : "Included as a fallback candidate.";

      return {
        componentId: component.id,
        score,
        reason,
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
