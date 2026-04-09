/**
 * Orthogonal routing enhancements — curved and rounded corners.
 *
 * Wraps the base orthogonal router to add:
 * - **Curved corners**: replaces each right-angle corner with a smooth
 *   cubic bezier curve (draw.io's `curved=1` style).
 * - **Rounded corners**: replaces each right-angle corner with a small
 *   arc radius.
 *
 * Both functions delegate to `computeOrthogonalRoute()` for the base
 * path, then post-process the waypoints to produce PathSegments.
 *
 * [CLEAN-CODE] [SRP] — each function does one thing: enhance corners.
 * [DRY] — shares the base orthogonal route computation.
 *
 * @module
 */

import type { PathSegment, RouterOptions } from './routerTypes.js';
import { computeOrthogonalRoute } from './orthogonalRouter.js';

/** Default corner radius for rounded corners. */
const DEFAULT_CORNER_RADIUS = 8;

/**
 * Compute an orthogonal route with bezier-smoothed corners.
 *
 * Delegates to the base orthogonal router, then converts each
 * right-angle corner into a cubic bezier curve that tangentially
 * connects the adjacent segments.
 *
 * Returns PathSegment[] (mix of line and bezier segments).
 */
export function computeOrthogonalCurvedRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  options?: RouterOptions,
): PathSegment[] {
  const basePoints = computeOrthogonalRoute(
    start,
    end,
    startAnchor,
    endAnchor,
    options?.startBounds,
    options?.endBounds,
    options?.jettySize,
  );

  return smoothCornersWithBezier(basePoints);
}

/**
 * Compute an orthogonal route with arc-rounded corners.
 *
 * Delegates to the base orthogonal router, then replaces each
 * right-angle corner with an arc of the given radius.
 *
 * Returns PathSegment[] (mix of line and arc segments).
 */
export function computeOrthogonalRoundedRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  endAnchor?: string,
  options?: RouterOptions,
): PathSegment[] {
  const basePoints = computeOrthogonalRoute(
    start,
    end,
    startAnchor,
    endAnchor,
    options?.startBounds,
    options?.endBounds,
    options?.jettySize,
  );

  return roundCornersWithArcs(basePoints);
}

/**
 * Convert orthogonal waypoints to PathSegments with bezier-smoothed corners.
 *
 * For each corner (point that's not start or end), replaces it with:
 * - A line segment up to a point offset before the corner
 * - A bezier curve through the corner
 *
 * Straight lines (2 points) pass through as a single line segment.
 */
function smoothCornersWithBezier(points: [number, number][]): PathSegment[] {
  if (points.length <= 1) {
    return points.length === 1
      ? [{ type: 'line', x: points[0]![0], y: points[0]![1] }]
      : [];
  }

  if (points.length === 2) {
    return [{ type: 'line', x: points[1]![0], y: points[1]![1] }];
  }

  const segments: PathSegment[] = [];
  const cornerOffset = 0.3; // How far before/after corner to start/end the curve

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = i < points.length - 1 ? points[i + 1] : undefined;

    if (next && isCorner(prev, curr, next)) {
      // Calculate offset points before and after the corner
      const segLen1 = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
      const segLen2 = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
      const offset = Math.min(segLen1 * cornerOffset, segLen2 * cornerOffset, 20);

      // Point before corner
      const beforeX = curr[0] + (prev[0] - curr[0]) * (offset / segLen1);
      const beforeY = curr[1] + (prev[1] - curr[1]) * (offset / segLen1);

      // Point after corner
      const afterX = curr[0] + (next[0] - curr[0]) * (offset / segLen2);
      const afterY = curr[1] + (next[1] - curr[1]) * (offset / segLen2);

      // Line to before-corner point
      segments.push({ type: 'line', x: beforeX, y: beforeY });

      // Bezier curve through the corner
      segments.push({
        type: 'bezier',
        cp1x: curr[0],
        cp1y: curr[1],
        cp2x: curr[0],
        cp2y: curr[1],
        x: afterX,
        y: afterY,
      });

      // Skip adding line to curr — we've already curved past it
    } else if (i === points.length - 1) {
      // Last point — always add
      segments.push({ type: 'line', x: curr[0], y: curr[1] });
    } else if (!next || !isCorner(prev, curr, next)) {
      // Interior point that isn't a corner (rare in orthogonal)
      segments.push({ type: 'line', x: curr[0], y: curr[1] });
    }
  }

  return segments;
}

/**
 * Convert orthogonal waypoints to PathSegments with arc-rounded corners.
 *
 * For each corner, inserts an arc segment of DEFAULT_CORNER_RADIUS.
 */
function roundCornersWithArcs(points: [number, number][]): PathSegment[] {
  if (points.length <= 1) {
    return points.length === 1
      ? [{ type: 'line', x: points[0]![0], y: points[0]![1] }]
      : [];
  }

  if (points.length === 2) {
    return [{ type: 'line', x: points[1]![0], y: points[1]![1] }];
  }

  const segments: PathSegment[] = [];
  const radius = DEFAULT_CORNER_RADIUS;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = i < points.length - 1 ? points[i + 1] : undefined;

    if (next && isCorner(prev, curr, next)) {
      const segLen1 = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
      const segLen2 = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
      const r = Math.min(radius, segLen1 / 2, segLen2 / 2);

      // Point before corner (r pixels before the corner)
      const beforeX = curr[0] + (prev[0] - curr[0]) * (r / segLen1);
      const beforeY = curr[1] + (prev[1] - curr[1]) * (r / segLen1);

      // Point after corner (r pixels after the corner)
      const afterX = curr[0] + (next[0] - curr[0]) * (r / segLen2);
      const afterY = curr[1] + (next[1] - curr[1]) * (r / segLen2);

      // Line to before-corner point
      segments.push({ type: 'line', x: beforeX, y: beforeY });

      // Arc through the corner
      segments.push({ type: 'arc', rx: r, ry: r, x: afterX, y: afterY });
    } else if (i === points.length - 1) {
      segments.push({ type: 'line', x: curr[0], y: curr[1] });
    } else if (!next || !isCorner(prev, curr, next)) {
      segments.push({ type: 'line', x: curr[0], y: curr[1] });
    }
  }

  return segments;
}

/**
 * Check if three consecutive points form a corner (direction change).
 *
 * In orthogonal routing, a corner is where a horizontal segment
 * meets a vertical segment (or vice versa).
 */
function isCorner(
  a: [number, number],
  b: [number, number],
  c: [number, number],
): boolean {
  const dx1 = b[0] - a[0];
  const dy1 = b[1] - a[1];
  const dx2 = c[0] - b[0];
  const dy2 = c[1] - b[1];

  // Horizontal-to-vertical or vertical-to-horizontal
  const seg1Horiz = Math.abs(dy1) < 0.01 && Math.abs(dx1) > 0.01;
  const seg1Vert = Math.abs(dx1) < 0.01 && Math.abs(dy1) > 0.01;
  const seg2Horiz = Math.abs(dy2) < 0.01 && Math.abs(dx2) > 0.01;
  const seg2Vert = Math.abs(dx2) < 0.01 && Math.abs(dy2) > 0.01;

  return (seg1Horiz && seg2Vert) || (seg1Vert && seg2Horiz);
}
