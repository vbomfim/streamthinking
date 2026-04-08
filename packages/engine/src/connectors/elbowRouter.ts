/**
 * Elbow (single-bend) routing algorithm for arrow connectors.
 *
 * Produces a simple L-shaped path with one 90° turn.
 * Chooses horizontal-first or vertical-first based on
 * anchor direction or relative positions.
 *
 * Simpler than orthogonal routing (which handles Z-shapes
 * and padding). This is the "simple connector" style.
 *
 * [CLEAN-CODE] [SRP] — single responsibility: elbow path computation.
 *
 * @module
 */

import type { PathSegment } from './routerTypes.js';

/**
 * Compute an elbow (L-shape) route between two points.
 *
 * Returns 1-2 line PathSegments forming a right-angle turn.
 * For axis-aligned points, returns a single straight segment.
 * For coincident points, returns a degenerate segment.
 */
export function computeElbowRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor?: string,
  _endAnchor?: string,
): PathSegment[] {
  // Same point — degenerate
  if (start.x === end.x && start.y === end.y) {
    return [{ type: 'line', x: end.x, y: end.y }];
  }

  // Axis-aligned — straight line
  if (start.x === end.x || start.y === end.y) {
    return [{ type: 'line', x: end.x, y: end.y }];
  }

  // Determine direction: horizontal-first or vertical-first
  const horizontalFirst = shouldGoHorizontalFirst(startAnchor, start, end);

  if (horizontalFirst) {
    // Horizontal to end.x, then vertical to end.y
    return [
      { type: 'line', x: end.x, y: start.y },
      { type: 'line', x: end.x, y: end.y },
    ];
  }

  // Vertical to end.y, then horizontal to end.x
  return [
    { type: 'line', x: start.x, y: end.y },
    { type: 'line', x: end.x, y: end.y },
  ];
}

/**
 * Determine whether to route horizontal-first or vertical-first.
 *
 * Anchor takes priority. Without anchor, chooses based on
 * whichever axis has the greater delta (prefer the longer
 * first leg for a more balanced elbow).
 */
function shouldGoHorizontalFirst(
  anchor: string | undefined,
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  if (anchor) {
    if (anchor === 'right' || anchor === 'left') return true;
    if (anchor === 'top' || anchor === 'bottom') return false;
    // Corner anchors: prefer the horizontal component
    if (anchor === 'top-right' || anchor === 'bottom-right') return true;
    if (anchor === 'top-left' || anchor === 'bottom-left') return true;
  }

  // Heuristic: go along the longer axis first
  return Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
}
