// Validate a `diagram` message's `elements` before handing them to Cytoscape.
// LLMs can emit a broken graph model (missing/duplicate node ids, edges pointing
// at non-existent nodes, malformed `data`) that would otherwise render a blank or
// broken canvas. We surface a readable error instead (FR-1, TC-2; see
// docs/ARCHITECTURE.md "Diagram integrity").
import type { CyElement } from '@canvas/shared';

export type GraphValidation =
  | { ok: true; elements: CyElement[] }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

// An element is an edge when its data carries a `source` or `target` (D4/D5).
function isEdge(data: Record<string, unknown>): boolean {
  return data.source !== undefined || data.target !== undefined;
}

/**
 * Validate a raw `elements` array against the protocol's graph model. Collects
 * every problem (not just the first) so the canvas can show one actionable list.
 */
export function validateGraphModel(elements: unknown): GraphValidation {
  if (!Array.isArray(elements)) {
    return {
      ok: false,
      errors: ['The graph model must be an array of nodes and edges.'],
    };
  }

  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const duplicateIds = new Set<string>();

  // First pass: register node ids so edges can be checked against them.
  elements.forEach((element, index) => {
    const position = `#${index + 1}`;
    if (!isRecord(element) || !isRecord(element.data)) {
      errors.push(`Element ${position} is missing a "data" object.`);
      return;
    }
    if (isEdge(element.data)) return;

    const id = element.data.id;
    if (!isNonEmptyString(id)) {
      errors.push(`Node ${position} is missing a non-empty string "data.id".`);
      return;
    }
    if (nodeIds.has(id)) duplicateIds.add(id);
    nodeIds.add(id);
  });

  duplicateIds.forEach((id) =>
    errors.push(`Duplicate node id "${id}" — node ids must be unique.`),
  );

  // Second pass: every edge must connect two known nodes.
  elements.forEach((element, index) => {
    if (!isRecord(element) || !isRecord(element.data)) return; // already reported
    const { data } = element;
    if (!isEdge(data)) return;

    const position = `#${index + 1}`;
    if (!isNonEmptyString(data.source)) {
      errors.push(`Edge ${position} is missing a non-empty "data.source".`);
    } else if (!nodeIds.has(data.source)) {
      errors.push(`Edge ${position} references unknown source node "${data.source}".`);
    }
    if (!isNonEmptyString(data.target)) {
      errors.push(`Edge ${position} is missing a non-empty "data.target".`);
    } else if (!nodeIds.has(data.target)) {
      errors.push(`Edge ${position} references unknown target node "${data.target}".`);
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, elements: elements as CyElement[] };
}
