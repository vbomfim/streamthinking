/**
 * Selection manager — query functions for finding expressions.
 *
 * Pure functions with no side effects. Used by the selection interaction
 * hook to determine which expressions are under the cursor or inside
 * a marquee rectangle.
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import { hitTestExpression } from './hitTest.js';
import type { WorldPoint } from './hitTest.js';

/** Axis-aligned bounding box in world coordinates. */
export interface Marquee {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Find the topmost expression at a world-coordinate point.
 *
 * Iterates `expressionOrder` back-to-front (z-order priority) and
 * returns the ID of the first expression that passes hit testing.
 * Returns null if no expression is hit.
 *
 * @param worldPoint - Point in world coordinates
 * @param expressions - All expressions keyed by ID
 * @param expressionOrder - Z-order array (index 0 = back, last = front)
 * @param tolerance - Hit tolerance in world units
 */
export function findExpressionAtPoint(
  worldPoint: WorldPoint,
  expressions: Record<string, VisualExpression>,
  expressionOrder: string[],
  tolerance: number,
): string | null {
  // Iterate back-to-front: last element is topmost
  for (let i = expressionOrder.length - 1; i >= 0; i--) {
    const id = expressionOrder[i]!;
    const expr = expressions[id];
    if (!expr) continue;

    if (hitTestExpression(worldPoint, expr, tolerance)) {
      return id;
    }
  }

  return null;
}

/**
 * Find all expressions whose bounding boxes intersect a marquee rectangle.
 *
 * Uses AABB intersection. Handles inverted marquees (negative width/height)
 * by normalizing before comparison.
 *
 * @param marquee - Selection rectangle in world coordinates
 * @param expressions - All expressions keyed by ID
 * @returns Array of expression IDs that intersect the marquee
 */
export function findExpressionsInMarquee(
  marquee: Marquee,
  expressions: Record<string, VisualExpression>,
): string[] {
  // Normalize marquee (handle negative width/height from reverse drag)
  const mx = marquee.width >= 0 ? marquee.x : marquee.x + marquee.width;
  const my = marquee.height >= 0 ? marquee.y : marquee.y + marquee.height;
  const mw = Math.abs(marquee.width);
  const mh = Math.abs(marquee.height);

  const mRight = mx + mw;
  const mBottom = my + mh;

  const result: string[] = [];

  for (const [id, expr] of Object.entries(expressions)) {
    const { x, y } = expr.position;
    const { width, height } = expr.size;

    const exprRight = x + width;
    const exprBottom = y + height;

    // AABB intersection test
    const intersects =
      exprRight > mx &&
      x < mRight &&
      exprBottom > my &&
      y < mBottom;

    if (intersects) {
      result.push(id);
    }
  }

  return result;
}
