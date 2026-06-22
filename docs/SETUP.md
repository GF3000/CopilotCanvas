# Setup & Run

> Environment setup and run instructions. Doubles as the demo runbook.
> (Commands assume the `repo-scaffold` task has been implemented.)

## Prerequisites

- **Node.js 20+** and npm
- **Copilot CLI** installed and authenticated (the skill plugs into a CLI session)
- A modern browser (the canvas opens automatically)

## Environment variables

Copy `.env.example` to `.env` and fill in (most are optional for local use):

| Variable | Description | Example |
|-----------|-------------|---------|
| `CANVAS_PORT` | Preferred localhost port (auto-selects a free one if taken) | `4317` |
| `CANVAS_HOST` | Bind address — keep loopback | `127.0.0.1` |
| `CANVAS_AUTO_OPEN` | Open the browser on first diagram | `true` |

## Install

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

This builds the `/canvas` bundle and starts the local HTTP + WebSocket server on
`127.0.0.1:<port>`. The canvas opens automatically the first time the skill pushes
a diagram.

## Build (production)

```bash
npm run build
```

## Using it from Copilot CLI

1. Start a Copilot CLI session in your project.
2. Ask, e.g., *"diagram the auth flow."*
3. The canvas tab opens; click nodes and issue follow-ups (*explain*, *expand*,
   *modify*) — see `docs/REQUIREMENTS.md` for supported interactions.

## Troubleshooting

- **Browser didn't open:** check the printed URL and open it manually; set
  `CANVAS_AUTO_OPEN=true`.
- **Port already in use:** the server auto-selects a free port; check the logged URL.
- **Blank canvas:** likely invalid Mermaid — an error overlay should appear; check
  the CLI output for the generated source.
- **Canvas not updating:** confirm the WebSocket connected (devtools console); it
  should auto-reconnect.
