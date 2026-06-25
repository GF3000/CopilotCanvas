import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('createHistory', () => {
  it('starts empty — nothing to undo or redo at the base version', () => {
    const h = createHistory<string>();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.undo('cur')).toBeUndefined();
    expect(h.redo('cur')).toBeUndefined();
    expect(h.size()).toBe(0);
  });

  it('undoes in LIFO order back to the base', () => {
    const h = createHistory<string>();
    h.push('s0'); // state before the move to s1
    h.push('s1'); // state before the move to s2 (current = s2)
    expect(h.size()).toBe(2);
    expect(h.canUndo()).toBe(true);
    expect(h.undo('s2')).toBe('s1');
    expect(h.undo('s1')).toBe('s0');
    expect(h.canUndo()).toBe(false); // back at the first version
    expect(h.undo('s0')).toBeUndefined();
  });

  it('redoes the steps that were undone', () => {
    const h = createHistory<string>();
    h.push('s0');
    h.push('s1'); // current = s2
    expect(h.undo('s2')).toBe('s1'); // redo now holds [s2]
    expect(h.canRedo()).toBe(true);
    expect(h.undo('s1')).toBe('s0'); // redo now holds [s2, s1]
    expect(h.redo('s0')).toBe('s1'); // forward to s1
    expect(h.redo('s1')).toBe('s2'); // forward to s2
    expect(h.canRedo()).toBe(false);
    expect(h.redo('s2')).toBeUndefined();
  });

  it('a new change after an undo clears the redo stack', () => {
    const h = createHistory<string>();
    h.push('s0'); // current = s1
    h.undo('s1'); // -> s0, redo = [s1]
    expect(h.canRedo()).toBe(true);
    h.push('s0b'); // a new change from s0 invalidates redo
    expect(h.canRedo()).toBe(false);
  });

  it('reset clears both directions', () => {
    const h = createHistory<number>();
    h.push(1);
    h.undo(2);
    h.reset();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.size()).toBe(0);
  });

  it('is bounded — drops the oldest step beyond the limit', () => {
    const h = createHistory<number>(3);
    h.push(1);
    h.push(2);
    h.push(3);
    h.push(4); // evicts 1
    expect(h.size()).toBe(3);
    expect(h.undo(99)).toBe(4);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.canUndo()).toBe(false); // 1 was dropped
  });
});
