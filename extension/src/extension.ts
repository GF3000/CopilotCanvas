// VS Code extension — scaffold stub (KAN-5).
// The real bridge (open webview tab + MCP Apps postMessage channel + relay) lands
// in KAN-17 (vscode-extension) and KAN-18 (mcp-app-launch).
import * as vscode from 'vscode';
import { PROTOCOL_VERSION } from '@canvas/shared';

export function activate(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'canvasForCopilot.openCanvas',
    () => {
      void vscode.window.showInformationMessage(
        `Canvas for Copilot (protocol v${PROTOCOL_VERSION})`,
      );
    },
  );
  context.subscriptions.push(command);
}

export function deactivate(): void {
  // no-op
}
