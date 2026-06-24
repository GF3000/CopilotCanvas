---
name: diagram-dependency
description: >-
    Render a dependency / architecture diagram (modules, packages or services and
    their "depends on" relationships) on the Canvas for Copilot canvas. Use for
    "dependency graph", "what depends on X", "architecture diagram", or "call graph"
    requests. Builds a directed graph and renders it via the canvas MCP tool.
user-invocable: true
---

# Dependency diagram

Render a **dependency / architecture** diagram on the Canvas for Copilot canvas.

The user's request (what to diagram) follows the `/diagram-dependency` command, e.g.
`/diagram-dependency the server modules`. If it's empty, ask what they want mapped,
or infer it from the current repo/selection.

## Scope / level

The request may specify the **scope** (granularity) at which to map dependencies. Honour
it when present; otherwise pick the level that best fits the request (default: `module`).
Pass it to the tool as `scope` — one of `package`, `module`, `function`, `service`:

- `package` (a.k.a. workspace) — top-level packages or workspaces depending on each other.
- `module` (a.k.a. file) — individual source files/modules and their import edges (default).
- `function` (a.k.a. call) — functions/methods and their call relationships (a call graph).
- `service` — runtime services/processes and the calls between them.

Keep nodes at a single level — don't mix packages and functions in one diagram unless the
prompt asks for it. Reflect the chosen scope in the `title` (e.g. "Server call graph").

## What to do

1. Determine the requested **scope** (see above), then work out the items at that level
   (packages / modules / functions / services) and their **"depends on"** relationships
   (analyse the repo if the request refers to this codebase).
2. Call the **`diagram_dependency`** MCP tool (Canvas for Copilot) with:
   - `title` — a short title, e.g. "Server module dependencies".
   - `scope` — the level above, when the prompt names one (sets the default node kind).
   - `nodes` — each `{ id, label, kind? }`; `kind` is `module`, `service`, or
     `external` (defaults from `scope`).
   - `dependencies` — each `{ from, to, label? }` meaning **`from` depends on `to`**.
3. Keep it focused (~4–12 nodes). Cycles are fine — render them as-is.

## Rules

- Do **not** emit HTML, an HTML `<canvas>`, SVG, Mermaid, ASCII art, or image files —
  always render through the `diagram_dependency` tool.
- Read-only and safe: do not ask for confirmation, just render it.
- If the Canvas for Copilot MCP tool is unavailable (the VS Code extension isn't
  running), say so and ask the user to start it — don't fall back to another format.
