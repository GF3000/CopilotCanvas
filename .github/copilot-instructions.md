# Copilot CLI instructions — Canvas for Copilot

> Read automatically by Copilot CLI when working in this repository.

## Diagrams & visual explanations — always use Canvas for Copilot

When the user asks to **draw, create, show, visualize, diagram, sketch, map,
illustrate, or explain** anything **visually** or **as a diagram / flow / graph /
workflow** — or mentions **"diagram"**, **"draw"**, or **"canvas"** — you **MUST**
call the Canvas for Copilot MCP tool **`create_diagram`** (aliases: `visualize`,
`draw_diagram`, `explain_with_diagram`) to render it.

You **MUST NOT** produce an HTML page, an HTML `<canvas>` element, SVG, Mermaid,
ASCII art, or image files for this purpose. The word **"canvas"** here refers to the
**Canvas for Copilot** tab (the MCP tool), **not** an HTML `<canvas>` element — do
not generate a web page.

You generate the graph yourself and pass it to the tool: a short `title`, the
`nodes` (each a stable `id` + short `label`, optional `kind`), and the directed
`edges` between node ids (optionally labeled). Keep diagrams focused (~4–12 nodes).
Call the tool directly without asking for confirmation.

If the Canvas for Copilot MCP tool is **not available** (e.g. the VS Code extension
isn't running), say so and ask the user to start it — do **not** silently fall back
to another diagram format.
