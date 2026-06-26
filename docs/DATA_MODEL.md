# Data Model & Protocol

> The single source of truth for the **canvas message protocol** and the canvas
> state model. The MCP server, the canvas (MCP App), and the VS Code extension
> import the shared types in `/shared`. Per ADR-005 + ADR-007 the transport is
> **JSON-RPC over the MCP Apps `postMessage` channel**, run by the VS Code extension
> between the canvas webview and the server/CLI; the message *shapes* below are
> transport-agnostic (a raw WebSocket fallback for local debugging uses the same shapes).

## Supported diagram types
The diagram model is a **Cytoscape graph** (nodes + edges; see decisions D2/D4).
This makes the protocol a strong fit for **topological** diagrams (who-connects-to-whom)
and unsuitable for **order/time** diagrams (what-happens-when).

| Diagram type | Supported | Notes |
|--------------|-----------|-------|
| Flowchart | ✅ Yes | `diagram_flowchart`: terminator/process/decision/io shapes, labeled branches |
| Dependency / call graph / architecture | ✅ Yes (primary) | `diagram_dependency`: Cytoscape's sweet spot — the main use case; cycles OK |
| Entity/relationship graph | ✅ Yes | `diagram_er`: entity "table" boxes; cardinality-labeled relationship lines |
| State machine | ✅ Yes | `diagram_state_machine`: states; initial/final marked; open-arrow transitions labeled with events |
| Class diagram | ⚠️ Partial | `diagram_class`: distinct UML arrowheads (inheritance/realization/association/dependency/aggregation/composition); UML compartments (attrs/methods) folded into the node label, not separate sections — see docs/DIAGRAM_TOOLS.md |
| Sequence diagram | ❌ No | Needs lifelines + time ordering; Cytoscape models topology, not time |
| Timeline / Gantt | ❌ No | Needs a time axis + explicit positions, which D2 forbids (canvas auto-layouts) |

Each ✅ type has a dedicated MCP **skill/tool** built on `create_diagram`; the
tool applies the type's **notation** (conventional shapes/arrowheads) via internal
`classes` the canvas stylesheet defines. See `docs/DIAGRAM_TOOLS.md` for the full
per-type notation and the `/diagram*` slash commands.

**Rule of thumb:** graph-shaped (who-connects-to-whom) ✅; order/time-shaped
(what-happens-when) ❌. Supporting sequence/timeline would require relaxing D2 (let
the server send positions / a time axis) or a second renderer — a deliberate
protocol change, not a quick tweak. Out of scope (see
`PROJECT_BRIEF.md` and ADR-006).

## Conventions

- All messages are JSON objects with a `type` field (discriminated union), carried
  as MCP Apps JSON-RPC methods/notifications.
- `direction` below is informational: **S→C** = server/model to canvas,
  **C→S** = canvas to server/model.
- Every message carries a `sessionId` (string) and optional `msgId` (string,
  for request/response correlation).

## Core entities

### DiagramState
| Field | Type | Notes |
|--------|------|-------|
| `diagramId` | string | New id per full (re)generation |
| `elements` | `CyElement[]` | Cytoscape graph model (nodes + edges) — see below |
| `title` | string | Human label, e.g. "Auth flow" |
| `nodes` | `NodeMeta[]` | Derived index for selection/expand |
| `version` | number | Increments on patch/regeneration |

### CyElement (Cytoscape graph element)
A node or edge in the Cytoscape `elements` array. Nodes and edges are
distinguished by whether `data` carries `source`/`target`.
| Field | Type | Notes |
|--------|------|-------|
| `data.id` | string | Node id (omit for edges, or set for edge id) |
| `data.label` | string | Display text |
| `data.source` | string | Edge only: source node id |
| `data.target` | string | Edge only: target node id |
| `data.kind` | string | optional: `module` \| `service` \| `entrypoint` \| ... |
| `classes` | string | optional: space-separated style classes (see D14) |
| `style` | `CyStyle` | optional: whitelisted `{ color?, fontSize?, size? }` (D14) |

```json
[
  { "data": { "id": "A", "label": "Login", "kind": "entrypoint" } },
  { "data": { "id": "B", "label": "Auth service", "kind": "service" } },
  { "data": { "source": "A", "target": "B" } }
]
```

### NodeMeta
| Field | Type | Notes |
|--------|------|-------|
| `nodeId` | string | **Stable** Cytoscape node id (selection key) |
| `label` | string | Display text |
| `kind` | string | optional: `module` \| `service` \| `entrypoint` \| ... |
| `codeRefs` | `CodeRef[]` | optional: file/line locations (advanced tier) |

### CodeRef
| Field | Type | Notes |
|--------|------|-------|
| `path` | string | Repo-relative file path |
| `range` | `{startLine:number,endLine:number}` | optional |
| `symbol` | string | optional symbol name |

### Selection
| Field | Type | Notes |
|--------|------|-------|
| `nodeIds` | string[] | One or more selected nodes |
| `diagramId` | string | Diagram the selection belongs to |

## Messages — S→C (skill drives canvas)

### `diagram`  — full render / replace
```json
{
  "type": "diagram",
  "sessionId": "abc",
  "diagramId": "d1",
  "title": "Auth flow",
  "elements": [
    { "data": { "id": "A", "label": "Login", "kind": "entrypoint" } },
    { "data": { "id": "B", "label": "Auth service", "kind": "service" } },
    { "data": { "source": "A", "target": "B" } }
  ],
  "version": 1
}
```

### `patch` — incremental update (e.g. expand in place)
A patch carries graph operations so the canvas can mutate Cytoscape in place
(`cy.add` / `cy.remove` / `cy.data`) instead of re-rendering the whole graph — and
crucially **without re-laying-out or re-fitting**, so the current view (pan, zoom,
node positions) is preserved.
```json
{
  "type": "patch",
  "sessionId": "abc",
  "diagramId": "d1",
  "version": 2,
  "add": [
    { "data": { "id": "C", "label": "Token store", "kind": "service" } },
    { "data": { "source": "B", "target": "C" } }
  ],
  "remove": [],
  "update": [
    { "data": { "id": "B", "label": "Auth service (200)" } }
  ]
}
```
> `update` merges `data` into existing elements by `id` (e.g. relabel/annotate
> nodes) in place. Used by the `update_diagram` tool to edit a diagram without
> regenerating it.

### `highlight` — focus/annotate nodes (e.g. show callers)
Maps to Cytoscape classes/selectors on the canvas (e.g. fade everything else and
spotlight the listed nodes).
```json
{ "type": "highlight", "sessionId": "abc", "nodeIds": ["B","C"], "style": "callers" }
```

### `status` — transient feedback for the canvas
```json
{ "type": "status", "sessionId": "abc", "state": "thinking", "text": "Expanding node…" }
```

## Messages — C→S (canvas feeds back to skill)

### `hello` — handshake on connect
```json
{ "type": "hello", "sessionId": "abc", "client": "browser", "protocol": 1 }
```

### `node_selected`
```json
{ "type": "node_selected", "sessionId": "abc", "diagramId": "d1", "nodeIds": ["B"] }
```

### `interaction` — a user instruction tied to the current selection
```json
{
  "type": "interaction",
  "sessionId": "abc",
  "diagramId": "d1",
  "nodeIds": ["B"],
  "action": "explain",
  "text": "explain this node"
}
```
`action` ∈ `explain` | `expand` | `show_callers` | `modify` | `freeform`.
For `modify` (advanced), `text` is the instruction, e.g. *"add a new entrypoint so
the user can do X."*

### `diagram_edited` — user edited the diagram directly (advanced)
```json
{ "type": "diagram_edited", "sessionId": "abc", "diagramId": "d1", "elements": [ "…edited graph model…" ] }
```

### `ack` / `error`
```json
{ "type": "ack", "sessionId": "abc", "msgId": "m1" }
{ "type": "error", "sessionId": "abc", "msgId": "m1", "message": "…" }
```

## Action → behavior mapping

| `action` | Tier | Skill behavior |
|----------|------|----------------|
| `explain` | Intermediate | Prompt Copilot with the node's context; reply in CLI |
| `expand` | Intermediate | Regenerate a richer subgraph for the node → `diagram`/`patch` |
| `show_callers` | Intermediate | Find callers → `highlight` + optional diagram |
| `modify` | Advanced | Gather code context for node, ask clarifying Qs, edit code, re-emit `diagram` |
| `freeform` | Any | Treat `text` as a Copilot prompt scoped to selection |

## Protocol decisions (ratified)

> Locked design decisions for `/shared/protocol.ts`. The protocol is
> **append-only & PR-reviewed**; propose changes via PR, never edit
> unilaterally.

- **D1 — Envelope:** `protocol.ts` types describe **message payloads only**
  (`{ type, sessionId, msgId?, … }`). The **extension owns the JSON-RPC envelope**
  (`method`/`id`/`params`) over `postMessage`; canvas and server stay
  transport-agnostic.
- **D2 — Layout:** the **canvas auto-layouts** (Cytoscape `layout`). The server
  **does not** send node positions (no `x`/`y`) in the protocol.
- **D3 — Styling:** the **canvas owns the stylesheet**. The server sends only
  **semantic hints** — `kind` and/or `classes` — never Cytoscape style objects.
- **D4 — CyElement:** our own **minimal subset**, not Cytoscape's full
  `ElementDefinition` — `{ data: { id?, label?, source?, target?, kind? }, classes? }`.
  Keeps the contract decoupled from any Cytoscape version.
- **D5 — Element identity:** nodes always have `data.id`; edges may omit it (optional
  edge id). Node ids are **unique within a diagram**.
- **D6 — Patch ops:** `patch` carries `add: CyElement[]`, `remove: string[]`
  (node/edge **ids**), and `update: CyElement[]` (merge `data` into existing
  elements by `id`), applied via `cy.add` / `cy.remove` / `cy.data` **without**
  re-layout or re-fit (preserves the view).
- **D7 — Id generation & selection:** the **server** emits deterministic **semantic
  ids** (e.g. `authService`, not autogenerated). Selection key = `(diagramId, nodeId)`.
- **D8 — Closed enums (string-literal unions, lock typos at compile time):**
  - `InteractionAction = 'explain' | 'expand' | 'show_callers' | 'modify' | 'freeform'`
  - `HighlightStyle = 'callers' | 'selected' | 'path' | 'faded'`
  - `StatusState = 'thinking' | 'idle' | 'error'`
- **D9 — Correlation:** `sessionId` is **required** on every message; `msgId` is
  **optional**, set only on request/response style messages; `ack`/`error` **echo**
  the originating `msgId`.
- **D10 — Error model:** `{ message: string, code?: string }` — free-text message
  plus an optional code; start simple, enumerate codes later if needed.
- **D11 — Versioning:** `export const PROTOCOL_VERSION = 1`. `hello` carries
  `protocol`; the server replies with `error` on mismatch.
- **D12 — Conventions:** `type` discriminant values are `snake_case`
  (`node_selected`); all field names are `camelCase`.
- **D13 — Helpers:** co-locate in `protocol.ts` a top-level `CanvasMessage` union,
  per-message **type guards** (e.g. `isDiagramMessage`), and an exhaustiveness
  helper (`assertNever`) used by a type-level test.
- **D14 — CLI-controlled presentation (relaxes D3):** the model may influence
  per-element presentation two ways, both applied by the canvas over the
  kind/base styles. The canvas still owns the actual values — no raw Cytoscape
  style is accepted.
  - **Style classes** (`CyElement.classes`) — a curated vocabulary the canvas
    defines: `big`, `small`, `highlight`, `muted`, `danger`, `success`, `warning`,
    `annotation` (dashed arrowless leader line for notes).
    - The typed diagram tools additionally emit **internal notation
      classes** the canvas styles per diagram type — e.g. `decision`, `fc-process`,
      `fc-terminator`, `initial`/`final`, `uml-class`, `inheritance`/`composition`,
      `er-entity`. These are produced server-side by the typed builders, not part of
      the model-facing `create_diagram` vocabulary above. See `docs/DIAGRAM_TOOLS.md`.
  - **Inline style subset** (`CyElement.style: CyStyle`) — whitelisted
    `{ color?, fontSize?, size? }` only (`color` → node fill / edge line;
    `fontSize` → label px; `size` → node label-padding px, ignored for edges).
  - Exposed via the `create_diagram` and `update_diagram` tools (per node/edge).
- **D15 — Semantic colour:** colour encodes meaning, not decoration.  **Node role** comes from `kind`, with a fixed palette: `entrypoint` = Entry point,
  `service` = Service/process, `module` = Module, `datastore` = Data store,
  `external` = External, `note` = Note. **Status** comes from the classes `danger`
  (error), `success`, `warning`. The canvas shows a **legend** of the kinds/statuses
  present so colours are self-explanatory. Copilot is instructed to use `kind`/status
  consistently and only set an explicit `style.color` on direct user request.
- **D16 — Code links:** a node may carry `codeRefs: CodeRef[]`
  (`{ path, range?, symbol? }`, repo-relative paths). The `link_node_to_code` tool
  attaches a ref (and marks the node `linked`); `open_node_code` opens the file and
  reveals the range in the editor, or reports the node isn't linked. Nodes can also
  carry `codeRefs` at creation via `create_diagram`.

## Protocol versioning

- `protocol: 1` (`PROTOCOL_VERSION`). The `hello` message negotiates the version;
  server rejects mismatches with an `error` (see D11).

## Notes for implementers

- **Node id stability:** Copilot must emit deterministic Cytoscape node ids so a
  selection survives an `expand`/regeneration. Prefer semantic ids (`authService`)
  over autogenerated ones.
- **Selection key** is `(diagramId, nodeId)`.
- Keep `/shared/protocol.ts` as the canonical type definitions; do not redefine
  message shapes in the client or server.

## Rendering & interaction (canvas side)

The canvas renders the `elements` model with Cytoscape and routes every gesture
back through the protocol as data — it never executes code carried in node data.

```js
// 1) Render a `diagram` message
const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: msg.elements,
  layout: { name: 'breadthfirst', directed: true },
});

// 2) Node click → emit node_selected (selection key = diagramId + id)
cy.on('tap', 'node', (evt) => {
  send({ type: 'node_selected', sessionId, diagramId, nodeIds: [evt.target.id()] });
});

// 3) Apply an incoming `patch` in place (dynamic update)
function applyPatch(p) {
  cy.batch(() => {
    if (p.remove?.length) cy.remove(p.remove.map((e) => cy.getElementById(e.data.id)));
    if (p.add?.length) cy.add(p.add);
  });
}

// 4) Apply a `highlight` (filtering / spotlight via classes + selectors)
function applyHighlight(nodeIds) {
  cy.elements().addClass('faded');
  cy.collection(nodeIds.map((id) => cy.getElementById(id))).removeClass('faded');
}
```
