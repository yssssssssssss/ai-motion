# MotionLens

MotionLens is a separate module from Motion Copilot. It focuses on designer review for static drafts: annotations, rationale, recommended motion parameters, preview, and review JSON handoff.

## Current P0 Capability

- Fixture-backed analysis for six draft archetypes.
- Real PNG/JPG/WebP upload.
- AI analysis for uploaded images through the local Vite API proxy when `OPENAI_API_KEY` is configured.
- Manual drag-to-box annotation for uploaded images.
- Ranked motion opportunities from fixture or marked elements.
- No-motion suggestions for decorative, ambiguous, or stable navigation elements.
- Motion parameter preview for supported opportunity roles.
- MotionLens review JSON export/import, including optional embedded uploaded image data.
- Vision candidate schema and validation in `@motion-lens/core`.

## Honest Boundary

The browser app does not receive API keys. Uploaded-image AI analysis is proxied through `/api/motion-lens/analyze` in the MotionLens Vite server. The proxy reuses the project model default `gpt-5.5` through `OPENAI_GENERATION_MODEL` or the built-in fallback default. If `OPENAI_API_KEY` is missing, the API returns an explicit fallback Blueprint.

## Packages

- `apps/motion-lens`: Vite/React review workspace.
- `packages/motion-lens-core`: rules, schemas, fixture analysis, vision candidate validation, document import/export.

## Local Commands

```bash
pnpm --filter @motion-lens/app dev
OPENAI_API_KEY=... pnpm --filter @motion-lens/app dev
pnpm --filter @motion-lens/core test
pnpm --filter @motion-lens/app test
pnpm --filter @motion-lens/core typecheck
pnpm --filter @motion-lens/app typecheck
```

## Review JSON

Exports use this envelope:

```json
{
  "version": "0.1",
  "kind": "motionlens-review",
  "generatedAt": "2026-06-11T00:00:00.000Z",
  "blueprint": {},
  "assets": {
    "imageDataUrl": "data:image/png;base64,..."
  }
}
```

The importer also accepts legacy payloads containing `{ "blueprint": ... }`.
