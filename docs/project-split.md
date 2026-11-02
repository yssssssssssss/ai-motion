# Web / Lens repository split

The original `ai-motion` repository becomes `ai-motion-web`. Lens becomes a sibling repository named `ai-motion-lens`.

## Ownership

| Repository     | Source                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- |
| ai-motion-web  | `apps/web`, `packages/core`, `packages/components-builtin`, `motion-skills/`             |
| ai-motion-web  | Existing `apps/motion-copilot`, `packages/motion-copilot-core`, and their assets/scripts |
| ai-motion-lens | `apps/motion-lens`, `packages/motion-lens-core`, `packages/motion-knowledge`             |

The apps retain their package names, source layout, ports, API contracts, and product behavior. Each repository owns its dependency installation, lockfile, checks, configuration, and deployment scripts. No extra shared service or cross-repository source dependency is introduced.

## Git and pending work

The original repository's `.git`, branches, commits, and existing worktrees are retained. Renaming its main directory requires `git worktree repair` so linked worktrees can find the relocated Git directory.

The Lens repository imports the Lens-related history from `codex/motion-copilot-high-fidelity-editing` at `67d11516c07056ee1f41270d9b93bbd82ab0b2ab`, then carries over the Lens source and pending changes from the original working directory. Its `.git` is independent; it is not a worktree of Web.

The `fix/server-and-export-safety` branch and its existing worktree are retained in Web. Splitting the repositories does not merge those independent feature/fix commits into the current branch. A separate branch merge remains possible after reviewing that work.

Before migration, a local backup saved all Git refs in a verified bundle, the original Git metadata, tracked changes, untracked files, and a source checksum manifest. The backup is outside both repositories. Existing local credentials are retained in ignored environment files and must never be committed.

## Configuration

Web and Motion Copilot retain `apps/web/.env.local`. Lens now reads `apps/motion-lens/.env.local` in its own repository. Each app also accepts injected environment variables; browser bundles do not receive API keys.

The previous `AGENTS.md` / `CLAUDE.md` convention making Web's environment the source for all three apps is updated accordingly. Separating configuration is intentional for this repository split.

## Deployment and remote repositories

Cloud deployment scripts target separate directories: `/opt/ai-motion-web` and `/opt/ai-motion-lens`. Existing remote deployments are not changed by the local migration. Any future deployment must be requested explicitly.

The existing Web Git remote remains the original `ai-motion` remote so no hosted repository is renamed or lost implicitly. Lens has no remote until a separate hosted repository is configured. A local directory rename does not rename a GitHub repository.

## Working after the rename

Open `ai-motion-web` and `ai-motion-lens` as separate projects in Orca. Existing sessions may still display their original path until reopened. A compatibility symlink at the old `ai-motion` path preserves existing sessions and tools during the transition; the actual project directory is `ai-motion-web`.

Run installation, tests, typechecks, and builds from each repository's root. Do not combine the two repositories into one pnpm workspace.
