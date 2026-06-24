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

**Editing an existing diagram:** when the user asks to change, tweak, edit, update,
relabel, annotate, restyle, recolour, resize, add to, or remove from a diagram that
is **already on the canvas** (e.g. "add the expected return code to each node",
"rename node X", "remove node Z"), call **`update_diagram`** instead — it edits in
place and keeps the current view (pan/zoom/positions). Do **not** call
`create_diagram` for edits (that regenerates and loses the view).

**Resolving "this" / the selection:** the user can **click a node or a link (edge)**
on the canvas to select it. When the user refers to the selection deictically —
"this", "this node", "this link", "the selected node/edge", "it", "here", "that one"
(e.g. "increase the font size of this", "rename this link to 'returns 401'") — call
**`get_selection`** first to find out which element id they mean, then act on that id
(usually with `update_diagram`).

If the Canvas for Copilot MCP tool is **not available** (e.g. the VS Code extension
isn't running), say so and ask the user to start it — do **not** silently fall back
to another diagram format.
