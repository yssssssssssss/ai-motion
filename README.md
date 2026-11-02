# ai-motion-web

Motion component editing, generation, preview, and export. This is the renamed original `ai-motion` repository; existing Git history and branches are retained.

## Applications

- `apps/web`: professional motion editor, backed by `packages/core`, `packages/components-builtin`, and `motion-skills/`.
- `apps/motion-copilot`: composition-based motion authoring, backed by `packages/motion-copilot-core`.

Motion Lens and its two packages have moved to the independent sibling repository `../ai-motion-lens`. This repository does not need Lens installed or running.

## Development

Use Node 20.19+ (or Node 22.12+) and pnpm 9.12.1. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm dev:status
pnpm dev:stop
```

Web uses port 5175 by default. Existing server-only model configuration remains in `apps/web/.env.local`; Motion Copilot continues to use the same configuration.

```bash
pnpm --filter @motion-tool/web typecheck
pnpm --filter @motion-tool/web test
pnpm --filter @motion-tool/web build
pnpm start
```

The production Web server defaults to port 4173. Motion Copilot remains available through `pnpm motion-copilot:dev`, `:test`, `:typecheck`, and `:build`, on its existing port 5177.

## Deployment

`pnpm prepare:joyapp` prepares the Web release locally. `pnpm deploy:cloud` deploys Web only, in `/opt/ai-motion-web`. Run remote deployment only when explicitly requested. Lens has its own deployment commands in its own repository.

See [the split record](docs/project-split.md) for migration and Git details, and [AGENTS.md](AGENTS.md) for engineering instructions.
