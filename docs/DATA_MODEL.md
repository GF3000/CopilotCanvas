# Data Model & Protocol

> The single source of truth for the **canvas message protocol** and the canvas
> state model. Both the MCP server and the canvas (MCP App) import the shared types
> in `/shared`. Per ADR-005 the transport is **JSON-RPC over the MCP Apps
> `postMessage` channel**; the message *shapes* below are transport-agnostic (a raw
> WebSocket fallback for local debugging uses the same shapes).

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
| `classes` | string | optional: space-separated style classes (e.g. `faded`) |

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
(`cy.add` / `cy.remove`) instead of re-rendering the whole graph.
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
  "remove": []
}
```
> Goal 1 may implement `expand` as a full `diagram` replace; `patch` is an
> optimization for later.

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

## Protocol versioning

- `protocol: 1`. The `hello` message negotiates the version; server rejects
  mismatches with an `error`.

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
