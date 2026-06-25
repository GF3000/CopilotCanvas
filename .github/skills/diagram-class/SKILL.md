---
name: diagram-class
description: >-
    Render a UML class diagram (classes and their relations — inheritance,
    association, aggregation, composition) on the Canvas for Copilot canvas. Use for
    "class diagram", "UML diagram", or "classes and relations" requests. Builds the
    graph and renders it via the canvas MCP tool.
user-invocable: true
---

# Class diagram

Render a **UML class** diagram on the Canvas for Copilot canvas.

The user's request follows the `/diagram-class` command, e.g.
`/diagram-class the domain model: User, Order, Product`. If it's empty, ask which
classes/model they want, or infer it from the repo.

## What to do

1. Identify the **classes**, their key **attributes/methods**, and the **relations**
   between them.
2. Call the **`diagram_class`** MCP tool (Canvas for Copilot) with:
   - `title` — a short title, e.g. "Domain model".
   - `classes` — each `{ id, label, attributes?, methods? }`; attributes/methods are
     string lines, e.g. `"+ id: string"`, `"+ save(): void"`.
   - `relations` — each `{ from, to, type?, label? }` where `type` is `inheritance`,
     `realization`, `association`, `dependency`, `aggregation`, or `composition`. For
     **inheritance/realization**, `from` is the subclass/implementer and `to` the
     superclass/interface. For **aggregation/composition**, `from` is the whole/owner
     and `to` the part.
3. Keep it focused (~4–12 classes).

## Note (limitation)

Cytoscape has no UML *compartments*, so attributes/methods are folded into the node
label (separated by a rule) rather than shown in separate sections. The relation kind
is fully distinguishable via distinct arrowheads/line-styles (▷ inheritance, dashed ▷
realization, → association, dashed → dependency, ◇ aggregation, ◆ composition).

## Rules

- Do **not** emit HTML, an HTML `<canvas>`, SVG, Mermaid, ASCII art, or image files —
  always render through the `diagram_class` tool.
- Read-only and safe: do not ask for confirmation, just render it.
- If the Canvas for Copilot MCP tool is unavailable (the VS Code extension isn't
  running), say so and ask the user to start it — don't fall back to another format.
