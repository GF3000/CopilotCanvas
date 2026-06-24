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

## 👉 Start here: [`AGENTS.md`](AGENTS.md)

**Before doing anything else, read [`AGENTS.md`](AGENTS.md).** It holds the
mandatory rules every contributor (human or AI) must follow — including the
**required Jira (KAN) MCP setup and board-update workflow**, git/PR conventions,
and the definition of done. Then continue with the document map below.

## How to use this repo

1. **Read [`AGENTS.md`](AGENTS.md) first** — mandatory conventions & the Jira
   tracking workflow.
2. Read the documents in [`docs/`](docs/) in order (see below).
3. Pick a task on the Jira **KAN** board (mirrored in `docs/TASKS.md`), claim it,
   and implement it.
4. Self-validate against `docs/TEST_PLAN.md` and keep the KAN task updated.

## Document map

| Order | Document | Purpose |
|-------|----------|---------|
| 0 | [`AGENTS.md`](AGENTS.md) | **Read first** — mandatory conventions, Jira workflow, DoD |
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
