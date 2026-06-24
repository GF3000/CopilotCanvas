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

  // Host the MCP server so Copilot CLI can drive the canvas.
  try {
    httpServer = await startCanvasMcpHttpServer({
      port: DEFAULT_CANVAS_MCP_PORT,
      onOpenDiagram: (diagram) =>
        CanvasPanel.show(context.extensionUri, diagram),
      onPatchDiagram: (patch) => CanvasPanel.patch(patch),
      getSelection: () => CanvasPanel.getSelection(),
      getNodeContext: (id) => CanvasPanel.getNodeContext(id),
      linkNodeToCode: (id, ref) => CanvasPanel.linkNodeToCode(id, ref),
      openNodeCode: (id) => CanvasPanel.openNodeCode(id),
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

