import type { MotionComponent, Recommendation } from "@motion-tool/core";

type Props = {
  recommendations: Recommendation[];
  components: MotionComponent[];
  onSelect: (componentId: string) => void;
};

export function ComponentCandidates({ recommendations, components, onSelect }: Props) {
  const componentById = new Map(components.map((component) => [component.id, component]));
  if (recommendations.length === 0) return null;

  return (
    <section className="recommendation-strip" aria-label="AI recommended components">
      <div>
        <p className="eyebrow">AI Recommended</p>
        <h2>Matched components</h2>
        <p className="muted">These results appear after submitting a brief.</p>
      </div>
      <div className="recommendation-list">
        {recommendations.map((item, index) => {
          const component = componentById.get(item.componentId);
          const source = component?.tags.includes("workeasy") ? "WorkEasy" : "Native";
          return (
            <button
              className={index === 0 ? "recommendation-card is-top" : "recommendation-card"}
              key={item.componentId}
              type="button"
              onClick={() => onSelect(item.componentId)}
            >
              <strong>{component?.name ?? item.componentId}</strong>
              <span>{item.reason}</span>
              <div className="score-bar">
                <span style={{ width: `${Math.min(100, item.score * 24)}%` }} />
              </div>
              <small>
                {source} · {component?.category ?? "component"} · {component?.manifest.params.length ?? 0} params
              </small>
              <em>Open editor page -&gt;</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
