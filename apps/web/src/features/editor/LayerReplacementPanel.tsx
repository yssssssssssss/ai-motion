import type { MotionManifest, MotionParam, MotionPatch } from "@motion-tool/core";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Image file could not be read as a data URL."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image file read failed.")));
    reader.readAsDataURL(file);
  });
}

function isLayerParam(param: MotionParam): boolean {
  return param.status === "confirmed" && (param.type === "image" || param.type === "text");
}

function labelForParam(manifest: MotionManifest, param: MotionParam): string {
  const layer = manifest.layers?.find((item) => item.paramId === param.id && item.replaceable);
  return layer?.label ?? param.label;
}

export function layerReplacementParamIds(manifest: MotionManifest): string[] {
  return manifest.params.filter(isLayerParam).map((param) => param.id);
}

function currentValue(param: MotionParam, patch: MotionPatch): unknown {
  return patch.values[param.id] ?? param.default;
}

export function LayerReplacementPanel({ manifest, patch, onChange }: Props) {
  if (!manifest || !patch) return null;
  const params = manifest.params.filter(isLayerParam);
  if (params.length === 0) return null;

  return (
    <section className="layer-panel" aria-label="图层替换">
      <div className="panel-header compact-panel-header">
        <p className="eyebrow">图层替换</p>
        <h2>替换素材与文案</h2>
      </div>
      <div className="field-list">
        {params.map((param) => {
          const value = currentValue(param, patch);
          const label = labelForParam(manifest, param);

          if (param.type === "image") {
            return (
              <label className="field layer-field" key={param.id}>
                <span>{label}</span>
                <input
                  type="file"
                  accept={param.constraints?.allowedFileTypes?.join(",") || "image/*"}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];
                    input.value = "";
                    if (!file) return;
                    void readFileAsDataUrl(file).then((dataUrl) => onChange(param.id, dataUrl));
                  }}
                />
                <output>{typeof value === "string" && value.trim() ? "已替换图片" : "使用默认图层"}</output>
              </label>
            );
          }

          return (
            <label className="field layer-field" key={param.id}>
              <span>{label}</span>
              <input
                value={String(value ?? "")}
                onChange={(event) => onChange(param.id, event.target.value)}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
