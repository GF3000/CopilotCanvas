import { describe, it, expect } from 'vitest';
import type { CyElement } from '@canvas/shared';
import { closedNeighbourhood, countNodes, nodeLabel } from './scope';

// A small dependency-style graph: A → B, A → C, B → D, C → D.
const ELEMENTS: CyElement[] = [
  { data: { id: 'A', label: 'Alpha', kind: 'module' } },
  { data: { id: 'B', label: 'Beta', kind: 'module' } },
  { data: { id: 'C', label: 'Gamma', kind: 'service' } },
  { data: { id: 'D', label: 'Delta', kind: 'module' } },
  { data: { id: 'A->B', source: 'A', target: 'B' } },
  { data: { id: 'A->C', source: 'A', target: 'C' } },
  { data: { id: 'B->D', source: 'B', target: 'D' } },
  { data: { id: 'C->D', source: 'C', target: 'D' } },
];

describe('closedNeighbourhood', () => {
  it('keeps the focused node + its direct neighbours (both directions)', () => {
    const sub = closedNeighbourhood(ELEMENTS, 'A');
    const ids = sub.filter((e) => e.data.source === undefined).map((e) => e.data.id);
    expect(ids.sort()).toEqual(['A', 'B', 'C']);
    // D is two hops away and excluded.
    expect(ids).not.toContain('D');
  });

  it('includes incoming neighbours too', () => {
    const sub = closedNeighbourhood(ELEMENTS, 'D');
    const ids = sub.filter((e) => e.data.source === undefined).map((e) => e.data.id);
    expect(ids.sort()).toEqual(['B', 'C', 'D']);
  });

  it('only keeps edges whose endpoints are both in the subset', () => {
    const sub = closedNeighbourhood(ELEMENTS, 'A');
    const edgeIds = sub.filter((e) => e.data.source !== undefined).map((e) => e.data.id);
    // A->B and A->C kept; B->D and C->D dropped (D excluded).
    expect(edgeIds.sort()).toEqual(['A->B', 'A->C']);
  });

  it('preserves the original element styling (kind/classes)', () => {
    const sub = closedNeighbourhood(ELEMENTS, 'A');
    const c = sub.find((e) => e.data.id === 'C');
    expect(c?.data.kind).toBe('service');
  });

  it('returns just the node when it has no neighbours', () => {
    const isolated: CyElement[] = [
      { data: { id: 'X', label: 'X' } },
      { data: { id: 'Y', label: 'Y' } },
    ];
    const sub = closedNeighbourhood(isolated, 'X');
    expect(countNodes(sub)).toBe(1);
    expect(sub[0].data.id).toBe('X');
  });
});

describe('countNodes / nodeLabel', () => {
  it('counts only nodes', () => {
    expect(countNodes(ELEMENTS)).toBe(4);
  });

  it('resolves a node label', () => {
    expect(nodeLabel(ELEMENTS, 'B')).toBe('Beta');
    expect(nodeLabel(ELEMENTS, 'missing')).toBeUndefined();
  });
});
