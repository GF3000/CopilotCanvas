// Manages the Canvas webview tab: loads the built /canvas bundle, sets a CSP,
// rewrites asset paths to webview URIs, and posts diagrams once the webview is
// ready (KAN-17 seed).
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import type { DiagramMessage, PatchMessage } from '@canvas/shared';

export class CanvasPanel {
  public static current: CanvasPanel | undefined;
  private static readonly viewType = 'canvasForCopilot';

  private readonly panel: vscode.WebviewPanel;
  private readonly canvasDistUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private readonly queue: unknown[] = [];
  private currentDiagramId: string | undefined;

  /** Open (or reveal) the canvas tab and render the given diagram. */
  static show(extensionUri: vscode.Uri, diagram: DiagramMessage): void {
    // In the monorepo the built canvas lives at ../canvas/dist relative to /extension.
    const canvasDistUri = vscode.Uri.joinPath(extensionUri, '..', 'canvas', 'dist');

    if (CanvasPanel.current) {
      CanvasPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      CanvasPanel.current.render(diagram);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CanvasPanel.viewType,
      'Canvas for Copilot',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [canvasDistUri],
      },
    );

    CanvasPanel.current = new CanvasPanel(panel, canvasDistUri);
    CanvasPanel.current.render(diagram);
  }

  /**
   * Apply an in-place patch to the open canvas. Returns false if no canvas tab is
   * open (nothing to edit), so the caller can fall back to creating a diagram.
   */
  static patch(patch: PatchMessage): boolean {
    if (!CanvasPanel.current) return false;
    CanvasPanel.current.applyPatch(patch);
    return true;
  }

  private constructor(panel: vscode.WebviewPanel, canvasDistUri: vscode.Uri) {
    this.panel = panel;
    this.canvasDistUri = canvasDistUri;
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: { type?: string }) => {
        if (msg?.type === 'hello') {
          this.ready = true;
          this.flush();
        }
      },
      null,
      this.disposables,
    );
  }

  private render(diagram: DiagramMessage): void {
    this.currentDiagramId = diagram.diagramId;
    this.send(diagram);
  }

  private applyPatch(patch: PatchMessage): void {
    // Stamp the live diagram id so the patch targets what's on screen.
    this.send({ ...patch, diagramId: this.currentDiagramId ?? patch.diagramId });
  }

  private send(message: unknown): void {
    this.queue.push(message);
    if (this.ready) this.flush();
  }

  private flush(): void {
    while (this.queue.length > 0) {
      void this.panel.webview.postMessage(this.queue.shift());
    }
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const indexPath = vscode.Uri.joinPath(this.canvasDistUri, 'index.html');
    let html = fs.readFileSync(indexPath.fsPath, 'utf8');

    // Rewrite relative asset paths (Vite base './') to webview URIs.
    html = html
      .replace(/(src|href)="([^"]+)"/g, (match, attr: string, path: string) => {
        if (/^(https?:|data:|vscode-)/.test(path)) return match;
        const clean = path.replace(/^\.?\//, '');
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(this.canvasDistUri, clean),
        );
        return `${attr}="${uri}"`;
      })
      .replace(/\s+crossorigin/g, '');

    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource}`,
      `font-src ${webview.cspSource} data:`,
    ].join('; ');
    const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

    return html.replace(/<head>/, `<head>\n    ${meta}`);
  }

  private dispose(): void {
    CanvasPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}
