# Requirements

> Functional requirements derived from the three goal tiers in
> `PROJECT_BRIEF.md`. Each has acceptance criteria specific enough for an AI
> agent to implement and self-verify.

## Goal 1 — Basic: Visualize

### FR-1: CLI pushes a graph model to a local canvas
**User story:** As a developer, I want Copilot CLI to render a generated graph
model (Cytoscape elements) in the canvas so that I can see a system visually.

**Acceptance criteria:**
- [ ] The server can send a `diagram` message (see `DATA_MODEL.md`) over the MCP
      Apps channel.
- [ ] The canvas renders the `elements` model with Cytoscape.
- [ ] An invalid graph model shows a readable error, not a blank canvas.

**Priority:** Must · **Depends on:** none

### FR-2: Canvas opens as a VS Code tab on demand on first use
**User story:** As a developer, I want the canvas to open automatically as a VS Code
tab the first time a diagram is produced so that I don't run extra commands.

**Acceptance criteria:**
- [ ] On first diagram, the Canvas MCP server provides the canvas as an MCP App resource.
- [ ] The VS Code extension opens the canvas as a webview tab automatically.
- [ ] Subsequent diagrams reuse the same tab (no duplicate tabs/windows).

**Priority:** Must · **Depends on:** FR-1

### FR-3: Pan and zoom
**Acceptance criteria:**
- [ ] User can pan by dragging and zoom via wheel/controls.
- [ ] Diagram stays legible at large sizes; a "fit/reset view" control exists.

**Priority:** Must · **Depends on:** FR-1

### FR-4: Live update from the CLI
**User story:** As a developer, when Copilot updates the diagram I want the open
canvas to update without a manual refresh.

**Acceptance criteria:**
- [ ] A new `diagram`/`patch` message re-renders the open canvas in place.
- [ ] The canvas recovers if the extension reloads the webview / re-inits the channel.

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
- [ ] A **client-side drill-down** complements this: right-click a node →
      "Expand element" focuses it + its neighbours as a sub-scope (same diagram type),
      with a "Back to previous scope" breadcrumb — no model round-trip
      (`canvas/src/scope.ts`).

**Priority:** Must · **Depends on:** FR-5, FR-4

### FR-8: Round-trip without manual refresh
**Acceptance criteria:**
- [ ] Selection and interaction messages flow over the MCP Apps channel both ways
      with no page reload.

**Priority:** Should · **Depends on:** FR-5

## Goal 3 — Advanced: Modify code + diagram

### FR-9: Node-scoped code change
**User story:** As a developer, I want to select a node and instruct Copilot to
change the code (e.g. "add a new entrypoint to do X") so that diagram and code
evolve together.

**Acceptance criteria:**
- [ ] A `modify` interaction passes the selected node + instruction to the server.
- [ ] The server gathers code context for that node (via `codeRefs`).
- [ ] Copilot **asks clarifying questions** in the CLI before/while implementing.
- [ ] Copilot applies the code change to the repo.
- [ ] The diagram is updated to reflect the change.

**Priority:** Must (advanced tier) · **Depends on:** FR-5, FR-7

### FR-10: Direct diagram edit drives proposed code changes
**Status:** Dropped — the inline node-rename edit was removed (it fired
spurious renames on node selection/pan/zoom). No `diagram_edited` message exists.

**Priority:** Won't · **Depends on:** FR-9

### FR-11: Typed diagram skills (dependency, flowchart, state machine, class, ER)
**User story:** As a developer, I want to ask for a specific kind of diagram (or
invoke it with a `/` command) and have it rendered with that type's conventional
notation, so the diagram reads correctly for its domain.

**Acceptance criteria:**
- [ ] Dedicated MCP tools exist — `diagram_dependency`, `diagram_flowchart`,
      `diagram_state_machine`, `diagram_class`, `diagram_er` — each built on
      `create_diagram`, with a tuned description so the matching
      natural-language request routes to it.
- [ ] Each is also a Copilot CLI **skill** invocable with `/` (`/diagram-<type>`),
      plus a `/diagram` dispatcher that auto-detects the type from the request.
- [ ] Each type renders with its conventional **notation** (shapes + arrowheads) on
      the shared palette: flowchart terminator/process/decision/io shapes; state
      machine initial/final + open-arrow transitions; UML class boxes with distinct
      relation arrowheads; ER table boxes with cardinality-labeled lines.
- [ ] Edges referencing unknown node ids are dropped + reported (never blank the
      canvas); cycles render without error.

**Priority:** Should · **Depends on:** FR-1

## Non-functional requirements

| ID | Category | Requirement |
|------|-----------|-------------|
| NFR-1 | Security | Runs locally; canvas sandboxed in a VS Code webview (extension-set CSP); no external exposure |
| NFR-2 | Performance | Diagram render + live update feels instant (< ~300 ms for typical diagrams) |
| NFR-3 | Portability | Canvas is a self-contained MCP App bundle; **primary host is VS Code** (webview tab via the extension). Rendering in other MCP hosts is a stretch |
| NFR-4 | Resilience | Canvas recovers when the extension reloads the webview / re-inits the channel |
| NFR-5 | Single-session | One developer, one canvas tab; no auth/multi-user |

## Prioritization (MoSCoW)

- **Must have:** FR-1..FR-7 (Goal 1 complete + core of Goal 2), FR-9
- **Should have:** FR-8, FR-11 (typed diagram skills)
- **Could have:** FR-10, multi-host validation
- **Won't have (out of scope):** persistence, cloud hosting, non-graph formats
