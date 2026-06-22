# Project Brief

## One-line pitch

**Canvas for Copilot** — a lightweight local web canvas that opens on demand and
stays connected to your Copilot CLI session over WebSockets, turning Copilot's
text explanations of systems into live, interactive diagrams.

## Problem statement

Copilot CLI is great at explaining systems — architectures, call graphs, data
flows, git histories — but it explains them in **text**. Developers reasoning
about complex systems have to hold spatial/structural relationships in their head
or redraw them by hand. There's no visual channel, and no way to interact with a
diagram and feed that interaction back to Copilot.

Canvas for Copilot adds a **second surface**: a visual reasoning channel that
lives alongside the terminal workflow developers already trust.

## How it works

1. You ask Copilot something like *"diagram the auth flow"* or *"show me how this
   service depends on the others."*
2. The skill generates a **Mermaid** diagram and pushes it to the canvas, which
   **auto-opens in your browser** on first use.
3. The canvas is **interactive**: pan, zoom, click a node to ask Copilot a
   follow-up (*"explain this module," "show callers," "expand this subgraph"*),
   or edit the diagram directly and have Copilot propose matching code changes.

The novelty isn't the renderer — it's the **bidirectional loop**: the CLI drives
the canvas, and the canvas sends interactions back as Copilot prompts. Copilot
gains a visual reasoning channel without leaving the terminal.

## Target users

- **Primary:** Developers using Copilot CLI to understand, navigate, and modify
  unfamiliar or complex codebases.
- **Secondary:** Engineers onboarding to a new system, or doing architecture
  reviews, who want to explore structure visually.

## Goals & success criteria

The project is delivered in three progressive tiers:

### Goal 1 — Basic: Visualize
Copilot CLI generates Mermaid diagrams and the user can visualize them easily in
a browser tab.

- [ ] Copilot CLI can push a Mermaid diagram to a local canvas.
- [ ] The canvas auto-opens in the browser on first use.
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
- [ ] Interactions round-trip over WebSocket without manual refresh.

### Goal 3 — Advanced: Modify code + diagram
The user can modify both code and the diagram through the canvas.

- [ ] User selects a node, then types e.g. *"add a new entrypoint so the user can
      do X."*
- [ ] Copilot uses the selected node for context, implements the code change, and
      updates the diagram to match.
- [ ] During the process Copilot asks the user clarifying questions for any doubts.
- [ ] Editing the diagram directly can drive proposed code changes.

## In scope

- Local web canvas served from / connected to the CLI session.
- WebSocket bidirectional channel (CLI ⇄ canvas).
- Mermaid diagram generation and rendering.
- Node selection feeding context back to Copilot.
- Diagram expansion and code-change proposals (advanced tier).
- Possible packaging as a VS Code extension.

## Out of scope (explicitly)

- Building a custom diagram renderer (we use Mermaid).
- Cloud hosting / multi-user collaboration on a shared canvas.
- Persisting diagrams long-term / diagram version control.
- Non-Mermaid diagram formats.
- Authentication/accounts (it's a local dev tool).

## Constraints & assumptions

- **Timebox:** <hackathon duration — fill in>
- **Team:** <who / how many>
- **Hard constraints:** runs locally; integrates with the Copilot CLI extension /
  skill mechanism; browser-based canvas.
- **Assumptions:** Copilot CLI can expose a skill/extension that opens a local
  server and exchanges messages over WebSocket; Mermaid is sufficient for the
  diagram types we need.

## Possible delivery vehicle

This could ship as a **VS Code extension** wrapping the CLI skill + canvas, or as
a standalone CLI skill that opens a browser tab. Decide early (log in
`docs/DECISIONS.md`).

## The demo

Ask Copilot in the terminal to *"diagram the auth flow."* A browser tab pops open
showing the live Mermaid diagram. Click a node and type *"expand this"* — the
diagram grows new subnodes in place. Then select an entrypoint node and ask
*"add a new endpoint to do X"*; Copilot asks a clarifying question, writes the
code, and updates the diagram to reflect the new entrypoint — all without leaving
the terminal.
