# 🎬 Demo Recording Runbook — Canvas for Copilot on **MarkItDown**

> A shot-by-shot script for recording the **4 feature categories** of Canvas for
> Copilot, demoed live against the **MarkItDown** repo
> (`microsoft/markitdown`). Every prompt is copy-pasteable and every click is
> named. Record one clip per category; drop them into `public/clips/` to slot
> into the Remotion video (see `README.md`).
>
> | # | Category | Records to | ~Length |
> |---|----------|-----------|---------|
> | 1 | **Visualize + Explain** | `clip-visualize-explain.mp4` | 25–35 s |
> | 2 | **Expand + Undo** | `clip-expand-undo.mp4` | 25–35 s |
> | 3 | **Search + Code reference** | `clip-search-coderef.mp4` | 25–35 s |
> | 4 | **Diagram types** | `clip-diagram-types.mp4` | 35–50 s |

---

## 0. Why MarkItDown is the perfect demo repo

MarkItDown converts files (PDF, DOCX, PPTX, XLSX, images, audio, HTML, …) into
Markdown. Its core is a clean **registry + plug-in** design that diagrams
beautifully:

- **`MarkItDown`** (`_markitdown.py`) — the orchestrator. Holds an ordered list of
  `ConverterRegistration`s and runs `_convert()`, which **sorts converters by
  priority** and tries each `accepts()` → `convert()` until one succeeds.
- **`DocumentConverter`** (`_base_converter.py`) — the abstract base with two
  methods: `accepts()` and `convert()`.
- **~20 concrete converters** (`converters/`) — `PdfConverter`, `DocxConverter`,
  `XlsxConverter`, `PptxConverter`, `ImageConverter`, `AudioConverter`,
  `HtmlConverter`, `YouTubeConverter`, `WikipediaConverter`, `ZipConverter`, …
- **`StreamInfo`**, **`DocumentConverterResult`** — the data shapes that flow
  through the pipeline.

That gives us real material for *every* diagram type and a big-enough graph to
make search, expand and code-links feel useful.

---

## 1. One-time setup (do this before you hit record)

1. **Open MarkItDown in VS Code:** `code C:\Users\t-obabii\repos\markitdown`.
2. **Install the Canvas for Copilot extension** (or run it from source with `F5`).
   The extension installs the `/diagram-*` skills globally to
   `~/.copilot/skills/`, so they work even though this is a different repo.
3. **Open the integrated terminal** and start Copilot CLI: `copilot`.
4. **Confirm the canvas MCP server is reachable** — the first diagram prompt opens
   the **Canvas for Copilot** tab automatically. If it doesn't, reload the window.
5. **Recording hygiene:**
   - Zoom the editor font to ~16 px; hide the sidebar (`Cmd/Ctrl+B`) for a clean frame.
   - Use a light or dark theme consistently; the canvas follows the VS Code theme.
   - Record at 1920×1080. Keep the terminal + canvas tab both visible
     (terminal bottom, canvas tab top) so the **bidirectional loop** is on screen.
   - Pause ~1 s after each diagram renders so the layout animation finishes before
     you interact.

> 💡 The "magic" of every clip is the **loop**: you type in the terminal → the
> canvas changes, *and* you click on the canvas → Copilot reacts. Always keep both
> surfaces in shot.

---

## 2. Category 1 — **Visualize + Explain**

**Goal:** text → a live interactive diagram, then click a node and have Copilot
explain it.

### Shot 1.1 — Visualize the architecture
- **Type in the terminal:**
  ```
  /diagram the architecture of the markitdown core: how the MarkItDown class, the DocumentConverter base, the concrete converters, StreamInfo and DocumentConverterResult relate
  ```
- **Expected:** the **Canvas for Copilot** tab opens and a dependency graph draws
  itself — `MarkItDown` in the middle, `DocumentConverter` base, several concrete
  converters (`PdfConverter`, `DocxConverter`, `HtmlConverter`, …), and the
  `StreamInfo` / `DocumentConverterResult` data nodes. A colour **legend** appears
  bottom-right.
- **On camera:** **pan** (drag canvas) and **zoom** (scroll) to show it's live, not
  a picture. Hover a node to show the highlight.
- **Caption / VO:** *"Ask Copilot to diagram the codebase — and it opens as a live,
  interactive graph right inside VS Code."*

### Shot 1.2 — Explain a node
- **Click the `DocumentConverter` node** to select it (it gets a selection ring).
- **Type in the terminal:**
  ```
  explain this node
  ```
- **Expected:** Copilot calls `describe_node`, sees it's the base class connected to
  all the converters, and explains in the terminal: *"This is the abstract base
  every converter extends; it defines `accepts()` and `convert()`…"*
- **Alternative (pure-canvas):** open the node menu (click the node) and press the
  **Explain** button — same result without typing.
- **Caption / VO:** *"Click any node and Copilot knows exactly what you mean — it
  explains that exact piece of the system."*

> 🎯 **Best-of-markitdown beat:** explain the `MarkItDown` node instead to surface
> the priority-ordered converter registry — it's the cleverest part of the design.

---

## 3. Category 2 — **Expand + Undo**

**Goal:** grow a node into more detail with AI, then step back through history with
Undo/Redo and the version-history menu.

> Start from the diagram already on screen from Category 1 (or re-run Shot 1.1).

### Shot 2.1 — Expand a node with AI
- **Click the `PdfConverter` node**, then in its menu press **✨ Expand with AI**.
- In the **Expand node** dialog choose a **Type of expansion** — *Brief annotation
  / note*, *More detail (a few nodes)* (default), or *Full sub-graph* — set a
  **Depth** (1–3 levels), and optionally type a **Focus** like `accepts vs convert`.
  Press **Expand**.
- **Expected:** Copilot grows new child nodes off `PdfConverter` — e.g. its
  `accepts()` (mimetype/extension check) and `convert()` (pdfminer text extraction),
  wired in with new edges. The layout re-flows.
- **Alternative (CLI):** click the node and type `expand this node into its accepts and convert steps`.
- **Caption / VO:** *"Expand any node and the diagram grows new detail on demand —
  no refresh, no redraw from scratch."*

### Shot 2.2 — Undo / Redo
- Press **Ctrl+Z** (or open the **⋯ More** menu → **Undo**).
- **Expected:** the diagram returns to the **full previous version** — exactly the
  pre-expand graph, including the same zoom & pan.
- Press **Ctrl+Y** (or **⋯ → Redo**) to bring the expansion back.
- **Caption / VO:** *"Changed your mind? Undo and redo step you through the whole
  diagram's history — Ctrl+Z, Ctrl+Y, just like an editor."*

### Shot 2.3 — Jump through version history
- Click the **☰ history button** (left of the diagram title) to open the
  **version list**.
- **Expected:** a list of every version ("Architecture", "Expanded PdfConverter",
  …). **Click an earlier entry** to jump straight back to it and keep working from
  there.
- **Caption / VO:** *"Every version is saved — open the history menu and jump back
  to any earlier diagram in one click."*

> 🎯 **Best-of-markitdown beat:** expand `MarkItDown` itself to reveal the
> `_convert()` loop, undo it, then expand `ZipConverter` (it recursively re-enters
> MarkItDown) — a nice "wait, it calls itself?" moment, then Undo to reset.

---

## 4. Category 3 — **Search + Code reference**

**Goal:** find a node in a big graph by name, then jump from a node straight to its
source file in VS Code.

### Shot 3.1 — A bigger graph to search
- **Type in the terminal:**
  ```
  /diagram-dependency every built-in converter in markitdown and the base class they extend
  ```
- **Expected:** a wide graph — `DocumentConverter` with ~20 converter nodes
  (`PdfConverter`, `DocxConverter`, `XlsxConverter`, `PptxConverter`,
  `ImageConverter`, `AudioConverter`, `HtmlConverter`, `RssConverter`,
  `WikipediaConverter`, `YouTubeConverter`, `ZipConverter`, `CsvConverter`,
  `EpubConverter`, `OutlookMsgConverter`, …). Big enough that finding one by eye is
  annoying — which sets up search.

### Shot 3.2 — Search
- Click the **🔍 search button** (top controls) to open the search bar.
- **Type:** `pdf` → the matching node(s) highlight and the canvas centers on them;
  the counter shows `1/1`. Type `converter` to show many matches and use
  **Next ▸ / ◂ Prev** to cycle through them.
- **Caption / VO:** *"In a big diagram, search jumps you straight to any node or
  link by name."*

### Shot 3.3 — Code reference (canvas → source)
- **Click the `PdfConverter` node.** In its menu, under **Code references**, click
  the file row.
- **Expected:** VS Code **opens `packages/markitdown/src/markitdown/converters/_pdf_converter.py`**
  at the converter, right next to the canvas.
- **CLI alternative / linking on the fly:** click the node and type
  ```
  show me the code for this node
  ```
  Copilot calls `open_node_code`. If a node isn't linked yet, type
  `link this node to converters/_html_converter.py` and Copilot wires it with
  `link_node_to_code`, after which the **Code references** row appears.
- **Caption / VO:** *"Each node is linked to real code — click it and you land in
  the exact file in VS Code. The diagram is a map *into* your repo."*

> 🎯 **Best-of-markitdown beat:** link `MarkItDown` → `_markitdown.py` and
> `DocumentConverter` → `_base_converter.py`, then click between them to show the
> diagram doubling as a navigation surface for the codebase.

---

## 5. Category 4 — **Diagram types**

**Goal:** show that Canvas isn't just one graph — it renders the right *kind* of
diagram (dependency, flowchart, state machine, class, ER) with proper notation,
each from a real slice of MarkItDown.

> Record these back-to-back. Between each, the canvas replaces the previous diagram
> (use **Undo** / the **history menu** if you want to flip back during the take).

### 5.1 — Dependency graph
```
/diagram-dependency the markitdown core: MarkItDown depends on DocumentConverter and StreamInfo; each converter depends on DocumentConverter and produces DocumentConverterResult
```
**Shows:** modules and what they require (edges point dependent → dependency).

### 5.2 — Flowchart (the conversion pipeline)
```
/diagram-flowchart the _convert() pipeline: sort converters by priority, then for each converter check accepts() — if yes call convert() and return the DocumentConverterResult, if no try the next; if none accept, raise UnsupportedFormatException
```
**Shows:** the real control flow with **yes/no decision branches** — a faithful
picture of `_convert()` in `_markitdown.py`.

### 5.3 — State machine (one conversion attempt)
```
/diagram-state-machine the lifecycle of a single conversion: Idle → DetectingStreamInfo → CheckingAccepts → Converting → (Success | Unsupported | Failed), with events for accepts=true/false and convert ok/raises
```
**Shows:** states + transitions carrying the triggering **event** — the lifecycle a
file goes through.

### 5.4 — Class diagram (the converter hierarchy)
```
/diagram-class the converter hierarchy: abstract DocumentConverter with accepts() and convert(); PdfConverter, DocxConverter, HtmlConverter and ImageConverter inherit from it; DocumentConverterResult has markdown and title
```
**Shows:** UML inheritance arrows, attributes and methods — the OO shape of the
codebase.

### 5.5 — ER diagram (the data model)
```
/diagram-er the data model: a MarkItDown has many ConverterRegistration; a ConverterRegistration has one DocumentConverter and a priority; a conversion yields one DocumentConverterResult; StreamInfo describes the input
```
**Shows:** entities + **cardinality** on the relationships.

### 5.6 — Auto-detect (the umbrella command)
```
/diagram how a YouTube URL flows through markitdown to Markdown
```
**Shows:** the `/diagram` dispatcher **picking the type for you** (it'll choose a
flowchart here). Good closing beat — "you don't even have to pick the type."

- **Caption / VO:** *"Dependency graphs, flowcharts, state machines, class and ER
  diagrams — all with the right notation, all from your real code. And `/diagram`
  picks the type for you."*

---

## 6. Suggested narration (stitched read-through)

1. *"This is MarkItDown — a real Microsoft repo that turns any file into Markdown.
   Let's understand it with Canvas for Copilot."*
2. *"Ask Copilot to diagram the architecture, and it opens as a live graph in VS
   Code. Click the base converter — Copilot explains exactly that piece."*
3. *"Expand a node and the diagram grows new detail. Undo and redo walk the whole
   history; the history menu jumps to any earlier version."*
4. *"In a big graph, search finds any node instantly — and every node links to real
   code, so one click opens the exact file."*
5. *"And it speaks every diagram language: dependency, flowchart, state machine,
   class, ER — or let `/diagram` choose. See your code. Don't just read it."*

---

## 7. Recording checklist

- [ ] MarkItDown open in VS Code; Copilot CLI running in the integrated terminal
- [ ] Canvas tab + terminal both visible in frame (the loop!)
- [ ] `clip-visualize-explain.mp4` — Shots 1.1–1.2
- [ ] `clip-expand-undo.mp4` — Shots 2.1–2.3
- [ ] `clip-search-coderef.mp4` — Shots 3.1–3.3
- [ ] `clip-diagram-types.mp4` — Shots 5.1–5.6
- [ ] Drop clips in `public/clips/`; map them in `CLIP_SOURCES` in
      `src/CanvasForCopilot.tsx` if wiring into the Remotion cut
- [ ] Trim dead air at the start/end of each take; keep each ≤ ~45 s

---

## 8. Fallbacks if something misbehaves on camera

| Problem | Fix on the spot |
|---------|-----------------|
| Canvas tab doesn't open | Reload window (`Cmd/Ctrl+R`); re-run the prompt |
| `/diagram-*` skill not found | It's installed globally by the extension — restart the CLI, or use plain `diagram …`/`create a dependency diagram of …` phrasing |
| Diagram too dense | Add `keep it to ~8 nodes` to the prompt, or narrow the scope ("just the PDF/DOCX/HTML converters") |
| Expand adds too much | Press **Undo** (Ctrl+Z) and redo the expand with a smaller depth/focus |
| Node has no code link | Type `link this node to <path>` first, then click it |
