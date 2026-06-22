# Requirements

> Functional requirements derived from the three goal tiers in
> `PROJECT_BRIEF.md`. Each has acceptance criteria specific enough for an AI
> agent to implement and self-verify.

## Goal 1 — Basic: Visualize

### FR-1: CLI pushes a Mermaid diagram to a local canvas
**User story:** As a developer, I want Copilot CLI to render a generated Mermaid
diagram in my browser so that I can see a system visually.

**Acceptance criteria:**
- [ ] The skill can send a `diagram` message (see `DATA_MODEL.md`) over WebSocket.
- [ ] The canvas renders the Mermaid source as an SVG.
- [ ] Invalid Mermaid shows a readable error, not a blank canvas.

**Priority:** Must · **Depends on:** none

### FR-2: Canvas auto-opens on first use
**User story:** As a developer, I want the canvas tab to open automatically the
first time a diagram is produced so that I don't run extra commands.

**Acceptance criteria:**
- [ ] On first diagram, the skill starts a local server on a free `127.0.0.1` port.
- [ ] The system browser opens to the canvas automatically.
- [ ] Subsequent diagrams reuse the same server/tab (no duplicate windows).

**Priority:** Must · **Depends on:** FR-1

### FR-3: Pan and zoom
**Acceptance criteria:**
- [ ] User can pan by dragging and zoom via wheel/controls.
- [ ] Diagram stays legible at large sizes; a "fit/reset view" control exists.

**Priority:** Must · **Depends on:** FR-1

### FR-4: Live update from the CLI
**User story:** As a developer, when Copilot updates the diagram I want the open
tab to update without a manual refresh.

**Acceptance criteria:**
- [ ] A new `diagram`/`patch` message re-renders the open canvas in place.
- [ ] The WebSocket auto-reconnects if dropped.

**Priority:** Must · **Depends on:** FR-1, FR-2

## Goal 2 — Intermediate: Interact

### FR-5: Node selection is known to the CLI
**User story:** As a developer, I want to select a node on the canvas so that the
CLI knows what I'm referring to.

**Acceptance criteria:**
- [ ] Clicking a node visibly selects it and emits `node_selected`.
- [ ] The skill stores the current selection `(diagramId, nodeIds)`.
- [ ] Selection survives a diagram re-render where the node still exists.

**Priority:** Must · **Depends on:** FR-1

### FR-6: "Explain this node"
**Acceptance criteria:**
- [ ] With a node selected, an `explain` interaction prompts Copilot with that
      node's context.
- [ ] Copilot's explanation appears in the CLI.

**Priority:** Must · **Depends on:** FR-5

### FR-7: "Expand this node"
**Acceptance criteria:**
- [ ] An `expand` interaction regenerates a more detailed subgraph for the node.
- [ ] The canvas re-renders showing the expanded detail/subnodes in place.

**Priority:** Must · **Depends on:** FR-5, FR-4

### FR-8: Round-trip without manual refresh
**Acceptance criteria:**
- [ ] Selection and interaction messages flow over WebSocket both ways with no
      page reload.

**Priority:** Should · **Depends on:** FR-5

## Goal 3 — Advanced: Modify code + diagram

### FR-9: Node-scoped code change
**User story:** As a developer, I want to select a node and instruct Copilot to
change the code (e.g. "add a new entrypoint to do X") so that diagram and code
evolve together.

**Acceptance criteria:**
- [ ] A `modify` interaction passes the selected node + instruction to the skill.
- [ ] The skill gathers code context for that node (via `codeRefs`).
- [ ] Copilot **asks clarifying questions** in the CLI before/while implementing.
- [ ] Copilot applies the code change to the repo.
- [ ] The diagram is updated to reflect the change.

**Priority:** Must (advanced tier) · **Depends on:** FR-5, FR-7

### FR-10: Direct diagram edit drives proposed code changes
**Acceptance criteria:**
- [ ] Editing the diagram on the canvas emits `diagram_edited`.
- [ ] Copilot proposes matching code changes for the edit.

**Priority:** Could · **Depends on:** FR-9

## Non-functional requirements

| ID | Category | Requirement |
|------|-----------|-------------|
| NFR-1 | Security | Server binds to `127.0.0.1` only; never exposed externally |
| NFR-2 | Performance | Diagram render + live update feels instant (< ~300 ms for typical diagrams) |
| NFR-3 | Portability | Canvas is a self-contained bundle runnable in a browser and (stretch) a VS Code webview |
| NFR-4 | Resilience | WebSocket auto-reconnects; one server reused per session |
| NFR-5 | Single-session | One developer, one browser tab; no auth/multi-user |

## Prioritization (MoSCoW)

- **Must have:** FR-1..FR-7 (Goal 1 complete + core of Goal 2), FR-9
- **Should have:** FR-8
- **Could have:** FR-10, VS Code extension wrapper
- **Won't have (this hackathon):** persistence, cloud hosting, non-Mermaid formats
