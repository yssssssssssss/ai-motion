# Motion Copilot High Fidelity Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build editable high-fidelity Zero frame-morph layers so users can select a real visual node and adjust position, size, opacity, and radius in preview/export without degrading the original imported HTML/CSS.

**Architecture:** Keep the existing high-fidelity path as the source of truth: `ZeroVisualSnapshot.html/css` remains immutable. Add a small `nodeOverrides` model keyed by Zero `nodeId`, then render those overrides as deterministic CSS in preview, report refresh, and exported HTML. Low-fidelity `MotionLayer` editing remains separate and unchanged.

**Tech Stack:** React 19, TypeScript 5.8, Vite, Vitest, existing `@motion-copilot/core` frameMorph schema/runtime.

## Global Constraints

- Only touch Motion Copilot boundaries: `apps/motion-copilot` and `packages/motion-copilot-core`.
- Do not change `apps/web`, `packages/core`, `packages/components-builtin`, or shared product lines.
- Do not mutate imported Zero HTML/CSS directly; use non-destructive node override CSS.
- Do not introduce a new renderer, new port, new app entrypoint, or new third-party dependency.
- Preserve current low-fidelity behavior and existing MotionLayer upload/edit/drag/resize flows.
- Every task must include regression tests before implementation.

---

## File Structure

- Modify `packages/motion-copilot-core/src/frameMorph/schema.ts`
  - Add `ZeroVisualNodeOverride` and store optional overrides on the high-fidelity visual source.
- Create `packages/motion-copilot-core/src/frameMorph/createZeroVisualNodeOverrideCss.ts`
  - Convert node overrides into scoped CSS for `[data-node-id]`.
- Modify `packages/motion-copilot-core/src/frameMorph/createVisualTimelineCss.ts`
  - Keep motion CSS focused on animation; do not mix edit overrides here.
- Modify `packages/motion-copilot-core/src/composition/exportVisualCompositionHtml.ts`
  - Inject override CSS into exported high-fidelity HTML.
- Modify `packages/motion-copilot-core/src/index.ts`
  - Export the new override CSS helper and types.
- Modify `packages/motion-copilot-core/test/frameMorph.test.ts`
  - Cover override CSS, export embedding, and non-destructive snapshot behavior.
- Modify `apps/motion-copilot/src/features/visualStage/VisualStage.tsx`
  - Accept override CSS and apply it inside iframe preview.
- Modify `apps/motion-copilot/src/features/frameMorph/FrameMorphPanel.tsx`
  - Expose selected-node edit controls for x/y/width/height/radius/opacity and persist overrides into `visualSource`.
- Modify `apps/motion-copilot/src/App.tsx`
  - Wire high-fidelity visual source updates without touching low-fidelity layer editing.
- Modify `apps/motion-copilot/src/App.test.tsx`
  - Test select node, edit geometry, persistence, and export/report cache preservation.
- Modify `apps/motion-copilot/src/styles.css`
  - Add compact high-fidelity edit panel styling only if needed.

---

### Task 1: Add High-Fidelity Node Override Schema

**Files:**
- Modify: `packages/motion-copilot-core/src/frameMorph/schema.ts`
- Modify: `packages/motion-copilot-core/src/index.ts`
- Test: `packages/motion-copilot-core/test/frameMorph.test.ts`

**Interfaces:**
- Produces:
  - `type ZeroVisualNodeOverride = { nodeId: string; x?: number; y?: number; width?: number; height?: number; radius?: number; opacity?: number }`
  - Optional `nodeOverrides?: ZeroVisualNodeOverride[]` on `MotionDocument["visualSource"]` when `kind === "zero-visual-morph"`.
- Consumes:
  - Existing `MotionDocument.visualSource.kind === "zero-visual-morph"` branch.

- [ ] **Step 1: Write failing type/runtime test**

Add a test in `packages/motion-copilot-core/test/frameMorph.test.ts` near the visual export/report tests:

```ts
it("stores high-fidelity node overrides on visualSource without mutating snapshots", () => {
  const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text", text: "start" }]);
  const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text", text: "end" }]);
  const bindings = compileVisualMotionBindings(from, to);
  const intent = compileVisualMotionIntent("淡入");
  const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });

  if (composition.document.visualSource?.kind !== "zero-visual-morph") {
    throw new Error("expected zero-visual-morph source");
  }

  composition.document.visualSource.nodeOverrides = [
    { nodeId: "a", x: 12, y: 8, width: 88, height: 24, radius: 6, opacity: 0.72 }
  ];

  expect(composition.document.visualSource.nodeOverrides).toEqual([
    { nodeId: "a", x: 12, y: 8, width: 88, height: 24, radius: 6, opacity: 0.72 }
  ]);
  expect(composition.document.visualSource.from.nodes.find((node) => node.nodeId === "a")?.bounds).toEqual({
    x: 0,
    y: 0,
    w: 50,
    h: 50
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd packages/motion-copilot-core
./node_modules/.bin/vitest run test/frameMorph.test.ts -t "stores high-fidelity node overrides"
```

Expected: FAIL because `nodeOverrides` is not typed on the high-fidelity visual source.

- [ ] **Step 3: Add schema fields**

In `packages/motion-copilot-core/src/frameMorph/schema.ts`, add:

```ts
export type ZeroVisualNodeOverride = {
  nodeId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  opacity?: number;
};
```

Then add `nodeOverrides?: ZeroVisualNodeOverride[];` to the `zero-visual-morph` visual source type in the existing document schema file where `visualSource` is declared. If that declaration lives in `packages/motion-copilot-core/src/schema/document.ts`, import the type there from `../frameMorph/schema`.

- [ ] **Step 4: Export the type**

If `packages/motion-copilot-core/src/index.ts` already exports `./frameMorph/schema`, no extra export is needed. If not, add the narrow export:

```ts
export type { ZeroVisualNodeOverride } from "./frameMorph/schema";
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd packages/motion-copilot-core
./node_modules/.bin/vitest run test/frameMorph.test.ts -t "stores high-fidelity node overrides"
./node_modules/.bin/tsc --noEmit
```

Expected: PASS and no type errors.

---

### Task 2: Render Override CSS for Preview and Export

**Files:**
- Create: `packages/motion-copilot-core/src/frameMorph/createZeroVisualNodeOverrideCss.ts`
- Modify: `packages/motion-copilot-core/src/composition/exportVisualCompositionHtml.ts`
- Modify: `packages/motion-copilot-core/src/index.ts`
- Test: `packages/motion-copilot-core/test/frameMorph.test.ts`

**Interfaces:**
- Consumes:
  - `ZeroVisualNodeOverride[]`
- Produces:
  - `createZeroVisualNodeOverrideCss(overrides: ZeroVisualNodeOverride[]): string`

- [ ] **Step 1: Write failing CSS helper test**

Add to `packages/motion-copilot-core/test/frameMorph.test.ts`:

```ts
it("creates scoped CSS for high-fidelity node overrides", () => {
  const css = createZeroVisualNodeOverrideCss([
    { nodeId: '28:12', x: 10, y: 20, width: 120, height: 32, radius: 16, opacity: 0.5 }
  ]);

  expect(css).toContain('[data-node-id="28:12"]');
  expect(css).toContain("left:10px!important;");
  expect(css).toContain("top:20px!important;");
  expect(css).toContain("width:120px!important;");
  expect(css).toContain("height:32px!important;");
  expect(css).toContain("border-radius:16px!important;");
  expect(css).toContain("opacity:0.5!important;");
});
```

Also import `createZeroVisualNodeOverrideCss` from `../src`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd packages/motion-copilot-core
./node_modules/.bin/vitest run test/frameMorph.test.ts -t "creates scoped CSS"
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement CSS helper**

Create `packages/motion-copilot-core/src/frameMorph/createZeroVisualNodeOverrideCss.ts`:

```ts
import type { ZeroVisualNodeOverride } from "./schema";

function cssAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function px(name: string, value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${name}:${value}px!important;` : "";
}

function scalar(name: string, value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${name}:${value}!important;` : "";
}

export function createZeroVisualNodeOverrideCss(overrides: ZeroVisualNodeOverride[] | undefined): string {
  if (!overrides?.length) return "";
  return overrides
    .map((override) => {
      const body = [
        px("left", override.x),
        px("top", override.y),
        px("width", override.width),
        px("height", override.height),
        px("border-radius", override.radius),
        scalar("opacity", override.opacity)
      ].join("");
      return body ? `[data-node-id="${cssAttributeValue(override.nodeId)}"]{${body}}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
```

- [ ] **Step 4: Export helper**

Add to `packages/motion-copilot-core/src/index.ts`:

```ts
export * from "./frameMorph/createZeroVisualNodeOverrideCss";
```

- [ ] **Step 5: Inject override CSS into export**

In `packages/motion-copilot-core/src/composition/exportVisualCompositionHtml.ts`, import helper and add:

```ts
const overrideCss = createZeroVisualNodeOverrideCss(source.nodeOverrides);
```

Then include `${overrideCss}` after `ZERO_VISUAL_STAGE_ALIGNMENT_CSS` and before `${motionCss}` so manual geometry is the base state and motion can still animate over it when intended.

- [ ] **Step 6: Add export regression test**

Add:

```ts
it("exportVisualCompositionHtml embeds high-fidelity node override CSS", () => {
  const from = makeVisualSnap("1", "首帧", [{ nodeId: "a", kind: "text", text: "start" }]);
  const to = makeVisualSnap("2", "尾帧", [{ nodeId: "b", kind: "text", text: "end" }]);
  const bindings = compileVisualMotionBindings(from, to);
  const intent = compileVisualMotionIntent("淡入");
  const composition = compileVisualMotionComposition({ from, to, bindingResult: bindings, intent });

  if (composition.document.visualSource?.kind !== "zero-visual-morph") {
    throw new Error("expected zero-visual-morph source");
  }
  composition.document.visualSource.nodeOverrides = [{ nodeId: "a", x: 16, width: 96, radius: 8 }];

  const html = exportCompositionHtml(composition.document.composition!, composition.document);
  expect(html).toContain('[data-node-id="a"]{left:16px!important;width:96px!important;border-radius:8px!important;}');
});
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd packages/motion-copilot-core
./node_modules/.bin/vitest run test/frameMorph.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected: 50+ tests pass and no type errors.

---

### Task 3: Apply Override CSS in High-Fidelity Preview

**Files:**
- Modify: `apps/motion-copilot/src/features/visualStage/VisualStage.tsx`
- Test: `apps/motion-copilot/src/features/visualStage/VisualStage.test.tsx`

**Interfaces:**
- Consumes:
  - `overrideCss?: string`
- Produces:
  - iframe `srcDoc` contains override CSS between snapshot alignment CSS and motion CSS.

- [ ] **Step 1: Write failing preview test**

Add to `apps/motion-copilot/src/features/visualStage/VisualStage.test.tsx`:

```tsx
it("injects high-fidelity override CSS into the iframe preview", () => {
  render(
    <VisualStage
      snapshot={snapshot}
      overrideCss={'[data-node-id="28:11"]{left:12px!important;}'}
    />
  );

  const iframe = document.querySelector<HTMLIFrameElement>("iframe.visual-stage");
  expect(iframe?.srcdoc).toContain('[data-node-id="28:11"]{left:12px!important;}');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/features/visualStage/VisualStage.test.tsx -t "injects high-fidelity override CSS"
```

Expected: FAIL because `overrideCss` prop does not exist.

- [ ] **Step 3: Add prop and injection**

In `VisualStage.tsx`, extend props:

```ts
overrideCss?: string | undefined;
```

Update `buildVisualStageSrcDoc` signature:

```ts
export function buildVisualStageSrcDoc(
  snapshot: ZeroVisualSnapshot,
  highlightedNodeId?: string,
  motionCss = "",
  overrideCss = ""
): string
```

Insert `${overrideCss}` before `${motionCss}` in the style block.

Update component memo:

```ts
const srcDoc = useMemo(
  () => buildVisualStageSrcDoc(snapshot, highlightedNodeId, motionCss, overrideCss),
  [highlightedNodeId, motionCss, overrideCss, snapshot]
);
```

- [ ] **Step 4: Run test**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/features/visualStage/VisualStage.test.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: PASS and no type errors.

---

### Task 4: Add Selected Zero Node Edit Controls

**Files:**
- Modify: `apps/motion-copilot/src/features/frameMorph/FrameMorphPanel.tsx`
- Modify: `apps/motion-copilot/src/styles.css`
- Test: `apps/motion-copilot/src/App.test.tsx`

**Interfaces:**
- Consumes:
  - `savedVisualSource.nodeOverrides`
  - selected `visualNodeId`
- Produces:
  - `visualSource.nodeOverrides` updated through `onApplyVisualComposition`
  - visible controls: `X`, `Y`, `宽`, `高`, `圆角`, `透明度`

- [ ] **Step 1: Write failing app test**

Add to `apps/motion-copilot/src/App.test.tsx`:

```tsx
it("edits selected high-fidelity Zero node geometry through node overrides", async () => {
  render(<App />);
  await importVisualFrameMorphFixture();

  const nodeButton = await screen.findByRole("button", { name: /继续指派/ });
  fireEvent.click(nodeButton);

  const widthInput = await screen.findByLabelText("高保真节点宽度");
  fireEvent.change(widthInput, { target: { value: "144" } });

  const radiusInput = await screen.findByLabelText("高保真节点圆角");
  fireEvent.change(radiusInput, { target: { value: "12" } });

  await waitFor(() => {
    const snapshot = savedWorkspace();
    const source = snapshot.document.visualSource;
    expect(source?.kind).toBe("zero-visual-morph");
    if (source?.kind !== "zero-visual-morph") return;
    expect(source.nodeOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 144,
          radius: 12
        })
      ])
    );
  });
});
```

Use the same high-fidelity import setup already used by `reads Zero visual snapshots and renders high-fidelity iframe previews`: stub `fetch` for `/api/zero/visual-snapshot`, render the app, click `开始使用`, switch to `帧间`, then click `从 Zero 读取并生成高保真时间线`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx -t "edits selected high-fidelity Zero node geometry"
```

Expected: FAIL because controls do not exist.

- [ ] **Step 3: Add override state helpers in FrameMorphPanel**

Inside `FrameMorphPanel.tsx`, add pure helpers:

```ts
type ZeroVisualMorphSource = NonNullable<MotionDocument["visualSource"]> & { kind: "zero-visual-morph" };

function overrideForNode(source: ZeroVisualMorphSource, nodeId: string): ZeroVisualNodeOverride {
  const node = [...source.from.nodes, ...source.to.nodes].find((candidate) => candidate.nodeId === nodeId);
  const existing = source.nodeOverrides?.find((override) => override.nodeId === nodeId);
  return {
    nodeId,
    x: existing?.x ?? node?.bounds.x,
    y: existing?.y ?? node?.bounds.y,
    width: existing?.width ?? node?.bounds.w,
    height: existing?.height ?? node?.bounds.h,
    radius: existing?.radius,
    opacity: existing?.opacity ?? 1
  };
}

function upsertNodeOverride(
  overrides: ZeroVisualNodeOverride[] | undefined,
  next: ZeroVisualNodeOverride
): ZeroVisualNodeOverride[] {
  const rest = (overrides ?? []).filter((override) => override.nodeId !== next.nodeId);
  return [...rest, next];
}

function overrideNumberValue(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
```

- [ ] **Step 4: Render edit controls**

When `visualNodeId` is selected and `visualComposition.document.visualSource.kind === "zero-visual-morph"`, render a compact panel:

```tsx
<div className="zero-node-edit-panel">
  <p className="eyebrow">高保真节点</p>
  <div className="field-row">
    <label className="field">
      <span>X</span>
      <input
        aria-label="高保真节点 X"
        type="number"
        value={current.x ?? 0}
        onChange={(event) => updateSelectedNodeOverride({ x: overrideNumberValue(event.target.value, current.x ?? 0) })}
      />
    </label>
    <label className="field">
      <span>Y</span>
      <input
        aria-label="高保真节点 Y"
        type="number"
        value={current.y ?? 0}
        onChange={(event) => updateSelectedNodeOverride({ y: overrideNumberValue(event.target.value, current.y ?? 0) })}
      />
    </label>
  </div>
  <div className="field-row">
    <label className="field">
      <span>宽</span>
      <input
        aria-label="高保真节点宽度"
        type="number"
        min={1}
        value={current.width ?? 1}
        onChange={(event) =>
          updateSelectedNodeOverride({ width: Math.max(1, overrideNumberValue(event.target.value, current.width ?? 1)) })
        }
      />
    </label>
    <label className="field">
      <span>高</span>
      <input
        aria-label="高保真节点高度"
        type="number"
        min={1}
        value={current.height ?? 1}
        onChange={(event) =>
          updateSelectedNodeOverride({ height: Math.max(1, overrideNumberValue(event.target.value, current.height ?? 1)) })
        }
      />
    </label>
  </div>
  <div className="field-row">
    <label className="field">
      <span>圆角</span>
      <input
        aria-label="高保真节点圆角"
        type="number"
        min={0}
        value={current.radius ?? 0}
        onChange={(event) =>
          updateSelectedNodeOverride({ radius: Math.max(0, overrideNumberValue(event.target.value, current.radius ?? 0)) })
        }
      />
    </label>
    <label className="field">
      <span>透明度</span>
      <input
        aria-label="高保真节点透明度"
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={current.opacity ?? 1}
        onChange={(event) =>
          updateSelectedNodeOverride({
            opacity: Math.min(1, Math.max(0, overrideNumberValue(event.target.value, current.opacity ?? 1)))
          })
        }
      />
    </label>
  </div>
</div>
```

Add this updater in `FrameMorphPanel.tsx` before rendering the edit panel:

```ts
function updateSelectedNodeOverride(patch: Partial<ZeroVisualNodeOverride>): void {
  if (!visualNodeId || !visualComposition?.document.visualSource || visualComposition.document.visualSource.kind !== "zero-visual-morph") {
    return;
  }
  const source = visualComposition.document.visualSource;
  const current = overrideForNode(source, visualNodeId);
  const nextOverride = { ...current, ...patch, nodeId: visualNodeId };
  const nextOverrides = upsertNodeOverride(source.nodeOverrides, nextOverride);
  const nextVisualComposition = {
    ...visualComposition,
    document: {
      ...visualComposition.document,
      visualSource: {
        ...source,
        nodeOverrides: nextOverrides,
        restorationReportCache: undefined
      }
    }
  };
  setReportStale(true);
  onApplyVisualComposition(nextVisualComposition);
}
```

- [ ] **Step 5: Preserve report cache invalidation**

When node overrides change, clear `restorationReportCache` or mark it stale using the existing stale report mechanism. The report must not pretend to describe a geometry state that has been manually edited after calculation.

- [ ] **Step 6: Add minimal CSS**

In `apps/motion-copilot/src/styles.css`, add only compact layout styles:

```css
.zero-node-edit-panel {
  display: grid;
  gap: 8px;
}
```

Reuse existing `.field` and `.field-row` classes where possible.

- [ ] **Step 7: Run tests**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx -t "edits selected high-fidelity Zero node geometry"
./node_modules/.bin/tsc --noEmit
```

Expected: PASS and no type errors.

---

### Task 5: Wire Overrides Into Preview Playback

**Files:**
- Modify: `apps/motion-copilot/src/features/frameMorph/FrameMorphPanel.tsx`
- Test: `apps/motion-copilot/src/App.test.tsx`

**Interfaces:**
- Consumes:
  - `createZeroVisualNodeOverrideCss(source.nodeOverrides)`
  - `VisualStage overrideCss`
- Produces:
  - High-fidelity iframe preview reflects selected node overrides in `from`, `to`, `overlay`, and `motion` modes.

- [ ] **Step 1: Write failing test**

Add:

```tsx
it("passes high-fidelity node override CSS to visual preview", async () => {
  render(<App />);
  await importVisualFrameMorphFixture();

  const nodeButton = await screen.findByRole("button", { name: /继续指派/ });
  fireEvent.click(nodeButton);
  fireEvent.change(await screen.findByLabelText("高保真节点 X"), { target: { value: "33" } });

  await waitFor(() => {
    const iframe = document.querySelector<HTMLIFrameElement>("iframe.visual-stage");
    expect(iframe?.srcdoc).toContain("left:33px!important;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx -t "passes high-fidelity node override CSS"
```

Expected: FAIL until preview wiring is added.

- [ ] **Step 3: Import helper and generate CSS**

In `FrameMorphPanel.tsx`, import:

```ts
import { createZeroVisualNodeOverrideCss } from "@motion-copilot/core";
```

Derive:

```ts
const visualOverrideCss =
  visualComposition.document.visualSource?.kind === "zero-visual-morph"
    ? createZeroVisualNodeOverrideCss(visualComposition.document.visualSource.nodeOverrides)
    : "";
```

- [ ] **Step 4: Pass overrideCss to all VisualStage usages**

For every high-fidelity `VisualStage` in the panel, add:

```tsx
overrideCss={visualOverrideCss}
```

Keep existing `motionCss` unchanged.

- [ ] **Step 5: Run tests**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx src/features/visualStage/VisualStage.test.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: PASS and no type errors.

---

### Task 6: Export and Persistence End-to-End

**Files:**
- Modify: `apps/motion-copilot/src/App.test.tsx`
- Modify: `packages/motion-copilot-core/test/frameMorph.test.ts`
- Modify only implementation files if these tests reveal missing wiring.

**Interfaces:**
- Consumes:
  - Workspace save/load
  - `exportCompositionHtml`
  - `visualSource.nodeOverrides`
- Produces:
  - Reopened project retains high-fidelity node overrides.
  - Exported HTML includes override CSS.

- [ ] **Step 1: Write workspace persistence test**

Add to `apps/motion-copilot/src/App.test.tsx`:

```tsx
it("persists high-fidelity node overrides across workspace restore", async () => {
  const { unmount } = render(<App />);
  await importVisualFrameMorphFixture();

  fireEvent.click(await screen.findByRole("button", { name: /继续指派/ }));
  fireEvent.change(await screen.findByLabelText("高保真节点宽度"), { target: { value: "166" } });

  await waitFor(() => {
    const source = savedWorkspace().document.visualSource;
    expect(source?.kind).toBe("zero-visual-morph");
    if (source?.kind === "zero-visual-morph") {
      expect(source.nodeOverrides).toEqual(expect.arrayContaining([expect.objectContaining({ width: 166 })]));
    }
  });

  unmount();
  render(<App />);

  await waitFor(() => {
    expect(screen.getByLabelText("高保真节点宽度")).toHaveValue(166);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run:

```bash
cd apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx -t "persists high-fidelity node overrides"
```

Expected: PASS if Task 4 reused existing document persistence correctly; otherwise FAIL and fix the state update path only.

- [ ] **Step 3: Add export user-flow test if missing**

If there is an existing export button test, extend it to assert exported HTML contains the override CSS. Otherwise keep export coverage in core test from Task 2 and do not add brittle UI download tests.

- [ ] **Step 4: Run full Motion Copilot validation**

Run:

```bash
cd packages/motion-copilot-core
./node_modules/.bin/vitest run test/frameMorph.test.ts
./node_modules/.bin/tsc --noEmit

cd ../../apps/motion-copilot
./node_modules/.bin/vitest run src/App.test.tsx src/features/visualStage/VisualStage.test.tsx
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
./node_modules/.bin/vite build --ssr src/server/startProductionServer.ts --outDir dist-server
```

Expected:
- Core frame morph tests pass.
- App tests pass.
- Typecheck passes.
- Build exits 0. Existing Node version warning is acceptable only if build exits 0.

---

### Task 7: Manual QA Checklist for Real Device

**Files:**
- No code files unless bugs are found.
- Optional documentation update: `docs/2026-06-30-motion-copilot-high-fidelity-editing-qa.md`

**Interfaces:**
- Consumes:
  - Local Motion Copilot app on port 5177.
  - Zero high-fidelity frame morph fixture or real imported design.
- Produces:
  - Manual verification notes and any follow-up bug list.

- [ ] **Step 1: Start app**

Run:

```bash
cd apps/motion-copilot
pnpm dev --host 0.0.0.0
```

Expected: app available on port `5177` or the next available Vite port.

- [ ] **Step 2: Import high-fidelity frame morph**

Use the “帧间” panel high-fidelity import. Load the same problematic real-device case with status pill, button backgrounds, and merged status labels.

- [ ] **Step 3: Select a Zero node**

Click a visible node in high-fidelity preview. Expected:
- Node highlight appears.
- High-fidelity edit panel shows x/y/width/height/radius/opacity controls.

- [ ] **Step 4: Edit geometry**

Change:
- X by `+10`
- Width by `+20`
- Radius to `12`
- Opacity to `0.8`

Expected:
- Preview updates immediately.
- No unrelated node moves.
- Motion preview still plays.

- [ ] **Step 5: Refresh report**

Expected:
- Report is marked stale after edits.
- After refresh, report does not show the six collapsed status fragments as unresolved.

- [ ] **Step 6: Export HTML**

Expected:
- Exported HTML contains override CSS.
- Opening exported HTML shows the edited high-fidelity node geometry.
- `motion-report` is present if a report cache exists.

- [ ] **Step 7: Regression check low-fidelity**

Use legacy low-fidelity or normal layer editing:
- Add image layer.
- Drag it.
- Resize it.
- Rename it.

Expected: unchanged from before this plan.

---

## Acceptance Criteria

- High-fidelity preview supports selecting a real Zero node and editing x/y/width/height/radius/opacity.
- Edits are non-destructive and stored as `visualSource.nodeOverrides`.
- Preview, motion playback, workspace restore, and exported HTML all apply the same override CSS.
- Low-fidelity MotionLayer editing remains unchanged.
- Existing frame morph report improvements remain intact: collapsed status fragments are not reported as unresolved errors.
- All listed Vitest, TypeScript, and build commands pass.

## Risks and Non-Goals

- This plan does not attempt full Zero-to-editable-layer conversion. That would be a larger object-model project.
- This plan does not edit SVG path internals. Radius and size overrides apply at the DOM node boundary.
- Some CSS/SVG assets may visually resist border-radius unless the underlying node clips overflow; if that occurs, add a separate follow-up for `overflow:hidden` override support.
- Group editing is intentionally deferred unless the selected `nodeId` maps cleanly to one DOM element.

## Follow-Up Candidates

- Add drag handles directly on high-fidelity nodes.
- Add group-level smart editing for button/card objects.
- Add style override fields for background, text color, font size, and shadow.
- Feed node override changes into the restoration report as `user-change` issues instead of only marking stale.
- Add a visual diff score after override edits.
