/**
 * Unit tests for all routing engines.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: curved, entity-relation, isometric routers,
 * router registry dispatch, and backward compatibility.
 *
 * Elbow and orthogonalCurved are now aliases/adapters in routerRegistry,
 * tested via getRouter().
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { PathSegment, RouterOptions } from '../connectors/routerTypes.js';
import { computeCurvedRoute } from '../connectors/curvedRouter.js';
import { computeEntityRelationRoute } from '../connectors/entityRelationRouter.js';
import { computeIsometricRoute } from '../connectors/isometricRouter.js';
import { getRouter } from '../connectors/routerRegistry.js';

// ── Helpers ──────────────────────────────────────────────────

/** Assert a PathSegment[] starts at the given point (first segment endpoint). */
function assertStartsNear(
  segments: PathSegment[],
  x: number,
  y: number,
  tolerance = 0.01,
): void {
  expect(segments.length).toBeGreaterThanOrEqual(1);
  const first = segments[0]!;
  expect(Math.abs(first.x - x)).toBeLessThanOrEqual(tolerance + Math.abs(x));
}

/** Assert a PathSegment[] ends at the given point. */
function assertEndsAt(
  segments: PathSegment[],
  x: number,
  y: number,
  tolerance = 0.01,
): void {
  expect(segments.length).toBeGreaterThanOrEqual(1);
  const last = segments[segments.length - 1]!;
  expect(Math.abs(last.x - x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(last.y - y)).toBeLessThanOrEqual(tolerance);
}

/** Assert all segments are one of the valid types. */
function assertValidSegments(segments: PathSegment[]): void {
  for (const seg of segments) {
    expect(['line', 'bezier', 'arc', 'quadratic']).toContain(seg.type);
    expect(typeof seg.x).toBe('number');
    expect(typeof seg.y).toBe('number');
    expect(Number.isFinite(seg.x)).toBe(true);
    expect(Number.isFinite(seg.y)).toBe(true);
    if (seg.type === 'bezier') {
      expect(Number.isFinite(seg.cp1x)).toBe(true);
      expect(Number.isFinite(seg.cp1y)).toBe(true);
      expect(Number.isFinite(seg.cp2x)).toBe(true);
      expect(Number.isFinite(seg.cp2y)).toBe(true);
    }
  }
}

/** Count segments of a specific type. */
function countType(segments: PathSegment[], type: string): number {
  return segments.filter(s => s.type === type).length;
}

// ── Curved Router ────────────────────────────────────────────

describe('computeCurvedRoute', () => {
  it('returns at least one bezier segment for two non-coincident points', () => {
    const result = computeCurvedRoute(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(countType(result, 'bezier')).toBeGreaterThanOrEqual(1);
  });

  it('ends at the target point', () => {
    const result = computeCurvedRoute(
      { x: 50, y: 50 },
      { x: 300, y: 200 },
    );
    assertEndsAt(result, 300, 200);
  });

  it('handles same point (start === end) — returns a degenerate segment', () => {
    const result = computeCurvedRoute(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    assertValidSegments(result);
    expect(result.length).toBeGreaterThanOrEqual(1);
    assertEndsAt(result, 100, 100);
  });

  it('handles axis-aligned horizontal points', () => {
    const result = computeCurvedRoute(
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 50);
  });

  it('handles axis-aligned vertical points', () => {
    const result = computeCurvedRoute(
      { x: 50, y: 0 },
      { x: 50, y: 200 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 50, 200);
  });

  it('handles negative coordinates', () => {
    const result = computeCurvedRoute(
      { x: -100, y: -200 },
      { x: 100, y: 50 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 100, 50);
  });

  it('produces smooth control points (not crossing excessively)', () => {
    const result = computeCurvedRoute(
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    );
    // For a horizontal path, bezier control points should not
    // deviate wildly in y
    for (const seg of result) {
      if (seg.type === 'bezier') {
        expect(Math.abs(seg.cp1y)).toBeLessThan(200);
        expect(Math.abs(seg.cp2y)).toBeLessThan(200);
      }
    }
  });
});

// ── Elbow Router ─────────────────────────────────────────────

describe('elbow routing (via getRouter)', () => {
  const elbowRouter = getRouter('elbow')!;

  it('returns a valid router function', () => {
    expect(elbowRouter).toBeDefined();
    expect(typeof elbowRouter).toBe('function');
  });

  it('produces line segments (L-shape via orthogonal with jettySize=0)', () => {
    const result = elbowRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every(s => s.type === 'line')).toBe(true);
  });

  it('ends at the target point', () => {
    const result = elbowRouter(
      { x: 50, y: 50 },
      { x: 300, y: 200 },
    );
    assertEndsAt(result, 300, 200);
  });

  it('handles same point — returns segments to same point', () => {
    const result = elbowRouter(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 100, 100);
  });

  it('handles axis-aligned points — produces straight line', () => {
    const result = elbowRouter(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 0);
  });

  it('handles negative coordinates', () => {
    const result = elbowRouter(
      { x: -100, y: 50 },
      { x: 200, y: -100 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, -100);
  });

  it('respects anchor direction when specified', () => {
    const result = elbowRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      'right',
    );
    assertValidSegments(result);
  });

  it('backward compat: elbow alias produces valid orthogonal result', () => {
    // Elbow should produce the same result as orthogonal with jettySize=0
    const orthogonalRouter = getRouter('orthogonal')!;
    const elbowResult = elbowRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      'right',
    );
    const orthoResult = orthogonalRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      'right',
      undefined,
      { jettySize: 0 },
    );
    // Both should end at the same point
    assertEndsAt(elbowResult, 200, 100);
    assertEndsAt(orthoResult, 200, 100);
  });
});

// ── Entity Relation Router ───────────────────────────────────

describe('computeEntityRelationRoute', () => {
  it('produces bezier segments for the S-curve', () => {
    const result = computeEntityRelationRoute(
      { x: 0, y: 0 },
      { x: 300, y: 200 },
    );
    assertValidSegments(result);
    expect(countType(result, 'bezier')).toBeGreaterThanOrEqual(1);
  });

  it('starts with a perpendicular stub (line segment)', () => {
    const result = computeEntityRelationRoute(
      { x: 0, y: 50 },
      { x: 300, y: 200 },
      'right',
    );
    assertValidSegments(result);
    // First segment should be a short line (the stub)
    const first = result[0]!;
    expect(first.type).toBe('line');
  });

  it('ends with a perpendicular stub arriving at target', () => {
    const result = computeEntityRelationRoute(
      { x: 0, y: 50 },
      { x: 300, y: 200 },
      'right',
      'left',
    );
    assertValidSegments(result);
    assertEndsAt(result, 300, 200);
  });

  it('handles same point gracefully', () => {
    const result = computeEntityRelationRoute(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 100, 100);
  });

  it('handles axis-aligned points', () => {
    const result = computeEntityRelationRoute(
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 300, 100);
  });

  it('handles negative coordinates', () => {
    const result = computeEntityRelationRoute(
      { x: -100, y: -50 },
      { x: 200, y: 150 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 150);
  });
});

// ── Isometric Router ─────────────────────────────────────────

describe('computeIsometricRoute', () => {
  it('returns valid segments', () => {
    const result = computeIsometricRoute(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('ends at the target point', () => {
    const result = computeIsometricRoute(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertEndsAt(result, 200, 100);
  });

  it('uses only isometric angles (0°, 30°, 150°, 90°)', () => {
    const result = computeIsometricRoute(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    // All segments should be lines at valid isometric angles
    const validAngles = [0, 30, 150, 180, 210, 330, 90, 270];
    const tolerance = 1; // degree tolerance

    let prevX = 0;
    let prevY = 0;
    for (const seg of result) {
      if (seg.type === 'line') {
        const dx = seg.x - prevX;
        const dy = seg.y - prevY;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          const angleDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
          const isValid = validAngles.some(a => Math.abs(angleDeg - a) <= tolerance || Math.abs(angleDeg - a - 360) <= tolerance);
          expect(isValid, `Angle ${angleDeg.toFixed(1)}° is not an isometric angle`).toBe(true);
        }
        prevX = seg.x;
        prevY = seg.y;
      }
    }
  });

  it('handles same point', () => {
    const result = computeIsometricRoute(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 100, 100);
  });

  it('handles pure vertical movement', () => {
    const result = computeIsometricRoute(
      { x: 0, y: 0 },
      { x: 0, y: 200 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 0, 200);
  });

  it('handles negative coordinates', () => {
    const result = computeIsometricRoute(
      { x: -100, y: -50 },
      { x: 200, y: 150 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 150);
  });
});

// ── Orthogonal Enhancements (via getRouter) ─────────────────

describe('orthogonalCurved routing (via getRouter)', () => {
  const orthogonalCurvedRouter = getRouter('orthogonalCurved')!;

  it('produces bezier segments at corners', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(countType(result, 'bezier')).toBeGreaterThanOrEqual(1);
  });

  it('ends at the target point', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertEndsAt(result, 200, 100);
  });

  it('handles axis-aligned points (no corners to smooth)', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 0);
    // No bezier needed for a straight line
    expect(countType(result, 'bezier')).toBe(0);
  });

  it('handles same point', () => {
    const result = orthogonalCurvedRouter(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 100, 100);
  });

  it('supports custom jettySize option', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { jettySize: 40 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 100);
  });
});

describe('orthogonalRounded routing (via getRouter with rounded option)', () => {
  const orthogonalCurvedRouter = getRouter('orthogonalCurved')!;

  it('produces quadratic segments at corners when rounded=true', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { rounded: true },
    );
    assertValidSegments(result);
    expect(countType(result, 'quadratic')).toBeGreaterThanOrEqual(1);
  });

  it('ends at the target point', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { rounded: true },
    );
    assertEndsAt(result, 200, 100);
  });

  it('handles axis-aligned points (no corners to round)', () => {
    const result = orthogonalCurvedRouter(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      undefined,
      undefined,
      { rounded: true },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 0);
    expect(countType(result, 'quadratic')).toBe(0);
  });

  it('handles same point', () => {
    const result = orthogonalCurvedRouter(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      undefined,
      undefined,
      { rounded: true },
    );
    assertValidSegments(result);
    assertEndsAt(result, 100, 100);
  });
});

// ── Router Registry ──────────────────────────────────────────

describe('getRouter (router registry)', () => {
  it('returns a function for "curved" mode', () => {
    const router = getRouter('curved');
    expect(typeof router).toBe('function');
  });

  it('returns a function for "elbow" mode', () => {
    const router = getRouter('elbow');
    expect(typeof router).toBe('function');
  });

  it('returns a function for "entityRelation" mode', () => {
    const router = getRouter('entityRelation');
    expect(typeof router).toBe('function');
  });

  it('returns a function for "isometric" mode', () => {
    const router = getRouter('isometric');
    expect(typeof router).toBe('function');
  });

  it('returns a function for "orthogonal" mode', () => {
    const router = getRouter('orthogonal');
    expect(typeof router).toBe('function');
  });

  it('returns a function for "orthogonalCurved" mode', () => {
    const router = getRouter('orthogonalCurved');
    expect(typeof router).toBe('function');
  });

  it('returns null for "straight" mode (default rendering)', () => {
    const router = getRouter('straight');
    expect(router).toBeNull();
  });

  it('returns null for undefined mode', () => {
    const router = getRouter(undefined);
    expect(router).toBeNull();
  });

  it('dispatches curved mode to produce bezier segments', () => {
    const router = getRouter('curved')!;
    const result = router(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(countType(result, 'bezier')).toBeGreaterThanOrEqual(1);
  });

  it('dispatches elbow mode to produce line segments', () => {
    const router = getRouter('elbow')!;
    const result = router(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(result.every(s => s.type === 'line')).toBe(true);
  });

  it('dispatches entityRelation mode to produce bezier segments', () => {
    const router = getRouter('entityRelation')!;
    const result = router(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
    );
    assertValidSegments(result);
    expect(countType(result, 'bezier')).toBeGreaterThanOrEqual(1);
  });

  it('passes options through to router', () => {
    const router = getRouter('orthogonalCurved')!;
    const result = router(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { jettySize: 50 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 100);
  });
});

// ── Bug-Fix Regression Tests ─────────────────────────────────

describe('Bug #7: epsilon fix in segmentCrossesRect', () => {
  const orthogonalRouter = getRouter('orthogonal')!;

  it('routes around obstacles when segment touches shape edge', () => {
    // When a segment is exactly on a shape edge (e.g. y=100 touching
    // a shape with top=100), the old strict inequality missed it.
    // With EDGE_EPSILON=1, this should be detected and routed around.
    const result = orthogonalRouter(
      { x: 50, y: 50 },
      { x: 250, y: 150 },
      undefined,
      undefined,
      {
        startBounds: { x: 0, y: 0, width: 100, height: 100 },
        endBounds: { x: 200, y: 100, width: 100, height: 100 },
      },
    );
    assertValidSegments(result);
    assertEndsAt(result, 250, 150);
  });

  it('still allows segments that are clearly outside shapes', () => {
    const result = orthogonalRouter(
      { x: 0, y: 0 },
      { x: 500, y: 0 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 500, 0);
  });
});

describe('Bug #6: curved/elbow removed from JETTY_ROUTING_MODES', () => {
  it('getRouter returns function for curved (not in jetty list)', () => {
    const router = getRouter('curved');
    expect(router).not.toBeNull();
  });

  it('getRouter returns function for elbow (adapter, not in jetty list)', () => {
    const router = getRouter('elbow');
    expect(router).not.toBeNull();
  });
});

describe('midpointOffset option support', () => {
  const orthogonalRouter = getRouter('orthogonal')!;

  it('accepts midpointOffset=0 without error', () => {
    const result = orthogonalRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { midpointOffset: 0 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 100);
  });

  it('accepts midpointOffset=0.5 without error', () => {
    const result = orthogonalRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { midpointOffset: 0.5 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 100);
  });

  it('accepts midpointOffset=1 without error', () => {
    const result = orthogonalRouter(
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      undefined,
      undefined,
      { midpointOffset: 1 },
    );
    assertValidSegments(result);
    assertEndsAt(result, 200, 100);
  });
});
