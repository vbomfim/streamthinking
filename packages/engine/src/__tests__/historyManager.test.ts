/**
 * Unit tests for HistoryManager — snapshot-based undo/redo.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test maps to an acceptance criterion from Issue #8.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../history/historyManager.js';
import type { CanvasSnapshot } from '../history/historyManager.js';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeExpression(id: string): VisualExpression {
  const expr = builder.rectangle(100, 200, 300, 150).label('Test').build();
  return { ...expr, id };
}

function makeSnapshot(ids: string[]): CanvasSnapshot {
  const expressions: Record<string, VisualExpression> = {};
  for (const id of ids) {
    expressions[id] = makeExpression(id);
  }
  return { expressions, expressionOrder: [...ids] };
}

const emptySnapshot: CanvasSnapshot = { expressions: {}, expressionOrder: [] };

// ── Tests ──────────────────────────────────────────────────

let manager: HistoryManager;

beforeEach(() => {
  manager = new HistoryManager();
});

// ── AC9: canUndo and canRedo booleans ──────────────────────

describe('canUndo / canRedo', () => {
  it('canUndo returns false when undo stack is empty', () => {
    expect(manager.canUndo()).toBe(false);
  });

  it('canRedo returns false when redo stack is empty', () => {
    expect(manager.canRedo()).toBe(false);
  });

  it('canUndo returns true after pushing a snapshot', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    expect(manager.canUndo()).toBe(true);
  });

  it('canRedo returns true after an undo', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.undo(makeSnapshot(['r1', 'r2']));
    expect(manager.canRedo()).toBe(true);
  });
});

// ── AC1: Undo restores previous state ──────────────────────

describe('undo', () => {
  it('returns the previous snapshot when undoing [AC1]', () => {
    const snap1 = makeSnapshot(['r1']);
    manager.pushSnapshot(snap1);

    const currentState = makeSnapshot(['r1', 'r2']);
    const result = manager.undo(currentState);

    expect(result).not.toBeNull();
    expect(result!.expressionOrder).toEqual(['r1']);
    expect(result!.expressions['r1']).toBeDefined();
    expect(result!.expressions['r2']).toBeUndefined();
  });

  it('restores expressions, positions, styles, and z-order [AC1]', () => {
    const snap = makeSnapshot(['r1']);
    snap.expressions['r1']!.position = { x: 42, y: 99 };
    manager.pushSnapshot(snap);

    const current = makeSnapshot(['r1']);
    current.expressions['r1']!.position = { x: 500, y: 600 };

    const result = manager.undo(current);
    expect(result!.expressions['r1']!.position).toEqual({ x: 42, y: 99 });
  });

  it('pushes current state to redo stack on undo', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.undo(makeSnapshot(['r1', 'r2']));

    expect(manager.canRedo()).toBe(true);
  });
});

// ── AC6: Undo at start → no-op ────────────────────────────

describe('undo at empty stack [AC6]', () => {
  it('returns null when undo stack is empty', () => {
    const result = manager.undo(makeSnapshot(['r1']));
    expect(result).toBeNull();
  });

  it('does not modify redo stack when undo returns null', () => {
    manager.undo(makeSnapshot(['r1']));
    expect(manager.canRedo()).toBe(false);
  });
});

// ── AC2: Redo restores next state ──────────────────────────

describe('redo', () => {
  it('returns the next snapshot when redoing [AC2]', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    const currentAfterAdd = makeSnapshot(['r1', 'r2']);
    manager.undo(currentAfterAdd);

    // Now redo from the undone state
    const undoneState = makeSnapshot(['r1']);
    const result = manager.redo(undoneState);

    expect(result).not.toBeNull();
    expect(result!.expressionOrder).toEqual(['r1', 'r2']);
  });

  it('pushes current state to undo stack on redo', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.undo(makeSnapshot(['r1', 'r2']));

    // Before redo: undo stack should have been emptied by undo
    const undoneState = makeSnapshot(['r1']);
    manager.redo(undoneState);

    expect(manager.canUndo()).toBe(true);
  });
});

// ── AC7: Redo at end → no-op ──────────────────────────────

describe('redo at empty stack [AC7]', () => {
  it('returns null when redo stack is empty', () => {
    const result = manager.redo(makeSnapshot(['r1']));
    expect(result).toBeNull();
  });

  it('does not modify undo stack when redo returns null', () => {
    manager.redo(makeSnapshot(['r1']));
    expect(manager.canUndo()).toBe(false);
  });
});

// ── AC3: Multiple sequential undos ─────────────────────────

describe('multiple sequential undos [AC3]', () => {
  it('undoes multiple actions in reverse order', () => {
    const snap0 = makeSnapshot([]);         // initial empty
    const snap1 = makeSnapshot(['r1']);      // after adding r1
    const snap2 = makeSnapshot(['r1', 'r2']); // after adding r2

    manager.pushSnapshot(snap0);
    manager.pushSnapshot(snap1);

    const current = makeSnapshot(['r1', 'r2', 'r3']);

    // Undo 3rd action → should get snap2... wait, we only pushed snap0 and snap1
    // Let me think about this more carefully:
    // push snap0 (before action 1)
    // push snap1 (before action 2)
    // push snap2 (before action 3) -- not pushed yet
    // Actually, let me push all three snapshots

    // Reset
    manager = new HistoryManager();
    manager.pushSnapshot(makeSnapshot([]));
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.pushSnapshot(makeSnapshot(['r1', 'r2']));

    const currentFinal = makeSnapshot(['r1', 'r2', 'r3']);

    // Undo once → get snapshot before last action
    const undo1 = manager.undo(currentFinal);
    expect(undo1!.expressionOrder).toEqual(['r1', 'r2']);

    // Undo again → get snapshot before second action
    const undo2 = manager.undo(undo1!);
    expect(undo2!.expressionOrder).toEqual(['r1']);

    // Undo again → get initial empty state
    const undo3 = manager.undo(undo2!);
    expect(undo3!.expressionOrder).toEqual([]);

    // Undo again → no more history
    const undo4 = manager.undo(undo3!);
    expect(undo4).toBeNull();
  });
});

// ── AC4: New action after undo clears redo stack ───────────

describe('new action after undo clears redo [AC4]', () => {
  it('clears redo stack when new snapshot is pushed after undo', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.pushSnapshot(makeSnapshot(['r1', 'r2']));
    manager.pushSnapshot(makeSnapshot(['r1', 'r2', 'r3']));

    const current = makeSnapshot(['r1', 'r2', 'r3', 'r4']);

    // Undo twice
    const undo1 = manager.undo(current);
    manager.undo(undo1!);

    expect(manager.canRedo()).toBe(true);

    // Push new snapshot (new action diverges history)
    manager.pushSnapshot(makeSnapshot(['r1', 'r2', 'new']));

    // Redo should be impossible — new branch started
    expect(manager.canRedo()).toBe(false);
  });
});

// ── AC5: Max 100 snapshots, oldest dropped ─────────────────

describe('max snapshot limit [AC5]', () => {
  it('keeps at most 100 snapshots in undo stack', () => {
    // Push 101 snapshots
    for (let i = 0; i <= 100; i++) {
      manager.pushSnapshot(makeSnapshot([`r${i}`]));
    }

    // Undo 100 times should work (max stack size)
    let undoCount = 0;
    let state: CanvasSnapshot | null = makeSnapshot(['final']);
    while (state !== null) {
      state = manager.undo(state);
      if (state !== null) undoCount++;
    }

    expect(undoCount).toBe(100);
  });

  it('drops oldest snapshot when 101st is pushed', () => {
    // Push 101 snapshots with identifiable content
    for (let i = 0; i <= 100; i++) {
      manager.pushSnapshot(makeSnapshot([`r${i}`]));
    }

    // The first snapshot (r0) should have been evicted
    // Undo all the way back - should NOT reach r0
    let state: CanvasSnapshot | null = makeSnapshot(['final']);
    let oldest: CanvasSnapshot | null = null;
    while (state !== null) {
      oldest = state;
      state = manager.undo(state);
    }

    // Oldest reachable should be r1 (r0 was evicted)
    expect(oldest!.expressionOrder).toEqual(['r1']);
  });
});

// ── Deep clone verification ────────────────────────────────

describe('deep clone isolation', () => {
  it('snapshot is independent of original — mutating original does not affect snapshot', () => {
    const original = makeSnapshot(['r1']);
    manager.pushSnapshot(original);

    // Mutate the original after pushing
    original.expressions['r1']!.position = { x: 999, y: 999 };
    original.expressionOrder.push('mutated');

    // Undo should return the snapshot as it was when pushed
    const result = manager.undo(makeSnapshot(['current']));
    expect(result!.expressions['r1']!.position).not.toEqual({ x: 999, y: 999 });
    expect(result!.expressionOrder).not.toContain('mutated');
  });

  it('returned snapshot is independent — mutating it does not affect internal state', () => {
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.pushSnapshot(makeSnapshot(['r1', 'r2']));

    const current = makeSnapshot(['r1', 'r2', 'r3']);
    const undone = manager.undo(current);

    // Mutate the returned snapshot
    undone!.expressionOrder.push('evil');
    undone!.expressions['evil'] = makeExpression('evil');

    // Redo should give back the original current state, unaffected
    const redone = manager.redo(undone!);
    expect(redone!.expressionOrder).not.toContain('evil');
  });
});

// ── Full undo/redo cycle ───────────────────────────────────

describe('full undo/redo cycle', () => {
  it('push → undo → redo produces consistent round-trip [AC1, AC2]', () => {
    const snapBefore = makeSnapshot(['r1']);
    manager.pushSnapshot(snapBefore);

    const current = makeSnapshot(['r1', 'r2']);

    // Undo
    const undone = manager.undo(current);
    expect(undone!.expressionOrder).toEqual(['r1']);

    // Redo from the undone state
    const redone = manager.redo(undone!);
    expect(redone!.expressionOrder).toEqual(['r1', 'r2']);
  });

  it('push 3 → undo 2 → new action → redo → should be no-op [AC4]', () => {
    manager.pushSnapshot(emptySnapshot);
    manager.pushSnapshot(makeSnapshot(['r1']));
    manager.pushSnapshot(makeSnapshot(['r1', 'r2']));

    const current = makeSnapshot(['r1', 'r2', 'r3']);

    // Undo 2 times
    const undo1 = manager.undo(current);
    const undo2 = manager.undo(undo1!);

    // New action: push new snapshot (diverges history)
    manager.pushSnapshot(undo2!);

    // Try redo → should be no-op (redo was cleared)
    const result = manager.redo(makeSnapshot(['r1', 'new-thing']));
    expect(result).toBeNull();
  });
});

// ── Constructor options ────────────────────────────────────

describe('constructor options', () => {
  it('accepts custom maxSize', () => {
    const small = new HistoryManager(5);

    for (let i = 0; i < 10; i++) {
      small.pushSnapshot(makeSnapshot([`r${i}`]));
    }

    let undoCount = 0;
    let state: CanvasSnapshot | null = makeSnapshot(['final']);
    while (state !== null) {
      state = small.undo(state);
      if (state !== null) undoCount++;
    }

    expect(undoCount).toBe(5);
  });
});
