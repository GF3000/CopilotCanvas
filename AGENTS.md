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
7. **Keep `docs/TASKS.md` updated.** Set your task to `in-progress` before starting,
   move it to `in-review` / `done` as it progresses, and keep the task description
   accurate when scope changes.

## Getting started (Day-1 checklist)

New here? Do this in order:

1. **Read this file** (`AGENTS.md`) fully, then skim `docs/PROJECT_BRIEF.md` and
   `docs/ARCHITECTURE.md` (we ship **Option 3**, ADR-007: Copilot CLI in VS Code's
   integrated terminal is the brain; a thin extension renders the canvas as a
   webview tab).
2. **Clone & verify the build:** `npm install` then `npm run build && npm run lint &&
   npm test` — all should be green. `npm run dev` starts the canvas + watchers.
3. **Pick a ready task** (see below), set it to **in-progress** in `docs/TASKS.md`,
   and assign it to yourself.
4. **Open a draft PR immediately** on a branch named `<author>/<slug>` so
   others see your WIP and don't collide.
5. Implement against the contract in `/shared/protocol.ts`; self-validate against
   `docs/TEST_PLAN.md`; keep `docs/TASKS.md` updated; merge small and often.

### Pick a ready task

A task is **ready** when all the tasks that **block** it are `done`.
- Filter `docs/TASKS.md` by your component label (`canvas` / `server` / `extension`).
- Open a candidate and check its **"depends on"** tasks are all resolved.
- See `docs/TASKS.md` → *Status snapshot & what's ready now* for the current
  ready/blocked list.
- The day-1 ready set is `repo-scaffold`/`shared-protocol` (foundation), then
  `mcp-apps-host-spike`, `mcp-server`, `canvas-render` —
  one per epic, so all three streams start in parallel.

## Tech stack

- **Language:** TypeScript across the board (Node for the MCP server + VS Code
  extension, browser for the canvas webview). See `docs/DECISIONS.md` ADR-003.
- **Integration/transport:** an **MCP server** exposing an **MCP App** (SEP-1865);
  canvas ⇄ extension over **JSON-RPC `postMessage`** in a **VS Code webview tab**
  (ADR-005 + ADR-007). A raw `ws` WebSocket fallback may exist for local debugging only.
- **Rendering / host:** **Copilot CLI in VS Code's integrated terminal** is the
  brain; a **thin VS Code extension** opens the canvas as a webview tab and bridges
  the CLI session to it (ADR-007).
- **Diagrams:** Cytoscape.js interactive graph model (ADR-006). Pan/zoom, node
  tap events, highlighting and filtering are built into Cytoscape.
- **Canvas bundling:** Vite or esbuild — output a portable bundle served as the
  MCP App HTML resource.
- **Shared types:** `/shared/protocol.ts` is the canonical protocol definition;
  import it in server, canvas, and extension, never redefine message shapes.

## Project structure

```
/server     Canvas MCP server (Node/TS): tools + app resource + repo I/O
/canvas     MCP App web bundle (TS, Cytoscape, interaction loop)
/extension  VS Code extension (TS): opens the webview tab + CLI↔canvas bridge
/shared     Shared protocol types (imported by server, canvas, extension)
/docs       project documents
```

## Coding conventions

- **Language/style:** TypeScript `strict`; format with Prettier; lint with ESLint.
- **Naming:** kebab-case files; camelCase variables; PascalCase types/components.
- **Libraries to prefer:** the MCP SDK (server + Apps), Cytoscape.js, a lightweight
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

## Task tracking

Track all work in `docs/TASKS.md`. Keeping it current is **mandatory** — it is
how contributors coordinate and avoid duplicating work.

**What you must keep updated (in `docs/TASKS.md`):**
- **Claim before you start:** set your task to **in-progress** and assign it to
  yourself — so two people don't pick the same task.
- **Progress the status:** **in-progress → in-review → done** as work moves; use
  **blocked** (with a note explaining why) if you're stuck.
- **Keep the description accurate:** if scope or acceptance changes, edit the task
  to match.
- **Note meaningful events:** landing a commit/PR, decisions, hand-offs. Reference
  the commit/PR.

## Git & PR conventions

- **Branch naming:** `<author>/<slug>`, e.g. `t-gfrancogim/cytoscape-render`.
- **Commit messages:** Conventional Commits,
  e.g. `feat(canvas): render Cytoscape graph`.
- One task per PR; reference the task in the PR title.

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
- [ ] **`docs/TASKS.md` updated** — status moved to `done`, description accurate,
      commit/PR referenced (see *Task tracking*)
