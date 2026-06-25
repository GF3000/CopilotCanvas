// A small, generic, bounded undo history (KAN-34). Kept free of DOM/Cytoscape so
// it's unit-testable; canvas/src/main.ts stores diagram snapshots in it.
//
// Semantics: `push(state)` records a state you can return TO (i.e. the state right
// BEFORE a change). `undo()` pops and returns the most recent such state. `canUndo`
// is false at the base version, so the UI can disable Undo there.

export interface History<T> {
  /** Record the current state (before a change) as an undoable step. */
  push(state: T): void;
  /** Pop and return the previous state, or undefined if at the base version. */
  undo(): T | undefined;
  /** Whether there is a step to undo (false at the first/base version). */
  canUndo(): boolean;
  /** Drop all history (e.g. when a brand-new base diagram is rendered). */
  reset(): void;
  /** Number of undoable steps currently held. */
  size(): number;
}

/**
 * Create a bounded history stack. `limit` caps memory: once exceeded, the oldest
 * step is dropped (so very long sessions keep the most recent `limit` steps).
 */
export function createHistory<T>(limit = 100): History<T> {
  const stack: T[] = [];
  return {
    push(state: T): void {
      stack.push(state);
      if (stack.length > limit) stack.shift();
    },
    undo(): T | undefined {
      return stack.pop();
    },
    canUndo(): boolean {
      return stack.length > 0;
    },
    reset(): void {
      stack.length = 0;
    },
    size(): number {
      return stack.length;
    },
  };
}
