/**
 * Unit tests for orthogonal (right-angle) routing algorithm.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers L-shape, Z-shape routing, anchor-based exit direction,
 * and shape padding.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { computeOrthogonalRoute } from '../connectors/orthogonalRouter.js';

// ── Helper ───────────────────────────────────────────────────

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
    // Should be a simple vertical line
    expect(route).toEqual([[100, 0], [100, 200]]);
  });

  it('handles same y (horizontal only) — straight horizontal line', () => {
    const route = computeOrthogonalRoute(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    );
    assertOrthogonal(route);
    expect(route).toEqual([[0, 100], [200, 100]]);
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
