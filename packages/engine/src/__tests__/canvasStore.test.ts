/**
 * Unit tests for canvasStore — Zustand state management.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test corresponds to an acceptance criterion from Issue #1.
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import type { ToolType, Camera } from '../types/index.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id?: string) {
  const expr = builder
    .rectangle(100, 200, 300, 150)
    .label('Test Rectangle')
    .build();
  if (id) {
    return { ...expr, id };
  }
  return expr;
}

function makeEllipse(id?: string) {
  const expr = builder
    .ellipse(50, 50, 200, 200)
    .label('Test Ellipse')
    .build();
  if (id) {
    return { ...expr, id };
  }
  return expr;
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
    canUndo: false,
    canRedo: false,
  });
  useCanvasStore.getState().clearHistory();
});

// ── AC5: addExpression ─────────────────────────────────────

describe('addExpression', () => {
  it('adds expression to the expressions map keyed by id', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']).toBeDefined();
    expect(state.expressions['rect-1']?.id).toBe('rect-1');
    expect(state.expressions['rect-1']?.kind).toBe('rectangle');
  });

  it('appends expression id to expressionOrder (z-order)', () => {
    const expr1 = makeRectangle('rect-1');
    const expr2 = makeEllipse('ellipse-1');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual(['rect-1', 'ellipse-1']);
  });

  it('appends a create ProtocolOperation to operationLog', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(1);

    const op = state.operationLog[0];
    expect(op).toBeDefined();
    expect(op!.type).toBe('create');
    expect(op!.id).toBeTruthy();
    expect(op!.timestamp).toBeGreaterThan(0);
    expect(op!.payload).toMatchObject({
      type: 'create',
      expressionId: 'rect-1',
      kind: 'rectangle',
    });
  });

  it('rejects invalid expression with console.warn and does not add it', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const invalidExpr = {
      id: 'bad-1',
      kind: 'rectangle',
      // Missing required fields: position, size, angle, style, meta, data
    } as never;

    useCanvasStore.getState().addExpression(invalidExpr);

    const state = useCanvasStore.getState();
    expect(state.expressions['bad-1']).toBeUndefined();
    expect(state.expressionOrder).not.toContain('bad-1');
    expect(state.operationLog).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('does not add duplicate expression ids', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().addExpression(expr);

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual(['rect-1']);
    expect(state.operationLog).toHaveLength(1);
  });
});

// ── AC6: updateExpression ──────────────────────────────────

describe('updateExpression', () => {
  it('merges partial updates into existing expression', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 500, y: 600 },
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.position).toEqual({ x: 500, y: 600 });
    // Other fields remain unchanged
    expect(state.expressions['rect-1']?.kind).toBe('rectangle');
    expect(state.expressions['rect-1']?.size).toEqual({ width: 300, height: 150 });
  });

  it('appends an update ProtocolOperation to operationLog', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 500, y: 600 },
    });

    const state = useCanvasStore.getState();
    // 1 create + 1 update = 2 operations
    expect(state.operationLog).toHaveLength(2);

    const updateOp = state.operationLog[1];
    expect(updateOp).toBeDefined();
    expect(updateOp!.type).toBe('update');
    expect(updateOp!.payload).toMatchObject({
      type: 'update',
      expressionId: 'rect-1',
    });
  });

  it('does nothing when expression id does not exist', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useCanvasStore.getState().updateExpression('nonexistent', {
      position: { x: 1, y: 2 },
    });

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('protects id from being overwritten via update', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-1', { id: 'hacked' } as Partial<VisualExpression>);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.id).toBe('rect-1');
    expect(state.expressions['hacked']).toBeUndefined();
  });

  it('protects kind from being overwritten via update', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-1', { kind: 'ellipse' } as Partial<VisualExpression>);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.kind).toBe('rectangle');
  });

  it('rejects update that would produce invalid expression', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-1', {
      size: { width: -1, height: 0 },
    });

    const state = useCanvasStore.getState();
    // Original size should be preserved (update reverted)
    expect(state.expressions['rect-1']?.size).toEqual({ width: 300, height: 150 });
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('records changed fields accurately in update operation payload', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().updateExpression('rect-1', {
      position: { x: 42, y: 99 },
    });

    const state = useCanvasStore.getState();
    const updateOp = state.operationLog[1]!;
    const payload = updateOp.payload as { changes: Record<string, unknown> };
    expect(payload.changes.position).toEqual({ x: 42, y: 99 });
    // data should NOT be in changes since we didn't change it
    expect(payload.changes.data).toBeUndefined();
  });
});

describe('deleteExpressions', () => {
  it('removes expressions from expressions map and expressionOrder', () => {
    const expr1 = makeRectangle('rect-1');
    const expr2 = makeEllipse('ellipse-1');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().deleteExpressions(['rect-1']);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']).toBeUndefined();
    expect(state.expressions['ellipse-1']).toBeDefined();
    expect(state.expressionOrder).toEqual(['ellipse-1']);
  });

  it('appends a delete ProtocolOperation to operationLog', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().deleteExpressions(['rect-1']);

    const state = useCanvasStore.getState();
    // 1 create + 1 delete = 2 operations
    expect(state.operationLog).toHaveLength(2);

    const deleteOp = state.operationLog[1];
    expect(deleteOp).toBeDefined();
    expect(deleteOp!.type).toBe('delete');
    expect(deleteOp!.payload).toMatchObject({
      type: 'delete',
      expressionIds: ['rect-1'],
    });
  });

  it('handles deleting multiple expressions at once', () => {
    const expr1 = makeRectangle('rect-1');
    const expr2 = makeEllipse('ellipse-1');
    const expr3 = makeRectangle('rect-2');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().addExpression(expr3);
    useCanvasStore.getState().deleteExpressions(['rect-1', 'rect-2']);

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toEqual(['ellipse-1']);
    expect(state.expressionOrder).toEqual(['ellipse-1']);
  });

  it('also removes deleted ids from selectedIds', () => {
    const expr1 = makeRectangle('rect-1');
    const expr2 = makeEllipse('ellipse-1');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1', 'ellipse-1']));
    useCanvasStore.getState().deleteExpressions(['rect-1']);

    const state = useCanvasStore.getState();
    expect(state.selectedIds.has('rect-1')).toBe(false);
    expect(state.selectedIds.has('ellipse-1')).toBe(true);
  });

  it('does nothing for empty array', () => {
    useCanvasStore.getState().deleteExpressions([]);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });
});

// ── AC8: setSelectedIds, setActiveTool, setCamera ──────────
// These MUST NOT emit protocol operations.

describe('setSelectedIds', () => {
  it('updates selectedIds in state', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    const state = useCanvasStore.getState();
    expect(state.selectedIds.has('rect-1')).toBe(true);
    expect(state.selectedIds.size).toBe(1);
  });

  it('does NOT emit a protocol operation', () => {
    useCanvasStore.getState().setSelectedIds(new Set(['some-id']));

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });

  it('replaces previous selection entirely', () => {
    useCanvasStore.getState().setSelectedIds(new Set(['a', 'b']));
    useCanvasStore.getState().setSelectedIds(new Set(['c']));

    const state = useCanvasStore.getState();
    expect(state.selectedIds.has('a')).toBe(false);
    expect(state.selectedIds.has('b')).toBe(false);
    expect(state.selectedIds.has('c')).toBe(true);
  });
});

describe('setActiveTool', () => {
  it('updates the active tool', () => {
    useCanvasStore.getState().setActiveTool('rectangle');

    const state = useCanvasStore.getState();
    expect(state.activeTool).toBe('rectangle');
  });

  it('does NOT emit a protocol operation', () => {
    useCanvasStore.getState().setActiveTool('ellipse');

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });

  it('accepts all valid tool types', () => {
    const tools: ToolType[] = [
      'select', 'rectangle', 'ellipse', 'diamond',
      'line', 'arrow', 'freehand', 'text',
    ];

    for (const tool of tools) {
      useCanvasStore.getState().setActiveTool(tool);
      expect(useCanvasStore.getState().activeTool).toBe(tool);
    }
  });
});

describe('setCamera', () => {
  it('updates the camera state', () => {
    const camera: Camera = { x: 100, y: -50, zoom: 2.5 };
    useCanvasStore.getState().setCamera(camera);

    const state = useCanvasStore.getState();
    expect(state.camera).toEqual(camera);
  });

  it('does NOT emit a protocol operation', () => {
    useCanvasStore.getState().setCamera({ x: 0, y: 0, zoom: 1 });

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });
});

// ── Initial state ──────────────────────────────────────────

describe('initial state', () => {
  it('starts with empty expressions', () => {
    const state = useCanvasStore.getState();
    expect(state.expressions).toEqual({});
  });

  it('starts with empty expressionOrder', () => {
    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual([]);
  });

  it('starts with empty selectedIds', () => {
    const state = useCanvasStore.getState();
    expect(state.selectedIds.size).toBe(0);
  });

  it('starts with select tool active', () => {
    const state = useCanvasStore.getState();
    expect(state.activeTool).toBe('select');
  });

  it('starts with camera at origin with zoom 1', () => {
    const state = useCanvasStore.getState();
    expect(state.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('starts with empty operationLog', () => {
    const state = useCanvasStore.getState();
    expect(state.operationLog).toEqual([]);
  });
});

// ── Operation ID uniqueness ────────────────────────────────

describe('operation IDs', () => {
  it('generates unique IDs for each operation', () => {
    const expr1 = makeRectangle('rect-1');
    const expr2 = makeEllipse('ellipse-1');

    useCanvasStore.getState().addExpression(expr1);
    useCanvasStore.getState().addExpression(expr2);
    useCanvasStore.getState().updateExpression('rect-1', { position: { x: 0, y: 0 } });
    useCanvasStore.getState().deleteExpressions(['ellipse-1']);

    const state = useCanvasStore.getState();
    const ids = state.operationLog.map((op) => op.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── R3: applyRemoteOperation uses style/angle from CreatePayload ─

describe('applyRemoteOperation with style/angle (R3)', () => {
  it('uses style from CreatePayload when present', () => {
    const customStyle = {
      strokeColor: '#ff0000',
      backgroundColor: '#00ff00',
      fillStyle: 'solid' as const,
      strokeWidth: 5,
      roughness: 0,
      opacity: 0.8,
    };

    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-1',
      type: 'create',
      author: testAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'styled-1',
        kind: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 100, height: 50 },
        data: { kind: 'rectangle' },
        style: customStyle,
        angle: 45,
      },
    });

    const expr = useCanvasStore.getState().expressions['styled-1'];
    expect(expr).toBeDefined();
    expect(expr!.style).toEqual(customStyle);
    expect(expr!.angle).toBe(45);
  });

  it('falls back to defaults when style/angle absent in CreatePayload', () => {
    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-2',
      type: 'create',
      author: testAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'default-1',
        kind: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        data: { kind: 'rectangle' },
      },
    });

    const expr = useCanvasStore.getState().expressions['default-1'];
    expect(expr).toBeDefined();
    expect(expr!.angle).toBe(0);
    expect(expr!.style.strokeColor).toBe('#1e1e1e');
    expect(expr!.style.fillStyle).toBe('hachure');
  });
});

// ── R5: applyRemoteOperation validates incoming operations ────

describe('applyRemoteOperation validation (R5)', () => {
  it('rejects invalid remote operation (missing required fields)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useCanvasStore.getState().applyRemoteOperation({
      id: '',  // invalid: min length 1
      type: 'create',
      author: testAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'bad-1',
        kind: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        data: { kind: 'rectangle' },
      },
    });

    // Should not add the expression
    expect(useCanvasStore.getState().expressions['bad-1']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('rejects remote create with invalid payload data', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-valid',
      type: 'create',
      author: testAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'corrupt-1',
        kind: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: -1, height: -1 },  // invalid: must be positive
        data: { kind: 'rectangle' },
      },
    });

    // Should not add the expression (size validation fails)
    expect(useCanvasStore.getState().expressions['corrupt-1']).toBeUndefined();

    warnSpy.mockRestore();
  });

  it('accepts valid remote operation', () => {
    useCanvasStore.getState().applyRemoteOperation({
      id: 'op-good',
      type: 'create',
      author: testAuthor,
      timestamp: Date.now(),
      payload: {
        type: 'create',
        expressionId: 'good-1',
        kind: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 100, height: 50 },
        data: { kind: 'rectangle' },
      },
    });

    expect(useCanvasStore.getState().expressions['good-1']).toBeDefined();
  });
});
