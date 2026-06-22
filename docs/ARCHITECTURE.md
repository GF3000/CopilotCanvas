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
| Diagram format | **Mermaid** | LLM-friendly text → rendered SVG (ADR-002) |
| Canvas UI | Portable web bundle (Vite/esbuild) served as an MCP App resource | Rendered by the MCP host's iframe; transport-agnostic |
| Pan/zoom | svg-pan-zoom (or equivalent) | Interaction over the rendered SVG |
| MCP host | Copilot CLI / VS Code MCP client | Renders the app, runs the JSON-RPC channel |

## System overview

```mermaid
flowchart LR
    Dev([Developer]) -->|prompt: "diagram the auth flow"| Host[MCP host: Copilot CLI / VS Code]
    Host <-->|MCP tools + app resource| Server[Canvas MCP server]
    Host -->|renders| Canvas[MCP App canvas in sandboxed iframe]
    Canvas <-->|JSON-RPC over postMessage| Host
    Canvas -->|renders| Mermaid[Mermaid SVG]
    Dev -->|pan/zoom/click/edit| Canvas
    Server -->|reads/writes| Repo[(Codebase)]
```

## The bidirectional loop (core novelty)

1. **Model → canvas (drive):** Copilot (via the MCP server) generates Mermaid
   source and sends a `diagram` notification over the MCP Apps channel; the canvas
   renders it.
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
- **Responsibility:** Render Mermaid, provide pan/zoom, capture node selection and
  edits, and exchange JSON-RPC messages with the model over the MCP Apps
  `postMessage` channel.
- **Talks to:** the MCP host bridge. Transport is abstracted so the same bundle
  could also run over a raw WebSocket for local debugging (non-primary).

### MCP host (Copilot CLI / VS Code)
- **Responsibility:** Render the MCP App in a sandboxed iframe and run the
  bidirectional JSON-RPC `postMessage` channel between canvas and model. Provided
  by the platform — we don't build it.

## Key data flows

1. **Generate:** prompt → server builds Mermaid → `diagram` msg → canvas renders.
2. **Explain:** click node → `node_selected` → server prompts Copilot with node
   context → reply shown in the host.
3. **Expand:** `expand` interaction → server regenerates a richer subgraph →
   `diagram`/`patch` msg → canvas re-renders in place.
4. **Modify (advanced):** select node + instruction → server gathers code context
   for that node → asks clarifying questions in the host → edits code → emits
   updated `diagram` reflecting the change.

## Lifecycle

- **First use:** the MCP host launches the canvas as an MCP App resource and
  renders it in a sandboxed iframe; no manual browser auto-open or port binding.
  Subsequent diagrams update the same rendered app in place (live update).
- **Shutdown:** the MCP server shuts down with the host/session.

## Folder structure (target)

```
/
  /server       Canvas MCP server (Node/TS): tools + app resource + repo I/O
  /canvas       MCP App web bundle (TS, Mermaid, pan/zoom)
  /shared       Shared protocol types (imported by server + canvas)
  /docs         these documents
```

## Security / constraints

- **Host sandbox:** the canvas runs in the MCP host's **sandboxed iframe**; rely on
  the host CSP and never load untrusted remote scripts.
- **Single user/session:** no auth, no multi-tenant (see brief, out of scope).
- **Mermaid interactivity is loose by design:** click callbacks require Mermaid's
  `securityLevel: 'loose'`, which permits inline scripts/HTML and is unsafe for
  untrusted input. Mitigate by (a) treating diagram source as trusted only after
  validation, (b) never executing arbitrary JS from a node — route every click
  through the protocol as a data-only `node_selected` message, and (c) relying on
  the MCP App's sandboxed iframe.

## Diagram integrity (validation & sync)

- **Validate before render:** LLMs frequently emit invalid Mermaid (bad node ids,
  unescaped keywords, malformed subgraphs) that breaks the parser and blanks the
  canvas. The skill should **parse/validate** Mermaid before sending a `diagram`
  message; on failure, reject and feed the parser error back to Copilot for a
  self-correction loop rather than pushing broken syntax to the canvas.
- **Keep code and diagram in sync (advanced tier):** don't rely solely on the
  model remembering to update the diagram after a code edit. Prefer a
  deterministic trigger (e.g. a post-edit step/hook that re-derives or reconciles
  the diagram) so a structural code change always reflects in the canvas.

## Scaling / context

- **Lazy, hierarchical expansion:** mapping a whole repo into one Mermaid graph
  blows the context window, costs latency, and renders illegibly. Start at
  high-level entry points/directories and fetch detail only for the node the user
  expands — this keeps the context window small and diagrams readable.

## Risks & open questions

- Exact level of MCP Apps (SEP-1865) support in the target MCP host (Copilot CLI /
  VS Code MCP client): app-resource rendering and the JSON-RPC `postMessage`
  channel — validate early against the host's MCP-Apps implementation.
- Stable node identity across diagram regenerations (needed for selection/expand).
- Mapping a Mermaid node back to concrete code locations (advanced tier).
