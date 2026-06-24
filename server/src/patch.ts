// Build a `patch` message from simple edit ops the model produces. A patch edits
// the currently displayed diagram in place (the canvas preserves pan/zoom and
// node positions) instead of regenerating it.
import type { CyElement, CyStyle, NodeKind, PatchMessage } from '@canvas/shared';
import { edgeId } from './diagram';

export interface PatchUpdate {
  id: string;
  label?: string;
  kind?: NodeKind;
  classes?: string[];
  style?: CyStyle;
}

export interface PatchAddNode {
  id: string;
  label: string;
  kind?: NodeKind;
  classes?: string[];
  style?: CyStyle;
}

export interface PatchAddEdge {
  source: string;
  target: string;
  label?: string;
  classes?: string[];
  style?: CyStyle;
}

export interface PatchInput {
  update?: PatchUpdate[];
  addNodes?: PatchAddNode[];
  addEdges?: PatchAddEdge[];
  remove?: string[];
}

export interface PatchBuildResult {
  patch: PatchMessage;
  counts: { updated: number; added: number; removed: number };
}

let patchCounter = 0;

/** Drop undefined values so a partial update merges cleanly (no overwriting
 * existing data with `undefined`). */
function compactData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
}

function styleOf(style: CyStyle | undefined): CyStyle | undefined {
  if (!style) return undefined;
  const compacted = compactData({
    color: style.color,
    fontSize: style.fontSize,
    size: style.size,
  }) as CyStyle;
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function classesOf(classes: string[] | undefined): string | undefined {
  const cleaned = (classes ?? []).filter((c) => c.trim() !== '');
  return cleaned.length > 0 ? cleaned.join(' ') : undefined;
}

export function buildPatch(input: PatchInput): PatchBuildResult {
  const update: CyElement[] = (input.update ?? []).map((u) => ({
    data: compactData({ id: u.id, label: u.label, kind: u.kind }),
    classes: classesOf(u.classes),
    style: styleOf(u.style),
  }));

  const usedEdgeIds = new Set<string>();
  const add: CyElement[] = [
    ...(input.addNodes ?? []).map<CyElement>((n) => ({
      data: compactData({ id: n.id, label: n.label, kind: n.kind }),
      classes: classesOf(n.classes),
      style: styleOf(n.style),
    })),
    ...(input.addEdges ?? []).map<CyElement>((e) => ({
      data: compactData({
        id: edgeId(e.source, e.target, usedEdgeIds),
        source: e.source,
        target: e.target,
        label: e.label,
      }),
      classes: classesOf(e.classes),
      style: styleOf(e.style),
    })),
  ];

  const remove = input.remove ?? [];

  patchCounter += 1;
  return {
    patch: {
      type: 'patch',
      sessionId: 'cli',
      // The extension stamps the live diagramId when relaying; the canvas applies
      // the patch to whatever diagram is currently displayed.
      diagramId: 'current',
      version: patchCounter,
      add,
      remove,
      update,
    },
    counts: {
      updated: update.length,
      added: add.length,
      removed: remove.length,
    },
  };
}
