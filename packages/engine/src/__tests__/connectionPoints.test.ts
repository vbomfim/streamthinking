/**
 * Unit tests for connection point computation.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers 8-point computation for rectangles, ellipses, diamonds,
 * sticky-notes, stencils, and nearest-point detection.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import {
  getConnectionPoints,
  findNearestConnectionPoint,
  type ShapeConnectionPoint,
  type ShapeConnectionPointPosition,
} from '../connectors/connectionPoints.js';

// ── Test helpers ───────────────────────────────────────────

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

function makeStickyNote(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): VisualExpression {
  return makeExpression({
    id,
    kind: 'sticky-note',
    position: { x, y },
    size: { width, height },
    data: { kind: 'sticky-note', text: 'Test', color: '#FFE082' },
  });
}

/** Find a connection point by position in a list. */
function findByPosition(
  points: ShapeConnectionPoint[],
  position: ShapeConnectionPointPosition,
): ShapeConnectionPoint | undefined {
  return points.find((p) => p.position === position);
}

// ── getConnectionPoints — rectangle ──────────────────────────

describe('getConnectionPoints — rectangle', () => {
  const rect = makeRect('r1', 100, 100, 200, 100);

  it('returns 8 connection points', () => {
    const points = getConnectionPoints(rect);
    expect(points).toHaveLength(8);
  });

  it('computes top edge midpoint', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'top');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(200); // x + width/2
    expect(pt!.y).toBe(100); // y
  });

  it('computes right edge midpoint', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'right');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(300); // x + width
    expect(pt!.y).toBe(150); // y + height/2
  });

  it('computes bottom edge midpoint', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'bottom');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(200); // x + width/2
    expect(pt!.y).toBe(200); // y + height
  });

  it('computes left edge midpoint', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'left');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(100); // x
    expect(pt!.y).toBe(150); // y + height/2
  });

  it('computes top-left corner', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'top-left');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(100); // x
    expect(pt!.y).toBe(100); // y
  });

  it('computes top-right corner', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'top-right');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(300); // x + width
    expect(pt!.y).toBe(100); // y
  });

  it('computes bottom-left corner', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'bottom-left');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(100); // x
    expect(pt!.y).toBe(200); // y + height
  });

  it('computes bottom-right corner', () => {
    const pt = findByPosition(getConnectionPoints(rect), 'bottom-right');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(300); // x + width
    expect(pt!.y).toBe(200); // y + height
  });

  it('returns unique positions (no duplicates)', () => {
    const points = getConnectionPoints(rect);
    const positions = points.map((p) => p.position);
    expect(new Set(positions).size).toBe(8);
  });
});

// ── getConnectionPoints — ellipse ────────────────────────────

describe('getConnectionPoints — ellipse', () => {
  const ellipse = makeEllipse('e1', 100, 100, 200, 100);
  // center = (200, 150), rx = 100, ry = 50

  it('returns 8 connection points', () => {
    const points = getConnectionPoints(ellipse);
    expect(points).toHaveLength(8);
  });

  it('computes top at 12 o-clock (0°)', () => {
    const pt = findByPosition(getConnectionPoints(ellipse), 'top');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(200); // cx
    expect(pt!.y).toBe(100); // cy - ry
  });

  it('computes right at 3 o-clock (90°)', () => {
    const pt = findByPosition(getConnectionPoints(ellipse), 'right');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(300); // cx + rx
    expect(pt!.y).toBe(150); // cy
  });

  it('computes bottom at 6 o-clock (180°)', () => {
    const pt = findByPosition(getConnectionPoints(ellipse), 'bottom');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(200); // cx
    expect(pt!.y).toBe(200); // cy + ry
  });

  it('computes left at 9 o-clock (270°)', () => {
    const pt = findByPosition(getConnectionPoints(ellipse), 'left');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(100); // cx - rx
    expect(pt!.y).toBe(150); // cy
  });

  it('computes top-right at 45° on ellipse perimeter', () => {
    const pt = findByPosition(getConnectionPoints(ellipse), 'top-right');
    expect(pt).toBeDefined();
    // cx + rx * cos(45°) ≈ 200 + 100 * 0.7071 ≈ 270.71
    expect(pt!.x).toBeCloseTo(270.71, 0);
    // cy - ry * sin(45°) ≈ 150 - 50 * 0.7071 ≈ 114.64
    expect(pt!.y).toBeCloseTo(114.64, 0);
  });

  it('computes top-left at 135° on ellipse perimeter', () => {
    const pt = findByPosition(getConnectionPoints(ellipse), 'top-left');
    expect(pt).toBeDefined();
    // cx - rx * cos(45°) ≈ 200 - 70.71 ≈ 129.29
    expect(pt!.x).toBeCloseTo(129.29, 0);
    expect(pt!.y).toBeCloseTo(114.64, 0);
  });
});

// ── getConnectionPoints — diamond ────────────────────────────

describe('getConnectionPoints — diamond', () => {
  const diamond = makeDiamond('d1', 100, 100, 200, 100);
  // Vertices: top(200,100), right(300,150), bottom(200,200), left(100,150)

  it('returns 8 connection points', () => {
    const points = getConnectionPoints(diamond);
    expect(points).toHaveLength(8);
  });

  it('computes top vertex', () => {
    const pt = findByPosition(getConnectionPoints(diamond), 'top');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(200); // cx
    expect(pt!.y).toBe(100); // y
  });

  it('computes right vertex', () => {
    const pt = findByPosition(getConnectionPoints(diamond), 'right');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(300); // x + width
    expect(pt!.y).toBe(150); // cy
  });

  it('computes bottom vertex', () => {
    const pt = findByPosition(getConnectionPoints(diamond), 'bottom');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(200); // cx
    expect(pt!.y).toBe(200); // y + height
  });

  it('computes left vertex', () => {
    const pt = findByPosition(getConnectionPoints(diamond), 'left');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(100); // x
    expect(pt!.y).toBe(150); // cy
  });

  it('computes top-right midpoint of edge', () => {
    const pt = findByPosition(getConnectionPoints(diamond), 'top-right');
    expect(pt).toBeDefined();
    // Midpoint between top(200,100) and right(300,150) = (250, 125)
    expect(pt!.x).toBe(250);
    expect(pt!.y).toBe(125);
  });

  it('computes bottom-left midpoint of edge', () => {
    const pt = findByPosition(getConnectionPoints(diamond), 'bottom-left');
    expect(pt).toBeDefined();
    // Midpoint between bottom(200,200) and left(100,150) = (150, 175)
    expect(pt!.x).toBe(150);
    expect(pt!.y).toBe(175);
  });
});

// ── getConnectionPoints — sticky-note ────────────────────────

describe('getConnectionPoints — sticky-note', () => {
  it('returns 8 connection points (same as rectangle)', () => {
    const stickyNote = makeStickyNote('sn1', 50, 50, 200, 200);
    const points = getConnectionPoints(stickyNote);
    expect(points).toHaveLength(8);
  });

  it('computes correct top-center', () => {
    const stickyNote = makeStickyNote('sn1', 50, 50, 200, 200);
    const pt = findByPosition(getConnectionPoints(stickyNote), 'top');
    expect(pt).toBeDefined();
    expect(pt!.x).toBe(150); // 50 + 200/2
    expect(pt!.y).toBe(50);  // y
  });
});

// ── getConnectionPoints — non-bindable kinds ─────────────────

describe('getConnectionPoints — non-bindable kinds', () => {
  it('returns empty array for arrow kind', () => {
    const arrow = makeExpression({
      id: 'a1',
      kind: 'arrow',
      data: { kind: 'arrow', points: [[0, 0], [100, 100]], endArrowhead: true } as VisualExpression['data'],
    });
    expect(getConnectionPoints(arrow)).toEqual([]);
  });

  it('returns empty array for line kind', () => {
    const line = makeExpression({
      id: 'l1',
      kind: 'line',
      data: { kind: 'line', points: [[0, 0], [100, 100]] } as VisualExpression['data'],
    });
    expect(getConnectionPoints(line)).toEqual([]);
  });

  it('returns empty array for text kind', () => {
    const text = makeExpression({
      id: 't1',
      kind: 'text',
      data: { kind: 'text', text: 'hi', fontSize: 14, fontFamily: 'sans', textAlign: 'left' } as VisualExpression['data'],
    });
    expect(getConnectionPoints(text)).toEqual([]);
  });

  it('returns empty array for freehand kind', () => {
    const freehand = makeExpression({
      id: 'f1',
      kind: 'freehand',
      data: { kind: 'freehand', points: [[0, 0, 0.5]] } as VisualExpression['data'],
    });
    expect(getConnectionPoints(freehand)).toEqual([]);
  });
});

// ── findNearestConnectionPoint ───────────────────────────────

describe('findNearestConnectionPoint', () => {
  const rect = makeRect('r1', 100, 100, 200, 100);

  it('returns nearest point when within snap distance', () => {
    // Top edge center is (200, 100). Query near it.
    const result = findNearestConnectionPoint(200, 95, rect, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('top');
    expect(result!.x).toBe(200);
    expect(result!.y).toBe(100);
  });

  it('returns nearest corner when closer than edge', () => {
    // Top-right corner is (300, 100). Query near it.
    const result = findNearestConnectionPoint(305, 95, rect, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('top-right');
    expect(result!.x).toBe(300);
    expect(result!.y).toBe(100);
  });

  it('returns null when point is far from all connection points', () => {
    const result = findNearestConnectionPoint(500, 500, rect, 15);
    expect(result).toBeNull();
  });

  it('returns null for non-bindable expression', () => {
    const arrow = makeExpression({
      id: 'a1',
      kind: 'arrow',
      data: { kind: 'arrow', points: [[0, 0], [100, 100]], endArrowhead: true } as VisualExpression['data'],
    });
    const result = findNearestConnectionPoint(50, 50, arrow, 15);
    expect(result).toBeNull();
  });

  it('returns null when snap distance is 0', () => {
    const result = findNearestConnectionPoint(200, 100, rect, 0);
    expect(result).toBeNull();
  });

  it('picks the closest point when multiple are in range', () => {
    // Near top-right corner (300, 100) — closer than right edge center (300, 150)
    const result = findNearestConnectionPoint(298, 102, rect, 20);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('top-right');
  });

  it('works for ellipse shapes', () => {
    const ellipse = makeEllipse('e1', 100, 100, 200, 100);
    // Right edge at (300, 150)
    const result = findNearestConnectionPoint(310, 150, ellipse, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('right');
    expect(result!.x).toBe(300);
    expect(result!.y).toBe(150);
  });

  it('works for diamond shapes', () => {
    const diamond = makeDiamond('d1', 100, 100, 200, 100);
    // Top vertex at (200, 100)
    const result = findNearestConnectionPoint(200, 90, diamond, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('top');
    expect(result!.x).toBe(200);
    expect(result!.y).toBe(100);
  });
});

// ── Zero-size and degenerate shapes ──────────────────────────

describe('getConnectionPoints — zero-size shapes', () => {
  it('returns 8 points for zero-width rectangle (all x values equal)', () => {
    const rect = makeRect('r1', 100, 100, 0, 100);
    const points = getConnectionPoints(rect);
    expect(points).toHaveLength(8);
    // All x values should be 100 (position.x + 0)
    for (const pt of points) {
      expect(pt.x).toBe(100);
    }
  });

  it('returns 8 points for zero-height rectangle (all y values equal)', () => {
    const rect = makeRect('r1', 100, 100, 200, 0);
    const points = getConnectionPoints(rect);
    expect(points).toHaveLength(8);
    // Top and bottom y values should both be 100
    for (const pt of points) {
      expect(pt.y).toBe(100);
    }
  });

  it('returns 8 points for zero-size rectangle (all points at same location)', () => {
    const rect = makeRect('r1', 50, 50, 0, 0);
    const points = getConnectionPoints(rect);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(pt.x).toBe(50);
      expect(pt.y).toBe(50);
    }
  });

  it('returns 8 points for zero-size ellipse (all points at center)', () => {
    const ellipse = makeEllipse('e1', 100, 100, 0, 0);
    const points = getConnectionPoints(ellipse);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(pt.x).toBe(100);
      expect(pt.y).toBe(100);
    }
  });

  it('returns 8 points for zero-size diamond (all points at center)', () => {
    const diamond = makeDiamond('d1', 100, 100, 0, 0);
    const points = getConnectionPoints(diamond);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(pt.x).toBe(100);
      expect(pt.y).toBe(100);
    }
  });

  it('findNearestConnectionPoint works with zero-size shape', () => {
    const rect = makeRect('r1', 50, 50, 0, 0);
    // All 8 points at (50, 50) — query near them
    const result = findNearestConnectionPoint(50, 45, rect, 15);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(50);
    expect(result!.y).toBe(50);
  });
});
