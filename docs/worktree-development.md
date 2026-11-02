# Independent development in Orca

The repository contains separate applications. Each worktree checks out the complete monorepo, while its feature branch and agent session focus on one application.

| Application        | Scope                                                      | Development | JoyApp appCode  |
| ------------------ | ---------------------------------------------------------- | ----------- | --------------- |
| Main motion editor | `apps/web`, `packages/core`, `packages/components-builtin` | `pnpm dev`  | `ai-motion-web` |

Motion Lens lives in the sibling repository `../ai-motion-lens` (see `docs/project-split.md`); develop and package it there.

## Create a task

1. In Orca, use **Create new worktree** under the `ai-motion-web` project.
2. Select the reviewed common baseline in **Branch from**. Check this explicitly: the default may be `origin/main` and may omit local commits.
3. Give the worktree a task name. Under **Advanced**, use a feature branch such as `feat/web-editor-improvements`.
4. Use a full checkout and run `pnpm install --frozen-lockfile`. Wait for installation before starting the agent.
5. State the application scope and JoyApp appCode in the session's first instruction. Each worktree needs its own session; extra tabs in one worktree share its files.

The **Parent worktree** setting only changes sidebar nesting. It does not select the Git baseline. Uncommitted files in another worktree are not copied.

## Local configuration

`apps/web/.env.local` is the existing central model configuration and is ignored by Git. A new worktree must receive server environment variables or a local link to that central file. Keep one configuration source and never commit keys. A link depends on the original file remaining available.

The main application uses the existing managed development server (normally port 5175, with the documented 5174 alternative). Check existing listeners before starting another instance of the same application. Do not stop another worktree's server without checking its owner.

## Verify and release

For the main application:

```bash
pnpm --filter @motion-tool/web test
pnpm --filter @motion-tool/web typecheck
pnpm --filter @motion-tool/web build
```

Also test changed dependency packages, including `@motion-tool/core` and `@motion-tool/components-builtin` when applicable.

Package only the intended application:

`dist/` and `dist-server/` are generated and ignored by Git. Build before starting a production server; do not add generated bundles to feature commits.

- Main: `node scripts/prepare-web-joyapp.mjs`, deployed to appCode `ai-motion-web` at `https://ai-motion.joyapp.jd.com`.

The packaging commands build local artifacts; deployment is a separate action. A branch or worktree name does not determine which application is deployed.

After a task passes review, merge its commits into the common integration branch. Start the next feature from that updated baseline rather than maintaining permanently divergent product branches. Before removing a finished worktree, save its uncommitted changes and confirm its commits are retained.
