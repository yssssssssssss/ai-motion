import { useState } from "react";
import type { MotionLayer, MotionManifest, MotionParam, MotionPatch } from "@motion-tool/core";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
  uploadErrorByParamId?: Record<string, string>;
};

type BackgroundLayerSizePreset = {
  id: string;
  label: string;
  stage: { width: number; height: number };
  background: { width: number; height: number };
};

const backgroundLayerSizeParamIds = [
  "stageWidth",
  "stageHeight",
  "backgroundLayerWidth",
  "backgroundLayerHeight"
] as const;

const backgroundLayerSizePresets: BackgroundLayerSizePreset[] = [
  {
    id: "iphone-modern",
    label: "新常规 iPhone",
    stage: { width: 393, height: 852 },
    background: { width: 450, height: 960 }
  },
  {
    id: "iphone-large",
    label: "大屏 iPhone",
    stage: { width: 414, height: 896 },
    background: { width: 470, height: 1000 }
  },
  {
    id: "iphone-pro-max",
    label: "Pro Max 常用",
    stage: { width: 430, height: 932 },
    background: { width: 500, height: 1060 }
  }
];

export function backgroundLayerSizePatch(preset: BackgroundLayerSizePreset): Record<string, number> {
  return {
    stageWidth: preset.stage.width,
    stageHeight: preset.stage.height,
    backgroundLayerWidth: preset.background.width,
    backgroundLayerHeight: preset.background.height
  };
}

export function readLayerFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("图片读取失败，请重新选择图片。"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("图片读取失败，请重新选择图片。")));
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

function backgroundLayerSizeParams(manifest: MotionManifest): MotionParam[] {
  const paramsById = new Map(manifest.params.map((param) => [param.id, param]));
  return backgroundLayerSizeParamIds.flatMap((id) => {
    const param = paramsById.get(id);
    return param?.status === "confirmed" ? [param] : [];
  });
}

function activeBackgroundLayerSizePreset(params: MotionParam[], patch: MotionPatch): string {
  const values = Object.fromEntries(params.map((param) => [param.id, currentValue(param, patch)]));
  const preset = backgroundLayerSizePresets.find((item) => {
    const next = backgroundLayerSizePatch(item);
    return backgroundLayerSizeParamIds.every((id) => Number(values[id]) === next[id]);
  });
  return preset?.id ?? "";
}

function BackgroundLayerSizePanel({
  params,
  patch,
  onChange
}: {
  params: MotionParam[];
  patch: MotionPatch;
  onChange: (paramId: string, value: unknown) => void;
}) {
  if (params.length !== backgroundLayerSizeParamIds.length) return null;
  const activePresetId = activeBackgroundLayerSizePreset(params, patch);

  return (
    <div className="background-layer-size-panel" aria-label="背景层尺寸">
      <div>
        <strong>背景层尺寸</strong>
        <span>选择页面画布和可漂浮背景层尺寸</span>
      </div>
      <select
        aria-label="背景层尺寸预设"
        value={activePresetId}
        onChange={(event) => {
          const preset = backgroundLayerSizePresets.find((item) => item.id === event.target.value);
          if (!preset) return;
          for (const [paramId, value] of Object.entries(backgroundLayerSizePatch(preset))) {
            onChange(paramId, value);
          }
        }}
      >
        {activePresetId ? null : <option value="">自定义尺寸</option>}
        {backgroundLayerSizePresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label} · {preset.stage.width}x{preset.stage.height} · {preset.background.width}x
            {preset.background.height}
          </option>
        ))}
      </select>
      <dl>
        {backgroundLayerSizePresets.map((preset) => (
          <div key={preset.id}>
            <dt>{preset.label}</dt>
            <dd>
              页面 {preset.stage.width}x{preset.stage.height} / 背景 {preset.background.width}x
              {preset.background.height}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LayerReplacementPanel({
  manifest,
  patch,
  onChange,
  uploadErrorByParamId
}: Props) {
  const [localUploadErrors, setLocalUploadErrors] = useState<Record<string, string>>({});
  if (!manifest || !patch) return null;
  const params = manifest.params.filter(isLayerParam);
  const trackedLayers = recipeTrackedLayers(manifest);
  const sizeParams = backgroundLayerSizeParams(manifest);
  if (params.length === 0 && trackedLayers.length === 0 && sizeParams.length === 0) return null;
  const errors = uploadErrorByParamId ?? localUploadErrors;

  function setUploadError(paramId: string, message: string | null) {
    if (uploadErrorByParamId) return;
    setLocalUploadErrors((current) => {
      if (!message) {
        const { [paramId]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [paramId]: message };
    });
  }

  return (
    <section className="layer-panel" aria-label="图层替换">
      <div className="panel-header compact-panel-header">
        <p className="eyebrow">图层替换</p>
        <h2>替换素材与图层</h2>
      </div>
      <BackgroundLayerSizePanel params={sizeParams} patch={patch} onChange={onChange} />
      {params.length > 0 ? (
        <div className="field-list">
          {params.map((param) => {
            const value = currentValue(param, patch);
            const label = labelForParam(manifest, param);
            const recipeRole = recipeRoleForParam(manifest, param);

            if (param.type === "image") {
              const uploadError = errors[param.id];

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
                      setUploadError(param.id, null);
                      void readLayerFileAsDataUrl(file)
                        .then((dataUrl) => {
                          onChange(param.id, dataUrl);
                          setUploadError(param.id, null);
                        })
                        .catch((error: unknown) => {
                          setUploadError(
                            param.id,
                            error instanceof Error && error.message
                              ? error.message
                              : "图片读取失败，请重新选择图片。"
                          );
                        });
                    }}
                  />
                  <output>{typeof value === "string" && value.trim() ? "已替换图片" : "使用默认图层"}</output>
                  {uploadError ? (
                    <small className="layer-upload-error" role="alert">
                      {uploadError}
                    </small>
                  ) : null}
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
