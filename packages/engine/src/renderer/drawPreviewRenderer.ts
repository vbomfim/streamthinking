/**
 * Draw preview renderer.
 *
 * Renders transient dashed outlines during active tool drag.
 * These shapes are NOT committed to the store — they're rendered
 * directly each frame from the tool handler's preview state.
 *
 * @module
 */

import type { DrawPreview } from '../tools/BaseTool.js';

/** Dashed stroke color for draw previews. */
const PREVIEW_STROKE_COLOR = '#4A90D9';

/** Dash pattern for draw previews. */
const PREVIEW_DASH_PATTERN = [6, 4];

/** Stroke width for draw previews. */
const PREVIEW_STROKE_WIDTH = 1.5;

/** Preview fill color (very light blue). */
const PREVIEW_FILL_COLOR = 'rgba(74, 144, 217, 0.08)';

/**
 * Render a draw preview on the canvas context.
 *
 * Called within the render loop after expressions are drawn,
 * while the camera transform is still active (world coordinates).
 */
export function renderDrawPreview(
  ctx: CanvasRenderingContext2D,
  preview: DrawPreview,
): void {
  ctx.save();

  ctx.strokeStyle = PREVIEW_STROKE_COLOR;
  ctx.fillStyle = PREVIEW_FILL_COLOR;
  ctx.lineWidth = PREVIEW_STROKE_WIDTH;
  ctx.setLineDash(PREVIEW_DASH_PATTERN);

  switch (preview.kind) {
    case 'rectangle':
      renderRectanglePreview(ctx, preview);
      break;
    case 'ellipse':
      renderEllipsePreview(ctx, preview);
      break;
    case 'diamond':
      renderDiamondPreview(ctx, preview);
      break;
    case 'line':
      renderLinePreview(ctx, preview);
      break;
    case 'arrow':
      renderArrowPreview(ctx, preview);
      break;
    case 'freehand':
      renderFreehandPreview(ctx, preview);
      break;
  }

  ctx.restore();
}

/** Render rectangle preview as dashed outline with light fill. */
function renderRectanglePreview(ctx: CanvasRenderingContext2D, p: DrawPreview): void {
  ctx.fillRect(p.x, p.y, p.width, p.height);
  ctx.strokeRect(p.x, p.y, p.width, p.height);
}

/** Render ellipse preview as dashed outline with light fill. */
function renderEllipsePreview(ctx: CanvasRenderingContext2D, p: DrawPreview): void {
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const rx = p.width / 2;
  const ry = p.height / 2;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Render diamond preview as dashed outline with light fill. */
function renderDiamondPreview(ctx: CanvasRenderingContext2D, p: DrawPreview): void {
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;

  ctx.beginPath();
  ctx.moveTo(cx, p.y);
  ctx.lineTo(p.x + p.width, cy);
  ctx.lineTo(cx, p.y + p.height);
  ctx.lineTo(p.x, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Render line preview as dashed line. */
function renderLinePreview(ctx: CanvasRenderingContext2D, p: DrawPreview): void {
  if (!p.points || p.points.length < 2) return;

  ctx.beginPath();
  const [first, ...rest] = p.points;
  ctx.moveTo(first![0], first![1]);
  for (const [px, py] of rest) {
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** Render arrow preview as dashed line with arrowhead. */
function renderArrowPreview(ctx: CanvasRenderingContext2D, p: DrawPreview): void {
  if (!p.points || p.points.length < 2) return;

  ctx.beginPath();
  const [first, ...rest] = p.points;
  ctx.moveTo(first![0], first![1]);
  for (const [px, py] of rest) {
    ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw arrowhead at the end
  const last = p.points[p.points.length - 1]!;
  const prev = p.points[p.points.length - 2]!;
  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const size = 10;
  const halfAngle = Math.PI / 6;

  ctx.setLineDash([]);
  ctx.fillStyle = PREVIEW_STROKE_COLOR;
  ctx.beginPath();
  ctx.moveTo(last[0], last[1]);
  ctx.lineTo(
    last[0] - size * Math.cos(angle - halfAngle),
    last[1] - size * Math.sin(angle - halfAngle),
  );
  ctx.lineTo(
    last[0] - size * Math.cos(angle + halfAngle),
    last[1] - size * Math.sin(angle + halfAngle),
  );
  ctx.closePath();
  ctx.fill();
}

/** Render freehand preview as dashed polyline. */
function renderFreehandPreview(ctx: CanvasRenderingContext2D, p: DrawPreview): void {
  if (!p.points || p.points.length < 2) return;

  ctx.setLineDash([]);
  ctx.strokeStyle = PREVIEW_STROKE_COLOR;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  const [first, ...rest] = p.points;
  ctx.moveTo(first![0], first![1]);
  for (const [px, py] of rest) {
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}
