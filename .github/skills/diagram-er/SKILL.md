---
name: diagram-er
description: >-
    Render an entity / relationship (ER) diagram (entities joined by relationships
    labeled with cardinality) on the Canvas for Copilot canvas. Use for "ER diagram",
    "data model", or "entities and relationships" requests. Builds the graph and
    renders it via the canvas MCP tool.
user-invocable: true
---

# Entity / relationship (ER) diagram

Render an **ER / data-model** diagram on the Canvas for Copilot canvas.

The user's request follows the `/diagram-er` command, e.g.
`/diagram-er Customer places Orders, Orders contain Products`. If it's empty, ask
which data model they want, or infer it from the repo's schema/models.

## What to do

1. Identify the **entities**, their key **attributes**, and the **relationships**
   between them with their **cardinality** ("1", "N", "1:N", "M:N").
2. Call the **`diagram_er`** MCP tool (Canvas for Copilot) with:
   - `title` — a short title, e.g. "Sales data model".
   - `entities` — each `{ id, label, attributes? }`; surface key attributes (e.g.
     `"id (PK)"`, `"email"`).
   - `relationships` — each `{ from, to, label?, cardinality? }`; put the cardinality
     on `cardinality` and an optional verb phrase on `label` (e.g. "places").
3. Keep it focused (~4–12 entities).

## Rules

- Do **not** emit HTML, an HTML `<canvas>`, SVG, Mermaid, ASCII art, or image files —
  always render through the `diagram_er` tool.
- Read-only and safe: do not ask for confirmation, just render it.
- If the Canvas for Copilot MCP tool is unavailable (the VS Code extension isn't
  running), say so and ask the user to start it — don't fall back to another format.
