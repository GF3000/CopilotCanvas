// One-time, consented setup of the Copilot CLI integration: registers the Canvas
// MCP server in ~/.copilot/mcp-config.json and adds the "always use the canvas tool
// for diagrams" instruction to ~/.copilot/copilot-instructions.md. Idempotent.
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DEFAULT_CANVAS_MCP_PORT } from '@canvas/server';

const DISMISS_KEY = 'canvasForCopilot.setupDismissed';
const SKILLS_VERSION_KEY = 'canvasForCopilot.skillsVersion';
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
to learn which node or edge they clicked, then act on that id. To explain/describe a
node (e.g. "explain this node"), call \`describe_node\` to get its context, then
explain it. To expand/drill into a node, first ask the user what KIND of expansion
(a brief annotation, more detail, or a full sub-graph) and HOW DEEP, then call
\`expand_node\` to add the new nodes in place. To jump to a node's source, link it with \`link_node_to_code\` (or pass
\`codeRefs\` when creating it) and open it with \`open_node_code\` when the user asks
to see the code for a node; if it isn't linked, say so. When a diagram describes
code in the current workspace/repo, set \`codeRefs\` on EVERY node that maps to real
code (inspect the repo to find the file/line/symbol) so each code-backed node is
clickable to its source — leave only purely conceptual nodes unlinked. To add an explanatory note,
add a node with kind "note" (sticky note) plus an optional dashed \`annotation\` edge
to the element it explains. Use colour to mean something: set a node's role with
\`kind\` consistently (entrypoint/service/module/datastore/external) and outcomes with
status classes (danger/success/warning); only set an explicit \`style.color\` when the
user asks for a specific colour.
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

function skillsDir(): string {
  return path.join(copilotDir(), 'skills');
}

/**
 * Locate the bundled skills shipped with the extension. A packaged .vsix bundles
 * them at `<extension>/dist/skills`; the F5 monorepo dev host falls back to the
 * repo's `<extension>/../.github/skills`.
 */
function bundledSkillsDir(extensionUri: vscode.Uri): string | undefined {
  const bundled = path.join(extensionUri.fsPath, 'dist', 'skills');
  if (fs.existsSync(bundled)) return bundled;
  const dev = path.join(extensionUri.fsPath, '..', '.github', 'skills');
  if (fs.existsSync(dev)) return dev;
  return undefined;
}

/** The `/diagram` dispatcher skill is our marker that the skills are installed. */
function areSkillsInstalled(): boolean {
  return fs.existsSync(path.join(skillsDir(), 'diagram', 'SKILL.md'));
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
 * Install the bundled `/diagram*` skills into `~/.copilot/skills/` so they are
 * available as slash commands in EVERY project. (The CLI only auto-discovers a
 * repo's own `.github/skills/` when you're working inside that repo; this is the
 * personal location it scans for all projects.) Overwrites our managed copies so
 * they stay current across extension upgrades.
 */
function ensureSkills(extensionUri: vscode.Uri): void {
  const src = bundledSkillsDir(extensionUri);
  if (!src) {
    throw new Error(
      'bundled skills not found — expected <extension>/dist/skills (packaged) or ../.github/skills (dev host).',
    );
  }
  const destRoot = skillsDir();
  fs.mkdirSync(destRoot, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(src, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const destDir = path.join(destRoot, entry.name);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(skillFile, path.join(destDir, 'SKILL.md'));
  }
}

/**
 * Offer (once) to set up the Copilot CLI integration. No-op if already configured
 * or previously dismissed. If the core integration was set up by an earlier version
 * but the `/diagram` skills are missing/stale, top them up silently (no re-prompt) —
 * it's the same integration the user already consented to.
 */
export async function ensureCopilotIntegration(
  context: vscode.ExtensionContext,
): Promise<void> {
  const version = String(context.extension.packageJSON.version ?? '0');
  const coreReady = isMcpConfigured() && isInstructionConfigured();
  const skillsReady =
    areSkillsInstalled() &&
    context.globalState.get<string>(SKILLS_VERSION_KEY) === version;

  if (coreReady && skillsReady) return;

  // Core integration already in place (consented to before): keep it complete and
  // the skills current without re-prompting.
  if (coreReady) {
    await installSkills(context, version);
    return;
  }

  if (context.globalState.get<boolean>(DISMISS_KEY)) return;

  const choice = await vscode.window.showInformationMessage(
    'Canvas for Copilot: register the MCP server with Copilot CLI, add the ' +
      '"always draw with the canvas" instruction, and install the /diagram skills ' +
      '(so they work in any project)?',
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
    ensureSkills(context.extensionUri);
    await context.globalState.update(SKILLS_VERSION_KEY, version);
    await context.globalState.update(DISMISS_KEY, true);
    void vscode.window.showInformationMessage(
      'Canvas for Copilot: Copilot CLI integration ready (MCP server, instruction, ' +
        'and /diagram skills installed). Restart your Copilot CLI session, then run ' +
        '/skills reload to pick up the new commands.',
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Canvas for Copilot setup failed: ${String(err)}`,
    );
  }
}

/** Install/refresh the bundled skills, recording the version. Non-fatal on failure. */
async function installSkills(
  context: vscode.ExtensionContext,
  version: string,
): Promise<void> {
  try {
    ensureSkills(context.extensionUri);
    await context.globalState.update(SKILLS_VERSION_KEY, version);
  } catch (err) {
    void vscode.window.showWarningMessage(
      `Canvas for Copilot: couldn't install the /diagram skills — ${String(err)}`,
    );
  }
}
