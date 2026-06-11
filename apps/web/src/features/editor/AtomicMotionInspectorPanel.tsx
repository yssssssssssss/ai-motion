import type { MotionManifest, MotionPatch, MotionParam, MotionSkillTokenBinding } from "@motion-tool/core";
import { numericParamValue } from "./ParameterPanel";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
  onReset?: () => void;
  section?: "all" | "summary" | "params";
};

function paramById(manifest: MotionManifest, id: string): MotionParam | null {
  return manifest.params.find((param) => param.id === id) ?? null;
}

function paramValue(param: MotionParam | null, patch: MotionPatch): unknown {
  if (!param) return "";
  return patch.values[param.id] ?? param.default;
}

function textValue(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function editableTextField(input: {
  label: string;
  param: MotionParam | null;
  patch: MotionPatch;
  fallback: string;
  sourceText?: string;
  onChange: (paramId: string, value: unknown) => void;
}) {
  const value = textValue(paramValue(input.param, input.patch), input.fallback);
  return (
    <label className="atomic-token-field">
      <span>{input.label}</span>
      <input
        value={value}
        disabled={!input.param}
        onChange={(event) => {
          if (!input.param) return;
          input.onChange(input.param.id, event.target.value);
        }}
      />
      {input.sourceText && input.sourceText !== value ? <small>原始值：{input.sourceText}</small> : null}
    </label>
  );
}

function editableNumberField(input: {
  label: string;
  param: MotionParam | null;
  patch: MotionPatch;
  fallback: string;
  onChange: (paramId: string, value: unknown) => void;
}) {
  const numericValue = input.param
    ? numericParamValue(paramValue(input.param, input.patch))
    : numericParamValue(input.fallback);
  return (
    <label className="atomic-token-field">
      <span>{input.label}</span>
      <input
        type="number"
        value={numericValue}
        disabled={!input.param}
        step={input.param?.constraints?.step ?? 1}
        min={input.param?.constraints?.min}
        max={input.param?.constraints?.max}
        onChange={(event) => {
          if (!input.param) return;
          input.onChange(input.param.id, Number(event.target.value));
        }}
      />
      <small>原始值：{input.fallback}</small>
    </label>
  );
}

function fieldForKeyframe(input: {
  token: MotionSkillTokenBinding;
  manifest: MotionManifest;
  patch: MotionPatch;
  onChange: (paramId: string, value: unknown) => void;
}) {
  if (input.token.keyframeParamIds.length === 0) {
    return (
      <div className="atomic-token-static-field">
        <span>关键属性变化</span>
        <strong>{input.token.propertyChange}</strong>
      </div>
    );
  }

  return (
    <div className="atomic-keyframe-group">
      <span>关键属性变化</span>
      <strong>{input.token.propertyChange}</strong>
      <div className="atomic-keyframe-inputs">
        {input.token.keyframeParamIds.map((paramId: string, index: number) => {
          const param = paramById(input.manifest, paramId);
          const value = param ? numericParamValue(paramValue(param, input.patch)) : 0;
          return (
            <label className="atomic-keyframe-field" key={paramId}>
              <span>{index + 1}</span>
              <input
                type="number"
                value={value}
                disabled={!param}
                step={param?.constraints?.step ?? 0.01}
                min={param?.constraints?.min}
                max={param?.constraints?.max}
                onChange={(event) => {
                  if (!param) return;
                  input.onChange(param.id, Number(event.target.value));
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AtomicMotionSummary({ manifest }: { manifest: MotionManifest }) {
  const motionSkill = manifest?.motionSkill;
  if (!motionSkill) return null;

  return (
    <dl className="atomic-skill-summary">
      <div>
        <dt>元素</dt>
        <dd>{motionSkill.element}</dd>
      </div>
      <div>
        <dt>梯度</dt>
        <dd>{motionSkill.variant}</dd>
      </div>
      <div>
        <dt>版本</dt>
        <dd>v{motionSkill.version}</dd>
      </div>
      <div>
        <dt>应用图层</dt>
        <dd>{motionSkill.target?.label ?? "动效图层"}</dd>
      </div>
    </dl>
  );
}

function AtomicTokenFields({
  manifest,
  patch,
  onChange
}: {
  manifest: MotionManifest;
  patch: MotionPatch;
  onChange: (paramId: string, value: unknown) => void;
}) {
  const motionSkill = manifest.motionSkill;
  if (!motionSkill) return null;

  return (
    <div className="atomic-token-list">
      {(motionSkill.tokens ?? []).map((token) => {
        const durationParam = paramById(manifest, token.durationParamId);
        const delayParam = paramById(manifest, token.delayParamId);
        const easingParam = paramById(manifest, token.easingParamId);

        return (
          <article className="atomic-token-card" key={token.id}>
            <header>
              <strong>{token.animationType}</strong>
              <span>{token.property}</span>
            </header>
            <div className="atomic-token-grid">
              <div className="atomic-token-static-field">
                <span>Token</span>
                <strong>{token.token || "未命名"}</strong>
              </div>
              <div className="atomic-token-static-field">
                <span>动画类型</span>
                <strong>{token.animationType}</strong>
              </div>
              {editableNumberField({
                label: "Value",
                param: durationParam,
                patch,
                fallback: token.value,
                onChange
              })}
              {editableNumberField({
                label: "Delay",
                param: delayParam,
                patch,
                fallback: token.delay,
                onChange
              })}
              {editableTextField({
                label: "CSS Value",
                param: easingParam,
                patch,
                fallback: token.cssValue,
                sourceText: token.cssValue,
                onChange
              })}
              {fieldForKeyframe({ token, manifest, patch, onChange })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function AtomicMotionInspectorPanel({
  manifest,
  patch,
  onChange,
  onReset,
  section = "all"
}: Props) {
  if (!manifest || !patch || !manifest.motionSkill) return null;
  const showSummary = section === "all" || section === "summary";
  const showParams = section === "all" || section === "params";
  const title = section === "summary" ? "原子动效信息" : section === "params" ? "Token 参数" : "原子动效参数";

  return (
    <section className="atomic-inspector-panel" aria-label={title}>
      <div className="panel-header compact-panel-header">
        <p className="eyebrow">Designer CSV</p>
        <h2>{title}</h2>
      </div>

      {showSummary ? <AtomicMotionSummary manifest={manifest} /> : null}

      {showParams && onReset ? (
        <div className="field-toolbar">
          <button type="button" className="ghost" onClick={onReset}>
            重置默认值
          </button>
        </div>
      ) : null}

      {showParams ? <AtomicTokenFields manifest={manifest} patch={patch} onChange={onChange} /> : null}
    </section>
  );
}
