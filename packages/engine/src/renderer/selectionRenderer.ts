/**
 * Selection renderer — draws selection UI over selected expressions.
 *
 * Renders after all expressions in the render loop:
 * - Dashed bounding box in selection color (#4A90D9)
 * - For point-based shapes (line, arrow, freehand): circular handles
 *   at each point (or first/last for freehand)
 * - For other shapes: 8 resize handles (4 corners + 4 edge midpoints)
 *
 * Handle sizes are constant in screen pixels (8×8), scaled inversely
 * by zoom to maintain consistent visual size.
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import {
  isPointBasedKind,
  getPointHandlePositions,
} from '../interaction/manipulationHelpers.js';

/** Selection highlight color. */
const SELECTION_COLOR = '#4A90D9';

/** Group bounding box color — subtle, lighter than selection. */
const GROUP_BORDER_COLOR = '#aaaaaa';

/** Group bounding box dash pattern (wider dots for dotted look). */
const GROUP_DASH_PATTERN = [3, 3];

/** Handle size in screen pixels. */
const HANDLE_SIZE_PX = 8;

/** Dash pattern for the selection bounding box. */
const DASH_PATTERN = [4, 4];

/**
 * Render selection UI for all selected expressions.
 *
 * For point-based shapes (line, arrow, freehand): draws a dashed bounding
 * box and circular handles at each data point.
 * For other shapes: draws a dashed bounding box and 8 resize handles
 * (white squares with selection-colored borders).
 *
 * @param ctx - Canvas 2D rendering context (with camera transform applied)
 * @param selectedIds - Set of currently selected expression IDs
 * @param expressions - All expressions keyed by ID
 * @param camera - Current camera state (for zoom-adjusted handle sizing)
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  selectedIds: Set<string>,
  expressions: Record<string, VisualExpression>,
  camera: Camera,
): void {
  if (selectedIds.size === 0) return;

  // ── Group bounding boxes (rendered before individual selection) ──
  renderGroupBoundingBoxes(ctx, selectedIds, expressions, camera);

  // Handle size in world coordinates (constant screen size)
  const handleSize = HANDLE_SIZE_PX / camera.zoom;
  const halfHandle = handleSize / 2;

  for (const id of selectedIds) {
    const expr = expressions[id];
    if (!expr) continue;

    const { x, y } = expr.position;
    const { width, height } = expr.size;

    // ── Dashed bounding box ──────────────────────────────────
    ctx.save();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / camera.zoom; // 1px screen width
    ctx.setLineDash(DASH_PATTERN.map((d) => d / camera.zoom));
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]); // Reset dash
    ctx.restore();

    if (isPointBasedKind(expr.data.kind)) {
      // ── Circular point handles for line/arrow/freehand ───
      renderPointHandles(ctx, expr, camera, halfHandle);
    } else {
      // ── 8 resize handles for other shapes ───────────────
      renderBboxHandles(ctx, expr, camera, handleSize, halfHandle);
    }
  }
}

/**
 * Render circular handles at each data point of a point-based expression.
 *
 * Handles are white circles with selection-colored borders, sized
 * to match the standard handle size in screen pixels.
 */
function renderPointHandles(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
  camera: Camera,
  radius: number,
): void {
  const pointHandles = getPointHandlePositions(expr);

  // Check for drag offset: during transient drag, position changes
  // but data.points don't — skip handles to avoid stale positions
  const data = expr.data as { points?: [number, number][] };
  if (data.points && data.points.length > 0) {
    const firstPoint = data.points[0];
    const expectedMinX = Math.min(...data.points.map(p => p[0]));
    const expectedMinY = Math.min(...data.points.map(p => p[1]));
    if (Math.abs(expr.position.x - expectedMinX) > 0.5 ||
        Math.abs(expr.position.y - expectedMinY) > 0.5) {
      // Position is offset from points — we're mid-drag, skip handles
      return;
    }
  }

  for (const { x: px, y: py } of pointHandles) {
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Selection-colored border
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / camera.zoom;
    ctx.stroke();
  }
}

/**
 * Render the 8 bounding-box resize handles (4 corners + 4 edge midpoints).
 *
 * Handles are white squares with selection-colored borders.
 */
function renderBboxHandles(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
  camera: Camera,
  handleSize: number,
  halfHandle: number,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  const handlePoints = [
    // Corners
    { hx: x, hy: y },                             // top-left
    { hx: x + width, hy: y },                     // top-right
    { hx: x + width, hy: y + height },             // bottom-right
    { hx: x, hy: y + height },                     // bottom-left
    // Edge midpoints
    { hx: x + width / 2, hy: y },                 // top-mid
    { hx: x + width, hy: y + height / 2 },         // right-mid
    { hx: x + width / 2, hy: y + height },         // bottom-mid
    { hx: x, hy: y + height / 2 },                 // left-mid
  ];

  for (const { hx, hy } of handlePoints) {
    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - halfHandle, hy - halfHandle, handleSize, handleSize);

    // Selection-colored border
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1 / camera.zoom;
    ctx.strokeRect(hx - halfHandle, hy - halfHandle, handleSize, handleSize);
  }
}

/**
 * Render dotted bounding boxes around groups when any member is selected.
 *
 * Collects unique group IDs from selected expressions, computes the
 * bounding box of all members in each group, and draws a subtle dotted
 * border (#aaa) around the group extent.
 */
function renderGroupBoundingBoxes(
  ctx: CanvasRenderingContext2D,
  selectedIds: Set<string>,
  expressions: Record<string, VisualExpression>,
  camera: Camera,
): void {
  // Collect unique group IDs from selected expressions
  const groupIds = new Set<string>();
  for (const id of selectedIds) {
    const parentId = expressions[id]?.parentId;
    if (parentId) groupIds.add(parentId);
  }

  if (groupIds.size === 0) return;

  // For each group, find ALL members (not just selected) and compute bounding box
  for (const groupId of groupIds) {
    const members = Object.values(expressions).filter(
      (expr) => expr.parentId === groupId,
    );
    if (members.length < 2) continue;

    // Compute bounding box of all group members
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const member of members) {
      const { x, y } = member.position;
      const { width, height } = member.size;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    // Add small padding (4px screen) around group bounding box
    const padding = 4 / camera.zoom;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    // Draw dotted border
    ctx.save();
    ctx.strokeStyle = GROUP_BORDER_COLOR;
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash(GROUP_DASH_PATTERN.map((d) => d / camera.zoom));
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.setLineDash([]);
    ctx.restore();
  }
}
