// Build a diagram message from a simple {title, nodes, edges} graph the model
// produces. Keeps the LLM-facing shape flat; converts to Cytoscape elements.
import type { CyElement, DiagramMessage, NodeKind } from '@canvas/shared';

export interface DiagramInputNode {
  id: string;
  label: string;
  kind?: NodeKind;
}

export interface DiagramInputEdge {
  source: string;
  target: string;
  label?: string;
}

export interface DiagramInput {
  title: string;
  nodes: DiagramInputNode[];
  edges: DiagramInputEdge[];
}

export interface BuildResult {
  diagram: DiagramMessage;
  skippedEdges: number;
}

let counter = 0;

/**
 * Convert a {title, nodes, edges} graph into a `diagram` message. Edges that
 * reference unknown node ids are dropped (and counted) so a small model mistake
 * doesn't blank the canvas.
 */
export function buildDiagram(input: DiagramInput): BuildResult {
  const ids = new Set(input.nodes.map((n) => n.id));
  const validEdges = input.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );

  const elements: CyElement[] = [
    ...input.nodes.map<CyElement>((n) => ({
      data: { id: n.id, label: n.label, kind: n.kind },
    })),
    ...validEdges.map<CyElement>((e) => ({
      data: { source: e.source, target: e.target, label: e.label },
    })),
  ];

  counter += 1;
  return {
    diagram: {
      type: 'diagram',
      sessionId: 'cli',
      diagramId: `diagram-${Date.now()}-${counter}`,
      title: input.title,
      elements,
      version: 1,
    },
    skippedEdges: input.edges.length - validEdges.length,
  };
}
