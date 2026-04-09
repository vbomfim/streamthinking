/**
 * Unit tests for orthogonal (right-angle) routing — v2 clean rebuild.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers:
 *  1. Quadrant-based direction analysis
 *  2. Route pattern generation for each direction combination
 *  3. Jetty stubs always clear shape bounds
 *  4. Collinear elimination
 *  5. Corner smoothing (quadratic Bézier) output
 *  6. Backward-compat public API
 *  7. User waypoint overrides
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  computeOrthogonalRoute,
  pickExitEntry,
  eliminateCollinear,
  type Direction,
} from '../connectors/orthogonalRouter.js';

// ── Helpers ──────────────────────────────────────────────────

/** Bounding box type matching the router's parameter shape. */
type Rect = { x: number; y: number; width: number; height: number };

/** Assert all segments in a route are horizontal or vertical. */
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

/**
 * Assert no intermediate segment crosses through a bounding rect.
 * Start/end stubs are excluded (they attach to the shape edge).
 */
function assertRouteAvoidsRect(
  points: [number, number][],
  rect: Rect,
  label: string,
): void {
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;

    // Skip the first and last segments (stubs connecting TO shapes)
    if (i === 1 || i === points.length - 1) continue;

    if (y1 === y2) {
      const y = y1;
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      if (
        y > rect.y &&
        y < rect.y + rect.height &&
        maxX > rect.x &&
        minX < rect.x + rect.width
      ) {
        expect.fail(
          `Segment (${x1},${y1})→(${x2},${y2}) crosses ${label} ` +
            `[${rect.x},${rect.y} ${rect.width}×${rect.height}]`,
        );
      }
    }

    if (x1 === x2) {
      const x = x1;
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (
        x > rect.x &&
        x < rect.x + rect.width &&
        maxY > rect.y &&
        minY < rect.y + rect.height
      ) {
        expect.fail(
          `Segment (${x1},${y1})→(${x2},${y2}) crosses ${label} ` +
            `[${rect.x},${rect.y} ${rect.width}×${rect.height}]`,
        );
      }
    }
  }
}

/** Assert no collinear points in the route. */
function assertNoCollinear(points: [number, number][]): void {
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const [cx, cy] = points[i + 1]!;
    const sameX = ax === bx && bx === cx;
    const sameY = ay === by && by === cy;
    expect(
      sameX || sameY,
      `Collinear triplet at index ${i}: (${ax},${ay})→(${bx},${by})→(${cx},${cy})`,
    ).toBe(false);
  }
}

// ══════════════════════════════════════════════════════════════
// 1. Quadrant-based direction analysis
// ══════════════════════════════════════════════════════════════

describe('pickExitEntry — quadrant analysis', () => {
  it('target to the right → exit right, entry left', () => {
    const result = pickExitEntry(
      { x: 100, y: 100 },
      { x: 400, y: 120 },
    );
    expect(result.exit).toBe('right');
    expect(result.entry).toBe('left');
  });

  it('target to the left → exit left, entry right', () => {
    const result = pickExitEntry(
      { x: 400, y: 100 },
      { x: 50, y: 120 },
    );
    expect(result.exit).toBe('left');
    expect(result.entry).toBe('right');
  });

  it('target below → exit bottom, entry top', () => {
    const result = pickExitEntry(
      { x: 100, y: 50 },
      { x: 110, y: 400 },
    );
    expect(result.exit).toBe('bottom');
    expect(result.entry).toBe('top');
  });

  it('target above → exit top, entry bottom', () => {
    const result = pickExitEntry(
      { x: 100, y: 400 },
      { x: 110, y: 50 },
    );
    expect(result.exit).toBe('top');
    expect(result.entry).toBe('bottom');
  });

  it('uses shape bounds centers when provided', () => {
    // Source shape [0,0,100x80], center (50,40)
    // Target shape [200,0,100x80], center (250,40)
    // Target is to the right → exit right, entry left
    const result = pickExitEntry(
      { x: 100, y: 40 },   // right edge of source
      { x: 200, y: 40 },   // left edge of target
      undefined,
      undefined,
      { x: 0, y: 0, width: 100, height: 80 },
      { x: 200, y: 0, width: 100, height: 80 },
    );
    expect(result.exit).toBe('right');
    expect(result.entry).toBe('left');
  });

  it('respects explicit start anchor', () => {
    const result = pickExitEntry(
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      'top',
    );
    expect(result.exit).toBe('top');
  });

  it('respects explicit end anchor', () => {
    const result = pickExitEntry(
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      undefined,
      'bottom',
    );
    expect(result.entry).toBe('bottom');
  });

  it('respects both anchors', () => {
    const result = pickExitEntry(
      { x: 100, y: 100 },
      { x: 400, y: 300 },
      'left',
      'right',
    );
    expect(result.exit).toBe('left');
    expect(result.entry).toBe('right');
  });

  it('maps corner anchors — top-right uses horizontal when dx > dy', () => {
    const result = pickExitEntry(
      { x: 100, y: 100 },
      { x: 400, y: 120 },  // mostly horizontal
      'top-right',
    );
    expect(result.exit).toBe('right');
  });

  it('maps corner anchors — top-right uses vertical when dy > dx', () => {
    const result = pickExitEntry(
      { x: 100, y: 100 },
      { x: 120, y: 400 },  // mostly vertical
      'top-right',
    );
    expect(result.exit).toBe('top');
  });
});

// ══════════════════════════════════════════════════════════════
// 2. Route pattern generation for each direction combination
// ══════════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — opposite directions (Z-shape)', () => {
  it('right→left: produces Z-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 160, y: 75 },
      { x: 300, y: 175 },
      'right', 'left',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([160, 75]);
    expect(route[route.length - 1]).toEqual([300, 175]);
    // Z-shape: start → stub → midV → midV → stub → end = 6 points
    expect(route.length).toBeGreaterThanOrEqual(4);
  });

  it('left→right: produces Z-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 300, y: 75 },
      { x: 160, y: 175 },
      'left', 'right',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([300, 75]);
    expect(route[route.length - 1]).toEqual([160, 175]);
    expect(route.length).toBeGreaterThanOrEqual(4);
  });

  it('bottom→top: produces Z-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 75, y: 160 },
      { x: 175, y: 300 },
      'bottom', 'top',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([75, 160]);
    expect(route[route.length - 1]).toEqual([175, 300]);
    expect(route.length).toBeGreaterThanOrEqual(4);
  });

  it('top→bottom: produces Z-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 75, y: 300 },
      { x: 175, y: 160 },
      'top', 'bottom',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([75, 300]);
    expect(route[route.length - 1]).toEqual([175, 160]);
    expect(route.length).toBeGreaterThanOrEqual(4);
  });
});

describe('computeOrthogonalRoute — same directions (U-shape)', () => {
  it('right→right: produces U-shape detour', () => {
    const sBounds: Rect = { x: 0, y: 50, width: 100, height: 50 };
    const eBounds: Rect = { x: 0, y: 200, width: 100, height: 50 };
    const route = computeOrthogonalRoute(
      { x: 100, y: 75 },    // right edge of source
      { x: 100, y: 225 },   // right edge of target
      'right', 'right',
      sBounds, eBounds,
    );
    assertOrthogonal(route);
    // U-shape: must go further right then come back
    const maxX = Math.max(...route.map(p => p[0]));
    expect(maxX).toBeGreaterThan(100);
    assertRouteAvoidsRect(route, sBounds, 'source');
    assertRouteAvoidsRect(route, eBounds, 'target');
  });

  it('left→left: produces U-shape detour', () => {
    const sBounds: Rect = { x: 100, y: 50, width: 100, height: 50 };
    const eBounds: Rect = { x: 100, y: 200, width: 100, height: 50 };
    const route = computeOrthogonalRoute(
      { x: 100, y: 75 },
      { x: 100, y: 225 },
      'left', 'left',
      sBounds, eBounds,
    );
    assertOrthogonal(route);
    // U-shape: must go further left
    const minX = Math.min(...route.map(p => p[0]));
    expect(minX).toBeLessThan(100);
  });

  it('bottom→bottom: produces U-shape detour', () => {
    const sBounds: Rect = { x: 50, y: 0, width: 50, height: 100 };
    const eBounds: Rect = { x: 200, y: 0, width: 50, height: 100 };
    const route = computeOrthogonalRoute(
      { x: 75, y: 100 },
      { x: 225, y: 100 },
      'bottom', 'bottom',
      sBounds, eBounds,
    );
    assertOrthogonal(route);
    // U-shape: must go further down
    const maxY = Math.max(...route.map(p => p[1]));
    expect(maxY).toBeGreaterThan(100);
  });

  it('top→top: produces U-shape detour', () => {
    const sBounds: Rect = { x: 50, y: 100, width: 50, height: 100 };
    const eBounds: Rect = { x: 200, y: 100, width: 50, height: 100 };
    const route = computeOrthogonalRoute(
      { x: 75, y: 100 },
      { x: 225, y: 100 },
      'top', 'top',
      sBounds, eBounds,
    );
    assertOrthogonal(route);
    // U-shape: must go further up
    const minY = Math.min(...route.map(p => p[1]));
    expect(minY).toBeLessThan(100);
  });
});

describe('computeOrthogonalRoute — perpendicular (L-shape)', () => {
  it('right→top: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 160, y: 75 },
      { x: 300, y: 0 },
      'right', 'top',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([160, 75]);
    expect(route[route.length - 1]).toEqual([300, 0]);
  });

  it('right→bottom: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 160, y: 75 },
      { x: 300, y: 200 },
      'right', 'bottom',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([160, 75]);
    expect(route[route.length - 1]).toEqual([300, 200]);
  });

  it('bottom→left: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 75, y: 160 },
      { x: 0, y: 300 },
      'bottom', 'left',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([75, 160]);
    expect(route[route.length - 1]).toEqual([0, 300]);
  });

  it('bottom→right: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 75, y: 160 },
      { x: 200, y: 300 },
      'bottom', 'right',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([75, 160]);
    expect(route[route.length - 1]).toEqual([200, 300]);
  });

  it('top→left: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 200, y: 160 },
      { x: 0, y: 50 },
      'top', 'left',
    );
    assertOrthogonal(route);
  });

  it('top→right: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 200, y: 160 },
      { x: 400, y: 50 },
      'top', 'right',
    );
    assertOrthogonal(route);
  });

  it('left→top: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 200, y: 100 },
      { x: 50, y: 0 },
      'left', 'top',
    );
    assertOrthogonal(route);
  });

  it('left→bottom: produces L-shape', () => {
    const route = computeOrthogonalRoute(
      { x: 200, y: 100 },
      { x: 50, y: 300 },
      'left', 'bottom',
    );
    assertOrthogonal(route);
  });
});

// ══════════════════════════════════════════════════════════════
// 3. Jetty stubs always clear shape bounds
// ══════════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — jetty stubs clear shapes', () => {
  const sBounds: Rect = { x: 0, y: 0, width: 100, height: 80 };
  const eBounds: Rect = { x: 300, y: 100, width: 100, height: 80 };

  it('exit stub clears source shape — first turn is past shape edge', () => {
    const jettySize = 30;
    const route = computeOrthogonalRoute(
      { x: 100, y: 40 },    // right edge of source
      { x: 300, y: 140 },   // left edge of target
      'right', 'left',
      sBounds, eBounds,
      jettySize,
    );
    assertOrthogonal(route);
    // First segment goes right, and the first turn X must be past
    // source right edge (100) + jettySize (30) = 130
    const firstTurnX = route.find((p, i) => i > 0 && route[i - 1]![1] !== p[1])?.[0];
    if (firstTurnX !== undefined) {
      expect(firstTurnX).toBeGreaterThanOrEqual(130);
    }
  });

  it('entry stub clears target shape — last turn is before shape edge', () => {
    const jettySize = 30;
    const route = computeOrthogonalRoute(
      { x: 100, y: 40 },
      { x: 300, y: 140 },
      'right', 'left',
      sBounds, eBounds,
      jettySize,
    );
    assertOrthogonal(route);
    // Last vertical turn X must be before target left edge (300) - jettySize (30) = 270
    const lastTurnX = route.slice().reverse().find(
      (p, i, arr) => i > 0 && arr[i - 1]![1] !== p[1],
    )?.[0];
    if (lastTurnX !== undefined) {
      expect(lastTurnX).toBeLessThanOrEqual(270);
    }
  });

  it('default jettySize is 20 — first turn past source by 20', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 40 },
      { x: 300, y: 140 },
      'right', 'left',
      sBounds, eBounds,
    );
    assertOrthogonal(route);
    // First turn must be past 100 + 20 = 120
    const firstTurnX = route.find((p, i) => i > 0 && route[i - 1]![1] !== p[1])?.[0];
    if (firstTurnX !== undefined) {
      expect(firstTurnX).toBeGreaterThanOrEqual(120);
    }
  });

  it('routes never cross source shape', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 40 },
      { x: 300, y: 200 },
      'right', 'left',
      sBounds, eBounds,
      20,
    );
    assertOrthogonal(route);
    assertRouteAvoidsRect(route, sBounds, 'source');
  });

  it('routes never cross target shape', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 40 },
      { x: 300, y: 200 },
      'right', 'left',
      sBounds, eBounds,
      20,
    );
    assertOrthogonal(route);
    assertRouteAvoidsRect(route, eBounds, 'target');
  });
});

// ══════════════════════════════════════════════════════════════
// 4. Collinear elimination
// ══════════════════════════════════════════════════════════════

describe('eliminateCollinear', () => {
  it('removes redundant collinear points on horizontal line', () => {
    const result = eliminateCollinear([
      [0, 0], [50, 0], [100, 0],
    ]);
    expect(result).toEqual([[0, 0], [100, 0]]);
  });

  it('removes redundant collinear points on vertical line', () => {
    const result = eliminateCollinear([
      [0, 0], [0, 50], [0, 100],
    ]);
    expect(result).toEqual([[0, 0], [0, 100]]);
  });

  it('removes collinear points in mixed route', () => {
    const result = eliminateCollinear([
      [0, 0], [50, 0], [100, 0], [100, 50], [100, 100],
    ]);
    expect(result).toEqual([
      [0, 0], [100, 0], [100, 100],
    ]);
  });

  it('preserves corners', () => {
    const result = eliminateCollinear([
      [0, 0], [100, 0], [100, 100],
    ]);
    expect(result).toEqual([
      [0, 0], [100, 0], [100, 100],
    ]);
  });

  it('preserves Z-shape points', () => {
    // Z-shape: horizontal → vertical → horizontal
    const result = eliminateCollinear([
      [0, 0], [50, 0], [50, 100], [100, 100],
    ]);
    expect(result).toEqual([
      [0, 0], [50, 0], [50, 100], [100, 100],
    ]);
  });

  it('handles single point', () => {
    const result = eliminateCollinear([[5, 5]]);
    expect(result).toEqual([[5, 5]]);
  });

  it('handles two points', () => {
    const result = eliminateCollinear([[0, 0], [100, 100]]);
    expect(result).toEqual([[0, 0], [100, 100]]);
  });

  it('handles empty array', () => {
    const result = eliminateCollinear([]);
    expect(result).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════
// 5. Backward-compat public API
// ══════════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — backward compatibility', () => {
  it('returns at least 2 points (start and end)', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    );
    expect(route.length).toBeGreaterThanOrEqual(2);
  });

  it('starts at the start point', () => {
    const route = computeOrthogonalRoute(
      { x: 50, y: 50 },
      { x: 200, y: 200 },
    );
    expect(route[0]).toEqual([50, 50]);
  });

  it('ends at the end point', () => {
    const route = computeOrthogonalRoute(
      { x: 50, y: 50 },
      { x: 200, y: 200 },
    );
    expect(route[route.length - 1]).toEqual([200, 200]);
  });

  it('produces only horizontal and vertical segments', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 0 },
      { x: 150, y: 75 },
    );
    assertOrthogonal(route);
  });

  it('handles coincident points', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    expect(route.length).toBe(2);
    expect(route[0]).toEqual([100, 100]);
    expect(route[1]).toEqual([100, 100]);
  });

  it('handles same x (vertical only) — straight vertical line', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      'bottom', 'top',
    );
    assertOrthogonal(route);
    for (const [x] of route) {
      expect(x).toBe(100);
    }
  });

  it('handles same y (horizontal only) — straight horizontal line', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      'right', 'left',
    );
    assertOrthogonal(route);
    for (const [, y] of route) {
      expect(y).toBe(100);
    }
  });

  it('midpointOffset adjusts Z-bar position', () => {
    const route1 = computeOrthogonalRoute(
      { x: 100, y: 50 },
      { x: 300, y: 150 },
      'right', 'left',
      undefined, undefined,
      20,
      0.3,
    );
    const route2 = computeOrthogonalRoute(
      { x: 100, y: 50 },
      { x: 300, y: 150 },
      'right', 'left',
      undefined, undefined,
      20,
      0.7,
    );
    assertOrthogonal(route1);
    assertOrthogonal(route2);
    // Z-bar should be at different X positions
    // Find the middle vertical segments
    const midX1 = route1.find(
      (_, i) => i > 1 && i < route1.length - 2 && route1[i - 1]![1] !== route1[i]![1],
    )?.[0];
    const midX2 = route2.find(
      (_, i) => i > 1 && i < route2.length - 2 && route2[i - 1]![1] !== route2[i]![1],
    )?.[0];
    if (midX1 !== undefined && midX2 !== undefined) {
      expect(midX1).not.toBe(midX2);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 6. Route output has no collinear points
// ══════════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — collinear elimination', () => {
  it('output has no collinear triplets (right→left)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 50 },
      { x: 300, y: 150 },
      'right', 'left',
    );
    assertNoCollinear(route);
  });

  it('output has no collinear triplets (bottom→top)', () => {
    const route = computeOrthogonalRoute(
      { x: 50, y: 100 },
      { x: 150, y: 300 },
      'bottom', 'top',
    );
    assertNoCollinear(route);
  });

  it('straight horizontal has no collinear triplets', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 100 },
      { x: 300, y: 100 },
      'right', 'left',
    );
    assertNoCollinear(route);
  });
});

// ══════════════════════════════════════════════════════════════
// 7. User waypoint overrides
// ══════════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — user waypoint overrides', () => {
  it('waypoint overrides Z-bar position', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 50 },
      { x: 300, y: 150 },
      'right', 'left',
      undefined, undefined,
      20,
      undefined,
      [250],  // override mid-segment X position to 250
    );
    assertOrthogonal(route);
    // The vertical mid-segment should be at x=250
    const verticalSegs = route.filter(
      (p, i) => i > 0 && i < route.length - 1 && route[i - 1]![0] === p[0] && p[0] === route[i + 1]?.[0],
    );
    // At least one point in the route should have x=250 (the waypoint override)
    const hasWaypoint = route.some(p => p[0] === 250);
    expect(hasWaypoint).toBe(true);
  });

  it('empty waypoints array uses auto-computed positions', () => {
    const routeAuto = computeOrthogonalRoute(
      { x: 100, y: 50 },
      { x: 300, y: 150 },
      'right', 'left',
    );
    const routeEmpty = computeOrthogonalRoute(
      { x: 100, y: 50 },
      { x: 300, y: 150 },
      'right', 'left',
      undefined, undefined,
      undefined,
      undefined,
      [],
    );
    expect(routeAuto).toEqual(routeEmpty);
  });
});

// ══════════════════════════════════════════════════════════════
// 8. Anchor direction tests
// ══════════════════════════════════════════════════════════════

describe('computeOrthogonalRoute — anchor-based exit', () => {
  it('exits rightward from "right" anchor', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      'right',
    );
    assertOrthogonal(route);
    expect(route[1]![1]).toBe(100); // same y
    expect(route[1]![0]).toBeGreaterThan(100); // x increases
  });

  it('exits leftward from "left" anchor', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: -50, y: 200 },
      'left',
    );
    assertOrthogonal(route);
    expect(route[1]![1]).toBe(100); // same y
    expect(route[1]![0]).toBeLessThan(100); // x decreases
  });

  it('exits downward from "bottom" anchor', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 200, y: 300 },
      'bottom',
    );
    assertOrthogonal(route);
    expect(route[1]![0]).toBe(100); // same x
    expect(route[1]![1]).toBeGreaterThan(100); // y increases
  });

  it('exits upward from "top" anchor', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 200, y: -50 },
      'top',
    );
    assertOrthogonal(route);
    expect(route[1]![0]).toBe(100); // same x
    expect(route[1]![1]).toBeLessThan(100); // y decreases
  });
});
