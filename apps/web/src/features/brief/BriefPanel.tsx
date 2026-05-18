type Props = {
  brief: string;
  onBriefChange: (brief: string) => void;
  onRecommend: () => void;
};

export function BriefPanel({ brief, onBriefChange, onRecommend }: Props) {
  return (
    <section className="tool-section">
      <h2>Brief</h2>
      <textarea value={brief} onChange={(event) => onBriefChange(event.target.value)} rows={5} />
      <button className="primary-action" type="button" onClick={onRecommend}>
        Recommend
      </button>
    </section>
  );
}
