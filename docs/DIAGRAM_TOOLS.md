# Diagram-type skills (MCP tools)

Canvas for Copilot exposes one **generic** diagram tool (`create_diagram`) plus a
set of **specialised diagram skills** — one per common diagram type. Each skill is
a dedicated MCP tool with a tuned description, so a natural-language request like
*"show the dependency graph of the auth module"* or *"draw the state machine for an
order"* routes Copilot to the right tool. They all build on the same Cytoscape
graph model and render through the shared `buildDiagram` path (KAN-19), so edge
validation, the auto-layout, selection, "explain", and "jump to code" all work
identically for every type.

| Skill (primary tool) | Aliases | Jira | What it renders |
|----------------------|---------|------|-----------------|
| `diagram_dependency` | `dependency_diagram` | KAN-20 | Modules/services + "depends on" edges (cycles OK) |
| `diagram_flowchart` | `flowchart` | KAN-21 | Steps + decisions with labeled branches |
| `diagram_state_machine` | `state_diagram`, `state_machine` | KAN-22 | States + event-labeled transitions; initial/final marked |
| `diagram_class` | `class_diagram` | KAN-23 | UML classes + relations with distinct arrowheads |
| `diagram_er` | `er_diagram`, `entity_relationship_diagram` | KAN-24 | Entities + cardinality-labeled relationships |

> The model **generates the graph** and passes it to the tool; the tool converts it
> to the protocol's Cytoscape `elements` and renders it. As with `create_diagram`,
> these tools are read-only/safe, open the canvas tab if it's closed, and update it
> in place if it's open. Edges that reference unknown node ids are dropped and
> reported (they never blank the canvas).

## Invoking with `/` (Copilot CLI slash-command skills)

Each diagram type is **also** exposed as a Copilot CLI **skill** so you can invoke it
explicitly with a `/` slash command (instead of relying on Copilot to pick the tool
from a free-text request). The skills live in `.github/skills/` (repo-shared) and are
marked `user-invocable: true`, so they appear under `/`:

| Slash command | Renders | MCP tool it calls |
|---------------|---------|-------------------|
| `/diagram <what>` | **auto-detects** the type from your request, then routes | the matching tool below (or `create_diagram`) |
| `/diagram-dependency <what>` | dependency / architecture graph | `diagram_dependency` |
| `/diagram-flowchart <what>` | flowchart | `diagram_flowchart` |
| `/diagram-state-machine <what>` | state machine | `diagram_state_machine` |
| `/diagram-class <what>` | UML class diagram | `diagram_class` |
| `/diagram-er <what>` | entity/relationship diagram | `diagram_er` |

`/diagram` is the **umbrella dispatcher**: it reads your request, detects the diagram
type (by the type you name and/or the shape of what you describe), and calls the
matching tool — falling back to `create_diagram` for anything that isn't one of the
five types. The explicit `/diagram-<type>` commands **force** a specific type. So
`/diagram a flowchart for login` and `/diagram-flowchart for login` both render a
flowchart; `/diagram the data model for sales` auto-routes to the ER tool.

Example: `/diagram-state-machine an order: new → paid → shipped → delivered`.

Each skill is a directory with a `SKILL.md` (YAML frontmatter `name` + `description`
+ `user-invocable: true`, then a prompt body). The body tells Copilot how to build a
well-formed graph for that type and to render it through the matching MCP tool. After
adding or editing a skill, run `/skills reload` in the CLI (or `/skills list` to
confirm it loaded). Skills are also discoverable from other locations Copilot scans —
project `.github/skills/`, `.agents/skills/`, `.claude/skills/`; personal
`~/.copilot/skills/`.


## Architecture

```
LLM-friendly typed input ──▶ builder (server/src/diagramTypes.ts) ──▶ DiagramInput
                                                                          │
                                                       buildDiagram (server/src/diagram.ts)
                                                                          │
                                                       diagram message (shared protocol)
                                                                          │
                                                       canvas render (canvas/src/main.ts)
```

- **`server/src/diagramTypes.ts`** — pure builder functions, one per type, mapping a
  type-specific input to the flat `{title, nodes, edges}` `DiagramInput`. They apply
  the type's conventions: semantic `kind`s, style `classes`, and edge labels.
- **`server/src/mcpServer.ts`** — registers each tool (`registerTypedDiagramTools`)
  with its Zod `inputSchema` and tuned description.
- **`canvas/src/main.ts`** — stylesheet selectors that give each type its
  conventional **notation** (shapes + arrowheads) while keeping the shared violet
  palette (see *Notation per type* below).

No protocol shapes changed — `shared/protocol.ts` is untouched (append-only contract).
The notation rides on the existing `kind` / `classes` fields; the typed builders emit
internal notation classes (e.g. `fc-process`, `uml-class`, `inheritance`) that the
canvas stylesheet styles. These are server-internal — they are **not** part of the
model-facing `create_diagram` class vocabulary (D14).

## Notation per type

Each type uses its conventional shapes/arrowheads, but stays on the same violet
palette + fonts so the canvas looks cohesive.

| Type | Node shapes | Edge / arrowhead |
|------|-------------|------------------|
| Dependency | rounded boxes (module/service/external colour) | solid arrow → dependency |
| Flowchart | terminator = **pill**, process = **rectangle**, decision = **diamond**, io = **parallelogram** | solid arrow; decision branches labeled |
| State machine | rounded states; **initial** = emerald fill, **final** = double border | **open (stick)** arrow, event-labeled |
| Class | **sharp rectangle** class boxes | UML arrowheads — see below |
| ER | **sharp rectangle** entity boxes | plain line, cardinality in the label |

## Per-type conventions

### Dependency (`diagram_dependency`, KAN-20)
- **Nodes**: `kind` `module` (default), `service`, or `external`.
- **Edges**: `dependencies: [{ from, to }]` — `from` *depends on* `to`. Direction
  carries the meaning; an optional `label` is allowed.
- **Scope (level)**: optional `scope` — `package` | `module` | `function` | `service`
  — drawn at the granularity the prompt asks for (e.g. "package-level deps", "a call
  graph"). It sets the **default node `kind`** (`service` scope → `service` nodes, else
  `module`); a per-node `kind` still wins. The model picks the actual nodes at that
  level and should reflect it in the title (e.g. "Server call graph").
- **Cycles** render fine (dagre handles them).

### Flowchart (`diagram_flowchart`, KAN-21)
- **Nodes** carry a `type`, each drawn with its standard flowchart symbol:
  - `start` / `end` — **terminator** (rounded pill); `start` is the entry-point
    colour, `end` an emerald "done" fill.
  - `step` (default) — **process** (sharp rectangle).
  - `decision` — **diamond**.
  - `io` — **parallelogram** (input/output).
- **Edges**: label the edges out of a `decision` with the branch (`"yes"`/`"no"`).

### State machine (`diagram_state_machine`, KAN-22)
- **States**: set `initial: true` on the start state (bright emerald fill) and
  `final: true` on accepting states (thick double border).
- **Transitions**: drawn with an **open (stick) arrowhead** (UML convention); `event`
  labels each transition with its trigger/condition.

### Class diagram (`diagram_class`, KAN-23)
- **Classes**: drawn as **sharp-cornered UML boxes**; optional `attributes` and
  `methods` lines are **folded into the node label** (see the limitation below).
- **Relations**: `type` is one of `inheritance`, `realization`, `association`,
  `dependency`, `aggregation`, `composition`. All share one neutral violet line and
  differ by arrowhead + line-style (the UML convention):
  - `inheritance` (generalization) — solid line, hollow ▷ triangle at the
    **superclass** (`to`); set `from` = subclass, `to` = superclass.
  - `realization` (implements) — **dashed** line, hollow ▷ triangle at the interface
    (`to`).
  - `association` — solid line, plain → (vee) arrow at `to`.
  - `dependency` («use») — **dashed** line, plain → (vee) arrow at `to`.
  - `aggregation` — solid line, hollow ◇ diamond at the **whole/owner** (`from`).
  - `composition` — solid line, filled ◆ diamond at the **whole/owner** (`from`).

  **Limitation (documented per KAN-23):** Cytoscape has no UML *compartments*, so
  attributes/methods appear as extra lines inside the node box (separated by a rule),
  not in separate attribute/method sections. The relation **kind is fully
  distinguishable** via the custom arrowheads added in `canvas/src/main.ts`.

### Entity / relationship (`diagram_er`, KAN-24)
- **Entities**: `kind: datastore`, drawn as **sharp-cornered "table" boxes**; optional
  `attributes` (e.g. keys) are surfaced under the entity name.
- **Relationships**: drawn as a **plain line** (no arrowhead); the `cardinality`
  (`"1"`, `"N"`, `"1:N"`, `"M:N"`) labels the edge, combined with an optional verb
  `label` → e.g. `places (1:N)`. (Cytoscape has no crow's-foot endpoints, so
  cardinality is shown as a label.)

## Drill-down: Expand an element / Back to previous scope

Any diagram supports **client-side drill-down** so you can focus one element without
regenerating the diagram:

- **Right-click a node → "Expand element"** — re-renders a **sub-scope** showing just
  that node and its directly-connected neighbours (the same elements, kinds, classes
  and notation — it stays the same diagram type), and re-runs the layout to fill the
  view. Only offered when the node actually has neighbours.
- **"Back to previous scope"** — a breadcrumb button that appears next to the diagram
  title once you've expanded; it pops back to the previous scope. Expansions nest
  (you can drill in repeatedly), and Back steps out one level at a time.

This is **all in the canvas** (`canvas/src/scope.ts` + `canvas/src/main.ts`): no model
round-trip, so it's instant. A fresh diagram pushed by the host (e.g. you ask Copilot
for a new diagram, or a deeper one) resets the scope stack — it's a new top-level
scope. For genuinely *new* detail (more nodes than the parent had), ask Copilot to
regenerate at a deeper level — e.g. `diagram_dependency` with a finer `scope`
(package → module → function).

## How to test

### Automated
Unit tests for every builder live in `server/src/diagramTypes.test.ts` (kinds,
classes, edge labels, cycles, dropped edges, class label folding, ER cardinality,
dependency scope) and the drill-down logic in `canvas/src/scope.test.ts`:

```bash
npm test           # runs the whole vitest suite
npm run build      # typechecks server + canvas + extension and bundles
npm run lint
```

### Manual (in VS Code)
1. `npm install` then `npm run dev` (starts the canvas bundle + server + extension
   watchers), or run the extension via the **Run Extension** launch config.
2. In the Copilot CLI (integrated terminal), try a prompt per type — Copilot should
   pick the matching tool automatically:
   - *"Show the dependency graph of the server modules"* → `diagram_dependency`
   - *"Draw a flowchart for handling an HTTP request with a cache check"* →
     `diagram_flowchart` (process rectangles, decision **diamond**, yes/no branches;
     try an `io` read/write step for a parallelogram)
   - *"Draw the state machine for an order: new → paid → shipped → delivered"* →
     `diagram_state_machine` (initial state marked, **open** transition arrows labeled)
   - *"Draw a class diagram for Animal, Dog (inherits), Repo (implements IRepo),
     Owner (composition)"* → `diagram_class` (sharp boxes; hollow-triangle inheritance,
     **dashed** realization, diamond composition)
   - *"Draw an ER diagram for Customer 1:N Order, Order N:M Product"* → `diagram_er`
     (sharp entity boxes, cardinality on the plain relationship lines)
3. Verify: the canvas tab opens (or updates in place), each type renders with its
   conventional **notation** (shapes + arrowheads), and clicking a node still supports
   *explain* / *jump to code*.
4. **Drill-down:** right-click a node with neighbours → **Expand element** — the view
   focuses that node + its connections; a **Back** button appears by the title and
   returns to the previous scope. Drill in again to nest; Back steps out one level.

## Acceptance criteria coverage

- **KAN-20** — directed dependency diagram renders; cycles render without error. ✅
- **KAN-21** — readable directed flowchart with labeled decision branches (diamond
  decisions, terminator/process/io shapes); edges to unknown nodes handled gracefully
  (dropped + reported). ✅
- **KAN-22** — states with labeled (open-arrow) transitions and a clearly marked
  initial state (+ final states). ✅
- **KAN-23** — classes with relations; inheritance / realization / association /
  dependency / aggregation / composition visually distinguishable via distinct UML
  arrowheads and dashed/solid lines; compartment limitation documented. ✅
- **KAN-24** — entities (table boxes) with cardinality-labeled relationship edges. ✅
