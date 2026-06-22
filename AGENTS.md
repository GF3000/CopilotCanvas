# Agent Instructions

> Conventions and rules for the AI agents implementing this project. Keep this
> tight — every agent reads it before writing code. (Also discoverable by tools
> that look for `AGENTS.md`.)

## Golden rules

1. Read `docs/PROJECT_BRIEF.md`, `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`,
   and `docs/DATA_MODEL.md` before writing code.
2. Implement exactly one task from `docs/TASKS.md` per pull request.
3. Do not change data shapes or API contracts without updating `docs/DATA_MODEL.md`.
4. Stay in scope — respect the "Out of scope" section of the brief.
5. Self-validate against `docs/TEST_PLAN.md` before declaring a task done.
6. **Commit and push often** — many agents work in parallel; integrate small
   changes frequently and rebase on the latest `main` (see *Collaboration* below).

## Tech stack

- **Language:** TypeScript across the board (Node for the MCP server, browser for
  the canvas). See `docs/DECISIONS.md` ADR-003.
- **Integration/transport:** an **MCP server** exposing an **MCP App** (SEP-1865);
  canvas ⇄ model over **JSON-RPC `postMessage`** in the host's sandboxed iframe
  (ADR-005). A raw `ws` WebSocket fallback may exist for local debugging only.
- **Diagrams:** Mermaid (ADR-002). Pan/zoom via svg-pan-zoom or equivalent.
- **Canvas bundling:** Vite or esbuild — output a portable bundle served as the
  MCP App HTML resource.
- **Shared types:** `/shared/protocol.ts` is the canonical protocol definition;
  import it in both server and canvas, never redefine message shapes.

## Project structure

```
/server     Canvas MCP server (Node/TS): tools + app resource + repo I/O
/canvas     MCP App web bundle (TS, Mermaid, pan/zoom)
/shared     Shared protocol types (imported by server + canvas)
/docs       project documents
```

## Coding conventions

- **Language/style:** TypeScript `strict`; format with Prettier; lint with ESLint.
- **Naming:** kebab-case files; camelCase variables; PascalCase types/components.
- **Libraries to prefer:** the MCP SDK (server + Apps), Mermaid, a lightweight
  bundler (Vite/esbuild). `ws` only for an optional local-debug fallback.
- **Libraries to avoid:** heavyweight frameworks for the canvas; anything that
  binds the server to a non-loopback interface.
- **Comments:** explain *why*, not *what*; comment only non-obvious code.

## Build / run / test commands

```bash
# install
npm install

# run (dev) — starts the canvas + skill server
npm run dev

# build (canvas bundle must build)
npm run build

# test
npm test

# lint
npm run lint
```

## Git & PR conventions

- **Branch naming:** <e.g. t-gfrancogim/<task-id>-<slug>>
- **Commit messages:** <e.g. Conventional Commits>
- One task per PR; reference the task ID in the PR title.

## Collaboration: commit & push often

Many people and agents work on this repo **simultaneously**, so integrate
constantly to avoid painful merge conflicts and duplicated work.

- **Commit early and often** — make small, atomic commits for each logical step
  rather than one giant commit at the end. A good rule: if it builds, commit it.
- **Push at least every ~30 minutes** of work, and always before stepping away —
  never sit on unpushed local commits.
- **Pull/rebase before you start and before every push** so you build on the
  latest `main`. Prefer `git pull --rebase` to keep history linear.
- **Keep branches short-lived.** Open a PR as a **draft** as soon as you start so
  others can see work-in-progress and avoid colliding with you.
- **Keep PRs small.** Smaller diffs merge faster and conflict less. Split large
  tasks rather than letting a branch grow stale.
- **Merge to `main` quickly** once a task passes its checks; don't let approved
  branches linger.
- **Resolve conflicts immediately** when a pull surfaces them — don't let them
  accumulate.
- **Communicate ownership** via `docs/TASKS.md` (set status to `in-progress`)
  before you start, so two agents don't pick the same task.

## Definition of done

- [ ] Acceptance criteria for the task are met
- [ ] Tests added/updated and passing
- [ ] Lint passes
- [ ] Relevant docs updated
