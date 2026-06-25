import { describe, it, expect } from 'vitest';
import cytoscape from 'cytoscape';
import { captureDiagram, restoreDiagram } from './snapshot';

// Headless Cytoscape (no DOM) is enough to exercise add/remove/json round-trips.
// (Headless mode ignores initial element `position` options, so we set positions
// explicitly after creation — matching how the real layout assigns them.)
function makeCy() {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      { data: { id: 'a', label: 'Alpha', kind: 'service' } },
      { data: { id: 'b', label: 'Beta', kind: 'module' } },
      { data: { id: 'a->b', source: 'a', target: 'b' } },
    ],
  });
  cy.getElementById('a').position({ x: 0, y: 0 });
  cy.getElementById('b').position({ x: 100, y: 0 });
  return cy;
}

describe('captureDiagram / restoreDiagram', () => {
  it('round-trips the full graph (nodes, edges, data, positions)', () => {
    const cy = makeCy();
    const snap = captureDiagram(cy);

    // Mutate: expand-style change — add a node + edge, remove another.
    cy.add([
      { data: { id: 'c', label: 'Gamma' }, position: { x: 50, y: 80 } },
      { data: { id: 'a->c', source: 'a', target: 'c' } },
    ]);
    cy.getElementById('b').remove();
    expect(cy.nodes().length).toBe(2); // a, c
    expect(cy.getElementById('c').nonempty()).toBe(true);

    // Undo → restore the snapshot.
    restoreDiagram(cy, snap);

    const nodeIds = cy.nodes().map((n) => n.id()).sort();
    expect(nodeIds).toEqual(['a', 'b']); // c gone, b back
    expect(cy.edges().map((e) => e.id())).toEqual(['a->b']);
    expect(cy.getElementById('a').data('label')).toBe('Alpha');
    expect(cy.getElementById('b').data('kind')).toBe('module');
    // Positions preserved (no layout run).
    expect(cy.getElementById('b').position('x')).toBe(100);
  });

  it('restores the viewport (zoom + pan)', () => {
    const cy = makeCy();
    cy.zoom(1.5);
    cy.pan({ x: 20, y: 30 });
    const snap = captureDiagram(cy);

    cy.zoom(3);
    cy.pan({ x: -200, y: 999 });
    restoreDiagram(cy, snap);

    expect(cy.zoom()).toBeCloseTo(1.5);
    expect(cy.pan()).toEqual({ x: 20, y: 30 });
  });

  it('adds nodes before edges so an edge is never orphaned on restore', () => {
    const cy = makeCy();
    const snap = captureDiagram(cy);
    cy.elements().remove();
    expect(cy.elements().length).toBe(0);
    // Should not throw even though the snapshot mixes nodes + edges.
    expect(() => restoreDiagram(cy, snap)).not.toThrow();
    expect(cy.edges().length).toBe(1);
  });
});
