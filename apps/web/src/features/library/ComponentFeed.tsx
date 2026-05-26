import { useLayoutEffect, useMemo, useState } from "react";
import type { MotionComponent } from "@motion-tool/core";
import { createSearchProfile, type SearchProfile } from "@motion-tool/core";
import { renderPreviewHtml } from "../editor/previewHtml";
import { createEmptyPatch } from "../../state/projectStore";

type Filter = "all" | "workeasy" | "native" | "uploaded" | "buttons" | "cards" | "checkboxes";

type Props = {
  components: MotionComponent[];
  aiMatchIds: Set<string>;
  restoreComponentId?: string | null | undefined;
  onSelect: (componentId: string) => void;
  onRestoreComplete?: (() => void) | undefined;
};

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "workeasy", label: "工作易" },
  { id: "native", label: "内置" },
  { id: "uploaded", label: "上传" },
  { id: "buttons", label: "按钮" },
  { id: "cards", label: "卡片" },
  { id: "checkboxes", label: "选择控件" }
];

function sourceLabel(component: MotionComponent): "工作易" | "内置" | "上传" {
  if (component.source.origin === "imported") return "上传";
  return component.tags.includes("workeasy") ? "工作易" : "内置";
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
  if (component.tags.includes("read-only")) return "read-only";
  return component.category;
}

function isReadOnly(component: MotionComponent): boolean {
  return component.tags.includes("read-only") || component.manifest.params.length === 0;
}

const COLOR_SWATCH: Record<string, string> = {
  红色: "#ef4444", 橙色: "#f97316", 黄色: "#eab308", 绿色: "#22c55e",
  青色: "#06b6d4", 蓝色: "#3b82f6", 紫色: "#a855f7", 粉色: "#ec4899",
  黑色: "#171717", 白色: "#fafafa", 灰色: "#9ca3af", 棕色: "#92400e",
  金色: "#fbbf24", 深色: "#262626", 多彩: "#cbd5e1"
};

const profileCache = new WeakMap<MotionComponent, SearchProfile>();

function getProfile(component: MotionComponent): SearchProfile {
  const cached = profileCache.get(component);
  if (cached) return cached;
  const p = createSearchProfile(component);
  profileCache.set(component, p);
  return p;
}

function matchesFilter(component: MotionComponent, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "workeasy") return sourceLabel(component) === "工作易";
  if (filter === "native") return sourceLabel(component) === "内置";
  if (filter === "uploaded") return sourceLabel(component) === "上传";
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

// 同一组件的 thumbnail HTML 是稳定的，缓存到模块层避免重渲时重新拼装
const thumbnailCache = new WeakMap<MotionComponent, string>();

function getCachedThumbnail(component: MotionComponent): string {
  const cached = thumbnailCache.get(component);
  if (cached) return cached;
  const html = componentPreviewHtml(component);
  thumbnailCache.set(component, html);
  return html;
}

export function ComponentFeed({
  components,
  aiMatchIds,
  restoreComponentId,
  onSelect,
  onRestoreComplete
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(
    () => components.filter((component) => matchesFilter(component, filter)),
    [components, filter]
  );

  useLayoutEffect(() => {
    if (!restoreComponentId) return;

    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-component-id]")).find(
      (element) => element.dataset.componentId === restoreComponentId
    );
    if (target) {
      target.scrollIntoView({ block: "center" });
    }
    onRestoreComplete?.();
  }, [restoreComponentId, onRestoreComplete]);

  return (
    <section className="feed-panel" id="feed" aria-label="浏览组件库">
      <div className="feed-header">
        <div>
          <p className="eyebrow">组件库</p>
          <h2>浏览所有动效组件</h2>
          <p className="muted">你可以直接浏览组件，也可以先输入需求，让智能推荐帮你高亮匹配项。</p>
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
          const profile = getProfile(component);
          return (
            <article
              className={isAiMatch ? "feed-card is-ai-match" : "feed-card"}
              data-component-id={component.id}
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
                  srcDoc={getCachedThumbnail(component)}
                  title={`${component.name} 预览`}
                />
              </span>
              <span className="feed-body">
                <strong>{component.name}</strong>
                <small>
                  {sourceLabel(component)} · {categoryLabel(component.category)} ·{" "}
                  {isReadOnly(component) ? "只读" : `${component.manifest.params.length} 个参数`}
                </small>
                <span className="feed-tags">
                  {profile.colorFacet.primary !== "多彩" && (
                    <span
                      className="feed-tag color-tag"
                      style={{ backgroundColor: COLOR_SWATCH[profile.colorFacet.primary] ?? "#cbd5e1" }}
                      title={profile.colorFacet.primary}
                    />
                  )}
                  {profile.structuralTags.slice(0, 2).map((tag) => (
                    <span className="feed-tag structural-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </span>
                {isAiMatch ? <em>智能匹配</em> : null}
                {isReadOnly(component) ? <em>代码预览</em> : <span>打开参数编辑器 -&gt;</span>}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
