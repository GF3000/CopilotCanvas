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

**Explaining a node:** when the user asks to **explain / describe / "what is"** a node
or the selection (e.g. "explain this node", "what does the Auth service do?"), call
**`describe_node`** to get the node's context (its kind and how it connects to its
neighbours), then explain it in the CLI combining that context with your own
knowledge. Omit `nodeId` to use the current selection.

**Jumping to code:** a node can be linked to source. When you know where a node lives
(from analysing the repo), link it with **`link_node_to_code`** (or pass `codeRefs`
when creating the diagram). When the user asks to **see / show / open / jump to the
code** for a node or the selection (e.g. "show me the code for this"), call
**`open_node_code`** (omit `nodeId` for the selection). If the node isn't linked,
say so — don't guess a location.

If the Canvas for Copilot MCP tool is **not available** (e.g. the VS Code extension
isn't running), say so and ask the user to start it — do **not** silently fall back
to another diagram format.

**Use colour to mean something, not decoration:** encode a node's *role* with `kind`
and apply it **consistently** so the same role is always the same colour — `entrypoint`
(entry point), `service` (service/process), `module`, `datastore` (data store),
`external` (third-party), `note` (annotation). Show *outcomes/state* with the status
classes `danger` (error), `success`, `warning`. Only set an explicit `style.color`
when the user specifically asks for a particular colour — otherwise prefer
kind/status so the canvas legend explains the colours.

**Explanatory notes:** to add a note / annotation with explanatory text, add a node
with **`kind: "note"`** (it renders as a sticky note). To attach it to the element
it explains, also add a dashed leader **edge with `classes: ["annotation"]`** from
the note to that element. Use `create_diagram` (for new diagrams) or `update_diagram`
(to add a note to the diagram already on the canvas).
