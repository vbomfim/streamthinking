/**
 * Unit tests for computeSelfLoopPath — self-loop routing helper.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers:
 *  1. Curved/straight/undefined routing → returns 2 points with isCurved=true
 *  2. Orthogonal routing → right-angle loop with 4 points, isCurved=false
 *  3. Elbow routing → same as orthogonal for self-loops
 *  4. Loop direction — outward from shape center
 *  5. jettySize controls how far the loop extends
 *  6. Fallback when target is undefined
 *  7. All segments in orthogonal loop are axis-aligned
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { computeSelfLoopPath } from '../connectors/orthogonalRouter.js';
import {
  getSelfLoopHandlePosition,
  getJettyHandlePosition,
  getSegmentMidpointHandles,
} from '../interaction/manipulationHelpers.js';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';

// ── Helpers ──────────────────────────────────────────────────

/** Shape target for testing — a 100x80 rectangle at (200, 100). */
const TARGET_SHAPE = {
  position: { x: 200, y: 100 },
  size: { width: 100, height: 80 },
};

/** Assert all segments in a path are horizontal or vertical. */
function assertOrthogonal(points: [number, number][]): void {
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;
    const isHorizontal = y1 === y2;
    const isVertical = x1 === x2;
    expect(
      isHorizontal || isVertical,
      `Segment ${i - 1}→${i} is diagonal: (${x1},${y1})→(${x2},${y2})`,
    ).toBe(true);
  }
}

// ══════════════════════════════════════════════════════════════
// 1. Curved / straight / undefined routing → bezier passthrough
// ══════════════════════════════════════════════════════════════

describe('computeSelfLoopPath — curved routing', () => {
  it('returns start and end with isCurved=true for undefined routing', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, undefined, TARGET_SHAPE, 30);

    expect(result.isCurved).toBe(true);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual(start);
    expect(result.points[1]).toEqual(end);
  });

  it('returns start and end with isCurved=true for straight routing', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'straight', TARGET_SHAPE, 30);

    expect(result.isCurved).toBe(true);
    expect(result.points).toHaveLength(2);
  });

  it('returns start and end with isCurved=true for curved routing', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'curved', TARGET_SHAPE, 30);

    expect(result.isCurved).toBe(true);
    expect(result.points).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════════════════════
// 2. Orthogonal routing → right-angle loop
// ══════════════════════════════════════════════════════════════

describe('computeSelfLoopPath — orthogonal routing', () => {
  it('returns 4 points with isCurved=false', () => {
    // Start and end on the right side of the shape
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    expect(result.isCurved).toBe(false);
    expect(result.points).toHaveLength(4);
  });

  it('starts at start point and ends at end point', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    expect(result.points[0]).toEqual(start);
    expect(result.points[result.points.length - 1]).toEqual(end);
  });

  it('produces all horizontal/vertical segments', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    assertOrthogonal(result.points);
  });

  it('loops outward to the right when points are on right edge', () => {
    // Shape center = (250, 140). Points at x=300 are to the right.
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    // The outward X should be max(300, 300) + 30 = 330
    expect(result.points[1]![0]).toBe(330);
    expect(result.points[2]![0]).toBe(330);
    // Y values should match start and end
    expect(result.points[1]![1]).toBe(120);
    expect(result.points[2]![1]).toBe(160);
  });

  it('loops outward to the left when points are on left edge', () => {
    // Points at x=200, shape center x=250 → left side
    const start: [number, number] = [200, 120];
    const end: [number, number] = [200, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    // The outward X should be min(200, 200) - 30 = 170
    expect(result.points[1]![0]).toBe(170);
    expect(result.points[2]![0]).toBe(170);
  });

  it('loops outward upward when points are on top edge', () => {
    // Points at y=100, shape center y=140 → top side
    const start: [number, number] = [220, 100];
    const end: [number, number] = [280, 100];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    // The outward Y should be min(100, 100) - 30 = 70
    expect(result.points[1]![1]).toBe(70);
    expect(result.points[2]![1]).toBe(70);
    // X values should match start and end
    expect(result.points[1]![0]).toBe(220);
    expect(result.points[2]![0]).toBe(280);
  });

  it('loops outward downward when points are on bottom edge', () => {
    // Points at y=180, shape center y=140 → bottom side
    const start: [number, number] = [220, 180];
    const end: [number, number] = [280, 180];
    const result = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);

    // The outward Y should be max(180, 180) + 30 = 210
    expect(result.points[1]![1]).toBe(210);
    expect(result.points[2]![1]).toBe(210);
  });
});

// ══════════════════════════════════════════════════════════════
// 3. Elbow routing → same as orthogonal for self-loops
// ══════════════════════════════════════════════════════════════

describe('computeSelfLoopPath — elbow routing', () => {
  it('produces orthogonal loop same as orthogonal mode', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const ortho = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 30);
    const elbow = computeSelfLoopPath(start, end, 'elbow', TARGET_SHAPE, 30);

    expect(elbow.isCurved).toBe(false);
    expect(elbow.points).toEqual(ortho.points);
  });
});

// ══════════════════════════════════════════════════════════════
// 4. jettySize controls loop extension
// ══════════════════════════════════════════════════════════════

describe('computeSelfLoopPath — jettySize', () => {
  it('uses jettySize to control how far loop extends', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];

    const small = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 10);
    const large = computeSelfLoopPath(start, end, 'orthogonal', TARGET_SHAPE, 50);

    // Larger jetty → farther outward
    expect(small.points[1]![0]).toBe(310); // 300 + 10
    expect(large.points[1]![0]).toBe(350); // 300 + 50
  });
});

// ══════════════════════════════════════════════════════════════
// 5. Fallback when target is undefined
// ══════════════════════════════════════════════════════════════

describe('computeSelfLoopPath — fallback', () => {
  it('returns curved fallback when target is undefined for orthogonal', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonal', undefined, 30);

    expect(result.isCurved).toBe(true);
    expect(result.points).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════════════════════
// 6. orthogonalCurved routing → same as orthogonal for self-loops
// ══════════════════════════════════════════════════════════════

describe('computeSelfLoopPath — orthogonalCurved routing', () => {
  it('produces orthogonal loop for orthogonalCurved mode', () => {
    const start: [number, number] = [300, 120];
    const end: [number, number] = [300, 160];
    const result = computeSelfLoopPath(start, end, 'orthogonalCurved', TARGET_SHAPE, 30);

    expect(result.isCurved).toBe(false);
    expect(result.points).toHaveLength(4);
    assertOrthogonal(result.points);
  });
});

// ══════════════════════════════════════════════════════════════
// 7. Self-loop handle position
// ══════════════════════════════════════════════════════════════

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

/** Target shape for handle tests — 100x80 at (200, 100). */
const HANDLE_TARGET: VisualExpression = {
  id: 'shape-1',
  kind: 'rectangle',
  position: { x: 200, y: 100 },
  size: { width: 100, height: 80 },
  angle: 0,
  style: DEFAULT_STYLE,
  meta: DEFAULT_META,
  data: { kind: 'rectangle' },
};

/** Create a self-loop arrow expression. */
function makeSelfLoopArrow(
  points: [number, number][],
  routing: string | undefined,
  jettySize?: number,
): VisualExpression {
  return {
    id: 'arrow-1',
    kind: 'arrow',
    position: { x: 0, y: 0 },
    size: { width: 1, height: 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: {
      kind: 'arrow',
      points,
      routing,
      jettySize,
      startBinding: { expressionId: 'shape-1', anchor: 'right' as const },
      endBinding: { expressionId: 'shape-1', anchor: 'right' as const },
    },
  };
}

const EXPRESSIONS: Record<string, VisualExpression> = {
  'shape-1': HANDLE_TARGET,
};

describe('getSelfLoopHandlePosition', () => {
  it('returns handle for orthogonal self-loop on right side', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 30);
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);

    expect(handle).not.toBeNull();
    // Handle at midpoint of outer segment: x=330, y=140
    expect(handle!.position.x).toBe(330);
    expect(handle!.position.y).toBe(140);
    // Direction is outward (right): x=1
    expect(handle!.direction.x).toBeGreaterThan(0);
    expect(handle!.direction.y).toBe(0);
    // Outer segment is vertical → ew-resize
    expect(handle!.segmentOrientation).toBe('vertical');
    // Adjusts jettySize, not midpointOffset
    expect(handle!.adjustsMidpoint).toBe(false);
  });

  it('returns handle for orthogonal self-loop on top side', () => {
    const arrow = makeSelfLoopArrow([[220, 100], [280, 100]], 'orthogonal', 30);
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);

    expect(handle).not.toBeNull();
    // Outer segment is horizontal at y=70, midpoint x=250
    expect(handle!.position.x).toBe(250);
    expect(handle!.position.y).toBe(70);
    // Direction is outward (up): y=-1
    expect(handle!.direction.x).toBe(0);
    expect(handle!.direction.y).toBeLessThan(0);
    // Outer segment is horizontal → ns-resize
    expect(handle!.segmentOrientation).toBe('horizontal');
  });

  it('returns handle for elbow self-loop', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'elbow', 30);
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);

    expect(handle).not.toBeNull();
    expect(handle!.position.x).toBe(330);
  });

  it('returns null for curved self-loop', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'curved', 30);
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);

    expect(handle).toBeNull();
  });

  it('returns null for straight self-loop', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'straight', 30);
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);

    expect(handle).toBeNull();
  });

  it('returns null for undefined routing self-loop', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], undefined, 30);
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);

    expect(handle).toBeNull();
  });

  it('returns null for non-self-loop arrow', () => {
    const arrow: VisualExpression = {
      id: 'arrow-2',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points: [[0, 0], [100, 100]] as [number, number][],
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape-1', anchor: 'right' as const },
        endBinding: { expressionId: 'shape-2', anchor: 'left' as const },
      },
    };
    const handle = getSelfLoopHandlePosition(arrow, EXPRESSIONS);
    expect(handle).toBeNull();
  });

  it('uses jettySize to position the handle', () => {
    const arrow10 = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 10);
    const arrow50 = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 50);

    const handle10 = getSelfLoopHandlePosition(arrow10, EXPRESSIONS);
    const handle50 = getSelfLoopHandlePosition(arrow50, EXPRESSIONS);

    expect(handle10!.position.x).toBe(310); // 300 + 10
    expect(handle50!.position.x).toBe(350); // 300 + 50
  });
});

// ══════════════════════════════════════════════════════════════
// getJettyHandlePosition — adjustsMidpoint correctness
// ══════════════════════════════════════════════════════════════

describe('getJettyHandlePosition — adjustsMidpoint', () => {
  /**
   * Create a regular (non-self-loop) arrow with specific bindings and routing.
   *
   * anchor pairs:
   * - Z-shape: exits same axis, normal flow (e.g. right→left with end.x > start.x)
   * - L-shape: exits different axes (e.g. right + bottom)
   * - C-shape: exits same axis, reverse flow (e.g. right→left with end.x < start.x)
   */
  function makeArrow(
    points: [number, number][],
    startAnchor: string,
    endAnchor: string,
    opts?: { jettySize?: number; midpointOffset?: number },
  ): VisualExpression {
    return {
      id: 'arrow-test',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points,
        routing: 'orthogonal',
        jettySize: opts?.jettySize ?? 30,
        midpointOffset: opts?.midpointOffset,
        startBinding: { expressionId: 'shape-1', anchor: startAnchor },
        endBinding: { expressionId: 'shape-2', anchor: endAnchor },
      },
    };
  }

  it('returns adjustsMidpoint=true for Z-shape (horizontal, normal flow)', () => {
    // Start exits right (anchor='right'), end exits left (anchor='left')
    // start=(100, 200), end=(300, 250) → exit right, entry left, normal Z
    const arrow = makeArrow(
      [[100, 200], [300, 250]],
      'right',
      'left',
    );
    const handle = getJettyHandlePosition(arrow);

    expect(handle).not.toBeNull();
    expect(handle!.adjustsMidpoint).toBe(true);
    expect(handle!.segmentOrientation).toBe('vertical');
  });

  it('returns adjustsMidpoint=true for Z-shape (vertical, normal flow)', () => {
    // Start exits bottom (anchor='bottom'), end exits top (anchor='top')
    // start=(200, 100), end=(250, 300) → exit down, entry up, normal Z
    const arrow = makeArrow(
      [[200, 100], [250, 300]],
      'bottom',
      'top',
    );
    const handle = getJettyHandlePosition(arrow);

    expect(handle).not.toBeNull();
    expect(handle!.adjustsMidpoint).toBe(true);
    expect(handle!.segmentOrientation).toBe('horizontal');
  });

  it('returns adjustsMidpoint=false for L-shape (different axes)', () => {
    // Start exits right (anchor='right'), end exits bottom (anchor='bottom')
    // Different axis exits → not a Z-shape
    const arrow = makeArrow(
      [[100, 200], [300, 100]],
      'right',
      'bottom',
    );
    const handle = getJettyHandlePosition(arrow);

    expect(handle).not.toBeNull();
    expect(handle!.adjustsMidpoint).toBe(false);
  });

  it('returns adjustsMidpoint=false for C-shape (same axis, reverse flow)', () => {
    // Both exit right, but end is to the LEFT of start → reverse flow = C-shape
    // start=(300, 200) exits right, end=(100, 250) exits right
    const arrow = makeArrow(
      [[300, 200], [100, 250]],
      'right',
      'right',
    );
    const handle = getJettyHandlePosition(arrow);

    expect(handle).not.toBeNull();
    expect(handle!.adjustsMidpoint).toBe(false);
  });

  it('Z-shape handle position follows midpointOffset', () => {
    const arrow = makeArrow(
      [[100, 200], [300, 250]],
      'right',
      'left',
      { jettySize: 30, midpointOffset: 0.7 },
    );
    const handle = getJettyHandlePosition(arrow);

    expect(handle).not.toBeNull();
    expect(handle!.adjustsMidpoint).toBe(true);
    // exitStubEnd = 100 + 30 = 130, entryStubEnd = 300 - 30 = 270
    // midX = 130 + (270-130)*0.7 = 130 + 98 = 228
    expect(handle!.position.x).toBeCloseTo(228, 0);
  });

  it('non-Z-shape handle is at exit stub midpoint', () => {
    // L-shape: right exit, bottom entry
    const arrow = makeArrow(
      [[100, 200], [300, 100]],
      'right',
      'bottom',
      { jettySize: 40 },
    );
    const handle = getJettyHandlePosition(arrow);

    expect(handle).not.toBeNull();
    // Exit stub midpoint: x = 100 + 1*20 = 120, y = 200
    expect(handle!.position.x).toBe(120);
    expect(handle!.position.y).toBe(200);
  });

  it('returns null for straight routing', () => {
    const arrow: VisualExpression = {
      id: 'arrow-straight',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points: [[100, 200], [300, 250]] as [number, number][],
        routing: 'straight',
        startBinding: { expressionId: 'shape-1', anchor: 'right' as const },
        endBinding: { expressionId: 'shape-2', anchor: 'left' as const },
      },
    };
    expect(getJettyHandlePosition(arrow)).toBeNull();
  });

  it('returns null for non-arrow expression', () => {
    const rect: VisualExpression = {
      id: 'rect-1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: { kind: 'rectangle' },
    };
    expect(getJettyHandlePosition(rect)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// getSegmentMidpointHandles — limited to first handle only
// ══════════════════════════════════════════════════════════════

describe('getSegmentMidpointHandles — single handle limit', () => {
  /** Create a shape expression for binding. */
  function makeShape(id: string, x: number, y: number, w: number, h: number): VisualExpression {
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

  it('returns at most 1 handle for an orthogonal arrow', () => {
    const shape1 = makeShape('s1', 100, 100, 80, 60);
    const shape2 = makeShape('s2', 400, 300, 80, 60);

    const arrow: VisualExpression = {
      id: 'arrow-seg',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points: [[180, 130], [400, 330]] as [number, number][],
        routing: 'orthogonal',
        jettySize: 30,
        startBinding: { expressionId: 's1', anchor: 'right' as const },
        endBinding: { expressionId: 's2', anchor: 'left' as const },
      },
    };

    const exprs: Record<string, VisualExpression> = {
      s1: shape1,
      s2: shape2,
      'arrow-seg': arrow,
    };

    const handles = getSegmentMidpointHandles(arrow, exprs);
    expect(handles.length).toBeLessThanOrEqual(1);
  });

  it('first handle has segmentIndex=0', () => {
    const shape1 = makeShape('s1', 100, 100, 80, 60);
    const shape2 = makeShape('s2', 400, 300, 80, 60);

    const arrow: VisualExpression = {
      id: 'arrow-seg2',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points: [[180, 130], [400, 330]] as [number, number][],
        routing: 'orthogonal',
        jettySize: 30,
        startBinding: { expressionId: 's1', anchor: 'right' as const },
        endBinding: { expressionId: 's2', anchor: 'left' as const },
      },
    };

    const exprs: Record<string, VisualExpression> = {
      s1: shape1,
      s2: shape2,
      'arrow-seg2': arrow,
    };

    const handles = getSegmentMidpointHandles(arrow, exprs);
    if (handles.length > 0) {
      expect(handles[0]!.segmentIndex).toBe(0);
    }
  });

  it('returns empty for self-loop arrow', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 30);

    const handles = getSegmentMidpointHandles(arrow, EXPRESSIONS);
    expect(handles).toEqual([]);
  });

  it('returns empty for non-orthogonal arrow', () => {
    const arrow: VisualExpression = {
      id: 'arrow-straight2',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points: [[100, 200], [300, 400]] as [number, number][],
        routing: 'straight',
      },
    };
    const handles = getSegmentMidpointHandles(arrow, {});
    expect(handles).toEqual([]);
  });
});
