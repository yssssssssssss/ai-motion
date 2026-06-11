# Reference-Guided Code Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "自然语义生成" create a new source-code component from semantic intent and reference examples, instead of returning a search-like controlled patch.

**Architecture:** Add a reference-guided generation core that parses the brief, accepts an optional model-generated HTML/CSS/JS source draft, validates semantic coverage, and returns a generated component. If the model draft is missing, slow, unsafe, or semantically incomplete, the core falls back to the deterministic source builder. Retrieved components are reference context only.

**Tech Stack:** TypeScript, React, Vite, Vitest, existing `MotionComponent`, `MotionManifest`, `recommendComponents`, `validateGeneratedComponent`, `loadControlledGenerationCandidates`.

---

## File Structure

- Create `packages/core/src/generation/semanticIntent.ts`
  - Parses diverse natural language into a bounded generation intent.
- Create `packages/core/src/generation/referenceGuidedGeneration.ts`
  - Builds a new generated component from intent and reference components.
- Create `packages/core/test/referenceGuidedGeneration.test.ts`
  - Locks the example brief and safety behavior.
- Modify `packages/core/src/index.ts`
  - Exports the new generation APIs.
- Create `apps/web/src/dev-api/referenceGuidedGenerationRoute.ts`
  - API boundary for reference-guided generation and optional OpenAI source draft generation.
- Create `apps/web/src/dev-api/referenceGuidedGenerationRoute.test.ts`
  - Route success and malformed request tests.
- Create `apps/web/src/services/referenceGuidedGenerationClient.ts`
  - Thin fetch wrapper for the new route.
- Modify `apps/web/src/routes/HomeRoute.tsx`
  - Natural semantic generation calls the new route after loading Top 3 reference candidates.
- Modify `apps/web/vite.config.ts`
  - Registers `/api/generation/reference-guided`.
- Modify `apps/web/src/server/productionServer.ts`
  - Registers the route for production preview.

## Tasks

### Task 1: Intent Parser

- [ ] Add `SemanticGenerationIntent` with role, colors, effects, direction, trigger, speed, text, and raw fields.
- [ ] Parse Chinese and English aliases for button/card/text, red/blue/purple, bounce/elastic/slide, and left-to-right directions.
- [ ] Add tests for the example brief.

### Task 2: Generated Component Builder

- [ ] Generate fresh source files for the button V1.
- [ ] Include editable CSS variables and manifest params for background color, duration, easing, travel distance, bounce intensity, and label.
- [ ] Include replay/pause/seek protocol in `source/script.js`.
- [ ] Validate semantic coverage before returning success.

### Task 3: API Route

- [ ] Add `/api/generation/reference-guided`.
- [ ] Validate request shape: non-empty brief and reference components array.
- [ ] Optionally request an OpenAI source draft using `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_GENERATION_MODEL`.
- [ ] Bound model generation latency and fall back to deterministic source when the model path fails.
- [ ] Return 200 with generated component on success.
- [ ] Return 422 with missing semantic coverage on invalid generation.

### Task 4: Frontend Wiring

- [ ] Add `generateReferenceGuidedComponent()` client.
- [ ] Change generation mode to submit hydrated Top 3 references to the new route.
- [ ] Keep controlled generation code available for future "受控改款" use.

### Task 5: Verification

- [ ] Run core reference generation tests.
- [ ] Run web route/client tests.
- [ ] Run typecheck for touched workspaces.
- [ ] Manually verify the example brief produces a generated red bouncing button moving left to right.

## Acceptance Criteria

- The example brief does not select `workeasy-checkboxes-29-checkbox` as a base component.
- The generated component source contains button markup, red color, bounce keyframes, and left-to-right motion.
- The generated manifest exposes editable params that target generated source.
- Unsafe generated source is rejected.
- No-op generation is rejected.
- Valid model source drafts are used only after validator and semantic coverage gates pass.
- Slow or invalid model source drafts fall back to deterministic generation.
- The editor opens the generated draft without saving it directly into the library.
