import type { MotionLayer, MotionManifest, MotionParam, MotionPatch } from "@motion-tool/core";

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

function recipeRoleForParam(manifest: MotionManifest, param: MotionParam): string | null {
  const layer = manifest.layers?.find((item) => item.paramId === param.id && item.replaceable);
  if (!layer) return null;
  return recipeRoleForLayer(manifest, layer);
}

export function layerReplacementParamIds(manifest: MotionManifest): string[] {
  return manifest.params.filter(isLayerParam).map((param) => param.id);
}

const recipeRoleLabels: Record<string, string> = {
  foreground: "前景图层",
  background: "背景图层",
  image: "图片图层",
  text: "文案图层",
  button: "按钮图层",
  card: "卡片图层",
  screen: "页面层",
  badge: "标签图层",
  loader: "加载图层",
  modal: "弹窗图层",
  unknown: "未知图层"
};

function recipeRoleForLayer(manifest: MotionManifest, layer: MotionLayer): string | null {
  const recipes = manifest.motionRecipes?.filter((item) => item.targetLayerIds.includes(layer.id)) ?? [];
  const roles = recipes.flatMap((recipe) => recipe.targetRoles ?? []);
  if (roles.length > 0) return [...new Set(roles)].map((role) => recipeRoleLabels[role] ?? role).join(" / ");
  return recipes[0]?.recipeName ?? null;
}

function recipeTrackedLayers(manifest: MotionManifest): MotionLayer[] {
  const recipeLayerIds = new Set(manifest.motionRecipes?.flatMap((recipe) => recipe.targetLayerIds) ?? []);
  return (manifest.layers ?? []).filter(
    (layer) => layer.replaceable && recipeLayerIds.has(layer.id) && !layer.paramId
  );
}

function currentValue(param: MotionParam, patch: MotionPatch): unknown {
  return patch.values[param.id] ?? param.default;
}

export function LayerReplacementPanel({ manifest, patch, onChange }: Props) {
  if (!manifest || !patch) return null;
  const params = manifest.params.filter(isLayerParam);
  const trackedLayers = recipeTrackedLayers(manifest);
  if (params.length === 0 && trackedLayers.length === 0) return null;

  return (
    <section className="layer-panel" aria-label="图层替换">
      <div className="panel-header compact-panel-header">
        <p className="eyebrow">图层替换</p>
        <h2>替换素材与图层</h2>
      </div>
      {params.length > 0 ? (
        <div className="field-list">
          {params.map((param) => {
            const value = currentValue(param, patch);
            const label = labelForParam(manifest, param);
            const recipeRole = recipeRoleForParam(manifest, param);

            if (param.type === "image") {
              return (
                <label className="field layer-field" key={param.id}>
                  <span>
                    {label}
                    {recipeRole ? <small>动效目标：{recipeRole}</small> : null}
                  </span>
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
                <span>
                  {label}
                  {recipeRole ? <small>动效目标：{recipeRole}</small> : null}
                </span>
                <input
                  value={String(value ?? "")}
                  onChange={(event) => onChange(param.id, event.target.value)}
                />
              </label>
            );
          })}
        </div>
      ) : null}
      {trackedLayers.length > 0 ? (
        <div className="recipe-layer-list">
          {trackedLayers.map((layer) => (
            <article className="recipe-layer-item" key={layer.id}>
              <strong>{layer.label}</strong>
              <span>{recipeRoleForLayer(manifest, layer) ?? "动效图层"}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
