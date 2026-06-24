import { describe, it, expect } from 'vitest';
import { validateGraphModel } from './graphModel';

describe('validateGraphModel', () => {
  it('accepts a valid nodes + edges model', () => {
    const result = validateGraphModel([
      { data: { id: 'A', label: 'Login', kind: 'entrypoint' } },
      { data: { id: 'B', label: 'Auth service', kind: 'service' } },
      { data: { source: 'A', target: 'B' } },
    ]);
    expect(result.ok).toBe(true);
  });

  it('accepts an empty graph', () => {
    expect(validateGraphModel([]).ok).toBe(true);
  });

  it('rejects a non-array model', () => {
    const result = validateGraphModel({ data: { id: 'A' } });
    expect(result).toEqual({
      ok: false,
      errors: ['The graph model must be an array of nodes and edges.'],
    });
  });

  it('rejects an element without a data object', () => {
    const result = validateGraphModel([{ id: 'A' }, null]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('Element #1 is missing a "data" object.');
      expect(result.errors).toContain('Element #2 is missing a "data" object.');
    }
  });

  it('rejects a node without a string id', () => {
    const result = validateGraphModel([{ data: { label: 'no id' } }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Node #1 is missing a non-empty string "data.id".',
      );
    }
  });

  it('rejects duplicate node ids', () => {
    const result = validateGraphModel([
      { data: { id: 'A' } },
      { data: { id: 'A' } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Duplicate node id "A" — node ids must be unique.',
      );
    }
  });

  it('rejects an edge that references a missing node', () => {
    const result = validateGraphModel([
      { data: { id: 'A' } },
      { data: { source: 'A', target: 'ghost' } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Edge #2 references unknown target node "ghost".',
      );
    }
  });

  it('rejects an edge missing a source', () => {
    const result = validateGraphModel([
      { data: { id: 'A' } },
      { data: { target: 'A' } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain(
        'Edge #2 is missing a non-empty "data.source".',
      );
    }
  });

  it('reports every problem at once', () => {
    const result = validateGraphModel([
      { data: { label: 'no id' } },
      { data: { source: 'A', target: 'B' } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(1);
  });
});
