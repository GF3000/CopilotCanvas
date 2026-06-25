// Typed diagram builders (KAN-20..24). Each diagram "type" is its own MCP skill,
// but they all share the generic Cytoscape graph model: a builder maps a
// type-specific, LLM-friendly input into the flat {title, nodes, edges}
// `DiagramInput` consumed by `buildDiagram`. This keeps every diagram type on the
// same render/validation path (edges to unknown nodes are dropped there) while
// giving each type a tuned shape and the right semantic kinds/classes/labels.
import type { NodeKind } from '@canvas/shared';
import type { DiagramInput, DiagramInputNode, DiagramInputEdge } from './diagram';

/* ─── Dependency (KAN-20) ───────────────────────────────────────────────────
 * Modules / packages / services and their "depends on" relationships. Cycles are
 * fine — the layout (dagre) and `buildDiagram` handle them without error.
 *
 * `scope` is the granularity the graph is drawn at when the prompt asks for a
 * particular level (e.g. "the package-level deps", "a call graph"). It only sets the
 * default node `kind` (per-node `kind` still wins); the model picks the actual nodes
 * at that level. */

export type DependencyScope = 'package' | 'module' | 'function' | 'service';

export interface DependencyInput {
  title: string;
  /** Granularity to draw at; defaults to `module`. Honoured when the prompt names a level. */
  scope?: DependencyScope;
  nodes: {
    id: string;
    label: string;
    /**
     * Any canvas node kind (defaults from `scope`): `module`, `service`,
     * `datastore` (databases/caches/queues), `entrypoint`, `external`, `note`.
     */
    kind?: NodeKind;
  }[];
  /** A depends on B: `from` requires/uses `to`. */
  dependencies: { from: string; to: string; label?: string }[];
}

/** Default node kind for a dependency scope (only `service` scope implies `service`). */
export function kindForScope(
  scope: DependencyScope | undefined,
): 'module' | 'service' {
  return scope === 'service' ? 'service' : 'module';
}

export function buildDependencyDiagram(input: DependencyInput): DiagramInput {
  const fallbackKind = kindForScope(input.scope);
  return {
    title: input.title,
    nodes: input.nodes.map<DiagramInputNode>((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind ?? fallbackKind,
    })),
    edges: input.dependencies.map<DiagramInputEdge>((d) => ({
      source: d.from,
      target: d.to,
      label: d.label,
    })),
  };
}

/* ─── Flowchart (KAN-21) ─────────────────────────────────────────────────────
 * Steps and decisions joined by directed flow; decision branches carry labels
 * (e.g. "yes"/"no"). Node `type` drives styling: start = entry point, decision
 * renders as a diamond, end is marked as a terminal (success) node. */

export interface FlowchartInput {
  title: string;
  nodes: {
    id: string;
    label: string;
    /** Defaults to `step`. */
    type?: 'start' | 'step' | 'decision' | 'io' | 'end';
  }[];
  /** Directed flow; `label` carries a decision branch ("yes"/"no") when relevant. */
  edges: { from: string; to: string; label?: string }[];
}

export function buildFlowchartDiagram(input: FlowchartInput): DiagramInput {
  return {
    title: input.title,
    nodes: input.nodes.map<DiagramInputNode>((n) => {
      const type = n.type ?? 'step';
      switch (type) {
        // Terminator (rounded "pill") — start is an entry point, end is terminal.
        case 'start':
          return { id: n.id, label: n.label, kind: 'entrypoint', classes: ['fc-terminator'] };
        case 'end':
          return { id: n.id, label: n.label, classes: ['fc-terminator', 'fc-end'] };
        // Decision — diamond.
        case 'decision':
          return { id: n.id, label: n.label, classes: ['decision'] };
        // Input/output — parallelogram.
        case 'io':
          return { id: n.id, label: n.label, kind: 'service', classes: ['fc-io'] };
        // Process step — sharp rectangle.
        case 'step':
        default:
          return { id: n.id, label: n.label, kind: 'service', classes: ['fc-process'] };
      }
    }),
    edges: input.edges.map<DiagramInputEdge>((e) => ({
      source: e.from,
      target: e.to,
      label: e.label,
    })),
  };
}

/* ─── State machine (KAN-22) ─────────────────────────────────────────────────
 * States joined by transitions labeled with the triggering event/condition.
 * Initial and final states are marked distinctly (classes the canvas styles). */

export interface StateMachineInput {
  title: string;
  states: {
    id: string;
    label: string;
    /** The (single) start state — drawn distinctly. */
    initial?: boolean;
    /** An accepting / terminal state — drawn distinctly. */
    final?: boolean;
  }[];
  /** `event` labels the transition (the trigger/condition). */
  transitions: { from: string; to: string; event?: string }[];
}

export function buildStateMachineDiagram(input: StateMachineInput): DiagramInput {
  return {
    title: input.title,
    nodes: input.states.map<DiagramInputNode>((s) => {
      const classes: string[] = [];
      if (s.initial) classes.push('initial');
      if (s.final) classes.push('final');
      return { id: s.id, label: s.label, classes };
    }),
    edges: input.transitions.map<DiagramInputEdge>((t) => ({
      source: t.from,
      target: t.to,
      label: t.event,
      // UML state transitions use an open (stick) arrowhead.
      classes: ['sm-transition'],
    })),
  };
}

/* ─── Class diagram (KAN-23) ─────────────────────────────────────────────────
 * Classes and their relations. UML compartments aren't available in Cytoscape, so
 * attributes/methods are folded into the node label; the relation kind is carried
 * as an edge class so the canvas can draw distinct arrowheads (▷ inheritance/
 * realization, ◇ aggregation, ◆ composition, → association/dependency; dashed for
 * realization & dependency). See docs/DIAGRAM_TOOLS.md. */

export type ClassRelationType =
  | 'inheritance'
  | 'realization'
  | 'association'
  | 'dependency'
  | 'aggregation'
  | 'composition';

export interface ClassDiagramInput {
  title: string;
  classes: {
    id: string;
    /** Class name. */
    label: string;
    /** Optional attribute lines, e.g. "+ id: string". */
    attributes?: string[];
    /** Optional method lines, e.g. "+ save(): void". */
    methods?: string[];
  }[];
  relations: {
    /**
     * Subclass (inheritance) or the whole/owner (aggregation/composition). The
     * arrowhead is drawn at the `to` end (inheritance) or `from` end (aggregation/
     * composition) by the canvas stylesheet.
     */
    from: string;
    /** Superclass (inheritance) or the part/associate. */
    to: string;
    type?: ClassRelationType;
    label?: string;
  }[];
}

/** Fold a class name + its attribute/method lines into one wrapped node label. */
export function classLabel(
  name: string,
  attributes?: string[],
  methods?: string[],
): string {
  const attrs = (attributes ?? []).filter((a) => a.trim() !== '');
  const meths = (methods ?? []).filter((m) => m.trim() !== '');
  const parts = [name];
  if (attrs.length) parts.push('─────', ...attrs);
  if (meths.length) parts.push('─────', ...meths);
  return parts.join('\n');
}

export function buildClassDiagram(input: ClassDiagramInput): DiagramInput {
  return {
    title: input.title,
    nodes: input.classes.map<DiagramInputNode>((c) => ({
      id: c.id,
      label: classLabel(c.label, c.attributes, c.methods),
      kind: 'module',
      // UML class box — a sharp-cornered rectangle.
      classes: ['uml-class'],
    })),
    edges: input.relations.map<DiagramInputEdge>((r) => ({
      source: r.from,
      target: r.to,
      label: r.label,
      classes: [r.type ?? 'association'],
    })),
  };
}

/* ─── Entity / relationship (KAN-24) ─────────────────────────────────────────
 * Entities (data stores) joined by relationships labeled with cardinality
 * ("1", "N", "1:N", "M:N"). Key attributes can be surfaced in the node label. */

export interface ErDiagramInput {
  title: string;
  entities: {
    id: string;
    /** Entity name. */
    label: string;
    /** Optional key/attribute lines surfaced under the entity name. */
    attributes?: string[];
  }[];
  relationships: {
    from: string;
    to: string;
    /** Verb phrase, e.g. "places", "contains". */
    label?: string;
    /** Cardinality, e.g. "1", "N", "1:N", "M:N". */
    cardinality?: string;
  }[];
}

/** Combine a relationship's verb phrase and cardinality into one edge label. */
export function erEdgeLabel(label?: string, cardinality?: string): string | undefined {
  const l = label?.trim();
  const c = cardinality?.trim();
  if (l && c) return `${l} (${c})`;
  return c || l || undefined;
}

export function buildErDiagram(input: ErDiagramInput): DiagramInput {
  return {
    title: input.title,
    nodes: input.entities.map<DiagramInputNode>((e) => {
      const attrs = (e.attributes ?? []).filter((a) => a.trim() !== '');
      const label = attrs.length
        ? [e.label, '─────', ...attrs].join('\n')
        : e.label;
      // ER entity — a sharp-cornered "table" box.
      return { id: e.id, label, kind: 'datastore', classes: ['er-entity'] };
    }),
    edges: input.relationships.map<DiagramInputEdge>((r) => ({
      source: r.from,
      target: r.to,
      label: erEdgeLabel(r.label, r.cardinality),
      // ER relationship — a plain line; cardinality is carried in the label.
      classes: ['er-rel'],
    })),
  };
}
