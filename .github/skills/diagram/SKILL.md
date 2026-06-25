---
name: diagram
description: >-
    Draw any diagram on the Canvas for Copilot canvas, auto-detecting the diagram
    type from the request. Use for "draw/diagram/visualize X", "/diagram a flowchart
    for ...", "/diagram the dependency graph of ...". Detects dependency, flowchart,
    state machine, class or ER and calls the matching canvas MCP tool (falling back
    to create_diagram for anything else).
user-invocable: true
---

# Diagram (auto-detect type)

Render a diagram on the Canvas for Copilot canvas, **picking the right diagram type
automatically** from the user's request. This is the umbrella command; the explicit
`/diagram-dependency`, `/diagram-flowchart`, `/diagram-state-machine`,
`/diagram-class` and `/diagram-er` commands force a specific type.

The request follows the `/diagram` command, e.g. `/diagram a flowchart for handling a
login request` or `/diagram the dependency graph of the server modules`. If it's
empty, ask what they want drawn.

## Step 1 — detect the type

Read the request and choose the **most specific** matching type. Match on the type
named in the request first, then on the shape of what's being described:

| Detected type | Triggers (words / intent in the request) | Tool to call |
|---------------|------------------------------------------|--------------|
| **dependency** | "dependency", "depends on", "architecture", "call graph", "what uses X", modules/packages/services and what they require | `diagram_dependency` |
| **flowchart** | "flowchart", "workflow", "process", "the steps", branching logic with decisions | `diagram_flowchart` |
| **state machine** | "state machine", "state diagram", "states and transitions", lifecycle with events | `diagram_state_machine` |
| **class** | "class diagram", "UML", classes with attributes/methods, inheritance/association/aggregation/composition | `diagram_class` |
| **ER** | "ER diagram", "entity relationship", "data model", "schema", entities + cardinality | `diagram_er` |
| **anything else** | a generic graph / "just draw …" with no clear type above | `create_diagram` |

If two types seem plausible, prefer the one the user **named explicitly**; otherwise
pick the best structural fit. You may briefly note which type you chose.

## Step 2 — build and render

Call the chosen MCP tool with a graph you construct from the request, following that
tool's input shape (see `docs/DIAGRAM_TOOLS.md` for each type's fields and
conventions — e.g. dependency edges go from dependent → dependency; flowchart
decision branches are labeled "yes"/"no"; state transitions carry the event; class
relations carry a `type`; ER relationships carry `cardinality`). Keep it focused
(~4–12 nodes).

## Rules

- Do **not** emit HTML, an HTML `<canvas>`, SVG, Mermaid, ASCII art, or image files —
  always render through one of the canvas diagram tools above.
- Read-only and safe: do not ask for confirmation, just detect the type and render it.
- If the Canvas for Copilot MCP tool is unavailable (the VS Code extension isn't
  running), say so and ask the user to start it — don't fall back to another format.
