# Project Brief

## One-line pitch

**Canvas for Copilot** — a lightweight interactive canvas that opens as a **VS Code
tab** and stays connected to your Copilot CLI session via the Model Context
Protocol (MCP Apps), turning Copilot's text explanations of systems into live,
interactive graphs.

## Problem statement

Copilot CLI is great at explaining systems — architectures, call graphs, data
flows, git histories — but it explains them in **text**. Developers reasoning
about complex systems have to hold spatial/structural relationships in their head
or redraw them by hand. There's no visual channel, and no way to interact with a
diagram and feed that interaction back to Copilot.

Canvas for Copilot adds a **second surface**: a visual reasoning channel that
lives alongside the terminal workflow developers already trust.

## How it works

You run **Copilot CLI in VS Code's integrated terminal** (the brain). A **thin VS
Code extension** opens the canvas as a **webview tab** in the same window and bridges
it to the CLI session over the MCP Apps `postMessage` channel.

1. You ask Copilot something like *"diagram the auth flow"* or *"show me how this
   service depends on the others."*
2. The Canvas MCP server (driven by Copilot CLI) generates an **interactive
   Cytoscape graph** (a node/edge model); the **VS Code extension renders it as a
   webview tab** on first use and updates it in place after that.
3. The canvas is **interactive**: pan, zoom, click a node to ask Copilot a
   follow-up (*"explain this module," "show callers," "expand this subgraph"*),
   or edit the diagram directly and have Copilot propose matching code changes.

The novelty isn't the renderer — it's the **bidirectional loop**: the CLI drives
the canvas tab, and the canvas sends interactions back as Copilot prompts. Copilot
gains a visual reasoning channel right beside the terminal, in one VS Code window.

## Target users

- **Primary:** Developers using Copilot CLI to understand, navigate, and modify
  unfamiliar or complex codebases.
- **Secondary:** Engineers onboarding to a new system, or doing architecture
  reviews, who want to explore structure visually.

## Goals & success criteria

The project is delivered in three progressive tiers:

### Goal 1 — Basic: Visualize
Copilot CLI generates a graph model (Cytoscape elements) and the user can
visualize it easily in the canvas surface.

- [ ] Copilot CLI can push a graph model (Cytoscape elements) to the canvas.
- [ ] The VS Code extension opens the canvas as a webview tab on first use.
- [ ] The diagram renders correctly with pan and zoom.
- [ ] Updating the diagram from the CLI live-updates the open tab.

### Goal 2 — Intermediate: Interact
The user can interact with the diagram and the CLI together. Selecting a node
gives the CLI context about what is selected.

- [ ] User can select/click a node on the canvas.
- [ ] The CLI knows which node is selected and can act on it.
- [ ] *"Explain this node"* → Copilot explains the selected node.
- [ ] *"Expand this node"* → the diagram expands that part with more detail /
      subnodes.
- [ ] Interactions round-trip over the MCP Apps channel without manual refresh.

### Goal 3 — Advanced: Modify code + diagram
The user can modify both code and the diagram through the canvas.

- [ ] User selects a node, then types e.g. *"add a new entrypoint so the user can
      do X."*
- [ ] Copilot uses the selected node for context, implements the code change, and
      updates the diagram to match.
- [ ] During the process Copilot asks the user clarifying questions for any doubts.
- [ ] Editing the diagram directly can drive proposed code changes.

## In scope

- Interactive canvas delivered as an **MCP App**, rendered as a **VS Code webview
  tab** by a thin extension and connected to the Copilot CLI session.
- A **thin VS Code extension** that opens the canvas tab and bridges the MCP Apps
  channel (CLI/model ⇄ canvas) — see ADR-007.
- **MCP Apps** bidirectional channel (CLI/model ⇄ canvas) over `postMessage`.
- Interactive graph rendering with Cytoscape (node/edge model).
- Node selection feeding context back to Copilot.
- Diagram expansion and code-change proposals (advanced tier).

## Out of scope (explicitly)

- Building a custom diagram renderer from scratch (we use Cytoscape.js).
- Cloud hosting / multi-user collaboration on a shared canvas.
- Persisting diagrams long-term / diagram version control.
- Non-graph diagram formats (e.g. sequence/ER diagrams).
- Authentication/accounts (it's a local dev tool).
- Multi-host portability as a day-1 guarantee — VS Code is the **primary** host;
  rendering in other MCP hosts is a stretch (NFR-3, ADR-007).
- A standalone-terminal (non-VS-Code) experience — deferred (Option 1 in ADR-007).

## Constraints & assumptions

- **Team:** 6 people across 3 locations / time zones — **US (3)**, **Dublin (2)**,
  **India (1)**. Because of the wide time-zone spread,
  **commit/push and update `docs/TASKS.md` frequently** so hand-offs work across zones.
- **Hard constraints:** runs locally; **Copilot CLI in VS Code's integrated
  terminal** is the brain; the canvas is an **MCP App rendered as a VS Code webview
  tab** by the extension (ADR-005 + ADR-007).
- **Assumptions:** VS Code can host the canvas webview and the MCP Apps JSON-RPC
  `postMessage` channel (SEP-1865); the extension can relay the Copilot CLI session
  to that webview; a Cytoscape graph model is sufficient for the diagram types we
  need.

## Team, epics & ownership

Work is split into **3 epics**, one per location (ownership *proposed, changeable*):

| Epic | Scope | Owner (proposed) | Code area |
|------|-------|------------------|-----------|
| **Frontend / Canvas UI** | Cytoscape webview: render graph model, pan/zoom, node tap, highlight/filter, live update | **US (3p)** | `/canvas` |
| **MCP logic / tools** | MCP server: tools that generate/patch graph models, session state, repo I/O, Copilot prompting | **Dublin (2p)** | `/server` |
| **VS Code extension (bridge)** | Open the canvas as a webview tab; wire MCP tools ⇄ webview over `postMessage`; relay the CLI session to the webview | **India (1p)** | `/extension` (+ `/shared`) |

The shared protocol (`/shared/protocol.ts`, see `DATA_MODEL.md`) is the contract
between all three epics — agree changes to it early and broadcast them on Teams.

## Delivery vehicle

Canvas for Copilot ships as a **Canvas MCP server** plus a **thin VS Code
extension** that renders the canvas as a **webview tab** (ADR-005 + ADR-007). You
run **Copilot CLI in VS Code's integrated terminal**; the extension opens the canvas
tab and bridges the MCP Apps `postMessage` channel between the CLI/server and the
webview. VS Code is the primary host. See `docs/DECISIONS.md`.

## The demo

In VS Code's integrated terminal, ask Copilot to *"diagram the auth flow."* The
canvas opens as a **webview tab beside the terminal** showing the live, interactive
graph. Click a node and type *"expand this"* — the
diagram grows new subnodes in place. Then select an entrypoint node and ask
*"add a new endpoint to do X"*; Copilot asks a clarifying question, writes the
code, and updates the diagram to reflect the new entrypoint — all without leaving
the terminal.
