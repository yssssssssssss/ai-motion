# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

pnpm monorepo (`pnpm-workspace.yaml`: `apps/*` + `packages/*`). Node ≥20, pnpm 9.12.1 pinned via `packageManager`. ESM only (`"type": "module"`).

Three independent product lines share `packages/core` and `packages/components-builtin`, but each app is a **separate Vite + React 19 + TypeScript 5.8 build with its own port and its own SSR production server**:

- **`apps/web` (`@motion-tool/web`)** — research-oriented professional motion editor. Component library + brief→intent→generation pipeline. Default Vite port (5175/5174, lifecycle managed by `scripts/dev-server.mjs`). Backed by `packages/core` (orchestrator/manifest/generation/export, ~2200 LOC under `src/orchestrator`).
- **`apps/motion-lens` (`@motion-lens/app`)** — design-review module for spotting motion opportunities on static designs. Port **5176**. Backed by `packages/motion-lens-core` + `packages/motion-knowledge`. Boundary documented in `docs/motion-lens-module-boundary.md`.
- **`apps/motion-copilot` (`@motion-copilot/app`)** — lightweight composition-style motion authoring (layers + timeline + 21 atomic presets, AI draft via LLM). Port **5177**. Backed by `packages/motion-copilot-core` (composition / preset / intent / runtime / schema / frameMorph / guideline / export).

When changing functionality, identify which line you're in first — they have different mental models, different APIs, and different test suites. Cross-line work is rare and should be questioned.

## Commands

Root-level (run from monorepo root):

```bash
pnpm dev               # web dev server, managed lifecycle (start/stop/restart/status via dev-server.mjs)
pnpm test              # recursive: every package's vitest run
pnpm typecheck         # recursive: every package's tsc --noEmit
pnpm build             # recursive build
pnpm lint              # eslint .
pnpm format            # prettier --write .
pnpm check:circular    # madge circular check on core/components-builtin/web src
```

Per-line shortcuts (don't run `pnpm test` at root just to test one line — it's much slower):

```bash
pnpm motion-lens:dev | :test | :typecheck | :build
pnpm motion-copilot:dev | :test | :typecheck | :build
```

Single-package operations (use `--filter` for anything finer):

```bash
pnpm --filter @motion-copilot/core test
pnpm --filter @motion-tool/web typecheck
```

Run a single test file or a single test name (vitest runs in non-watch mode here):

```bash
pnpm --filter @motion-copilot/core test -- src/intent/generateCompositionDraftLLM.test.ts
pnpm --filter @motion-tool/web test -- -t "candidate selection"
```

Production server (every app builds both `dist/` static and `dist-server/` SSR bundle):

```bash
pnpm --filter @motion-copilot/app build && pnpm --filter @motion-copilot/app start
```

Motion-skill / asset pipelines (only touch when working on those areas):

- `pnpm motion:compile` — compile `motion-skills/` (recipe packs + `registry.json` + `lock.json`)
- `pnpm gen:workeasy` / `pnpm gen:workeasy:check` — regenerate `apps/web/src/data/workeasyComponents.generated.ts` and verify it's clean
- `pnpm motion-copilot:morph` — frame-morph asset generation (`scripts/motion-copilot-morph.mjs`)
- `pnpm verify:*` — visual / embed / cross-frame regression checks under `scripts/verify-*.mjs`
- `pnpm deploy:cloud` — rsync + remote start; targets `root@45.205.27.116`, ports 4173 (web) + 5176 (motion-lens). Don't run without confirmation.

## Architecture conventions that span multiple files

**Vite + SSR build, dev plugin = production server.** Every app uses the same pattern:
- `vite.config.ts` registers a `configureServer` plugin that exposes `/api/...` middlewares by `ssrLoadModule`-ing handlers in `src/dev-api/`.
- `package.json` build = `vite build && vite build --ssr src/server/startProductionServer.ts --outDir dist-server`.
- `src/server/productionServer.ts` exports a `createXxxProductionServer({distDir, modelConfig})` factory; `startProductionServer.ts` wires env and listens.
- Each `dev-api` handler is a `createXxxHandler(config)` factory shared by both dev plugin and production server — **do not duplicate logic between dev and prod paths**.

**LLM access is server-side only.** The browser never sees `OPENAI_API_KEY`. All apps proxy through their own `/api/.../generate` or `/api/.../analyze` endpoints with `text.format.json_schema strict: true` against the OpenAI `/responses` endpoint. Failures must degrade to a deterministic local fallback without breaking the UI state.

**Env source-of-truth is `apps/web/.env.local`.** `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_GENERATION_MODEL` (default `gpt-5.5` — JD Cloud `modelservice.jdcloud.com`). `motion-copilot` and `motion-lens` parse this same file via relative path — don't introduce per-app env files unless you explicitly want to fork the config.

**Generation pipelines have a shared shape.** Whether it's web's `briefParse → recommendComponents → createGenerationPlan → generateReferenceGuidedComponent` or copilot's `prompt → LLM plan → assembleDraftFromSpecs`, the structure is: parse intent (schema-validated) → score/select candidates → assemble into a domain object → run a validation gate → degrade to a local rule-based fallback on any failure. **The LLM only replaces the "intent extraction / candidate ranking" step; the assembly logic is deterministic and shared between LLM and fallback paths.** See `packages/motion-copilot-core/src/intent/generateCompositionDraft.ts` (`assembleDraftFromSpecs`) for the canonical pattern.

**Motion components are manifest-driven.** A `MotionComponent` carries a `MotionManifest` (params + targets + layers + readiness checks); `analyzeGenerationReadiness` gates whether AI can touch it; `derivePlusControls` projects user-facing controls. Recommendation/matching combines `searchProfile` (TF×IDF over manifest+source) and `semanticProfile` (role/scene/intent facets). Built-in components live under `packages/components-builtin/<id>/` with HTML/CSS/JS source + `motion.manifest.json`.

**Motion skills are a separate concept.** `motion-skills/` (root) holds recipe packs (one folder per skill, each with `manifest.json`/`skill.md`/`tokens.json`), indexed by `registry.json` and pinned by `lock.json`. Compiled by `scripts/compile-motion-skills.mjs`. These are referenced from `packages/core/src/motionSkill/` but live outside the package so they can be edited and reviewed as content, not code.

## Style / quality

- Prettier: `printWidth: 110`, `singleQuote: false`, `semi: true`, `trailingComma: "none"`, `arrowParens: "always"`.
- ESLint flat config in `eslint.config.js`; React 19 + react-hooks + typescript-eslint.
- Husky pre-commit runs `lint-staged`: ESLint+Prettier on TS/TSX, Prettier on json/md/css/yml.
- Tests live next to source (`*.test.ts(x)`); React component tests use `happy-dom` (`@vitest-environment happy-dom` per-file pragma).
- Don't introduce new env files, new ports, or new build entrypoints without explicit reason — the three-line layout above is intentional.
