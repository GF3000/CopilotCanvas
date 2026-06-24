import { describe, it, expect } from 'vitest';
import type { CyElement } from '@canvas/shared';
import { buildDiagram } from './diagram';
import {
  buildDependencyDiagram,
  buildFlowchartDiagram,
  buildStateMachineDiagram,
  buildClassDiagram,
  buildErDiagram,
  classLabel,
  erEdgeLabel,
} from './diagramTypes';

/** Render a typed input through the shared buildDiagram path and inspect elements. */
function render(input: Parameters<typeof buildDiagram>[0]) {
  const { diagram, skippedEdges } = buildDiagram(input);
  const nodes = diagram.elements.filter((e) => e.data.source === undefined);
  const edges = diagram.elements.filter((e) => e.data.source !== undefined);
  const node = (id: string): CyElement | undefined =>
    nodes.find((n) => n.data.id === id);
  return { diagram, skippedEdges, nodes, edges, node };
}

describe('buildDependencyDiagram (KAN-20)', () => {
  it('defaults node kind to module and maps "depends on" edges by direction', () => {
    const { nodes, edges, node } = render(
      buildDependencyDiagram({
        title: 'Deps',
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B', kind: 'service' },
        ],
        dependencies: [{ from: 'a', to: 'b' }],
      }),
    );
    expect(nodes).toHaveLength(2);
    expect(node('a')?.data.kind).toBe('module');
    expect(node('b')?.data.kind).toBe('service');
    expect(edges).toHaveLength(1);
    expect(edges[0].data.source).toBe('a');
    expect(edges[0].data.target).toBe('b');
  });

  it('renders cycles without error', () => {
    const { edges, skippedEdges } = render(
      buildDependencyDiagram({
        title: 'Cycle',
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        dependencies: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      }),
    );
    expect(edges).toHaveLength(2);
    expect(skippedEdges).toBe(0);
  });

  it('honours scope: service scope defaults node kind to service, else module', () => {
    const svc = render(
      buildDependencyDiagram({
        title: 'Services',
        scope: 'service',
        nodes: [{ id: 'a', label: 'A' }],
        dependencies: [],
      }),
    );
    expect(svc.node('a')?.data.kind).toBe('service');

    const pkg = render(
      buildDependencyDiagram({
        title: 'Packages',
        scope: 'package',
        nodes: [{ id: 'a', label: 'A' }],
        dependencies: [],
      }),
    );
    expect(pkg.node('a')?.data.kind).toBe('module');
    // per-node kind still wins over the scope default
    const explicit = render(
      buildDependencyDiagram({
        title: 'Mixed',
        scope: 'service',
        nodes: [{ id: 'a', label: 'A', kind: 'external' }],
        dependencies: [],
      }),
    );
    expect(explicit.node('a')?.data.kind).toBe('external');
  });
});

describe('buildFlowchartDiagram (KAN-21)', () => {
  it('maps node types to shape classes and keeps decision branch labels', () => {
    const { node, edges } = render(
      buildFlowchartDiagram({
        title: 'Flow',
        nodes: [
          { id: 's', label: 'Start', type: 'start' },
          { id: 'd', label: 'OK?', type: 'decision' },
          { id: 'ok', label: 'Done', type: 'end' },
          { id: 'io', label: 'Read input', type: 'io' },
          { id: 'step', label: 'Work' },
        ],
        edges: [
          { from: 's', to: 'd' },
          { from: 'd', to: 'ok', label: 'yes' },
          { from: 'd', to: 'step', label: 'no' },
        ],
      }),
    );
    // start: entry-point colour + terminator (pill) shape
    expect(node('s')?.data.kind).toBe('entrypoint');
    expect(node('s')?.classes).toContain('fc-terminator');
    // decision: diamond
    expect(node('d')?.classes).toContain('decision');
    // end: terminator pill, NOT the `success` status class (keeps the legend clean)
    expect(node('ok')?.classes).toContain('fc-terminator');
    expect(node('ok')?.classes).toContain('fc-end');
    expect(node('ok')?.classes ?? '').not.toContain('success');
    // io: parallelogram
    expect(node('io')?.classes).toContain('fc-io');
    // step (default): process rectangle
    expect(node('step')?.data.kind).toBe('service');
    expect(node('step')?.classes).toContain('fc-process');
    const yes = edges.find((e) => e.data.target === 'ok');
    expect(yes?.data.label).toBe('yes');
  });
});

describe('buildStateMachineDiagram (KAN-22)', () => {
  it('marks initial/final states and labels transitions (open arrowhead) with events', () => {
    const { node, edges } = render(
      buildStateMachineDiagram({
        title: 'Lifecycle',
        states: [
          { id: 'new', label: 'New', initial: true },
          { id: 'done', label: 'Done', final: true },
        ],
        transitions: [{ from: 'new', to: 'done', event: 'complete' }],
      }),
    );
    expect(node('new')?.classes).toContain('initial');
    expect(node('done')?.classes).toContain('final');
    expect(edges[0].data.label).toBe('complete');
    expect(edges[0].classes).toContain('sm-transition');
  });
});

describe('buildClassDiagram (KAN-23)', () => {
  it('folds attributes/methods into the label, boxes classes, and carries relation type as edge class', () => {
    const { node, edges } = render(
      buildClassDiagram({
        title: 'Model',
        classes: [
          { id: 'animal', label: 'Animal', methods: ['+ speak()'] },
          { id: 'dog', label: 'Dog', attributes: ['+ breed: string'] },
        ],
        relations: [{ from: 'dog', to: 'animal', type: 'inheritance' }],
      }),
    );
    expect(node('animal')?.data.label).toContain('Animal');
    expect(node('animal')?.data.label).toContain('+ speak()');
    expect(node('animal')?.classes).toContain('uml-class');
    expect(node('dog')?.data.label).toContain('+ breed: string');
    expect(edges[0].classes).toBe('inheritance');
  });

  it('defaults a relation without a type to association', () => {
    const { edges } = render(
      buildClassDiagram({
        title: 'Model',
        classes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        relations: [{ from: 'a', to: 'b' }],
      }),
    );
    expect(edges[0].classes).toBe('association');
  });

  it('supports realization and dependency relation types', () => {
    const { edges } = render(
      buildClassDiagram({
        title: 'Model',
        classes: [
          { id: 'svc', label: 'Service' },
          { id: 'iface', label: 'IService' },
          { id: 'log', label: 'Logger' },
        ],
        relations: [
          { from: 'svc', to: 'iface', type: 'realization' },
          { from: 'svc', to: 'log', type: 'dependency' },
        ],
      }),
    );
    expect(edges.find((e) => e.data.target === 'iface')?.classes).toBe('realization');
    expect(edges.find((e) => e.data.target === 'log')?.classes).toBe('dependency');
  });

  it('classLabel omits empty compartments', () => {
    expect(classLabel('Foo')).toBe('Foo');
    expect(classLabel('Foo', ['+ x'])).toContain('+ x');
  });
});

describe('buildErDiagram (KAN-24)', () => {
  it('uses datastore kind, boxes entities, and labels relationships with cardinality', () => {
    const { node, edges } = render(
      buildErDiagram({
        title: 'Sales',
        entities: [
          { id: 'cust', label: 'Customer', attributes: ['id (PK)'] },
          { id: 'order', label: 'Order' },
        ],
        relationships: [
          { from: 'cust', to: 'order', label: 'places', cardinality: '1:N' },
        ],
      }),
    );
    expect(node('cust')?.data.kind).toBe('datastore');
    expect(node('cust')?.classes).toContain('er-entity');
    expect(node('cust')?.data.label).toContain('id (PK)');
    expect(edges[0].data.label).toBe('places (1:N)');
    expect(edges[0].classes).toContain('er-rel');
  });

  it('erEdgeLabel combines, falls back, or omits', () => {
    expect(erEdgeLabel('places', '1:N')).toBe('places (1:N)');
    expect(erEdgeLabel(undefined, 'N')).toBe('N');
    expect(erEdgeLabel('owns', undefined)).toBe('owns');
    expect(erEdgeLabel(undefined, undefined)).toBeUndefined();
  });
});

describe('typed diagrams share buildDiagram edge validation', () => {
  it('drops edges referencing unknown nodes (reported via skippedEdges)', () => {
    const { skippedEdges, edges } = render(
      buildDependencyDiagram({
        title: 'Deps',
        nodes: [{ id: 'a', label: 'A' }],
        dependencies: [{ from: 'a', to: 'ghost' }],
      }),
    );
    expect(skippedEdges).toBe(1);
    expect(edges).toHaveLength(0);
  });
});
