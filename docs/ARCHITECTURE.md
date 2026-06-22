# Architecture

> The **how**, at a high level. Decisions that pin these choices live in
> `DECISIONS.md` (ADR-001..004).

## Tech stack

| Layer | Choice | Why |
|--------|--------|-----|
| Language | TypeScript (Node + browser) | One toolchain, shared protocol types (ADR-003) |
| CLI integration | Copilot CLI **skill** | Drives the canvas; holds all novel logic (ADR-001) |
| Transport | WebSocket (`ws` server + browser `WebSocket`) | Bidirectional, low-latency, local |
| Diagram format | **Mermaid** | LLM-friendly text → rendered SVG (ADR-002) |
| Canvas UI | Portable web bundle (Vite/esbuild) | Works in browser now, VS Code webview later (ADR-001) |
| Pan/zoom | svg-pan-zoom (or equivalent) | Interaction over the rendered SVG |
| Host (stretch) | VS Code extension (thin webview wrapper) | Optional second surface |

## System overview

```mermaid
flowchart LR
    Dev([Developer]) -->|prompt: "diagram the auth flow"| CLI[Copilot CLI session]
    CLI <-->|invokes| Skill[Canvas skill]
    Skill <-->|WebSocket :PORT| Server[Local WS server]
    Server <-->|WebSocket| Canvas[Browser canvas]
    Canvas -->|renders| Mermaid[Mermaid SVG]
    Dev -->|pan/zoom/click/edit| Canvas
    Canvas -->|interaction events| Server
    Server -->|prompts/context| Skill
    Skill -->|reads/writes| Repo[(Codebase)]
```

## The bidirectional loop (core novelty)

1. **CLI → canvas (drive):** Copilot generates Mermaid source via the skill; the
   skill sends a `diagram` message; the canvas renders it.
2. **Canvas → CLI (feedback):** the user pans/zooms/selects/edits; the canvas
   sends `node_selected` / `interaction` / `diagram_edited` messages; the skill
   turns them into Copilot prompts (with the selected node as context).

## Components

### Canvas skill (Node, in the CLI session)
- **Responsibility:** Start/stop the local server, generate & push diagrams,
  receive canvas events, translate them into Copilot prompts/actions, read & write
  the codebase (advanced tier).
- **Talks to:** Copilot CLI (as a skill), the WS server, the repo.

### Local WebSocket server (Node)
- **Responsibility:** Serve the canvas web bundle over HTTP, host the WS endpoint,
  relay messages between skill and canvas, track session state (current diagram,
  selection). Single-client (the developer's browser tab).
- **Talks to:** the skill (in-process or via WS), the canvas (WS).

### Canvas web app (browser)
- **Responsibility:** Render Mermaid, provide pan/zoom, capture node selection and
  edits, send interaction events, auto-reconnect.
- **Talks to:** the WS server. Transport is abstracted so the same app can run in a
  VS Code webview using `postMessage` instead of WS (ADR-001).

### VS Code extension (stretch)
- **Responsibility:** One command opens the canvas bundle in a webview and bridges
  `postMessage` ⇄ the skill. No new logic.

## Key data flows

1. **Generate:** prompt → skill builds Mermaid → `diagram` msg → canvas renders.
2. **Explain:** click node → `node_selected` → skill prompts Copilot with node
   context → reply shown in CLI.
3. **Expand:** `expand_node` → skill regenerates a richer subgraph → `diagram`
   (or `patch`) msg → canvas re-renders in place.
4. **Modify (advanced):** select node + instruction → skill gathers code context
   for that node → asks clarifying questions in CLI → edits code → emits updated
   `diagram` reflecting the change.

## Lifecycle

- **First use:** skill starts the server on a free localhost port and **auto-opens**
  the browser to it. Subsequent diagrams reuse the running server/tab (live update).
- **Shutdown:** skill stops the server when the CLI session ends.

## Folder structure (target)

```
/
  /skill        Copilot CLI skill (Node/TS) + WS server
  /canvas       Browser web app (TS, Mermaid, pan/zoom)
  /shared       Shared protocol types (imported by skill + canvas)
  /extension    (stretch) VS Code extension wrapper
  /docs         these documents
```

## Security / constraints

- **Local only:** bind to `127.0.0.1`; never expose externally.
- **Single user/session:** no auth, no multi-tenant (see brief, out of scope).
- **Webview CSP (stretch):** if rendered in VS Code, use `asWebviewUri` + a nonce
  for scripts.
- **Mermaid interactivity is loose by design:** click callbacks require Mermaid's
  `securityLevel: 'loose'`, which permits inline scripts/HTML and is unsafe for
  untrusted input. Mitigate by (a) treating diagram source as trusted only after
  validation, (b) never executing arbitrary JS from a node — route every click
  through the protocol as a data-only `node_selected` event, and (c) keeping the
  canvas in a sandboxed surface (browser tab today, sandboxed webview/iframe later).

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

- Exact mechanism for a Copilot CLI skill to (a) open a long-lived server and
  (b) receive asynchronous canvas events back into the conversation — validate
  early against the CLI skill API.
- Stable node identity across diagram regenerations (needed for selection/expand).
- Mapping a Mermaid node back to concrete code locations (advanced tier).
