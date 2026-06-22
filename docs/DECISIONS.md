# Decision Log (ADRs)

> Lightweight record of significant decisions and *why* they were made, so later
> agents (and teammates) don't undo them. Add a new entry per decision; never
> rewrite history — supersede instead.

## ADR-001: Ship as a CLI skill first; VS Code extension as a thin webview wrapper later

- **Date:** 2026-06-22
- **Status:** Accepted
- **Context:** Canvas for Copilot needs a visual surface connected to a Copilot CLI
  session. Two delivery vehicles were considered: (a) a standalone Copilot CLI
  skill that opens a browser tab and bridges over WebSocket, or (b) a VS Code
  extension that renders the canvas in a webview. We have a hackathon timebox and
  want the novel "bidirectional loop" working as fast as possible.
- **Decision:** Build the **standalone CLI skill + local WebSocket server +
  browser-based canvas** first. Design the **canvas as a self-contained,
  portable web bundle** (no hard dependency on either host). A VS Code extension
  is a **stretch goal**: a thin wrapper whose only job is to run one command,
  open the same canvas bundle in a webview, and connect it to the CLI session.
- **Consequences:**
  - All novel logic (diagram generation, node-selection context, expand,
    code-change proposals) lives in the **CLI skill**, not the host.
  - The canvas must communicate over an abstraction that works for both a raw
    WebSocket (browser) and `postMessage` (VS Code webview). We keep the message
    protocol transport-agnostic (see `DATA_MODEL.md`).
  - Swapping browser → webview later is cheap because the canvas is portable.
  - We explicitly do **not** use the VS Code Chat / Language Model API (`vscode.lm`)
    — Copilot CLI remains the brain.
- **Alternatives considered:**
  - *VS Code extension first:* heavier setup, CSP friction, and ties the demo to
    the editor. Rejected for the hackathon timebox.
  - *Native Copilot-in-VS-Code via chat participants:* different, heavier
    integration; out of scope.

---

## ADR-002: Use Mermaid as the diagram format and renderer

- **Date:** 2026-06-22
- **Status:** Accepted
- **Context:** We need to render architecture/flow/call-graph diagrams that an LLM
  can reliably author as text.
- **Decision:** Use **Mermaid**. Copilot emits Mermaid source; the canvas renders
  it with the Mermaid JS library.
- **Consequences:** No custom renderer to build. Node identity for selection is
  derived from Mermaid node ids / the rendered SVG. Diagram types are limited to
  what Mermaid supports (flowchart, sequence, ER, etc.) — acceptable.
- **Alternatives considered:** Custom graph renderer (too costly), Graphviz/DOT
  (less LLM-friendly, heavier to render in-browser). Rejected.

---

## ADR-003: Node.js / TypeScript stack

- **Date:** 2026-06-22
- **Status:** Accepted
- **Context:** Canvas is browser JS; Mermaid is a JS library; VS Code extensions
  are Node; a single language reduces context-switching for parallel agents.
- **Decision:** Use **TypeScript** across the CLI skill (Node) and the canvas
  (browser). Use the `ws` library for the server and native `WebSocket` in the
  browser. Bundle the canvas with a lightweight bundler (e.g. Vite/esbuild).
- **Consequences:** One toolchain, one set of types (shared protocol types can be
  imported by both server and client). Easy path to the VS Code webview later.
- **Alternatives considered:** Python CLI + JS canvas (two languages, duplicated
  protocol types). Rejected for cohesion.

---

## ADR-004: Use a direct WebSocket bridge — not MCP Apps (SEP-1865) — for the canvas

- **Date:** 2026-06-22
- **Status:** Accepted
- **Context:** A standardized alternative exists for embedding interactive UIs in
  AI agents: the **MCP Apps** extension (**SEP-1865**) to the Model Context
  Protocol. With MCP Apps, an MCP server declares an HTML UI resource (MIME
  `text/html;profile=mcp-app`); the host renders it in a sandboxed iframe and
  opens a bidirectional **JSON-RPC-over-`postMessage`** channel between the UI and
  the model. This maps almost exactly onto our "bidirectional loop" and is
  natively supported by VS Code's MCP client and other hosts. Adjacent prior art
  in this space (reported in background research, individually unverified) includes
  ChangeGuard, DiagramZu, the Mermaid Chart VS Code extension, RepoArchitectAgent,
  and AppContext.
- **Decision:** For the hackathon build, stay with the **CLI skill + local
  WebSocket bridge + portable browser canvas** (ADR-001), **not** MCP Apps. Keep
  the message protocol transport-agnostic (see `DATA_MODEL.md`) so an MCP Apps
  transport could be added later without rewriting the canvas.
- **Consequences:**
  - We don't depend on the host's MCP-Apps support, an MCP server lifecycle, or
    the iframe/CSP host contract — fewer moving parts for the demo.
  - Copilot CLI remains the brain (consistent with ADR-001's rejection of
    `vscode.lm`); we are not building an MCP server.
  - **Future migration path:** because the protocol is transport-agnostic, the
    same canvas bundle could later be served as an MCP App resource and bridged
    over `postMessage` instead of raw WebSocket — analogous to the VS Code webview
    path already anticipated in ADR-001.
- **Alternatives considered:**
  - *MCP Apps (SEP-1865) now:* the "correct" long-term standard and portable
    across MCP hosts, but adds MCP-server scaffolding, host-support assumptions,
    and the sandbox/CSP contract that aren't needed to prove the loop. Deferred,
    not rejected.
