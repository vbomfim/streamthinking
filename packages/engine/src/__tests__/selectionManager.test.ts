/**
 * Unit tests for selection manager — query functions.
 *
 * Covers: z-order priority, marquee intersection, edge cases
 * (empty canvas, no matches, all matches).
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import {
  findExpressionAtPoint,
  findExpressionsInMarquee,
} from '../interaction/selectionManager.js';

// ── Test helpers ─────────────────────────────────────────────

const DEFAULT_STYLE: ExpressionStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

const DEFAULT_META = {
  author: { type: 'agent' as const, id: 'test', name: 'Test', provider: 'test' },
  createdAt: 0,
  updatedAt: 0,
  tags: [],
  locked: false,
};

function makeRect(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'rectangle' },
  };
}

function makeEllipse(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id,
    kind: 'ellipse',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'ellipse' },
  };
}

// ── findExpressionAtPoint ────────────────────────────────────

describe('findExpressionAtPoint', () => {
  it('returns null when no expressions exist', () => {
    const result = findExpressionAtPoint({ x: 50, y: 50 }, {}, [], 5);
    expect(result).toBeNull();
  });

  it('returns the ID of the hit expression', () => {
    const rect = makeRect('a', 0, 0, 100, 100);
    const expressions = { a: rect };
    const order = ['a'];
    const result = findExpressionAtPoint({ x: 50, y: 50 }, expressions, order, 5);
    expect(result).toBe('a');
  });

  it('returns null when point misses all expressions', () => {
    const rect = makeRect('a', 0, 0, 100, 100);
    const expressions = { a: rect };
    const order = ['a'];
    const result = findExpressionAtPoint({ x: 500, y: 500 }, expressions, order, 5);
    expect(result).toBeNull();
  });

  it('returns topmost (last in order) when multiple overlap', () => {
    // Two overlapping rectangles. 'b' is on top (later in order).
    const a = makeRect('a', 0, 0, 100, 100);
    const b = makeRect('b', 50, 50, 100, 100);
    const expressions = { a, b };
    const order = ['a', 'b']; // b is front (last)

    // Point (75, 75) hits both a and b
    const result = findExpressionAtPoint({ x: 75, y: 75 }, expressions, order, 0);
    expect(result).toBe('b');
  });

  it('returns back expression when front is not hit', () => {
    const a = makeRect('a', 0, 0, 100, 100);
    const b = makeRect('b', 200, 200, 100, 100);
    const expressions = { a, b };
    const order = ['a', 'b'];

    // Point (50, 50) only hits 'a'
    const result = findExpressionAtPoint({ x: 50, y: 50 }, expressions, order, 0);
    expect(result).toBe('a');
  });

  it('respects z-order with three overlapping shapes', () => {
    const a = makeRect('a', 0, 0, 200, 200);
    const b = makeRect('b', 50, 50, 200, 200);
    const c = makeRect('c', 100, 100, 200, 200);
    const expressions = { a, b, c };
    const order = ['a', 'b', 'c']; // c is front

    // Point (150, 150) hits all three → topmost = c
    const result = findExpressionAtPoint({ x: 150, y: 150 }, expressions, order, 0);
    expect(result).toBe('c');
  });

  it('skips expressions not in the expressions map', () => {
    const a = makeRect('a', 0, 0, 100, 100);
    const expressions = { a };
    const order = ['a', 'missing-id']; // 'missing-id' not in map

    const result = findExpressionAtPoint({ x: 50, y: 50 }, expressions, order, 0);
    expect(result).toBe('a');
  });

  it('uses tolerance for hit testing', () => {
    const rect = makeRect('a', 100, 100, 100, 100);
    const expressions = { a: rect };
    const order = ['a'];

    // Point 3px outside the right edge
    const result = findExpressionAtPoint({ x: 203, y: 150 }, expressions, order, 5);
    expect(result).toBe('a');
  });
});

// ── findExpressionsInMarquee ─────────────────────────────────

describe('findExpressionsInMarquee', () => {
  it('returns empty array when no expressions exist', () => {
    const result = findExpressionsInMarquee(
      { x: 0, y: 0, width: 100, height: 100 },
      {},
    );
    expect(result).toEqual([]);
  });

  it('returns IDs of expressions fully inside marquee', () => {
    const a = makeRect('a', 10, 10, 50, 50);
    const expressions = { a };
    const result = findExpressionsInMarquee(
      { x: 0, y: 0, width: 100, height: 100 },
      expressions,
    );
    expect(result).toEqual(['a']);
  });

  it('returns IDs of expressions partially overlapping marquee', () => {
    const a = makeRect('a', 80, 80, 100, 100);
    const expressions = { a };
    const result = findExpressionsInMarquee(
      { x: 0, y: 0, width: 100, height: 100 },
      expressions,
    );
    expect(result).toEqual(['a']);
  });

  it('excludes expressions fully outside marquee', () => {
    const a = makeRect('a', 200, 200, 50, 50);
    const expressions = { a };
    const result = findExpressionsInMarquee(
      { x: 0, y: 0, width: 100, height: 100 },
      expressions,
    );
    expect(result).toEqual([]);
  });

  it('handles multiple expressions — some inside, some outside', () => {
    const a = makeRect('a', 10, 10, 50, 50);
    const b = makeRect('b', 200, 200, 50, 50);
    const c = makeRect('c', 80, 80, 50, 50);
    const expressions = { a, b, c };

    const result = findExpressionsInMarquee(
      { x: 0, y: 0, width: 100, height: 100 },
      expressions,
    );
    expect(result).toContain('a');
    expect(result).toContain('c');
    expect(result).not.toContain('b');
    expect(result).toHaveLength(2);
  });

  it('handles edge-touching (touching but not overlapping) as non-intersecting', () => {
    // Expression right edge touches marquee left edge exactly
    const a = makeRect('a', -100, 0, 100, 100);
    const expressions = { a };
    const result = findExpressionsInMarquee(
      { x: 0, y: 0, width: 100, height: 100 },
      expressions,
    );
    expect(result).toEqual([]);
  });

  it('handles marquee with negative coordinates', () => {
    const a = makeRect('a', -50, -50, 100, 100);
    const expressions = { a };
    const result = findExpressionsInMarquee(
      { x: -100, y: -100, width: 200, height: 200 },
      expressions,
    );
    expect(result).toEqual(['a']);
  });

  it('normalizes inverted marquee (negative width/height)', () => {
    // Dragging from bottom-right to top-left → negative width/height
    const a = makeRect('a', 10, 10, 50, 50);
    const expressions = { a };
    const result = findExpressionsInMarquee(
      { x: 100, y: 100, width: -100, height: -100 },
      expressions,
    );
    expect(result).toEqual(['a']);
  });
});
