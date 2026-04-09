/**
 * Unit tests for orthogonal (right-angle) routing algorithm.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers L-shape, Z-shape routing, anchor-based exit direction,
 * shape padding, and exit/entry clearance stubs.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { computeOrthogonalRoute } from '../connectors/orthogonalRouter.js';

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
 * Assert that no INTERMEDIATE segment of the route crosses through
 * the given bounding rectangle. Start and end points are excluded
 * because they sit on the shape edge by design.
 *
 * A segment crosses a rect if both endpoints have x within the
 * rect's x-range AND y within the rect's y-range (for the shared
 * axis of an orthogonal segment, this means the segment cuts
 * through the rect interior).
 */
function assertRouteAvoidsRect(
  points: [number, number][],
  rect: Rect,
  label: string,
): void {
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]!;
    const [x2, y2] = points[i]!;

    // Skip the first segment (starts at shape edge) and last segment
    // (ends at shape edge) — those are the stubs connecting TO the shape.
    if (i === 1 || i === points.length - 1) continue;

    // For a horizontal segment (y1 === y2), check if the y is inside
    // the rect AND the x-range overlaps the rect.
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

    // For a vertical segment (x1 === x2), check if the x is inside
    // the rect AND the y-range overlaps the rect.
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

// ── Basic routing ────────────────────────────────────────────

describe('computeOrthogonalRoute — basic', () => {
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

  it('handles same x (vertical only) — straight vertical line', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    );
    assertOrthogonal(route);
    // All points should share x = 100 (collinear vertical line)
    for (const [x] of route) {
      expect(x).toBe(100);
    }
    expect(route[0]).toEqual([100, 0]);
    expect(route[route.length - 1]).toEqual([100, 200]);
  });

  it('handles same y (horizontal only) — straight horizontal line', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    );
    assertOrthogonal(route);
    // All points should share y = 100 (collinear horizontal line)
    for (const [, y] of route) {
      expect(y).toBe(100);
    }
    expect(route[0]).toEqual([0, 100]);
    expect(route[route.length - 1]).toEqual([200, 100]);
  });
});

// ── Anchor-based exit direction ──────────────────────────────

describe('computeOrthogonalRoute — anchor-based exit', () => {
  it('exits rightward from "right" anchor', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      'right',
    );
    assertOrthogonal(route);
    // First segment should be horizontal (exit right)
    expect(route[1]![1]).toBe(100); // same y as start
    expect(route[1]![0]).toBeGreaterThan(100); // x increases
  });

  it('exits leftward from "left" anchor', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: -50, y: 200 },
      'left',
    );
    assertOrthogonal(route);
    // First segment should be horizontal (exit left)
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
    // First segment should be vertical (exit down)
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
    // First segment should be vertical (exit up)
    expect(route[1]![0]).toBe(100); // same x
    expect(route[1]![1]).toBeLessThan(100); // y decreases
  });
});

// ── L-shape routing ──────────────────────────────────────────

describe('computeOrthogonalRoute — L-shape', () => {
  it('produces L-shape route from right to bottom (target below-right)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 300 },
      'right',
      'top',
    );
    assertOrthogonal(route);
    // Should be: right-exit → horizontal → vertical → target
    expect(route.length).toBeGreaterThanOrEqual(3);
  });

  it('produces L-shape from bottom to left (target below-left)', () => {
    const route = computeOrthogonalRoute(
      { x: 300, y: 100 },
      { x: 100, y: 300 },
      'bottom',
      'right',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Z-shape routing ──────────────────────────────────────────

describe('computeOrthogonalRoute — Z-shape', () => {
  it('produces Z-shape when target is behind the exit direction', () => {
    // Exit right from (100, 100) but target is at (50, 200) — to the left
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 50, y: 200 },
      'right',
      'left',
    );
    assertOrthogonal(route);
    // Should have intermediate segments
    expect(route.length).toBeGreaterThanOrEqual(4);
  });

  it('produces Z-shape with both vertical exits (down→down)', () => {
    // Both exit downward — Z-shape with horizontal middle
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 300 },
      'bottom',
      'bottom',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(4);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([300, 300]);
  });

  it('produces Z-shape with both vertical exits (up→up)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 300 },
      { x: 300, y: 100 },
      'top',
      'top',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(4);
    expect(route[0]).toEqual([100, 300]);
    expect(route[route.length - 1]).toEqual([300, 100]);
  });

  it('produces Z-shape with both horizontal exits (right→right)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 250 },
      'right',
      'right',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(4);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([300, 250]);
  });

  it('produces Z-shape with both horizontal exits (left→left)', () => {
    const route = computeOrthogonalRoute(
      { x: 300, y: 100 },
      { x: 100, y: 250 },
      'left',
      'left',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(4);
    expect(route[0]).toEqual([300, 100]);
    expect(route[route.length - 1]).toEqual([100, 250]);
  });

  it('produces Z-shape with normal horizontal flow (right→left, target ahead)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 400, y: 200 },
      'right',
      'left',
    );
    assertOrthogonal(route);
    // Normal flow: mid vertical segment between source and target
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([400, 200]);
    // Midpoint x should be between 100 and 400
    const midX = route[1]![0];
    expect(midX).toBeGreaterThan(100);
    expect(midX).toBeLessThan(400);
  });

  it('produces Z-shape with normal vertical flow (bottom→top, target below)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 400 },
      'bottom',
      'top',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([300, 400]);
    // Midpoint y should be between 100 and 400
    const midY = route[1]![1];
    expect(midY).toBeGreaterThan(100);
    expect(midY).toBeLessThan(400);
  });
});

// ── Shape padding ────────────────────────────────────────────

describe('computeOrthogonalRoute — shape padding', () => {
  it('routes with padding around source shape', () => {
    const route = computeOrthogonalRoute(
      { x: 300, y: 150 },      // right edge of source
      { x: 500, y: 250 },      // left edge of target
      'right',
      'left',
      { x: 100, y: 100, width: 200, height: 100 },  // source bounds
      { x: 500, y: 200, width: 200, height: 100 },   // target bounds
    );
    assertOrthogonal(route);
    // All intermediate points should avoid overlapping source shape
    for (let i = 1; i < route.length - 1; i++) {
      const [px, py] = route[i]!;
      const insideSource = px >= 100 && px <= 300 && py >= 100 && py <= 200;
      expect(insideSource, `Intermediate point (${px},${py}) is inside source shape`).toBe(false);
    }
  });

  it('routes without padding when no bounds provided', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      'right',
      'left',
    );
    assertOrthogonal(route);
    expect(route.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Edge cases ───────────────────────────────────────────────

describe('computeOrthogonalRoute — edge cases', () => {
  it('handles start === end (same point)', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    expect(route.length).toBeGreaterThanOrEqual(2);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([100, 100]);
  });

  it('handles negative coordinates', () => {
    const route = computeOrthogonalRoute(
      { x: -100, y: -200 },
      { x: 100, y: 50 },
      'right',
      'left',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([-100, -200]);
    expect(route[route.length - 1]).toEqual([100, 50]);
  });

  it('defaults to heuristic exit direction when no anchor specified', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([0, 0]);
    expect(route[route.length - 1]).toEqual([200, 100]);
  });

  it('handles corner anchors by inferring exit direction', () => {
    const route = computeOrthogonalRoute(
      { x: 100, y: 100 },
      { x: 300, y: 300 },
      'top-right',
      'bottom-left',
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([100, 100]);
    expect(route[route.length - 1]).toEqual([300, 300]);
  });
});

// ── Clearance / exit-entry stubs ─────────────────────────────
// [TDD] These tests encode the fix for the "lines go through shapes" bug.
// The router must add exit/entry stubs so route segments never cross
// through either connected shape.

describe('computeOrthogonalRoute — clearance stubs', () => {
  // ── Scenario: two rects stacked vertically, bottom→top ─────
  // Shape A at (100, 100) 200×100, bottom edge at y=200
  // Shape B at (150, 350) 200×100, top edge at y=350
  const shapesVertical = {
    startBounds: { x: 100, y: 100, width: 200, height: 100 } as Rect,
    endBounds: { x: 150, y: 350, width: 200, height: 100 } as Rect,
    start: { x: 200, y: 200 },  // bottom center of A
    end: { x: 250, y: 350 },    // top center of B
  };

  it('exits with a stub that clears the source shape (bottom→top)', () => {
    const { start, end, startBounds, endBounds } = shapesVertical;
    const route = computeOrthogonalRoute(
      start, end, 'bottom', 'top', startBounds, endBounds,
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([start.x, start.y]);
    expect(route[route.length - 1]).toEqual([end.x, end.y]);

    // Second point should be the exit stub — same x, y > start.y
    expect(route[1]![0]).toBe(start.x);
    expect(route[1]![1]).toBeGreaterThan(start.y);
  });

  it('enters with a stub that clears the target shape (bottom→top)', () => {
    const { start, end, startBounds, endBounds } = shapesVertical;
    const route = computeOrthogonalRoute(
      start, end, 'bottom', 'top', startBounds, endBounds,
    );
    // Second-to-last point should be the entry stub — same x as end, y < end.y
    const entryStub = route[route.length - 2]!;
    expect(entryStub[0]).toBe(end.x);
    expect(entryStub[1]).toBeLessThan(end.y);
  });

  it('route segments never cross source shape (bottom→top)', () => {
    const { start, end, startBounds, endBounds } = shapesVertical;
    const route = computeOrthogonalRoute(
      start, end, 'bottom', 'top', startBounds, endBounds,
    );
    assertRouteAvoidsRect(route, startBounds, 'source');
  });

  it('route segments never cross target shape (bottom→top)', () => {
    const { start, end, startBounds, endBounds } = shapesVertical;
    const route = computeOrthogonalRoute(
      start, end, 'bottom', 'top', startBounds, endBounds,
    );
    assertRouteAvoidsRect(route, endBounds, 'target');
  });

  // ── Scenario: two rects side by side, right→left ───────────
  // Shape A at (0, 100) 100×100, right edge at x=100
  // Shape B at (300, 150) 100×100, left edge at x=300
  const shapesHorizontal = {
    startBounds: { x: 0, y: 100, width: 100, height: 100 } as Rect,
    endBounds: { x: 300, y: 150, width: 100, height: 100 } as Rect,
    start: { x: 100, y: 150 },  // right center of A
    end: { x: 300, y: 200 },    // left center of B
  };

  it('exits with a stub that clears the source shape (right→left)', () => {
    const { start, end, startBounds, endBounds } = shapesHorizontal;
    const route = computeOrthogonalRoute(
      start, end, 'right', 'left', startBounds, endBounds,
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([start.x, start.y]);
    expect(route[route.length - 1]).toEqual([end.x, end.y]);

    // Second point should be exit stub — same y, x > start.x
    expect(route[1]![1]).toBe(start.y);
    expect(route[1]![0]).toBeGreaterThan(start.x);
  });

  it('enters with a stub that clears the target shape (right→left)', () => {
    const { start, end, startBounds, endBounds } = shapesHorizontal;
    const route = computeOrthogonalRoute(
      start, end, 'right', 'left', startBounds, endBounds,
    );
    // Second-to-last point should be entry stub — same y as end, x < end.x
    const entryStub = route[route.length - 2]!;
    expect(entryStub[1]).toBe(end.y);
    expect(entryStub[0]).toBeLessThan(end.x);
  });

  it('route segments never cross source shape (right→left)', () => {
    const { start, end, startBounds, endBounds } = shapesHorizontal;
    const route = computeOrthogonalRoute(
      start, end, 'right', 'left', startBounds, endBounds,
    );
    assertRouteAvoidsRect(route, startBounds, 'source');
  });

  it('route segments never cross target shape (right→left)', () => {
    const { start, end, startBounds, endBounds } = shapesHorizontal;
    const route = computeOrthogonalRoute(
      start, end, 'right', 'left', startBounds, endBounds,
    );
    assertRouteAvoidsRect(route, endBounds, 'target');
  });

  // ── Scenario: L-shape cross-axis, right exit → top entry ───
  // Shape A at (50, 100) 100×80, right edge at x=150
  // Shape B at (300, 250) 100×80, top edge at y=250
  const shapesLShape = {
    startBounds: { x: 50, y: 100, width: 100, height: 80 } as Rect,
    endBounds: { x: 300, y: 250, width: 100, height: 80 } as Rect,
    start: { x: 150, y: 140 },  // right center of A
    end: { x: 350, y: 250 },    // top center of B
  };

  it('L-shape route avoids both shapes (right→top)', () => {
    const { start, end, startBounds, endBounds } = shapesLShape;
    const route = computeOrthogonalRoute(
      start, end, 'right', 'top', startBounds, endBounds,
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([start.x, start.y]);
    expect(route[route.length - 1]).toEqual([end.x, end.y]);
    assertRouteAvoidsRect(route, startBounds, 'source');
    assertRouteAvoidsRect(route, endBounds, 'target');
  });

  // ── Scenario: shapes close together vertically ─────────────
  // Shape A at (100, 100) 200×100
  // Shape B at (150, 220) 200×100 — only 20px gap
  const shapesClose = {
    startBounds: { x: 100, y: 100, width: 200, height: 100 } as Rect,
    endBounds: { x: 150, y: 220, width: 200, height: 100 } as Rect,
    start: { x: 200, y: 200 },  // bottom center of A
    end: { x: 250, y: 220 },    // top center of B
  };

  it('routes between close shapes without crossing either (bottom→top)', () => {
    const { start, end, startBounds, endBounds } = shapesClose;
    const route = computeOrthogonalRoute(
      start, end, 'bottom', 'top', startBounds, endBounds,
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([start.x, start.y]);
    expect(route[route.length - 1]).toEqual([end.x, end.y]);
    assertRouteAvoidsRect(route, startBounds, 'source');
    assertRouteAvoidsRect(route, endBounds, 'target');
  });

  // ── Scenario: opposite-direction exit (right exit, target is left) ──
  const shapesOpposite = {
    startBounds: { x: 200, y: 100, width: 100, height: 80 } as Rect,
    endBounds: { x: 50, y: 250, width: 100, height: 80 } as Rect,
    start: { x: 300, y: 140 },  // right edge of A
    end: { x: 50, y: 290 },     // left edge of B
  };

  it('routes around both shapes in opposite-direction case (right→left, target behind)', () => {
    const { start, end, startBounds, endBounds } = shapesOpposite;
    const route = computeOrthogonalRoute(
      start, end, 'right', 'left', startBounds, endBounds,
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([start.x, start.y]);
    expect(route[route.length - 1]).toEqual([end.x, end.y]);
    assertRouteAvoidsRect(route, startBounds, 'source');
    assertRouteAvoidsRect(route, endBounds, 'target');
  });

  // ── Scenario: custom jettySize ─────────────────────────────
  it('uses jettySize as stub length', () => {
    const startBounds = { x: 0, y: 0, width: 100, height: 100 };
    const endBounds = { x: 300, y: 200, width: 100, height: 100 };
    const jettySize = 40;
    const route = computeOrthogonalRoute(
      { x: 100, y: 50 },  // right edge of source
      { x: 300, y: 250 }, // left edge of target
      'right',
      'left',
      startBounds,
      endBounds,
      jettySize,
    );
    assertOrthogonal(route);
    // Exit stub should be jettySize pixels from start
    expect(route[1]![0]).toBe(100 + jettySize);
    expect(route[1]![1]).toBe(50);
    // Entry stub should be jettySize pixels from end
    const entryStub = route[route.length - 2]!;
    expect(entryStub[0]).toBe(300 - jettySize);
    expect(entryStub[1]).toBe(250);
  });

  // ── Scenario: axis-aligned with shapes in the way ──────────
  it('does not shortcut axis-aligned routes when shapes block the path', () => {
    // Same x, bottom→top with shapes that would be crossed by a straight line
    const startBounds = { x: 150, y: 100, width: 100, height: 100 };
    const endBounds = { x: 130, y: 250, width: 100, height: 100 };
    const route = computeOrthogonalRoute(
      { x: 200, y: 200 },  // bottom of A
      { x: 200, y: 250 },  // top of B (same x!)
      'bottom',
      'top',
      startBounds,
      endBounds,
    );
    assertOrthogonal(route);
    expect(route[0]).toEqual([200, 200]);
    expect(route[route.length - 1]).toEqual([200, 250]);
    // Should have stubs — not just a straight 2-point line
    expect(route.length).toBeGreaterThan(2);
  });
});
