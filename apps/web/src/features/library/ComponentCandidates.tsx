import type { Recommendation } from "@motion-tool/core";

type Props = {
  recommendations: Recommendation[];
  onSelect: (componentId: string) => void;
};

export function ComponentCandidates({ recommendations, onSelect }: Props) {
  return (
    <section className="tool-section">
      <h2>Candidates</h2>
      {recommendations.length === 0 ? <p className="muted">Run recommendation to see built-in components.</p> : null}
      <div className="candidate-list">
        {recommendations.map((item) => (
          <button className="candidate" key={item.componentId} type="button" onClick={() => onSelect(item.componentId)}>
            <strong>{item.componentId}</strong>
            <span>{item.reason}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
