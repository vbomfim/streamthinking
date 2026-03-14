/**
 * Integration & contract tests for canvasStore.
 *
 * Tests CRUD workflow sequences, operation payload structure contracts,
 * and edge cases not covered by the Developer's unit tests.
 * These tests validate behavior through the store's public interface,
 * not internal implementation details.
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { ProtocolOperation } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import type { CanvasState, CanvasActions, ToolType, Camera } from '../types/index.js';

// ── Fixtures ─────────────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Tester' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string) {
  const expr = builder
    .rectangle(100, 200, 300, 150)
    .label('Rect')
    .build();
  return { ...expr, id };
}

function makeEllipse(id: string) {
  const expr = builder
    .ellipse(50, 50, 200, 200)
    .label('Ellipse')
    .build();
  return { ...expr, id };
}

function makeText(id: string) {
  const expr = builder
    .text('Integration test text', 10, 10)
    .build();
  return { ...expr, id };
}

// ── Store reset ──────────────────────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
  });
});

// ── AC4: Store state shape contract ──────────────────────────

describe('Store state shape [CONTRACT][AC4]', () => {
  it('[CONTRACT] initial state has all required fields with correct types', () => {
    const state = useCanvasStore.getState();

    // Structural validation — every field from AC4 must exist
    expect(state).toHaveProperty('expressions');
    expect(state).toHaveProperty('expressionOrder');
    expect(state).toHaveProperty('selectedIds');
    expect(state).toHaveProperty('activeTool');
    expect(state).toHaveProperty('camera');
    expect(state).toHaveProperty('operationLog');

    // Type validation
    expect(typeof state.expressions).toBe('object');
    expect(Array.isArray(state.expressionOrder)).toBe(true);
    expect(state.selectedIds).toBeInstanceOf(Set);
    expect(typeof state.activeTool).toBe('string');
    expect(typeof state.camera.x).toBe('number');
    expect(typeof state.camera.y).toBe('number');
    expect(typeof state.camera.zoom).toBe('number');
    expect(Array.isArray(state.operationLog)).toBe(true);
  });

  it('[CONTRACT] store exposes all required action methods', () => {
    const state = useCanvasStore.getState();

    // Actions from CanvasActions interface
    expect(typeof state.addExpression).toBe('function');
    expect(typeof state.updateExpression).toBe('function');
    expect(typeof state.deleteExpressions).toBe('function');
    expect(typeof state.setSelectedIds).toBe('function');
    expect(typeof state.setActiveTool).toBe('function');
    expect(typeof state.setCamera).toBe('function');
  });
});

// ── AC5: Create operation payload contract ───────────────────

describe('Create operation payload [CONTRACT][AC5]', () => {
  it('[CONTRACT] create operation contains required protocol fields', () => {
    const expr = makeRectangle('rect-contract');
    useCanvasStore.getState().addExpression(expr);

    const op = useCanvasStore.getState().operationLog[0]!;

    // ProtocolOperation structure
    expect(op.id).toBeTruthy();
    expect(typeof op.id).toBe('string');
    expect(op.type).toBe('create');
    expect(op.author).toBeDefined();
    expect(op.author.type).toBe('agent');
    expect(op.author.id).toBe('canvas-engine');
    expect(typeof op.timestamp).toBe('number');
    expect(op.timestamp).toBeGreaterThan(0);

    // CreatePayload structure
    expect(op.payload).toMatchObject({
      type: 'create',
      expressionId: 'rect-contract',
      kind: 'rectangle',
    });
    expect((op.payload as { position: unknown }).position).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
    expect((op.payload as { size: unknown }).size).toEqual(
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
    );
    expect((op.payload as { data: unknown }).data).toBeDefined();
  });
});

// ── AC6: Update operation payload contract ───────────────────

describe('Update operation payload [CONTRACT][AC6]', () => {
  it('[CONTRACT] update operation contains expressionId and data', () => {
    const expr = makeRectangle('rect-update');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-update', {
      position: { x: 999, y: 888 },
    });

    const updateOp = useCanvasStore.getState().operationLog[1]!;

    expect(updateOp.type).toBe('update');
    expect(updateOp.payload).toMatchObject({
      type: 'update',
      expressionId: 'rect-update',
    });
    expect((updateOp.payload as { changes: unknown }).changes).toBeDefined();
    expect((updateOp.payload as { changes: { position: unknown } }).changes.position).toEqual({ x: 999, y: 888 });
    expect(updateOp.author).toBeDefined();
    expect(typeof updateOp.timestamp).toBe('number');
  });
});

// ── AC7: Delete operation payload contract ───────────────────

describe('Delete operation payload [CONTRACT][AC7]', () => {
  it('[CONTRACT] delete operation contains expressionIds array', () => {
    const expr1 = makeRectangle('del-1');
    const expr2 = makeEllipse('del-2');
    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().deleteExpressions(['del-1', 'del-2']);

    const ops = useCanvasStore.getState().operationLog;
    const deleteOp = ops[ops.length - 1]!;

    expect(deleteOp.type).toBe('delete');
    expect(deleteOp.payload).toMatchObject({
      type: 'delete',
      expressionIds: ['del-1', 'del-2'],
    });
  });
});

// ── CRUD workflow integration ────────────────────────────────

describe('CRUD workflow integration [BOUNDARY]', () => {
  it('[BOUNDARY] full lifecycle: add → update → delete produces correct operation sequence', () => {
    const expr = makeRectangle('lifecycle-1');

    // Create
    useCanvasStore.getState().addExpression(expr);
    expect(useCanvasStore.getState().expressions['lifecycle-1']).toBeDefined();
    expect(useCanvasStore.getState().expressionOrder).toContain('lifecycle-1');

    // Update
    useCanvasStore.getState().updateExpression('lifecycle-1', {
      position: { x: 500, y: 500 },
    });
    expect(useCanvasStore.getState().expressions['lifecycle-1']?.position).toEqual({
      x: 500,
      y: 500,
    });

    // Delete
    useCanvasStore.getState().deleteExpressions(['lifecycle-1']);
    expect(useCanvasStore.getState().expressions['lifecycle-1']).toBeUndefined();
    expect(useCanvasStore.getState().expressionOrder).not.toContain('lifecycle-1');

    // Operation log preserves full history
    const ops = useCanvasStore.getState().operationLog;
    expect(ops).toHaveLength(3);
    expect(ops[0]!.type).toBe('create');
    expect(ops[1]!.type).toBe('update');
    expect(ops[2]!.type).toBe('delete');

    // Operations are in chronological order
    expect(ops[0]!.timestamp).toBeLessThanOrEqual(ops[1]!.timestamp);
    expect(ops[1]!.timestamp).toBeLessThanOrEqual(ops[2]!.timestamp);
  });

  it('[BOUNDARY] multiple expressions CRUD interleaved correctly', () => {
    const rect = makeRectangle('r1');
    const ellipse = makeEllipse('e1');
    const text = makeText('t1');

    // Add three expressions
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().addExpression(ellipse);
    useCanvasStore.getState().addExpression(text);

    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(3);
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1', 'e1', 't1']);

    // Update one, delete another
    useCanvasStore.getState().updateExpression('e1', {
      position: { x: 100, y: 100 },
    });
    useCanvasStore.getState().deleteExpressions(['r1']);

    // Final state
    const finalState = useCanvasStore.getState();
    expect(Object.keys(finalState.expressions)).toHaveLength(2);
    expect(finalState.expressionOrder).toEqual(['e1', 't1']);
    expect(finalState.expressions['e1']?.position).toEqual({ x: 100, y: 100 });

    // 3 creates + 1 update + 1 delete = 5 operations
    expect(finalState.operationLog).toHaveLength(5);
  });

  it('[BOUNDARY] selection is cleaned when selected expression is deleted', () => {
    const expr1 = makeRectangle('sel-1');
    const expr2 = makeEllipse('sel-2');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().setSelectedIds(new Set(['sel-1', 'sel-2']));

    // Delete one selected expression
    useCanvasStore.getState().deleteExpressions(['sel-1']);

    const state = useCanvasStore.getState();
    expect(state.selectedIds.has('sel-1')).toBe(false);
    expect(state.selectedIds.has('sel-2')).toBe(true);
    expect(state.selectedIds.size).toBe(1);
  });
});

// ── Edge cases ───────────────────────────────────────────────

describe('Store edge cases [EDGE]', () => {
  it('[EDGE] deleting non-existent IDs is a no-op (no phantom operations)', () => {
    const expr = makeRectangle('existing');
    useCanvasStore.getState().addExpression(expr);

    // Delete only non-existing IDs — should not emit an operation
    useCanvasStore.getState().deleteExpressions(['nonexistent-1', 'nonexistent-2']);

    const state = useCanvasStore.getState();
    // existing expression should still be there
    expect(state.expressions['existing']).toBeDefined();
    // Only 1 create operation — no phantom delete
    expect(state.operationLog).toHaveLength(1);
  });

  it('[EDGE] updateExpression with empty partial still emits operation', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const expr = makeRectangle('empty-update');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('empty-update', {});

    const state = useCanvasStore.getState();
    // 1 create + 1 update = 2 operations
    expect(state.operationLog).toHaveLength(2);

    // Expression unchanged
    expect(state.expressions['empty-update']?.kind).toBe('rectangle');

    warnSpy.mockRestore();
  });

  it('[EDGE] rapid sequential operations maintain correct ordering', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `rapid-${i}`);
    const expressions = ids.map((id) => makeRectangle(id));

    // Add all expressions rapidly
    for (const expr of expressions) {
      useCanvasStore.getState().addExpression(expr);
    }

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(20);
    expect(state.expressionOrder).toEqual(ids);
    expect(state.operationLog).toHaveLength(20);

    // All operations should be 'create' type
    expect(state.operationLog.every((op) => op.type === 'create')).toBe(true);
  });

  it('[EDGE] operation timestamps are monotonically non-decreasing', () => {
    const expr1 = makeRectangle('ts-1');
    const expr2 = makeEllipse('ts-2');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().updateExpression('ts-1', { position: { x: 1, y: 1 } });
    useCanvasStore.getState().deleteExpressions(['ts-2']);

    const timestamps = useCanvasStore.getState().operationLog.map((op) => op.timestamp);
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]!).toBeGreaterThanOrEqual(timestamps[i - 1]!);
    }
  });

  it('[EDGE] setSelectedIds with empty set clears selection', () => {
    useCanvasStore.getState().setSelectedIds(new Set(['a', 'b', 'c']));
    useCanvasStore.getState().setSelectedIds(new Set());

    expect(useCanvasStore.getState().selectedIds.size).toBe(0);
  });

  it('[EDGE] setCamera clamps extreme zoom values', () => {
    const extremeCamera: Camera = {
      x: Number.MAX_SAFE_INTEGER,
      y: -Number.MAX_SAFE_INTEGER,
      zoom: 0.001,
    };

    useCanvasStore.getState().setCamera(extremeCamera);

    const state = useCanvasStore.getState();
    expect(state.camera.x).toBe(Number.MAX_SAFE_INTEGER);
    expect(state.camera.y).toBe(-Number.MAX_SAFE_INTEGER);
    expect(state.camera.zoom).toBe(0.01); // clamped to MIN_ZOOM
    expect(state.operationLog).toHaveLength(0); // [AC8] no operation emitted
  });

  it('[EDGE] setCamera clamps zero zoom to minimum', () => {
    useCanvasStore.getState().setCamera({ x: 0, y: 0, zoom: 0 });

    expect(useCanvasStore.getState().camera.zoom).toBe(0.01); // clamped to MIN_ZOOM
    expect(useCanvasStore.getState().operationLog).toHaveLength(0);
  });

  it('[EDGE] setCamera clamps excessively high zoom to maximum', () => {
    useCanvasStore.getState().setCamera({ x: 0, y: 0, zoom: 500 });

    expect(useCanvasStore.getState().camera.zoom).toBe(100); // clamped to MAX_ZOOM
  });

  it('[EDGE] addExpression followed by immediate delete leaves clean state', () => {
    const expr = makeRectangle('flash');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().deleteExpressions(['flash']);

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(0);
    expect(state.expressionOrder).toHaveLength(0);
    // Operation log retains history even though the expression is gone
    expect(state.operationLog).toHaveLength(2);
  });

  it('[EDGE] update after delete is a no-op with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const expr = makeRectangle('ghost');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().deleteExpressions(['ghost']);

    // Attempt to update deleted expression
    useCanvasStore.getState().updateExpression('ghost', { position: { x: 1, y: 1 } });

    const state = useCanvasStore.getState();
    expect(state.expressions['ghost']).toBeUndefined();
    // 1 create + 1 delete = 2 (no update operation added)
    expect(state.operationLog).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('[EDGE] delete all then add new — expressionOrder is fresh', () => {
    const expr1 = makeRectangle('old-1');
    const expr2 = makeEllipse('old-2');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().deleteExpressions(['old-1', 'old-2']);

    const newExpr = makeText('new-1');
    useCanvasStore.getState().addExpression(newExpr);

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual(['new-1']);
    expect(Object.keys(state.expressions)).toEqual(['new-1']);
  });
});

// ── AC8: UI actions isolation ────────────────────────────────

describe('UI actions do not emit operations [CONTRACT][AC8]', () => {
  it('[CONTRACT][AC8] setSelectedIds + setActiveTool + setCamera combined produce zero operations', () => {
    useCanvasStore.getState().setSelectedIds(new Set(['x', 'y']));
    useCanvasStore.getState().setActiveTool('rectangle');
    useCanvasStore.getState().setCamera({ x: 100, y: 200, zoom: 3 });
    useCanvasStore.getState().setSelectedIds(new Set());
    useCanvasStore.getState().setActiveTool('text');
    useCanvasStore.getState().setCamera({ x: -50, y: -50, zoom: 0.5 });

    expect(useCanvasStore.getState().operationLog).toHaveLength(0);
  });

  it('[CONTRACT][AC8] UI actions interleaved with content mutations only emit content operations', () => {
    const expr = makeRectangle('interleaved');

    // UI action
    useCanvasStore.getState().setActiveTool('rectangle');
    // Content mutation
    useCanvasStore.getState().addExpression(expr);
    // UI action
    useCanvasStore.getState().setSelectedIds(new Set(['interleaved']));
    // Content mutation
    useCanvasStore.getState().updateExpression('interleaved', { position: { x: 1, y: 1 } });
    // UI action
    useCanvasStore.getState().setCamera({ x: 0, y: 0, zoom: 2 });

    const ops = useCanvasStore.getState().operationLog;
    expect(ops).toHaveLength(2); // Only create + update
    expect(ops[0]!.type).toBe('create');
    expect(ops[1]!.type).toBe('update');
  });
});
