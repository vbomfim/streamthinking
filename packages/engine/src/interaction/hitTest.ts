/**
 * Hit testing — pure geometry functions for point-in-shape detection.
 *
 * Each function takes a world-coordinate point, an expression, and a
 * tolerance in world units. Returns true if the point is inside (or
 * within tolerance of) the expression's geometry.
 *
 * Tolerance is specified in screen pixels at the call site and converted
 * to world units via `tolerance / camera.zoom` before calling these functions.
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';

/** A 2D point in world coordinates. */
export interface WorldPoint {
  x: number;
  y: number;
}

/**
 * Hit test a rectangle expression.
 *
 * Checks if the point falls within the expression's bounding box,
 * expanded by `tolerance` on all sides.
 */
export function hitTestRectangle(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  return (
    point.x >= x - tolerance &&
    point.x <= x + width + tolerance &&
    point.y >= y - tolerance &&
    point.y <= y + height + tolerance
  );
}

/**
 * Hit test an ellipse expression.
 *
 * Uses the standard ellipse equation with radii expanded by tolerance:
 * `((px - cx) / (rx + tol))² + ((py - cy) / (ry + tol))² ≤ 1`
 */
export function hitTestEllipse(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2 + tolerance;
  const ry = height / 2 + tolerance;

  if (rx <= 0 || ry <= 0) return false;

  const dx = point.x - cx;
  const dy = point.y - cy;

  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

/**
 * Hit test a diamond expression.
 *
 * The diamond is a rhombus inscribed in the bounding box with vertices at
 * the midpoints of each edge. Uses the diamond equation:
 * `|px - cx| / halfW + |py - cy| / halfH ≤ 1`
 *
 * Tolerance expands the half-widths.
 */
export function hitTestDiamond(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  const cx = x + width / 2;
  const cy = y + height / 2;
  const halfW = width / 2 + tolerance;
  const halfH = height / 2 + tolerance;

  if (halfW <= 0 || halfH <= 0) return false;

  return Math.abs(point.x - cx) / halfW + Math.abs(point.y - cy) / halfH <= 1;
}

/**
 * Compute the minimum distance from a point to a line segment.
 *
 * Uses projection: clamps the parameter t to [0, 1] to stay within
 * the segment, then computes distance to the nearest point.
 */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (zero length) — distance to the point
    return Math.hypot(px - ax, py - ay);
  }

  // Project point onto the line, clamped to segment
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Hit test a line expression.
 *
 * Checks if the perpendicular distance from the point to any segment
 * in the line's point array is less than tolerance.
 */
export function hitTestLine(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  if (expression.data.kind !== 'line') return false;
  const { points } = expression.data;

  if (points.length < 2) return false;

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    if (distanceToSegment(point.x, point.y, ax, ay, bx, by) <= tolerance) {
      return true;
    }
  }

  return false;
}

/**
 * Hit test an arrow expression.
 *
 * Same as line — checks distance to any segment in the point array.
 */
export function hitTestArrow(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  if (expression.data.kind !== 'arrow') return false;
  const { points } = expression.data;

  if (points.length < 2) return false;

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    if (distanceToSegment(point.x, point.y, ax, ay, bx, by) <= tolerance) {
      return true;
    }
  }

  return false;
}

/**
 * Hit test a freehand expression.
 *
 * Checks distance to any segment formed by consecutive points.
 * Freehand points are [x, y, pressure] — pressure is ignored for hit testing.
 */
export function hitTestFreehand(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  if (expression.data.kind !== 'freehand') return false;
  const { points } = expression.data;

  if (points.length < 2) return false;

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    if (distanceToSegment(point.x, point.y, ax, ay, bx, by) <= tolerance) {
      return true;
    }
  }

  return false;
}

/**
 * Hit test a text expression.
 *
 * Bounding box only — no tolerance margin.
 */
export function hitTestText(
  point: WorldPoint,
  expression: VisualExpression,
): boolean {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

/**
 * Hit test a sticky-note expression.
 *
 * Bounding box only — no tolerance margin.
 */
export function hitTestStickyNote(
  point: WorldPoint,
  expression: VisualExpression,
): boolean {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

/**
 * Hit test an image expression.
 *
 * Bounding box only — no tolerance margin.
 */
export function hitTestImage(
  point: WorldPoint,
  expression: VisualExpression,
): boolean {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  return (
    point.x >= x &&
    point.x <= x + width &&
    point.y >= y &&
    point.y <= y + height
  );
}

/**
 * Dispatch hit test by expression kind.
 *
 * Routes to the correct shape-specific hit test function based on
 * the expression's `kind` field. Returns false for unknown kinds.
 */
export function hitTestExpression(
  point: WorldPoint,
  expression: VisualExpression,
  tolerance: number,
): boolean {
  switch (expression.kind) {
    case 'rectangle':
      return hitTestRectangle(point, expression, tolerance);
    case 'ellipse':
      return hitTestEllipse(point, expression, tolerance);
    case 'diamond':
      return hitTestDiamond(point, expression, tolerance);
    case 'line':
      return hitTestLine(point, expression, tolerance);
    case 'arrow':
      return hitTestArrow(point, expression, tolerance);
    case 'freehand':
      return hitTestFreehand(point, expression, tolerance);
    case 'text':
      return hitTestText(point, expression);
    case 'sticky-note':
      return hitTestStickyNote(point, expression);
    case 'image':
      return hitTestImage(point, expression);
    default:
      return false;
  }
}
