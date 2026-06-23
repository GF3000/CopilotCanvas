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
    'open_example_diagram',
    {
      title: 'Open the Canvas for Copilot canvas (example diagram)',
      description:
        'Open the Canvas for Copilot canvas as a VS Code tab and render the ' +
        'example diagram. Call this whenever the user asks to open, show, launch, ' +
        'or see Canvas for Copilot, the canvas, or an example/demo/sample of it — ' +
        'e.g. "open canvas for copilot", "open the canvas", "show me canvas for ' +
        'copilot", or "show me an example for canvas for copilot".',
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
