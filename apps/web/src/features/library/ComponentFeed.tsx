import { useMemo, useState } from "react";
import type { MotionComponent } from "@motion-tool/core";
import { renderPreviewHtml } from "../editor/previewHtml";
import { createEmptyPatch } from "../../state/projectStore";

type Filter = "all" | "workeasy" | "native" | "buttons" | "cards" | "checkboxes";

type Props = {
  components: MotionComponent[];
  aiMatchIds: Set<string>;
  onSelect: (componentId: string) => void;
};

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "workeasy", label: "WorkEasy" },
  { id: "native", label: "内置" },
  { id: "buttons", label: "按钮" },
  { id: "cards", label: "卡片" },
  { id: "checkboxes", label: "选择控件" }
];

function sourceLabel(component: MotionComponent): "WorkEasy" | "内置" {
  return component.tags.includes("workeasy") ? "WorkEasy" : "内置";
}

function categoryLabel(category: string): string {
  if (category === "interaction") return "交互";
  if (category === "layout") return "布局";
  if (category === "text") return "文字";
  return category;
}

function componentKind(component: MotionComponent): string {
  if (component.tags.includes("buttons")) return "button";
  if (component.tags.includes("cards")) return "card";
  if (component.tags.includes("checkboxes")) return "checkbox";
  return component.category;
}

function matchesFilter(component: MotionComponent, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "workeasy") return sourceLabel(component) === "WorkEasy";
  if (filter === "native") return sourceLabel(component) === "内置";
  return component.tags.includes(filter);
}

function componentPreviewHtml(component: MotionComponent): string {
  return renderPreviewHtml({
    source: component.source,
    manifest: component.manifest,
    patch: createEmptyPatch(component.manifest),
    mode: "thumbnail"
  });
}

export function ComponentFeed({ components, aiMatchIds, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => components.filter((component) => matchesFilter(component, filter)), [components, filter]);

  return (
    <section className="feed-panel" id="feed" aria-label="浏览组件库">
      <div className="feed-header">
        <div>
          <p className="eyebrow">组件库</p>
          <h2>浏览所有动效组件</h2>
          <p className="muted">你可以直接浏览组件，也可以先输入需求，让 AI 帮你高亮匹配项。</p>
        </div>
        <div className="feed-filters" aria-label="组件筛选">
          {filters.map((item) => (
            <button
              className={item.id === filter ? "filter-pill is-on" : "filter-pill"}
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="feed-grid">
        {visible.map((component) => {
          const isAiMatch = aiMatchIds.has(component.id);
          return (
            <article
              className={isAiMatch ? "feed-card is-ai-match" : "feed-card"}
              key={component.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(component.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(component.id);
                }
              }}
            >
              <span className={`feed-thumb ${componentKind(component)}`}>
                <iframe
                  className="feed-preview-frame"
                  loading="lazy"
                  sandbox="allow-scripts"
                  srcDoc={componentPreviewHtml(component)}
                  title={`${component.name} 预览`}
                />
              </span>
              <span className="feed-body">
                <strong>{component.name}</strong>
                <small>
                  {sourceLabel(component)} · {categoryLabel(component.category)} · {component.manifest.params.length} 个参数
                </small>
                {isAiMatch ? <em>AI 匹配</em> : null}
                <span>打开参数编辑器 -&gt;</span>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
