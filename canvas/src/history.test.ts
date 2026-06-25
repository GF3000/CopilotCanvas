import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('createHistory (version timeline)', () => {
  it('starts empty — nothing to undo/redo, no current version', () => {
    const h = createHistory<string>();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.index()).toBe(-1);
    expect(h.entries()).toEqual([]);
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBeUndefined();
  });

  it('records versions and exposes them oldest-first with a current pointer', () => {
    const h = createHistory<string>();
    h.record('v0');
    h.record('v1');
    h.record('v2');
    expect(h.entries()).toEqual(['v0', 'v1', 'v2']);
    expect(h.index()).toBe(2);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);
  });

  it('undoes and redoes along the timeline', () => {
    const h = createHistory<string>();
    h.record('v0');
    h.record('v1');
    h.record('v2');
    expect(h.undo()).toBe('v1');
    expect(h.undo()).toBe('v0');
    expect(h.canUndo()).toBe(false);
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBe('v1');
    expect(h.redo()).toBe('v2');
    expect(h.canRedo()).toBe(false);
    expect(h.redo()).toBeUndefined();
  });

  it('jumps to any version with goto', () => {
    const h = createHistory<string>();
    h.record('v0');
    h.record('v1');
    h.record('v2');
    expect(h.goto(0)).toBe('v0');
    expect(h.index()).toBe(0);
    expect(h.canRedo()).toBe(true);
    expect(h.goto(2)).toBe('v2');
    // goto current or out of range returns undefined
    expect(h.goto(2)).toBeUndefined();
    expect(h.goto(9)).toBeUndefined();
    expect(h.goto(-1)).toBeUndefined();
  });

  it('recording after an undo forks the timeline (drops the redo tail)', () => {
    const h = createHistory<string>();
    h.record('v0');
    h.record('v1');
    h.record('v2');
    h.undo(); // back to v1
    h.undo(); // back to v0
    h.record('v1b'); // fork from v0
    expect(h.entries()).toEqual(['v0', 'v1b']);
    expect(h.index()).toBe(1);
    expect(h.canRedo()).toBe(false);
  });

  it('replaceCurrent updates the current version in place', () => {
    const h = createHistory<string>();
    h.record('v0');
    h.record('v1');
    h.replaceCurrent('v1-edited');
    expect(h.entries()).toEqual(['v0', 'v1-edited']);
    expect(h.index()).toBe(1);
  });

  it('is bounded — drops the oldest version beyond the limit', () => {
    const h = createHistory<number>(3);
    h.record(1);
    h.record(2);
    h.record(3);
    h.record(4); // evicts 1
    expect(h.entries()).toEqual([2, 3, 4]);
    expect(h.index()).toBe(2);
  });

  it('reset clears the timeline', () => {
    const h = createHistory<number>();
    h.record(1);
    h.record(2);
    h.reset();
    expect(h.entries()).toEqual([]);
    expect(h.index()).toBe(-1);
    expect(h.canUndo()).toBe(false);
  });
});
