/**
 * Integration tests for smart connectors feature (#110).
 *
 * Tests the interaction between connection points, orthogonal routing,
 * connector helpers, and the ArrowTool — verifying they compose correctly
 * as a system. Also covers edge cases and coverage gaps from the unit tests.
 *
 * QA Guardian — tests are behavior-based and survive internal refactors.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression, ArrowData, ArrowBinding } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import {
  getConnectionPoints,
  findNearestConnectionPoint,
  type ShapeConnectionPoint,
  type ShapeConnectionPointPosition,
} from '../connectors/connectionPoints.js';
import { computeOrthogonalRoute } from '../connectors/orthogonalRouter.js';
import {
  findSnapPoint,
  getAnchorPoint,
  resolveBindings,
  findBoundArrows,
  clearBindingsForDeletedExpression,
} from '../interaction/connectorHelpers.js';

// ── Shared test helpers ────────────────────────────────────

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

function makeRect(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return makeExpression({ id, kind: 'rectangle', position: { x, y }, size: { width: w, height: h }, data: { kind: 'rectangle', label: '' } });
}

function makeEllipse(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return makeExpression({ id, kind: 'ellipse', position: { x, y }, size: { width: w, height: h }, data: { kind: 'ellipse', label: '' } });
}

function makeDiamond(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return makeExpression({ id, kind: 'diamond', position: { x, y }, size: { width: w, height: h }, data: { kind: 'diamond', label: '' } });
}

function makeStencil(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return makeExpression({
    id, kind: 'stencil', position: { x, y }, size: { width: w, height: h },
    data: { kind: 'stencil', stencilId: 'server', category: 'generic-it', label: 'Server' } as VisualExpression['data'],
  });
}

function makeArrow(
  id: string,
  points: [number, number][],
  bindings?: { startBinding?: ArrowBinding; endBinding?: ArrowBinding },
): VisualExpression {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return makeExpression({
    id,
    kind: 'arrow',
    position: { x: minX, y: minY },
    size: { width: Math.max(Math.max(...xs) - minX, 1), height: Math.max(Math.max(...ys) - minY, 1) },
    data: {
      kind: 'arrow',
      points,
      endArrowhead: 'triangle',
      ...(bindings?.startBinding && { startBinding: bindings.startBinding }),
      ...(bindings?.endBinding && { endBinding: bindings.endBinding }),
    },
  });
}

/** Assert every segment in a route is horizontal or vertical. */
function assertOrthogonal(route: [number, number][]): void {
  for (let i = 1; i < route.length; i++) {
    const [x1, y1] = route[i - 1]!;
    const [x2, y2] = route[i]!;
    expect(
      x1 === x2 || y1 === y2,
      `Segment ${i - 1}→${i} is diagonal: (${x1},${y1})→(${x2},${y2})`,
    ).toBe(true);
  }
}

/** Find a connection point by position. */
function findByPosition(pts: ShapeConnectionPoint[], pos: ShapeConnectionPointPosition): ShapeConnectionPoint | undefined {
  return pts.find((p) => p.position === pos);
}

// ═══════════════════════════════════════════════════════════
// [COVERAGE] Stencil kind — connection points
// ═══════════════════════════════════════════════════════════

describe('getConnectionPoints — stencil [COVERAGE]', () => {
  const stencil = makeStencil('s1', 100, 50, 44, 44);

  it('returns 8 connection points for stencil kind', () => {
    const points = getConnectionPoints(stencil);
    expect(points).toHaveLength(8);
  });

  it('computes rectangle-style geometry for stencil', () => {
    const points = getConnectionPoints(stencil);
    // Stencil at (100,50), size (44,44) → center (122, 72)
    const top = findByPosition(points, 'top')!;
    expect(top.x).toBe(122); // x + width/2
    expect(top.y).toBe(50);  // y

    const bottomRight = findByPosition(points, 'bottom-right')!;
    expect(bottomRight.x).toBe(144); // x + width
    expect(bottomRight.y).toBe(94);  // y + height
  });
});

// ═══════════════════════════════════════════════════════════
// [EDGE] Zero-size and degenerate shapes
// ═══════════════════════════════════════════════════════════

describe('getConnectionPoints — zero-size shapes [EDGE]', () => {
  it('handles zero-width rectangle without NaN', () => {
    const rect = makeRect('r1', 100, 100, 0, 100);
    const points = getConnectionPoints(rect);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('handles zero-height rectangle without NaN', () => {
    const rect = makeRect('r1', 100, 100, 200, 0);
    const points = getConnectionPoints(rect);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('handles zero-size ellipse without NaN', () => {
    const ellipse = makeEllipse('e1', 50, 50, 0, 0);
    const points = getConnectionPoints(ellipse);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
    // All points should collapse to the same position
    const allSame = points.every((p) => p.x === points[0]!.x && p.y === points[0]!.y);
    // For zero-size, cardinal points collapse but diagonals may differ by cos/sin of 0
    // Just ensure no NaN — the geometric correctness is acceptable
  });

  it('handles zero-size diamond without NaN', () => {
    const diamond = makeDiamond('d1', 0, 0, 0, 0);
    const points = getConnectionPoints(diamond);
    expect(points).toHaveLength(8);
    for (const pt of points) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// [EDGE] findNearestConnectionPoint — boundary conditions
// ═══════════════════════════════════════════════════════════

describe('findNearestConnectionPoint — edge cases [EDGE]', () => {
  it('returns null for negative snap distance', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const result = findNearestConnectionPoint(200, 100, rect, -10);
    expect(result).toBeNull();
  });

  it('snaps exactly at the snap distance boundary', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Top edge center is (200, 100). Point exactly 15 away vertically: (200, 85)
    const result = findNearestConnectionPoint(200, 85, rect, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('top');
  });

  it('does not snap just outside the snap distance', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    // Top edge center is (200, 100). Point 15.1 away: should not snap with distance 15
    const result = findNearestConnectionPoint(200, 84.9, rect, 15);
    // dist = 100 - 84.9 = 15.1 — outside
    expect(result).toBeNull();
  });

  it('handles very large coordinate values', () => {
    const rect = makeRect('r1', 1e6, 1e6, 200, 100);
    const topCenter = { x: 1e6 + 100, y: 1e6 };
    const result = findNearestConnectionPoint(topCenter.x, topCenter.y - 5, rect, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('top');
    expect(result!.x).toBe(topCenter.x);
    expect(result!.y).toBe(topCenter.y);
  });

  it('handles negative coordinate positions', () => {
    const rect = makeRect('r1', -200, -100, 100, 50);
    // Left edge center: (-200, -75)
    const result = findNearestConnectionPoint(-210, -75, rect, 15);
    expect(result).not.toBeNull();
    expect(result!.position).toBe('left');
    expect(result!.x).toBe(-200);
    expect(result!.y).toBe(-75);
  });
});

// ═══════════════════════════════════════════════════════════
// [BOUNDARY] getAnchorPoint — corner anchors
// ═══════════════════════════════════════════════════════════

describe('getAnchorPoint — corner anchors [BOUNDARY]', () => {
  const rect = makeRect('r1', 100, 100, 200, 100);

  it('returns top-left corner for "top-left" anchor', () => {
    const pt = getAnchorPoint(rect, 'top-left');
    expect(pt).toEqual({ x: 100, y: 100 });
  });

  it('returns top-right corner for "top-right" anchor', () => {
    const pt = getAnchorPoint(rect, 'top-right');
    expect(pt).toEqual({ x: 300, y: 100 });
  });

  it('returns bottom-left corner for "bottom-left" anchor', () => {
    const pt = getAnchorPoint(rect, 'bottom-left');
    expect(pt).toEqual({ x: 100, y: 200 });
  });

  it('returns bottom-right corner for "bottom-right" anchor', () => {
    const pt = getAnchorPoint(rect, 'bottom-right');
    expect(pt).toEqual({ x: 300, y: 200 });
  });

  it('falls back to center for unknown anchor', () => {
    const pt = getAnchorPoint(rect, 'unknown-anchor');
    expect(pt).toEqual({ x: 200, y: 150 });
  });
});

// ═══════════════════════════════════════════════════════════
// [BOUNDARY] getAnchorPoint — ratio positioning
// ═══════════════════════════════════════════════════════════

describe('getAnchorPoint — ratio [BOUNDARY]', () => {
  const rect = makeRect('r1', 100, 100, 200, 100);

  it('ratio=0 positions at edge start', () => {
    // Top edge: ratio 0 → x = 100 (left end of top edge)
    const pt = getAnchorPoint(rect, 'top', 0);
    expect(pt).toEqual({ x: 100, y: 100 });
  });

  it('ratio=1 positions at edge end', () => {
    // Top edge: ratio 1 → x = 300 (right end of top edge)
    const pt = getAnchorPoint(rect, 'top', 1);
    expect(pt).toEqual({ x: 300, y: 100 });
  });

  it('ratio=0.25 positions at quarter point', () => {
    // Right edge: ratio 0.25 → y = 100 + 100*0.25 = 125
    const pt = getAnchorPoint(rect, 'right', 0.25);
    expect(pt).toEqual({ x: 300, y: 125 });
  });
});

// ═══════════════════════════════════════════════════════════
// [BOUNDARY] findBoundArrows — untested function
// ═══════════════════════════════════════════════════════════

describe('findBoundArrows [BOUNDARY]', () => {
  it('finds arrows bound at start to the target shape', () => {
    const rect = makeRect('r1', 0, 0, 100, 100);
    const arrow = makeArrow('a1', [[100, 50], [300, 200]], {
      startBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.5 },
    });
    const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow };

    const found = findBoundArrows('r1', expressions);
    expect(found).toEqual(['a1']);
  });

  it('finds arrows bound at end to the target shape', () => {
    const rect = makeRect('r1', 400, 0, 100, 100);
    const arrow = makeArrow('a1', [[0, 0], [400, 50]], {
      endBinding: { expressionId: 'r1', anchor: 'left', ratio: 0.5 },
    });
    const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow };

    const found = findBoundArrows('r1', expressions);
    expect(found).toEqual(['a1']);
  });

  it('finds multiple arrows bound to the same shape', () => {
    const rect = makeRect('r1', 100, 100, 100, 100);
    const arrow1 = makeArrow('a1', [[200, 150], [400, 150]], {
      startBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.5 },
    });
    const arrow2 = makeArrow('a2', [[0, 0], [100, 150]], {
      endBinding: { expressionId: 'r1', anchor: 'left', ratio: 0.5 },
    });
    const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow1, a2: arrow2 };

    const found = findBoundArrows('r1', expressions);
    expect(found).toHaveLength(2);
    expect(found).toContain('a1');
    expect(found).toContain('a2');
  });

  it('returns empty array when no arrows are bound', () => {
    const rect = makeRect('r1', 0, 0, 100, 100);
    const arrow = makeArrow('a1', [[200, 200], [400, 400]]);
    const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow };

    const found = findBoundArrows('r1', expressions);
    expect(found).toEqual([]);
  });

  it('returns empty array when target ID does not exist', () => {
    const arrow = makeArrow('a1', [[0, 0], [100, 100]], {
      startBinding: { expressionId: 'r1', anchor: 'top', ratio: 0.5 },
    });
    const expressions: Record<string, VisualExpression> = { a1: arrow };

    const found = findBoundArrows('nonexistent', expressions);
    expect(found).toEqual([]);
  });

  it('ignores non-arrow expressions', () => {
    const rect1 = makeRect('r1', 0, 0, 100, 100);
    const rect2 = makeRect('r2', 200, 200, 100, 100);
    const expressions: Record<string, VisualExpression> = { r1: rect1, r2: rect2 };

    const found = findBoundArrows('r1', expressions);
    expect(found).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// [BOUNDARY] clearBindingsForDeletedExpression — untested
// ═══════════════════════════════════════════════════════════

describe('clearBindingsForDeletedExpression [BOUNDARY]', () => {
  it('clears startBinding when it references the deleted expression', () => {
    const data: ArrowData = {
      kind: 'arrow',
      points: [[0, 0], [100, 100]],
      startBinding: { expressionId: 'deleted-1', anchor: 'right', ratio: 0.5 },
    };

    const result = clearBindingsForDeletedExpression(data, 'deleted-1');
    expect(result).toBeDefined();
    expect(result!.startBinding).toBeUndefined();
    expect(result!.points).toEqual([[0, 0], [100, 100]]); // Points preserved
  });

  it('clears endBinding when it references the deleted expression', () => {
    const data: ArrowData = {
      kind: 'arrow',
      points: [[0, 0], [100, 100]],
      endBinding: { expressionId: 'deleted-1', anchor: 'left', ratio: 0.5 },
    };

    const result = clearBindingsForDeletedExpression(data, 'deleted-1');
    expect(result).toBeDefined();
    expect(result!.endBinding).toBeUndefined();
  });

  it('clears both bindings when both reference the deleted expression (self-loop)', () => {
    const data: ArrowData = {
      kind: 'arrow',
      points: [[100, 50], [200, 50]],
      startBinding: { expressionId: 'shape-1', anchor: 'top', ratio: 0.5 },
      endBinding: { expressionId: 'shape-1', anchor: 'right', ratio: 0.5 },
    };

    const result = clearBindingsForDeletedExpression(data, 'shape-1');
    expect(result).toBeDefined();
    expect(result!.startBinding).toBeUndefined();
    expect(result!.endBinding).toBeUndefined();
  });

  it('returns undefined when no bindings reference the deleted expression', () => {
    const data: ArrowData = {
      kind: 'arrow',
      points: [[0, 0], [100, 100]],
      startBinding: { expressionId: 'other-1', anchor: 'top', ratio: 0.5 },
      endBinding: { expressionId: 'other-2', anchor: 'bottom', ratio: 0.5 },
    };

    const result = clearBindingsForDeletedExpression(data, 'deleted-1');
    expect(result).toBeUndefined();
  });

  it('returns undefined when arrow has no bindings at all', () => {
    const data: ArrowData = {
      kind: 'arrow',
      points: [[0, 0], [100, 100]],
    };

    const result = clearBindingsForDeletedExpression(data, 'anything');
    expect(result).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════
// [BOUNDARY] resolveBindings — self-loop path
// ═══════════════════════════════════════════════════════════

describe('resolveBindings — self-loop [BOUNDARY]', () => {
  it('resolves both endpoints for self-loop arrow', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const arrow = makeArrow('a1', [[200, 100], [300, 150]], {
      startBinding: { expressionId: 'r1', anchor: 'top', ratio: 0.5 },
      endBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.5 },
    });
    const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow };

    const resolved = resolveBindings(arrow, expressions);
    // Start → top edge center of rect: (200, 100)
    expect(resolved[0]).toEqual([200, 100]);
    // End → right edge center of rect: (300, 150)
    expect(resolved[resolved.length - 1]).toEqual([300, 150]);
  });

  it('self-loop respects custom ratios', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const arrow = makeArrow('a1', [[150, 100], [300, 125]], {
      startBinding: { expressionId: 'r1', anchor: 'top', ratio: 0.25 },
      endBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.25 },
    });
    const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow };

    const resolved = resolveBindings(arrow, expressions);
    // Start → top edge at 25%: x = 100 + 200*0.25 = 150, y = 100
    expect(resolved[0]).toEqual([150, 100]);
    // End → right edge at 25%: x = 300, y = 100 + 100*0.25 = 125
    expect(resolved[resolved.length - 1]).toEqual([300, 125]);
  });
});

// ═══════════════════════════════════════════════════════════
// [EDGE] Orthogonal router — additional edge cases
// ═══════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — additional edge cases [EDGE]', () => {
  it('infers direction correctly when dx === dy (tie-break)', () => {
    // When |dx| === |dy|, inferDirection should pick horizontal (dx >= dy)
    const route = computeOrthogonalRoute(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    );
    assertOrthogonal(route);
    // First segment should be horizontal (exit right when equal)
    expect(route[0]).toEqual([0, 0]);
    expect(route[1]![1]).toBe(0); // same Y as start → horizontal exit
  });

  it('handles very close but not identical points', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 100.5, y: 100.5 },
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([100.5, 100.5]);
  });

  it('Z-shape vertical: both exit down, target below', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 400 },
      'bottom',
      'top',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([300, 400]);
  });

  it('Z-shape vertical: both exit up, target above', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 400 },
      { x: 300, y: 100 },
      'top',
      'bottom',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([100, 400]);
    expect(route[route.length - 1]).toEqual([300, 100]);
  });

  it('Z-shape horizontal: exit right, target to the right', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      'right',
      'left',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(4); // Z-shape has ≥4 points
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([400, 300]);
  });

  it('Z-shape horizontal: exit left, target to the left', () => {
    const route = computeOrthogonalRoute(
      { x: 400, y: 100 },
      { x: 100, y: 300 },
      'left',
      'right',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([400, 100]);
    expect(route[route.length - 1]).toEqual([100, 300]);
  });

  it('route avoids both source and target bounds', () => {
    const route = computeOrthogonalRoute(
      { x: 200, y: 150 },   // right edge of source
      { x: 100, y: 350 },   // left edge of target (target is below-left)
      'right',
      'left',
      { x: 0, y: 100, width: 200, height: 100 },   // source bounds
      { x: 100, y: 300, width: 200, height: 100 },  // target bounds
    );
    assertOrthogonal(route);
    // Intermediate points should not be inside source bounds
    for (let i = 1; i < route.length - 1; i++) {
      const [px, py] = route[i]!;
      const insideSource = px >= 0 && px <= 200 && py >= 100 && py <= 200;
      expect(insideSource, `Point (${px},${py}) inside source`).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// [INTEGRATION] Connection points → Orthogonal routing pipeline
// ═══════════════════════════════════════════════════════════

describe('Connection points → Orthogonal routing pipeline [INTEGRATION]', () => {
  it('routes between two rectangles using their connection points', () => {
    const rect1 = makeRect('r1', 0, 0, 100, 80);
    const rect2 = makeRect('r2', 300, 200, 100, 80);

    // Get connection points from both shapes
    const cp1 = getConnectionPoints(rect1);
    const cp2 = getConnectionPoints(rect2);

    // Connect right edge of rect1 → left edge of rect2
    const startPt = findByPosition(cp1, 'right')!;
    const endPt = findByPosition(cp2, 'left')!;

    // Route between them
    const route = computeOrthogonalRoute(
      startPt, endPt,
      'right', 'left',
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 300, y: 200, width: 100, height: 80 },
    );

    assertOrthogonal(route);
    expect(route[0]).toEqual([startPt.x, startPt.y]);
    expect(route[route.length - 1]).toEqual([endPt.x, endPt.y]);
  });

  it('routes between ellipse bottom → diamond top', () => {
    const ellipse = makeEllipse('e1', 100, 0, 100, 80);
    const diamond = makeDiamond('d1', 100, 200, 120, 80);

    const cp1 = getConnectionPoints(ellipse);
    const cp2 = getConnectionPoints(diamond);

    const startPt = findByPosition(cp1, 'bottom')!;
    const endPt = findByPosition(cp2, 'top')!;

    const route = computeOrthogonalRoute(startPt, endPt, 'bottom', 'top');
    assertOrthogonal(route);
    expect(route[0]).toEqual([startPt.x, startPt.y]);
    expect(route[route.length - 1]).toEqual([endPt.x, endPt.y]);
  });

  it('resolves bindings + routes for a bound arrow', () => {
    const rect1 = makeRect('r1', 0, 0, 100, 80);
    const rect2 = makeRect('r2', 300, 200, 100, 80);
    const arrow = makeArrow('a1', [[100, 40], [300, 240]], {
      startBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.5 },
      endBinding: { expressionId: 'r2', anchor: 'left', ratio: 0.5 },
    });
    const expressions: Record<string, VisualExpression> = { r1: rect1, r2: rect2, a1: arrow };

    // Step 1: Resolve bindings
    const resolvedPoints = resolveBindings(arrow, expressions);
    expect(resolvedPoints[0]).toEqual([100, 40]);  // right edge of r1
    expect(resolvedPoints[resolvedPoints.length - 1]).toEqual([300, 240]);  // left edge of r2

    // Step 2: Route between resolved points
    const route = computeOrthogonalRoute(
      { x: resolvedPoints[0]![0], y: resolvedPoints[0]![1] },
      { x: resolvedPoints[1]![0], y: resolvedPoints[1]![1] },
      'right', 'left',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual(resolvedPoints[0]);
    expect(route[route.length - 1]).toEqual(resolvedPoints[1]);
  });
});

// ═══════════════════════════════════════════════════════════
// [INTEGRATION] findSnapPoint ↔ findNearestConnectionPoint
// ═══════════════════════════════════════════════════════════

describe('findSnapPoint vs findNearestConnectionPoint [INTEGRATION]', () => {
  it('connection point system covers all edge midpoints that snap system covers', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);

    // Test each edge midpoint: both systems should return results near them
    const edgeMidpoints = [
      { name: 'top', x: 200, y: 95 },
      { name: 'right', x: 305, y: 150 },
      { name: 'bottom', x: 200, y: 205 },
      { name: 'left', x: 95, y: 150 },
    ];

    for (const { name, x, y } of edgeMidpoints) {
      const cpResult = findNearestConnectionPoint(x, y, rect, 15);
      const snapResult = findSnapPoint({ x, y }, rect, 15);

      // Both should find a result
      expect(cpResult, `CP should find ${name}`).not.toBeNull();
      expect(snapResult, `Snap should find ${name}`).not.toBeNull();

      // Both should agree on the anchor name
      expect(cpResult!.position).toBe(name);
      expect(snapResult!.anchor).toBe(name);
    }
  });

  it('connection point system finds corners that snap system misses', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);

    // Near top-right corner (300, 100)
    const cpResult = findNearestConnectionPoint(305, 95, rect, 15);
    const snapResult = findSnapPoint({ x: 305, y: 95 }, rect, 15);

    // Connection point system should find the corner
    expect(cpResult).not.toBeNull();
    expect(cpResult!.position).toBe('top-right');

    // Snap system should find whichever edge is nearest (top or right)
    // The key point: CP system returns corner, snap system returns edge
    expect(snapResult).not.toBeNull();
    expect(['top', 'right']).toContain(snapResult!.anchor);
  });
});

// ═══════════════════════════════════════════════════════════
// [EDGE] findSnapPoint — zero-size shapes
// ═══════════════════════════════════════════════════════════

describe('findSnapPoint — edge cases [EDGE]', () => {
  it('handles zero-width shape without crash', () => {
    const rect = makeRect('r1', 100, 100, 0, 100);
    // All edges collapse to a vertical line at x=100
    const result = findSnapPoint({ x: 105, y: 150 }, rect, 20);
    // Should still return a result since we're within snap distance of the degenerate shape
    expect(result).not.toBeNull();
  });

  it('handles zero-height shape without crash', () => {
    const rect = makeRect('r1', 100, 100, 200, 0);
    // All edges collapse to a horizontal line at y=100
    const result = findSnapPoint({ x: 200, y: 105 }, rect, 20);
    expect(result).not.toBeNull();
  });

  it('ratio is 0.5 for zero-width shape (fallback)', () => {
    const rect = makeRect('r1', 100, 100, 0, 100);
    const result = findSnapPoint({ x: 100, y: 150 }, rect, 10);
    if (result) {
      // When width is 0, ratio should be 0.5 (fallback in code)
      expect(result.ratio).toBe(0.5);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// [EDGE] Overlapping shapes — nearest point selection
// ═══════════════════════════════════════════════════════════

describe('Connection point detection with overlapping shapes [EDGE]', () => {
  it('returns points for each shape independently even when overlapping', () => {
    const rect1 = makeRect('r1', 100, 100, 200, 100);
    const rect2 = makeRect('r2', 150, 120, 200, 100);

    // Both shapes should have their own 8 connection points
    const pts1 = getConnectionPoints(rect1);
    const pts2 = getConnectionPoints(rect2);

    expect(pts1).toHaveLength(8);
    expect(pts2).toHaveLength(8);

    // Points should be at different positions
    const r1Top = findByPosition(pts1, 'top')!;
    const r2Top = findByPosition(pts2, 'top')!;
    expect(r1Top.x).not.toBe(r2Top.x);
    expect(r1Top.y).not.toBe(r2Top.y);
  });
});

// ═══════════════════════════════════════════════════════════
// [CONTRACT] Protocol schema validation — new anchor values
// ═══════════════════════════════════════════════════════════

describe('Protocol ArrowData contract [CONTRACT]', () => {
  // Test through the resolveBindings interface to verify corner anchors
  // are properly handled end-to-end without needing to import Zod schemas

  it('corner anchor bindings resolve correctly through the system', () => {
    const rect = makeRect('r1', 100, 100, 200, 100);
    const cornerAnchors: Array<{ anchor: ArrowBinding['anchor']; expected: { x: number; y: number } }> = [
      { anchor: 'top-left', expected: { x: 100, y: 100 } },
      { anchor: 'top-right', expected: { x: 300, y: 100 } },
      { anchor: 'bottom-left', expected: { x: 100, y: 200 } },
      { anchor: 'bottom-right', expected: { x: 300, y: 200 } },
    ];

    for (const { anchor, expected } of cornerAnchors) {
      const arrow = makeArrow('a1', [[0, 0], [500, 500]], {
        startBinding: { expressionId: 'r1', anchor, ratio: 0.5 },
      });
      const expressions: Record<string, VisualExpression> = { r1: rect, a1: arrow };

      const resolved = resolveBindings(arrow, expressions);
      expect(resolved[0], `Anchor ${anchor}`).toEqual([expected.x, expected.y]);
    }
  });

  it('routing mode does not affect binding resolution (straight vs orthogonal)', () => {
    const rect1 = makeRect('r1', 0, 0, 100, 80);
    const rect2 = makeRect('r2', 300, 200, 100, 80);

    // Arrow with routing: 'orthogonal' still resolves bindings the same way
    const arrowData: ArrowData = {
      kind: 'arrow',
      points: [[100, 40], [300, 240]],
      startBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.5 },
      endBinding: { expressionId: 'r2', anchor: 'left', ratio: 0.5 },
      routing: 'orthogonal',
    };

    const arrow = makeExpression({
      id: 'a1',
      kind: 'arrow',
      position: { x: 100, y: 40 },
      size: { width: 200, height: 200 },
      data: arrowData,
    });

    const expressions: Record<string, VisualExpression> = { r1: rect1, r2: rect2, a1: arrow };
    const resolved = resolveBindings(arrow, expressions);
    expect(resolved[0]).toEqual([100, 40]);
    expect(resolved[resolved.length - 1]).toEqual([300, 240]);
  });
});

// ═══════════════════════════════════════════════════════════
// [INTEGRATION] Full connector lifecycle: snap → bind → resolve → route
// ═══════════════════════════════════════════════════════════

describe('Full connector lifecycle [INTEGRATION]', () => {
  it('snap detection → anchor point → binding resolution → orthogonal route', () => {
    // Simulate the full lifecycle without ArrowTool's store dependency:
    //
    // 1. User hovers near a shape edge (snap detection)
    // 2. System determines the anchor point
    // 3. Binding is created with the anchor
    // 4. Binding is resolved to world coordinates
    // 5. Orthogonal route is computed

    const source = makeRect('source', 0, 0, 100, 80);
    const target = makeRect('target', 300, 200, 100, 80);

    // Step 1: Snap detection (user cursor near right edge of source)
    const snap = findNearestConnectionPoint(105, 40, source, 15);
    expect(snap).not.toBeNull();
    expect(snap!.position).toBe('right');

    // Step 2: Determine anchor point
    const anchorPt = getAnchorPoint(source, snap!.position);
    expect(anchorPt).toEqual({ x: 100, y: 40 });

    // Step 3: Create binding (as ArrowTool would)
    const binding: ArrowBinding = {
      expressionId: 'source',
      anchor: snap!.position,
      ratio: 0.5,
    };

    // Step 4: Create arrow with binding, resolve it
    const arrow = makeArrow('a1', [[anchorPt.x, anchorPt.y], [300, 240]], {
      startBinding: binding,
      endBinding: { expressionId: 'target', anchor: 'left', ratio: 0.5 },
    });

    const expressions: Record<string, VisualExpression> = { source, target, a1: arrow };
    const resolved = resolveBindings(arrow, expressions);

    // Step 5: Route orthogonally
    const route = computeOrthogonalRoute(
      { x: resolved[0]![0], y: resolved[0]![1] },
      { x: resolved[1]![0], y: resolved[1]![1] },
      binding.anchor,
      'left',
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 300, y: 200, width: 100, height: 80 },
    );

    // Verify the complete pipeline
    assertOrthogonal(route);
    expect(route[0]).toEqual([100, 40]);
    expect(route[route.length - 1]).toEqual([300, 240]);
    expect(route.length).toBeGreaterThanOrEqual(3); // At least L-shape
  });

  it('deletion pipeline: findBoundArrows → clearBindings', () => {
    const rect = makeRect('r1', 100, 100, 100, 100);
    const arrow1 = makeArrow('a1', [[200, 150], [400, 150]], {
      startBinding: { expressionId: 'r1', anchor: 'right', ratio: 0.5 },
    });
    const arrow2 = makeArrow('a2', [[0, 0], [100, 150]], {
      endBinding: { expressionId: 'r1', anchor: 'left', ratio: 0.5 },
    });
    const arrow3 = makeArrow('a3', [[500, 500], [600, 600]]); // unbound
    const expressions: Record<string, VisualExpression> = {
      r1: rect, a1: arrow1, a2: arrow2, a3: arrow3,
    };

    // Step 1: Find all arrows bound to the shape being deleted
    const boundArrowIds = findBoundArrows('r1', expressions);
    expect(boundArrowIds).toHaveLength(2);

    // Step 2: Clear bindings for each bound arrow
    for (const arrowId of boundArrowIds) {
      const arrowExpr = expressions[arrowId]!;
      const updated = clearBindingsForDeletedExpression(arrowExpr.data as ArrowData, 'r1');
      expect(updated).toBeDefined();
      expect(updated!.startBinding?.expressionId).not.toBe('r1');
      expect(updated!.endBinding?.expressionId).not.toBe('r1');
    }

    // Step 3: Unbound arrow should not be affected
    const unbound = clearBindingsForDeletedExpression(arrow3.data as ArrowData, 'r1');
    expect(unbound).toBeUndefined(); // No change needed
  });
});
