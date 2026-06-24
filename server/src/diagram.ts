// Build a diagram message from a simple {title, nodes, edges} graph the model
// produces. Keeps the LLM-facing shape flat; converts to Cytoscape elements.
import type { CyElement, CyStyle, DiagramMessage, NodeKind } from '@canvas/shared';

const STYLE_CLASSES = [
  'big',
  'small',
  'highlight',
  'muted',
  'danger',
  'success',
  'warning',
] as const;

export type StyleClass = (typeof STYLE_CLASSES)[number];

export { STYLE_CLASSES };

export interface DiagramInputNode {
  id: string;
  label: string;
  kind?: NodeKind;
  classes?: string[];
  style?: CyStyle;
}

export interface DiagramInputEdge {
  source: string;
  target: string;
  label?: string;
  classes?: string[];
  style?: CyStyle;
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

/** Drop undefined keys so a style object only carries what was set. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

function styleOf(style: CyStyle | undefined): CyStyle | undefined {
  if (!style) return undefined;
  const compacted = compact({
    color: style.color,
    fontSize: style.fontSize,
    size: style.size,
  });
  return Object.keys(compacted).length > 0 ? compacted : undefined;
}

function classesOf(classes: string[] | undefined): string | undefined {
  const cleaned = (classes ?? []).filter((c) => c.trim() !== '');
  return cleaned.length > 0 ? cleaned.join(' ') : undefined;
}

/** A stable, unique edge id so edges are addressable (selection/edit). */
export function edgeId(
  source: string,
  target: string,
  used: Set<string>,
): string {
  const base = `${source}->${target}`;
  let id = base;
  let n = 1;
  while (used.has(id)) id = `${base}#${++n}`;
  used.add(id);
  return id;
}

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

  const usedIds = new Set(ids);
  const elements: CyElement[] = [
    ...input.nodes.map<CyElement>((n) => ({
      data: compact({ id: n.id, label: n.label, kind: n.kind }),
      classes: classesOf(n.classes),
      style: styleOf(n.style),
    })),
    ...validEdges.map<CyElement>((e) => ({
      data: compact({
        id: edgeId(e.source, e.target, usedIds),
        source: e.source,
        target: e.target,
        label: e.label,
      }),
      classes: classesOf(e.classes),
      style: styleOf(e.style),
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
