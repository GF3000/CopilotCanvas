# Architecture

> The **how**, at a high level. Decisions that pin these choices live in
> `DECISIONS.md` (ADR-001..007). **Transport is MCP Apps (ADR-005)**; the **canvas
> renders as a VS Code webview tab via a thin extension, with Copilot CLI in the
> integrated terminal as the brain (ADR-007)**.

## Tech stack

| Layer | Choice | Why |
|--------|--------|-----|
| Language | TypeScript (Node + browser) | One toolchain, shared protocol types (ADR-003) |
| Integration | **MCP server** exposing an **MCP App** | Standard UI + tools surface (ADR-005) |
| Transport | **JSON-RPC over `postMessage`** (MCP Apps channel) | Webview ⇄ extension/model channel (ADR-005) |
| Diagram model | **Cytoscape graph elements (JSON)** | Structured nodes/edges, LLM-friendly to emit, natively interactive (ADR-006) |
| Canvas UI | Portable web bundle (Vite/esbuild) served as an MCP App resource | Rendered inside the VS Code webview tab; transport-agnostic |
| Renderer / interaction | Cytoscape.js | Renders the graph; built-in pan/zoom, tap events, selectors for highlight/filter |
| Rendering surface | **VS Code extension webview tab** | Opens/owns the canvas tab + CSP; bridges CLI ⇄ webview (ADR-007) |
| Brain | **Copilot CLI in VS Code's integrated terminal** | Drives the MCP server's tools; where the user types (ADR-001, ADR-007) |

## System overview

The system itself is described as a Cytoscape graph. The diagram is no longer
static text — it is a graph **model** (nodes + edges) that the canvas renders and
the user interacts with.

```js
// Graph model (Cytoscape elements)
const elements = [
  { data: { id: 'dev',    label: 'Developer' } },
  { data: { id: 'cli',    label: 'Copilot CLI (brain, in VS Code terminal)' } },
  { data: { id: 'server', label: 'Canvas MCP server (tools)' } },
  { data: { id: 'ext',    label: 'VS Code extension (bridge)' } },
  { data: { id: 'webview', label: 'Canvas webview tab' } },
  { data: { id: 'cy',     label: 'Cytoscape graph' } },
  { data: { id: 'repo',   label: 'Codebase' } },

  { data: { source: 'dev',    target: 'cli',    label: 'prompt: "diagram the auth flow"' } },
  { data: { source: 'cli',    target: 'server', label: 'invokes MCP tools' } },
  { data: { source: 'server', target: 'ext',    label: 'graph model (diagram/patch)' } },
  { data: { source: 'ext',    target: 'webview', label: 'JSON-RPC over postMessage' } },
  { data: { source: 'webview', target: 'cy',    label: 'renders' } },
  { data: { source: 'dev',    target: 'webview', label: 'pan/zoom/click/edit' } },
  { data: { source: 'webview', target: 'ext',   label: 'node_selected / interaction' } },
  { data: { source: 'ext',    target: 'server', label: 'forwards events → CLI' } },
  { data: { source: 'server', target: 'repo',   label: 'reads/writes' } },
];

// Rendering layer (runs inside the VS Code webview tab)
const cy = cytoscape({
  container: document.getElementById('cy'),
  elements,
  layout: { name: 'breadthfirst', directed: true },
});

// Interaction loop: a node tap is posted to the extension as data only
cy.on('tap', 'node', (evt) => {
  vscode.postMessage({ type: 'node_selected', nodeIds: [evt.target.id()] });
});
```

This single model captures the same topology the old text diagram did, but every
node is now a live, clickable object the user can select, expand, and filter — and
it renders as a **VS Code tab beside the integrated terminal** running Copilot CLI.

## The bidirectional loop (core novelty)

At a glance, three roles form a closed loop — the AI/logic tools, the orchestrator,
and the interactive canvas:

```js
// Component overview (Cytoscape model)
const elements = [
  { data: { id: 'mcp', label: 'MCP Tools (AI / Logic)' } },
  { data: { id: 'ext', label: 'VS Code Extension (Orchestrator)' } },
  { data: { id: 'ui',  label: 'Webview UI (Cytoscape Canvas)' } },

  { data: { source: 'mcp', target: 'ext', label: 'Returns graph data' } },
  { data: { source: 'ext', target: 'ui',  label: 'postMessage (graph JSON)' } },
  { data: { source: 'ui',  target: 'ext', label: 'User events (clicks, interactions)' } },
  { data: { source: 'ext', target: 'mcp', label: 'Calls tools' } },
];

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements,
  layout: { name: 'circle' },
});
```

1. **Model → canvas (drive):** Copilot (via the MCP server) generates a Cytoscape
   graph model (`elements`) and sends a `diagram` notification over the MCP Apps
   channel; the canvas renders it with Cytoscape.
2. **Canvas → model (feedback):** the user pans/zooms/selects/edits; the canvas
   emits `node_selected` / `interaction` JSON-RPC messages; the
   MCP server turns them into Copilot prompts/actions (with the selected node as
   context).

## Components

### Copilot CLI (the brain) — runs in VS Code's integrated terminal
- **Responsibility:** Where the user types. As the MCP client, it invokes the Canvas
  MCP server's tools to generate/patch diagrams and to act on canvas interactions.
  Provided by the platform — we don't build it; we register our MCP server with it.

### Canvas MCP server (Node)
- **Responsibility:** Expose tools to generate/update diagrams (emit Cytoscape
  `elements`), declare the canvas MCP App HTML UI resource (MIME
  `text/html;profile=mcp-app`), relay `diagram`/`patch` output to the VS Code
  extension, receive canvas events back, translate them into Copilot
  prompts/actions, read & write the codebase (advanced tier), and track session
  state (current diagram, selection).
- **Talks to:** Copilot CLI (as the MCP client driving it), the VS Code extension
  (which renders the canvas and relays events), the repo.

### VS Code extension (the bridge) — renders the canvas tab
- **Responsibility:** Open and own the **canvas webview tab** in VS Code, set its
  CSP, and run the **MCP Apps JSON-RPC `postMessage`** channel to the canvas bundle.
  Relay graph models from the Canvas MCP server into the webview, and forward
  `node_selected` / `interaction` events from the webview back to
  the server/CLI. Manages tab lifecycle and reconnection.
- **Talks to:** the Canvas MCP server (relay link — likely launches/embeds it or
  connects over a local channel), the canvas webview (`postMessage`).

### Canvas web app (MCP App resource, runs in the VS Code webview tab)
- **Responsibility:** Render the Cytoscape graph, provide built-in pan/zoom,
  capture node selection/highlight/filter and edits, and exchange JSON-RPC
  messages with the extension over the webview `postMessage` channel.
- **Talks to:** the VS Code extension (webview `postMessage`). Transport is
  abstracted so the same bundle could also run over a raw WebSocket for local
  debugging (non-primary).

## Key data flows

1. **Generate:** prompt in CLI → server builds a graph model (`elements`) → relayed
   to the extension → `diagram` msg over `postMessage` → webview renders with Cytoscape.
2. **Explain:** click node → `node_selected` → extension forwards to server → server
   prompts Copilot with node context → reply shown in the CLI.
3. **Expand:** `expand` interaction → server regenerates a richer subgraph →
   `diagram`/`patch` msg → webview re-renders in place.
4. **Modify (advanced):** select node + instruction → server gathers code context
   for that node → asks clarifying questions in the CLI → edits code → emits
   updated `diagram` reflecting the change.

## Interactivity model

Because the diagram is a live Cytoscape graph (not static SVG), interaction is a
first-class, event-driven concern rather than a bolt-on:

- **Node click / inspect / navigate:** `cy.on('tap', 'node', …)` fires a data-only
  `node_selected` message; a follow-up `interaction` can `explain`, `expand`, or
  `navigate` into the node's subgraph.
- **Dynamic updates:** the graph mutates in place via Cytoscape's API
  (`cy.add(...)`, `cy.remove(...)`, `cy.batch(() => …)`) so an `expand` adds
  subnodes without re-rendering the whole canvas.
- **Highlight / filter:** selectors and classes drive focus — e.g.
  `cy.elements().addClass('faded'); cy.$('#authService').closedNeighborhood()
  .removeClass('faded')` to spotlight callers, or `cy.nodes('[kind = "service"]')`
  to filter by node kind.
- **Event-driven fetch:** a node tap can trigger the model to fetch new data (code
  refs, a richer subgraph) and stream it back as a `patch`, closing the
  user ↔ extension ↔ graph loop.

```js
// Highlight a node's neighborhood on tap; request an expand
cy.on('tap', 'node', (evt) => {
  const node = evt.target;
  cy.elements().addClass('faded');
  node.closedNeighborhood().removeClass('faded');
  postToModel({ type: 'interaction', nodeIds: [node.id()], action: 'expand' });
});
```

## Lifecycle

- **First use:** the VS Code extension activates and, on the first `diagram`, opens
  the canvas as a **webview editor tab** (beside the integrated terminal) and loads
  the MCP App bundle; no manual browser auto-open or port binding. Subsequent
  diagrams update the same tab in place (live update).
- **Shutdown:** the canvas tab closes with the window/session; the Canvas MCP server
  shuts down with the Copilot CLI session.

## Folder structure (target)

```
/
  /server       Canvas MCP server (Node/TS): tools + app resource + repo I/O
  /canvas       MCP App web bundle (TS, Cytoscape, interaction loop)
  /extension    VS Code extension (TS): opens the webview tab + CLI↔canvas bridge
  /shared       Shared protocol types (imported by server, canvas, extension)
  /docs         these documents
```

## Security / constraints

- **Webview sandbox:** the canvas runs in a **VS Code webview** with a restrictive
  **CSP set by the extension**; never load untrusted remote scripts (bundle assets
  locally).
- **Single user/session:** no auth, no multi-tenant (see brief, out of scope).
- **Interactions are data-only by design:** Cytoscape needs no `eval`/inline-script
  escape hatch — node taps, highlights, and filters are native graph events.
  Mitigate risk by (a) validating the graph model against the protocol schema
  before rendering, (b) never executing arbitrary JS carried in node data — route
  every click through the protocol as a data-only `node_selected` message, and
  (c) relying on the VS Code webview sandbox + extension-set CSP.

## Diagram integrity (validation & sync)

- **Validate before render:** LLMs can emit an invalid graph model (duplicate or
  missing node ids, edges that reference non-existent nodes, malformed `data`
  fields) that produces an empty or broken canvas. The skill should **validate the
  `elements` model** against the protocol schema before sending a `diagram`
  message; on failure, reject and feed the validation error back to Copilot for a
  self-correction loop rather than pushing a broken model to the canvas.
- **Keep code and diagram in sync (advanced tier):** don't rely solely on the
  model remembering to update the diagram after a code edit. Prefer a
  deterministic trigger (e.g. a post-edit step/hook that re-derives or reconciles
  the graph model) so a structural code change always reflects in the canvas.

## Scaling / context

- **Lazy, hierarchical expansion:** mapping a whole repo into one graph model
  blows the context window, costs latency, and renders illegibly. Start at
  high-level entry points/directories and fetch detail only for the node the user
  expands — Cytoscape adds just the new subgraph (`cy.add`) so the context window
  stays small and diagrams stay readable.

## Risks & open questions

- **Server ↔ extension relay (ADR-007):** how CLI-driven `diagram`/`patch` output
  reaches the extension's webview — extension launches/embeds the Canvas MCP server
  (in-process) vs. a local channel. **Validate on day 1.**
- MCP Apps (SEP-1865) `postMessage` semantics inside a VS Code webview — confirm the
  JSON-RPC channel and App-resource loading behave as expected.
- Stable node identity across diagram regenerations (needed for selection/expand).
- Mapping a Cytoscape node back to concrete code locations (advanced tier).
- Multi-host portability beyond VS Code is a **stretch** (NFR-3), not day-1.
