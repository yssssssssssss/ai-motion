export type ParameterMode = "plus" | "pro";

type Props = {
  mode: ParameterMode;
  onChange: (mode: ParameterMode) => void;
  plusDisabled?: boolean;
};

export function ParameterModeTabs({ mode, onChange, plusDisabled = false }: Props) {
  return (
    <div className="parameter-mode-tabs" role="tablist" aria-label="参数模式">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "plus"}
        disabled={plusDisabled}
        className={mode === "plus" ? "is-active" : undefined}
        onClick={() => onChange("plus")}
      >
        Plus
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "pro"}
        className={mode === "pro" ? "is-active" : undefined}
        onClick={() => onChange("pro")}
      >
        Pro
      </button>
    </div>
  );
}
