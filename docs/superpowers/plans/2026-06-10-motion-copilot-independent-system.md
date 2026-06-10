# 2026-06-10 · MotionCopilot 独立系统实施计划

## Goal

在当前仓库内新增一套独立的 MotionCopilot 动效创作系统。新系统不复用旧 `MotionManifest` / `MotionRecipe` / `motionSkill` 体系，只共享仓库工程设施。

## Architecture

```text
apps/motion-copilot
  -> imports packages/motion-copilot-core
  -> owns UI, preview canvas, inspector, export panel

packages/motion-copilot-core
  -> owns MotionDocument schema
  -> owns deterministic intent compiler
  -> owns JoySpace guideline engine
  -> owns HTML/CSS exporter
```

## Non-Negotiables

- Do not import `@motion-tool/core`.
- Do not use `MotionManifest`.
- Do not use `MotionRecipe`.
- Do not use `motionSkill`.
- Do not mutate existing web app behavior.
- Do not introduce global state libraries for MVP.
- Do not add AI freeform code generation.
- Keep Phase 1 single-element and single-timeline.

## Deliverables

### Core Package

Create:

```text
packages/motion-copilot-core/
  package.json
  tsconfig.json
  src/
    index.ts
    schema/document.ts
    schema/defaults.ts
    intent/compileIntent.ts
    guideline/evaluateGuidelines.ts
    export/exportHtmlCss.ts
  test/
    document.test.ts
    compileIntent.test.ts
    evaluateGuidelines.test.ts
    exportHtmlCss.test.ts
```

Core APIs:

```ts
createDefaultDocument(role)
applyDocumentPatch(document, patch)
compileIntent({ prompt, base })
evaluateGuidelines(document)
exportHtmlCss(document)
```

### Web App

Create:

```text
apps/motion-copilot/
  package.json
  index.html
  tsconfig.json
  vite.config.ts
  src/
    App.tsx
    main.tsx
    features/prompt/PromptPanel.tsx
    features/canvas/MotionCanvas.tsx
    features/inspector/InspectorPanel.tsx
    features/guideline-coach/GuidelineCoachPanel.tsx
    features/export/ExportPanel.tsx
    styles/index.css
```

App layout:

```text
left   PromptPanel
center MotionCanvas
right  InspectorPanel + GuidelineCoachPanel + ExportPanel
```

## Implementation Steps

### Step 1: Workspace wiring

- Add `packages/motion-copilot-core/package.json`.
- Add `apps/motion-copilot/package.json`.
- Ensure existing `pnpm-workspace.yaml` already includes `apps/*` and `packages/*`.
- Add package scripts only inside the new package/app.

Validation:

```bash
pnpm --filter @motion-copilot/core typecheck
pnpm --filter @motion-copilot/core test
pnpm --filter @motion-copilot/app typecheck
```

### Step 2: MotionDocument schema

Implement:

- `MotionDocument`
- `MotionElement`
- `MotionTimeline`
- `EasingSpec`
- `GuidelineSuggestion`
- `MotionDocumentPatch`

Keep patch simple:

```ts
type MotionDocumentPatch = {
  stage?: Partial<StageSpec>;
  element?: {
    id?: string;
    role?: MotionElement["role"];
    size?: MotionElement["size"];
    initial?: Partial<MotionState>;
    animate?: Partial<MotionState>;
  };
  timeline?: Partial<MotionTimeline>;
};
```

### Step 3: Defaults

Create defaults for:

- Modal enter
- Toast enter
- Button click

Expected defaults:

```text
Modal medium enter: 260ms, decelerate, scale 0.96 -> 1, opacity 0 -> 1, y 24 -> 0
Toast small enter: 180ms, decelerate, opacity 0 -> 1, y 12 -> 0
Button small click: 160ms, spring intent, scale 1 -> 0.96 -> 1
```

### Step 4: Intent compiler

Implement deterministic keyword mapping.

Examples:

```text
Q 弹弹窗       -> modal + spring intent
快速 toast     -> toast + shorter duration
按钮点击反馈    -> button + click + spring intent
丝滑弹窗       -> modal + decelerate + medium duration
```

No model call in Phase 1.

### Step 5: Guideline engine

Implement JoySpace-derived suggestions:

- Size duration range.
- Enter slower than exit.
- Spring suitable for feedback.
- Spring discouraged for toast exit and opacity-only motion.
- Large object spring warning.

Suggestions must not block export.

### Step 6: Exporter

Compile `MotionDocument` to standalone HTML/CSS.

Rules:

- No network dependency.
- No dangerous API.
- Include `prefers-reduced-motion`.
- Keep output readable.

### Step 7: App shell

Build the three-column UI:

- Left prompt and style token buttons.
- Center canvas with play/replay/seek.
- Right inspector and suggestions.

No nested card-heavy UI. This is an operational creative tool, not a landing page.

### Step 8: Preview runtime

For Phase 1, preview can use CSS variables and Web Animations API in React state.

Required controls:

- Play
- Replay
- Pause
- Seek

### Step 9: Guideline UI

Right panel:

- Full suggestion title, reason, apply, ignore.

Canvas:

- Compact suggestion chips only.

### Step 10: Tests

Run focused package tests first, then broader workspace checks if needed.

Minimum:

```bash
pnpm --filter @motion-copilot/core test
pnpm --filter @motion-copilot/core typecheck
pnpm --filter @motion-copilot/app typecheck
```

## Acceptance Checklist

- [ ] New app starts independently.
- [ ] New core has no dependency on `@motion-tool/core`.
- [ ] Modal / Toast / Button can be selected.
- [ ] Prompt can generate or patch the document.
- [ ] Parameter edits update preview.
- [ ] Guideline suggestions appear without blocking export.
- [ ] Suggestions can be applied.
- [ ] Suggestions can be ignored.
- [ ] Canvas shows lightweight suggestion chips.
- [ ] Export panel outputs standalone HTML/CSS.
- [ ] Export includes reduced-motion fallback.

## Risk Notes

- Do not add a generic timeline too early. It will multiply state complexity.
- Do not make the guideline engine prescriptive. The user chose suggestion mode.
- Do not let prompt logic mutate source code. It only patches `MotionDocument`.
- Do not reuse old core types. That would defeat the purpose of the rewrite.
- Do not broaden roles beyond Modal / Toast / Button in Phase 1.

