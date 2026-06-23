# Competitive Landscape

> Prior art and adjacent tools in the "AI + interactive diagram" space, captured to
> understand what exists, where it stops short, and which patterns are worth reusing.
> Sourced from background research — tool names/details below are **reported but not
> independently verified**, so treat specifics as approximate. The verified
> architectural takeaways live in `ARCHITECTURE.md`; the decision to build on the
> MCP Apps approach lives in `DECISIONS.md` (ADR-005, superseding ADR-004).

## The gap we target

Several tools visualize code or let AI author diagrams, but none deliver the full
**bidirectional loop** Canvas for Copilot aims for: click a visual node to scope the
AI's context, issue a CLI command, and have the AI mutate **both the source code and
the diagram** in one step. Existing tools tend to be either read-only confirmation
surfaces or external web apps detached from the terminal workflow.

## Adjacent tools

| Tool | What it does | Integration | Limitation vs. our goal |
|------|--------------|-------------|--------------------------|
| **ChangeGuard** | Visualizes proposed code changes as color-coded Mermaid graphs before execution in Claude Code | VS Code extension + Claude Code `PreToolUse` shell hooks + `CLAUDE.md` prompt injection | Unidirectional — the diagram is a read-only confirmation step, not an interactive control surface |
| **DiagramZu** | MCP server providing a shared workspace for AI-authored Mermaid diagrams with version history | MCP server (Streamable HTTP / stdio), registered in the MCP registry | Persists diagram state well, but no node-to-CLI contextual selection |
| **Mermaid Chart VS Code extension** | Generates C4/sequence diagrams from codebase analysis via Copilot Chat (`@mermaid-chart`) | VS Code webview + Copilot Chat API + CodeLens | Chat-driven; does not mutate code and diagram together from the terminal |
| **RepoArchitectAgent** | AI repo analysis generating interactive Mermaid diagrams of project structure | Python/FastAPI backend + Next.js/React frontend (Groq/Anthropic) | External web app, not an integrated IDE/CLI tool |
| **AppContext** | Streams real-time visual app context (simulators, RN logs) to AI agents to fix UI autonomously | Desktop app + MCP server (Cursor, Claude Code, Windsurf) | Visual context streaming, but not a diagram-as-control-surface |

## Patterns worth reusing

- **Hooks for determinism (ChangeGuard):** lifecycle hooks force the AI to produce/
  update a diagram rather than relying on it remembering — see the deterministic
  code↔diagram sync note in `ARCHITECTURE.md`.
- **Persistent diagram state (DiagramZu):** keeping diagram state across a session
  beats regenerating throwaway images each turn.
- **Code-to-diagram mapping via AI (Mermaid Chart, RepoArchitectAgent):** LLMs can
  scan source and infer relationships well enough to seed an initial diagram.
- **Streaming live context to the model (AppContext):** richer real-time context
  reduces manual prompting — analogous to our `node_selected` feedback.

## How Canvas for Copilot differs

- **Terminal-first:** Copilot CLI is the brain; the canvas is a second surface, not a
  separate web app (see `PROJECT_BRIEF.md`).
- **Bidirectional control surface:** node selection feeds CLI context *and* CLI
  commands mutate code + diagram together (Goals 2–3 in `PROJECT_BRIEF.md`).
- **MCP-native, portable canvas:** built on **MCP Apps (SEP-1865)** — the canvas is
  an MCP App rendered by the host and bridged over JSON-RPC `postMessage`, portable
  across MCP hosts (Copilot CLI, VS Code MCP client). A raw WebSocket remains only
  as an optional local-debug fallback (ADR-005, supersedes ADR-001/ADR-004).
