import {
  createGenerationPlan,
  recommendComponents,
  resolveReferenceComponents,
  type MotionComponent
} from "@motion-tool/core";
import { hasRenderableSource } from "../features/library/sourceState";

const GENERATION_PREFETCH_LIMIT = 6;
const GENERATION_CANDIDATE_LIMIT = 3;

export type LoadControlledGenerationCandidatesInput = {
  brief: string;
  components: MotionComponent[];
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
};

function componentById(components: MotionComponent[]): Map<string, MotionComponent> {
  return new Map(components.map((component) => [component.id, component]));
}

function uniqueComponents(components: MotionComponent[]): MotionComponent[] {
  const seen = new Set<string>();
  return components.filter((component) => {
    if (seen.has(component.id)) return false;
    seen.add(component.id);
    return true;
  });
}

async function hydrateCandidate(
  component: MotionComponent,
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>
): Promise<MotionComponent> {
  return hasRenderableSource(component) ? component : onLoadComponentSource(component);
}

export async function loadControlledGenerationCandidates({
  brief,
  components,
  onLoadComponentSource
}: LoadControlledGenerationCandidatesInput): Promise<MotionComponent[]> {
  const byId = componentById(components);
  const pinnedReferences = resolveReferenceComponents({
    brief,
    components,
    limit: GENERATION_CANDIDATE_LIMIT
  })
    .map((reference) => byId.get(reference.componentId))
    .filter((component): component is MotionComponent => Boolean(component));
  const recommendationPool = uniqueComponents([
    ...pinnedReferences,
    ...recommendComponents({
      brief,
      components,
      limit: GENERATION_PREFETCH_LIMIT
    })
      .map((recommendation) => byId.get(recommendation.componentId))
      .filter((component): component is MotionComponent => Boolean(component))
  ]);

  const hydratedPool = await Promise.all(
    recommendationPool.map((component) => hydrateCandidate(component, onLoadComponentSource))
  );
  const hydratedPinnedReferences = hydratedPool.filter((component) =>
    pinnedReferences.some((reference) => reference.id === component.id)
  );
  const hydratedById = componentById(hydratedPool);
  const plan = createGenerationPlan({
    brief,
    components: hydratedPool,
    limit: GENERATION_CANDIDATE_LIMIT
  });

  const plannedCandidates = plan.candidates
    .map((candidate) => hydratedById.get(candidate.componentId))
    .filter((component): component is MotionComponent => Boolean(component));

  return uniqueComponents([...hydratedPinnedReferences, ...plannedCandidates]).slice(0, GENERATION_CANDIDATE_LIMIT);
}
