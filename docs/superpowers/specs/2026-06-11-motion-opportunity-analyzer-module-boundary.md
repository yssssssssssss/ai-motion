# Motion Opportunity Analyzer Module Boundary

Date: 2026-06-11
Status: Decision
Scope: Product/module boundary for future Motion Opportunity Analyzer work

## Decision

Keep the existing `motion-copilot` app as an independent feature module.

Future Motion Opportunity Analyzer work should not be merged directly into the current `motion-copilot` page or mutate it into a combined analyzer/editor workspace. Instead, create a new module by copying the existing Motion Copilot app/core as a starting point, then evolve that copied module for the analyzer workflow.

## Rationale

The existing Motion Copilot already has a clear product shape:

```text
prompt
-> MotionDocument
-> canvas/editor
-> guideline suggestions
-> export
```

The analyzer has a different upstream workflow:

```text
design draft upload
-> element/opportunity analysis
-> Motion Blueprint
-> selected opportunity
-> generated motion preview
-> export
```

Combining both flows in one page would overload the current editor and blur the source-of-truth boundary between `MotionDocument` and `MotionBlueprint`.

## Future Module Shape

Use a copied Motion Copilot module as the implementation base.

Recommended future names:

```text
apps/motion-opportunity-copilot
packages/motion-opportunity-core
```

The copied module may keep compatible pieces from Motion Copilot:

- `MotionDocument` editing concepts
- canvas preview
- layer controls that still apply
- guideline suggestions
- HTML/CSS export

The copied module should add analyzer-specific concepts:

- uploaded design source
- detected design elements
- Motion Blueprint
- ranked opportunity list
- blueprint overlay
- opportunity-to-motion handoff

## Integration Boundary

The original `apps/motion-copilot` remains stable and independent.

The new analyzer module may share code later only through explicit package extraction. Do not share by reaching across app directories.

Acceptable future extraction points:

- common MotionDocument schema helpers
- common export runtime
- common guideline evaluator
- common UI primitives if a design-system package exists

Avoid:

- importing app components across app boundaries
- adding analyzer state to the existing Motion Copilot app
- extending the current editor with upload/blueprint-specific panels
- changing current Motion Copilot behavior just to support analyzer experiments

## Implementation Implication

The first analyzer implementation task should begin with a controlled copy:

```text
copy apps/motion-copilot -> apps/motion-opportunity-copilot
copy packages/motion-copilot-core -> packages/motion-opportunity-core
rename package names and imports
verify copied app builds unchanged
then add analyzer features on top
```

This gives the analyzer freedom to diverge while preserving the existing Motion Copilot product as a known-good module.
