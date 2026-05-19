# WorkEasy Fusion Design

Date: 2026-05-18
Scope: Phase 1 fusion

## Goal

Use `jdc-WorkEasy` as a read-only source of high-quality motion components for `ai-motion-tool`.

The fused product remains `ai-motion-tool`: users describe a need, receive matching motion assets, preview them, edit validated parameters through `Motion Manifest`, and export an editable package. `jdc-WorkEasy` contributes its existing HTML/CSS component library, not its entire application shell.

## Decision Summary

Phase 1 will integrate a curated set of WorkEasy HTML/CSS components only.

- Primary app: `ai-motion-tool`
- Source project: `/Users/heyunshen/work/PROJECT/jdc/jdc-WorkEasy`
- Source mode: read-only
- First component set: 20 curated HTML/CSS components
- Category mix: 10 buttons, 5 cards, 5 checkboxes
- Excluded in Phase 1: React/TSX, Vue, Lottie, full WorkEasy route/UI merge, arbitrary JavaScript editing

This keeps the first fusion small enough to verify while proving that WorkEasy can become a durable internal motion library.

## Context

`ai-motion-tool` already has the core editing loop:

```text
MotionSource
-> MotionManifest
-> Patch Engine
-> iframe Preview
-> Parameter Panel
-> Export Package
```

`jdc-WorkEasy` has a large motion showcase:

- `content/buttons`: 50 components
- `content/cards`: 20 components
- `content/checkboxes`: 50 components
- `public/api/components/*.json`: converted component metadata and source content
- `src/sandbox/core/AnimationAnalyzer.ts`: CSS animation profile analysis
- `src/sandbox/core/SandboxDocumentBuilder.ts`: iframe document construction patterns

The useful fusion is library ingestion and analysis, not merging two React apps.

## Architecture

Add a WorkEasy adapter inside `ai-motion-tool` core:

```text
WorkEasy JSON / content files
        |
        v
WorkEasy Adapter
        |
        v
MotionComponent[]
        |
        +--> MotionSource
        +--> Generated MotionManifest
        +--> metadata tags and recommendation fields
```

The adapter owns translation from WorkEasy's component model to `ai-motion-tool`'s motion model. The editor, preview, patching, and export surfaces stay unchanged.

## Adapter Inputs

Phase 1 should prefer WorkEasy's generated JSON files because they already contain normalized content:

```text
/Users/heyunshen/work/PROJECT/jdc/jdc-WorkEasy/public/api/components/buttons.json
/Users/heyunshen/work/PROJECT/jdc/jdc-WorkEasy/public/api/components/cards.json
/Users/heyunshen/work/PROJECT/jdc/jdc-WorkEasy/public/api/components/checkboxes.json
```

Each selected component must have:

- `id`
- `title`
- `type: "html"`
- `framework: "vanilla"` or no framework incompatible with vanilla
- `htmlContent`
- `cssContent`
- `tags`
- `description` when available

Components missing HTML or CSS are skipped in Phase 1.

## Selected Component Policy

Use an explicit allowlist.

```ts
type WorkEasySelection = {
  buttons: string[];
  cards: string[];
  checkboxes: string[];
};
```

The initial selection should include:

- 10 button components with visibly different motion patterns
- 5 card components with layout or hover movement
- 5 checkbox components with state or micro-interaction motion

Do not auto-import all components. WorkEasy currently has many generated assets and a dirty worktree; full import would amplify inconsistent metadata, duplicated patterns, and broken edge cases.

## Generated Component Shape

Each selected WorkEasy component becomes a `MotionComponent`.

```text
id: workeasy-<category>-<workeasy-id>
name: WorkEasy title
category: interaction | layout | form
tags: WorkEasy tags + category + "workeasy"
source.origin: builtin
source.kind: builtin-component
source.entry: source/index.html
```

The source files should be normalized into the same package structure used by native motion components:

```text
motion-components/workeasy/<category>/<id>/
  source/index.html
  source/style.css
  motion.manifest.json
  metadata.json
```

No WorkEasy source file is modified.

## Manifest Generation

The adapter builds a generated manifest for each selected component.

Confirmed parameters are allowed only when deterministic validation passes.

Phase 1 parameter generation:

- Text controls from simple text nodes in `htmlContent`.
- Color controls from CSS hex/rgb/hsl values and CSS variables.
- Duration controls from `transition-duration`, `animation-duration`, and simple shorthand durations.
- Radius controls from `border-radius` only when the selector is local to the component wrapper.
- Low-risk layout controls from `opacity`, `font-size`, and `gap` when values are simple bounded numbers or units.
- Safe HTML attribute controls from `alt`, `title`, and `aria-label` on `data-motion` elements.
- Safe SVG color controls from `fill` and `stroke` on `data-motion` elements.

Phase 1 should not generate controls for:

- Arbitrary JS logic
- Pseudo-element `content`
- Complex gradients as a single editable field
- CSS selectors that cannot be matched back to the source
- React props or TSX code
- Width and height controls until layout breakage bounds are defined.

Generated params start as `detected`; the validator promotes only safe targets to `confirmed`. The UI only exposes `confirmed`.

## Preview Runtime

Use `ai-motion-tool`'s existing iframe preview first.

For each WorkEasy component, the generated `index.html` should wrap the original HTML content and link `style.css`. The existing `PreviewFrame` can inline local styles into `srcDoc`.

Borrow ideas from WorkEasy's sandbox only when needed:

- `AnimationAnalyzer` can be adapted to annotate complexity and render risks.
- `SandboxDocumentBuilder` patterns can inform a later preview builder if iframe rendering needs base styles or debug instrumentation.

Do not import WorkEasy's full renderer stack in Phase 1.

## Recommendation Flow

WorkEasy components participate in the same recommendation API as native components.

Recommendation metadata should include:

- Category
- Tags
- Motion profile when available
- Editable parameter count
- Source label: `WorkEasy`

The web UI should display candidates with:

- Name
- Category
- Tags
- Parameter count
- A small source badge

## Export Behavior

Exported packages should be self-contained and use the generated motion package files:

- `source/index.html`
- `source/style.css`
- `motion.manifest.json`
- `metadata.json`
- `motion.patch.json`

Export should not reference the original WorkEasy path.

## Error Handling

The adapter should produce structured skip results.

```ts
type WorkEasyImportIssue =
  | "missing-html"
  | "missing-css"
  | "unsupported-type"
  | "invalid-manifest"
  | "no-confirmed-params";
```

Skipped components should be reported in tests or a generated summary. A skipped component must not crash the whole import.

## Testing

Core tests:

- Converts one valid WorkEasy HTML/CSS component to `MotionComponent`.
- Skips unsupported React/TSX component in Phase 1.
- Generates confirmed text/color/duration params for a simple fixture.
- Rejects a param whose target cannot be validated.
- Produces stable package paths and ids.

Web checks:

- WorkEasy category filter appears.
- A selected WorkEasy component previews in the iframe.
- Editing a generated parameter updates preview source.
- Export includes generated WorkEasy package files.

## Implementation Sequence

1. Add WorkEasy adapter types and conversion functions.
2. Add selected component allowlist.
3. Add fixtures from representative WorkEasy JSON records.
4. Generate `MotionComponent` objects and manifests.
5. Add web library UI metadata for source/category/parameter count.
6. Wire WorkEasy components into recommendation results.
7. Verify preview, edit, and export with at least one button, one card, and one checkbox.
8. Expand to the full curated set of 20.

## Non-Goals

- No full merge of WorkEasy UI into `ai-motion-tool`.
- No modification of the `jdc-WorkEasy` repository.
- No all-component import in Phase 1.
- No React/TSX parameter editing in Phase 1.
- No runtime execution of untrusted component JavaScript beyond the existing iframe sandbox policy.
- No AI-generated confirmed params without deterministic validation.

## Open Product Follow-Ups

These are deliberately not required for Phase 1:

- Rank components by visual diversity.
- Generate preview thumbnails or recordings.
- Add WorkEasy's animation complexity as recommendation scoring input.
- Add React/TSX component-lite support.
- Build a sync script that refreshes selected components from WorkEasy.
