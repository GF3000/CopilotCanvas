// Local HTTP host for the Canvas MCP server (Pattern 1, ADR-007 addendum).
// Exposes a Streamable HTTP MCP endpoint on localhost that Copilot CLI connects to
// via an mcp-config.json entry. Stateless + JSON responses keep it simple: a fresh
// McpServer + transport per request.
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { DiagramMessage, PatchMessage } from '@canvas/shared';
import { buildCanvasMcpServer, type CanvasSelectionInfo, type CanvasNodeContext, type CanvasServerDeps } from './mcpServer';

export const DEFAULT_CANVAS_MCP_PORT = 4123;

export interface CanvasHttpServerOptions {
  port?: number;
  host?: string;
  onOpenDiagram: (diagram: DiagramMessage) => void | Promise<void>;
  onPatchDiagram: (patch: PatchMessage) => boolean | Promise<boolean>;
  getSelection: () => CanvasSelectionInfo;
  getNodeContext: (id?: string) => CanvasNodeContext | undefined;
  linkNodeToCode: CanvasServerDeps['linkNodeToCode'];
  openNodeCode: CanvasServerDeps['openNodeCode'];
}

export interface CanvasHttpServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/** Start the local HTTP MCP server. Resolves once it is listening. */
export function startCanvasMcpHttpServer(
  opts: CanvasHttpServerOptions,
): Promise<CanvasHttpServer> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? DEFAULT_CANVAS_MCP_PORT;

  const server = http.createServer((req, res) => {
    void handleRequest(req, res, opts);
  });

  return new Promise<CanvasHttpServer>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({
        url: `http://${host}:${port}/mcp`,
        port,
        close: () =>
          new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  opts: CanvasHttpServerOptions,
): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname !== '/mcp') {
    res.writeHead(404).end();
    return;
  }
  if (req.method !== 'POST') {
    // Stateless JSON mode: only POST is supported (no SSE stream).
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  const body = await readJson(req).catch(() => undefined);
  const mcp = buildCanvasMcpServer({
    onOpenDiagram: opts.onOpenDiagram,
    onPatchDiagram: opts.onPatchDiagram,
    getSelection: opts.getSelection,
    getNodeContext: opts.getNodeContext,
    linkNodeToCode: opts.linkNodeToCode,
    openNodeCode: opts.openNodeCode,
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    void transport.close();
    void mcp.close();
  });

  await mcp.connect(transport);
  await transport.handleRequest(req, res, body);
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch (err) {
        reject(err as Error);
      }
    });
    req.on('error', reject);
  });
}
