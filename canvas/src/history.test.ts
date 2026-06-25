import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('createHistory', () => {
  it('starts empty — nothing to undo at the base version', () => {
    const h = createHistory<string>();
    expect(h.canUndo()).toBe(false);
    expect(h.undo()).toBeUndefined();
    expect(h.size()).toBe(0);
  });

  it('pushes and undoes in LIFO order back to the base', () => {
    const h = createHistory<string>();
    h.push('v0');
    h.push('v1');
    h.push('v2');
    expect(h.size()).toBe(3);
    expect(h.canUndo()).toBe(true);
    expect(h.undo()).toBe('v2');
    expect(h.undo()).toBe('v1');
    expect(h.undo()).toBe('v0');
    expect(h.canUndo()).toBe(false); // back at the first version
    expect(h.undo()).toBeUndefined();
  });

  it('reset clears all steps', () => {
    const h = createHistory<number>();
    h.push(1);
    h.push(2);
    h.reset();
    expect(h.canUndo()).toBe(false);
    expect(h.size()).toBe(0);
  });

  it('is bounded — drops the oldest step beyond the limit', () => {
    const h = createHistory<number>(3);
    h.push(1);
    h.push(2);
    h.push(3);
    h.push(4); // evicts 1
    expect(h.size()).toBe(3);
    expect(h.undo()).toBe(4);
    expect(h.undo()).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.canUndo()).toBe(false); // 1 was dropped
  });
});
