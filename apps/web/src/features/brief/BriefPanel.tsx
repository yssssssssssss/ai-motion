import type { ReactNode } from "react";
import { displayLabels, type BriefParseResult } from "@motion-tool/core";

export type BriefPanelMode = "recommend" | "generate" | "atomic";

type Props = {
  mode: BriefPanelMode;
  brief: string;
  parseResult: BriefParseResult | null;
  isLoading: boolean;
  isDisabled?: boolean;
  generationStatus?: string | null;
  onModeChange: (mode: BriefPanelMode) => void;
  onBriefChange: (brief: string) => void;
  onBriefFocus?: () => void;
  onRecommend: () => void;
  onGenerate: () => void;
  onGenerateAtomicMotion: () => void;
  atomicMotionPanel: ReactNode;
};

export function parsedChips(parseResult: BriefParseResult | null): string[] {
  if (!parseResult) return [];
  const terms = [
    ...parseResult.intent.componentKinds,
    ...parseResult.intent.motionStyles,
    ...parseResult.intent.sources,
    ...parseResult.intent.keywords,
    ...parseResult.intent.softPreferences,
    ...parseResult.intent.hardConstraints
  ];

  return displayLabels(terms).slice(0, 8);
}

function EtherealShadowBackground() {
  return (
    <div className="ethereal-shadow-background" aria-hidden="true">
      <svg className="ethereal-shadow-filter" focusable="false">
        <defs>
          <filter id="ethereal-shadow-filter" x="-24%" y="-24%" width="148%" height="148%">
            <feTurbulence
              result="ethereal-noise"
              type="turbulence"
              baseFrequency="0.0012 0.003"
              numOctaves="2"
              seed="7"
            >
              <animate
                attributeName="baseFrequency"
                dur="18s"
                values="0.0012 0.003;0.0021 0.005;0.0008 0.0024;0.0012 0.003"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feColorMatrix
              in="ethereal-noise"
              result="ethereal-circulation"
              type="matrix"
              values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="ethereal-circulation"
              scale="72"
              result="ethereal-displaced"
            >
              <animate attributeName="scale" dur="14s" values="56;92;68;104;56" repeatCount="indefinite" />
            </feDisplacementMap>
            <feGaussianBlur in="ethereal-displaced" stdDeviation="4" result="ethereal-blur" />
            <feBlend in="ethereal-blur" in2="SourceGraphic" mode="screen" />
          </filter>
        </defs>
      </svg>
      <div className="ethereal-shadow-field">
        <div className="ethereal-shadow-mask" />
      </div>
      <div className="ethereal-shadow-noise" />
    </div>
  );
}

export function BriefPanel({
  mode,
  brief,
  parseResult,
  isLoading,
  isDisabled = false,
  generationStatus,
  onModeChange,
  onBriefChange,
  onBriefFocus,
  onRecommend,
  onGenerate,
  onGenerateAtomicMotion,
  atomicMotionPanel
}: Props) {
  const chips = parsedChips(parseResult);
  const isGenerateMode = mode === "generate";
  const isAtomicMode = mode === "atomic";
  const heading =
    mode === "generate"
      ? {
          eyebrow: "自然语义生成动效组件",
          title: "按规范生成新动效",
          description: "输入目标效果，系统会从候选组件和设计规范中生成一个可编辑版本。",
          button: "生成新组件",
          loading: "正在生成..."
        }
      : mode === "atomic"
        ? {
            eyebrow: "原子动效参数",
            title: "按参数还原动效",
            description: "选择设计师维护的元素、梯度和参数，直接生成可编辑的原子动效草稿。",
            button: "生成原子草稿",
            loading: "正在生成..."
          }
        : {
            eyebrow: "智能动效推荐",
            title: "今天想制作什么动效？",
            description: "输入你的场景、风格和组件类型，系统会解析需求并推荐可编辑的动效组件。",
            button: "生成推荐",
            loading: "正在推荐..."
          };
  const modeClassName =
    mode === "generate" ? "is-generate-mode" : mode === "atomic" ? "is-atomic-mode" : "is-recommend-mode";
  const stackClassName =
    mode === "generate" ? "is-generate-stack" : mode === "atomic" ? "is-atomic-stack" : "is-recommend-stack";
  const panelClassName = `discovery-panel ${modeClassName}`;
  const gradientClassName = `background-gradient-animation${mode !== "recommend" ? " is-active" : ""}`;
  const action = isAtomicMode
    ? { onClick: onGenerateAtomicMotion, label: heading.button, loading: heading.loading }
    : isGenerateMode
      ? { onClick: onGenerate, label: heading.button, loading: heading.loading }
      : { onClick: onRecommend, label: heading.button, loading: heading.loading };

  return (
    <section className={panelClassName} aria-label="动效需求推荐">
      {isAtomicMode ? (
        <EtherealShadowBackground />
      ) : (
        <div className={gradientClassName} aria-hidden="true">
          <div className="background-gradient-animation__field" />
          <div className="background-gradient-animation__veil" />
        </div>
      )}
      <div className={`brief-stack ${stackClassName}`}>
        <div className="brief-heading">
          <p className="eyebrow">{heading.eyebrow}</p>
          <h1>{heading.title}</h1>
          <p className="muted">{heading.description}</p>
        </div>
        <div className="brief-mode-tabs" role="tablist" aria-label="动效需求模式">
          <button
            className={mode === "recommend" ? "brief-mode-tab is-on" : "brief-mode-tab"}
            type="button"
            role="tab"
            aria-selected={mode === "recommend"}
            onClick={() => onModeChange("recommend")}
          >
            智能推荐
          </button>
          <button
            className={mode === "generate" ? "brief-mode-tab is-on" : "brief-mode-tab"}
            type="button"
            role="tab"
            aria-selected={mode === "generate"}
            onClick={() => onModeChange("generate")}
          >
            自然语义生成
          </button>
          <button
            className={mode === "atomic" ? "brief-mode-tab is-on" : "brief-mode-tab"}
            type="button"
            role="tab"
            aria-selected={mode === "atomic"}
            onClick={() => onModeChange("atomic")}
          >
            原子动效参数
          </button>
        </div>
        <div
          className={`brief-content-region ${isAtomicMode ? "is-atomic-content" : "is-prompt-content"}`}
          key={mode}
        >
          {isAtomicMode ? (
            atomicMotionPanel
          ) : (
            <textarea
              aria-label="动效需求"
              placeholder="例如：我想要一个适合活动页的紫色按钮悬停动效"
              value={brief}
              onChange={(event) => onBriefChange(event.target.value)}
              onFocus={onBriefFocus}
              rows={5}
            />
          )}
        </div>
        <div className="brief-actions">
          <button
            className="ai-recommend-button"
            type="button"
            onClick={action.onClick}
            disabled={isLoading || isDisabled}
          >
            {isDisabled ? "组件库加载中..." : isLoading ? action.loading : action.label}
          </button>
        </div>
        {(isGenerateMode || isAtomicMode) && generationStatus ? (
          <div className="status-grid" aria-label="生成状态">
            <span className="status-pill">{generationStatus}</span>
          </div>
        ) : null}
        {!isGenerateMode && parseResult ? (
          <div className="status-grid" aria-label="需求解析状态">
            <span className="status-pill">
              {parseResult.mode === "llm" ? "模型解析完成" : "本地规则兜底"}
            </span>
            <span className="status-pill muted">{parseResult.message}</span>
            {chips.map((chip) => (
              <span className="brief-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
