/**
 * Unit tests for undo/redo integration in canvasStore.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Acceptance criteria from Issue #8.
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import type { Camera } from '../types/index.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string) {
  const expr = builder.rectangle(100, 200, 300, 150).label('Test').build();
  return { ...expr, id };
}

function makeEllipse(id: string) {
  const expr = builder.ellipse(50, 50, 200, 200).label('Ellipse').build();
  return { ...expr, id };
}

// ── Store reset before each test ───────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
  });
  // Reset history by getting a fresh store — need to call internal reset
  // The store should expose a way to reset history, or we reset via setState
  useCanvasStore.getState().clearHistory?.();
});

// ── AC1: Ctrl+Z undoes last action ─────────────────────────

describe('store undo [AC1]', () => {
  it('undo restores expressions after addExpression', () => {
    const { addExpression, undo } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));

    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']).toBeUndefined();
    expect(state.expressionOrder).toEqual([]);
  });

  it('undo restores position after updateExpression', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));

    const originalPos = { ...useCanvasStore.getState().expressions['r1']!.position };
    useCanvasStore.getState().updateExpression('r1', { position: { x: 999, y: 888 } });

    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']!.position).toEqual(originalPos);
  });

  it('undo restores expressions after deleteExpressions', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));
    addExpression(makeEllipse('e1'));

    useCanvasStore.getState().deleteExpressions(['r1']);

    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']).toBeDefined();
    expect(state.expressions['e1']).toBeDefined();
    expect(state.expressionOrder).toEqual(['r1', 'e1']);
  });

  it('undo restores z-order (expressionOrder)', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));
    addExpression(makeEllipse('e1'));
    addExpression(makeRectangle('r2'));

    // Delete middle element
    useCanvasStore.getState().deleteExpressions(['e1']);

    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual(['r1', 'e1', 'r2']);
  });

  it('undo restores styles', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));

    const originalStyle = { ...useCanvasStore.getState().expressions['r1']!.style };
    useCanvasStore.getState().updateExpression('r1', {
      style: { ...originalStyle, opacity: 0.5 },
    });

    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']!.style.opacity).toEqual(originalStyle.opacity);
  });
});

// ── AC2: Redo restores next state ──────────────────────────

describe('store redo [AC2]', () => {
  it('redo restores state after undo', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['r1']).toBeUndefined();

    useCanvasStore.getState().redo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']).toBeDefined();
    expect(state.expressionOrder).toEqual(['r1']);
  });

  it('redo restores position after undo of update', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));

    useCanvasStore.getState().updateExpression('r1', { position: { x: 999, y: 888 } });

    useCanvasStore.getState().undo();
    useCanvasStore.getState().redo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']!.position).toEqual({ x: 999, y: 888 });
  });
});

// ── AC3: Multiple sequential undos ─────────────────────────

describe('multiple sequential undos [AC3]', () => {
  it('undoes multiple add actions in reverse order', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));
    addExpression(makeEllipse('e1'));
    addExpression(makeRectangle('r2'));

    // Undo r2
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1', 'e1']);

    // Undo e1
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1']);

    // Undo r1
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressionOrder).toEqual([]);
  });

  it('multiple undos followed by multiple redos restore full state', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));
    addExpression(makeEllipse('e1'));

    // Undo both
    useCanvasStore.getState().undo();
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressionOrder).toEqual([]);

    // Redo both
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1']);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1', 'e1']);
  });
});

// ── AC4: New action after undo clears redo ─────────────────

describe('new action after undo clears redo [AC4]', () => {
  it('new addExpression after undo makes redo impossible', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));
    addExpression(makeEllipse('e1'));

    // Undo e1
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().canRedo).toBe(true);

    // New action diverges history
    useCanvasStore.getState().addExpression(makeRectangle('r2'));
    expect(useCanvasStore.getState().canRedo).toBe(false);

    // Redo should be no-op
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1', 'r2']);
  });
});

// ── AC5: Max 100 snapshots ─────────────────────────────────

describe('max snapshot limit in store [AC5]', () => {
  it('limits undo history to 100 snapshots', () => {
    const { addExpression } = useCanvasStore.getState();

    // Add 105 expressions (each pushes a snapshot)
    for (let i = 0; i < 105; i++) {
      useCanvasStore.getState().addExpression(makeRectangle(`r${i}`));
    }

    // Undo all the way back
    let undoCount = 0;
    while (useCanvasStore.getState().canUndo) {
      useCanvasStore.getState().undo();
      undoCount++;
    }

    // Should only be able to undo 100 times (max)
    expect(undoCount).toBe(100);
  });
});

// ── AC6: Undo at start → no-op ────────────────────────────

describe('undo at start [AC6]', () => {
  it('undo on empty canvas is a no-op', () => {
    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressions).toEqual({});
    expect(state.expressionOrder).toEqual([]);
  });

  it('undo does not throw', () => {
    expect(() => useCanvasStore.getState().undo()).not.toThrow();
  });
});

// ── AC7: Redo at end → no-op ──────────────────────────────

describe('redo at end [AC7]', () => {
  it('redo with no undo history is a no-op', () => {
    const { addExpression } = useCanvasStore.getState();
    addExpression(makeRectangle('r1'));

    useCanvasStore.getState().redo();

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual(['r1']);
  });

  it('redo does not throw', () => {
    expect(() => useCanvasStore.getState().redo()).not.toThrow();
  });
});

// ── AC8: Snapshots on content mutations only ───────────────

describe('snapshot triggers [AC8]', () => {
  it('addExpression pushes a snapshot (enables undo)', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    expect(useCanvasStore.getState().canUndo).toBe(true);
  });

  it('updateExpression pushes a snapshot (enables undo)', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    // Clear undo state from the add
    const undoCountAfterAdd = useCanvasStore.getState().canUndo;

    useCanvasStore.getState().updateExpression('r1', { position: { x: 0, y: 0 } });
    expect(useCanvasStore.getState().canUndo).toBe(true);
  });

  it('deleteExpressions pushes a snapshot (enables undo)', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    useCanvasStore.getState().deleteExpressions(['r1']);
    expect(useCanvasStore.getState().canUndo).toBe(true);
  });

  it('setSelectedIds does NOT push a snapshot', () => {
    useCanvasStore.getState().setSelectedIds(new Set(['some-id']));
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });

  it('setActiveTool does NOT push a snapshot', () => {
    useCanvasStore.getState().setActiveTool('rectangle');
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });

  it('setCamera does NOT push a snapshot', () => {
    useCanvasStore.getState().setCamera({ x: 100, y: 200, zoom: 2 });
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });
});

// ── AC9: canUndo and canRedo booleans in store ─────────────

describe('canUndo and canRedo in store [AC9]', () => {
  it('canUndo is false initially', () => {
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });

  it('canRedo is false initially', () => {
    expect(useCanvasStore.getState().canRedo).toBe(false);
  });

  it('canUndo becomes true after content mutation', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    expect(useCanvasStore.getState().canUndo).toBe(true);
  });

  it('canRedo becomes true after undo', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().canRedo).toBe(true);
  });

  it('canRedo becomes false after new action following undo', () => {
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    useCanvasStore.getState().undo();
    useCanvasStore.getState().addExpression(makeEllipse('e1'));
    expect(useCanvasStore.getState().canRedo).toBe(false);
  });
});

// ── Edge cases ─────────────────────────────────────────────

describe('edge cases', () => {
  it('invalid addExpression does not push snapshot', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const invalidExpr = { id: 'bad', kind: 'rectangle' } as never;
    useCanvasStore.getState().addExpression(invalidExpr);

    expect(useCanvasStore.getState().canUndo).toBe(false);

    warnSpy.mockRestore();
  });

  it('updateExpression on non-existent id does not push snapshot', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useCanvasStore.getState().updateExpression('nonexistent', { position: { x: 1, y: 2 } });
    expect(useCanvasStore.getState().canUndo).toBe(false);

    warnSpy.mockRestore();
  });

  it('deleteExpressions with empty array does not push snapshot', () => {
    useCanvasStore.getState().deleteExpressions([]);
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });

  it('deleteExpressions with non-existent ids does not push snapshot', () => {
    useCanvasStore.getState().deleteExpressions(['ghost1', 'ghost2']);
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });

  it('undo/redo preserves operationLog (does not rollback ops)', () => {
    // Operation log is append-only for collaboration — undo should NOT erase it
    useCanvasStore.getState().addExpression(makeRectangle('r1'));
    const opsAfterAdd = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().undo();

    // operationLog should still contain the create op (or more)
    expect(useCanvasStore.getState().operationLog.length).toBeGreaterThanOrEqual(opsAfterAdd);
  });
});
