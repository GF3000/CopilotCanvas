// Full-state diagram snapshot + restore for undo (KAN-34). Kept as small functions
// over a Cytoscape `Core` so they can be unit-tested headlessly (canvas/src/main.ts
// wraps these with the title / colour-override / scope bookkeeping it also restores).
//
// A snapshot stores nodes and edges as element JSON (data + position + the element's
// bypass style) plus the viewport, so a restore reproduces the EXACT previous look
// and layout without re-running the layout. Nodes and edges are stored separately so
// a restore always adds nodes before edges (an edge can't be added before its
// endpoints exist).
import type { Core, ElementDefinition } from 'cytoscape';

export interface DiagramSnapshot {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
  zoom: number;
  pan: { x: number; y: number };
}

/** Capture the full current graph + viewport. */
export function captureDiagram(cy: Core): DiagramSnapshot {
  return {
    nodes: cy.nodes().jsons() as unknown as ElementDefinition[],
    edges: cy.edges().jsons() as unknown as ElementDefinition[],
    zoom: cy.zoom(),
    pan: { ...cy.pan() },
  };
}

/** Replace the graph with a snapshot and restore its viewport (no layout run). */
export function restoreDiagram(cy: Core, snapshot: DiagramSnapshot): void {
  cy.batch(() => {
    cy.elements().remove();
    cy.add(snapshot.nodes); // nodes first so edges can resolve their endpoints
    cy.add(snapshot.edges);
  });
  cy.zoom(snapshot.zoom);
  cy.pan(snapshot.pan);
}
