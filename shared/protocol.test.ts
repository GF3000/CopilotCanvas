import { describe, it, expect } from 'vitest';
import {
  PROTOCOL_VERSION,
  isDiagramMessage,
  isNodeSelectedMessage,
  type CanvasMessage,
} from './protocol';

describe('protocol', () => {
  it('pins the protocol version to 1', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('discriminates messages via type guards', () => {
    const diagram: CanvasMessage = {
      type: 'diagram',
      sessionId: 's1',
      diagramId: 'd1',
      title: 'Auth flow',
      elements: [
        { data: { id: 'A', label: 'Login', kind: 'entrypoint' } },
        { data: { id: 'B', label: 'Auth service', kind: 'service' } },
        { data: { source: 'A', target: 'B' } },
      ],
      version: 1,
    };
    const selected: CanvasMessage = {
      type: 'node_selected',
      sessionId: 's1',
      diagramId: 'd1',
      nodeIds: ['B'],
    };

    expect(isDiagramMessage(diagram)).toBe(true);
    expect(isDiagramMessage(selected)).toBe(false);
    expect(isNodeSelectedMessage(selected)).toBe(true);
  });
});
