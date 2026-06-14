# @motion-lens/core

Small rule engine for MotionLens.

It deliberately keeps AI vision behind a narrow boundary:

- `visionCandidateJsonSchema` describes the candidate JSON a model must return.
- `candidatesToElements` validates, clamps, and drops invalid candidates.
- `createBlueprintFromVision` returns fallback output unless both `apiKey` and an injected `analyzer` are provided.

The package does not own network calls or provider SDKs. `apps/motion-lens` provides the current Vite API proxy and reuses the project default `gpt-5.5` model, while this package keeps model output validation and Blueprint rules provider-agnostic.
