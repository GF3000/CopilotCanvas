// A small, generic, bounded undo/redo history (KAN-34). Kept free of DOM/Cytoscape
// so it's unit-testable; canvas/src/main.ts stores diagram snapshots in it.
//
// Model: an undo stack and a redo stack of full states.
// - `push(state)` records the current state (BEFORE a change) as an undo step and
//   clears the redo stack — a brand-new change invalidates any redo history.
// - `undo(current)` returns the previous state to restore and saves `current` for
//   redo. `redo(current)` is the mirror. Passing the live `current` state lets the
//   manager move it onto the opposite stack so you can walk both directions.

export interface History<T> {
  /** Record the current state (before a change) and clear the redo stack. */
  push(state: T): void;
  /** Step back: returns the previous state; `current` is kept for redo. */
  undo(current: T): T | undefined;
  /** Step forward again: returns the next state; `current` is kept for undo. */
  redo(current: T): T | undefined;
  /** Whether there is a step to undo (false at the first/base version). */
  canUndo(): boolean;
  /** Whether there is an undone step to redo. */
  canRedo(): boolean;
  /** Drop all history (both directions). */
  reset(): void;
  /** Number of undoable steps currently held. */
  size(): number;
}

/**
 * Create a bounded history. `limit` caps the undo stack: once exceeded, the oldest
 * step is dropped (so very long sessions keep the most recent `limit` steps).
 */
export function createHistory<T>(limit = 100): History<T> {
  const undoStack: T[] = [];
  const redoStack: T[] = [];
  return {
    push(state: T): void {
      undoStack.push(state);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    },
    undo(current: T): T | undefined {
      const prev = undoStack.pop();
      if (prev === undefined) return undefined;
      redoStack.push(current);
      return prev;
    },
    redo(current: T): T | undefined {
      const next = redoStack.pop();
      if (next === undefined) return undefined;
      undoStack.push(current);
      return next;
    },
    canUndo(): boolean {
      return undoStack.length > 0;
    },
    canRedo(): boolean {
      return redoStack.length > 0;
    },
    reset(): void {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    size(): number {
      return undoStack.length;
    },
  };
}
