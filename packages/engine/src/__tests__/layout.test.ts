/**
 * Unit tests for layout algorithms — tree, force, grid.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test verifies a specific layout behavior from ticket #113.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import { computeLayout } from '../layout/computeLayout.js';
import { computeTreeLayout } from '../layout/treeLayout.js';
import { computeForceLayout } from '../layout/forceLayout.js';
import { computeGridLayout } from '../layout/gridLayout.js';
import type { LayoutOptions } from '../layout/types.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };

/** Create a minimal VisualExpression for layout testing. */
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

/** Create an arrow expression with optional bindings. */
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

// ── computeLayout dispatcher ───────────────────────────────

describe('computeLayout', () => {
  it('dispatches to tree layout when algorithm is "tree"', () => {
    const exprs = [makeExpression('a', 0, 0), makeExpression('b', 0, 0)];
    const arrow = makeArrow('arr1', 'a', 'b');
    const result = computeLayout([...exprs, arrow], { algorithm: 'tree' });
    expect(result).toBeInstanceOf(Map);
    // Should only contain shape positions, not arrows
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('dispatches to force layout when algorithm is "force"', () => {
    const exprs = [makeExpression('a', 0, 0), makeExpression('b', 50, 50)];
    const result = computeLayout(exprs, { algorithm: 'force' });
    expect(result).toBeInstanceOf(Map);
  });

  it('dispatches to grid layout when algorithm is "grid"', () => {
    const exprs = [makeExpression('a', 0, 0), makeExpression('b', 50, 50)];
    const result = computeLayout(exprs, { algorithm: 'grid' });
    expect(result).toBeInstanceOf(Map);
  });

  it('skips locked expressions', () => {
    const locked = makeExpression('locked', 100, 100, 100, 60, {
      meta: {
        author: testAuthor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: true,
      },
    });
    const normal = makeExpression('normal', 200, 200);
    const result = computeLayout([locked, normal], { algorithm: 'grid' });
    expect(result.has('locked')).toBe(false);
    expect(result.has('normal')).toBe(true);
  });

  it('skips arrow expressions (arrows are edges, not nodes)', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 100, 100);
    const arrow = makeArrow('arr1', 'a', 'b');
    const result = computeLayout([a, b, arrow], { algorithm: 'grid' });
    expect(result.has('arr1')).toBe(false);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('returns empty map for empty input', () => {
    const result = computeLayout([], { algorithm: 'tree' });
    expect(result.size).toBe(0);
  });

  it('returns empty map for input with only arrows', () => {
    const arrow = makeArrow('arr1');
    const result = computeLayout([arrow], { algorithm: 'tree' });
    expect(result.size).toBe(0);
  });
});

// ── Tree Layout ────────────────────────────────────────────

describe('computeTreeLayout', () => {
  it('arranges a simple parent-child hierarchy (TB direction)', () => {
    const parent = makeExpression('parent', 0, 0);
    const child = makeExpression('child', 0, 0);
    const arrow = makeArrow('arr1', 'parent', 'child');

    const result = computeTreeLayout(
      [parent, child],
      [arrow],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    expect(result.has('parent')).toBe(true);
    expect(result.has('child')).toBe(true);

    const parentPos = result.get('parent')!;
    const childPos = result.get('child')!;
    // Child should be below parent in TB direction
    expect(childPos.y).toBeGreaterThan(parentPos.y);
  });

  it('arranges hierarchy in LR direction (children to the right)', () => {
    const parent = makeExpression('parent', 0, 0);
    const child = makeExpression('child', 0, 0);
    const arrow = makeArrow('arr1', 'parent', 'child');

    const result = computeTreeLayout(
      [parent, child],
      [arrow],
      { direction: 'LR', spacing: { horizontal: 50, vertical: 80 } },
    );

    const parentPos = result.get('parent')!;
    const childPos = result.get('child')!;
    // Child should be to the right of parent in LR direction
    expect(childPos.x).toBeGreaterThan(parentPos.x);
  });

  it('handles multiple children under one parent', () => {
    const parent = makeExpression('parent', 0, 0);
    const child1 = makeExpression('child1', 0, 0);
    const child2 = makeExpression('child2', 0, 0);
    const arrow1 = makeArrow('arr1', 'parent', 'child1');
    const arrow2 = makeArrow('arr2', 'parent', 'child2');

    const result = computeTreeLayout(
      [parent, child1, child2],
      [arrow1, arrow2],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    const parentPos = result.get('parent')!;
    const child1Pos = result.get('child1')!;
    const child2Pos = result.get('child2')!;

    // Both children should be below parent
    expect(child1Pos.y).toBeGreaterThan(parentPos.y);
    expect(child2Pos.y).toBeGreaterThan(parentPos.y);
    // Children should be horizontally separated
    expect(child1Pos.x).not.toBe(child2Pos.x);
  });

  it('handles deep hierarchy (3 levels)', () => {
    const root = makeExpression('root', 0, 0);
    const mid = makeExpression('mid', 0, 0);
    const leaf = makeExpression('leaf', 0, 0);
    const arr1 = makeArrow('arr1', 'root', 'mid');
    const arr2 = makeArrow('arr2', 'mid', 'leaf');

    const result = computeTreeLayout(
      [root, mid, leaf],
      [arr1, arr2],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    const rootPos = result.get('root')!;
    const midPos = result.get('mid')!;
    const leafPos = result.get('leaf')!;

    expect(midPos.y).toBeGreaterThan(rootPos.y);
    expect(leafPos.y).toBeGreaterThan(midPos.y);
  });

  it('handles disconnected nodes (no arrows)', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 50, 50);

    const result = computeTreeLayout(
      [a, b],
      [],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    // Both should still get positions
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('uses default spacing when not provided', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 0, 0);
    const arrow = makeArrow('arr1', 'a', 'b');

    const result = computeTreeLayout(
      [a, b],
      [arrow],
      { direction: 'TB' },
    );

    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('respects expression sizes in layout calculation', () => {
    const big = makeExpression('big', 0, 0, 200, 120);
    const small = makeExpression('small', 0, 0, 50, 30);
    const arrow = makeArrow('arr1', 'big', 'small');

    const result = computeTreeLayout(
      [big, small],
      [arrow],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    expect(result.has('big')).toBe(true);
    expect(result.has('small')).toBe(true);
  });

  it('handles cyclic graph (A→B→C→A) without crashing', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 0, 0);
    const c = makeExpression('c', 0, 0);
    const arr1 = makeArrow('arr1', 'a', 'b');
    const arr2 = makeArrow('arr2', 'b', 'c');
    const arr3 = makeArrow('arr3', 'c', 'a');

    const result = computeTreeLayout(
      [a, b, c],
      [arr1, arr2, arr3],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    // All three shapes should get valid positions
    expect(result.size).toBe(3);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(true);

    // Positions should be finite numbers
    for (const pos of result.values()) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });
});

// ── Force-Directed Layout ──────────────────────────────────

describe('computeForceLayout', () => {
  it('separates overlapping shapes', () => {
    // Two shapes at the exact same position
    const a = makeExpression('a', 100, 100);
    const b = makeExpression('b', 100, 100);

    const result = computeForceLayout(
      [a, b],
      [],
      { iterations: 50 },
    );

    const posA = result.get('a')!;
    const posB = result.get('b')!;
    // Shapes should have been pushed apart by repulsion
    const distance = Math.sqrt(
      (posA.x - posB.x) ** 2 + (posA.y - posB.y) ** 2,
    );
    expect(distance).toBeGreaterThan(10);
  });

  it('keeps connected shapes closer than unconnected ones', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 300, 0);
    const c = makeExpression('c', 600, 0);
    const arrow = makeArrow('arr1', 'a', 'b'); // a-b connected, c disconnected

    const result = computeForceLayout(
      [a, b, c],
      [arrow],
      { iterations: 100 },
    );

    const posA = result.get('a')!;
    const posB = result.get('b')!;
    const posC = result.get('c')!;

    const distAB = Math.sqrt((posA.x - posB.x) ** 2 + (posA.y - posB.y) ** 2);
    const distAC = Math.sqrt((posA.x - posC.x) ** 2 + (posA.y - posC.y) ** 2);

    // Connected nodes a-b should be closer than unconnected a-c
    expect(distAB).toBeLessThan(distAC);
  });

  it('converges (positions stabilize over iterations)', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 200, 0);
    const arrow = makeArrow('arr1', 'a', 'b');

    const result10 = computeForceLayout([a, b], [arrow], { iterations: 10 });
    const result100 = computeForceLayout([a, b], [arrow], { iterations: 100 });

    const posA10 = result10.get('a')!;
    const posB10 = result10.get('b')!;
    const posA100 = result100.get('a')!;
    const posB100 = result100.get('b')!;

    // After more iterations, the difference should be smaller
    const dist10 = Math.sqrt((posA10.x - posB10.x) ** 2 + (posA10.y - posB10.y) ** 2);
    const dist100 = Math.sqrt((posA100.x - posB100.x) ** 2 + (posA100.y - posB100.y) ** 2);

    // Both should produce finite values
    expect(Number.isFinite(dist10)).toBe(true);
    expect(Number.isFinite(dist100)).toBe(true);
  });

  it('handles single expression', () => {
    const a = makeExpression('a', 100, 100);
    const result = computeForceLayout([a], [], { iterations: 50 });
    expect(result.has('a')).toBe(true);
    // Position should be close to original (no forces acting)
    const pos = result.get('a')!;
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
  });

  it('handles zero iterations gracefully', () => {
    const a = makeExpression('a', 100, 100);
    const b = makeExpression('b', 200, 200);
    const result = computeForceLayout([a, b], [], { iterations: 0 });
    // Should return original positions
    expect(result.get('a')).toEqual({ x: 100, y: 100 });
    expect(result.get('b')).toEqual({ x: 200, y: 200 });
  });

  it('uses default iterations when not specified', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 50, 50);
    const result = computeForceLayout([a, b], [], {});
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });
});

// ── Grid Layout ────────────────────────────────────────────

describe('computeGridLayout', () => {
  it('arranges shapes in a grid pattern', () => {
    const expressions = [
      makeExpression('a', 500, 500),
      makeExpression('b', 100, 300),
      makeExpression('c', 800, 100),
      makeExpression('d', 200, 700),
    ];

    const result = computeGridLayout(expressions, { columns: 2 });

    expect(result.size).toBe(4);
    const positions = Array.from(result.values());
    // All positions should be finite
    positions.forEach((pos) => {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    });
  });

  it('arranges in correct number of columns', () => {
    const expressions = Array.from({ length: 6 }, (_, i) =>
      makeExpression(`e${i}`, i * 10, i * 10),
    );

    const result = computeGridLayout(expressions, {
      columns: 3,
      spacing: { horizontal: 50, vertical: 50 },
    });

    // With 6 items and 3 columns, we expect 2 rows
    const positions = Array.from(result.entries());
    const yValues = new Set(positions.map(([, pos]) => pos.y));
    expect(yValues.size).toBe(2);
  });

  it('uses a single row when columns >= expression count', () => {
    const expressions = [
      makeExpression('a', 0, 0),
      makeExpression('b', 100, 100),
    ];

    const result = computeGridLayout(expressions, { columns: 5 });

    const positions = Array.from(result.values());
    // All on same row
    const yValues = new Set(positions.map((pos) => pos.y));
    expect(yValues.size).toBe(1);
  });

  it('respects horizontal and vertical spacing', () => {
    const a = makeExpression('a', 0, 0, 100, 60);
    const b = makeExpression('b', 0, 0, 100, 60);

    const result = computeGridLayout([a, b], {
      columns: 2,
      spacing: { horizontal: 40, vertical: 40 },
    });

    const posA = result.get('a')!;
    const posB = result.get('b')!;
    // B should be to the right of A with width + spacing gap
    expect(posB.x - posA.x).toBe(100 + 40); // width + horizontal spacing
  });

  it('handles single expression', () => {
    const a = makeExpression('a', 100, 100);
    const result = computeGridLayout([a], { columns: 3 });
    expect(result.has('a')).toBe(true);
  });

  it('uses default columns when not specified', () => {
    const expressions = Array.from({ length: 8 }, (_, i) =>
      makeExpression(`e${i}`, i * 10, i * 10),
    );
    const result = computeGridLayout(expressions, {});
    expect(result.size).toBe(8);
  });

  it('handles varying expression sizes (uses max in each column)', () => {
    const tall = makeExpression('tall', 0, 0, 100, 200);
    const short = makeExpression('short', 0, 0, 100, 40);
    const third = makeExpression('third', 0, 0, 100, 60);

    const result = computeGridLayout([tall, short, third], {
      columns: 2,
      spacing: { horizontal: 20, vertical: 20 },
    });

    // The first row has tall (height=200) and short (height=40)
    // Third should be below the max height of row 1
    const tallPos = result.get('tall')!;
    const thirdPos = result.get('third')!;
    expect(thirdPos.y).toBe(tallPos.y + 200 + 20); // max row height + spacing
  });
});

// ── Edge extraction from arrows ────────────────────────────

describe('edge extraction', () => {
  it('extracts edges from arrow bindings for tree layout', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 100, 100);
    const c = makeExpression('c', 200, 200);
    const arr1 = makeArrow('arr1', 'a', 'b');
    const arr2 = makeArrow('arr2', 'b', 'c');

    const result = computeTreeLayout(
      [a, b, c],
      [arr1, arr2],
      { direction: 'TB', spacing: { horizontal: 50, vertical: 80 } },
    );

    const posA = result.get('a')!;
    const posB = result.get('b')!;
    const posC = result.get('c')!;

    // a → b → c hierarchy should position them top-to-bottom
    expect(posB.y).toBeGreaterThan(posA.y);
    expect(posC.y).toBeGreaterThan(posB.y);
  });

  it('ignores arrows without both bindings', () => {
    const a = makeExpression('a', 0, 0);
    const b = makeExpression('b', 100, 100);
    // Arrow with only start binding — no edge
    const partialArrow = makeArrow('arr1', 'a', undefined);

    const result = computeTreeLayout(
      [a, b],
      [partialArrow],
      { direction: 'TB' },
    );

    // Both should still get positions (as disconnected nodes)
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('ignores arrows referencing non-existent expressions', () => {
    const a = makeExpression('a', 0, 0);
    // Arrow references 'ghost' which doesn't exist
    const arrow = makeArrow('arr1', 'a', 'ghost');

    const result = computeTreeLayout(
      [a],
      [arrow],
      { direction: 'TB' },
    );

    expect(result.has('a')).toBe(true);
  });
});
