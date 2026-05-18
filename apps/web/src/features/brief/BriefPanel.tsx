import type { BriefParseResult } from "@motion-tool/core";

type Props = {
  brief: string;
  parseResult: BriefParseResult | null;
  isLoading: boolean;
  onBriefChange: (brief: string) => void;
  onRecommend: () => void;
};

function parsedChips(parseResult: BriefParseResult | null): string[] {
  if (!parseResult) return [];
  return [
    ...parseResult.intent.componentKinds,
    ...parseResult.intent.motionStyles,
    ...parseResult.intent.sources,
    ...parseResult.intent.keywords
  ].slice(0, 8);
}

export function BriefPanel({ brief, parseResult, isLoading, onBriefChange, onRecommend }: Props) {
  const chips = parsedChips(parseResult);

  return (
    <section className="discovery-panel" aria-label="Brief recommendation">
      <div className="brief-stack">
        <div>
          <p className="eyebrow">Brief input</p>
          <h1>Describe what you need</h1>
          <p className="muted">Use natural language to get AI-ranked motion components, or browse the feed below.</p>
        </div>
        <textarea value={brief} onChange={(event) => onBriefChange(event.target.value)} rows={5} />
        <button className="ai-recommend-button" type="button" onClick={onRecommend} disabled={isLoading}>
          {isLoading ? "Recommending..." : "AI Recommend"}
        </button>
        {parseResult ? (
          <div className="status-grid" aria-label="Brief parse status">
            <span className="status-pill">{parseResult.mode === "llm" ? "LLM parsed" : "local fallback ready"}</span>
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
