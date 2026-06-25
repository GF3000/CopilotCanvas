// A version timeline with a current pointer (KAN-34). Backs Undo, Redo and the
// "history of changes" list — all three are just movements of `current` over an
// ordered list of full diagram states. Kept free of DOM/Cytoscape so it's
// unit-testable; canvas/src/main.ts stores diagram snapshots in it.
//
// `record(state)` appends the latest state (dropping any redo tail — a new change
// from an earlier version forks the timeline). `undo`/`redo` step the pointer;
// `goto(i)` jumps to any version. `replaceCurrent` updates the current entry in
// place (e.g. to remember the view you left a version at).

export interface History<T> {
  /** Append a newly-applied state as the latest version (drops any redo tail). */
  record(state: T): void;
  /** Replace the current version's stored state in place (no pointer change). */
  replaceCurrent(state: T): void;
  /** Step to the previous version; returns it, or undefined if at the first. */
  undo(): T | undefined;
  /** Step to the next version; returns it, or undefined if at the latest. */
  redo(): T | undefined;
  /** Jump to a specific version index; returns it, or undefined if invalid/current. */
  goto(index: number): T | undefined;
  /** Whether there is an earlier version to undo to. */
  canUndo(): boolean;
  /** Whether there is a later version to redo to. */
  canRedo(): boolean;
  /** All versions, oldest first (for the history list). */
  entries(): readonly T[];
  /** Index of the current version (-1 when empty). */
  index(): number;
  /** Drop all history. */
  reset(): void;
}

/**
 * Create a bounded version timeline. `limit` caps the number of versions kept;
 * once exceeded, the oldest is dropped.
 */
export function createHistory<T>(limit = 100): History<T> {
  let timeline: T[] = [];
  let current = -1;

  return {
    record(state: T): void {
      // Forking from an earlier version discards the versions after it.
      timeline = timeline.slice(0, current + 1);
      timeline.push(state);
      while (timeline.length > limit) timeline.shift();
      current = timeline.length - 1;
    },
    replaceCurrent(state: T): void {
      if (current >= 0) timeline[current] = state;
    },
    undo(): T | undefined {
      if (current <= 0) return undefined;
      current -= 1;
      return timeline[current];
    },
    redo(): T | undefined {
      if (current >= timeline.length - 1) return undefined;
      current += 1;
      return timeline[current];
    },
    goto(index: number): T | undefined {
      if (index < 0 || index >= timeline.length || index === current) {
        return undefined;
      }
      current = index;
      return timeline[current];
    },
    canUndo(): boolean {
      return current > 0;
    },
    canRedo(): boolean {
      return current < timeline.length - 1;
    },
    entries(): readonly T[] {
      return timeline;
    },
    index(): number {
      return current;
    },
    reset(): void {
      timeline = [];
      current = -1;
    },
  };
}
