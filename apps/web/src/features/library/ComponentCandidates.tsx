import type { MotionComponent, Recommendation } from "@motion-tool/core";

type Props = {
  recommendations: Recommendation[];
  components: MotionComponent[];
  onSelect: (componentId: string) => void;
};

function categoryLabel(category: string | undefined): string {
  if (category === "interaction") return "交互";
  if (category === "layout") return "布局";
  if (category === "text") return "文字";
  return category ?? "组件";
}

function sourceLabel(component: MotionComponent | undefined): string {
  return component?.tags.includes("workeasy") ? "工作易" : "内置";
}

export function ComponentCandidates({ recommendations, components, onSelect }: Props) {
  const componentById = new Map(components.map((component) => [component.id, component]));
  if (recommendations.length === 0) return null;

  return (
    <section className="recommendation-strip" id="recommend" aria-label="智能推荐组件">
      <div>
        <p className="eyebrow">智能推荐结果</p>
        <h2>匹配组件</h2>
        <p className="muted">提交需求后，这里会展示最接近的可编辑动效。</p>
      </div>
      <div className="recommendation-list">
        {recommendations.map((item, index) => {
          const component = componentById.get(item.componentId);
          const source = sourceLabel(component);
          return (
            <button
              className={index === 0 ? "recommendation-card is-top" : "recommendation-card"}
              key={item.componentId}
              type="button"
              onClick={() => onSelect(item.componentId)}
            >
              <strong>{component?.name ?? item.componentId}</strong>
              <span>{item.reason}</span>
              {item.matches.length > 0 ? (
                <div className="match-chip-row" aria-label="命中需求">
                  {item.matches.slice(0, 5).map((match) => (
                    <small className="match-chip" key={match}>
                      {match}
                    </small>
                  ))}
                </div>
              ) : null}
              <div className="score-bar">
                <span style={{ width: `${Math.min(100, item.score * 24)}%` }} />
              </div>
              <small>
                {source} · {categoryLabel(component?.category)} · {component?.manifest.params.length ?? 0}{" "}
                个参数
              </small>
              <em>打开参数编辑器 -&gt;</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
