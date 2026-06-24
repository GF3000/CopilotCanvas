// VS Code extension — hosts the Canvas MCP server in-process and renders the
// canvas tab (Pattern 1, ADR-007 addendum). Copilot CLI connects to the local
// HTTP MCP endpoint; the open_canvas tool opens the webview here.
import * as vscode from 'vscode';
import {
  startCanvasMcpHttpServer,
  getExampleDiagram,
  DEFAULT_CANVAS_MCP_PORT,
  type CanvasHttpServer,
} from '@canvas/server';
import type { CanvasToServerMessage } from '@canvas/shared';
import { CanvasPanel } from './canvasPanel';
import { ensureCopilotIntegration } from './setup';

let httpServer: CanvasHttpServer | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Manual command to open the example (handy for testing without the CLI).
  context.subscriptions.push(
    vscode.commands.registerCommand('canvasForCopilot.openCanvas', () => {
      CanvasPanel.show(context.extensionUri, getExampleDiagram());
    }),
  );

  // Trace channel + sink for events coming back from the canvas webview (KAN-17).
  const log = vscode.window.createOutputChannel('Canvas for Copilot');
  context.subscriptions.push(log);
  CanvasPanel.log = log;
  CanvasPanel.onCanvasEvent = (msg) => {
    // KAN-17 receives canvas → extension events here. KAN-18 will forward them
    // to the MCP server / Copilot CLI; for now, surface them so the round-trip
    // is observable in the "Canvas for Copilot" output channel.
    log.appendLine(`[canvas→ext] ${summarizeCanvasEvent(msg)}`);
  };

  // Host the MCP server so Copilot CLI can drive the canvas.
  try {
    httpServer = await startCanvasMcpHttpServer({
      port: DEFAULT_CANVAS_MCP_PORT,
      onOpenDiagram: (diagram) =>
        CanvasPanel.show(context.extensionUri, diagram),
      onPatchDiagram: (patch) => CanvasPanel.patch(patch),
      getSelection: () => CanvasPanel.getSelection(),
    });
    void vscode.window.showInformationMessage(
      `Canvas for Copilot: MCP server ready at ${httpServer.url}`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Canvas for Copilot: failed to start MCP server — ${String(err)}`,
    );
  }

  // Offer one-time setup of the Copilot CLI integration (mcp-config + instruction).
  void ensureCopilotIntegration(context);
}

export async function deactivate(): Promise<void> {
  await httpServer?.close();
}

/** Short, readable summary of a canvas event for the output channel. */
function summarizeCanvasEvent(msg: CanvasToServerMessage): string {
  switch (msg.type) {
    case 'node_selected':
      return `node_selected [${msg.nodeIds.join(', ')}]`;
    case 'interaction':
      return `interaction:${msg.action} [${msg.nodeIds.join(', ')}]${
        msg.text ? ` "${msg.text}"` : ''
      }`;
    case 'diagram_edited':
      return `diagram_edited (${msg.elements.length} elements)`;
    case 'error':
      return `error: ${msg.message}`;
    default:
      return msg.type;
  }
}

