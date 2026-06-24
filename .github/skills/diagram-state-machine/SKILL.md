---
name: diagram-state-machine
description: >-
    Render a state machine / state diagram (states joined by transitions labeled with
    the triggering event) on the Canvas for Copilot canvas. Use for "state machine",
    "state diagram", or "states and transitions" requests. Builds the graph and
    renders it via the canvas MCP tool.
user-invocable: true
---

# State machine diagram

Render a **state machine** on the Canvas for Copilot canvas.

The user's request follows the `/diagram-state-machine` command, e.g.
`/diagram-state-machine an order: new, paid, shipped, delivered`. If it's empty, ask
what system's states they want.

## What to do

1. Identify the **states**, the **transitions** between them, and the **event /
   condition** that triggers each transition. Identify the single **initial** state
   and any **final** (accepting) states.
2. Call the **`diagram_state_machine`** MCP tool (Canvas for Copilot) with:
   - `title` — a short title, e.g. "Order lifecycle".
   - `states` — each `{ id, label, initial?, final? }`; mark exactly one `initial`
     and any number of `final` states.
   - `transitions` — each `{ from, to, event? }`; put the triggering event on `event`.
3. Keep it focused (~4–12 states).

## Rules

- Do **not** emit HTML, an HTML `<canvas>`, SVG, Mermaid, ASCII art, or image files —
  always render through the `diagram_state_machine` tool.
- Read-only and safe: do not ask for confirmation, just render it.
- If the Canvas for Copilot MCP tool is unavailable (the VS Code extension isn't
  running), say so and ask the user to start it — don't fall back to another format.
