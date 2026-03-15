/**
 * Selection renderer — draws selection UI over selected expressions.
 *
 * Renders after all expressions in the render loop:
 * - Dashed bounding box in selection color (#4A90D9)
 * - 8 resize handles (4 corners + 4 edge midpoints)
 *
 * Handle sizes are constant in screen pixels (8×8), scaled inversely
 * by zoom to maintain consistent visual size.
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';

/** Selection highlight color. */
const SELECTION_COLOR = '#4A90D9';

/** Handle size in screen pixels. */
const HANDLE_SIZE_PX = 8;

/** Dash pattern for the selection bounding box. */
const DASH_PATTERN = [4, 4];

/**
 * Render selection UI for all selected expressions.
 *
 * For each selected expression: draws a dashed bounding box and
 * 8 resize handles (white squares with selection-colored borders).
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

    // ── 8 resize handles ─────────────────────────────────────
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
}
