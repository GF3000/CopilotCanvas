// Canvas MCP server — scaffold stub (KAN-5).
// The real MCP server (tools + app resource + repo I/O) lands in KAN-8 (mcp-server).
import { PROTOCOL_VERSION } from '@canvas/shared';

export function main(): void {
  console.log(`Canvas MCP server stub — protocol v${PROTOCOL_VERSION}`);
}

main();
