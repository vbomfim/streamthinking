/**
 * Unit tests for connector helper functions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Pure functions for snap detection, anchor calculation, and binding resolution.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import {
  findSnapPoint,
  getAnchorPoint,
  resolveBindings,
} from '../interaction/connectorHelpers.js';

// ── Test helpers ───────────────────────────────────────────

/** Create a minimal VisualExpression for testing. */
function makeExpression(
  overrides: Partial<VisualExpression> & { id: string; kind: string },
): VisualExpression {
  return {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human', id: 'test', name: 'Test' },
      createdAt: 0,
      updatedAt: 0,
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle' } as VisualExpression['data'],
    ...overrides,
  };
}

/** Create a rectangle expression at given position and size. */
function makeRect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): VisualExpression {
  return makeExpression({
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width, height },
    data: { kind: 'rectangle', label: '' },
  });
}

/** Create an ellipse expression at given position and size. */
function makeEllipse(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): VisualExpression {
  return makeExpression({
    id,
    kind: 'ellipse',
    position: { x, y },
    size: { width, height },
    data: { kind: 'ellipse', label: '' },
  });
}

/** Create a diamond expression at given position and size. */
function makeDiamond(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): VisualExpression {
  return makeExpression({
    id,
    kind: 'diamond',
    position: { x, y },
    size: { width, height },
    data: { kind: 'diamond', label: '' },
  });
}

/** Create an arrow expression with given points and optional bindings. */
function makeArrow(
  id: string,
  points: [number, number][],
  bindings?: {
    startBinding?: { expressionId: string; anchor: string };
    endBinding?: { expressionId: string; anchor: string };
  },
): VisualExpression {
  const { position, size } = computeBoundingBox(points);
  return makeExpression({
    id,
    kind: 'arrow',
    position,
    size,
    data: {
      kind: 'arrow',
      points,
      endArrowhead: true,
      ...(bindings?.startBinding && {
        startBinding: {
          expressionId: bindings.startBinding.expressionId,
          anchor: bindings.startBinding.anchor as 'top' | 'right' | 'bottom' | 'left' | 'center' | 'auto',
        },
      }),
      ...(bindings?.endBinding && {
        endBinding: {
          expressionId: bindings.endBinding.expressionId,
          anchor: bindings.endBinding.anchor as 'top' | 'right' | 'bottom' | 'left' | 'center' | 'auto',
        },
      }),
    },
  });
}

/** Compute bounding box from points (mirrors ArrowTool helper). */
function computeBoundingBox(points: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return {
    position: { x: minX, y: minY },
    size: { width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) },
  };
}

// ── findSnapPoint ────────────────────────────────────────────

describe('findSnapPoint', () => {
  it('returns snap point when world point is near a rectangle top edge', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Point near top edge center (200, 100) — within 20px
    const result = findSnapPoint({ x: 200, y: 90 }, rect, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('top');
    expect(result!.point.x).toBe(200); // center of top edge
    expect(result!.point.y).toBe(100); // top edge y
  });

  it('returns snap point when near rectangle right edge', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Point near right edge center (300, 150) — within 20px
    const result = findSnapPoint({ x: 310, y: 150 }, rect, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('right');
    expect(result!.point.x).toBe(300); // right edge x
    expect(result!.point.y).toBe(150); // center of right edge
  });

  it('returns snap point when near rectangle bottom edge', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Point near bottom edge center (200, 200) — within 20px
    const result = findSnapPoint({ x: 200, y: 215 }, rect, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('bottom');
    expect(result!.point.x).toBe(200);
    expect(result!.point.y).toBe(200);
  });

  it('returns snap point when near rectangle left edge', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Point near left edge center (100, 150)
    const result = findSnapPoint({ x: 85, y: 150 }, rect, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('left');
    expect(result!.point.x).toBe(100);
    expect(result!.point.y).toBe(150);
  });

  it('returns null when world point is far from any edge', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Point far away
    const result = findSnapPoint({ x: 500, y: 500 }, rect, 20);
    expect(result).toBeNull();
  });

  it('returns null when snap distance is 0', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Even right on the edge, snap distance 0 means no snap
    const result = findSnapPoint({ x: 200, y: 101 }, rect, 0);
    expect(result).toBeNull();
  });

  it('snaps to nearest edge anchor when point is equidistant from edges', () => {
    // Use a square shape where anchor points are equidistant from center
    const rect = makeRect('r1', 100, 100, 100, 100);
    // Point near top-right, close to right edge center (200, 150)
    // Right anchor: (200, 150), distance from (210, 145): sqrt(100+25) ≈ 11.2
    // Top anchor: (150, 100), distance from (210, 145): sqrt(3600+2025) ≈ 75
    const result = findSnapPoint({ x: 210, y: 145 }, rect, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('right');
  });

  it('returns snap point for ellipse at 0° (right)', () => {
    const ellipse = makeEllipse('e1', 100, 100, 200, 100);
    // Right edge of ellipse: center(200, 150) + rx(100, 0) = (300, 150)
    const result = findSnapPoint({ x: 310, y: 150 }, ellipse, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('right');
    expect(result!.point.x).toBe(300);
    expect(result!.point.y).toBe(150);
  });

  it('returns snap point for ellipse at 90° (bottom)', () => {
    const ellipse = makeEllipse('e1', 100, 100, 200, 100);
    // Bottom edge of ellipse: center(200, 150) + ry(0, 50) = (200, 200)
    const result = findSnapPoint({ x: 200, y: 215 }, ellipse, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('bottom');
    expect(result!.point.x).toBe(200);
    expect(result!.point.y).toBe(200);
  });

  it('returns snap point for diamond at top vertex', () => {
    const diamond = makeDiamond('d1', 100, 100, 200, 100);
    // Top vertex: (cx, y) = (200, 100)
    const result = findSnapPoint({ x: 200, y: 85 }, diamond, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('top');
    expect(result!.point.x).toBe(200);
    expect(result!.point.y).toBe(100);
  });

  it('returns snap point for diamond at right vertex', () => {
    const diamond = makeDiamond('d1', 100, 100, 200, 100);
    // Right vertex: (x + width, cy) = (300, 150)
    const result = findSnapPoint({ x: 315, y: 150 }, diamond, 20);

    expect(result).not.toBeNull();
    expect(result!.anchor).toBe('right');
    expect(result!.point.x).toBe(300);
    expect(result!.point.y).toBe(150);
  });

  it('ignores non-shape kinds (arrow, line, freehand, text)', () => {
    const arrow = makeArrow('a1', [[0, 0], [100, 100]]);
    const result = findSnapPoint({ x: 50, y: 50 }, arrow, 20);
    expect(result).toBeNull();
  });
});

// ── getAnchorPoint ───────────────────────────────────────────

describe('getAnchorPoint', () => {
  describe('rectangle anchors', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);

    it('returns top edge center for "top" anchor', () => {
      const pt = getAnchorPoint(rect, 'top');
      expect(pt.x).toBe(200); // x + width/2
      expect(pt.y).toBe(100); // y
    });

    it('returns right edge center for "right" anchor', () => {
      const pt = getAnchorPoint(rect, 'right');
      expect(pt.x).toBe(300); // x + width
      expect(pt.y).toBe(150); // y + height/2
    });

    it('returns bottom edge center for "bottom" anchor', () => {
      const pt = getAnchorPoint(rect, 'bottom');
      expect(pt.x).toBe(200); // x + width/2
      expect(pt.y).toBe(200); // y + height
    });

    it('returns left edge center for "left" anchor', () => {
      const pt = getAnchorPoint(rect, 'left');
      expect(pt.x).toBe(100); // x
      expect(pt.y).toBe(150); // y + height/2
    });

    it('returns bounding box center for "center" anchor', () => {
      const pt = getAnchorPoint(rect, 'center');
      expect(pt.x).toBe(200);
      expect(pt.y).toBe(150);
    });

    it('returns bounding box center for "auto" anchor', () => {
      const pt = getAnchorPoint(rect, 'auto');
      expect(pt.x).toBe(200);
      expect(pt.y).toBe(150);
    });
  });

  describe('ellipse anchors', () => {
    const ellipse = makeEllipse('e1', 100, 100, 200, 100);

    it('returns top (90°) point for "top" anchor', () => {
      const pt = getAnchorPoint(ellipse, 'top');
      expect(pt.x).toBe(200); // cx
      expect(pt.y).toBe(100); // cy - ry
    });

    it('returns right (0°) point for "right" anchor', () => {
      const pt = getAnchorPoint(ellipse, 'right');
      expect(pt.x).toBe(300); // cx + rx
      expect(pt.y).toBe(150); // cy
    });

    it('returns bottom (270°) point for "bottom" anchor', () => {
      const pt = getAnchorPoint(ellipse, 'bottom');
      expect(pt.x).toBe(200); // cx
      expect(pt.y).toBe(200); // cy + ry
    });

    it('returns left (180°) point for "left" anchor', () => {
      const pt = getAnchorPoint(ellipse, 'left');
      expect(pt.x).toBe(100); // cx - rx
      expect(pt.y).toBe(150); // cy
    });
  });

  describe('diamond anchors', () => {
    const diamond = makeDiamond('d1', 100, 100, 200, 100);

    it('returns top vertex for "top" anchor', () => {
      const pt = getAnchorPoint(diamond, 'top');
      expect(pt.x).toBe(200); // cx
      expect(pt.y).toBe(100); // y (top vertex)
    });

    it('returns right vertex for "right" anchor', () => {
      const pt = getAnchorPoint(diamond, 'right');
      expect(pt.x).toBe(300); // x + width
      expect(pt.y).toBe(150); // cy
    });

    it('returns bottom vertex for "bottom" anchor', () => {
      const pt = getAnchorPoint(diamond, 'bottom');
      expect(pt.x).toBe(200); // cx
      expect(pt.y).toBe(200); // y + height
    });

    it('returns left vertex for "left" anchor', () => {
      const pt = getAnchorPoint(diamond, 'left');
      expect(pt.x).toBe(100); // x
      expect(pt.y).toBe(150); // cy
    });
  });
});

// ── resolveBindings ──────────────────────────────────────────

describe('resolveBindings', () => {
  it('returns original points when arrow has no bindings', () => {
    const arrow = makeArrow('a1', [[0, 0], [100, 100]]);
    const expressions: Record<string, VisualExpression> = {
      a1: arrow,
    };

    const resolved = resolveBindings(arrow, expressions);
    expect(resolved).toEqual([[0, 0], [100, 100]]);
  });

  it('resolves start binding to target shape anchor point', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const arrow = makeArrow('a1', [[0, 0], [400, 400]], {
      startBinding: { expressionId: 'r1', anchor: 'right' },
    });
    const expressions: Record<string, VisualExpression> = {
      r1: rect,
      a1: arrow,
    };

    const resolved = resolveBindings(arrow, expressions);
    // Start point should resolve to right edge of rect (300, 150)
    expect(resolved[0]).toEqual([300, 150]);
    // End point unchanged
    expect(resolved[resolved.length - 1]).toEqual([400, 400]);
  });

  it('resolves end binding to target shape anchor point', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const arrow = makeArrow('a1', [[0, 0], [400, 400]], {
      endBinding: { expressionId: 'r1', anchor: 'top' },
    });
    const expressions: Record<string, VisualExpression> = {
      r1: rect,
      a1: arrow,
    };

    const resolved = resolveBindings(arrow, expressions);
    // Start point unchanged
    expect(resolved[0]).toEqual([0, 0]);
    // End point should resolve to top edge of rect (200, 100)
    expect(resolved[resolved.length - 1]).toEqual([200, 100]);
  });

  it('resolves both start and end bindings', () => {
    const rect1 = makeRect('r1', 100, 100, 200, 100);
    const rect2 = makeRect('r2', 500, 100, 200, 100);
    const arrow = makeArrow('a1', [[0, 0], [400, 400]], {
      startBinding: { expressionId: 'r1', anchor: 'right' },
      endBinding: { expressionId: 'r2', anchor: 'left' },
    });
    const expressions: Record<string, VisualExpression> = {
      r1: rect1,
      r2: rect2,
      a1: arrow,
    };

    const resolved = resolveBindings(arrow, expressions);
    // Start → right edge of rect1 (300, 150)
    expect(resolved[0]).toEqual([300, 150]);
    // End → left edge of rect2 (500, 150)
    expect(resolved[resolved.length - 1]).toEqual([500, 150]);
  });

  it('returns original points when bound expression does not exist', () => {
    const arrow = makeArrow('a1', [[0, 0], [100, 100]], {
      startBinding: { expressionId: 'nonexistent', anchor: 'top' },
    });
    const expressions: Record<string, VisualExpression> = {
      a1: arrow,
    };

    const resolved = resolveBindings(arrow, expressions);
    // Should fall back to original points
    expect(resolved[0]).toEqual([0, 0]);
  });

  it('returns original points for non-arrow expressions', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const expressions: Record<string, VisualExpression> = {
      r1: rect,
    };

    const resolved = resolveBindings(rect, expressions);
    expect(resolved).toEqual([]);
  });
});
