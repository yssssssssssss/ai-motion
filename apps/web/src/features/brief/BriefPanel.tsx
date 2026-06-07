import { displayLabels, type BriefParseResult, type SemanticGenerationIntent } from "@motion-tool/core";

export type BriefPanelMode = "recommend" | "generate";

type Props = {
  mode: BriefPanelMode;
  brief: string;
  parseResult: BriefParseResult | null;
  generationIntent?: SemanticGenerationIntent | null;
  isLoading: boolean;
  isDisabled?: boolean;
  generationStatus?: string | null;
  onModeChange: (mode: BriefPanelMode) => void;
  onBriefChange: (brief: string) => void;
  onBriefFocus?: () => void;
  onRecommend: () => void;
  onGenerate: () => void;
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

function roleLabel(role: SemanticGenerationIntent["role"]): string | null {
  if (role === "page-transition") return "页面转场";
  if (role === "button") return "按钮";
  if (role === "card") return "卡片";
  if (role === "text") return "文字";
  if (role === "badge") return "标签";
  if (role === "loader") return "加载动画";
  if (role === "mobile-page") return "移动端页面";
  return null;
}

export function generationUnderstandingChips(intent: SemanticGenerationIntent | null | undefined): string[] {
  if (!intent) return [];
  const terms = [
    roleLabel(intent.role),
    ...intent.referenceHints.slice(0, 2),
    ...intent.colors.map((color) => color.label),
    ...intent.effects,
    intent.direction,
    intent.trigger,
    intent.speed,
    ...intent.negativePreferences.map((item) => `排除 ${item}`)
  ].filter((item): item is string => Boolean(item));

  return displayLabels(terms).slice(0, 9);
}

export function BriefPanel({
  mode,
  brief,
  parseResult,
  generationIntent,
  isLoading,
  isDisabled = false,
  generationStatus,
  onModeChange,
  onBriefChange,
  onBriefFocus,
  onRecommend,
  onGenerate
}: Props) {
  const chips = parsedChips(parseResult);
  const generationChips = generationUnderstandingChips(generationIntent);
  const isGenerateMode = mode === "generate";
  const heading = isGenerateMode
    ? {
        eyebrow: "自然语义生成动效组件",
        title: "按规范生成新动效",
        description: "输入目标效果，系统会从候选组件和设计规范中生成一个可编辑版本。",
        button: "生成新组件",
        loading: "正在生成..."
      }
    : {
        eyebrow: "智能动效推荐",
        title: "今天想制作什么动效？",
        description: "输入你的场景、风格和组件类型，系统会解析需求并推荐可编辑的动效组件。",
        button: "生成推荐",
        loading: "正在推荐..."
      };
  const panelClassName = `discovery-panel ${isGenerateMode ? "is-generate-mode" : "is-recommend-mode"}`;
  const stackClassName = `brief-stack ${isGenerateMode ? "is-generate-stack" : "is-recommend-stack"}`;
  const gradientClassName = `background-gradient-animation${isGenerateMode ? " is-active" : ""}`;

  return (
    <section className={panelClassName} aria-label="动效需求推荐">
      <div className={gradientClassName} aria-hidden="true">
        <div className="background-gradient-animation__field" />
        <div className="background-gradient-animation__veil" />
      </div>
      <div className={stackClassName}>
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
        </div>
        <textarea
          aria-label="动效需求"
          placeholder="例如：我想要一个适合活动页的紫色按钮悬停动效"
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          onFocus={onBriefFocus}
          rows={5}
        />
        <button
          className="ai-recommend-button"
          type="button"
          onClick={isGenerateMode ? onGenerate : onRecommend}
          disabled={isLoading || isDisabled}
        >
          {isDisabled ? "组件库加载中..." : isLoading ? heading.loading : heading.button}
        </button>
        {isGenerateMode && generationStatus ? (
          <div className="status-grid" aria-label="生成状态">
            <span className="status-pill">{generationStatus}</span>
          </div>
        ) : null}
        {isGenerateMode && generationChips.length > 0 ? (
          <div className="status-grid generation-understanding" aria-label="生成理解结果">
            <span className="status-pill muted">已理解</span>
            {generationChips.map((chip) => (
              <span className="brief-chip" key={chip}>
                {chip}
              </span>
            ))}
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
