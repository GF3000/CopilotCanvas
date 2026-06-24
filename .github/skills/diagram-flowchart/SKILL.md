---
name: diagram-flowchart
description: >-
    Render a top-down flowchart (steps and decisions joined by directed flow, with
    labeled decision branches) on the Canvas for Copilot canvas. Use for "draw a
    flowchart", "workflow", "process", or "the steps of X" requests. Builds the graph
    and renders it via the canvas MCP tool.
user-invocable: true
---

# Flowchart

Render a **flowchart** (steps + decisions) on the Canvas for Copilot canvas.

The user's request follows the `/diagram-flowchart` command, e.g.
`/diagram-flowchart handling an HTTP request with a cache check`. If it's empty, ask
what process they want charted.

## What to do

1. Break the process into **steps** and **decisions**, and the directed **flow**
   between them.
2. Call the **`diagram_flowchart`** MCP tool (Canvas for Copilot) with:
   - `title` — a short title, e.g. "Request handling".
   - `nodes` — each `{ id, label, type? }`; `type` is `start` (entry), `step`
     (default, process rectangle), `decision` (renders as a diamond), `io`
     (input/output parallelogram), or `end` (terminator).
   - `edges` — each `{ from, to, label? }`; **label the edges out of a `decision`**
     with the branch ("yes"/"no").
3. Keep it focused (~4–12 nodes) and top-down readable.

## Rules

- Do **not** emit HTML, an HTML `<canvas>`, SVG, Mermaid, ASCII art, or image files —
  always render through the `diagram_flowchart` tool.
- Read-only and safe: do not ask for confirmation, just render it.
- If the Canvas for Copilot MCP tool is unavailable (the VS Code extension isn't
  running), say so and ask the user to start it — don't fall back to another format.
