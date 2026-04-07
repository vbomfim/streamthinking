/**
 * Unit tests for canvasStore applyLayout action.
 *
 * Tests written following TDD [Red → Green → Refactor].
 * Verifies layout application with undo support and operation emission.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { DEFAULT_LAYER_ID } from '@infinicanvas/protocol';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string, x = 0, y = 0): VisualExpression {
  const expr = builder.rectangle(x, y, 100, 60).label(id).build();
  return { ...expr, id };
}

function makeArrow(id: string, fromId: string, toId: string): VisualExpression {
  const now = Date.now();
  return {
    id,
    kind: 'arrow',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: {
      strokeColor: '#000000',
      backgroundColor: 'transparent',
      strokeWidth: 2,
      opacity: 1,
      roughness: 1,
      fillStyle: 'hachure',
      fontFamily: 'sans-serif',
      fontSize: 14,
      textColor: '#000000',
    },
    meta: {
      author: testAuthor,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data: {
      kind: 'arrow' as const,
      points: [[0, 0], [100, 100]] as [number, number][],
      startBinding: { expressionId: fromId, anchor: 'auto' as const, ratio: 0.5 },
      endBinding: { expressionId: toId, anchor: 'auto' as const, ratio: 0.5 },
    },
  };
}

// ── Store reset ────────────────────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    gridVisible: true,
    gridType: 'dot',
    gridSize: 20,
    operationLog: [],
    canUndo: false,
    canRedo: false,
    layers: [{ id: DEFAULT_LAYER_ID, name: 'Default', visible: true, locked: false, order: 0 }],
    activeLayerId: DEFAULT_LAYER_ID,
  });
  useCanvasStore.getState().clearHistory();
});

// ── Tests ──────────────────────────────────────────────────

describe('applyLayout store action', () => {
  it('applies grid layout and repositions expressions', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangle('a', 500, 500);
    const b = makeRectangle('b', 100, 300);
    store.addExpression(a);
    store.addExpression(b);

    const count = useCanvasStore.getState().applyLayout(
      { algorithm: 'grid', columns: 2 },
      'all',
    );

    expect(count).toBeGreaterThan(0);
    const state = useCanvasStore.getState();
    // At least one expression should have moved
    const posA = state.expressions['a']!.position;
    const posB = state.expressions['b']!.position;
    // They should be on the same row with grid layout (2 columns)
    expect(posA.y).toBe(posB.y);
  });

  it('supports undo after layout', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangle('a', 500, 500);
    const b = makeRectangle('b', 100, 300);
    store.addExpression(a);
    store.addExpression(b);

    // Remember original positions
    const origA = { ...useCanvasStore.getState().expressions['a']!.position };
    const origB = { ...useCanvasStore.getState().expressions['b']!.position };

    useCanvasStore.getState().applyLayout({ algorithm: 'grid', columns: 2 }, 'all');

    // Positions should have changed
    expect(useCanvasStore.getState().canUndo).toBe(true);

    // Undo
    useCanvasStore.getState().undo();

    // Positions should be restored
    const state = useCanvasStore.getState();
    expect(state.expressions['a']!.position.x).toBe(origA.x);
    expect(state.expressions['a']!.position.y).toBe(origA.y);
    expect(state.expressions['b']!.position.x).toBe(origB.x);
    expect(state.expressions['b']!.position.y).toBe(origB.y);
  });

  it('emits move operations for collaboration', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangle('a', 500, 500);
    const b = makeRectangle('b', 100, 300);
    store.addExpression(a);
    store.addExpression(b);

    // Clear any previous operations from addExpression
    const preOpCount = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().applyLayout({ algorithm: 'grid', columns: 2 }, 'all');

    const state = useCanvasStore.getState();
    const newOps = state.operationLog.slice(preOpCount);
    const moveOps = newOps.filter((op) => op.type === 'move');
    expect(moveOps.length).toBeGreaterThan(0);
  });

  it('skips locked expressions', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangle('a', 500, 500);
    const locked: VisualExpression = {
      ...makeRectangle('locked', 100, 100),
      meta: { ...makeRectangle('locked', 100, 100).meta, locked: true },
    };
    store.addExpression(a);
    store.addExpression(locked);

    useCanvasStore.getState().applyLayout({ algorithm: 'grid' }, 'all');

    const state = useCanvasStore.getState();
    // Locked expression should remain at original position
    expect(state.expressions['locked']!.position.x).toBe(100);
    expect(state.expressions['locked']!.position.y).toBe(100);
  });

  it('only layouts selected expressions when scope is "selected"', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangle('a', 500, 500);
    const b = makeRectangle('b', 100, 300);
    const c = makeRectangle('c', 800, 800);
    store.addExpression(a);
    store.addExpression(b);
    store.addExpression(c);

    // Select only a and b
    store.setSelectedIds(new Set(['a', 'b']));

    const origC = { ...useCanvasStore.getState().expressions['c']!.position };

    useCanvasStore.getState().applyLayout({ algorithm: 'grid', columns: 2 }, 'selected');

    const state = useCanvasStore.getState();
    // c should not have moved
    expect(state.expressions['c']!.position.x).toBe(origC.x);
    expect(state.expressions['c']!.position.y).toBe(origC.y);
  });

  it('returns 0 when no expressions are eligible', () => {
    const count = useCanvasStore.getState().applyLayout(
      { algorithm: 'grid' },
      'all',
    );
    expect(count).toBe(0);
  });

  it('applies tree layout using arrow bindings', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangle('a', 0, 0);
    const b = makeRectangle('b', 0, 0);
    const arrow = makeArrow('arr1', 'a', 'b');
    store.addExpression(a);
    store.addExpression(b);
    store.addExpression(arrow);

    useCanvasStore.getState().applyLayout(
      { algorithm: 'tree', direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
      'all',
    );

    const state = useCanvasStore.getState();
    const posA = state.expressions['a']!.position;
    const posB = state.expressions['b']!.position;
    // B should be below A in TB direction
    expect(posB.y).toBeGreaterThan(posA.y);
  });

  it('skips expressions on hidden layers', () => {
    const store = useCanvasStore.getState();

    // Add a hidden layer
    const hiddenLayerId = store.addLayer('Hidden');
    store.toggleLayerVisibility(hiddenLayerId);

    const visible = makeRectangle('visible', 500, 500);
    store.addExpression(visible);

    const hidden = { ...makeRectangle('hidden', 200, 200), layerId: hiddenLayerId };
    store.addExpression(hidden);

    useCanvasStore.getState().applyLayout({ algorithm: 'grid' }, 'all');

    const state = useCanvasStore.getState();
    // Hidden layer expression should not have moved
    expect(state.expressions['hidden']!.position.x).toBe(200);
    expect(state.expressions['hidden']!.position.y).toBe(200);
  });
});
