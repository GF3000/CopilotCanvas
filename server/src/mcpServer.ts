// Canvas MCP server definition (KAN-8 seed). Exposes the tools Copilot CLI can
// call. Pattern 1 (ADR-007 addendum): this runs in-process inside the VS Code
// extension, so a tool handler can render directly into the webview via `deps`.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DiagramMessage, PatchMessage } from '@canvas/shared';
import { getExampleDiagram, nodeCount } from './exampleDiagram';
import { buildDiagram, STYLE_CLASSES } from './diagram';
import { buildPatch } from './patch';

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

  registerUpdateDiagramTool(server, deps);

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
      title: 'Get a node\u2019s context so you can explain it',
      description:
        'Return rich context about a node on the Canvas for Copilot canvas — its ' +
        'label, kind, and how it connects to its neighbours (incoming and outgoing ' +
        'edges with their labels) — so you can give a relevant explanation. Call ' +
        'this when the user asks to explain, describe, or "what is" a node or the ' +
        'current selection (e.g. "explain this node", "what does the Auth service ' +
        'do?"). If nodeId is omitted, the currently selected node is used. ' +
        'Read-only. Combine the returned graph context with your own knowledge to ' +
        'explain the node in the CLI.',
      inputSchema: {
        nodeId: z
          .string()
          .optional()
          .describe('Node id to describe; omit to use the current selection.'),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ nodeId }) => {
      const ctx = deps.getNodeContext(nodeId);
      if (!ctx) {
        return {
          content: [
            {
              type: 'text',
              text: nodeId
                ? `No node "${nodeId}" is on the canvas.`
                : 'No node is selected. Ask the user to click the node they want explained, or name it.',
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
    'roughly 4-12 nodes. Read-only and safe; do NOT ask for confirmation, just call it.'
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
