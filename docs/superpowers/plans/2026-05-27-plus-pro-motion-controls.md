# Plus / Pro Motion Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default Plus editor mode that exposes simple motion controls while preserving the existing full Pro parameter editor.

**Architecture:** Keep `MotionParam` and `MotionPatch` as the source of truth. Add a pure core compiler that derives safe Plus controls from a manifest and compiles Plus selections into `MotionPatch.values`; then add a small web panel that calls the compiler and reuses the existing preview/export patch pipeline.

**Tech Stack:** TypeScript, React, Vitest, existing `@motion-tool/core` manifest and patch APIs.

---

## File Structure

- Create `packages/core/src/orchestrator/plusControls.ts`
  - Owns Plus control types, manifest capability detection, constraints clamping, and Plus-to-patch compilation.
- Modify `packages/core/src/index.ts`
  - Exports public Plus control types and functions.
- Create `packages/core/test/plusControls.test.ts`
  - Covers speed/easing/intensity detection, clamp behavior, and “do not expose unmapped controls”.
- Create `apps/web/src/features/editor/ParameterModeTabs.tsx`
  - Small segmented control for `Plus` / `Pro`.
- Create `apps/web/src/features/editor/PlusControlPanel.tsx`
  - Renders option buttons and sliders for derived Plus controls.
- Create `apps/web/src/features/editor/PlusControlPanel.test.tsx`
  - Static rendering tests for Plus controls and empty state.
- Modify `apps/web/src/routes/EditorRoute.tsx`
  - Adds mode state, displays Plus panel by default when controls exist, falls back to Pro for unsupported components.
- Modify `apps/web/src/styles/editor.css`
  - Adds compact styles for tabs, option chips, sliders, and affected-parameter text.

## Task 1: Core Plus Control Tests

**Files:**
- Create: `packages/core/test/plusControls.test.ts`

- [ ] **Step 1: Write failing tests for Plus control derivation and compilation**

Create `packages/core/test/plusControls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MotionManifest } from "../src/manifest/types";
import { compilePlusPatch, derivePlusControls } from "../src/orchestrator/plusControls";

const manifest: MotionManifest = {
  version: "1.0",
  id: "sample-motion",
  name: "Sample Motion",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "transitionDuration",
      label: "转场速度",
      type: "duration",
      default: 620,
      constraints: { min: 220, max: 1400, step: 20, unit: "ms" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
    },
    {
      id: "easing",
      label: "缓动曲线",
      type: "easing",
      default: "ease-out",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-easing" }]
    },
    {
      id: "dimOpacity",
      label: "压暗强度",
      type: "range",
      default: 0.72,
      constraints: { min: 0, max: 0.9, step: 0.01 },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--dim-opacity" }]
    },
    {
      id: "popupWidth",
      label: "弹层宽度",
      type: "range",
      default: 874,
      constraints: { min: 640, max: 980, step: 1, unit: "px" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--popup-width" }]
    }
  ],
  groups: [{ id: "timing", label: "速度", params: ["transitionDuration", "easing"] }]
};

describe("derivePlusControls", () => {
  it("derives only high-confidence controls from confirmed params", () => {
    const controls = derivePlusControls(manifest);

    expect(controls.map((control) => control.id)).toEqual(["speed", "easing", "intensity"]);
    expect(controls.find((control) => control.id === "speed")?.mappedParamIds).toEqual(["transitionDuration"]);
    expect(controls.find((control) => control.id === "easing")?.mappedParamIds).toEqual(["easing"]);
    expect(controls.find((control) => control.id === "intensity")?.mappedParamIds).toEqual(["dimOpacity"]);
  });

  it("does not expose controls for read-only or unrelated manifests", () => {
    const controls = derivePlusControls({ ...manifest, params: [] });
    expect(controls).toEqual([]);
  });
});

describe("compilePlusPatch", () => {
  it("compiles plus selections into bounded MotionPatch values", () => {
    const result = compilePlusPatch({
      manifest,
      plusValues: {
        speed: { option: "fast", amount: 100 },
        easing: { option: "soft", amount: 50 },
        intensity: { option: "expressive", amount: 100 }
      },
      baseValues: { popupWidth: 900 }
    });

    expect(result.values.transitionDuration).toBeGreaterThanOrEqual(220);
    expect(result.values.transitionDuration).toBeLessThan(620);
    expect(result.values.easing).toBe("ease-in-out");
    expect(result.values.dimOpacity).toBe(0.9);
    expect(result.values.popupWidth).toBe(900);
    expect(result.affectedParamIds).toEqual(["transitionDuration", "easing", "dimOpacity"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
./apps/web/node_modules/.bin/vitest run packages/core/test/plusControls.test.ts
```

Expected: FAIL because `../src/orchestrator/plusControls` does not exist.

## Task 2: Core Plus Compiler

**Files:**
- Create: `packages/core/src/orchestrator/plusControls.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/plusControls.test.ts`

- [ ] **Step 1: Implement Plus control types and derivation**

Create `packages/core/src/orchestrator/plusControls.ts`:

```ts
import type { MotionManifest, MotionParam, MotionPatch } from "../manifest/types";

export type PlusControlKind = "speed" | "easing" | "intensity" | "trajectory" | "rhythm";

export type PlusControlOption = {
  id: string;
  label: string;
  value: string;
};

export type PlusControl = {
  id: PlusControlKind;
  label: string;
  options: PlusControlOption[];
  defaultOption: string;
  sliderLabel: string;
  defaultAmount: number;
  confidence: number;
  mappedParamIds: string[];
};

export type PlusControlValue = {
  option: string;
  amount: number;
};

export type PlusPatchValues = Partial<Record<PlusControlKind, PlusControlValue>>;

export type CompilePlusPatchInput = {
  manifest: MotionManifest;
  plusValues: PlusPatchValues;
  baseValues?: MotionPatch["values"];
};

export type CompilePlusPatchResult = {
  values: MotionPatch["values"];
  affectedParamIds: string[];
};

const SPEED_OPTIONS: PlusControlOption[] = [
  { id: "slow", label: "慢", value: "slow" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "fast", label: "快", value: "fast" }
];

const EASING_OPTIONS: PlusControlOption[] = [
  { id: "soft", label: "柔和", value: "soft" },
  { id: "crisp", label: "利落", value: "crisp" },
  { id: "elastic", label: "弹性", value: "elastic" },
  { id: "ease-out", label: "快入慢出", value: "ease-out" },
  { id: "ease-in", label: "慢入快出", value: "ease-in" }
];

const INTENSITY_OPTIONS: PlusControlOption[] = [
  { id: "subtle", label: "克制", value: "subtle" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "expressive", label: "强表现", value: "expressive" }
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function confirmedParams(manifest: MotionManifest): MotionParam[] {
  return manifest.params.filter((param) => param.status === "confirmed");
}

function paramText(param: MotionParam): string {
  return normalize(`${param.id} ${param.label} ${param.type}`);
}

function isSpeedParam(param: MotionParam): boolean {
  const text = paramText(param);
  return (
    param.type === "duration" &&
    /(duration|transitionduration|cycleduration|animationduration|时长|速度)/.test(text) &&
    !/(delay|startdelay|loopdelay|repeatdelay|停顿|延迟)/.test(text)
  );
}

function isEasingParam(param: MotionParam): boolean {
  const text = paramText(param);
  if (param.type === "easing") return true;
  if (param.type !== "select") return false;
  return Boolean(param.constraints?.options?.some((option) => /ease|spring|bezier/.test(normalize(String(option.value)))));
}

function isIntensityParam(param: MotionParam): boolean {
  const text = paramText(param);
  if (!["range", "number"].includes(param.type)) return false;
  if (/(width|height|x$|y$|popup|endwidth|endheight|宽度|高度)/.test(text)) return false;
  return /(scale|opacity|dimopacity|blur|glow|distance|slidedistance|强度|透明度|缩放)/.test(text);
}

function buildControl(
  id: PlusControlKind,
  label: string,
  options: PlusControlOption[],
  sliderLabel: string,
  mappedParamIds: string[],
  confidence: number
): PlusControl | null {
  if (mappedParamIds.length === 0) return null;
  return {
    id,
    label,
    options,
    defaultOption: "normal",
    sliderLabel,
    defaultAmount: 50,
    confidence,
    mappedParamIds
  };
}

export function derivePlusControls(manifest: MotionManifest): PlusControl[] {
  const params = confirmedParams(manifest);
  const controls = [
    buildControl("speed", "速度", SPEED_OPTIONS, "速度感", params.filter(isSpeedParam).map((param) => param.id), 0.85),
    buildControl("easing", "进出效果", EASING_OPTIONS, "曲线强度", params.filter(isEasingParam).map((param) => param.id), 0.85),
    buildControl(
      "intensity",
      "动效强度",
      INTENSITY_OPTIONS,
      "表现强度",
      params.filter(isIntensityParam).map((param) => param.id),
      0.75
    )
  ];

  return controls.filter((control): control is PlusControl => Boolean(control));
}

function clamp(value: number, param: MotionParam): number {
  const min = param.constraints?.min ?? Number.NEGATIVE_INFINITY;
  const max = param.constraints?.max ?? Number.POSITIVE_INFINITY;
  const step = param.constraints?.step;
  const bounded = Math.min(max, Math.max(min, value));
  if (!step) return Math.round(bounded * 1000) / 1000;
  const rounded = Math.round(bounded / step) * step;
  return Math.round(Math.min(max, Math.max(min, rounded)) * 1000) / 1000;
}

function currentNumber(param: MotionParam, baseValues: MotionPatch["values"]): number {
  const value = baseValues[param.id] ?? param.default;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
    if (match?.[0]) return Number(match[0]);
  }
  return 0;
}

function speedFactor(value: PlusControlValue): number {
  const optionFactor = value.option === "fast" ? 0.78 : value.option === "slow" ? 1.22 : 1;
  const fineTune = 1 - ((value.amount - 50) / 50) * 0.18;
  return optionFactor * fineTune;
}

function intensityFactor(value: PlusControlValue): number {
  const optionFactor = value.option === "expressive" ? 1.25 : value.option === "subtle" ? 0.72 : 1;
  const fineTune = 1 + ((value.amount - 50) / 50) * 0.2;
  return optionFactor * fineTune;
}

function easingValue(value: PlusControlValue): string {
  if (value.option === "crisp") return "ease-out";
  if (value.option === "elastic") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
  if (value.option === "ease-in") return "ease-in";
  if (value.option === "ease-out") return "ease-out";
  return "ease-in-out";
}

export function compilePlusPatch(input: CompilePlusPatchInput): CompilePlusPatchResult {
  const paramsById = new Map(input.manifest.params.map((param) => [param.id, param]));
  const controls = derivePlusControls(input.manifest);
  const values: MotionPatch["values"] = { ...(input.baseValues ?? {}) };
  const affectedParamIds: string[] = [];

  for (const control of controls) {
    const plusValue = input.plusValues[control.id];
    if (!plusValue) continue;

    for (const paramId of control.mappedParamIds) {
      const param = paramsById.get(paramId);
      if (!param) continue;

      if (control.id === "speed") {
        values[param.id] = clamp(currentNumber(param, values) * speedFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }

      if (control.id === "easing") {
        values[param.id] = easingValue(plusValue);
        affectedParamIds.push(param.id);
      }

      if (control.id === "intensity") {
        values[param.id] = clamp(currentNumber(param, values) * intensityFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }
    }
  }

  return { values, affectedParamIds: [...new Set(affectedParamIds)] };
}
```

- [ ] **Step 2: Export the public API**

Modify `packages/core/src/index.ts` under the orchestrator section:

```ts
export type {
  CompilePlusPatchInput,
  CompilePlusPatchResult,
  PlusControl,
  PlusControlKind,
  PlusControlOption,
  PlusControlValue,
  PlusPatchValues
} from "./orchestrator/plusControls";
export { compilePlusPatch, derivePlusControls } from "./orchestrator/plusControls";
```

- [ ] **Step 3: Run core Plus tests**

Run:

```bash
./apps/web/node_modules/.bin/vitest run packages/core/test/plusControls.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run existing core editor-related tests**

Run:

```bash
./apps/web/node_modules/.bin/vitest run packages/core/test/plusControls.test.ts packages/core/test/applyPatch.test.ts packages/core/test/manifest.schema.test.ts
```

Expected: PASS.

## Task 3: Plus Panel UI Tests

**Files:**
- Create: `apps/web/src/features/editor/PlusControlPanel.test.tsx`

- [ ] **Step 1: Write failing static rendering tests**

Create `apps/web/src/features/editor/PlusControlPanel.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlusControl } from "@motion-tool/core";
import { PlusControlPanel } from "./PlusControlPanel";

const controls: PlusControl[] = [
  {
    id: "speed",
    label: "速度",
    options: [
      { id: "slow", label: "慢", value: "slow" },
      { id: "normal", label: "标准", value: "normal" },
      { id: "fast", label: "快", value: "fast" }
    ],
    defaultOption: "normal",
    sliderLabel: "速度感",
    defaultAmount: 50,
    confidence: 0.85,
    mappedParamIds: ["transitionDuration"]
  }
];

describe("PlusControlPanel", () => {
  it("renders option and slider controls for plus mode", () => {
    const html = renderToStaticMarkup(
      <PlusControlPanel controls={controls} values={{}} affectedParamIds={["transitionDuration"]} onChange={vi.fn()} />
    );

    expect(html).toContain("速度");
    expect(html).toContain("标准");
    expect(html).toContain("速度感");
    expect(html).toContain("已影响");
    expect(html).toContain("transitionDuration");
  });

  it("renders an empty state when no simplified controls are available", () => {
    const html = renderToStaticMarkup(
      <PlusControlPanel controls={[]} values={{}} affectedParamIds={[]} onChange={vi.fn()} />
    );

    expect(html).toContain("该组件暂无简化控制");
  });
});
```

- [ ] **Step 2: Run the UI test to verify RED**

Run:

```bash
pnpm --filter @motion-tool/web test -- PlusControlPanel.test.tsx
```

Expected: FAIL because `PlusControlPanel` does not exist.

## Task 4: Plus Panel UI Implementation

**Files:**
- Create: `apps/web/src/features/editor/PlusControlPanel.tsx`
- Create: `apps/web/src/features/editor/ParameterModeTabs.tsx`
- Modify: `apps/web/src/styles/editor.css`
- Test: `apps/web/src/features/editor/PlusControlPanel.test.tsx`

- [ ] **Step 1: Implement `PlusControlPanel`**

Create `apps/web/src/features/editor/PlusControlPanel.tsx`:

```tsx
import type { PlusControl, PlusControlKind, PlusControlValue, PlusPatchValues } from "@motion-tool/core";

type Props = {
  controls: PlusControl[];
  values: PlusPatchValues;
  affectedParamIds: string[];
  onChange: (controlId: PlusControlKind, value: PlusControlValue) => void;
};

function currentValue(control: PlusControl, values: PlusPatchValues): PlusControlValue {
  return values[control.id] ?? { option: control.defaultOption, amount: control.defaultAmount };
}

export function PlusControlPanel({ controls, values, affectedParamIds, onChange }: Props) {
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
```

- [ ] **Step 2: Implement `ParameterModeTabs`**

Create `apps/web/src/features/editor/ParameterModeTabs.tsx`:

```tsx
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
```

- [ ] **Step 3: Add editor styles**

Append to `apps/web/src/styles/editor.css`:

```css
.parameter-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
}

.parameter-mode-tabs button,
.plus-options button {
  border: 0;
  border-radius: 6px;
  padding: 8px 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.parameter-mode-tabs button.is-active,
.plus-options button.is-active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.12);
}

.plus-panel,
.plus-empty {
  display: grid;
  gap: 14px;
}

.plus-control {
  display: grid;
  gap: 10px;
  padding-block: 12px;
  border-bottom: 1px solid var(--border);
}

.plus-control__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plus-control__header h3 {
  margin: 0;
  font-size: 0.95rem;
}

.plus-control__header span {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.plus-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.plus-slider {
  display: grid;
  grid-template-columns: 64px 1fr 36px;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.plus-slider input {
  width: 100%;
}

.plus-slider output {
  text-align: right;
  color: var(--text);
}

.plus-affected {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
}
```

- [ ] **Step 4: Run UI tests**

Run:

```bash
pnpm --filter @motion-tool/web test -- PlusControlPanel.test.tsx
```

Expected: PASS.

## Task 5: Wire Plus Mode Into EditorRoute

**Files:**
- Modify: `apps/web/src/routes/EditorRoute.tsx`
- Test: `apps/web/src/features/editor/PlusControlPanel.test.tsx`, `apps/web/src/features/editor/ParameterPanel.test.ts`

- [ ] **Step 1: Update EditorRoute imports**

Modify the imports at the top of `apps/web/src/routes/EditorRoute.tsx`:

```tsx
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { compilePlusPatch, derivePlusControls, type PlusControlKind, type PlusControlValue, type PlusPatchValues } from "@motion-tool/core";
import { ParameterPanel } from "../features/editor/ParameterPanel";
import { ParameterModeTabs, type ParameterMode } from "../features/editor/ParameterModeTabs";
import { PlusControlPanel } from "../features/editor/PlusControlPanel";
import { PreviewFrame, type PreviewPlaybackState } from "../features/editor/PreviewFrame";
import { ExportPanel } from "../features/export/ExportPanel";
import type { MotionProject } from "../state/projectStore";
```

- [ ] **Step 2: Add local Plus state and derived controls**

Inside `EditorRoute`, after `playbackState`:

```tsx
const [parameterMode, setParameterMode] = useState<ParameterMode>("plus");
const [plusValues, setPlusValues] = useState<PlusPatchValues>({});
const plusControls = useMemo(
  () => (project ? derivePlusControls(project.manifest) : []),
  [project?.manifest]
);
const plusPatchResult = useMemo(
  () =>
    project
      ? compilePlusPatch({
          manifest: project.manifest,
          plusValues,
          baseValues: project.patch.values
        })
      : { values: {}, affectedParamIds: [] },
  [plusValues, project?.manifest, project?.patch.values]
);
const activeParameterMode: ParameterMode =
  parameterMode === "plus" && plusControls.length === 0 ? "pro" : parameterMode;
```

- [ ] **Step 3: Reset Plus state when switching projects**

Extend the existing effect keyed by `project?.id`:

```tsx
useEffect(() => {
  setPlaybackState("playing");
  setParameterMode("plus");
  setPlusValues({});
}, [project?.id]);
```

- [ ] **Step 4: Add a Plus change handler that writes compiled values to existing params**

Add before `return`:

```tsx
function updatePlusControl(controlId: PlusControlKind, value: PlusControlValue) {
  if (!project) return;
  const nextPlusValues = { ...plusValues, [controlId]: value };
  const compiled = compilePlusPatch({
    manifest: project.manifest,
    plusValues: nextPlusValues,
    baseValues: project.patch.values
  });
  setPlusValues(nextPlusValues);
  for (const paramId of compiled.affectedParamIds) {
    onParamChange(paramId, compiled.values[paramId]);
  }
}
```

- [ ] **Step 5: Replace the inspector body with mode tabs and conditional panel**

Replace the non-read-only fragment in `EditorRoute` with:

```tsx
<>
  <div className="panel-header">
    <p className="eyebrow">参数调节</p>
    <h2>{activeParameterMode === "plus" ? "简化控制" : "可调参数"}</h2>
  </div>
  <ParameterModeTabs
    mode={activeParameterMode}
    plusDisabled={plusControls.length === 0}
    onChange={setParameterMode}
  />
  {activeParameterMode === "plus" ? (
    <PlusControlPanel
      controls={plusControls}
      values={plusValues}
      affectedParamIds={plusPatchResult.affectedParamIds}
      onChange={updatePlusControl}
    />
  ) : (
    <ParameterPanel
      manifest={project?.manifest ?? null}
      patch={project?.patch ?? null}
      onChange={onParamChange}
      {...(onResetParams ? { onReset: onResetParams } : {})}
    />
  )}
</>
```

- [ ] **Step 6: Run web tests**

Run:

```bash
pnpm --filter @motion-tool/web test
```

Expected: PASS.

## Task 6: Verification and Regression

**Files:**
- No new files.

- [ ] **Step 1: Run focused core tests**

Run:

```bash
./apps/web/node_modules/.bin/vitest run packages/core/test/plusControls.test.ts packages/core/test/applyPatch.test.ts packages/core/test/manifest.schema.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run core typecheck**

Run:

```bash
pnpm --filter @motion-tool/core typecheck
```

Expected: PASS.

- [ ] **Step 3: Run web tests and typecheck**

Run:

```bash
pnpm --filter @motion-tool/web test
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint and build**

Run:

```bash
pnpm lint
pnpm -r build
```

Expected: PASS. Existing Vite warnings about Node version or large chunks may appear; they are not part of this feature.

- [ ] **Step 5: Manual smoke test**

Run:

```bash
pnpm dev
```

Open the local URL, select a component with `transitionDuration`, `easing`, or `dimOpacity` params, and verify:

- Editor opens in Plus mode when simplified controls exist.
- Changing “速度” updates the preview.
- Switching to Pro shows changed underlying params.
- Components without mapped controls land in Pro mode.

