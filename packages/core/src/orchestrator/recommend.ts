import type { MotionComponent } from "../library/componentLibrary";
import type { MotionPatch } from "../manifest/types";
import { createFallbackBriefIntent, type ParsedBriefIntent } from "./briefIntent";
import { displayLabel, displayLabels } from "./displayLabels";
import { createSearchProfile, type SearchProfile } from "./searchProfile";
import {
  createComponentSemanticProfile,
  createQuerySemanticProfile,
  semanticTermMatches,
  SEMANTIC_ALIAS_GROUPS,
  type ComponentSemanticProfile,
  type QuerySemanticProfile
} from "./semanticProfile";

export type Recommendation = {
  componentId: string;
  score: number;
  reason: string;
  matches: string[];
  missing?: string[];
  initialPatch: MotionPatch;
};

// 复用同一个组件对象的画像，避免每次推荐都重新扫描 html/css
const profileCache = new WeakMap<MotionComponent, SearchProfile>();
const semanticProfileCache = new WeakMap<MotionComponent, ComponentSemanticProfile>();

function getProfile(component: MotionComponent): SearchProfile {
  const cached = profileCache.get(component);
  if (cached) return cached;
  const profile = createSearchProfile(component);
  profileCache.set(component, profile);
  return profile;
}

function getSemanticProfile(component: MotionComponent): ComponentSemanticProfile {
  const cached = semanticProfileCache.get(component);
  if (cached) return cached;
  const profile = createComponentSemanticProfile(component);
  semanticProfileCache.set(component, profile);
  return profile;
}

const ALIAS_GROUPS = SEMANTIC_ALIAS_GROUPS;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
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

function extractKnownTerms(value: string): string[] {
  const normalized = normalize(value);
  if (!normalized) return [];

  return ALIAS_GROUPS.flatMap((group) => {
    const canonical = group[0];
    return canonical && group.some((alias) => normalized.includes(normalize(alias))) ? [canonical] : [];
  });
}

function extractIntentTerms(intent: ParsedBriefIntent): string[] {
  return unique([
    ...[intent.query, intent.semanticQuery].flatMap((value) => [...tokenize(value), ...extractKnownTerms(value)]),
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

function componentSource(component: MotionComponent): "workeasy" | "uploaded" | "native" {
  if (component.source.origin === "imported") return "uploaded";
  return component.tags.includes("workeasy") ? "workeasy" : "native";
}

function componentHaystack(component: MotionComponent): string {
  return [
    component.name,
    component.category,
    componentSource(component),
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

function computeIdfWeights(components: MotionComponent[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const component of components) {
    const profile = getProfile(component);
    const allTraits = [
      ...profile.colorTraits,
      ...profile.motionTraits,
      ...profile.functionTraits,
      ...profile.sceneTraits,
      ...profile.structuralTags,
      ...profile.editableTraits
    ];
    const seen = new Set<string>();
    for (const trait of allTraits) {
      const n = normalize(trait);
      if (!seen.has(n)) {
        seen.add(n);
        df.set(n, (df.get(n) ?? 0) + 1);
      }
    }
  }
  const N = components.length || 1;
  const weights = new Map<string, number>();
  for (const [term, count] of df) {
    weights.set(term, Math.log(N / count) + 1);
  }
  return weights;
}

function scoreTerm(
  term: string,
  profile: SearchProfile,
  haystack: string,
  idfWeights: Map<string, number>
): { score: number; match: string | null } {
  const idf = idfWeights.get(normalize(term)) ?? 1;

  const functionMatch = traitMatch(profile.functionTraits, term);
  if (functionMatch) return { score: Math.round(4 * idf * 10) / 10, match: functionMatch };

  // 颜色 facet：primary 命中权重最高（高于 function），确保颜色诉求不会被功能淹没
  const primaryColorHit = traitMatch([profile.colorFacet.primary], term);
  if (primaryColorHit) return { score: Math.round(6 * idf * 10) / 10, match: primaryColorHit };

  const secondaryColorHit = traitMatch(profile.colorFacet.secondary, term);
  if (secondaryColorHit) return { score: Math.round(3 * idf * 10) / 10, match: secondaryColorHit };

  const sceneMatch = traitMatch(profile.sceneTraits, term);
  if (sceneMatch) return { score: Math.round(3 * idf * 10) / 10, match: sceneMatch };

  const motionMatch = traitMatch(profile.motionTraits, term);
  if (motionMatch) return { score: Math.round(3 * idf * 10) / 10, match: motionMatch };

  const structuralMatch = traitMatch(profile.structuralTags, term);
  if (structuralMatch) return { score: Math.round(2.5 * idf * 10) / 10, match: structuralMatch };

  // 兜底：旧 colorTraits 中的任意命中
  const colorMatch = traitMatch(profile.colorTraits, term);
  if (colorMatch) return { score: Math.round(2 * idf * 10) / 10, match: colorMatch };

  const editableMatch = traitMatch(profile.editableTraits, term);
  if (editableMatch) return { score: Math.round(1 * idf * 10) / 10, match: editableMatch };

  if (textMatches(`${profile.summary} ${profile.rawText} ${haystack}`, term))
    return { score: Math.round(1 * idf * 10) / 10, match: term };

  return { score: 0, match: null };
}

function semanticValues(profile: ComponentSemanticProfile): string[] {
  return [
    profile.role,
    profile.category,
    profile.source,
    ...profile.scenes,
    ...profile.intents,
    ...profile.motion.triggers,
    ...profile.motion.primitives,
    profile.motion.intensity,
    ...profile.visual.colors,
    ...profile.visual.style,
    ...profile.visual.shape,
    profile.visual.density,
    ...profile.editable.editableFields
  ];
}

function componentSatisfiesTerm(profile: ComponentSemanticProfile, term: string): boolean {
  return semanticTermMatches(semanticValues(profile), term);
}

function strictFilter(
  components: MotionComponent[],
  predicate: (profile: ComponentSemanticProfile) => boolean
): MotionComponent[] {
  return components.filter((component) => predicate(getSemanticProfile(component)));
}

function sourceFilterWithFallback(components: MotionComponent[], sources: string[]): MotionComponent[] {
  if (sources.length === 0) return components;
  const filtered = strictFilter(components, (profile) => sources.includes(profile.source));
  return filtered.length > 0 ? filtered : components;
}

function countMatches(needles: string[], haystack: string[]): number {
  return needles.filter((term) => semanticTermMatches(haystack, term)).length;
}

function semanticScore(query: QuerySemanticProfile, profile: ComponentSemanticProfile): number {
  const values = semanticValues(profile);
  let score = 0;

  if (query.roles.includes(profile.role)) score += 12;
  if (query.categories.includes(profile.category)) score += 4;
  if (query.sources.includes(profile.source)) score += 2;

  score += countMatches(query.scenes, profile.scenes) * 4;
  score += countMatches(query.intents, profile.intents) * 3;
  score += countMatches(query.motion.triggers, profile.motion.triggers) * 4;
  score += countMatches(query.motion.primitives, profile.motion.primitives) * 3;
  score += countMatches(query.visual.colors, profile.visual.colors) * 4;
  score += countMatches(query.visual.style, profile.visual.style) * 2;
  score += countMatches(query.visual.shape, profile.visual.shape) * 2;
  score += countMatches(query.should, values) * 1.5;

  return Math.round(score * 10) / 10;
}

function hasSearchIntent(intent: ParsedBriefIntent, query: QuerySemanticProfile): boolean {
  return Boolean(
    intent.query.trim() ||
      intent.semanticQuery.trim() ||
      query.roles.length ||
      query.categories.length ||
      query.scenes.length ||
      query.intents.length ||
      query.motion.triggers.length ||
      query.motion.primitives.length ||
      query.visual.colors.length ||
      query.visual.style.length ||
      query.visual.shape.length ||
      query.must.length ||
      query.should.length
  );
}

export function recommendComponents(input: {
  brief?: string;
  intent?: ParsedBriefIntent;
  components: MotionComponent[];
  limit?: number;
}): Recommendation[] {
  const intent = input.intent ?? createFallbackBriefIntent(input.brief ?? "");
  const queryProfile = createQuerySemanticProfile(intent);
  const terms = extractIntentTerms(intent);
  const negativeTerms = unique(intent.negativePreferences);
  const hardConstraints = unique(queryProfile.must);

  let candidates = input.components;
  if (queryProfile.roles.length > 0) {
    candidates = strictFilter(candidates, (profile) => queryProfile.roles.includes(profile.role));
  }
  if (queryProfile.categories.length > 0) {
    candidates = strictFilter(candidates, (profile) => queryProfile.categories.includes(profile.category));
  }
  if (hardConstraints.length > 0) {
    candidates = strictFilter(candidates, (profile) =>
      hardConstraints.every((constraint) => componentSatisfiesTerm(profile, constraint))
    );
  }
  if (queryProfile.mustNot.length > 0) {
    candidates = strictFilter(candidates, (profile) =>
      queryProfile.mustNot.every((constraint) => !componentSatisfiesTerm(profile, constraint))
    );
  }
  candidates = sourceFilterWithFallback(candidates, queryProfile.sources);
  if (candidates.length === 0) return [];

  // IDF：基于候选池实时计算，惩罚高频词、奖励低频词
  const idfWeights = computeIdfWeights(candidates.length > 0 ? candidates : input.components);

  const requiresPositiveScore = hasSearchIntent(intent, queryProfile);

  return candidates
    .map((component) => {
      const profile = getProfile(component);
      const semanticProfile = getSemanticProfile(component);
      const haystack = componentHaystack(component);
      const matches = new Map<string, number>();
      const missing: string[] = [];

      const positiveScore = terms.reduce((total, term) => {
        const result = scoreTerm(term, profile, haystack, idfWeights);
        if (result.match) {
          const label = displayLabel(result.match);
          matches.set(label, Math.max(matches.get(label) ?? 0, result.score));
        }
        return total + result.score;
      }, 0);
      for (const term of [...queryProfile.must, ...queryProfile.should]) {
        if (componentSatisfiesTerm(semanticProfile, term)) {
          const label = displayLabel(term);
          matches.set(label, Math.max(matches.get(label) ?? 0, 1.5));
        }
      }
      const penalty = negativeTerms.reduce((total, term) => {
        return total + (scoreTerm(term, profile, haystack, idfWeights).score > 0 ? 5 : 0);
      }, 0);

      for (const constraint of hardConstraints) {
        if (!componentSatisfiesTerm(semanticProfile, constraint)) missing.push(displayLabel(constraint));
      }

      const dedupedScore = [...matches.values()].reduce((total, score) => total + score, 0);
      const score = (dedupedScore || positiveScore) + semanticScore(queryProfile, semanticProfile) - penalty;
      const uniqueMatches = displayLabels([...matches.keys()]).slice(0, 8);
      const uniqueMissing = displayLabels(unique(missing));
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
    .filter((item) => !requiresPositiveScore || item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? 6);
}
