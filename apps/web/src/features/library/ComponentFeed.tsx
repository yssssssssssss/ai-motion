import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MotionComponent } from "@motion-tool/core";
import {
  analyzeComponentHealth,
  analyzeGenerationReadiness,
  createSearchProfile,
  type GenerationReadinessReport,
  type SearchProfile
} from "@motion-tool/core";
import { renderPreviewHtml } from "../editor/previewHtml";
import { createEmptyPatch } from "../../state/projectStore";
import { hasRenderableSource } from "./sourceState";

type Filter = "all" | "workeasy" | "native" | "uploaded" | "buttons" | "cards" | "checkboxes";
export type ReadinessFilter = "all" | "ready" | "partial" | "needs-spec";

type Props = {
  components: MotionComponent[];
  aiMatchIds: Set<string>;
  isLoading?: boolean;
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
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

const readinessFilters: Array<{ id: ReadinessFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "ready", label: "生成就绪" },
  { id: "partial", label: "部分可生成" },
  { id: "needs-spec", label: "需补规范" }
];

const INITIAL_PREVIEW_COUNT = 12;

export function shouldLoadPreviewSource(component: MotionComponent, state: { isMounted: boolean }): boolean {
  if (!state.isMounted || hasRenderableSource(component)) return false;
  return true;
}

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

function healthTone(report: ReturnType<typeof analyzeComponentHealth>): "good" | "warn" | "bad" {
  if (report.checks.some((check) => check.status === "fail")) return "bad";
  if (report.score < 90) return "warn";
  return "good";
}

function healthSummary(report: ReturnType<typeof analyzeComponentHealth>): string {
  const issue = report.checks.find((check) => check.status !== "pass");
  return issue ? `${issue.label}: ${issue.message}` : "组件预览、编辑和导出状态正常";
}

const COLOR_SWATCH: Record<string, string> = {
  红色: "#ef4444",
  橙色: "#f97316",
  黄色: "#eab308",
  绿色: "#22c55e",
  青色: "#06b6d4",
  蓝色: "#3b82f6",
  紫色: "#a855f7",
  粉色: "#ec4899",
  黑色: "#171717",
  白色: "#fafafa",
  灰色: "#9ca3af",
  棕色: "#92400e",
  金色: "#fbbf24",
  深色: "#262626",
  多彩: "#cbd5e1"
};

const profileCache = new WeakMap<MotionComponent, SearchProfile>();
const readinessCache = new WeakMap<MotionComponent, GenerationReadinessReport>();

function getProfile(component: MotionComponent): SearchProfile {
  const cached = profileCache.get(component);
  if (cached) return cached;
  const p = createSearchProfile(component);
  profileCache.set(component, p);
  return p;
}

function getGenerationReadiness(component: MotionComponent): GenerationReadinessReport {
  const cached = readinessCache.get(component);
  if (cached) return cached;
  const report = analyzeGenerationReadiness(component);
  readinessCache.set(component, report);
  return report;
}

function readinessLabel(report: GenerationReadinessReport): string {
  if (report.status === "ready") return "生成就绪";
  if (report.status === "partial") return "部分可生成";
  return "需补规范";
}

function readinessTone(report: GenerationReadinessReport): "good" | "warn" | "bad" {
  if (report.status === "ready") return "good";
  if (report.status === "partial") return "warn";
  return "bad";
}

function readinessSummary(report: GenerationReadinessReport): string {
  const issue = report.checks.find((check) => check.status !== "pass");
  return issue ? `${issue.label}: ${issue.message}` : "已具备规范、图层和 Plus 控制基础";
}

function matchesFilter(component: MotionComponent, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "workeasy") return sourceLabel(component) === "工作易";
  if (filter === "native") return sourceLabel(component) === "内置";
  if (filter === "uploaded") return sourceLabel(component) === "上传";
  return component.tags.includes(filter);
}

export function matchesReadinessFilter(component: MotionComponent, filter: ReadinessFilter): boolean {
  if (filter === "all") return true;
  const status = getGenerationReadiness(component).status;
  if (filter === "needs-spec") return status === "blocked";
  return status === filter;
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

function LazyFeedPreview({
  component,
  eager,
  onLoadComponentSource
}: {
  component: MotionComponent;
  eager: boolean;
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
}) {
  const [shouldMount, setShouldMount] = useState(eager);
  const [hydratedComponent, setHydratedComponent] = useState(component);
  const previewRef = useRef<HTMLSpanElement>(null);
  const isMounted = eager || shouldMount;

  useEffect(() => {
    setHydratedComponent(component);
  }, [component]);

  useEffect(() => {
    if (isMounted) return;
    const element = previewRef.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      setShouldMount(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldMount(true);
        observer.disconnect();
      },
      { rootMargin: "360px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isMounted]);

  useEffect(() => {
    if (!shouldLoadPreviewSource(hydratedComponent, { isMounted })) return;
    let ignore = false;
    onLoadComponentSource(hydratedComponent).then((loaded) => {
      if (!ignore) setHydratedComponent(loaded);
    });
    return () => {
      ignore = true;
    };
  }, [hydratedComponent, isMounted, onLoadComponentSource]);

  const canPreview = hasRenderableSource(hydratedComponent);

  return (
    <span className={`feed-thumb ${componentKind(component)}`} ref={previewRef}>
      {isMounted && canPreview ? (
        <iframe
          className="feed-preview-frame"
          loading={eager ? "eager" : "lazy"}
          sandbox="allow-scripts"
          srcDoc={getCachedThumbnail(hydratedComponent)}
          title={`${hydratedComponent.name} 预览`}
        />
      ) : (
        <span className="feed-preview-placeholder" aria-label={`${component.name} 预览加载占位`} />
      )}
    </span>
  );
}

export function ComponentFeed({
  components,
  aiMatchIds,
  isLoading = false,
  onLoadComponentSource,
  restoreComponentId,
  onSelect,
  onRestoreComplete
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const visible = useMemo(
    () =>
      components.filter(
        (component) => matchesFilter(component, filter) && matchesReadinessFilter(component, readinessFilter)
      ),
    [components, filter, readinessFilter]
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
        <div className="feed-filters readiness-filters" aria-label="生成就绪度筛选">
          {readinessFilters.map((item) => (
            <button
              className={item.id === readinessFilter ? "filter-pill is-on" : "filter-pill"}
              key={item.id}
              type="button"
              onClick={() => setReadinessFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="feed-loading" aria-label="组件库加载中">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="feed-loading-card" key={index} />
          ))}
        </div>
      ) : null}
      <div className="feed-grid" aria-busy={isLoading}>
        {visible.map((component, index) => {
          const isAiMatch = aiMatchIds.has(component.id);
          const profile = getProfile(component);
          const health = analyzeComponentHealth(component);
          const readiness = getGenerationReadiness(component);
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
              <LazyFeedPreview
                component={component}
                eager={index < INITIAL_PREVIEW_COUNT}
                onLoadComponentSource={onLoadComponentSource}
              />
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
                {isReadOnly(component) ? (
                  <em>代码预览</em>
                ) : (
                  <span className="feed-card-action">打开参数编辑器 -&gt;</span>
                )}
                <span className={`feed-health-badge ${healthTone(health)}`} title={healthSummary(health)}>
                  健康度 {health.score}
                </span>
                <span
                  className={`feed-readiness-row ${readinessTone(readiness)}`}
                  title={readinessSummary(readiness)}
                >
                  <span>{readinessLabel(readiness)}</span>
                  <span>
                    图层 {readiness.layerProfile.replaceableCount}/{readiness.layerProfile.layers.length}
                  </span>
                </span>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
