import type { MotionComponent } from "../library/componentLibrary";
import type { MotionPatch } from "../manifest/types";
import { createFallbackBriefIntent, type ParsedBriefIntent } from "./briefIntent";
import { createSearchProfile, type SearchProfile } from "./searchProfile";

export type Recommendation = {
  componentId: string;
  score: number;
  reason: string;
  matches: string[];
  missing?: string[];
  initialPatch: MotionPatch;
};

const ALIAS_GROUPS = [
  ["按钮", "button", "buttons", "cta", "call to action", "转化入口"],
  ["卡片", "card", "cards"],
  ["选择控件", "checkbox", "checkboxes", "checklist", "表单"],
  ["文字", "text", "hero", "标题"],
  ["hover", "悬停", "micro interaction", "micro-interaction"],
  ["reveal", "入场", "出现"],
  ["scale", "缩放"],
  ["glow", "发光", "shadow", "霓虹"],
  ["紫色", "purple", "violet"],
  ["蓝色", "blue"],
  ["渐变", "gradient"],
  ["活动页", "campaign", "campaign-page", "promotion"],
  ["落地页", "landing", "landing-page"],
  ["营销页", "marketing"],
  ["科技感", "tech", "saas"],
  ["workeasy", "work easy"],
  ["内置", "native"]
];

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function expandTerm(value: string): string[] {
  const normalized = normalize(value);
  const terms = [normalized, ...tokenize(normalized)];

  for (const group of ALIAS_GROUPS) {
    if (group.some((alias) => normalized.includes(normalize(alias)))) {
      terms.push(...group.map(normalize));
    }
  }

  return unique(terms);
}

function extractIntentTerms(intent: ParsedBriefIntent): string[] {
  return unique([
    ...[intent.query, intent.semanticQuery].flatMap((value) => [value, ...tokenize(value)]),
    ...intent.categories,
    ...intent.componentKinds,
    ...intent.motionStyles,
    ...intent.sources,
    ...intent.keywords,
    ...intent.softPreferences,
    ...intent.hardConstraints,
    ...intent.reasoningHints
  ]);
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

function textMatches(text: string, term: string): boolean {
  const haystack = normalize(text);
  return expandTerm(term).some((candidate) => candidate && haystack.includes(candidate));
}

function traitMatch(traits: string[], term: string): string | null {
  const expandedTerm = expandTerm(term);
  const normalizedTerm = normalize(term);

  for (const trait of traits) {
    if (normalize(trait) === normalizedTerm) return trait;
  }

  for (const trait of traits) {
    const expandedTrait = expandTerm(trait);
    if (
      expandedTrait.some((candidate) => expandedTerm.includes(candidate)) ||
      expandedTerm.some((candidate) => expandedTrait.includes(candidate))
    ) {
      return trait;
    }
  }

  return null;
}

function scoreTerm(term: string, profile: SearchProfile, haystack: string): { score: number; match: string | null } {
  const functionMatch = traitMatch(profile.functionTraits, term);
  if (functionMatch) return { score: 4, match: functionMatch };

  const sceneMatch = traitMatch(profile.sceneTraits, term);
  if (sceneMatch) return { score: 3, match: sceneMatch };

  const motionMatch = traitMatch(profile.motionTraits, term);
  if (motionMatch) return { score: 3, match: motionMatch };

  const colorMatch = traitMatch(profile.colorTraits, term);
  if (colorMatch) return { score: 2, match: colorMatch };

  const editableMatch = traitMatch(profile.editableTraits, term);
  if (editableMatch) return { score: 1, match: editableMatch };

  if (textMatches(`${profile.summary} ${profile.rawText} ${haystack}`, term)) return { score: 1, match: term };

  return { score: 0, match: null };
}

export function recommendComponents(input: {
  brief?: string;
  intent?: ParsedBriefIntent;
  components: MotionComponent[];
  limit?: number;
}): Recommendation[] {
  const intent = input.intent ?? createFallbackBriefIntent(input.brief ?? "");
  const terms = extractIntentTerms(intent);
  const negativeTerms = unique(intent.negativePreferences);

  return input.components
    .map((component) => {
      const profile = createSearchProfile(component);
      const haystack = componentHaystack(component);
      const matches: string[] = [];
      const missing: string[] = [];

      const positiveScore = terms.reduce((total, term) => {
        const result = scoreTerm(term, profile, haystack);
        if (result.match) matches.push(result.match);
        return total + result.score;
      }, 0);
      const penalty = negativeTerms.reduce((total, term) => {
        return total + (scoreTerm(term, profile, haystack).score > 0 ? 5 : 0);
      }, 0);

      for (const constraint of intent.hardConstraints) {
        if (scoreTerm(constraint, profile, haystack).score === 0) missing.push(constraint);
      }

      const score = positiveScore - penalty;
      const uniqueMatches = unique(matches).slice(0, 8);
      const uniqueMissing = unique(missing);
      const reason = uniqueMatches.length > 0 ? `命中：${uniqueMatches.join("、")}` : "作为兜底候选展示。";

      return {
        componentId: component.id,
        score,
        reason,
        matches: uniqueMatches,
        ...(uniqueMissing.length > 0 ? { missing: uniqueMissing } : {}),
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
