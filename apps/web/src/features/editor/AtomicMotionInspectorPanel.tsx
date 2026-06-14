import { useRef, useState } from "react";
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

type EasingControl = "p1" | "p2";

type CubicBezierValue = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatBezierNumber(value: number): string {
  return String(Number(clampUnit(value).toFixed(3)));
}

function easingToCss(value: CubicBezierValue): string {
  return `cubic-bezier(${formatBezierNumber(value.x1)}, ${formatBezierNumber(value.y1)}, ${formatBezierNumber(value.x2)}, ${formatBezierNumber(value.y2)})`;
}

function parseCubicBezier(value: string): CubicBezierValue | null {
  const match = value.match(
    /(?:cubic-bezier\s*)?\(?\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)?/i
  );
  if (!match) return null;
  const [, x1Raw, y1Raw, x2Raw, y2Raw] = match;
  const values = [x1Raw, y1Raw, x2Raw, y2Raw].map(Number);
  if (values.some((item) => !Number.isFinite(item))) return null;
  return {
    x1: clampUnit(values[0] ?? 0),
    y1: clampUnit(values[1] ?? 0),
    x2: clampUnit(values[2] ?? 1),
    y2: clampUnit(values[3] ?? 1)
  };
}

function easingValue(value: unknown, fallback: string): CubicBezierValue {
  const parsed = parseCubicBezier(textValue(value, fallback)) ?? parseCubicBezier(fallback);
  return parsed ?? { x1: 0.38, y1: 0, x2: 0.24, y2: 1 };
}

export function easingPointFromClientPosition(input: {
  clientX: number;
  clientY: number;
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">;
  width: number;
  height: number;
  padding: number;
}): { x: number; y: number } | null {
  const { clientX, clientY, rect, width, height, padding } = input;
  if (rect.width <= 0 || rect.height <= 0) return null;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const scale = Math.min(rect.width / width, rect.height / height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const svgX = (clientX - rect.left - offsetX) / scale;
  const svgY = (clientY - rect.top - offsetY) / scale;
  return {
    x: clampUnit((svgX - padding) / plotWidth),
    y: clampUnit(1 - (svgY - padding) / plotHeight)
  };
}

function EasingCurveField(input: {
  label: string;
  param: MotionParam | null;
  patch: MotionPatch;
  fallback: string;
  sourceText?: string;
  onChange: (paramId: string, value: unknown) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeControl, setActiveControl] = useState<EasingControl | null>(null);
  const rawValue = textValue(paramValue(input.param, input.patch), input.fallback);
  const bezier = easingValue(rawValue, input.fallback);
  const cssValue = easingToCss(bezier);
  const width = 180;
  const height = 104;
  const padding = 16;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const point = (x: number, y: number) => ({
    x: padding + clampUnit(x) * plotWidth,
    y: padding + (1 - clampUnit(y)) * plotHeight
  });
  const start = point(0, 0);
  const p1 = point(bezier.x1, bezier.y1);
  const p2 = point(bezier.x2, bezier.y2);
  const end = point(1, 1);

  function commit(next: CubicBezierValue) {
    if (!input.param) return;
    input.onChange(input.param.id, easingToCss(next));
  }

  function updateControl(control: EasingControl, clientX: number, clientY: number) {
    if (!svgRef.current || !input.param) return;
    const rect = svgRef.current.getBoundingClientRect();
    const nextPoint = easingPointFromClientPosition({ clientX, clientY, rect, width, height, padding });
    if (!nextPoint) return;
    commit(
      control === "p1"
        ? { ...bezier, x1: nextPoint.x, y1: nextPoint.y }
        : { ...bezier, x2: nextPoint.x, y2: nextPoint.y }
    );
  }

  function numericInput(control: EasingControl, axis: "x" | "y", value: number) {
    if (control === "p1") {
      commit(axis === "x" ? { ...bezier, x1: value } : { ...bezier, y1: value });
      return;
    }
    commit(axis === "x" ? { ...bezier, x2: value } : { ...bezier, y2: value });
  }

  const valueControls = [
    { label: "x1", value: bezier.x1, onChange: (value: number) => numericInput("p1", "x", value) },
    { label: "y1", value: bezier.y1, onChange: (value: number) => numericInput("p1", "y", value) },
    { label: "x2", value: bezier.x2, onChange: (value: number) => numericInput("p2", "x", value) },
    { label: "y2", value: bezier.y2, onChange: (value: number) => numericInput("p2", "y", value) }
  ];

  return (
    <div className="atomic-easing-field">
      <span>{input.label}</span>
      <div className="atomic-easing-editor">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${input.label}曲线编辑器`}
          onPointerMove={(event) => {
            if (!activeControl) return;
            updateControl(activeControl, event.clientX, event.clientY);
          }}
          onPointerUp={() => setActiveControl(null)}
          onPointerLeave={() => setActiveControl(null)}
        >
          <line className="atomic-easing-axis" x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
          <line className="atomic-easing-handle-line" x1={start.x} y1={start.y} x2={p1.x} y2={p1.y} />
          <line className="atomic-easing-handle-line" x1={end.x} y1={end.y} x2={p2.x} y2={p2.y} />
          <path
            className="atomic-easing-curve"
            d={`M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`}
          />
          {[
            { control: "p1" as const, point: p1 },
            { control: "p2" as const, point: p2 }
          ].map((item) => (
            <circle
              className="atomic-easing-point"
              key={item.control}
              cx={item.point.x}
              cy={item.point.y}
              r="6"
              tabIndex={0}
              role="slider"
              aria-label={item.control === "p1" ? "控制点 1" : "控制点 2"}
              aria-valuetext={
                item.control === "p1" ? `${bezier.x1}, ${bezier.y1}` : `${bezier.x2}, ${bezier.y2}`
              }
              onPointerDown={(event) => {
                setActiveControl(item.control);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            />
          ))}
        </svg>
        <div className="atomic-easing-values">
          {valueControls.map((item) => (
            <label key={item.label}>
              <span>{item.label}</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={item.value}
                disabled={!input.param}
                onChange={(event) => item.onChange(Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      </div>
      <input
        className="atomic-easing-css-input"
        value={input.param ? rawValue : cssValue}
        disabled={!input.param}
        onChange={(event) => {
          if (!input.param) return;
          input.onChange(input.param.id, event.target.value);
        }}
      />
      {input.sourceText && input.sourceText !== rawValue ? <small>原始值：{input.sourceText}</small> : null}
    </div>
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
  const constraints = input.param?.constraints;
  const hasRange = constraints && typeof constraints.min === "number" && typeof constraints.max === "number";

  if (hasRange) {
    return (
      <label className="atomic-token-slider-field">
        <span>{input.label}</span>
        <div className="atomic-slider-row">
          <input
            type="range"
            min={constraints.min}
            max={constraints.max}
            step={constraints.step ?? 1}
            value={numericValue}
            disabled={!input.param}
            onChange={(event) => {
              if (!input.param) return;
              input.onChange(input.param.id, Number(event.target.value));
            }}
          />
          <input
            type="number"
            min={constraints.min}
            max={constraints.max}
            step={constraints.step ?? 1}
            value={numericValue}
            disabled={!input.param}
            onChange={(event) => {
              if (!input.param) return;
              input.onChange(input.param.id, Number(event.target.value));
            }}
          />
        </div>
        <small>原始值：{input.fallback}</small>
      </label>
    );
  }

  return (
    <label className="atomic-token-field">
      <span>{input.label}</span>
      <input
        type="number"
        value={numericValue}
        disabled={!input.param}
        step={constraints?.step ?? 1}
        min={constraints?.min}
        max={constraints?.max}
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
          if (param?.type === "color") {
            const value = String(paramValue(param, input.patch) ?? param.default);
            return (
              <label className="atomic-keyframe-field" key={paramId}>
                <span>{index + 1}</span>
                <input
                  type="color"
                  value={value}
                  onChange={(event) => input.onChange(param.id, event.target.value)}
                />
              </label>
            );
          }
          const value = param ? numericParamValue(paramValue(param, input.patch)) : 0;
          const kfConstraints = param?.constraints;
          const kfHasRange =
            kfConstraints && typeof kfConstraints.min === "number" && typeof kfConstraints.max === "number";

          if (kfHasRange) {
            return (
              <label className="atomic-keyframe-field" key={paramId}>
                <span>{index + 1}</span>
                <div className="atomic-keyframe-slider">
                  <input
                    type="range"
                    min={kfConstraints.min}
                    max={kfConstraints.max}
                    step={kfConstraints.step ?? 0.01}
                    value={value}
                    disabled={!param}
                    onChange={(event) => {
                      if (!param) return;
                      input.onChange(param.id, Number(event.target.value));
                    }}
                  />
                  <input
                    type="number"
                    min={kfConstraints.min}
                    max={kfConstraints.max}
                    step={kfConstraints.step ?? 0.01}
                    value={value}
                    disabled={!param}
                    onChange={(event) => {
                      if (!param) return;
                      input.onChange(param.id, Number(event.target.value));
                    }}
                  />
                </div>
              </label>
            );
          }

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

function durationLabel(token: MotionSkillTokenBinding): string {
  const isHorizontalMovement =
    token.id.startsWith("horizontal-switch.") && (token.property === "position" || token.property === "size");
  return isHorizontalMovement ? "单次移动时长" : "时长";
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
                label: durationLabel(token),
                param: durationParam,
                patch,
                fallback: token.value,
                onChange
              })}
              {editableNumberField({
                label: "延迟",
                param: delayParam,
                patch,
                fallback: token.delay,
                onChange
              })}
              <EasingCurveField
                label="缓动曲线"
                param={easingParam}
                patch={patch}
                fallback={token.cssValue}
                sourceText={token.cssValue}
                onChange={onChange}
              />
              {fieldForKeyframe({ token, manifest, patch, onChange })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function AtomicMotionInspectorPanel({ manifest, patch, onChange, onReset, section = "all" }: Props) {
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
