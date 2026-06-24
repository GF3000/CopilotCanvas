// Manages the Canvas webview tab: loads the built /canvas bundle, sets a CSP,
// rewrites asset paths to webview URIs, and posts diagrams once the webview is
// ready (KAN-17 seed).
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import type { DiagramMessage, PatchMessage } from '@canvas/shared';

/** The element(s) currently selected on the canvas, resolved with their labels. */
export interface CanvasSelection {
  diagramId: string | undefined;
  ids: string[];
  elements: { id: string; label?: string; isEdge: boolean }[];
}

/** Rich context for a node so the model can explain it (KAN-8). */
export interface NodeContext {
  id: string;
  label?: string;
  kind?: string;
  classes?: string;
  incoming: { fromId: string; fromLabel?: string; edgeLabel?: string }[];
  outgoing: { toId: string; toLabel?: string; edgeLabel?: string }[];
}

interface NodeInfo {
  label?: string;
  kind?: string;
  classes?: string;
}
interface EdgeInfo {
  source: string;
  target: string;
  label?: string;
}

export class CanvasPanel {
  public static current: CanvasPanel | undefined;
  private static readonly viewType = 'canvasForCopilot';

  private readonly panel: vscode.WebviewPanel;
  private readonly canvasDistUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private readonly queue: unknown[] = [];
  private currentDiagramId: string | undefined;
  private selection: string[] = [];
  private readonly nodes = new Map<string, NodeInfo>();
  private readonly edges = new Map<string, EdgeInfo>();

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
      (msg: { type?: string; nodeIds?: unknown }) => {
        if (msg?.type === 'hello') {
          this.ready = true;
          this.flush();
        } else if (msg?.type === 'node_selected') {
          this.selection = Array.isArray(msg.nodeIds)
            ? msg.nodeIds.filter((id): id is string => typeof id === 'string')
            : [];
        }
      },
      null,
      this.disposables,
    );
  }

  /** The current canvas selection (empty if nothing selected / no canvas open). */
  static getSelection(): CanvasSelection {
    const panel = CanvasPanel.current;
    if (!panel) return { diagramId: undefined, ids: [], elements: [] };
    return {
      diagramId: panel.currentDiagramId,
      ids: [...panel.selection],
      elements: panel.selection.map((id) => ({
        id,
        label: panel.labelOf(id),
        isEdge: panel.edges.has(id),
      })),
    };
  }

  /**
   * Rich context for a node so the model can explain it: its label/kind/classes
   * and how it connects to neighbours. If `id` is omitted, uses the first selected
   * node. Returns undefined if there's no such node.
   */
  static getNodeContext(id?: string): NodeContext | undefined {
    const panel = CanvasPanel.current;
    if (!panel) return undefined;
    const targetId =
      id ?? panel.selection.find((s) => panel.nodes.has(s));
    if (!targetId) return undefined;
    const node = panel.nodes.get(targetId);
    if (!node) return undefined;

    const incoming: NodeContext['incoming'] = [];
    const outgoing: NodeContext['outgoing'] = [];
    for (const e of panel.edges.values()) {
      if (e.target === targetId) {
        incoming.push({
          fromId: e.source,
          fromLabel: panel.nodes.get(e.source)?.label,
          edgeLabel: e.label,
        });
      }
      if (e.source === targetId) {
        outgoing.push({
          toId: e.target,
          toLabel: panel.nodes.get(e.target)?.label,
          edgeLabel: e.label,
        });
      }
    }
    return {
      id: targetId,
      label: node.label,
      kind: node.kind,
      classes: node.classes,
      incoming,
      outgoing,
    };
  }

  private labelOf(id: string): string | undefined {
    return this.nodes.get(id)?.label ?? this.edges.get(id)?.label;
  }

  private indexElement(el: {
    data: Record<string, unknown>;
    classes?: string;
  }): void {
    const { id, label, source, target, kind } = el.data;
    if (typeof id !== 'string') return;
    if (source !== undefined || target !== undefined) {
      this.edges.set(id, {
        source: String(source),
        target: String(target),
        label: typeof label === 'string' ? label : undefined,
      });
    } else {
      this.nodes.set(id, {
        label: typeof label === 'string' ? label : undefined,
        kind: typeof kind === 'string' ? kind : undefined,
        classes: el.classes,
      });
    }
  }

  private render(diagram: DiagramMessage): void {
    this.currentDiagramId = diagram.diagramId;
    this.nodes.clear();
    this.edges.clear();
    for (const el of diagram.elements) this.indexElement(el);
    this.send(diagram);
  }

  private applyPatch(patch: PatchMessage): void {
    // Keep the graph index current so selection/context stay accurate after edits.
    for (const id of patch.remove) {
      this.nodes.delete(id);
      this.edges.delete(id);
      // Drop edges touching a removed node (Cytoscape removes them too).
      for (const [eid, e] of this.edges) {
        if (e.source === id || e.target === id) this.edges.delete(eid);
      }
      this.selection = this.selection.filter((s) => s !== id);
    }
    for (const el of patch.update) {
      const { id, label, kind } = el.data;
      if (typeof id !== 'string') continue;
      const node = this.nodes.get(id);
      if (node) {
        if (typeof label === 'string') node.label = label;
        if (typeof kind === 'string') node.kind = kind;
        if (el.classes) node.classes = el.classes;
      } else {
        const edge = this.edges.get(id);
        if (edge && typeof label === 'string') edge.label = label;
      }
    }
    for (const el of patch.add) this.indexElement(el);
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
