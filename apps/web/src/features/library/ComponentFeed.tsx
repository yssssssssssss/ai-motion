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
  { id: "all", label: "All" },
  { id: "workeasy", label: "WorkEasy" },
  { id: "native", label: "Native" },
  { id: "buttons", label: "Buttons" },
  { id: "cards", label: "Cards" },
  { id: "checkboxes", label: "Checkboxes" }
];

function sourceLabel(component: MotionComponent): "WorkEasy" | "Native" {
  return component.tags.includes("workeasy") ? "WorkEasy" : "Native";
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
  if (filter === "native") return sourceLabel(component) === "Native";
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
    <section className="feed-panel" aria-label="Browse component feed">
      <div className="feed-header">
        <div>
          <p className="eyebrow">Browse component feed</p>
          <h2>Explore all components</h2>
          <p className="muted">Browse directly or use the brief above to highlight AI matches.</p>
        </div>
        <div className="feed-filters" aria-label="Component filters">
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
                  title={`${component.name} preview`}
                />
              </span>
              <span className="feed-body">
                <strong>{component.name}</strong>
                <small>
                  {sourceLabel(component)} · {component.category} · {component.manifest.params.length} params
                </small>
                {isAiMatch ? <em>AI match</em> : null}
                <span>Open editor page -&gt;</span>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
