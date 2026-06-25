# Canvas for Copilot

Renders Copilot CLI diagrams as an interactive Cytoscape canvas tab in VS Code.

The extension hosts the Canvas MCP server in-process over a local HTTP endpoint
(`http://127.0.0.1:4123/mcp`) and opens the canvas as a webview tab. Copilot CLI,
running in the integrated terminal, connects to that endpoint to generate and
update diagrams.

## Use

1. Install the extension (F5 dev host, or install the packaged `.vsix`).
2. On activation, accept the one-time **Set up** prompt to register the Canvas MCP
   server with Copilot CLI (writes `~/.copilot/mcp-config.json`).
3. In the integrated terminal, start a Copilot CLI session and ask for a diagram
   (e.g. "diagram the auth flow"). The canvas opens beside the terminal.

Command: **Canvas for Copilot: Open Canvas** opens the example diagram directly.

See the repository `docs/SETUP.md` for full setup and packaging instructions.
