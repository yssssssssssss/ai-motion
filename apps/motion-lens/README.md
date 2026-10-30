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

## JoyApp Deployment

From the repository root, prepare a standalone release:

```bash
node scripts/prepare-motion-lens-joyapp.mjs
```

The command builds Motion Lens and prints a temporary `projectDir` for `imagination_deploy`.
The release contains the client assets and a Node 22 server with no runtime npm dependencies.
A CommonJS launcher accommodates the platform's injected SSO guard; the business bundle remains ESM.

Deploy with `appCode: "ai-motion-lens"`, `mode: "local"`, `withGuard: true`, and
`startCmd: "node server/index.js"`. Updates reuse this appCode and omit `domainPrefix`.
The business server reads `PORT`; the guard owns 8080 and assigns the business port.
Slow analysis responses send JSON whitespace every 15 seconds to keep the platform gateway active;
clients still consume a single complete JSON response.

Pass `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_GENERATION_MODEL` through `deployEnv`.
The source configuration remains `apps/web/.env.local`; do not copy that file into the release.
MCP deployment authentication is separate: a valid web login credential can be configured through
`JOYCODE_PTKEY` and `JOYCODE_LOGIN_TYPE` in the MCP environment without installing the JoyCode IDE.

Application: https://ai-motion-lens.joyapp.jd.com

Portal: https://w10zglzij6rw.joyapp.jd.com/app/ai-motion-lens/

First-time domain routing may take time to become reachable after `DeploySuccess`.
Verify the actual page and API before treating the deployment as complete.
