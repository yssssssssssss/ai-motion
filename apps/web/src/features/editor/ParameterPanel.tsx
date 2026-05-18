import type { MotionManifest, MotionPatch } from "@motion-tool/core";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
};

export function ParameterPanel({ manifest, patch, onChange }: Props) {
  if (!manifest || !patch) return <p className="muted">No motion source selected.</p>;

  const params = manifest.params.filter((param) => param.status === "confirmed");
  if (params.length === 0) return <p className="muted">No confirmed parameters.</p>;

  return (
    <div className="field-list">
      {params.map((param) => {
        const value = patch.values[param.id] ?? param.default;

        if (param.type === "color") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <input type="color" value={String(value)} onChange={(event) => onChange(param.id, event.target.value)} />
            </label>
          );
        }

        if (param.type === "duration" || param.type === "range" || param.type === "number") {
          return (
            <label className="field" key={param.id}>
              <span>{param.label}</span>
              <input
                type="range"
                min={param.constraints?.min ?? 0}
                max={param.constraints?.max ?? 2000}
                step={param.constraints?.step ?? 1}
                value={Number(value)}
                onChange={(event) => onChange(param.id, Number(event.target.value))}
              />
              <output>
                {String(value)}
                {typeof value === "number" ? param.constraints?.unit ?? "" : ""}
              </output>
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
