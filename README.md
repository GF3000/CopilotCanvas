# Canvas for Copilot — Live Interactive Diagrams from the CLI

> Copilot CLI explains systems in text. **Canvas for Copilot** adds a second
> surface: a lightweight canvas that opens as a **VS Code tab** and stays connected
> to your CLI session over the Model Context Protocol (MCP Apps), turning those
> explanations into live, interactive Cytoscape graphs. You type in Copilot CLI (in
> VS Code's integrated terminal); the canvas sends interactions back as Copilot
> prompts — a bidirectional visual reasoning loop.
>
> See [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) for the full overview and
> the three delivery goals (Basic → Intermediate → Advanced).
>
> AI-driven project: these documents are authored first, refined by humans, then
> handed off to AI agents for autonomous implementation.

## 🚀 Getting started (for users)

**What it is.** Ask **Copilot CLI** to explain code and instead of a wall of text you
get a **live, interactive diagram** in a VS Code tab. Click a node to explain/expand
it, search it, jump to the real source, and undo/redo — all locally.

**What it can do**
- Turn any prompt into a diagram: **dependency, flowchart, state machine, class, ER**, or a generic graph.
- **Click a node** → explain it, **expand** it with AI, or **focus** its neighbours.
- **Search** big graphs, a colour **legend**, **undo/redo + history**, **export**.
- **Code links:** click a node to open the exact file; a node maps back to your repo.
- Runs **100% locally** in one VS Code window; works on **any repo**.

**Requirements:** VS Code, Node.js 20+, and Copilot CLI installed & signed in.

**1 · Install (clone → build the extension)**
```bash
git clone https://github.com/GF3000/CopilotCanvas && cd CopilotCanvas
npm install
npm run package          # builds + writes ./canvas-for-copilot.vsix
code --install-extension canvas-for-copilot.vsix
```

**2 · First run.** Restart VS Code. The extension installs like any other — you'll
find **Canvas for Copilot** in the **Extensions** panel (`Ctrl/Cmd+Shift+X`, search
"Canvas"). On first activation it shows a one-time **Set up** notification — click
**OK** and it registers the Canvas MCP server with Copilot CLI (writes
`~/.copilot/mcp-config.json`). That's it — no F5, no dev window.

**3 · Use it.** Open any project, start `copilot` in the integrated terminal, and ask
for a diagram — the canvas opens beside the terminal. Then **click nodes** and tell
Copilot what to do; the diagram updates live. (See [`docs/SETUP.md`](docs/SETUP.md)
for details / the F5 dev loop.)

**Example prompts (any repo)**
```
diagram the architecture of this project
/diagram-flowchart the login flow
/diagram-state-machine the order lifecycle
/diagram-class the models in src/
/diagram-er the database schema
explain this node          # after clicking a node
expand this node           # grows new detail
show me the code for this  # opens the file
```
Tip: `/diagram <anything>` auto-picks the best type. Keep diagrams ~4–12 nodes.

## 👉 Contributors start here: [`AGENTS.md`](AGENTS.md)

**Before doing anything else, read [`AGENTS.md`](AGENTS.md).** It holds the
mandatory rules every contributor (human or AI) must follow — including the
**task-tracking workflow**, git/PR conventions,
and the definition of done. Then continue with the document map below.

## How to use this repo

1. **Read [`AGENTS.md`](AGENTS.md) first** — mandatory conventions & the
   task-tracking workflow.
2. Read the documents in [`docs/`](docs/) in order (see below).
3. Pick a task in `docs/TASKS.md`, claim it, and implement it.
4. Self-validate against `docs/TEST_PLAN.md` and keep `docs/TASKS.md` updated.

## Document map

| Order | Document | Purpose |
|-------|----------|---------|
| 0 | [`AGENTS.md`](AGENTS.md) | **Read first** — mandatory conventions, task workflow, DoD |
| 1 | [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) | The **why** — problem, pitch, scope |
| 2 | [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | The **what** — features & acceptance criteria |
| 3 | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The **how** — stack, components, diagrams |
| 4 | [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Entities, schemas, API contracts |
| 5 | [`docs/TASKS.md`](docs/TASKS.md) | Decomposed, ordered work items |
| 6 | [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) | What to test and how to verify |
| – | [`docs/DECISIONS.md`](docs/DECISIONS.md) | Log of why choices were made |
| – | [`docs/COMPETITIVE_LANDSCAPE.md`](docs/COMPETITIVE_LANDSCAPE.md) | Prior art & adjacent tools |
| – | [`docs/SETUP.md`](docs/SETUP.md) | Env setup & run instructions |
| – | [`docs/DIAGRAM_TOOLS.md`](docs/DIAGRAM_TOOLS.md) | The diagram tools/skills (dependency, flowchart, state machine, class, ER) + drill-down |
| – | [`examples/shopflow/`](examples/shopflow/) | Example project to **try the diagram tools** — see its [`TEST_PROMPTS.md`](examples/shopflow/TEST_PROMPTS.md) |

## Suggested flow

```
PROJECT_BRIEF → REQUIREMENTS → ARCHITECTURE + DATA_MODEL → TASKS → implement → TEST_PLAN
```

## License

This project is licensed under the [MIT License](LICENSE).

