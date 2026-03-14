/**
 * Unit tests for canvasStore remote operation support.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers applyRemoteOperation and replaceState — the server-side
 * integration surface that MUST NOT append to operationLog.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type {
  VisualExpression,
  ProtocolOperation,
  CreatePayload,
  UpdatePayload,
  DeletePayload,
  MovePayload,
  TransformPayload,
  StylePayload,
} from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const remoteAuthor = { type: 'human' as const, id: 'user-2', name: 'Remote User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  const expr = builder
    .rectangle(100, 200, 300, 150)
    .label('Test Rectangle')
    .build();
  return { ...expr, id };
}

function makeOp(
  type: ProtocolOperation['type'],
  payload: ProtocolOperation['payload'],
): ProtocolOperation {
  return {
    id: `remote-op-${Date.now()}-${Math.random()}`,
    type,
    author: remoteAuthor,
    timestamp: Date.now(),
    payload,
  };
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
});

// ── applyRemoteOperation ───────────────────────────────────

describe('applyRemoteOperation', () => {
  it('applies create operation — adds expression without logging', () => {
    const payload: CreatePayload = {
      type: 'create',
      expressionId: 'remote-rect-1',
      kind: 'rectangle',
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      data: { kind: 'rectangle' },
    };
    const op = makeOp('create', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.expressions['remote-rect-1']).toBeDefined();
    expect(state.expressions['remote-rect-1']?.position).toEqual({ x: 10, y: 20 });
    expect(state.expressions['remote-rect-1']?.size).toEqual({ width: 100, height: 50 });
    expect(state.expressionOrder).toContain('remote-rect-1');
    // CRITICAL: must NOT append to operationLog
    expect(state.operationLog).toHaveLength(0);
  });

  it('applies update operation — merges changes without logging', () => {
    // Seed an expression first
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    // Clear the operationLog from the addExpression
    useCanvasStore.setState({ operationLog: [] });

    const payload: UpdatePayload = {
      type: 'update',
      expressionId: 'rect-1',
      changes: {
        position: { x: 500, y: 600 },
      },
    };
    const op = makeOp('update', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.position).toEqual({ x: 500, y: 600 });
    // Size should remain unchanged
    expect(state.expressions['rect-1']?.size).toEqual({ width: 300, height: 150 });
    expect(state.operationLog).toHaveLength(0);
  });

  it('applies delete operation — removes expression without logging', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.setState({ operationLog: [] });

    const payload: DeletePayload = {
      type: 'delete',
      expressionIds: ['rect-1'],
    };
    const op = makeOp('delete', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']).toBeUndefined();
    expect(state.expressionOrder).not.toContain('rect-1');
    expect(state.operationLog).toHaveLength(0);
  });

  it('applies move operation — updates position without logging', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.setState({ operationLog: [] });

    const payload: MovePayload = {
      type: 'move',
      expressionId: 'rect-1',
      from: { x: 100, y: 200 },
      to: { x: 300, y: 400 },
    };
    const op = makeOp('move', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.position).toEqual({ x: 300, y: 400 });
    expect(state.operationLog).toHaveLength(0);
  });

  it('applies transform operation — updates angle/size without logging', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.setState({ operationLog: [] });

    const payload: TransformPayload = {
      type: 'transform',
      expressionId: 'rect-1',
      angle: 45,
      size: { width: 200, height: 100 },
    };
    const op = makeOp('transform', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.angle).toBe(45);
    expect(state.expressions['rect-1']?.size).toEqual({ width: 200, height: 100 });
    expect(state.operationLog).toHaveLength(0);
  });

  it('applies style operation — updates style without logging', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.setState({ operationLog: [] });

    const payload: StylePayload = {
      type: 'style',
      expressionIds: ['rect-1'],
      style: { strokeColor: '#ff0000', opacity: 0.5 },
    };
    const op = makeOp('style', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.style.strokeColor).toBe('#ff0000');
    expect(state.expressions['rect-1']?.style.opacity).toBe(0.5);
    expect(state.operationLog).toHaveLength(0);
  });

  it('ignores unsupported operation types gracefully', () => {
    const op = makeOp('snapshot', {
      type: 'snapshot',
      label: 'test',
      expressionIds: [],
    });

    // Should not throw
    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });

  it('ignores update for non-existent expression', () => {
    const payload: UpdatePayload = {
      type: 'update',
      expressionId: 'nonexistent',
      changes: { position: { x: 1, y: 2 } },
    };
    const op = makeOp('update', payload);

    // Should not throw
    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });

  it('ignores delete for non-existent expression', () => {
    const payload: DeletePayload = {
      type: 'delete',
      expressionIds: ['nonexistent'],
    };
    const op = makeOp('delete', payload);

    useCanvasStore.getState().applyRemoteOperation(op);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });
});

// ── replaceState ───────────────────────────────────────────

describe('replaceState', () => {
  it('replaces expressions and expressionOrder from arrays', () => {
    // Seed some initial state
    const localExpr = makeRectangle('local-1');
    useCanvasStore.getState().addExpression(localExpr);

    const remoteExpr1 = makeRectangle('remote-1');
    const remoteExpr2 = makeRectangle('remote-2');

    useCanvasStore.getState().replaceState(
      [remoteExpr1, remoteExpr2],
      ['remote-1', 'remote-2'],
    );

    const state = useCanvasStore.getState();
    // Local expression should be gone
    expect(state.expressions['local-1']).toBeUndefined();
    // Remote expressions should exist
    expect(state.expressions['remote-1']).toBeDefined();
    expect(state.expressions['remote-2']).toBeDefined();
    expect(state.expressionOrder).toEqual(['remote-1', 'remote-2']);
  });

  it('clears operationLog on replaceState', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    expect(useCanvasStore.getState().operationLog.length).toBeGreaterThan(0);

    useCanvasStore.getState().replaceState([], []);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
  });

  it('clears selection on replaceState', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    useCanvasStore.getState().replaceState([], []);

    const state = useCanvasStore.getState();
    expect(state.selectedIds.size).toBe(0);
  });

  it('handles empty state sync', () => {
    useCanvasStore.getState().replaceState([], []);

    const state = useCanvasStore.getState();
    expect(state.expressions).toEqual({});
    expect(state.expressionOrder).toEqual([]);
  });
});
