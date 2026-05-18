import type { MotionComponent, Recommendation } from "@motion-tool/core";

type Props = {
  recommendations: Recommendation[];
  components: MotionComponent[];
  onSelect: (componentId: string) => void;
};

export function ComponentCandidates({ recommendations, components, onSelect }: Props) {
  const componentById = new Map(components.map((component) => [component.id, component]));

  return (
    <section className="tool-section">
      <h2>Candidates</h2>
      {recommendations.length === 0 ? <p className="muted">Run recommendation to see built-in components.</p> : null}
      <div className="candidate-list">
        {recommendations.map((item) => {
          const component = componentById.get(item.componentId);
          return (
            <button className="candidate" key={item.componentId} type="button" onClick={() => onSelect(item.componentId)}>
              <strong>{component?.name ?? item.componentId}</strong>
              <span>{item.reason}</span>
              <small>
                {component?.tags.includes("workeasy") ? "WorkEasy" : "Native"} · {component?.category ?? "component"} ·{" "}
                {component?.manifest.params.length ?? 0} params
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
