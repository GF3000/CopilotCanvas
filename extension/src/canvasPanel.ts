// Manages the Canvas webview tab: loads the built /canvas bundle, sets a CSP,
// rewrites asset paths to webview URIs, and posts diagrams once the webview is
// ready (KAN-17 seed).
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import {
  isHelloMessage,
  isNodeSelectedMessage,
  type CanvasToServerMessage,
  type DiagramMessage,
  type PatchMessage,
} from '@canvas/shared';

/** The node(s) currently selected on the canvas, resolved with their labels. */
export interface CanvasSelection {
  diagramId: string | undefined;
  nodeIds: string[];
  nodes: { id: string; label?: string }[];
}

export class CanvasPanel {
  public static current: CanvasPanel | undefined;
  /**
   * Sink for events coming back from the canvas webview (KAN-17). The extension
   * sets this; KAN-18 will forward the events on to the MCP server / Copilot CLI.
   */
  public static onCanvasEvent:
    | ((msg: CanvasToServerMessage) => void)
    | undefined;
  /** Optional channel for tracing canvas ↔ extension messages. */
  public static log: vscode.OutputChannel | undefined;
  private static readonly viewType = 'canvasForCopilot';

  private readonly panel: vscode.WebviewPanel;
  private readonly canvasDistUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private readonly queue: unknown[] = [];
  private currentDiagramId: string | undefined;
  private selection: string[] = [];
  private readonly nodeLabels = new Map<string, string>();

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
      (raw: unknown) => this.handleMessage(raw),
      null,
      this.disposables,
    );
  }

  /** The current canvas selection (empty if nothing selected / no canvas open). */
  static getSelection(): CanvasSelection {
    const panel = CanvasPanel.current;
    if (!panel) return { diagramId: undefined, nodeIds: [], nodes: [] };
    return {
      diagramId: panel.currentDiagramId,
      nodeIds: [...panel.selection],
      nodes: panel.selection.map((id) => ({
        id,
        label: panel.nodeLabels.get(id),
      })),
    };
  }

  private render(diagram: DiagramMessage): void {
    this.currentDiagramId = diagram.diagramId;
    // Rebuild the id→label map so selection can be resolved to labels.
    this.nodeLabels.clear();
    for (const el of diagram.elements) {
      const { id, label, source, target } = el.data;
      if (typeof id === 'string' && source === undefined && target === undefined) {
        this.nodeLabels.set(id, typeof label === 'string' ? label : id);
      }
    }
    this.send(diagram);
  }

  private applyPatch(patch: PatchMessage): void {
    // Keep the label map current so selection labels stay accurate after edits.
    for (const id of patch.remove) {
      this.nodeLabels.delete(id);
      this.selection = this.selection.filter((s) => s !== id);
    }
    for (const el of [...patch.update, ...patch.add]) {
      const { id, label, source, target } = el.data;
      if (typeof id === 'string' && source === undefined && target === undefined) {
        if (typeof label === 'string') this.nodeLabels.set(id, label);
        else if (!this.nodeLabels.has(id)) this.nodeLabels.set(id, id);
      }
    }
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

  /**
   * Handle a message coming back from the webview (canvas → extension). The
   * `hello` handshake is consumed here (mark ready + send any buffered diagram);
   * every other event is handed to `onCanvasEvent` for routing.
   */
  private handleMessage(raw: unknown): void {
    const msg = raw as CanvasToServerMessage;
    if (!msg || typeof msg.type !== 'string') return;

    if (isHelloMessage(msg)) {
      this.ready = true;
      CanvasPanel.log?.appendLine(
        `[canvas→ext] hello (client=${msg.client}, protocol=${msg.protocol})`,
      );
      this.flush();
      return;
    }

    // Track the current selection so CanvasPanel.getSelection() (the server's
    // get_selection tool, KAN-7) reflects what's on screen.
    if (isNodeSelectedMessage(msg)) {
      this.selection = msg.nodeIds;
    }

    // node_selected / interaction / diagram_edited / error / ack — let the
    // extension decide what to do (KAN-18 forwards these to Copilot).
    CanvasPanel.onCanvasEvent?.(msg);
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
