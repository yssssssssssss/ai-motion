import type { BriefParseResult } from "@motion-tool/core";

type Props = {
  brief: string;
  parseResult: BriefParseResult | null;
  isLoading: boolean;
  onBriefChange: (brief: string) => void;
  onRecommend: () => void;
};

export function parsedChips(parseResult: BriefParseResult | null): string[] {
  if (!parseResult) return [];
  const terms = [
    ...parseResult.intent.componentKinds,
    ...parseResult.intent.motionStyles,
    ...parseResult.intent.sources,
    ...parseResult.intent.keywords
  ];

  return [...new Set(terms.filter(Boolean))].slice(0, 8);
}

export function BriefPanel({ brief, parseResult, isLoading, onBriefChange, onRecommend }: Props) {
  const chips = parsedChips(parseResult);

  return (
    <section className="discovery-panel" aria-label="动效需求推荐">
      <div className="brief-stack">
        <div className="brief-heading">
          <p className="eyebrow">智能动效推荐</p>
          <h1>今天想制作什么动效？</h1>
          <p className="muted">输入你的场景、风格和组件类型，系统会解析需求并推荐可编辑的动效组件。</p>
        </div>
        <textarea
          aria-label="动效需求"
          placeholder="例如：我想要一个适合活动页的紫色按钮 hover 动效"
          value={brief}
          onChange={(event) => onBriefChange(event.target.value)}
          rows={5}
        />
        <button className="ai-recommend-button" type="button" onClick={onRecommend} disabled={isLoading}>
          {isLoading ? "正在推荐..." : "生成推荐"}
        </button>
        {parseResult ? (
          <div className="status-grid" aria-label="需求解析状态">
            <span className="status-pill">{parseResult.mode === "llm" ? "LLM 解析完成" : "本地规则兜底"}</span>
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
