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

/** Context for an edge/link so the model can explain or expand the connection. */
export interface EdgeContext {
  id: string;
  label?: string;
  sourceId: string;
  sourceLabel?: string;
  targetId: string;
  targetLabel?: string;
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
  codeRefs?: CodeRef[];
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
   * Resolve the built canvas bundle. In a packaged .vsix the canvas is bundled at
   * `<extension>/dist/canvas`; in the F5 monorepo dev host it lives at
   * `<extension>/../canvas/dist`. Prefer the bundled copy when present.
   */
  private static canvasDist(extensionUri: vscode.Uri): vscode.Uri {
    const bundled = vscode.Uri.joinPath(extensionUri, 'dist', 'canvas');
    if (fs.existsSync(bundled.fsPath)) return bundled;
    return vscode.Uri.joinPath(extensionUri, '..', 'canvas', 'dist');
  }

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
          const distUri = CanvasPanel.canvasDist(context.extensionUri);
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
    const canvasDistUri = CanvasPanel.canvasDist(extensionUri);

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
    return type;
  }

  /**
   * Context-menu "Open in editor": open the node's or link's code. For a node that
   * isn't linked yet, try to resolve it via the workspace symbol provider (by the
   * node's label), link it, then open. If nothing is found, ask the user to have
   * Copilot link it.
   */
  private async handleOpenCode(
    id: string,
    refIndex?: number,
  ): Promise<void> {
    const node = this.nodes.get(id);
    const edge = node ? undefined : this.edges.get(id);
    if (!node && !edge) return;

    const hasRefs = (node?.codeRefs ?? edge?.codeRefs)?.length;
    if (!hasRefs) {
      // Only nodes can be auto-resolved by label (a link has no symbol of its own).
      const resolved =
        node !== undefined &&
        (await this.resolveCodeFor(id, node.label ?? id));
      if (!resolved) {
        const what = edge ? 'link' : 'node';
        const name = node?.label ?? edge?.label ?? id;
        void vscode.window.showInformationMessage(
          `Canvas for Copilot: couldn't locate code for ${what} "${name}". Ask Copilot to link it (e.g. "link this ${what} to its code").`,
        );
        return;
      }
    }
    await CanvasPanel.openNodeCode(id, refIndex);
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
   * "Explain" context-menu action: send a prompt to the Copilot CLI terminal asking
   * it to explain this node or link. Copilot calls describe_node (per the canvas
   * instruction) and prints the full explanation in the CLI — closing the
   * canvas → CLI loop, since the stateless MCP server can't push a turn itself.
   */
  private handleExplain(id: string): void {
    const edge = this.edges.get(id);
    if (edge) {
      this.sendToTerminal(
        `Explain the link/connection ${this.edgeName(id, edge)} on the ` +
          `Canvas for Copilot diagram — what this relationship means.`,
      );
      return;
    }
    const label = this.nodes.get(id)?.label;
    const name = label ? `"${label}" (id: ${id})` : `id: ${id}`;
    this.sendToTerminal(
      `Explain the node ${name} on the Canvas for Copilot diagram.`,
    );
  }

  /** Readable name for an edge: its label (if any) and the endpoints it joins. */
  private edgeName(id: string, edge: EdgeInfo): string {
    const from = this.nodes.get(edge.source)?.label ?? edge.source;
    const to = this.nodes.get(edge.target)?.label ?? edge.target;
    const lbl = edge.label ? `"${edge.label}" ` : '';
    return `${lbl}from "${from}" to "${to}" (id: ${id})`;
  }

  /**
   * "Expand" context-menu action: the webview dialog has already collected the kind
   * of expansion and depth, so build a fully-specified prompt and send it to the
   * CLI. Copilot calls expand_node with those settings and the canvas re-renders the
   * new sub-graph in place. For an edge, the new detail is inserted along the link.
   */
  private handleExpand(
    id: string,
    mode: string | undefined,
    depth: number | undefined,
    focus: string | undefined,
  ): void {
    const kind =
      mode === 'annotation'
        ? 'a brief annotation/note'
        : mode === 'subgraph'
          ? 'a full richer sub-graph'
          : 'a few extra detail nodes';
    const levels = depth && depth > 0 ? `${depth} level(s) deep` : '1 level deep';
    const focusPart = focus?.trim() ? ` Focus on: ${focus.trim()}.` : '';
    const edge = this.edges.get(id);
    if (edge) {
      this.sendToTerminal(
        `Expand the link/connection ${this.edgeName(id, edge)} on the Canvas for ` +
          `Copilot diagram as ${kind}, ${levels}.` +
          focusPart +
          ' Use the expand_node tool to insert the new intermediate node(s)/step(s) ' +
          'along this link, connecting them between the two endpoints; remove the ' +
          'original direct edge if you replace it with the path. Use these settings ' +
          '— no need to ask me.',
      );
      return;
    }
    const label = this.nodes.get(id)?.label;
    const name = label ? `"${label}" (id: ${id})` : `id: ${id}`;
    this.sendToTerminal(
      `Expand the node ${name} on the Canvas for Copilot diagram as ${kind}, ${levels}.` +
        focusPart +
        ' Use the expand_node tool to add the new nodes in place, connecting them to ' +
        'this node. Use these settings — no need to ask me.',
    );
  }

  /**
   * Inject a prompt into the Copilot CLI terminal and submit it. The CLI input
   * treats a trailing newline as a soft line-break, so type the text then send an
   * explicit carriage return shortly after to run it. We prefer a terminal that
   * looks like a Copilot session and sanitize the prompt so an embedded label
   * can't execute as a shell command if it lands in a non-Copilot terminal.
   */
  private sendToTerminal(prompt: string): void {
    const terminal =
      vscode.window.terminals.find((t) => /copilot/i.test(t.name)) ??
      vscode.window.activeTerminal ??
      vscode.window.terminals[0];
    if (!terminal) {
      void vscode.window.showWarningMessage(
        'Canvas for Copilot: open a Copilot CLI terminal first, then try the action again to see the result there.',
      );
      return;
    }
    terminal.show();
    terminal.sendText(CanvasPanel.sanitizePrompt(prompt), false);
    setTimeout(() => terminal.sendText('\r', false), 150);
  }

  /**
   * Neutralise characters that could turn an embedded (model/user-controlled)
   * node label into a shell command if the prompt is typed into a non-Copilot
   * terminal: flatten newlines and strip backticks / `$` (command substitution).
   */
  private static sanitizePrompt(text: string): string {
    return text.replace(/[\r\n]+/g, ' ').replace(/[`$]/g, '');
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

  /**
   * Context for an edge/link so the model can explain or expand the connection: its
   * label and the two endpoints it joins. If `id` is omitted, uses the first
   * selected edge. Returns undefined if there's no such edge.
   */
  static getEdgeContext(id?: string): EdgeContext | undefined {
    const panel = CanvasPanel.current;
    if (!panel) return undefined;
    const targetId = id ?? panel.selection.find((s) => panel.edges.has(s));
    if (!targetId) return undefined;
    const edge = panel.edges.get(targetId);
    if (!edge) return undefined;
    return {
      id: targetId,
      label: edge.label,
      sourceId: edge.source,
      sourceLabel: panel.nodes.get(edge.source)?.label,
      targetId: edge.target,
      targetLabel: panel.nodes.get(edge.target)?.label,
    };
  }

  /** Attach a code reference to a node or edge; marks a node visually as linked. */
  static linkNodeToCode(id: string, ref: CodeRef): boolean {
    const panel = CanvasPanel.current;
    const node = panel?.nodes.get(id);
    const edge = node ? undefined : panel?.edges.get(id);
    const target = node ?? edge;
    if (!panel || !target) return false;
    target.codeRefs = [...(target.codeRefs ?? []), ref];
    // Deliver the code refs so the canvas element carries them (renderCodeRefs /
    // "go to code" in the menu reads element data). Only nodes get the 'linked'
    // ring marker (there's no edge equivalent style).
    panel.sendPatch({
      type: 'patch',
      sessionId: 'cli',
      diagramId: panel.currentDiagramId ?? '',
      version: 0,
      add: [],
      remove: [],
      update: [
        {
          data: { id },
          classes: node ? 'linked' : undefined,
          codeRefs: target.codeRefs,
        },
      ],
    });
    return true;
  }

  /** Open a node's or link's linked code in the editor (defaults to the selection). */
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
    const nodeId =
      id ??
      panel.selection.find((s) => panel.nodes.has(s) || panel.edges.has(s));
    if (!nodeId) return { opened: false, reason: 'no-node' };
    const refs =
      panel.nodes.get(nodeId)?.codeRefs ?? panel.edges.get(nodeId)?.codeRefs;
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
        codeRefs: el.codeRefs,
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
