import { useEffect, useMemo, useState } from "react";
import type { MotionComponent, Recommendation } from "@motion-tool/core";
import { renderPreviewHtml } from "../editor/previewHtml";
import { createEmptyPatch } from "../../state/projectStore";
import { hasRenderableSource } from "./sourceState";

type Props = {
  recommendations: Recommendation[];
  components: MotionComponent[];
  hasSearched?: boolean;
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
  onSelect: (componentId: string) => void;
};

function categoryLabel(category: string | undefined): string {
  if (category === "interaction") return "交互";
  if (category === "layout") return "布局";
  if (category === "text") return "文字";
  return category ?? "组件";
}

function sourceLabel(component: MotionComponent | undefined): string {
  if (component?.source.origin === "imported") return "上传";
  return component?.tags.includes("workeasy") ? "工作易" : "内置";
}

function componentKind(component: MotionComponent | undefined): string {
  if (!component) return "unknown";
  if (component.tags.includes("buttons")) return "button";
  if (component.tags.includes("cards")) return "card";
  if (component.tags.includes("checkboxes")) return "checkbox";
  if (component.tags.includes("read-only")) return "read-only";
  return component.category;
}

function isReadOnly(component: MotionComponent | undefined): boolean {
  return Boolean(
    component && (component.tags.includes("read-only") || component.manifest.params.length === 0)
  );
}

function componentPreviewHtml(component: MotionComponent): string {
  return renderPreviewHtml({
    source: component.source,
    manifest: component.manifest,
    patch: createEmptyPatch(component.manifest),
    mode: "thumbnail"
  });
}

function RecommendationPreview({
  component,
  onLoadComponentSource
}: {
  component: MotionComponent;
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
}) {
  const [hydratedComponent, setHydratedComponent] = useState(component);

  useEffect(() => {
    setHydratedComponent(component);
  }, [component]);

  useEffect(() => {
    if (hasRenderableSource(hydratedComponent)) return;
    let ignore = false;
    onLoadComponentSource(hydratedComponent).then((loaded) => {
      if (!ignore) setHydratedComponent(loaded);
    });
    return () => {
      ignore = true;
    };
  }, [hydratedComponent, onLoadComponentSource]);

  return (
    <div className={`recommendation-preview ${componentKind(component)}`}>
      {hasRenderableSource(hydratedComponent) ? (
        <iframe
          className="recommendation-preview-frame"
          loading="lazy"
          sandbox="allow-scripts"
          srcDoc={componentPreviewHtml(hydratedComponent)}
          title={`${hydratedComponent.name} 搜索结果预览`}
        />
      ) : (
        <span className="feed-preview-placeholder" aria-label={`${component.name} 搜索结果预览加载占位`} />
      )}
    </div>
  );
}

export function ComponentCandidates({
  recommendations,
  components,
  hasSearched = false,
  onLoadComponentSource,
  onSelect
}: Props) {
  const componentById = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components]
  );
  if (recommendations.length === 0) {
    if (!hasSearched) return null;

    return (
      <section className="recommendation-empty" id="recommend" aria-label="智能推荐结果为空">
        <p className="eyebrow">智能推荐结果</p>
        <h2>暂未找到匹配组件</h2>
        <p className="muted">
          当前组件库没有满足这些条件的动效。可以减少硬性条件，换一种组件类型，或上传新的动效案例。
        </p>
      </section>
    );
  }

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
            <article
              className={index === 0 ? "recommendation-card is-top" : "recommendation-card"}
              key={item.componentId}
            >
              {component ? (
                <RecommendationPreview component={component} onLoadComponentSource={onLoadComponentSource} />
              ) : null}
              <div className="recommendation-body">
                <strong>{component?.name ?? item.componentId}</strong>
                <span className="recommendation-reason">{item.reason}</span>
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
                  {source} · {categoryLabel(component?.category)} ·{" "}
                  {isReadOnly(component) ? "只读" : `${component?.manifest.params.length ?? 0} 个参数`}
                </small>
                <button
                  className="recommendation-open-button"
                  type="button"
                  onClick={() => onSelect(item.componentId)}
                >
                  {isReadOnly(component) ? "查看代码预览" : "打开参数编辑器"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
