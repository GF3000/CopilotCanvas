# Tasks

> The hand-off to AI agents. Small, ordered, independently-implementable items —
> one focused PR each. Reference the requirement(s) each satisfies.
>
> **The Jira KAN board is the live source of truth for status & ownership; this
> file mirrors it.** Each task below lists its **KAN key**. Claim a task on the
> board (set it **In Progress** + assign yourself) before you start — see
> `AGENTS.md` → *Jira tracking*.

## Conventions

- **ID:** kebab-case, descriptive; each maps to a **KAN-N** issue on the board.
- **Status:** `todo` | `in-progress` | `in-review` | `done` | `blocked`
  (mirrors Jira To Do / In Progress / In Review / Done / Blocked). Statuses in this
  doc are a **snapshot** — the board is authoritative.
- **Size:** one PR. Split if larger.
- **Tags/labels:** every task carries a `canvas` / `server` / `extension` label on
  the board (foundation tasks carry all three).

## Epics & ownership (3-day plan)

Three epics, one per location (*proposed, changeable* — see `PROJECT_BRIEF.md`).
Mirror these tasks on the Jira **KAN** board and keep both in sync. Target
**feature-complete by end of Wednesday**; Thursday is for the demo video.

| Epic | Owner | Tasks (KAN keys) |
|------|-------|-------|
| **Frontend / Canvas UI** (`/canvas`) | **US (3p)** | `canvas-render` (KAN-6), `node-selection` (KAN-7), `expand-node` render (KAN-11), `live-update` render (KAN-13) |
| **MCP logic / tools** (`/server`) | **Dublin (2p)** | `mcp-server` (KAN-9), `create_diagram` (KAN-19), `explain-node` (KAN-8), `expand-node` (KAN-11), `node-code-refs` (KAN-12), `modify-from-node` (KAN-10) |
| **VS Code extension / bridge** (`/extension`) | **India (1p)** | `mcp-apps-host-spike` (KAN-16), `vscode-extension` (KAN-17), `mcp-app-launch` (KAN-18), `live-update` (KAN-13), `multi-host-validation` (KAN-15), `diagram-edit-to-code` (KAN-14) |
| **Shared kick-off** (do first, together) | All | `repo-scaffold` (KAN-5), `shared-protocol` (KAN-4) |

> `shared-protocol` is the cross-epic contract — land it early on day 1 so all
> three streams can build against stable types. The **architecture is Option 3**
> (ADR-007): Copilot CLI in VS Code's integrated terminal is the brain; the
> extension renders the canvas as a webview tab and bridges CLI ⇄ canvas.

## Status snapshot & what's ready now

_As of the example-diagram + create_diagram prototype landing (keep in sync with the board):_

- ✅ **Done:** `repo-scaffold` (KAN-5) — monorepo builds green; F5 dev loop verified.
- 🔵 **In review:** `shared-protocol` (KAN-4) — contract compiles; ratify at the
  16:30 sync, then → Done. `mcp-apps-host-spike` (KAN-16) — relay proven (Pattern 1).
  `create_diagram` (KAN-19) — tool built on the prototype.
- 🟢 **Ready to start now** (dependencies satisfied): `mcp-server` (KAN-9),
  `canvas-render` (KAN-6), `vscode-extension` (KAN-17). The prototype already seeds
  all three, so each epic can begin immediately.
- ⛔ **Blocked (waiting):** everything downstream of `mcp-app-launch` (KAN-18, the
  Goal-1 integration) — see the dependency links on the board or the graph below.

> Find ready tasks on the board with JQL:
> `project = KAN AND statusCategory != Done AND issueLinkType is EMPTY` — or simply
> open a task and check its **"is blocked by"** links are all Done.

---

## Phase 0 — Scaffold

### `repo-scaffold` — KAN-5
- **Status:** done · **Satisfies:** ARCHITECTURE (folder structure), NFR-3
- **Description:** Create the monorepo skeleton: `/server`, `/canvas`, `/extension`,
  `/shared`. Init TypeScript, package.json(s), a bundler for `/canvas` (Vite or
  esbuild), a VS Code extension skeleton in `/extension`, and lint/test config. Add
  `npm run dev`, `build`, `lint`, `test` scripts even if minimal.
- **Depends on:** none
- **Acceptance:** `npm install`, `npm run build`, `npm run lint`, `npm test` all
  run successfully (tests may be trivial); the extension skeleton activates in VS Code.

### `shared-protocol` — KAN-4
- **Status:** in-review · **Satisfies:** DATA_MODEL
- **Description:** Implement `/shared/protocol.ts` — the discriminated-union
  message types and entity interfaces (DiagramState, NodeMeta, CodeRef, Selection,
  all S→C and C→S messages) exactly as defined in `DATA_MODEL.md`. Export from
  server, canvas, and extension.
- **Depends on:** repo-scaffold
- **Acceptance:** types compile and are importable from `/server`, `/canvas`, and
  `/extension`; a type-level test asserts every `type` value is covered.

### `mcp-apps-host-spike` — KAN-16
- **Status:** todo · **Satisfies:** ADR-007 (risk), NFR-3
- **Description:** **Day-1 de-risking spike.** Stand up a trivial Canvas MCP server
  and (a) confirm how a VS Code webview hosts the MCP Apps `postMessage` channel, and
  (b) prove the **server ↔ extension relay**: a diagram emitted by a Copilot-CLI-driven
  tool reaches the extension's webview. Decide extension-embeds-server (in-process)
  vs. local channel. Optionally check whether the standalone CLI renders an MCP App
  at all (informs the deferred Option 2).
- **Depends on:** repo-scaffold
- **Acceptance:** a hard-coded diagram pushed from the server appears in a VS Code
  webview tab; the relay approach is chosen and documented for the team.

---

## Phase 1 — Goal 1: Visualize (Basic)

### `mcp-server` — KAN-9
- **Status:** todo · **Satisfies:** FR-1, FR-2, NFR-1, NFR-4
- **Description:** In `/server`, implement the **MCP server** that declares the
  canvas **MCP App** HTML UI resource (MIME `text/html;profile=mcp-app`) and
  exposes a tool to push diagrams. Emit `diagram` messages (Cytoscape `elements`)
  and receive canvas events back via the extension relay. Track session state
  (current diagram, selection).
- **Depends on:** shared-protocol
- **Acceptance:** a `diagram` message sent via the server's tool reaches the
  extension; canvas events arrive back at the server.

### `vscode-extension` — KAN-17
- **Status:** todo · **Satisfies:** FR-2, NFR-1
- **Description:** In `/extension`, implement the **thin VS Code extension** that
  opens the canvas as a **webview editor tab**, loads the `/canvas` bundle, sets a
  restrictive CSP, and runs the **MCP Apps JSON-RPC `postMessage`** channel to the
  webview. Connect to the Canvas MCP server via the relay chosen in
  `mcp-apps-host-spike`.
- **Depends on:** shared-protocol, mcp-apps-host-spike
- **Acceptance:** activating the extension opens a canvas webview tab; messages
  posted to the webview arrive, and webview→extension events are received.

### `canvas-render` — KAN-6
- **Status:** todo · **Satisfies:** FR-1, FR-3
- **Description:** In `/canvas`, build the MCP App that connects to the webview
  `postMessage` channel, handles `hello`, renders an incoming `diagram`'s
  `elements` with **Cytoscape**, and provides built-in pan/zoom with a fit/reset
  control. Show a readable error for an invalid graph model.
- **Depends on:** shared-protocol
- **Acceptance:** given a `diagram` message, the Cytoscape graph renders;
  pan/zoom/reset work; a bad graph model shows an error, not a blank screen.

### `mcp-app-launch` — KAN-18
- **Status:** todo · **Satisfies:** FR-1, FR-2
- **Description:** Wire the end-to-end open: a Copilot-CLI-invoked server tool that
  generates/accepts a graph model (Cytoscape `elements`) and pushes a `diagram`,
  which the **extension renders by opening (or reusing) the canvas webview tab**.
- **Depends on:** mcp-server, vscode-extension, canvas-render
- **Acceptance:** invoking the tool from the CLI opens the canvas tab with the
  diagram; a second invocation updates the same tab in place.

### `live-update` — KAN-13
- **Status:** todo · **Satisfies:** FR-4, NFR-2, NFR-4
- **Description:** Wire live updates: new `diagram`/`patch` messages re-render the
  canvas tab in place; handle webview reload / channel re-init gracefully.
- **Depends on:** mcp-app-launch
- **Acceptance:** pushing a second diagram updates the canvas tab with no manual
  refresh; the canvas recovers if the extension reloads the webview.

> **Goal 1 done when:** FR-1..FR-4 pass (see `TEST_PLAN.md`).

---

## Phase 2 — Goal 2: Interact (Intermediate)

### `node-selection` — KAN-7
- **Status:** todo · **Satisfies:** FR-5, FR-8
- **Description:** Canvas: tapping a Cytoscape node selects it (visual state via a
  class/selector) and emits `node_selected` to the extension. Server: persist
  current `(diagramId, nodeIds)`. Ensure stable node ids survive re-render.
- **Depends on:** live-update
- **Acceptance:** clicking highlights the node and the server can read the current
  selection; selection persists across a re-render where the node still exists.

### `explain-node` — KAN-8
- **Status:** todo · **Satisfies:** FR-6, FR-8
- **Description:** Implement the `explain` interaction: the canvas sends an
  `interaction` with the selection (via the extension); server prompts Copilot with
  node context and surfaces the explanation in the CLI.
- **Depends on:** node-selection
- **Acceptance:** with a node selected, "explain this node" yields a relevant
  Copilot explanation in the CLI.

### `expand-node` — KAN-11
- **Status:** todo · **Satisfies:** FR-7
- **Description:** Implement the `expand` interaction: server regenerates a richer
  subgraph for the selected node and pushes a `diagram`/`patch`; canvas re-renders
  the expansion in place.
- **Depends on:** node-selection, live-update
- **Acceptance:** "expand this node" adds detail/subnodes for that node and the
  canvas updates in place.

---

## Phase 3 — Goal 3: Modify (Advanced)

### `node-code-refs` — KAN-12
- **Status:** todo · **Satisfies:** FR-9 (prerequisite)
- **Description:** Populate `NodeMeta.codeRefs` when generating diagrams so a node
  maps to concrete file/symbol locations; expose lookup in the server.
- **Depends on:** expand-node
- **Acceptance:** a selected node resolves to one or more real code locations.

### `modify-from-node` — KAN-10
- **Status:** todo · **Satisfies:** FR-9
- **Description:** Implement the `modify` interaction: take selected node +
  instruction, gather code context via `codeRefs`, **ask the user clarifying
  questions** in the CLI, apply the code change, then re-emit an updated `diagram`.
- **Depends on:** node-code-refs
- **Acceptance:** selecting an entrypoint node + "add a new entrypoint to do X"
  triggers clarifying questions, a real code edit, and an updated diagram.

### `diagram-edit-to-code` (stretch) — KAN-14
- **Status:** todo · **Satisfies:** FR-10
- **Description:** Allow direct diagram edits on the canvas (`diagram_edited`);
  server proposes matching code changes.
- **Depends on:** modify-from-node
- **Acceptance:** an edited node/edge produces a sensible proposed code change.

---

## Phase 4 — Stretch

### `multi-host-validation` — KAN-15
- **Status:** todo · **Satisfies:** NFR-3, ADR-007
- **Description:** **Stretch.** VS Code is the primary host. Optionally validate the
  same canvas bundle/MCP App in a second MCP host and fix host-specific
  rendering/CSP/channel-init issues. (Pure host-rendered Option 2 is the deferred
  fallback — see `mcp-apps-host-spike` and ADR-007.)
- **Depends on:** live-update
- **Acceptance:** the same `diagram` push renders and accepts interactions in a
  second host, or the limitation is documented.

---

## Dependency overview

The task graph as a Cytoscape model — each edge means "depends on completion of".

```js
const elements = [
  { data: { id: 'repo-scaffold',        label: 'repo-scaffold' } },
  { data: { id: 'shared-protocol',      label: 'shared-protocol' } },
  { data: { id: 'mcp-apps-host-spike',  label: 'mcp-apps-host-spike' } },
  { data: { id: 'mcp-server',           label: 'mcp-server' } },
  { data: { id: 'vscode-extension',     label: 'vscode-extension' } },
  { data: { id: 'canvas-render',        label: 'canvas-render' } },
  { data: { id: 'mcp-app-launch',       label: 'mcp-app-launch' } },
  { data: { id: 'live-update',          label: 'live-update' } },
  { data: { id: 'node-selection',       label: 'node-selection' } },
  { data: { id: 'explain-node',         label: 'explain-node' } },
  { data: { id: 'expand-node',          label: 'expand-node' } },
  { data: { id: 'node-code-refs',       label: 'node-code-refs' } },
  { data: { id: 'modify-from-node',     label: 'modify-from-node' } },
  { data: { id: 'diagram-edit-to-code', label: 'diagram-edit-to-code' } },
  { data: { id: 'multi-host-validation', label: 'multi-host-validation' } },

  { data: { source: 'repo-scaffold',    target: 'shared-protocol' } },
  { data: { source: 'repo-scaffold',    target: 'mcp-apps-host-spike' } },
  { data: { source: 'shared-protocol',  target: 'mcp-server' } },
  { data: { source: 'shared-protocol',  target: 'canvas-render' } },
  { data: { source: 'shared-protocol',  target: 'vscode-extension' } },
  { data: { source: 'mcp-apps-host-spike', target: 'vscode-extension' } },
  { data: { source: 'mcp-server',       target: 'mcp-app-launch' } },
  { data: { source: 'vscode-extension', target: 'mcp-app-launch' } },
  { data: { source: 'canvas-render',    target: 'mcp-app-launch' } },
  { data: { source: 'mcp-app-launch',   target: 'live-update' } },
  { data: { source: 'live-update',      target: 'node-selection' } },
  { data: { source: 'node-selection',   target: 'explain-node' } },
  { data: { source: 'node-selection',   target: 'expand-node' } },
  { data: { source: 'live-update',      target: 'expand-node' } },
  { data: { source: 'expand-node',      target: 'node-code-refs' } },
  { data: { source: 'node-code-refs',   target: 'modify-from-node' } },
  { data: { source: 'modify-from-node', target: 'diagram-edit-to-code' } },
  { data: { source: 'live-update',      target: 'multi-host-validation' } },
];

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements,
  layout: { name: 'breadthfirst', directed: true },
});

// Click a task to inspect its dependents
cy.on('tap', 'node', (evt) => {
  console.log('task:', evt.target.id(),
    'unblocks →', evt.target.outgoers('node').map((n) => n.id()));
});
```
