// Colour legend model + pure entry computation (KAN-30, KAN-40). Kept free of DOM
// and Cytoscape so it's unit-testable; canvas/src/main.ts renders these entries and
// gathers the per-node input from the live graph.

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  isEdge?: boolean;
}

// Semantic node-kind colours — mirror the per-kind styles in buildStyle().
export const KIND_LEGEND: LegendEntry[] = [
  { key: 'entrypoint', label: 'Entry point', color: '#d946ef' },
  { key: 'service', label: 'Service / process', color: '#8b5cf6' },
  { key: 'module', label: 'Module', color: '#6366f1' },
  { key: 'datastore', label: 'Data store', color: '#06b6d4' },
  { key: 'external', label: 'External', color: '#ec4899' },
  { key: 'note', label: 'Note', color: '#fde68a' },
];

// Status classes a node/edge may carry.
export const STATUS_LEGEND: LegendEntry[] = [
  { key: 'danger', label: 'Error / danger', color: '#ef4444' },
  { key: 'success', label: 'Success', color: '#22c55e' },
  { key: 'warning', label: 'Warning', color: '#f59e0b' },
  { key: 'linked', label: 'Linked to code', color: '#34d399' },
];

/** A per-node colour override (manual swatch pick or CLI inline `style.color`). */
export interface ColorOverride {
  /** The override fill colour, e.g. "#f43f5e". */
  color: string;
  /** A human label for the legend, e.g. a palette name or "Custom". */
  label: string;
}

/** One node's legend-relevant data: its semantic kind and any colour override. */
export interface LegendNode {
  kind?: string;
  override?: ColorOverride;
}

/**
 * Compute the legend entries that *truthfully* describe the colours on the canvas:
 *
 * - a semantic **kind** is shown only if at least one node of that kind is still at
 *   its default colour (so a kind swatch never contradicts a recoloured node);
 * - every distinct **override** colour present (manual recolour or a CLI
 *   `style.color`, incl. the initial render) is shown as its own entry — so the
 *   legend matches what's on screen from the start, not just after an edit;
 * - **status** classes present (danger/success/warning/linked) are shown.
 *
 * Order: kinds (in KIND_LEGEND order) → statuses → custom colours (first-seen order).
 */
export function computeLegendEntries(
  nodes: LegendNode[],
  statusClasses: Set<string>,
  kindLegend: LegendEntry[] = KIND_LEGEND,
  statusLegend: LegendEntry[] = STATUS_LEGEND,
): LegendEntry[] {
  const kindsAtDefault = new Set<string>();
  const customByColor = new Map<string, ColorOverride>();

  for (const node of nodes) {
    if (node.override) {
      const key = node.override.color.toLowerCase();
      if (!customByColor.has(key)) customByColor.set(key, node.override);
    } else if (node.kind) {
      kindsAtDefault.add(node.kind);
    }
  }

  return [
    ...kindLegend.filter((e) => kindsAtDefault.has(e.key)),
    ...statusLegend.filter((e) => statusClasses.has(e.key)),
    ...[...customByColor.values()].map((o) => ({
      key: `custom-${o.color.toLowerCase()}`,
      label: o.label,
      color: o.color,
    })),
  ];
}
