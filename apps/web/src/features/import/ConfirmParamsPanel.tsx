import type { MotionParam } from "@motion-tool/core";

type Props = {
  params: MotionParam[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
};

export function ConfirmParamsPanel({ params, selected, onToggle, onConfirm }: Props) {
  if (params.length === 0) return null;

  return (
    <section className="tool-section">
      <h2>确认可调参数</h2>
      <div className="field-list">
        {params.map((param) => (
          <label className="check-field" key={param.id}>
            <input type="checkbox" checked={selected.has(param.id)} onChange={() => onToggle(param.id)} />
            <span>
              {param.label} <small>{param.type}</small>
            </span>
          </label>
        ))}
      </div>
      <button className="secondary-action" type="button" onClick={onConfirm}>
        使用已选参数
      </button>
    </section>
  );
}
