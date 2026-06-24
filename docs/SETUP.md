# Setup & Run

> Environment setup and run instructions. Doubles as the demo runbook.
> (Commands assume the `repo-scaffold` task has been implemented.)

## Prerequisites

- **Node.js 20+** and npm
- **VS Code** (the primary host)
- **Copilot CLI** installed and authenticated, run in **VS Code's integrated terminal**
- The **Canvas VS Code extension** installed (from `/extension`) and the Canvas MCP
  server registered with Copilot CLI (see *Install the extension & register the server*)

## Environment variables

Copy `.env.example` to `.env` and fill in (most are optional for local use):

| Variable | Description | Example |
|-----------|-------------|---------|
| `CANVAS_LOG_LEVEL` | Server log verbosity | `info` |
| `CANVAS_DEBUG_WS_PORT` | Optional local-debug WebSocket fallback port (non-primary) | `4317` |

## Install

```bash
npm install
```

## Build

```bash
npm run build   # builds the MCP server, the /canvas bundle, and the /extension
```

## Install the extension & register the server

Architecture is **Pattern 1** (ADR-007 addendum): the VS Code extension **hosts the
Canvas MCP server in-process** over a local HTTP endpoint, and Copilot CLI connects
to it. So registration is just an `mcp-config.json` entry pointing at the extension.

1. **Register the Canvas MCP server** with Copilot CLI. Easiest: when you run the
   extension it **offers one-time setup** — click **"Set up"** and it registers the
   `canvas` server and adds the "always draw with the canvas" instruction for you.
   To do it manually instead, add to `~/.copilot/mcp-config.json`:
   ```json
   "canvas": { "type": "http", "url": "http://127.0.0.1:4123/mcp", "tools": ["*"] }
   ```
2. **Run the extension** (F5 dev host, or install the `.vsix`). On activation it
   starts the MCP server on `127.0.0.1:4123` and shows *"MCP server ready at …"*.

> **Reliable tool triggering:** this repo ships `.github/copilot-instructions.md`
> (and the extension can install a global copy) telling Copilot to **always** use the
> `create_diagram` canvas tool for any diagram/draw/visualize request and never emit
> HTML/Mermaid. Restart the CLI session after setup so it loads the instruction.

## Try the example diagram (prototype — first feature)

End-to-end "type in CLI → example diagram appears as a VS Code tab":

1. Open the repo in VS Code and press **F5** (builds canvas + extension, launches the
   Extension Development Host). Wait for the *"Canvas for Copilot: MCP server ready
   at http://127.0.0.1:4123/mcp"* notification.
2. In that dev-host window, open the **integrated terminal** and start a **Copilot
   CLI** session (restart it if it was already running, so it picks up the new
   `canvas` MCP server).
3. Type: **"open canvas for copilot"**. Copilot calls the `open_canvas` tool → the
   canvas opens as a **webview tab beside the terminal**, rendering the example
   Cytoscape graph.
4. Now generate your own: **"create a diagram to explain the workflow for obtaining
   a JWT for auth on a page"**. Copilot generates the graph and calls `create_diagram`
   → the canvas opens (if needed) and renders it.

The two prototype tools (both over the local MCP endpoint):
- **`open_canvas`** — opens the canvas and shows the fixed example diagram.
- **`create_diagram`** — Copilot generates a graph (title + nodes + edges) from your
  request and renders it; opens the canvas tab if it isn't already open.

There are also **specialised diagram tools/skills** built on `create_diagram` — one
per diagram type, each with its own notation (dependency, flowchart, state machine,
class, ER). Invoke them in natural language or with a `/` slash command
(`/diagram-flowchart …`, or `/diagram …` to auto-detect the type). After first run,
`/skills reload` in the CLI picks them up. See **`docs/DIAGRAM_TOOLS.md`** for the
full list, per-type input, notation, and how to test each one.

> Quick check without the CLI: run **Ctrl/Cmd+Shift+P → "Canvas for Copilot: Open
> Canvas"** — it opens the example diagram directly.

## Run (development)

```bash
npm run dev     # rebuilds the server + canvas bundle + extension on change
```

Open VS Code, run Copilot CLI in the integrated terminal, and ask for a diagram —
the extension opens the canvas as a webview tab the first time a diagram is pushed.
No separate browser process or port is required for the primary path.

## Testing the VS Code extension locally

You do **not** need the VS Code Marketplace (no publisher account / PAT). Three
local options:

**1. Extension Development Host (F5) — the dev loop.**
Open the repo in VS Code and press **F5** (launch config *"Run Canvas Extension"*).
A second VS Code window opens with the extension loaded from source (the
`build-extension` task bundles it first). In that window, run
**Ctrl/Cmd+Shift+P → "Canvas for Copilot: Open Canvas"**. Edit code, then reload the
dev-host window to pick up changes (or run the `watch-extension` task for rebuild on
save). Config lives in `.vscode/launch.json` + `.vscode/tasks.json`.

**2. Install a packaged `.vsix` — test as a user.**
```bash
npx @vscode/vsce package                       # → canvas-for-copilot-0.0.0.vsix
code --install-extension canvas-for-copilot-0.0.0.vsix
```
Good for end-to-end / demo recording. Uninstall from the Extensions panel.

**3. Automated tests (`@vscode/test-electron`).**
Headless VS Code that activates the extension and asserts behavior — add for CI once
there is real logic (KAN-17), not for the stub.

## Using it from Copilot CLI

1. Open your project in **VS Code** and start a **Copilot CLI** session in the
   **integrated terminal** (with the Canvas MCP server registered).
2. Ask, e.g., *"diagram the auth flow."*
3. The canvas opens as a **VS Code tab beside the terminal**; click nodes and issue
   follow-ups (*explain*, *expand*, *modify*) — see `docs/REQUIREMENTS.md` for
   supported interactions.

## Troubleshooting

- **Canvas tab didn't open:** confirm the Canvas extension is installed/activated and
  the MCP server is registered with the CLI; check the extension's Output channel and
  the CLI's MCP logs.
- **Blank canvas:** likely an invalid graph model — an error overlay should appear;
  the server should validate the `elements` model before sending (see
  `ARCHITECTURE.md`).
- **Canvas not updating:** check the webview `postMessage` channel in the extension's
  Output channel; the canvas should re-sync when the extension reloads the webview.

