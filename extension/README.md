# Canvas for Copilot

Renders Copilot CLI diagrams as an interactive Cytoscape canvas tab in VS Code.

The extension hosts the Canvas MCP server in-process over a local HTTP endpoint
(`http://127.0.0.1:4123/mcp`) and opens the canvas as a webview tab. Copilot CLI,
running in the integrated terminal, connects to that endpoint to generate and
update diagrams.

## Use

Two ways to run it:

- **Everyday use (recommended) — install the packaged extension:**
  ```bash
  npm install
  npm run package                              # → ./canvas-for-copilot.vsix
  code --install-extension canvas-for-copilot.vsix
  ```
  Reload VS Code; no F5 / dev host needed. (Bump `version` in this manifest before
  re-packaging a new release.)
- **Development — press F5** to launch an Extension Development Host from source.

After installing, on activation accept the one-time **Set up** prompt to register the
Canvas MCP server with Copilot CLI (writes `~/.copilot/mcp-config.json`), then in the
integrated terminal start a Copilot CLI session and ask for a diagram
(e.g. "diagram the auth flow"). The canvas opens beside the terminal.

Command: **Canvas for Copilot: Open Canvas** opens the example diagram directly.

See the repository `docs/SETUP.md` for full setup and packaging instructions.
