# Architecture

> The **how**, at a high level. Decisions that pin these choices live in
> `DECISIONS.md` (ADR-001..005). **Transport/host model is defined by ADR-005:
> MCP Apps**, which supersedes the WebSocket approach in ADR-004.

## Tech stack

| Layer | Choice | Why |
|--------|--------|-----|
| Language | TypeScript (Node + browser) | One toolchain, shared protocol types (ADR-003) |
| Integration | **MCP server** exposing an **MCP App** | Standard, host-portable UI + tools (ADR-005) |
| Transport | **JSON-RPC over `postMessage`** (MCP Apps channel) | Host-rendered sandboxed iframe ⇄ model (ADR-005) |
| Diagram model | **Cytoscape graph elements (JSON)** | Structured nodes/edges, LLM-friendly to emit, natively interactive (ADR-006) |
| Canvas UI | Portable web bundle (Vite/esbuild) served as an MCP App resource | Rendered by the MCP host's iframe; transport-agnostic |
| Renderer / interaction | Cytoscape.js | Renders the graph; built-in pan/zoom, tap events, selectors for highlight/filter |
| MCP host | Copilot CLI / VS Code MCP client | Renders the app, runs the JSON-RPC channel |

## System overview

The system itself is described as a Cytoscape graph. The diagram is no longer
static text — it is a graph **model** (nodes + edges) that the canvas renders and
the user interacts with.

```js
// Graph model (Cytoscape elements)
const elements = [
  { data: { id: 'dev',    label: 'Developer' } },
  { data: { id: 'host',   label: 'MCP host: Copilot CLI / VS Code' } },
  { data: { id: 'server', label: 'Canvas MCP server' } },
  { data: { id: 'canvas', label: 'MCP App canvas (sandboxed iframe)' } },
  { data: { id: 'cy',     label: 'Cytoscape graph' } },
  { data: { id: 'repo',   label: 'Codebase' } },

  { data: { source: 'dev',    target: 'host',   label: 'prompt: "diagram the auth flow"' } },
  { data: { source: 'host',   target: 'server', label: 'MCP tools + app resource' } },
  { data: { source: 'host',   target: 'canvas', label: 'renders' } },
  { data: { source: 'canvas', target: 'host',   label: 'JSON-RPC over postMessage' } },
  { data: { source: 'canvas', target: 'cy',     label: 'renders' } },
  { data: { source: 'dev',    target: 'canvas', label: 'pan/zoom/click/edit' } },
  { data: { source: 'server', target: 'repo',   label: 'reads/writes' } },
];

// Rendering layer
const cy = cytoscape({
  container: document.getElementById('cy'),
  elements,
  layout: { name: 'breadthfirst', directed: true },
});

// Interaction loop: a node tap is routed back to the model as data only
cy.on('tap', 'node', (evt) => {
  postToModel({ type: 'node_selected', nodeIds: [evt.target.id()] });
});
```

This single model captures the same topology the old text diagram did, but every
node is now a live, clickable object the user can select, expand, and filter.

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
   emits `node_selected` / `interaction` / `diagram_edited` JSON-RPC messages; the
   MCP server turns them into Copilot prompts/actions (with the selected node as
   context).

## Components

### Canvas MCP server (Node)
- **Responsibility:** Declare the MCP App HTML UI resource (MIME
  `text/html;profile=mcp-app`), expose tools to generate/update diagrams, receive
  canvas events over the MCP Apps JSON-RPC channel, translate them into Copilot
  prompts/actions, read & write the codebase (advanced tier), and track session
  state (current diagram, selection).
- **Talks to:** the MCP host (Copilot CLI / VS Code), the canvas (via the host's
  `postMessage` channel), the repo.

### Canvas web app (MCP App resource, runs in the host iframe)
- **Responsibility:** Render the Cytoscape graph, provide built-in pan/zoom,
  capture node selection/highlight/filter and edits, and exchange JSON-RPC
  messages with the model over the MCP Apps `postMessage` channel.
- **Talks to:** the MCP host bridge. Transport is abstracted so the same bundle
  could also run over a raw WebSocket for local debugging (non-primary).

### MCP host (Copilot CLI / VS Code)
- **Responsibility:** Render the MCP App in a sandboxed iframe and run the
  bidirectional JSON-RPC `postMessage` channel between canvas and model. Provided
  by the platform — we don't build it.

## Key data flows

1. **Generate:** prompt → server builds a graph model (`elements`) → `diagram` msg
   → canvas renders with Cytoscape.
2. **Explain:** click node → `node_selected` → server prompts Copilot with node
   context → reply shown in the host.
3. **Expand:** `expand` interaction → server regenerates a richer subgraph →
   `diagram`/`patch` msg → canvas re-renders in place.
4. **Modify (advanced):** select node + instruction → server gathers code context
   for that node → asks clarifying questions in the host → edits code → emits
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

- **First use:** the MCP host launches the canvas as an MCP App resource and
  renders it in a sandboxed iframe; no manual browser auto-open or port binding.
  Subsequent diagrams update the same rendered app in place (live update).
- **Shutdown:** the MCP server shuts down with the host/session.

## Folder structure (target)

```
/
  /server       Canvas MCP server (Node/TS): tools + app resource + repo I/O
  /canvas       MCP App web bundle (TS, Cytoscape, interaction loop)
  /shared       Shared protocol types (imported by server + canvas)
  /docs         these documents
```

## Security / constraints

- **Host sandbox:** the canvas runs in the MCP host's **sandboxed iframe**; rely on
  the host CSP and never load untrusted remote scripts.
- **Single user/session:** no auth, no multi-tenant (see brief, out of scope).
- **Interactions are data-only by design:** Cytoscape needs no `eval`/inline-script
  escape hatch — node taps, highlights, and filters are native graph events.
  Mitigate risk by (a) validating the graph model against the protocol schema
  before rendering, (b) never executing arbitrary JS carried in node data — route
  every click through the protocol as a data-only `node_selected` message, and
  (c) relying on the MCP App's sandboxed iframe.

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

- Exact level of MCP Apps (SEP-1865) support in the target MCP host (Copilot CLI /
  VS Code MCP client): app-resource rendering and the JSON-RPC `postMessage`
  channel — validate early against the host's MCP-Apps implementation.
- Stable node identity across diagram regenerations (needed for selection/expand).
- Mapping a Cytoscape node back to concrete code locations (advanced tier).
