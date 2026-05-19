import type { MotionManifest, MotionParam, MotionPatch } from "@motion-tool/core";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
};

export function numericParamValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
    if (match?.[0]) return Number(match[0]);
  }

  return 0;
}

export type ParamControlKind = "color" | "range" | "text" | "select" | "toggle" | "unsupported";

export function paramControlKind(param: Pick<MotionParam, "type" | "constraints">): ParamControlKind {
  if (param.type === "color") return "color";
  if (param.type === "text" || param.type === "easing" || param.type === "position" || param.type === "transform") return "text";
  if (param.type === "toggle") return "toggle";
  if (param.type === "select") {
    return param.constraints?.options?.length ? "select" : "unsupported";
  }
  if (param.type === "duration" || param.type === "range" || param.type === "number") {
    const { min, max, step } = param.constraints ?? {};
    return typeof min === "number" && typeof max === "number" && typeof step === "number" ? "range" : "unsupported";
  }
  return "unsupported";
}

export function ParameterPanel({ manifest, patch, onChange }: Props) {
  if (!manifest || !patch) return <p className="muted">尚未选择动效源。</p>;

  const params = manifest.params.filter((param) => param.status === "confirmed");
  if (params.length === 0) return <p className="muted">暂无可确认参数。</p>;

  return (
    <div className="field-list">
      {params.map((param) => {
        const value = patch.values[param.id] ?? param.default;
        const numericValue = numericParamValue(value);
        const control = paramControlKind(param);

        if (control === "color") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <input type="color" value={String(value)} onChange={(event) => onChange(param.id, event.target.value)} />
            </label>
          );
        }

        if (control === "range") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <input
                type="range"
                min={param.constraints?.min ?? 0}
                max={param.constraints?.max ?? 2000}
                step={param.constraints?.step ?? 1}
                value={numericValue}
                onChange={(event) => onChange(param.id, Number(event.target.value))}
              />
              <output>
                {numericValue}
                {param.constraints?.unit ?? ""}
              </output>
            </label>
          );
        }

        if (control === "select") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <select value={String(value)} onChange={(event) => onChange(param.id, event.target.value)}>
                {param.constraints?.options?.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (control === "toggle") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(param.id, event.target.checked)} />
            </label>
          );
        }

        if (control === "unsupported") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <input value={String(value)} disabled />
            </label>
          );
        }

        return (
          <label className="field" key={param.id}>
            <span>{param.label}</span>
            <input value={String(value)} onChange={(event) => onChange(param.id, event.target.value)} />
          </label>
        );
      })}
    </div>
  );
}
