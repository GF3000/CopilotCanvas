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

1. **Install the VS Code extension** from `/extension` (e.g. `code --install-extension`
   the packaged `.vsix`, or run the Extension Development Host with F5 during dev).
2. **Register the Canvas MCP server** with Copilot CLI (its MCP config), pointing at
   the built server entry in `/server`, so the CLI can invoke the canvas tools.

## Run (development)

```bash
npm run dev     # rebuilds the server + canvas bundle + extension on change
```

Open VS Code, run Copilot CLI in the integrated terminal, and ask for a diagram —
the extension opens the canvas as a webview tab the first time a diagram is pushed.
No separate browser process or port is required for the primary path.

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

