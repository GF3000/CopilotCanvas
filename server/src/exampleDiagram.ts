// The fixed "example" diagram — the first feature of the app (KAN-16 prototype).
// A self-describing graph of how Canvas for Copilot works, so "show me an example
// for canvas for copilot" renders something meaningful.
import type { CyElement, DiagramMessage } from '@canvas/shared';

const ELEMENTS: CyElement[] = [
  { data: { id: 'dev', label: 'Developer', kind: 'entrypoint' } },
  { data: { id: 'cli', label: 'Copilot CLI', kind: 'service' } },
  { data: { id: 'mcp', label: 'Canvas MCP Server', kind: 'service' } },
  { data: { id: 'ext', label: 'VS Code Extension', kind: 'service' } },
  { data: { id: 'webview', label: 'Canvas Webview', kind: 'module' } },
  { data: { id: 'cy', label: 'Cytoscape Graph', kind: 'module' } },

  { data: { source: 'dev', target: 'cli', label: 'prompt' } },
  { data: { source: 'cli', target: 'mcp', label: 'calls tool' } },
  { data: { source: 'mcp', target: 'ext', label: 'diagram' } },
  { data: { source: 'ext', target: 'webview', label: 'postMessage' } },
  { data: { source: 'webview', target: 'cy', label: 'renders' } },
  { data: { source: 'dev', target: 'webview', label: 'interacts' } },
];

/** Build the fixed example diagram as a `diagram` protocol message. */
export function getExampleDiagram(sessionId = 'example'): DiagramMessage {
  return {
    type: 'diagram',
    sessionId,
    diagramId: 'example-1',
    title: 'Canvas for Copilot — Example',
    elements: ELEMENTS.map((e) => ({ data: { ...e.data }, classes: e.classes })),
    version: 1,
  };
}

/** Count of node elements (those without a `source`) in a diagram. */
export function nodeCount(diagram: DiagramMessage): number {
  return diagram.elements.filter((e) => e.data.source === undefined).length;
}
