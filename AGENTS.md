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
7. **Keep Jira (KAN) updated — mandatory.** You **must** have the Atlassian (Jira)
   MCP toolset connected and use it to keep the board in sync (see *Jira tracking*
   below). Set your task to `In Progress` before starting, move it to `In Review` /
   `Done` as it progresses, and keep the task description accurate when scope
   changes. Work that isn't reflected on the board is not considered done.

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

## Jira tracking (mandatory)

The team tracks all work on the Jira **KAN** board
(`https://microsoft-team-canvas.atlassian.net`, project key **KAN**, cloudId
`e8a1bb51-d1ab-417f-999a-647b8b4f2186`). Keeping it current is **mandatory** — it is
how 6 people across 3 time zones coordinate.

**Required setup — connect the Atlassian (Jira) MCP toolset.** Every agent/contributor
**must** have the official Atlassian Rovo MCP server registered before starting work.
Add it to your MCP client config (for Copilot CLI, `~/.copilot/mcp-config.json`):

```json
{
  "mcpServers": {
    "atlassian": {
      "type": "http",
      "url": "https://mcp.atlassian.com/v1/mcp",
      "tools": ["*"]
    }
  }
}
```

Restart the client and complete the OAuth 2.1 sign-in to `microsoft-team-canvas`.
If the org has Rovo / Remote MCP disabled, an admin must enable it first.

**What you must keep updated (using the Jira MCP tools):**
- **Claim before you start:** move your task to **In Progress** and assign it to
  yourself — so two people don't pick the same task.
- **Progress the status:** **In Progress → In Review → Done** as work moves; use
  **Blocked** (with a comment explaining why) if you're stuck.
- **Keep the description accurate:** if scope or acceptance changes, edit the task
  description to match — the board must reflect reality.
- **Comment on meaningful events:** landing a commit/PR, decisions, hand-offs.
  Reference the commit/PR and the Jira key.
- **Mirror `docs/TASKS.md`:** the board and `docs/TASKS.md` must stay in sync.

Work that isn't reflected on the board is **not considered done**.

## Git & PR conventions

- **Branch naming:** `<author>/<jira-key>-<slug>`, e.g. `t-gfrancogim/KAN-12-cytoscape-render`.
- **Commit messages:** Conventional Commits, referencing the Jira key,
  e.g. `feat(canvas): render Cytoscape graph (KAN-12)`.
- One task per PR; reference the Jira key in the PR title.

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
- [ ] **Jira (KAN) task updated** — status moved to `Done`, description accurate,
      commit/PR referenced (see *Jira tracking*)
