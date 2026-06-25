// Canvas MCP server definition (KAN-8 seed). Exposes the tools Copilot CLI can
// call. Pattern 1 (ADR-007 addendum): this runs in-process inside the VS Code
// extension, so a tool handler can render directly into the webview via `deps`.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CodeRef, DiagramMessage, PatchMessage } from '@canvas/shared';
import { getExampleDiagram, nodeCount } from './exampleDiagram';
import { buildDiagram, STYLE_CLASSES, type DiagramInput } from './diagram';
import { buildPatch } from './patch';
import {
  buildDependencyDiagram,
  buildFlowchartDiagram,
  buildStateMachineDiagram,
  buildClassDiagram,
  buildErDiagram,
} from './diagramTypes';

const NODE_KINDS = [
  'module',
  'service',
  'entrypoint',
  'datastore',
  'external',
  'note',
] as const;

// Curated style classes (canvas defines what each looks like) + a safe inline
// style subset — the only ways the model can affect presentation (D14).
const STYLE_CLASSES_SCHEMA = z
  .array(z.enum(STYLE_CLASSES))
  .optional()
  .describe(
    'Optional style classes: big, small, highlight, muted, danger, success, warning.',
  );

const STYLE_SCHEMA = z
  .object({
    color: z
      .string()
      .optional()
      .describe('CSS colour for the node fill / edge line, e.g. "#ef4444" or "red".'),
    fontSize: z.number().optional().describe('Label font size in px.'),
    size: z
      .number()
      .optional()
      .describe('Node size in px (label padding); ignored for edges.'),
  })
  .optional()
  .describe('Optional whitelisted style overrides (color, fontSize, size).');

const CODEREFS_SCHEMA = z
  .array(
    z.object({
      path: z.string().describe('Repo-relative file path.'),
      startLine: z.number().optional().describe('1-based start line.'),
      endLine: z.number().optional().describe('1-based end line.'),
      symbol: z.string().optional().describe('Optional symbol name.'),
    }),
  )
  .optional()
  .describe(
    'Code location(s) this node maps to, so the user can jump to the code. ' +
      'IMPORTANT: when the diagram describes code in the CURRENT WORKSPACE/REPO, ' +
      'attach codeRefs to EVERY node that corresponds to real code — inspect the ' +
      'repo (read files / search symbols) to find the file path and, where ' +
      'possible, the symbol name and line — so each code-backed node is clickable. ' +
      'Only purely conceptual nodes (e.g. "User", "Browser") that map to no code ' +
      'should be left without a ref.',
  );

export interface CanvasSelectionInfo {
  diagramId?: string;
  ids: string[];
  elements: { id: string; label?: string; isEdge: boolean }[];
}

export interface CanvasNodeContext {
  id: string;
  label?: string;
  kind?: string;
  classes?: string;
  incoming: { fromId: string; fromLabel?: string; edgeLabel?: string }[];
  outgoing: { toId: string; toLabel?: string; edgeLabel?: string }[];
}

export interface CanvasEdgeContext {
  id: string;
  label?: string;
  sourceId: string;
  sourceLabel?: string;
  targetId: string;
  targetLabel?: string;
}

export interface CanvasServerDeps {
  /** Called when a tool wants to render a (new/replacement) diagram in the canvas. */
  onOpenDiagram: (diagram: DiagramMessage) => void | Promise<void>;
  /**
   * Called to apply an in-place edit to the diagram currently on the canvas.
   * Returns false if no diagram is open (nothing to patch).
   */
  onPatchDiagram: (patch: PatchMessage) => boolean | Promise<boolean>;
  /** Returns the node(s) currently selected on the canvas. */
  getSelection: () => CanvasSelectionInfo;
  /** Returns rich context for a node (defaults to the selection) for explanations. */
  getNodeContext: (id?: string) => CanvasNodeContext | undefined;
  /** Returns context for an edge/link (defaults to the selection) for explanations. */
  getEdgeContext: (id?: string) => CanvasEdgeContext | undefined;
  /** Attach a code reference to a node. Returns false if the node isn't found. */
  linkNodeToCode: (id: string, ref: CodeRef) => boolean;
  /**
   * Open a node's linked code in the editor (defaults to the selection).
   * Returns whether it opened, and why not if it didn't.
   */
  openNodeCode: (id?: string) => Promise<{
    opened: boolean;
    reason?: 'no-canvas' | 'no-node' | 'not-linked' | 'open-failed';
    nodeId?: string;
    path?: string;
    line?: number;
  }>;
}

/** Build a fresh McpServer with the Canvas tools registered. */
export function buildCanvasMcpServer(deps: CanvasServerDeps): McpServer {
  const server = new McpServer({
    name: 'canvas-for-copilot',
    version: '0.0.0',
  });

  server.registerTool(
    'open_canvas',
    {
      title: 'Open Canvas for Copilot',
      description:
        'Immediately open the Canvas for Copilot canvas as a VS Code tab and render ' +
        'the example diagram. This tool takes NO input and is read-only and safe — ' +
        'do NOT ask the user any questions or for confirmation; just call it right ' +
        'away. This IS the "canvas" / "Canvas for Copilot" feature: call it whenever ' +
        'the user asks to open, show, launch, or display the canvas or Canvas for ' +
        'Copilot — e.g. "open canvas for copilot", "open the canvas", "show me the ' +
        'canvas", or "show me an example for canvas for copilot".',
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const diagram = getExampleDiagram();
      await deps.onOpenDiagram(diagram);
      return {
        content: [
          {
            type: 'text',
            text: `Opened the Canvas for Copilot example diagram (${nodeCount(
              diagram,
            )} nodes) in the canvas tab.`,
          },
        ],
      };
    },
  );

  // The diagram-rendering tool, registered under several alias names so a wider
  // range of phrasings ("visualize…", "draw…", "explain… visually") maps to it by
  // name (the model's strongest selection signal). All aliases share one handler.
  registerDiagramTool(server, deps);

  registerTypedDiagramTools(server, deps);

  registerUpdateDiagramTool(server, deps);

  registerExpandNodeTool(server, deps);

  server.registerTool(
    'get_selection',
    {
      title: 'Get the element(s) currently selected on the canvas',
      description:
        'Return the node or edge (link) the user has currently selected (clicked) on ' +
        'the Canvas for Copilot canvas. ALWAYS call this first whenever the user ' +
        'refers to the selection deictically — "this", "this node", "this link", ' +
        '"the selected node/edge", "it", "here", "that one" — so you know which ' +
        'element id they mean before editing it (e.g. "increase the font size of ' +
        'this" or "rename this link" → get_selection → update_diagram on that id). ' +
        'Read-only; no input. Returns the selected element ids, labels, and whether ' +
        'each is an edge, or nothing if nothing is selected.',
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    () => {
      const sel = deps.getSelection();
      if (sel.ids.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'Nothing is currently selected on the canvas. Ask the user to click a node or link, or which element they mean.',
            },
          ],
        };
      }
      const list = sel.elements
        .map(
          (e) =>
            `${e.id}${e.label ? ` ("${e.label}")` : ''}${e.isEdge ? ' [edge]' : ' [node]'}`,
        )
        .join(', ');
      return {
        content: [
          {
            type: 'text',
            text: `Currently selected: ${list}. Use ${
              sel.ids.length === 1 ? 'this id' : 'these ids'
            } with update_diagram to edit the selection (e.g. change its label, color, or size).`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'describe_node',
    {
      title: 'Get a node\u2019s or link\u2019s context so you can explain it',
      description:
        'Return rich context about a node OR an edge/link on the Canvas for Copilot ' +
        'canvas so you can give a relevant explanation. For a node: its label, kind, ' +
        'and how it connects to its neighbours (incoming and outgoing edges with ' +
        'their labels). For an edge/link: its label and the two endpoints it ' +
        'connects. Call this when the user asks to explain, describe, or "what is" a ' +
        'node, a link/connection, or the current selection (e.g. "explain this node", ' +
        '"what does this arrow mean?"). If the id is omitted, the current selection ' +
        '(node or edge) is used. Read-only. Combine the returned graph context with ' +
        'your own knowledge to explain it in the CLI.',
      inputSchema: {
        nodeId: z
          .string()
          .optional()
          .describe(
            'Node or edge id to describe; omit to use the current selection.',
          ),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ nodeId }) => {
      const ctx = deps.getNodeContext(nodeId);
      if (!ctx) {
        const edge = deps.getEdgeContext(nodeId);
        if (edge) {
          const from = edge.sourceLabel ?? edge.sourceId;
          const to = edge.targetLabel ?? edge.targetId;
          const arrow = edge.label ? `--(${edge.label})-->` : '-->';
          const lines = [
            `Link/connection: ${edge.id}${edge.label ? ` ("${edge.label}")` : ''}`,
            `From: ${from} (id: ${edge.sourceId})`,
            `To: ${to} (id: ${edge.targetId})`,
            `Direction: ${from} ${arrow} ${to}`,
          ];
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        return {
          content: [
            {
              type: 'text',
              text: nodeId
                ? `No node or link "${nodeId}" is on the canvas.`
                : 'Nothing is selected. Ask the user to click the node or link they want explained, or name it.',
            },
          ],
        };
      }
      const name = `${ctx.id}${ctx.label ? ` ("${ctx.label}")` : ''}`;
      const incoming =
        ctx.incoming.length > 0
          ? ctx.incoming
              .map(
                (e) =>
                  `${e.fromLabel ?? e.fromId}${e.edgeLabel ? ` --(${e.edgeLabel})-->` : ' -->'} this`,
              )
              .join('; ')
          : 'none';
      const outgoing =
        ctx.outgoing.length > 0
          ? ctx.outgoing
              .map(
                (e) =>
                  `this${e.edgeLabel ? ` --(${e.edgeLabel})-->` : ' -->'} ${e.toLabel ?? e.toId}`,
              )
              .join('; ')
          : 'none';
      const lines = [
        `Node: ${name}`,
        ctx.kind ? `Kind: ${ctx.kind}` : undefined,
        ctx.classes ? `Classes: ${ctx.classes}` : undefined,
        `Incoming: ${incoming}`,
        `Outgoing: ${outgoing}`,
      ].filter((l): l is string => l !== undefined);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.registerTool(
    'link_node_to_code',
    {
      title: 'Link a node or link to a code location',
      description:
        'Attach a code reference (file path + optional line range / symbol) to a ' +
        'node OR an edge/link, so the user can later jump from it to that code. Call ' +
        'this when you know where a node or a connection lives in the repo (from your ' +
        'analysis) or when the user asks to "link this node/link to <file>". Paths ' +
        'are repo-relative.',
      inputSchema: {
        nodeId: z.string().describe('The node or edge id to link.'),
        path: z.string().describe('Repo-relative file path, e.g. "src/auth/jwt.ts".'),
        startLine: z
          .number()
          .optional()
          .describe('1-based start line of the relevant code.'),
        endLine: z.number().optional().describe('1-based end line (defaults to start).'),
        symbol: z.string().optional().describe('Optional symbol name, e.g. "issueToken".'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ nodeId, path, startLine, endLine, symbol }) => {
      const ref: CodeRef = {
        path,
        range:
          typeof startLine === 'number'
            ? { startLine, endLine: endLine ?? startLine }
            : undefined,
        symbol,
      };
      const ok = deps.linkNodeToCode(nodeId, ref);
      if (!ok) {
        return {
          isError: true,
          content: [
            { type: 'text', text: `No node or link "${nodeId}" is on the canvas to link.` },
          ],
        };
      }
      const where = ref.range ? `${path}:${ref.range.startLine}` : path;
      return {
        content: [
          { type: 'text', text: `Linked "${nodeId}" to ${where}.` },
        ],
      };
    },
  );

  const OPEN_CODE_NAMES = [
    'open_node_code',
    'open_code',
    'show_code',
    'jump_to_code',
    'goto_code',
  ] as const;
  for (const name of OPEN_CODE_NAMES) {
    const primary = name === 'open_node_code';
    server.registerTool(
      name,
      {
        title: 'Open a node\u2019s or link\u2019s linked code in the editor',
        description:
          (primary ? '' : '(alias of open_node_code) ') +
          'Open the code linked to a node OR an edge/link in the VS Code editor and ' +
          'jump straight to the line (defaults to the current selection). ALWAYS use ' +
          'this — do not just print the path — whenever the user asks to see / show / ' +
          'open / view / "jump to" / "go to" / "take me to" the code, source, ' +
          'implementation, or lines of code for a node, a link/connection, or the ' +
          'selection (e.g. "show me the code for this", "open this link\u2019s code", "jump ' +
          'to the source"). If it isn\u2019t linked to any code, say so plainly — do not ' +
          'guess a location.',
        inputSchema: {
          nodeId: z
            .string()
            .optional()
            .describe('Node or edge id; omit to use the current selection.'),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ nodeId }) => {
        const r = await deps.openNodeCode(nodeId);
        if (r.opened) {
          const at = r.line ? `${r.path}:${r.line}` : r.path;
          return {
            content: [
              { type: 'text', text: `Opened ${at} in the editor for "${r.nodeId}".` },
            ],
          };
        }
        const reason =
          r.reason === 'not-linked'
            ? `"${r.nodeId}" isn\u2019t linked to any code yet. Link it first with link_node_to_code, or tell the user it has no code reference.`
            : r.reason === 'no-node'
              ? 'Nothing is selected. Ask the user to click the node or link whose code they want.'
              : r.reason === 'no-canvas'
                ? 'No diagram is open on the canvas.'
                : 'Could not open the linked file (it may not exist at that path).';
        return { isError: true, content: [{ type: 'text', text: reason }] };
      },
    );
  }

  return server;
}

function registerUpdateDiagramTool(
  server: McpServer,
  deps: CanvasServerDeps,
): void {
  server.registerTool(
    'update_diagram',
    {
      title: 'Edit the diagram currently on the canvas (in place)',
      description:
        'EDIT the diagram already shown on the Canvas for Copilot canvas IN PLACE, ' +
        'keeping the current view (pan, zoom and node positions are preserved — the ' +
        'diagram is NOT regenerated or re-laid-out). Use this — never create_diagram ' +
        '— whenever the user asks to change, tweak, edit, update, relabel, annotate, ' +
        'restyle, recolour, resize, add to, or remove from the diagram that is ' +
        'already on screen (e.g. "add the expected return code to each node", "make ' +
        'the auth node bigger and red", "highlight the API node", "rename node X", ' +
        '"remove node Z"). To relabel/restyle existing nodes, pass them in `update` ' +
        'with their existing id and the new label / classes / style. Read-only/safe; ' +
        'do NOT ask for confirmation. If nothing is on the canvas yet, use create_diagram instead.',
      inputSchema: {
        update: z
          .array(
            z.object({
              id: z
                .string()
                .describe('Existing node/edge id to edit.'),
              label: z
                .string()
                .optional()
                .describe('New full label (replaces the current one).'),
              kind: z.enum(NODE_KINDS).optional().describe('New semantic kind.'),
              classes: STYLE_CLASSES_SCHEMA,
              style: STYLE_SCHEMA,
            }),
          )
          .optional()
          .describe('Existing elements to edit in place (merged by id).'),
        addNodes: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              kind: z.enum(NODE_KINDS).optional(),
              classes: STYLE_CLASSES_SCHEMA,
              style: STYLE_SCHEMA,
            }),
          )
          .optional()
          .describe('New nodes to add.'),
        addEdges: z
          .array(
            z.object({
              source: z.string(),
              target: z.string(),
              label: z.string().optional(),
              classes: STYLE_CLASSES_SCHEMA,
              style: STYLE_SCHEMA,
            }),
          )
          .optional()
          .describe('New edges to add (between existing or newly-added node ids).'),
        remove: z
          .array(z.string())
          .optional()
          .describe('Node/edge ids to remove.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ update, addNodes, addEdges, remove }) => {
      const { patch, counts } = buildPatch({
        update,
        addNodes,
        addEdges,
        remove,
      });

      if (
        counts.updated === 0 &&
        counts.added === 0 &&
        counts.removed === 0
      ) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'No edits provided — pass at least one of update / addNodes / addEdges / remove.',
            },
          ],
        };
      }

      const applied = await deps.onPatchDiagram(patch);
      if (!applied) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'No diagram is open on the canvas to edit — use create_diagram first.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Edited the diagram in place (view preserved): ${counts.updated} updated, ${counts.added} added, ${counts.removed} removed.`,
          },
        ],
      };
    },
  );
}

function registerExpandNodeTool(
  server: McpServer,
  deps: CanvasServerDeps,
): void {
  server.registerTool(
    'expand_node',
    {
      title: 'Expand a node or link into a richer sub-graph (in place)',
      description:
        'Expand / drill into / "show more detail for" a node OR an edge/link on the ' +
        'Canvas for Copilot canvas: add a sub-graph of detail and re-render in ' +
        'place (the current pan/zoom is preserved — the diagram is not regenerated). ' +
        'Use this whenever the user asks to expand, drill into, break down, unfold, ' +
        'or "show more detail / internals / children" for a node, a link/connection, ' +
        'or the selection. For a NODE, add child nodes around it. For an EDGE/LINK, ' +
        'insert intermediate node(s)/step(s) ALONG the link (connect them between the ' +
        'two endpoints) and pass the original edge id in `remove` if the path ' +
        'replaces the direct connection. ' +
        'IMPORTANT — clarify scope FIRST: unless the kind and depth are already ' +
        'specified in the request, ASK the user what KIND of expansion they want — a ' +
        'brief annotation/note, a few extra detail nodes, or a full richer sub-graph ' +
        '— and HOW DEEP (how many levels). Only once you know the kind + depth, ' +
        'generate the sub-graph and call this tool. Make sure you know the parent ' +
        'node or edge id first (call get_selection if the user said "this"). Provide ' +
        'the new nodes in addNodes and the connecting edges in addEdges. For an ' +
        '"annotation", add a single kind:"note" node joined by an edge with the ' +
        '"annotation" class. Keep each level focused (roughly 2-6 new nodes per level).',
      inputSchema: {
        parentId: z
          .string()
          .optional()
          .describe(
            'Id of the node or edge to expand; omit to use the current selection.',
          ),
        mode: z
          .enum(['annotation', 'detail', 'subgraph'])
          .optional()
          .describe(
            'Kind of expansion: "annotation" (a small note), "detail" (a few child nodes), or "subgraph" (a full richer sub-graph).',
          ),
        depth: z
          .number()
          .optional()
          .describe('How many levels deep to expand (e.g. 1-3).'),
        addNodes: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              kind: z.enum(NODE_KINDS).optional(),
              classes: STYLE_CLASSES_SCHEMA,
              style: STYLE_SCHEMA,
            }),
          )
          .optional()
          .describe('New nodes to add (around the parent node, or along the link).'),
        addEdges: z
          .array(
            z.object({
              source: z.string(),
              target: z.string(),
              label: z.string().optional(),
              classes: STYLE_CLASSES_SCHEMA,
              style: STYLE_SCHEMA,
            }),
          )
          .optional()
          .describe(
            'Edges connecting the parent (or the two endpoints) to the new nodes.',
          ),
        remove: z
          .array(z.string())
          .optional()
          .describe(
            'Ids of elements to remove as part of the expansion — typically the original direct edge when you insert intermediate step(s) along a link.',
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ parentId, mode, depth, addNodes, addEdges, remove }) => {
      const nodeCtx = deps.getNodeContext(parentId);
      const edgeCtx = nodeCtx ? undefined : deps.getEdgeContext(parentId);
      if (!nodeCtx && !edgeCtx) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: parentId
                ? `No node or link "${parentId}" is on the canvas to expand.`
                : 'Nothing is selected to expand. Ask the user to click the node or link they want expanded, or name it.',
            },
          ],
        };
      }

      const targetId = nodeCtx ? nodeCtx.id : edgeCtx!.id;
      const targetLabel = nodeCtx
        ? (nodeCtx.label ?? nodeCtx.id)
        : (edgeCtx!.label ?? edgeCtx!.id);
      const targetKind = edgeCtx ? 'link' : 'node';

      // No sub-graph yet → guide the model to settle scope with the user first.
      if (!addNodes?.length) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text:
                `Ready to expand the ${targetKind} "${targetLabel}" (id: ${targetId}). First decide ` +
                'WITH THE USER the kind of expansion (annotation / detail / subgraph) and how many ' +
                'levels deep, then call expand_node again with addNodes (the new nodes) and addEdges ' +
                (edgeCtx
                  ? 'connecting them between the two endpoints (and pass this edge id in `remove` if the path replaces the direct link).'
                  : 'connecting them to this node.'),
            },
          ],
        };
      }

      const { patch, counts } = buildPatch({ addNodes, addEdges, remove });
      const applied = await deps.onPatchDiagram(patch);
      if (!applied) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'No diagram is open on the canvas to expand — use create_diagram first.',
            },
          ],
        };
      }

      const how = [mode, depth ? `depth ${depth}` : undefined]
        .filter(Boolean)
        .join(', ');
      const removedNote = counts.removed ? `, removed ${counts.removed}` : '';
      return {
        content: [
          {
            type: 'text',
            text: `Expanded the ${targetKind} "${targetLabel}"${
              how ? ` (${how})` : ''
            } in place: added ${counts.added} element(s)${removedNote}.`,
          },
        ],
      };
    },
  );
}

const DIAGRAM_INPUT_SCHEMA = {
  title: z
    .string()
    .describe('Short human title for the diagram, e.g. "JWT auth flow".'),
  nodes: z
    .array(
      z.object({
        id: z.string().describe('Stable unique node id, e.g. "browser".'),
        label: z.string().describe('Short display label for the node.'),
        kind: z
          .enum(NODE_KINDS)
          .optional()
          .describe('Optional semantic kind, used for styling.'),
        classes: STYLE_CLASSES_SCHEMA,
        style: STYLE_SCHEMA,
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('The graph nodes (about 4-12).'),
  edges: z
    .array(
      z.object({
        source: z.string().describe('Source node id.'),
        target: z.string().describe('Target node id.'),
        label: z.string().optional().describe('Optional short edge label.'),
        classes: STYLE_CLASSES_SCHEMA,
        style: STYLE_SCHEMA,
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('Directed edges connecting node ids.'),
};

/** Primary name + aliases — all render a generated graph on the canvas. */
const DIAGRAM_TOOL_NAMES = [
  'create_diagram',
  'visualize',
  'draw_diagram',
  'explain_with_diagram',
] as const;

function diagramDescription(name: string): string {
  const primary = name === 'create_diagram' ? '' : '(alias of create_diagram) ';
  return (
    primary +
    'THE tool for producing ANY visual explanation. ALWAYS use this tool — and ' +
    'never write HTML, an HTML <canvas>, SVG, Mermaid, image files, or any code ' +
    '— whenever the user asks to draw, create, show, visualize, diagram, sketch, ' +
    'map, illustrate, or explain something visually or "as a diagram/flow/graph/' +
    'workflow", or asks to use "canvas" / "Canvas for Copilot" / "the canvas". ' +
    'Note: "canvas" here means the Canvas for Copilot tab (this tool), NOT an ' +
    'HTML canvas element — do not generate a web page. ' +
    'It renders an interactive graph in a VS Code tab (it opens automatically if ' +
    'not open, and updates in place if it is). YOU generate the graph: provide a ' +
    'short title, the nodes (each a stable id + short label, optional kind), and ' +
    'the directed edges between node ids (optionally labeled). Keep it focused — ' +
    'roughly 4-12 nodes. When the diagram describes code in the current ' +
    'workspace/repo, set `codeRefs` on every node that maps to real code (inspect ' +
    'the repo to find file/line/symbol) so each node is clickable to its source. ' +
    'Read-only and safe; do NOT ask for confirmation, just call it.'
  );
}

function registerDiagramTool(server: McpServer, deps: CanvasServerDeps): void {
  for (const name of DIAGRAM_TOOL_NAMES) {
    server.registerTool(
      name,
      {
        title: 'Create a diagram on the Canvas for Copilot canvas',
        description: diagramDescription(name),
        inputSchema: DIAGRAM_INPUT_SCHEMA,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ title, nodes, edges }) => {
        if (nodes.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Cannot create a diagram with no nodes — provide at least one node.',
              },
            ],
          };
        }

        const { diagram, skippedEdges } = buildDiagram({ title, nodes, edges });
        await deps.onOpenDiagram(diagram);

        const note =
          skippedEdges > 0
            ? ` (skipped ${skippedEdges} edge(s) referencing unknown node ids)`
            : '';
        return {
          content: [
            {
              type: 'text',
              text: `Rendered "${title}" on the canvas: ${nodes.length} nodes, ${
                edges.length - skippedEdges
              } edges${note}.`,
            },
          ],
        };
      },
    );
  }
}

/* ─── Typed diagram skills (KAN-20..24) ──────────────────────────────────────
 * One dedicated tool per diagram type, each with a tuned description so a request
 * like "show the dependency graph of X" or "draw the state machine for Y" routes
 * to the right skill. They all map their typed input to the generic graph model
 * and render through the same `buildDiagram` path as `create_diagram`. */

const DEPENDENCY_SCHEMA = {
  title: z.string().describe('Short title, e.g. "Service dependencies".'),
  scope: z
    .enum(['package', 'module', 'function', 'service'])
    .optional()
    .describe(
      'Granularity to draw at when the prompt names a level (default "module"): ' +
        'package (packages/workspaces), module (files/modules), function (a call ' +
        'graph), service (runtime services). Sets the default node kind.',
    ),
  nodes: z
    .array(
      z.object({
        id: z.string().describe('Stable unique id, e.g. "auth".'),
        label: z.string().describe('Short display label.'),
        kind: z
          .enum(NODE_KINDS)
          .optional()
          .describe(
            'Semantic kind for styling (defaults from `scope`): module, service, ' +
              'datastore (databases/caches/queues), entrypoint, external, or note.',
          ),
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('The packages / modules / functions / services (about 4-12).'),
  dependencies: z
    .array(
      z.object({
        from: z.string().describe('The dependent node id (it depends on `to`).'),
        to: z.string().describe('The node id that `from` depends on.'),
        label: z.string().optional().describe('Optional edge label.'),
      }),
    )
    .describe('Directed "depends on" edges. Cycles are allowed.'),
};

const FLOWCHART_SCHEMA = {
  title: z.string().describe('Short title, e.g. "Checkout flow".'),
  nodes: z
    .array(
      z.object({
        id: z.string().describe('Stable unique id, e.g. "validate".'),
        label: z.string().describe('Short display label.'),
        type: z
          .enum(['start', 'step', 'decision', 'io', 'end'])
          .optional()
          .describe(
            'Node type (defaults to "step"): start/end = terminator (pill), step = process (rectangle), decision = branch (diamond), io = input/output (parallelogram).',
          ),
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('Steps and decisions (about 4-12).'),
  edges: z
    .array(
      z.object({
        from: z.string().describe('Source node id.'),
        to: z.string().describe('Target node id.'),
        label: z
          .string()
          .optional()
          .describe('Branch label for decisions, e.g. "yes"/"no".'),
      }),
    )
    .describe('Directed flow between node ids.'),
};

const STATE_MACHINE_SCHEMA = {
  title: z.string().describe('Short title, e.g. "Order lifecycle".'),
  states: z
    .array(
      z.object({
        id: z.string().describe('Stable unique state id, e.g. "pending".'),
        label: z.string().describe('Short display label.'),
        initial: z
          .boolean()
          .optional()
          .describe('Marks the single start state (drawn distinctly).'),
        final: z
          .boolean()
          .optional()
          .describe('Marks an accepting/terminal state (drawn distinctly).'),
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('The states (about 4-12).'),
  transitions: z
    .array(
      z.object({
        from: z.string().describe('Source state id.'),
        to: z.string().describe('Target state id.'),
        event: z
          .string()
          .optional()
          .describe('The triggering event/condition that labels the transition.'),
      }),
    )
    .describe('Directed transitions between states.'),
};

const CLASS_SCHEMA = {
  title: z.string().describe('Short title, e.g. "Domain model".'),
  classes: z
    .array(
      z.object({
        id: z.string().describe('Stable unique id, e.g. "user".'),
        label: z.string().describe('Class name.'),
        attributes: z
          .array(z.string())
          .optional()
          .describe('Attribute lines, e.g. "+ id: string".'),
        methods: z
          .array(z.string())
          .optional()
          .describe('Method lines, e.g. "+ save(): void".'),
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('The classes (about 4-12).'),
  relations: z
    .array(
      z.object({
        from: z
          .string()
          .describe('Subclass (inheritance) or whole/owner (aggregation/composition).'),
        to: z.string().describe('Superclass (inheritance) or part/associate.'),
        type: z
          .enum([
            'inheritance',
            'realization',
            'association',
            'dependency',
            'aggregation',
            'composition',
          ])
          .optional()
          .describe(
            'Relation type (defaults to "association"); sets the arrowhead — inheritance/realization use a hollow triangle (realization dashed), aggregation/composition a diamond, dependency a dashed open arrow.',
          ),
        label: z.string().optional().describe('Optional relation label (e.g. role/multiplicity).'),
      }),
    )
    .describe('Relations between classes.'),
};

const ER_SCHEMA = {
  title: z.string().describe('Short title, e.g. "Sales data model".'),
  entities: z
    .array(
      z.object({
        id: z.string().describe('Stable unique id, e.g. "customer".'),
        label: z.string().describe('Entity name.'),
        attributes: z
          .array(z.string())
          .optional()
          .describe('Key/attribute lines surfaced under the entity name.'),
        codeRefs: CODEREFS_SCHEMA,
      }),
    )
    .describe('The entities (about 4-12).'),
  relationships: z
    .array(
      z.object({
        from: z.string().describe('Source entity id.'),
        to: z.string().describe('Target entity id.'),
        label: z.string().optional().describe('Verb phrase, e.g. "places".'),
        cardinality: z
          .string()
          .optional()
          .describe('Cardinality, e.g. "1", "N", "1:N", "M:N".'),
      }),
    )
    .describe('Relationships between entities.'),
};


/** Render a typed diagram input on the canvas, sharing create_diagram's logic. */
async function renderTypedDiagram(
  deps: CanvasServerDeps,
  input: DiagramInput,
  typeLabel: string,
  emptyHint: string,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  if (input.nodes.length === 0) {
    return {
      isError: true,
      content: [{ type: 'text', text: emptyHint }],
    };
  }
  const { diagram, skippedEdges } = buildDiagram(input);
  await deps.onOpenDiagram(diagram);
  const note =
    skippedEdges > 0
      ? ` (skipped ${skippedEdges} edge(s) referencing unknown node ids)`
      : '';
  return {
    content: [
      {
        type: 'text',
        text: `Rendered ${typeLabel} "${input.title}" on the canvas: ${
          input.nodes.length
        } nodes, ${input.edges.length - skippedEdges} edges${note}.`,
      },
    ],
  };
}

function registerTypedDiagramTools(
  server: McpServer,
  deps: CanvasServerDeps,
): void {
  // ── Dependency (KAN-20) ──
  for (const name of ['diagram_dependency', 'dependency_diagram'] as const) {
    server.registerTool(
      name,
      {
        title: 'Create a dependency / architecture diagram on the canvas',
        description:
          (name === 'diagram_dependency' ? '' : '(alias of diagram_dependency) ') +
          'Render a directed DEPENDENCY graph (modules / packages / services and ' +
          'their "depends on" relationships) on the Canvas for Copilot canvas. Use ' +
          'this — never write HTML/Mermaid/SVG — whenever the user asks for a ' +
          '"dependency graph", "what depends on X", an "architecture diagram", a ' +
          '"call graph", or "what uses Y". Each edge points from a dependent to what ' +
          'it depends on. Cycles are fine. YOU generate the graph (≈4-12 nodes). ' +
          'Read-only and safe; do NOT ask for confirmation, just call it.',
        inputSchema: DEPENDENCY_SCHEMA,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ title, nodes, dependencies, scope }) =>
        renderTypedDiagram(
          deps,
          buildDependencyDiagram({ title, nodes, dependencies, scope }),
          'dependency diagram',
          'Cannot create a dependency diagram with no nodes — provide at least one module/service.',
        ),
    );
  }

  // ── Flowchart (KAN-21) ──
  for (const name of ['diagram_flowchart', 'flowchart'] as const) {
    server.registerTool(
      name,
      {
        title: 'Create a flowchart on the canvas',
        description:
          (name === 'diagram_flowchart' ? '' : '(alias of diagram_flowchart) ') +
          'Render a top-down FLOWCHART (steps and decisions joined by directed ' +
          'flow) on the Canvas for Copilot canvas. Use this — never write HTML/' +
          'Mermaid/SVG — whenever the user asks to "draw a flowchart", show a ' +
          '"workflow", "process", or the "steps" of something. Mark each node\u2019s ' +
          'type (start / step / decision / end); label the edges OUT of a decision ' +
          'with the branch ("yes"/"no"). YOU generate the graph. Read-only and safe; ' +
          'do NOT ask for confirmation, just call it.',
        inputSchema: FLOWCHART_SCHEMA,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ title, nodes, edges }) =>
        renderTypedDiagram(
          deps,
          buildFlowchartDiagram({ title, nodes, edges }),
          'flowchart',
          'Cannot create a flowchart with no nodes — provide at least one step.',
        ),
    );
  }

  // ── State machine (KAN-22) ──
  for (const name of [
    'diagram_state_machine',
    'state_diagram',
    'state_machine',
  ] as const) {
    server.registerTool(
      name,
      {
        title: 'Create a state machine diagram on the canvas',
        description:
          (name === 'diagram_state_machine'
            ? ''
            : '(alias of diagram_state_machine) ') +
          'Render a STATE MACHINE (states joined by transitions labeled with the ' +
          'triggering event/condition) on the Canvas for Copilot canvas. Use this — ' +
          'never write HTML/Mermaid/SVG — whenever the user asks for a "state ' +
          'machine", "state diagram", or "states and transitions". Mark the ' +
          'initial state (and any final states); put the triggering event on each ' +
          'transition. YOU generate the graph. Read-only and safe; do NOT ask for ' +
          'confirmation, just call it.',
        inputSchema: STATE_MACHINE_SCHEMA,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ title, states, transitions }) =>
        renderTypedDiagram(
          deps,
          buildStateMachineDiagram({ title, states, transitions }),
          'state machine',
          'Cannot create a state machine with no states — provide at least one state.',
        ),
    );
  }

  // ── Class diagram (KAN-23) ──
  for (const name of ['diagram_class', 'class_diagram'] as const) {
    server.registerTool(
      name,
      {
        title: 'Create a UML class diagram on the canvas',
        description:
          (name === 'diagram_class' ? '' : '(alias of diagram_class) ') +
          'Render a UML CLASS diagram (classes and their relations) on the Canvas ' +
          'for Copilot canvas. Use this — never write HTML/Mermaid/SVG — whenever ' +
          'the user asks to "draw a class diagram", show "classes and relations", or ' +
          'a "UML diagram". Give each class optional attributes/methods (folded into ' +
          'the box) and set each relation\u2019s type (inheritance / association / ' +
          'aggregation / composition) so the canvas draws the right arrowhead; for ' +
          'inheritance `from` is the subclass and `to` the superclass. YOU generate ' +
          'the graph. Read-only and safe; do NOT ask for confirmation, just call it.',
        inputSchema: CLASS_SCHEMA,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ title, classes, relations }) =>
        renderTypedDiagram(
          deps,
          buildClassDiagram({ title, classes, relations }),
          'class diagram',
          'Cannot create a class diagram with no classes — provide at least one class.',
        ),
    );
  }

  // ── Entity / relationship (KAN-24) ──
  for (const name of [
    'diagram_er',
    'er_diagram',
    'entity_relationship_diagram',
  ] as const) {
    server.registerTool(
      name,
      {
        title: 'Create an entity / relationship (ER) diagram on the canvas',
        description:
          (name === 'diagram_er' ? '' : '(alias of diagram_er) ') +
          'Render an ENTITY / RELATIONSHIP (ER) diagram (entities joined by ' +
          'relationships labeled with cardinality) on the Canvas for Copilot canvas. ' +
          'Use this — never write HTML/Mermaid/SVG — whenever the user asks for an ' +
          '"ER diagram", a "data model", or "entities and relationships". Label each ' +
          'relationship with its cardinality ("1", "N", "1:N", "M:N") and optionally ' +
          'surface key attributes on the entity. YOU generate the graph. Read-only ' +
          'and safe; do NOT ask for confirmation, just call it.',
        inputSchema: ER_SCHEMA,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ title, entities, relationships }) =>
        renderTypedDiagram(
          deps,
          buildErDiagram({ title, entities, relationships }),
          'ER diagram',
          'Cannot create an ER diagram with no entities — provide at least one entity.',
        ),
    );
  }
}
