// Client-side scope / drill-down helpers (KAN-20..24 follow-up).
// Pure functions over the protocol's CyElement[] so they're unit-testable without
// Cytoscape or a DOM. "Expand" focuses an element + its directly-connected
// neighbours as a sub-scope of the SAME diagram (same elements, kinds, classes,
// notation); the canvas keeps a stack so the user can step "Back" to the previous
// scope. See canvas/src/main.ts for the wiring and docs/DIAGRAM_TOOLS.md.
import type { CyElement } from '@canvas/shared';

/** An element is an edge when its data carries a `source` or `target` (D4/D5). */
function isEdge(el: CyElement): boolean {
  return el.data.source !== undefined || el.data.target !== undefined;
}

/** Count the node elements (those without source/target) in a list. */
export function countNodes(elements: CyElement[]): number {
  return elements.filter((el) => !isEdge(el)).length;
}

/** The display label of a node id, if present. */
export function nodeLabel(elements: CyElement[], nodeId: string): string | undefined {
  const node = elements.find((el) => !isEdge(el) && el.data.id === nodeId);
  return typeof node?.data.label === 'string' ? node.data.label : undefined;
}

/**
 * The closed 1-hop neighbourhood of `nodeId`: the node itself plus every node
 * directly connected to it (in either direction), and the edges among the kept
 * nodes. Returns the matching subset of `elements` (preserving their styling), so
 * rendering it "drills into" that element while staying the same diagram type.
 *
 * Edges whose endpoints are both kept are included — including the focused node's
 * own edges and any edges between two neighbours.
 */
export function closedNeighbourhood(
  elements: CyElement[],
  nodeId: string,
): CyElement[] {
  const keep = new Set<string>([nodeId]);
  for (const el of elements) {
    if (!isEdge(el)) continue;
    const { source, target } = el.data;
    if (source === nodeId && typeof target === 'string') keep.add(target);
    if (target === nodeId && typeof source === 'string') keep.add(source);
  }

  return elements.filter((el) => {
    if (!isEdge(el)) {
      return typeof el.data.id === 'string' && keep.has(el.data.id);
    }
    const { source, target } = el.data;
    return (
      typeof source === 'string' &&
      keep.has(source) &&
      typeof target === 'string' &&
      keep.has(target)
    );
  });
}
