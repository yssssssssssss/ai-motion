# Main application

This is the original motion editor (`@motion-tool/web`), independently deployed from Motion Lens.

- Scope: `apps/web`, `packages/core`, and `packages/components-builtin`. Inspect dependents before changing shared files.
- Run commands from the repository root: `pnpm dev`, `pnpm --filter @motion-tool/web test`, `pnpm --filter @motion-tool/web typecheck`, and `pnpm --filter @motion-tool/web build`.
- When changing core or built-in components, also test the affected package.
- JoyApp packaging: `node scripts/prepare-web-joyapp.mjs`.
- JoyApp appCode: `ai-motion-web`; domain: `https://ai-motion.joyapp.jd.com`.
- Read model configuration from `apps/web/.env.local` or server environment variables; never commit credentials.

See `docs/worktree-development.md` for the independent development workflow.
