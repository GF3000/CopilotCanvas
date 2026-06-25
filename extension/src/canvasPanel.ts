// Manages the Canvas webview tab: loads the built /canvas bundle, sets a CSP,
// rewrites asset paths to webview URIs, and posts diagrams once the webview is
// ready (KAN-17 seed).
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import type { CodeRef, DiagramMessage, PatchMessage } from '@canvas/shared';

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
  codeRefs?: CodeRef[];
}
interface EdgeInfo {
  source: string;
  target: string;
  label?: string;
}

/** What we persist so the canvas can be rebuilt after a full window reload. */
interface PersistedState {
  diagram: DiagramMessage;
  patches: PatchMessage[];
}

export class CanvasPanel {
  public static current: CanvasPanel | undefined;
  /** Optional channel for tracing canvas → extension messages (KAN-17). */
  public static log: vscode.OutputChannel | undefined;
  private static readonly viewType = 'canvasForCopilot';
  private static context: vscode.ExtensionContext | undefined;
  private static readonly stateKey = 'canvasForCopilot.canvasState';

  private readonly panel: vscode.WebviewPanel;
  private readonly canvasDistUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private readonly queue: unknown[] = [];
  private currentDiagramId: string | undefined;
  // Last full diagram + the patches applied since, persisted so the canvas can be
  // replayed after a webview reload or a full window reload instead of going blank
  // (FR-4 / NFR-4 / TC-7).
  private lastDiagram: DiagramMessage | undefined;
  private readonly patches: PatchMessage[] = [];
  private selection: string[] = [];
  private readonly nodes = new Map<string, NodeInfo>();
  private readonly edges = new Map<string, EdgeInfo>();

  /**
   * Enable reload recovery: remember the extension context and register a webview
   * serializer so VS Code restores the canvas tab after a window reload, replaying
   * the persisted diagram. Call once from `activate`.
   */
  static register(context: vscode.ExtensionContext): void {
    CanvasPanel.context = context;
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(CanvasPanel.viewType, {
        deserializeWebviewPanel(panel: vscode.WebviewPanel): Thenable<void> {
          const distUri = vscode.Uri.joinPath(
            context.extensionUri,
            '..',
            'canvas',
            'dist',
          );
          const revived = new CanvasPanel(panel, distUri);
          CanvasPanel.current = revived;
          const saved = context.workspaceState.get<PersistedState>(
            CanvasPanel.stateKey,
          );
          if (saved?.diagram) {
            revived.render(saved.diagram);
            for (const p of saved.patches ?? []) revived.applyPatch(p);
          }
          return Promise.resolve();
        },
      }),
    );
  }

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
    // Re-assert options (a restored panel may come back without them).
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [canvasDistUri],
    };
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: {
        type?: string;
        nodeIds?: unknown;
        action?: unknown;
        nodeId?: unknown;
        refIndex?: unknown;
        mode?: unknown;
        depth?: unknown;
        focus?: unknown;
        changed?: unknown;
        format?: unknown;
        data?: unknown;
        encoding?: unknown;
        fileName?: unknown;
      }) => {
        CanvasPanel.log?.appendLine(
          `[canvas→ext] ${CanvasPanel.summarize(msg)}`,
        );
        if (msg?.type === 'hello') {
          // Fired on first load AND after every webview reload. Replay the last
          // known diagram (+ patches) so a reload re-renders, not blanks.
          this.ready = true;
          this.replayState();
        } else if (msg?.type === 'node_selected') {
          this.selection = Array.isArray(msg.nodeIds)
            ? msg.nodeIds.filter((id): id is string => typeof id === 'string')
            : [];
        } else if (
          msg?.type === 'save_image' &&
          typeof msg.data === 'string' &&
          typeof msg.format === 'string'
        ) {
          void this.handleSaveImage(
            msg.format,
            msg.data,
            msg.encoding === 'utf8' ? 'utf8' : 'base64',
            typeof msg.fileName === 'string' ? msg.fileName : undefined,
          );
        } else if (
          msg?.type === 'node_action' &&
          msg.action === 'open_code' &&
          typeof msg.nodeId === 'string'
        ) {
          const refIndex =
            typeof msg.refIndex === 'number' ? msg.refIndex : undefined;
          void this.handleOpenCode(msg.nodeId, refIndex);
        } else if (
          msg?.type === 'node_action' &&
          msg.action === 'explain' &&
          typeof msg.nodeId === 'string'
        ) {
          this.handleExplain(msg.nodeId);
        } else if (
          msg?.type === 'node_action' &&
          msg.action === 'expand' &&
          typeof msg.nodeId === 'string'
        ) {
          this.handleExpand(
            msg.nodeId,
            typeof msg.mode === 'string' ? msg.mode : undefined,
            typeof msg.depth === 'number' ? msg.depth : undefined,
            typeof msg.focus === 'string' ? msg.focus : undefined,
          );
        } else if (msg?.type === 'diagram_edited') {
          this.handleDiagramEdited(msg.changed);
        }
      },
      null,
      this.disposables,
    );
  }

  /** Short, readable summary of a canvas → extension message for the trace log. */
  private static summarize(msg: {
    type?: string;
    action?: unknown;
    nodeId?: unknown;
    nodeIds?: unknown;
    changed?: unknown;
  }): string {
    const type = msg?.type ?? 'unknown';
    if (type === 'node_selected') {
      const ids = Array.isArray(msg.nodeIds) ? msg.nodeIds.join(', ') : '';
      return `node_selected [${ids}]`;
    }
    if (type === 'node_action') {
      const action = typeof msg.action === 'string' ? msg.action : '?';
      const nodeId = typeof msg.nodeId === 'string' ? msg.nodeId : '?';
      return `node_action:${action} (${nodeId})`;
    }
    if (type === 'diagram_edited') {
      const c = msg.changed as { nodeId?: string } | undefined;
      return `diagram_edited (${c?.nodeId ?? '?'})`;
    }
    return type;
  }

  /**
   * Context-menu "Open in editor": open the node's code. If it isn't linked yet,
   * try to resolve it via the workspace symbol provider (by the node's label),
   * link it, then open. If nothing is found, ask the user to have Copilot link it.
   */
  private async handleOpenCode(
    nodeId: string,
    refIndex?: number,
  ): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    if (!node.codeRefs?.length) {
      const resolved = await this.resolveCodeFor(nodeId, node.label ?? nodeId);
      if (!resolved) {
        void vscode.window.showInformationMessage(
          `Canvas for Copilot: couldn't locate code for "${node.label ?? nodeId}". Ask Copilot to link it (e.g. "link this node to its code").`,
        );
        return;
      }
    }
    await CanvasPanel.openNodeCode(nodeId, refIndex);
  }

  /** Best-effort: find a workspace symbol matching the label and link the node. */
  private async resolveCodeFor(
    nodeId: string,
    query: string,
  ): Promise<boolean> {
    const symbols = await vscode.commands.executeCommand<
      vscode.SymbolInformation[]
    >('vscode.executeWorkspaceSymbolProvider', query);
    if (!symbols?.length) return false;
    const best =
      symbols.find((s) => s.name === query) ??
      symbols.find((s) => s.name.toLowerCase() === query.toLowerCase()) ??
      symbols[0];
    const loc = best.location;
    CanvasPanel.linkNodeToCode(nodeId, {
      path: vscode.workspace.asRelativePath(loc.uri),
      range: {
        startLine: loc.range.start.line + 1,
        endLine: loc.range.end.line + 1,
      },
      symbol: best.name,
    });
    return true;
  }

  /**
   * "Explain node" context-menu action: send a prompt to the Copilot CLI terminal
   * asking it to explain this node. Copilot calls describe_node (per the canvas
   * instruction) and prints the full explanation in the CLI — closing the
   * canvas → CLI loop, since the stateless MCP server can't push a turn itself.
   */
  private handleExplain(nodeId: string): void {
    const label = this.nodes.get(nodeId)?.label;
    const name = label ? `"${label}" (id: ${nodeId})` : `id: ${nodeId}`;
    this.sendToTerminal(
      `Explain the node ${name} on the Canvas for Copilot diagram.`,
    );
  }

  /**
   * "Expand node" context-menu action: the webview dialog has already collected the
   * kind of expansion and depth, so build a fully-specified prompt and send it to
   * the CLI. Copilot calls expand_node with those settings and the canvas
   * re-renders the new sub-graph in place.
   */
  private handleExpand(
    nodeId: string,
    mode: string | undefined,
    depth: number | undefined,
    focus: string | undefined,
  ): void {
    const label = this.nodes.get(nodeId)?.label;
    const name = label ? `"${label}" (id: ${nodeId})` : `id: ${nodeId}`;
    const kind =
      mode === 'annotation'
        ? 'a brief annotation/note'
        : mode === 'subgraph'
          ? 'a full richer sub-graph'
          : 'a few extra detail nodes';
    const levels = depth && depth > 0 ? `${depth} level(s) deep` : '1 level deep';
    const focusPart = focus?.trim() ? ` Focus on: ${focus.trim()}.` : '';
    this.sendToTerminal(
      `Expand the node ${name} on the Canvas for Copilot diagram as ${kind}, ${levels}.` +
        focusPart +
        ' Use the expand_node tool to add the new nodes in place, connecting them to ' +
        'this node. Use these settings — no need to ask me.',
    );
  }

  /**
   * KAN-14 (diagram-edit-to-code): the user edited the diagram directly on the
   * canvas (here, renamed a node). Ask Copilot — via the CLI terminal — to propose
   * a matching code change. Copilot is the modify engine (no separate server tool
   * needed), mirroring the explain/expand actions. If the node maps to code
   * (`codeRefs`), the prompt points Copilot straight at the file/line.
   */
  private handleDiagramEdited(changedRaw: unknown): void {
    const changed = changedRaw as
      | { kind?: string; nodeId?: string; oldLabel?: string; newLabel?: string }
      | undefined;
    if (!changed || changed.kind !== 'node-label') return;
    const { nodeId, oldLabel, newLabel } = changed;
    if (typeof nodeId !== 'string' || typeof newLabel !== 'string') return;

    // Keep our index in sync so getSelection/getNodeContext reflect the new label.
    const node = this.nodes.get(nodeId);
    const refs = node?.codeRefs ?? [];
    if (node) node.label = newLabel;

    // Point Copilot at the code: a linked node gives an exact file/line; an
    // unlinked one is located by searching for its old name as a symbol.
    const locate =
      refs.length > 0
        ? ` It maps to ${refs
            .map((r) => (r.range ? `${r.path}:${r.range.startLine}` : r.path))
            .join(', ')}.`
        : oldLabel
          ? ` Find the code by searching the workspace for a symbol named "${oldLabel}".`
          : '';
    const from = oldLabel ? `"${oldLabel}" to ` : '';
    this.sendToTerminal(
      `On the Canvas for Copilot diagram I renamed the node ${from}"${newLabel}".` +
        `${locate} Propose and apply the matching code change — rename the ` +
        `corresponding symbol and update all its references. If you can't confidently ` +
        `find the symbol, or the change is ambiguous, ask me first. Then update the ` +
        `diagram if needed.`,
    );
  }

  /**
   * Inject a prompt into the active integrated terminal (where Copilot CLI runs)
   * and submit it. The CLI input treats a trailing newline as a soft line-break, so
   * type the text then send an explicit carriage return shortly after to run it.
   */
  private sendToTerminal(prompt: string): void {
    const terminal = vscode.window.activeTerminal ?? vscode.window.terminals[0];
    if (!terminal) {
      void vscode.window.showWarningMessage(
        'Canvas for Copilot: open a Copilot CLI terminal first, then try the action again to see the result there.',
      );
      return;
    }
    terminal.show();
    terminal.sendText(prompt, false);
    setTimeout(() => terminal.sendText('\r', false), 150);
  }

  /**
   * Save an exported diagram image to disk. The webview can't write files, so it
   * posts the already-encoded image here; we show a Save dialog and write it. PNG/JPG
   * arrive as base64 raster bytes; SVG arrives as utf8 vector markup.
   */
  private async handleSaveImage(
    format: string,
    data: string,
    encoding: 'base64' | 'utf8',
    fileName?: string,
  ): Promise<void> {
    const ext = format === 'jpg' ? 'jpg' : format === 'svg' ? 'svg' : 'png';
    const suggestedName = fileName ?? `diagram.${ext}`;
    const filters: Record<string, string[]> =
      ext === 'svg'
        ? { 'SVG image': ['svg'] }
        : ext === 'jpg'
          ? { 'JPEG image': ['jpg', 'jpeg'] }
          : { 'PNG image': ['png'] };

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceRoot
      ? vscode.Uri.joinPath(workspaceRoot, suggestedName)
      : vscode.Uri.file(suggestedName);

    const target = await vscode.window.showSaveDialog({ defaultUri, filters });
    if (!target) return;

    try {
      const bytes = Buffer.from(data, encoding);
      await vscode.workspace.fs.writeFile(target, bytes);
      void vscode.window.showInformationMessage(
        `Canvas for Copilot: saved ${vscode.workspace.asRelativePath(target)}`,
      );
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Canvas for Copilot: couldn't save the image — ${String(err)}`,
      );
    }
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

  /** Attach a code reference to a node; marks it visually as linked. */
  static linkNodeToCode(id: string, ref: CodeRef): boolean {
    const panel = CanvasPanel.current;
    const node = panel?.nodes.get(id);
    if (!panel || !node) return false;
    node.codeRefs = [...(node.codeRefs ?? []), ref];
    // Mark the node 'linked' on the canvas so the user sees it has code.
    panel.sendPatch({
      type: 'patch',
      sessionId: 'cli',
      diagramId: panel.currentDiagramId ?? '',
      version: 0,
      add: [],
      remove: [],
      update: [{ data: { id }, classes: 'linked' }],
    });
    return true;
  }

  /** Open a node's linked code in the editor (defaults to the selection). */
  static async openNodeCode(
    id?: string,
    refIndex?: number,
  ): Promise<{
    opened: boolean;
    reason?: 'no-canvas' | 'no-node' | 'not-linked' | 'open-failed';
    nodeId?: string;
    path?: string;
    line?: number;
  }> {
    const panel = CanvasPanel.current;
    if (!panel) return { opened: false, reason: 'no-canvas' };
    const nodeId = id ?? panel.selection.find((s) => panel.nodes.has(s));
    if (!nodeId) return { opened: false, reason: 'no-node' };
    const refs = panel.nodes.get(nodeId)?.codeRefs;
    const ref =
      (refIndex !== undefined ? refs?.[refIndex] : undefined) ?? refs?.[0];
    if (!ref) return { opened: false, reason: 'not-linked', nodeId };

    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    const uri =
      root && !ref.path.match(/^([a-zA-Z]:[\\/]|[\\/])/)
        ? vscode.Uri.joinPath(root, ref.path)
        : vscode.Uri.file(ref.path);
    const line = ref.range?.startLine;

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One,
        preview: false,
      });
      if (ref.range) {
        const start = new vscode.Position(
          Math.max(0, ref.range.startLine - 1),
          0,
        );
        const end = new vscode.Position(
          Math.max(0, (ref.range.endLine ?? ref.range.startLine) - 1),
          0,
        );
        editor.selection = new vscode.Selection(start, end);
        editor.revealRange(
          new vscode.Range(start, end),
          vscode.TextEditorRevealType.InCenter,
        );
      }
      return { opened: true, nodeId, path: ref.path, line };
    } catch {
      return { opened: false, reason: 'open-failed', nodeId, path: ref.path };
    }
  }

  private labelOf(id: string): string | undefined {
    return this.nodes.get(id)?.label ?? this.edges.get(id)?.label;
  }

  private indexElement(el: {
    data: Record<string, unknown>;
    classes?: string;
    codeRefs?: CodeRef[];
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
        codeRefs: el.codeRefs,
      });
    }
  }

  private render(diagram: DiagramMessage): void {
    this.currentDiagramId = diagram.diagramId;
    // A fresh diagram replaces all prior state, so reset the replay/persist log.
    this.lastDiagram = diagram;
    this.patches.length = 0;
    this.nodes.clear();
    this.edges.clear();
    for (const el of diagram.elements) this.indexElement(el);
    this.persist();
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
    this.sendPatch({
      ...patch,
      diagramId: this.currentDiagramId ?? patch.diagramId,
    });
  }

  private send(message: unknown): void {
    this.queue.push(message);
    if (this.ready) this.flush();
  }

  /** Send a patch and remember it so a reload can replay it. */
  private sendPatch(patch: PatchMessage): void {
    this.patches.push(patch);
    this.persist();
    this.send(patch);
  }

  /** Persist the current diagram + patches so it survives a full window reload. */
  private persist(): void {
    if (!this.lastDiagram) return;
    void CanvasPanel.context?.workspaceState.update(CanvasPanel.stateKey, {
      diagram: this.lastDiagram,
      patches: this.patches,
    } satisfies PersistedState);
  }

  /**
   * Rebuild the outgoing queue from the last known diagram (+ patches) and flush.
   * Called on every `hello`, so when the webview reloads (its JS restarts and
   * re-sends `hello` with nothing queued) the current graph re-renders instead of
   * showing a blank canvas (FR-4 / NFR-4 / TC-7).
   */
  private replayState(): void {
    if (this.lastDiagram) {
      this.queue.length = 0;
      this.queue.push(this.lastDiagram, ...this.patches);
    }
    this.flush();
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
