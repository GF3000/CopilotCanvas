// Canvas MCP server — public API (KAN-8 seed + KAN-16 prototype).
// Consumed in-process by the VS Code extension (Pattern 1, ADR-007 addendum).
export { getExampleDiagram, nodeCount } from './exampleDiagram';
export { buildCanvasMcpServer } from './mcpServer';
export type { CanvasServerDeps } from './mcpServer';
export {
  startCanvasMcpHttpServer,
  DEFAULT_CANVAS_MCP_PORT,
} from './httpServer';
export type { CanvasHttpServer, CanvasHttpServerOptions } from './httpServer';
