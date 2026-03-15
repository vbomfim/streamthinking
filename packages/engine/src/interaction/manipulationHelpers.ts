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

// ── Handle types ──────────────────────────────────────────────

/** The 8 resize handle positions (4 corners + 4 edge midpoints). */
export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Result of detecting a handle at a given point. */
export interface HandleHit {
  type: HandleType;
  expressionId: string;
}

/** Result of detecting what the pointer is hovering over. */
export type PointerTarget =
  | { kind: 'handle'; handle: HandleHit }
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
 * Detect which handle (if any) is at the given world point.
 *
 * Checks all selected expressions' handles. Returns the first hit
 * within HANDLE_TOLERANCE_PX screen pixels of the handle center.
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

/**
 * Detect what the pointer is targeting: a handle, a shape body, or nothing.
 *
 * Priority: handles first (so users can grab edges), then body.
 */
export function detectPointerTarget(
  worldPoint: { x: number; y: number },
  expressions: Record<string, VisualExpression>,
  selectedIds: Set<string>,
  camera: Camera,
): PointerTarget {
  // Check handles first
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
