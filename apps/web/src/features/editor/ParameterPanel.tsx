import type { MotionManifest, MotionParam, MotionParamGroup, MotionPatch } from "@motion-tool/core";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
  onReset?: () => void;
};

export function numericParamValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
    if (match?.[0]) return Number(match[0]);
  }

  return 0;
}

export type ParamControlKind = "color" | "image" | "range" | "text" | "select" | "toggle" | "unsupported";

export function paramControlKind(param: Pick<MotionParam, "type" | "constraints">): ParamControlKind {
  if (param.type === "color") return "color";
  if (param.type === "image") return "image";
  if (
    param.type === "text" ||
    param.type === "easing" ||
    param.type === "position" ||
    param.type === "transform"
  )
    return "text";
  if (param.type === "toggle") return "toggle";
  if (param.type === "select") {
    return param.constraints?.options?.length ? "select" : "unsupported";
  }
  if (param.type === "duration" || param.type === "range" || param.type === "number") {
    const { min, max, step } = param.constraints ?? {};
    return typeof min === "number" && typeof max === "number" && typeof step === "number"
      ? "range"
      : "unsupported";
  }
  return "unsupported";
}

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

function hasCustomImage(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

type GroupedSection = { id: string; label: string | null; params: MotionParam[] };

const recipeGroupLabels: Record<string, string> = {
  duration: "时间",
  delay: "时间",
  easing: "时间",
  distance: "轨迹",
  direction: "轨迹",
  opacity: "透明度",
  scale: "缩放",
  rotate: "变换",
  transformOrigin: "变换",
  loop: "循环"
};

function recipeParamGroup(param: MotionParam): string | null {
  if (!param.ui?.group) return null;
  return recipeGroupLabels[param.ui.group] ?? param.ui.group;
}

// 把参数按 manifest.groups 或 param.ui.group 分块；没有任何分组信息时返回单段
export function groupParameters(manifest: MotionManifest): GroupedSection[] {
  const confirmed = manifest.params.filter(
    (p) => p.status === "confirmed" && p.type !== "image" && p.type !== "text"
  );
  if (confirmed.length === 0) return [];

  const byId = new Map(confirmed.map((p) => [p.id, p]));
  const recipeParamIds = new Set(manifest.motionRecipes?.flatMap((recipe) => recipe.paramIds) ?? []);
  const recipeParams = confirmed.filter((param) => recipeParamIds.has(param.id));

  if (recipeParams.length > 0) {
    const sections: GroupedSection[] = [];
    const used = new Set<string>();
    const byRecipeGroup = new Map<string, MotionParam[]>();

    for (const param of recipeParams) {
      const key = recipeParamGroup(param) ?? "动效";
      const list = byRecipeGroup.get(key) ?? [];
      list.push(param);
      byRecipeGroup.set(key, list);
      used.add(param.id);
    }

    for (const [label, params] of byRecipeGroup) {
      sections.push({ id: `recipe-${label}`, label, params });
    }

    const leftovers = confirmed.filter((param) => !used.has(param.id));
    if (leftovers.length > 0 && manifest.groups && manifest.groups.length > 0) {
      for (const group of manifest.groups as MotionParamGroup[]) {
        const params = group.params.flatMap((id) => {
          const param = byId.get(id);
          return param && !used.has(param.id) ? [param] : [];
        });
        if (params.length > 0) sections.push({ id: group.id, label: group.label, params });
      }
    } else if (leftovers.length > 0) {
      sections.push({ id: "__rest__", label: "外观", params: leftovers });
    }

    return sections;
  }

  // 优先用 manifest.groups 显式分组
  if (manifest.groups && manifest.groups.length > 0) {
    const sections: GroupedSection[] = [];
    const used = new Set<string>();
    for (const group of manifest.groups as MotionParamGroup[]) {
      const params: MotionParam[] = [];
      for (const id of group.params) {
        const param = byId.get(id);
        if (param) {
          params.push(param);
          used.add(id);
        }
      }
      if (params.length > 0) sections.push({ id: group.id, label: group.label, params });
    }
    const leftovers = confirmed.filter((p) => !used.has(p.id));
    if (leftovers.length > 0) sections.push({ id: "__rest__", label: "其他", params: leftovers });
    return sections;
  }

  // 退而求其次：用 param.ui.group 隐式分组
  const byGroup = new Map<string, MotionParam[]>();
  let hasUiGroup = false;
  for (const param of confirmed) {
    const group = param.ui?.group;
    if (group) hasUiGroup = true;
    const key = group ?? "__default__";
    const list = byGroup.get(key) ?? [];
    list.push(param);
    byGroup.set(key, list);
  }

  if (!hasUiGroup) {
    return [{ id: "__default__", label: null, params: confirmed }];
  }

  return Array.from(byGroup.entries()).map(([key, params]) => ({
    id: key,
    label: key === "__default__" ? "通用" : key,
    params
  }));
}

export function ParamControl({
  param,
  value,
  onChange
}: {
  param: MotionParam;
  value: unknown;
  onChange: (paramId: string, value: unknown) => void;
}) {
  const numericValue = numericParamValue(value);
  const control = paramControlKind(param);

  if (control === "color") {
    return (
      <label className="field">
        <span>{param.label}</span>
        <input
          type="color"
          value={String(value)}
          onChange={(event) => onChange(param.id, event.target.value)}
        />
      </label>
    );
  }

  if (control === "image") {
    const accept = param.constraints?.allowedFileTypes?.join(",") || "image/*";

    return (
      <label className="field">
        <span>{param.label}</span>
        <input
          type="file"
          accept={accept}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            void readFileAsDataUrl(file).then((dataUrl) => onChange(param.id, dataUrl));
          }}
        />
        <output>{hasCustomImage(value) ? "已替换图片" : "使用默认图层"}</output>
      </label>
    );
  }

  if (control === "range") {
    return (
      <label className="field">
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
      <label className="field">
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
      <label className="field">
        <span>{param.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(param.id, event.target.checked)}
        />
      </label>
    );
  }

  if (control === "unsupported") {
    return (
      <label className="field">
        <span>{param.label}</span>
        <input value={String(value)} disabled />
      </label>
    );
  }

  return (
    <label className="field">
      <span>{param.label}</span>
      <input value={String(value)} onChange={(event) => onChange(param.id, event.target.value)} />
    </label>
  );
}

export function ParameterPanel({ manifest, patch, onChange, onReset }: Props) {
  if (!manifest || !patch) return <p className="muted">尚未选择动效源。</p>;

  const sections = groupParameters(manifest);
  if (sections.length === 0) return <p className="muted">暂无可确认参数。</p>;

  return (
    <div className="field-groups">
      {onReset ? (
        <div className="field-toolbar">
          <button type="button" className="ghost" onClick={onReset}>
            重置默认值
          </button>
        </div>
      ) : null}
      {sections.map((section) => (
        <section className="field-group" key={section.id} aria-label={section.label ?? "参数"}>
          {section.label ? <h3 className="field-group__label">{section.label}</h3> : null}
          <div className="field-list">
            {section.params.map((param) => (
              <ParamControl
                key={param.id}
                param={param}
                value={patch.values[param.id] ?? param.default}
                onChange={onChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
