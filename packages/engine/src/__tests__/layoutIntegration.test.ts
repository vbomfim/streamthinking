/**
 * Integration and edge-case tests for the auto-layout feature (#113).
 *
 * QA Guardian scope: integration, boundary, edge cases, regression.
 * These tests verify behavior through the public API — they survive
 * a complete rewrite of the layout algorithms.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import { computeLayout } from '../layout/computeLayout.js';
import { computeTreeLayout } from '../layout/treeLayout.js';
import { computeForceLayout } from '../layout/forceLayout.js';
import { computeGridLayout } from '../layout/gridLayout.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { DEFAULT_LAYER_ID } from '@infinicanvas/protocol';
import type { LayoutOptions } from '../layout/types.js';

// ── Shared fixtures ────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'QA User' };

function makeExpression(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 60,
  overrides?: Partial<VisualExpression>,
): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width, height },
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle', label: id },
    ...overrides,
  };
}

function makeArrow(
  id: string,
  fromId?: string,
  toId?: string,
): VisualExpression {
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: {
      kind: 'arrow',
      points: [[0, 0], [100, 100]] as [number, number][],
      startBinding: fromId
        ? { expressionId: fromId, anchor: 'auto' as const, ratio: 0.5 }
        : undefined,
      endBinding: toId
        ? { expressionId: toId, anchor: 'auto' as const, ratio: 0.5 }
        : undefined,
    },
  };
}

function makeLine(id: string): VisualExpression {
  return {
    id,
    kind: 'line',
    position: { x: 0, y: 0 },
    size: { width: 200, height: 200 },
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: {
      kind: 'line',
      points: [[0, 0], [200, 200]] as [number, number][],
    },
  };
}

function makeRectangleViaBuilder(id: string, x = 0, y = 0): VisualExpression {
  const builder = new ExpressionBuilder(testAuthor);
  const expr = builder.rectangle(x, y, 100, 60).label(id).build();
  return { ...expr, id };
}

function makeArrowForStore(id: string, fromId: string, toId: string): VisualExpression {
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
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

// ── [EDGE] Circular references in tree layout ──────────────

describe('[EDGE] tree layout — circular references', () => {
  it('handles A → B → A cycle without crashing', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 100, 100);
    const arr1 = makeArrow('arr1', 'a', 'b');
    const arr2 = makeArrow('arr2', 'b', 'a');

    // Should not throw — dagre handles cycles by breaking them
    const result = computeTreeLayout(
      [a, b],
      [arr1, arr2],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    expect(result.size).toBe(2);
    const posA = result.get('a')!;
    const posB = result.get('b')!;
    expect(Number.isFinite(posA.x)).toBe(true);
    expect(Number.isFinite(posA.y)).toBe(true);
    expect(Number.isFinite(posB.x)).toBe(true);
    expect(Number.isFinite(posB.y)).toBe(true);
  });

  it('handles A → B → C → A triangle cycle', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 100, 0);
    const c = makeExpression('c', 200, 0);
    const arr1 = makeArrow('arr1', 'a', 'b');
    const arr2 = makeArrow('arr2', 'b', 'c');
    const arr3 = makeArrow('arr3', 'c', 'a');

    const result = computeTreeLayout(
      [a, b, c],
      [arr1, arr2, arr3],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    expect(result.size).toBe(3);
    for (const [, pos] of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('handles self-referencing arrow (A → A)', () => {
    const a = makeExpression('a', 0, 0);
    const selfArr = makeArrow('self', 'a', 'a');

    const result = computeTreeLayout(
      [a],
      [selfArr],
      { direction: 'TB' },
    );

    expect(result.size).toBe(1);
    const pos = result.get('a')!;
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });
});

// ── [EDGE] Tree layout direction coverage ──────────────────

describe('[EDGE] tree layout — BT and RL directions', () => {
  it('arranges hierarchy in BT direction (children above parent)', () => {
    const parent = makeExpression('parent', 0, 0);
    const child = makeExpression('child', 0, 0);
    const arrow = makeArrow('arr1', 'parent', 'child');

    const result = computeTreeLayout(
      [parent, child],
      [arrow],
      { direction: 'BT', spacing: { horizontal: 50, vertical: 80 } },
    );

    const parentPos = result.get('parent')!;
    const childPos = result.get('child')!;
    // In BT direction, child should be ABOVE parent
    expect(childPos.y).toBeLessThan(parentPos.y);
  });

  it('arranges hierarchy in RL direction (children to the left)', () => {
    const parent = makeExpression('parent', 0, 0);
    const child = makeExpression('child', 0, 0);
    const arrow = makeArrow('arr1', 'parent', 'child');

    const result = computeTreeLayout(
      [parent, child],
      [arrow],
      { direction: 'RL', spacing: { horizontal: 50, vertical: 80 } },
    );

    const parentPos = result.get('parent')!;
    const childPos = result.get('child')!;
    // In RL direction, child should be to the LEFT of parent
    expect(childPos.x).toBeLessThan(parentPos.x);
  });
});

// ── [EDGE] computeLayout filters line-kind expressions ─────

describe('[EDGE] computeLayout — connector filtering', () => {
  it('excludes line-kind expressions from layout nodes', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 100, 100);
    const line = makeLine('line1');

    const result = computeLayout([a, b, line], { algorithm: 'grid' });

    // Line should not appear in the result
    expect(result.has('line1')).toBe(false);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('excludes both arrows and lines from layout nodes', () => {
    const a = makeExpression('a', 0, 0);
    const arrow = makeArrow('arr1', 'a', undefined);
    const line = makeLine('line1');

    const result = computeLayout([a, arrow, line], { algorithm: 'grid' });

    expect(result.has('a')).toBe(true);
    expect(result.has('arr1')).toBe(false);
    expect(result.has('line1')).toBe(false);
  });
});

// ── [EDGE] Force layout edge cases ─────────────────────────

describe('[EDGE] force layout — stability and convergence', () => {
  it('produces deterministic output for same input', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 200, 0);
    const arrow = makeArrow('arr1', 'a', 'b');

    const result1 = computeForceLayout([a, b], [arrow], { iterations: 50 });
    const result2 = computeForceLayout([a, b], [arrow], { iterations: 50 });

    expect(result1.get('a')).toEqual(result2.get('a'));
    expect(result1.get('b')).toEqual(result2.get('b'));
  });

  it('handles negative iterations like zero iterations', () => {
    const a = makeExpression('a', 100, 200);
    const b = makeExpression('b', 300, 400);

    const result = computeForceLayout([a, b], [], { iterations: -5 });

    // Should return original positions (same as iterations=0)
    expect(result.get('a')).toEqual({ x: 100, y: 200 });
    expect(result.get('b')).toEqual({ x: 300, y: 400 });
  });

  it('handles many overlapping nodes without NaN or Infinity', () => {
    // 20 nodes all at position (0,0) — severe overlap
    const shapes = Array.from({ length: 20 }, (_, i) =>
      makeExpression(`n${i}`, 0, 0),
    );

    const result = computeForceLayout(shapes, [], { iterations: 100 });

    expect(result.size).toBe(20);
    for (const [, pos] of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
      expect(Number.isNaN(pos.x)).toBe(false);
      expect(Number.isNaN(pos.y)).toBe(false);
    }
  });

  it('keeps single node near its original position', () => {
    const a = makeExpression('a', 500, 300);

    const result = computeForceLayout([a], [], { iterations: 100 });

    const pos = result.get('a')!;
    // With no other nodes, no forces should act — position stays same
    // (velocity is initialized at 0, no forces applied when alone)
    expect(Math.abs(pos.x - 500)).toBeLessThan(50);
    expect(Math.abs(pos.y - 300)).toBeLessThan(50);
  });

  it('separates fully-connected cluster (complete graph K4)', () => {
    const nodes = Array.from({ length: 4 }, (_, i) =>
      makeExpression(`n${i}`, 100, 100), // All same position
    );
    // Connect every pair
    const arrows: VisualExpression[] = [];
    let arrId = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        arrows.push(makeArrow(`arr${arrId++}`, `n${i}`, `n${j}`));
      }
    }

    const result = computeForceLayout(nodes, arrows, { iterations: 100 });

    expect(result.size).toBe(4);
    // All nodes should have spread out — no two at the same position
    const positions = Array.from(result.values());
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i]!.x - positions[j]!.x;
        const dy = positions[i]!.y - positions[j]!.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThan(1);
      }
    }
  });
});

// ── [EDGE] Grid layout boundary cases ──────────────────────

describe('[EDGE] grid layout — boundary values', () => {
  it('handles 1 column (vertical stack)', () => {
    const shapes = Array.from({ length: 4 }, (_, i) =>
      makeExpression(`n${i}`, i * 50, i * 50, 100, 60),
    );

    const result = computeGridLayout(shapes, {
      columns: 1,
      spacing: { horizontal: 20, vertical: 20 },
    });

    expect(result.size).toBe(4);
    const positions = Array.from(result.entries());
    // All should have the same x (single column)
    const xValues = new Set(positions.map(([, pos]) => pos.x));
    expect(xValues.size).toBe(1);
    // Y values should be strictly increasing
    const yValues = positions.map(([, pos]) => pos.y);
    for (let i = 1; i < yValues.length; i++) {
      expect(yValues[i]!).toBeGreaterThan(yValues[i - 1]!);
    }
  });

  it('handles zero spacing without overlap (touching)', () => {
    const a = makeExpression('a', 0, 0, 100, 60);
    const b = makeExpression('b', 0, 0, 100, 60);
    const c = makeExpression('c', 0, 0, 100, 60);

    const result = computeGridLayout([a, b, c], {
      columns: 3,
      spacing: { horizontal: 0, vertical: 0 },
    });

    const posA = result.get('a')!;
    const posB = result.get('b')!;
    const posC = result.get('c')!;

    // With zero spacing, items should be adjacent (width apart)
    expect(posB.x - posA.x).toBe(100); // width of a
    expect(posC.x - posB.x).toBe(100); // width of b
    expect(posA.y).toBe(posB.y); // same row
  });

  it('handles very large spacing', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 0, 0);

    const result = computeGridLayout([a, b], {
      columns: 2,
      spacing: { horizontal: 10000, vertical: 10000 },
    });

    const posA = result.get('a')!;
    const posB = result.get('b')!;
    expect(posB.x - posA.x).toBe(100 + 10000); // width + spacing
    expect(Number.isFinite(posB.x)).toBe(true);
  });

  it('produces correct row count for exact column fit', () => {
    // 9 items in 3 columns = exactly 3 rows
    const shapes = Array.from({ length: 9 }, (_, i) =>
      makeExpression(`n${i}`, 0, 0),
    );

    const result = computeGridLayout(shapes, {
      columns: 3,
      spacing: { horizontal: 20, vertical: 20 },
    });

    const yValues = new Set(Array.from(result.values()).map((pos) => pos.y));
    expect(yValues.size).toBe(3);
  });

  it('produces correct row count for partial last row', () => {
    // 7 items in 3 columns = 3 rows (3 + 3 + 1)
    const shapes = Array.from({ length: 7 }, (_, i) =>
      makeExpression(`n${i}`, 0, 0),
    );

    const result = computeGridLayout(shapes, {
      columns: 3,
      spacing: { horizontal: 20, vertical: 20 },
    });

    const yValues = new Set(Array.from(result.values()).map((pos) => pos.y));
    expect(yValues.size).toBe(3);
  });
});

// ── [EDGE] Disconnected graph in tree layout ───────────────

describe('[EDGE] tree layout — disconnected graph', () => {
  it('handles multiple disconnected components', () => {
    // Two separate trees: A→B and C→D
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 0, 0);
    const c = makeExpression('c', 0, 0);
    const d = makeExpression('d', 0, 0);
    const arr1 = makeArrow('arr1', 'a', 'b');
    const arr2 = makeArrow('arr2', 'c', 'd');

    const result = computeTreeLayout(
      [a, b, c, d],
      [arr1, arr2],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    expect(result.size).toBe(4);
    // All positions should be finite
    for (const [, pos] of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('handles mix of connected and isolated nodes', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 0, 0);
    const isolated = makeExpression('iso', 0, 0);
    const arr1 = makeArrow('arr1', 'a', 'b');

    const result = computeTreeLayout(
      [a, b, isolated],
      [arr1],
      { direction: 'TB' },
    );

    expect(result.size).toBe(3);
    expect(result.has('iso')).toBe(true);
  });
});

// ── [EDGE] Locked expression with arrows ───────────────────

describe('[EDGE] computeLayout — locked expression with arrows', () => {
  it('excludes locked shapes but uses their arrows for topology', () => {
    // A (locked) → B → C — lock A, but B→C edge should still produce hierarchy
    const a = makeExpression('a', 0, 0, 100, 60, {
      meta: {
        author: testAuthor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: true,
      },
    });
    const b = makeExpression('b', 0, 0);
    const c = makeExpression('c', 0, 0);
    const arr1 = makeArrow('arr1', 'a', 'b'); // edge from locked to unlocked
    const arr2 = makeArrow('arr2', 'b', 'c');

    const result = computeLayout([a, b, c, arr1, arr2], {
      algorithm: 'tree',
      direction: 'TB',
    });

    // Locked 'a' should not be in result
    expect(result.has('a')).toBe(false);
    // B and C should still be positioned
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(true);
    // C should be below B (arr2 creates the edge)
    expect(result.get('c')!.y).toBeGreaterThan(result.get('b')!.y);
  });
});

// ── [BOUNDARY] Store integration — redo after undo ─────────

describe('[BOUNDARY] store applyLayout — redo after undo', () => {
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

  it('supports redo after undo of layout', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangleViaBuilder('a', 500, 500);
    const b = makeRectangleViaBuilder('b', 100, 300);
    store.addExpression(a);
    store.addExpression(b);

    const origA = { ...useCanvasStore.getState().expressions['a']!.position };

    useCanvasStore.getState().applyLayout({ algorithm: 'grid', columns: 2 }, 'all');

    // Capture layout positions
    const layoutA = { ...useCanvasStore.getState().expressions['a']!.position };

    // Undo
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['a']!.position.x).toBe(origA.x);

    // Redo
    useCanvasStore.getState().redo();
    const afterRedo = useCanvasStore.getState().expressions['a']!.position;
    expect(afterRedo.x).toBe(layoutA.x);
    expect(afterRedo.y).toBe(layoutA.y);
  });
});

// ── [BOUNDARY] Store integration — locked layer ────────────

describe('[BOUNDARY] store applyLayout — locked layer handling', () => {
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

  it('skips expressions on locked layers', () => {
    const store = useCanvasStore.getState();

    // Add a locked layer
    const lockedLayerId = store.addLayer('Locked');
    store.toggleLayerLock(lockedLayerId);

    const movable = makeRectangleViaBuilder('movable', 500, 500);
    store.addExpression(movable);

    const onLocked = { ...makeRectangleViaBuilder('onLocked', 200, 200), layerId: lockedLayerId };
    store.addExpression(onLocked);

    useCanvasStore.getState().applyLayout({ algorithm: 'grid' }, 'all');

    const state = useCanvasStore.getState();
    // Locked layer expression should not have moved
    expect(state.expressions['onLocked']!.position.x).toBe(200);
    expect(state.expressions['onLocked']!.position.y).toBe(200);
  });
});

// ── [BOUNDARY] Store integration — force algorithm ─────────

describe('[BOUNDARY] store applyLayout — force algorithm', () => {
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

  it('applies force layout through the store', () => {
    const store = useCanvasStore.getState();
    const a = makeRectangleViaBuilder('a', 0, 0);
    const b = makeRectangleViaBuilder('b', 0, 0); // same position — overlapping
    store.addExpression(a);
    store.addExpression(b);

    const count = useCanvasStore.getState().applyLayout(
      { algorithm: 'force', iterations: 50 },
      'all',
    );

    // Force layout should move at least one expression
    expect(count).toBeGreaterThan(0);
    const state = useCanvasStore.getState();
    const posA = state.expressions['a']!.position;
    const posB = state.expressions['b']!.position;
    // They should have been pushed apart
    const dist = Math.sqrt((posA.x - posB.x) ** 2 + (posA.y - posB.y) ** 2);
    expect(dist).toBeGreaterThan(10);
  });
});

// ── [EDGE] Expressions with varying kinds ──────────────────

describe('[EDGE] computeLayout — mixed expression kinds', () => {
  it('includes non-connector kinds: ellipse, diamond, text, sticky-note', () => {
    const kinds = ['ellipse', 'diamond', 'text', 'sticky-note'] as const;
    const shapes = kinds.map((kind, i) =>
      makeExpression(`${kind}-node`, i * 100, 0, 100, 60, {
        kind: kind as VisualExpression['kind'],
        data: { kind: kind as string, label: kind },
      }),
    );

    const result = computeLayout(shapes, { algorithm: 'grid', columns: 2 });

    // All non-connector kinds should be included
    for (const kind of kinds) {
      expect(result.has(`${kind}-node`)).toBe(true);
    }
    expect(result.size).toBe(4);
  });
});

// ── [EDGE] Large graph performance sanity ──────────────────

describe('[EDGE] layout — large graph sanity', () => {
  it('tree layout handles 50 nodes without excessive delay', () => {
    const shapes = Array.from({ length: 50 }, (_, i) =>
      makeExpression(`n${i}`, Math.random() * 1000, Math.random() * 1000),
    );
    // Linear chain: n0 → n1 → n2 → ... → n49
    const arrows = Array.from({ length: 49 }, (_, i) =>
      makeArrow(`arr${i}`, `n${i}`, `n${i + 1}`),
    );

    const start = Date.now();
    const result = computeLayout([...shapes, ...arrows], {
      algorithm: 'tree',
      direction: 'TB',
    });
    const elapsed = Date.now() - start;

    expect(result.size).toBe(50);
    // Should complete in under 5 seconds even on slow CI
    expect(elapsed).toBeLessThan(5000);
  });

  it('force layout handles 30 nodes without NaN', () => {
    const shapes = Array.from({ length: 30 }, (_, i) =>
      makeExpression(`n${i}`, Math.random() * 500, Math.random() * 500),
    );

    const result = computeForceLayout(shapes, [], { iterations: 50 });

    expect(result.size).toBe(30);
    for (const [, pos] of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('grid layout handles 100 items correctly', () => {
    const shapes = Array.from({ length: 100 }, (_, i) =>
      makeExpression(`n${i}`, 0, 0),
    );

    const result = computeGridLayout(shapes, { columns: 10 });

    expect(result.size).toBe(100);
    const yValues = new Set(Array.from(result.values()).map((pos) => pos.y));
    expect(yValues.size).toBe(10); // 100 items / 10 columns = 10 rows
  });
});

// ── [EDGE] Tree layout — wide fan-out ──────────────────────

describe('[EDGE] tree layout — wide fan-out', () => {
  it('handles parent with 10 children without overlap', () => {
    const parent = makeExpression('parent', 0, 0);
    const children = Array.from({ length: 10 }, (_, i) =>
      makeExpression(`child${i}`, 0, 0),
    );
    const arrows = children.map((child, i) =>
      makeArrow(`arr${i}`, 'parent', child.id),
    );

    const result = computeTreeLayout(
      [parent, ...children],
      arrows,
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    expect(result.size).toBe(11);

    // All children should be on the same rank (same y value)
    const childYs = children.map((c) => result.get(c.id)!.y);
    const uniqueYs = new Set(childYs);
    expect(uniqueYs.size).toBe(1);

    // No two children should share the same x position
    const childXs = children.map((c) => result.get(c.id)!.x);
    const uniqueXs = new Set(childXs);
    expect(uniqueXs.size).toBe(10);
  });
});

// ── [EDGE] computeLayout with all-locked input ─────────────

describe('[EDGE] computeLayout — all-locked input', () => {
  it('returns empty map when all expressions are locked', () => {
    const shapes = Array.from({ length: 3 }, (_, i) =>
      makeExpression(`n${i}`, i * 100, 0, 100, 60, {
        meta: {
          author: testAuthor,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: [],
          locked: true,
        },
      }),
    );

    const result = computeLayout(shapes, { algorithm: 'grid' });

    expect(result.size).toBe(0);
  });
});
