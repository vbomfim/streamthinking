/**
 * Connector helper functions for arrow bindings.
 *
 * Pure functions for snap detection, anchor point calculation,
 * and binding resolution. Used by ArrowTool during drawing and
 * by canvasStore when bound shapes move.
 *
 * @module
 */

import type { VisualExpression, ArrowData, ArrowBinding } from '@infinicanvas/protocol';

/** Kinds that support snap/binding (shapes with meaningful edges). */
const BINDABLE_KINDS = new Set(['rectangle', 'ellipse', 'diamond', 'sticky-note', 'stencil']);

/**
 * Find the nearest connection point on a shape's edge.
 *
 * Returns the closest anchor point and its world position if the
 * given world point is within `snapDistance` of any edge anchor.
 * Returns null if no anchor is close enough or the expression
 * is not a bindable shape. [CLEAN-CODE]
 */
export function findSnapPoint(
  worldPoint: { x: number; y: number },
  targetExpression: VisualExpression,
  snapDistance: number,
): { point: { x: number; y: number }; anchor: string } | null {
  if (snapDistance <= 0) return null;
  if (!BINDABLE_KINDS.has(targetExpression.kind)) return null;

  const { x, y } = targetExpression.position;
  const { width, height } = targetExpression.size;

  // Check if point is within snap range of the shape's bounding box
  const expandedLeft = x - snapDistance;
  const expandedRight = x + width + snapDistance;
  const expandedTop = y - snapDistance;
  const expandedBottom = y + height + snapDistance;

  if (worldPoint.x < expandedLeft || worldPoint.x > expandedRight ||
      worldPoint.y < expandedTop || worldPoint.y > expandedBottom) {
    return null; // Too far from shape
  }

  // No snap from inside the shape — only from outside or on the border
  const isInside = worldPoint.x > x && worldPoint.x < x + width &&
                   worldPoint.y > y && worldPoint.y < y + height;
  if (isInside) return null;

  // Find closest point on the shape's perimeter
  const cx = x + width / 2;
  const cy = y + height / 2;

  // Project cursor to nearest point on each edge, pick closest
  const edgePoints: Array<{ anchor: string; point: { x: number; y: number }; ratio: number }> = [
    { anchor: 'top', point: { x: clamp(worldPoint.x, x, x + width), y }, ratio: width > 0 ? (clamp(worldPoint.x, x, x + width) - x) / width : 0.5 },
    { anchor: 'bottom', point: { x: clamp(worldPoint.x, x, x + width), y: y + height }, ratio: width > 0 ? (clamp(worldPoint.x, x, x + width) - x) / width : 0.5 },
    { anchor: 'left', point: { x, y: clamp(worldPoint.y, y, y + height) }, ratio: height > 0 ? (clamp(worldPoint.y, y, y + height) - y) / height : 0.5 },
    { anchor: 'right', point: { x: x + width, y: clamp(worldPoint.y, y, y + height) }, ratio: height > 0 ? (clamp(worldPoint.y, y, y + height) - y) / height : 0.5 },
  ];

  let closest: { anchor: string; point: { x: number; y: number }; dist: number; ratio: number } | null = null;

  for (const { anchor, point, ratio } of edgePoints) {
    const dist = Math.hypot(worldPoint.x - point.x, worldPoint.y - point.y);
    if (dist <= snapDistance && (closest === null || dist < closest.dist)) {
      closest = { anchor, point, dist, ratio };
    }
  }

  if (!closest) return null;
  return { point: closest.point, anchor: closest.anchor, ratio: closest.ratio };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the connection point for a specific anchor on a shape.
 *
 * Supports rectangle, ellipse, diamond, and sticky-note shapes.
 * For 'center' and 'auto' anchors, returns the bounding box center.
 * [CLEAN-CODE] [SRP]
 */
export function getAnchorPoint(
  expression: VisualExpression,
  anchor: string,
  ratio: number = 0.5,
): { x: number; y: number } {
  const { x, y } = expression.position;
  const { width, height } = expression.size;

  if (anchor === 'center' || anchor === 'auto') {
    return { x: x + width / 2, y: y + height / 2 };
  }

  // Use ratio (0-1) along the edge for precise positioning
  switch (anchor) {
    case 'top':
      return { x: x + width * ratio, y };
    case 'right':
      return { x: x + width, y: y + height * ratio };
    case 'bottom':
      return { x: x + width * ratio, y: y + height };
    case 'left':
      return { x, y: y + height * ratio };
    default:
      return { x: x + width / 2, y: y + height / 2 };
  }
}

/**
 * Recalculate arrow endpoints based on bindings.
 *
 * If the arrow has start/end bindings, replaces the first/last point
 * with the resolved anchor position on the bound shape. Returns a new
 * points array (does not mutate the original). [CLEAN-CODE] [SRP]
 *
 * Returns an empty array for non-arrow expressions.
 */
export function resolveBindings(
  arrowExpr: VisualExpression,
  expressions: Record<string, VisualExpression>,
): [number, number][] {
  if (arrowExpr.data.kind !== 'arrow') return [];

  const arrowData = arrowExpr.data as ArrowData;
  const points: [number, number][] = arrowData.points.map(
    (p) => [p[0], p[1]] as [number, number],
  );

  if (points.length < 2) return points;

  // Get both bound shapes
  const startShape = arrowData.startBinding ? expressions[arrowData.startBinding.expressionId] : null;
  const endShape = arrowData.endBinding ? expressions[arrowData.endBinding.expressionId] : null;

  // Self-loop: both bound to same shape — force different edges
  const isSelfLoop = startShape && endShape && arrowData.startBinding!.expressionId === arrowData.endBinding!.expressionId;
  if (isSelfLoop) {
    const startAnchor = arrowData.startBinding!.anchor || 'top';
    const endAnchor = arrowData.endBinding!.anchor || 'right';
    // If both on same edge, shift end to adjacent edge
    const actualEnd = startAnchor === endAnchor
      ? (startAnchor === 'top' ? 'right' : startAnchor === 'right' ? 'bottom' : startAnchor === 'bottom' ? 'left' : 'top')
      : endAnchor;
    const startPt = getAnchorPoint(startShape, startAnchor, arrowData.startBinding!.ratio ?? 0.5);
    const endPt = getAnchorPoint(endShape, actualEnd, arrowData.endBinding!.ratio ?? 0.5);
    points[0] = [startPt.x, startPt.y];
    points[points.length - 1] = [endPt.x, endPt.y];
    return points;
  }

  // Use shape centers as routing references
  const startCenter = startShape
    ? { x: startShape.position.x + startShape.size.width / 2, y: startShape.position.y + startShape.size.height / 2 }
    : null;
  const endCenter = endShape
    ? { x: endShape.position.x + endShape.size.width / 2, y: endShape.position.y + endShape.size.height / 2 }
    : null;

  // Resolve start binding — smart route facing the other end
  if (arrowData.startBinding && startShape) {
    const toward = endCenter ?? { x: points[points.length - 1]![0], y: points[points.length - 1]![1] };
    const bestEdge = getBestEdge(startShape, toward);
    // Use stored ratio if edge matches, otherwise center
    const ratio = bestEdge === arrowData.startBinding.anchor
      ? (arrowData.startBinding.ratio ?? 0.5)
      : 0.5;
    const pt = getAnchorPoint(startShape, bestEdge, ratio);
    points[0] = [pt.x, pt.y];
  }

  // Resolve end binding — smart route facing the other end
  if (arrowData.endBinding && endShape) {
    const toward = startCenter ?? { x: points[0]![0], y: points[0]![1] };
    const bestEdge = getBestEdge(endShape, toward);
    const ratio = bestEdge === arrowData.endBinding.anchor
      ? (arrowData.endBinding.ratio ?? 0.5)
      : 0.5;
    const pt = getAnchorPoint(endShape, bestEdge, ratio);
    points[points.length - 1] = [pt.x, pt.y];
  }

  return points;
}

/** Determine which edge of a shape faces a target point. */
function getBestEdge(
  expr: VisualExpression,
  toward: { x: number; y: number },
): string {
  const cx = expr.position.x + expr.size.width / 2;
  const cy = expr.position.y + expr.size.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'bottom' : 'top';
}

/**
 * Find all arrows bound to a given expression ID.
 *
 * Scans all expressions and returns IDs of arrows that have
 * a startBinding or endBinding referencing the target ID.
 * [CLEAN-CODE]
 */
export function findBoundArrows(
  targetId: string,
  expressions: Record<string, VisualExpression>,
): string[] {
  const result: string[] = [];
  for (const [id, expr] of Object.entries(expressions)) {
    if (expr.data.kind !== 'arrow') continue;
    const data = expr.data as ArrowData;
    if (
      data.startBinding?.expressionId === targetId ||
      data.endBinding?.expressionId === targetId
    ) {
      result.push(id);
    }
  }
  return result;
}

/**
 * Clear bindings that reference a deleted expression.
 *
 * Returns a new ArrowData with the referencing bindings removed,
 * or undefined if no change is needed. [CLEAN-CODE]
 */
export function clearBindingsForDeletedExpression(
  arrowData: ArrowData,
  deletedId: string,
): ArrowData | undefined {
  let changed = false;
  const updated = { ...arrowData };

  if (arrowData.startBinding?.expressionId === deletedId) {
    updated.startBinding = undefined;
    changed = true;
  }
  if (arrowData.endBinding?.expressionId === deletedId) {
    updated.endBinding = undefined;
    changed = true;
  }

  return changed ? updated : undefined;
}

// ── Internal helpers ─────────────────────────────────────────

/** Get all four anchor points for a bindable expression. */
function getAnchorPoints(
  expr: VisualExpression,
): Array<{ anchor: string; point: { x: number; y: number } }> {
  return [
    { anchor: 'top', point: getAnchorPoint(expr, 'top') },
    { anchor: 'right', point: getAnchorPoint(expr, 'right') },
    { anchor: 'bottom', point: getAnchorPoint(expr, 'bottom') },
    { anchor: 'left', point: getAnchorPoint(expr, 'left') },
  ];
}

/** Resolve a single binding to a world coordinate. */
function resolveBinding(
  binding: ArrowBinding,
  expressions: Record<string, VisualExpression>,
): { x: number; y: number } | null {
  const target = expressions[binding.expressionId];
  if (!target) return null;
  return getAnchorPoint(target, binding.anchor, binding.ratio ?? 0.5);
}
