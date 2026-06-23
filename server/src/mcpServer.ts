// Canvas MCP server definition (KAN-8 seed). Exposes the tools Copilot CLI can
// call. Pattern 1 (ADR-007 addendum): this runs in-process inside the VS Code
// extension, so a tool handler can render directly into the webview via `deps`.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DiagramMessage } from '@canvas/shared';
import { getExampleDiagram, nodeCount } from './exampleDiagram';

export interface CanvasServerDeps {
  /** Called when a tool wants to render a diagram in the canvas tab. */
  onOpenDiagram: (diagram: DiagramMessage) => void | Promise<void>;
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

  return server;
}
