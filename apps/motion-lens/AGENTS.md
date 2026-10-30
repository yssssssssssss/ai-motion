# Motion Lens

This is the design review application (`@motion-lens/app`), independently deployed from the original motion editor.

- Scope: `apps/motion-lens`, `packages/motion-lens-core`, and `packages/motion-knowledge`.
- Run commands from the repository root: `pnpm motion-lens:dev`, `pnpm motion-lens:test`, `pnpm motion-lens:typecheck`, and `pnpm motion-lens:build`.
- JoyApp packaging: `node scripts/prepare-motion-lens-joyapp.mjs`.
- JoyApp appCode: `ai-motion-lens`; domain: `https://ai-motion-lens.joyapp.jd.com`.
- Model configuration comes from `apps/web/.env.local` or server environment variables. The configuration path does not make the main application's UI part of this task.
- Keep the review and parameter preview boundary documented in `docs/motion-lens-module-boundary.md`.

See `docs/worktree-development.md` for the independent development workflow.
