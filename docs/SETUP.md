# Setup & Run

> Environment setup and run instructions. Doubles as the demo runbook.
> (Commands assume the `repo-scaffold` task has been implemented.)

## Prerequisites

- **Node.js 20+** and npm
- An **MCP host that supports MCP Apps (SEP-1865)** — e.g. the Copilot CLI MCP
  client or the VS Code MCP client — installed and authenticated
- The Canvas MCP server registered with that host (see *Register the MCP server*)

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
npm run build   # builds the MCP server and the /canvas MCP App bundle
```

## Register the MCP server

Add the Canvas MCP server to your host's MCP configuration (e.g. the host's
`mcp.json` / settings), pointing at the built server entry in `/server`. Restart
or reload the host so it picks up the server and its MCP App resource.

## Run (development)

```bash
npm run dev     # rebuilds the server + canvas bundle on change
```

The host launches and renders the canvas App on demand the first time a diagram is
pushed — no separate browser process or port is required for the primary path.

## Using it from Copilot CLI

1. Start a Copilot CLI session (with the Canvas MCP server registered) in your
   project.
2. Ask, e.g., *"diagram the auth flow."*
3. The canvas opens in the host; click nodes and issue follow-ups (*explain*,
   *expand*, *modify*) — see `docs/REQUIREMENTS.md` for supported interactions.

## Troubleshooting

- **Canvas didn't open:** confirm the MCP server is registered and the host
  supports MCP Apps; check the host's MCP logs.
- **Blank canvas:** likely invalid Mermaid — an error overlay should appear; the
  server should validate Mermaid before sending (see `ARCHITECTURE.md`).
- **Canvas not updating:** check the MCP Apps channel in the host's logs; the
  canvas should re-sync when the channel re-initializes.

