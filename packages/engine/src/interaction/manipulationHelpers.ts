/**
 * Manipulation helpers — pure functions for handle detection,
 * resize computation, and cursor mapping.
 *
 * Extracted from useManipulationInteraction for testability.
 * All functions are side-effect free. [CLEAN-CODE]
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';

// ── Point-based kind guard ─────────────────────────────────────

/** Expression kinds that use `data.points` for geometry. */
export type PointBasedKind = 'line' | 'arrow' | 'freehand';

/**
 * Check if an expression kind uses point-based geometry.
 *
 * Lines, arrows, and freehand shapes store their geometry in
 * `data.points` rather than using `position`/`size` alone. [CLEAN-CODE]
 */
export function isPointBasedKind(kind: string): kind is PointBasedKind {
  return kind === 'line' || kind === 'arrow' || kind === 'freehand';
}

// ── Handle types ──────────────────────────────────────────────

/** The 8 resize handle positions (4 corners + 4 edge midpoints). */
export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Result of detecting a handle at a given point. */
export interface HandleHit {
  type: HandleType;
  expressionId: string;
}

/** Result of detecting a point handle (endpoint of a line/arrow/freehand). */
export interface PointHandleHit {
  pointIndex: number;
  expressionId: string;
}

/** Result of detecting what the pointer is hovering over. */
export type PointerTarget =
  | { kind: 'handle'; handle: HandleHit }
  | { kind: 'point-handle'; handle: PointHandleHit }
  | { kind: 'body'; expressionId: string }
  | { kind: 'none' };

/** Tolerance in screen pixels for handle detection. */
const HANDLE_TOLERANCE_PX = 8;

/** Minimum expression size in world units. */
export const MIN_SIZE = 10;

// ── Handle detection ──────────────────────────────────────────

/**
 * Compute the 8 handle positions for an expression in world coordinates.
 *
 * Order matches selectionRenderer.ts:
 *   [nw, ne, se, sw, n, e, s, w]
 */
export function getHandlePositions(
  expr: VisualExpression,
): Array<{ x: number; y: number; type: HandleType }> {
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  return [
    { x, y, type: 'nw' },
    { x: x + width, y, type: 'ne' },
    { x: x + width, y: y + height, type: 'se' },
    { x, y: y + height, type: 'sw' },
    { x: x + width / 2, y, type: 'n' },
    { x: x + width, y: y + height / 2, type: 'e' },
    { x: x + width / 2, y: y + height, type: 's' },
    { x, y: y + height / 2, type: 'w' },
  ];
}

/**
 * Detect which bbox handle (if any) is at the given world point.
 *
 * Checks all selected non-point-based expressions' handles. Returns the
 * first hit within HANDLE_TOLERANCE_PX screen pixels of the handle center.
 * Point-based shapes (line, arrow, freehand) are skipped — they use
 * point handles instead.
 */
export function detectHandle(
  worldPoint: { x: number; y: number },
  expressions: Record<string, VisualExpression>,
  selectedIds: Set<string>,
  camera: Camera,
): HandleHit | null {
  const tolerance = HANDLE_TOLERANCE_PX / camera.zoom;

  for (const id of selectedIds) {
    const expr = expressions[id];
    if (!expr) continue;

    // Point-based shapes use point handles, not bbox handles
    if (isPointBasedKind(expr.data.kind)) continue;

    const handles = getHandlePositions(expr);
    for (const handle of handles) {
      const dx = worldPoint.x - handle.x;
      const dy = worldPoint.y - handle.y;
      if (Math.abs(dx) <= tolerance && Math.abs(dy) <= tolerance) {
        return { type: handle.type, expressionId: id };
      }
    }
  }

  return null;
}

// ── Point-based handle detection ──────────────────────────────

/**
 * Compute point handle positions for a point-based expression.
 *
 * - Lines and arrows: returns a handle at each point in `data.points`.
 * - Freehand: returns handles at first and last point only (not all points).
 * - Non-point-based expressions: returns empty array.
 *
 * @returns Array of handle positions with their point index.
 */
export function getPointHandlePositions(
  expr: VisualExpression,
): Array<{ x: number; y: number; pointIndex: number }> {
  if (!isPointBasedKind(expr.data.kind)) return [];

  const data = expr.data as { points: [number, number][] | [number, number, number][] };
  const { points } = data;

  if (points.length === 0) return [];

  if (expr.data.kind === 'freehand') {
    // Freehand: first and last point only
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (points.length === 1) {
      return [{ x: first[0], y: first[1], pointIndex: 0 }];
    }
    return [
      { x: first[0], y: first[1], pointIndex: 0 },
      { x: last[0], y: last[1], pointIndex: points.length - 1 },
    ];
  }

  // Lines and arrows: handle at each point
  return points.map((p, i) => ({ x: p[0], y: p[1], pointIndex: i }));
}

/**
 * Detect which point handle (if any) is at the given world point.
 *
 * Only checks point-based expressions (line, arrow, freehand).
 * Returns the first hit within HANDLE_TOLERANCE_PX screen pixels.
 */
export function detectPointHandle(
  worldPoint: { x: number; y: number },
  expressions: Record<string, VisualExpression>,
  selectedIds: Set<string>,
  camera: Camera,
): PointHandleHit | null {
  const tolerance = HANDLE_TOLERANCE_PX / camera.zoom;

  for (const id of selectedIds) {
    const expr = expressions[id];
    if (!expr || !isPointBasedKind(expr.data.kind)) continue;

    const handles = getPointHandlePositions(expr);
    for (const handle of handles) {
      const dx = worldPoint.x - handle.x;
      const dy = worldPoint.y - handle.y;
      if (Math.abs(dx) <= tolerance && Math.abs(dy) <= tolerance) {
        return { pointIndex: handle.pointIndex, expressionId: id };
      }
    }
  }

  return null;
}

/**
 * Detect what the pointer is targeting: a handle, a shape body, or nothing.
 *
 * Priority: point handles (for point-based shapes) → bbox handles → body.
 * Point-based shapes (line, arrow, freehand) use point handles instead
 * of the 8 bounding-box handles.
 */
export function detectPointerTarget(
  worldPoint: { x: number; y: number },
  expressions: Record<string, VisualExpression>,
  selectedIds: Set<string>,
  camera: Camera,
): PointerTarget {
  // Check point handles first (for line/arrow/freehand)
  const pointHandle = detectPointHandle(worldPoint, expressions, selectedIds, camera);
  if (pointHandle) {
    return { kind: 'point-handle', handle: pointHandle };
  }

  // Check bbox handles (only for non-point-based shapes)
  const handle = detectHandle(worldPoint, expressions, selectedIds, camera);
  if (handle) {
    return { kind: 'handle', handle };
  }

  // Check shape bodies (only selected shapes can be moved)
  for (const id of selectedIds) {
    const expr = expressions[id];
    if (!expr) continue;

    const { x, y } = expr.position;
    const { width, height } = expr.size;

    if (
      worldPoint.x >= x &&
      worldPoint.x <= x + width &&
      worldPoint.y >= y &&
      worldPoint.y <= y + height
    ) {
      return { kind: 'body', expressionId: id };
    }
  }

  return { kind: 'none' };
}

// ── Cursor mapping ────────────────────────────────────────────

/** Map a handle type to its CSS cursor value. */
const HANDLE_CURSORS: Record<HandleType, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

/** Get the appropriate CSS cursor for a pointer target. */
export function getCursorForTarget(target: PointerTarget): string {
  switch (target.kind) {
    case 'handle':
      return HANDLE_CURSORS[target.handle.type];
    case 'point-handle':
      return 'crosshair';
    case 'body':
      return 'move';
    case 'none':
      return 'default';
  }
}

// ── Resize computation ────────────────────────────────────────

interface ResizeInput {
  handleType: HandleType;
  deltaX: number;
  deltaY: number;
  originalPosition: { x: number; y: number };
  originalSize: { width: number; height: number };
  shiftKey: boolean;
}

interface ResizeResult {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Compute new position and size after a resize drag.
 *
 * Corner handles resize both dimensions; edge handles resize one dimension.
 * Shift key constrains aspect ratio on corner handles.
 * Minimum size is enforced at MIN_SIZE × MIN_SIZE world units. [AC5]
 */
export function computeResize(input: ResizeInput): ResizeResult {
  const { handleType, deltaX, deltaY, originalPosition, originalSize, shiftKey } = input;

  let newX = originalPosition.x;
  let newY = originalPosition.y;
  let newWidth = originalSize.width;
  let newHeight = originalSize.height;

  switch (handleType) {
    // ── Corner handles: resize both dimensions ──
    case 'se':
      newWidth = originalSize.width + deltaX;
      newHeight = originalSize.height + deltaY;
      break;
    case 'nw':
      newWidth = originalSize.width - deltaX;
      newHeight = originalSize.height - deltaY;
      newX = originalPosition.x + deltaX;
      newY = originalPosition.y + deltaY;
      break;
    case 'ne':
      newWidth = originalSize.width + deltaX;
      newHeight = originalSize.height - deltaY;
      newY = originalPosition.y + deltaY;
      break;
    case 'sw':
      newWidth = originalSize.width - deltaX;
      newHeight = originalSize.height + deltaY;
      newX = originalPosition.x + deltaX;
      break;

    // ── Edge handles: resize one dimension only ──
    case 'e':
      newWidth = originalSize.width + deltaX;
      break;
    case 'w':
      newWidth = originalSize.width - deltaX;
      newX = originalPosition.x + deltaX;
      break;
    case 's':
      newHeight = originalSize.height + deltaY;
      break;
    case 'n':
      newHeight = originalSize.height - deltaY;
      newY = originalPosition.y + deltaY;
      break;
  }

  // ── Shift: constrain aspect ratio on corner handles ──
  if (shiftKey && isCornerHandle(handleType)) {
    const aspectRatio = originalSize.width / originalSize.height;

    if (newWidth / aspectRatio > newHeight) {
      // Width is the dominant change; adjust height
      newHeight = newWidth / aspectRatio;
    } else {
      // Height is the dominant change; adjust width
      newWidth = newHeight * aspectRatio;
    }

    // Re-adjust position for handles that move the origin
    if (handleType === 'nw') {
      newX = originalPosition.x + originalSize.width - newWidth;
      newY = originalPosition.y + originalSize.height - newHeight;
    } else if (handleType === 'ne') {
      newY = originalPosition.y + originalSize.height - newHeight;
    } else if (handleType === 'sw') {
      newX = originalPosition.x + originalSize.width - newWidth;
    }
    // 'se' doesn't move the origin
  }

  // ── Enforce minimum size [AC5] ──
  if (newWidth < MIN_SIZE) {
    // Adjust position back if this handle moves the origin
    if (handleType === 'nw' || handleType === 'sw' || handleType === 'w') {
      newX = originalPosition.x + originalSize.width - MIN_SIZE;
    }
    newWidth = MIN_SIZE;
  }
  if (newHeight < MIN_SIZE) {
    if (handleType === 'nw' || handleType === 'ne' || handleType === 'n') {
      newY = originalPosition.y + originalSize.height - MIN_SIZE;
    }
    newHeight = MIN_SIZE;
  }

  return {
    position: { x: newX, y: newY },
    size: { width: newWidth, height: newHeight },
  };
}

/** Check if a handle is a corner handle (resizes both dimensions). */
function isCornerHandle(type: HandleType): boolean {
  return type === 'nw' || type === 'ne' || type === 'se' || type === 'sw';
}

// ── Point drag computation ────────────────────────────────────

interface PointDragInput {
  /** Index of the point being dragged. */
  pointIndex: number;
  /** Original points array (not mutated). */
  originalPoints: [number, number][];
  /** New world position for the dragged point. */
  newPointPosition: { x: number; y: number };
}

interface PointDragResult {
  /** Updated points array with the dragged point moved. */
  points: [number, number][];
  /** Recalculated bounding-box position (top-left). */
  position: { x: number; y: number };
  /** Recalculated bounding-box size. Zero dimensions are clamped to 1. */
  size: { width: number; height: number };
}

/**
 * Compute the result of dragging a single point in a point-based shape.
 *
 * Updates the specific point, then recalculates the bounding box
 * (position and size) from all points. Does not mutate the original
 * points array. [CLEAN-CODE]
 */
export function computePointDrag(input: PointDragInput): PointDragResult {
  const { pointIndex, originalPoints, newPointPosition } = input;

  // Clone points and update the dragged point
  const points: [number, number][] = originalPoints.map(
    (p) => [p[0], p[1]] as [number, number],
  );
  points[pointIndex] = [newPointPosition.x, newPointPosition.y];

  // Recalculate bounding box from all points
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    points,
    position: { x: minX, y: minY },
    size: {
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    },
  };
}
