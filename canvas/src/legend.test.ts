import { describe, it, expect } from 'vitest';
import {
  computeLegendEntries,
  KIND_LEGEND,
  STATUS_LEGEND,
  type LegendNode,
} from './legend';

const noStatus = new Set<string>();

describe('computeLegendEntries', () => {
  it('shows a kind entry for each kind present (at its default colour)', () => {
    const nodes: LegendNode[] = [
      { kind: 'service' },
      { kind: 'service' },
      { kind: 'datastore' },
    ];
    const keys = computeLegendEntries(nodes, noStatus).map((e) => e.key);
    expect(keys).toEqual(['service', 'datastore']);
  });

  it('drops a kind whose only node was recoloured, and lists the custom colour', () => {
    // A single service node recoloured red → no truthful "service = violet" swatch,
    // but a custom red entry instead (KAN-40).
    const nodes: LegendNode[] = [
      { kind: 'service', override: { color: '#f43f5e', label: 'Rose' } },
    ];
    const entries = computeLegendEntries(nodes, noStatus);
    expect(entries.map((e) => e.key)).not.toContain('service');
    expect(entries).toEqual([
      { key: 'custom-#f43f5e', label: 'Rose', color: '#f43f5e' },
    ]);
  });

  it('keeps the kind entry when some nodes of that kind are still default', () => {
    const nodes: LegendNode[] = [
      { kind: 'service' }, // default
      { kind: 'service', override: { color: '#f43f5e', label: 'Rose' } }, // recoloured
    ];
    const entries = computeLegendEntries(nodes, noStatus);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain('service');
    expect(keys).toContain('custom-#f43f5e');
  });

  it('reflects a CLI inline colour from the initial render (the "at start" case)', () => {
    const nodes: LegendNode[] = [
      { kind: 'module', override: { color: '#22c55e', label: 'Custom' } },
    ];
    const entries = computeLegendEntries(nodes, noStatus);
    expect(entries).toEqual([
      { key: 'custom-#22c55e', label: 'Custom', color: '#22c55e' },
    ]);
  });

  it('dedupes identical override colours (case-insensitively)', () => {
    const nodes: LegendNode[] = [
      { kind: 'a', override: { color: '#AABBCC', label: 'Custom' } },
      { kind: 'b', override: { color: '#aabbcc', label: 'Custom' } },
    ];
    const custom = computeLegendEntries(nodes, noStatus).filter((e) =>
      e.key.startsWith('custom-'),
    );
    expect(custom).toHaveLength(1);
  });

  it('includes status classes that are present', () => {
    const entries = computeLegendEntries(
      [{ kind: 'service' }],
      new Set(['danger', 'linked']),
    );
    const keys = entries.map((e) => e.key);
    expect(keys).toEqual(['service', 'danger', 'linked']);
  });

  it('orders entries kinds → statuses → custom', () => {
    const nodes: LegendNode[] = [
      { kind: 'service' },
      { kind: 'module', override: { color: '#000000', label: 'Custom' } },
    ];
    const keys = computeLegendEntries(nodes, new Set(['success'])).map((e) => e.key);
    expect(keys).toEqual(['service', 'success', 'custom-#000000']);
  });

  it('returns nothing for an empty / kind-less graph', () => {
    expect(computeLegendEntries([], noStatus)).toEqual([]);
    expect(computeLegendEntries([{}], noStatus)).toEqual([]);
  });

  it('exposes the canonical kind/status palettes', () => {
    expect(KIND_LEGEND.find((e) => e.key === 'datastore')?.color).toBe('#06b6d4');
    expect(STATUS_LEGEND.map((e) => e.key)).toContain('warning');
  });
});
