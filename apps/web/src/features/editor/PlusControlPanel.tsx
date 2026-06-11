import type { PlusControl, PlusControlKind, PlusControlValue, PlusPatchValues } from "@motion-tool/core";

type Props = {
  controls: PlusControl[];
  values: PlusPatchValues;
  affectedParamIds: string[];
  onChange: (controlId: PlusControlKind, value: PlusControlValue) => void;
  onReset?: () => void;
};

function currentValue(control: PlusControl, values: PlusPatchValues): PlusControlValue {
  return values[control.id] ?? { option: control.defaultOption, amount: control.defaultAmount };
}

export function PlusControlPanel({ controls, values, affectedParamIds, onChange, onReset }: Props) {
  if (controls.length === 0) {
    return (
      <div className="plus-empty">
        <p className="eyebrow">Plus</p>
        <h3>该组件暂无简化控制</h3>
        <p>你仍可以切换到 Pro 模式调整完整参数。</p>
      </div>
    );
  }

  return (
    <div className="plus-panel">
      {onReset ? (
        <div className="field-toolbar">
          <button type="button" className="ghost" onClick={onReset}>
            重置默认值
          </button>
        </div>
      ) : null}
      {controls.map((control) => {
        const value = currentValue(control, values);

        return (
          <section className="plus-control" key={control.id} aria-label={control.label}>
            <div className="plus-control__header">
              <h3>{control.label}</h3>
              <span>{Math.round(control.confidence * 100)}%</span>
            </div>
            <div className="plus-options" role="group" aria-label={`${control.label}选项`}>
              {control.options.map((option) => (
                <button
                  type="button"
                  className={option.value === value.option ? "is-active" : undefined}
                  key={option.id}
                  onClick={() => onChange(control.id, { ...value, option: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="plus-slider">
              <span>{control.sliderLabel}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={value.amount}
                onChange={(event) => onChange(control.id, { ...value, amount: Number(event.target.value) })}
              />
              <output>{value.amount}</output>
            </label>
          </section>
        );
      })}
      {affectedParamIds.length > 0 ? (
        <p className="plus-affected">已影响：{affectedParamIds.join("、")}</p>
      ) : null}
    </div>
  );
}
