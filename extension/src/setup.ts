// One-time, consented setup of the Copilot CLI integration: registers the Canvas
// MCP server in ~/.copilot/mcp-config.json and adds the "always use the canvas tool
// for diagrams" instruction to ~/.copilot/copilot-instructions.md. Idempotent.
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DEFAULT_CANVAS_MCP_PORT } from '@canvas/server';

const DISMISS_KEY = 'canvasForCopilot.setupDismissed';
const MARKER_START = '<!-- canvas-for-copilot:start -->';
const MARKER_END = '<!-- canvas-for-copilot:end -->';

const INSTRUCTION_BLOCK = `${MARKER_START}
## Diagrams & visual explanations — always use Canvas for Copilot

When the user asks to draw, create, show, visualize, diagram, sketch, map,
illustrate, or explain anything visually or as a diagram / flow / graph / workflow —
or mentions "diagram", "draw", or "canvas" — you MUST call the Canvas for Copilot
MCP tool \`create_diagram\` (aliases: \`visualize\`, \`draw_diagram\`,
\`explain_with_diagram\`) to render it.

You MUST NOT produce an HTML page, an HTML <canvas> element, SVG, Mermaid, ASCII
art, or image files for this purpose. "canvas" here means the Canvas for Copilot tab
(the MCP tool), not an HTML <canvas> element. Call the tool directly without asking
for confirmation. If the tool isn't available, say so instead of substituting
another format.

When the user asks to edit/change/relabel/annotate/add to/remove from a diagram that
is ALREADY on the canvas, call \`update_diagram\` instead of \`create_diagram\` — it
edits in place and preserves the current view (pan/zoom/positions). When the user
refers to "this"/"the selected node"/"this link"/"it", call \`get_selection\` first
to learn which node or edge they clicked, then act on that id. To add an explanatory
note, add a node with kind "note" (sticky note) plus an optional dashed
\`annotation\` edge to the element it explains. Use colour to mean something: set a
node's role with \`kind\` consistently (entrypoint/service/module/datastore/external)
and outcomes with status classes (danger/success/warning); only set an explicit
\`style.color\` when the user asks for a specific colour.
${MARKER_END}`;

interface McpConfig {
  mcpServers?: Record<string, unknown>;
}

function copilotDir(): string {
  return path.join(os.homedir(), '.copilot');
}

function mcpConfigPath(): string {
  return path.join(copilotDir(), 'mcp-config.json');
}

function instructionsPath(): string {
  return path.join(copilotDir(), 'copilot-instructions.md');
}

function isMcpConfigured(): boolean {
  try {
    const cfg = JSON.parse(
      fs.readFileSync(mcpConfigPath(), 'utf8'),
    ) as McpConfig;
    return Boolean(cfg.mcpServers?.canvas);
  } catch {
    return false;
  }
}

function isInstructionConfigured(): boolean {
  try {
    return fs.readFileSync(instructionsPath(), 'utf8').includes(MARKER_START);
  } catch {
    return false;
  }
}

function ensureMcpConfig(): void {
  fs.mkdirSync(copilotDir(), { recursive: true });
  const file = mcpConfigPath();
  let cfg: McpConfig = { mcpServers: {} };
  if (fs.existsSync(file)) {
    try {
      cfg = (JSON.parse(fs.readFileSync(file, 'utf8')) as McpConfig) ?? {};
    } catch {
      throw new Error(
        'mcp-config.json is not valid JSON — not modifying it. Add the "canvas" server manually.',
      );
    }
  }
  cfg.mcpServers ??= {};
  if (!cfg.mcpServers.canvas) {
    cfg.mcpServers.canvas = {
      type: 'http',
      url: `http://127.0.0.1:${DEFAULT_CANVAS_MCP_PORT}/mcp`,
      tools: ['*'],
    };
    fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
  }
}

function ensureInstruction(): void {
  fs.mkdirSync(copilotDir(), { recursive: true });
  const file = instructionsPath();
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (existing.includes(MARKER_START)) return;
  const next = existing.trim().length
    ? `${existing.trimEnd()}\n\n${INSTRUCTION_BLOCK}\n`
    : `${INSTRUCTION_BLOCK}\n`;
  fs.writeFileSync(file, next);
}

/**
 * Offer (once) to set up the Copilot CLI integration. No-op if already configured
 * or previously dismissed.
 */
export async function ensureCopilotIntegration(
  context: vscode.ExtensionContext,
): Promise<void> {
  if (isMcpConfigured() && isInstructionConfigured()) return;
  if (context.globalState.get<boolean>(DISMISS_KEY)) return;

  const choice = await vscode.window.showInformationMessage(
    'Canvas for Copilot: register the MCP server with Copilot CLI and add the ' +
      '"always draw with the canvas" instruction?',
    'Set up',
    'Not now',
    "Don't ask again",
  );

  if (choice === "Don't ask again") {
    await context.globalState.update(DISMISS_KEY, true);
    return;
  }
  if (choice !== 'Set up') return;

  try {
    ensureMcpConfig();
    ensureInstruction();
    await context.globalState.update(DISMISS_KEY, true);
    void vscode.window.showInformationMessage(
      'Canvas for Copilot: Copilot CLI integration ready. Restart your Copilot CLI ' +
        'session to pick up the new server and instruction.',
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Canvas for Copilot setup failed: ${String(err)}`,
    );
  }
}
