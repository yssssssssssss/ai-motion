# Zero Native Layer Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent Zero native-layer motion entry that restores Zero visuals from the original layer tree, while using object grouping only as animation guidance.

**Architecture:** Zero native layers are the rendering and editing source of truth. Object groups are derived from the layer tree and influence binding/timing labels, but final render, overrides, export, and screenshot checks stay node-id based.

**Tech Stack:** Vite, React 19, TypeScript 5.8, Vitest, Zero/Relay MCP `use_design_script`, existing `@motion-copilot/core`.

---

### Task 1: Fix Native Zero HTTP Bridge Protocol

**Files:**

- Modify: `scripts/zero-mcp-layer-bridge.mjs`
- Test: `packages/motion-copilot-core/test/zeroLayerMorph.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test asserting the HTTP MCP bridge calls `use_design_script` with `code` and `description`, not the old `script` key.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @motion-copilot/core test -- test/zeroLayerMorph.test.ts -t "sends Zero native layer collector as code"`

Expected: FAIL because the current bridge sends `arguments.script`.

- [ ] **Step 3: Implement minimal bridge fix**

Change HTTP `use_design_script` arguments to `{ code, description }`; keep command-template mode compatible by still replacing `{script}` for external tools.

- [ ] **Step 4: Run test to verify it passes**

Run the same focused test, then the full `zeroLayerMorph.test.ts`.

### Task 2: Add Object Guidance Without Replacing Layers

**Files:**

- Create: `packages/motion-copilot-core/src/zeroLayerMorph/deriveZeroLayerObjects.ts`
- Modify: `packages/motion-copilot-core/src/zeroLayerMorph/schema.ts`
- Modify: `packages/motion-copilot-core/src/zeroLayerMorph/compileZeroLayerMotionComposition.ts`
- Modify: `packages/motion-copilot-core/src/index.ts`
- Test: `packages/motion-copilot-core/test/zeroLayerMorph.test.ts`

- [ ] **Step 1: Write failing object-guidance tests**

Cover that a status-pill group is derived from a rounded rectangle plus text children, and that composition stores this guidance while `visualSource.from.layers` remains unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @motion-copilot/core test -- test/zeroLayerMorph.test.ts -t "derives Zero object guidance"`

Expected: FAIL because the derivation function and source field do not exist yet.

- [ ] **Step 3: Implement minimal derivation**

Derive simple object groups from existing parent/child links:

- `status-pill` when a group contains a rounded rectangle and text/ellipse children.
- `button` when a group contains a black rounded rectangle and text.
- `container` for root/background groups.

- [ ] **Step 4: Wire guidance into composition**

Add `objects` to `ZeroLayerMorphSource` and fill it during `compileZeroLayerMotionComposition`.

### Task 3: Make the New Entry Explicitly Independent

**Files:**

- Modify: `apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerMorphPanel.tsx`
- Modify: `apps/motion-copilot/src/features/zeroLayerMorph/ZeroLayerStage.tsx`
- Modify: `apps/motion-copilot/src/styles.css`
- Test: `apps/motion-copilot/src/App.test.tsx` or focused existing feature tests

- [ ] **Step 1: Write UI tests**

Assert the UI labels the entry as Zero 原生图层 and shows object-guidance counts separately from raw layer counts.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @motion-copilot/app test -- src/App.test.tsx -t "Zero 原生图层"`

Expected: FAIL if labels/counts are absent.

- [ ] **Step 3: Update panel copy and counts**

Rename the entry and source panel to emphasize native layer source-of-truth. Show `layers` count and derived `objects` count separately.

### Task 4: Verification

**Files:**

- No new files unless tests expose a narrow bug.

- [ ] **Step 1: Run focused core tests**

Run: `pnpm --filter @motion-copilot/core test -- test/zeroLayerMorph.test.ts`

- [ ] **Step 2: Run app tests**

Run: `pnpm --filter @motion-copilot/app test`

- [ ] **Step 3: Run typecheck**

Run: `pnpm motion-copilot:typecheck`

- [ ] **Step 4: Start dev server**

Run: `pnpm motion-copilot:dev` and provide the local URL.
