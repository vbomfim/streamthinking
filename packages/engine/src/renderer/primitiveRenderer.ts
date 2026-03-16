/**
 * Primitive expression renderer.
 *
 * Renders all 9 primitive expression kinds using Rough.js for shapes
 * and native canvas API for text, freehand, and images.
 *
 * Each frame: iterate expressionOrder → cull → draw in z-order.
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { RoughCanvas } from 'roughjs/bin/canvas.js';
import type { Drawable } from 'roughjs/bin/core.js';
import getStroke from 'perfect-freehand';
import type { Camera } from '../types/index.js';
import { mapStyleToRoughOptions } from './styleMapper.js';
import { isVisible } from './viewportCulling.js';
import { createDrawableCache } from './drawableCache.js';
import type { DrawableCache } from './drawableCache.js';
import { getCompositeRenderer } from './compositeRegistry.js';
import { resolveBindings } from '../interaction/connectorHelpers.js';

// ── Constants ────────────────────────────────────────────────

/** Arrowhead size in world pixels. */
const ARROWHEAD_SIZE = 10;

/** Sticky note rotation in radians (2°). */
const STICKY_NOTE_ROTATION = (2 * Math.PI) / 180;

/** Padding inside sticky notes for text (in px). */
const STICKY_NOTE_PADDING = 12;

/** Default font size when not specified. */
const DEFAULT_FONT_SIZE = 16;

/** Default font family when not specified. */
const DEFAULT_FONT_FAMILY = 'sans-serif';

/** Line height multiplier for text wrapping. */
const LINE_HEIGHT_MULTIPLIER = 1.4;

// ── Image cache ──────────────────────────────────────────────

/** Global image element cache. Maps src URL → loaded HTMLImageElement. */
const imageCache = new Map<string, HTMLImageElement>();

/** Set of image URLs currently being loaded. */
const imageLoading = new Set<string>();

/** Set of image URLs that failed to load. */
const imageFailed = new Set<string>();

/**
 * Get a cached image element, starting async load if needed.
 *
 * Returns the image if loaded, undefined if still loading,
 * or null if the load failed.
 */
function getCachedImage(src: string): HTMLImageElement | undefined | null {
  if (imageFailed.has(src)) return null;

  const cached = imageCache.get(src);
  if (cached) return cached;

  if (!imageLoading.has(src)) {
    imageLoading.add(src);
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      imageLoading.delete(src);
    };
    img.onerror = () => {
      imageFailed.add(src);
      imageLoading.delete(src);
    };
    img.src = src;
  }

  return undefined;
}

// ── Drawable cache (module-level singleton) ──────────────────

const drawableCache: DrawableCache = createDrawableCache();

// ── Public API ───────────────────────────────────────────────

/**
 * Render all visible expressions in z-order. [AC1] [AC12] [AC13]
 *
 * Iterates `expressionOrder` (index 0 = back), skips off-screen
 * expressions via viewport culling, and renders each visible
 * expression using the appropriate primitive renderer.
 */
export function renderExpressions(
  ctx: CanvasRenderingContext2D,
  roughCanvas: RoughCanvas,
  expressions: Record<string, VisualExpression>,
  expressionOrder: string[],
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  for (const id of expressionOrder) {
    const expr = expressions[id];
    if (!expr) continue;

    // Viewport culling [AC12]
    const bbox = {
      x: expr.position.x,
      y: expr.position.y,
      width: expr.size.width,
      height: expr.size.height,
    };

    if (!isVisible(bbox, camera, viewportWidth, viewportHeight)) continue;

    // Apply opacity [AC11]
    ctx.save();
    ctx.globalAlpha = expr.style.opacity;

    renderPrimitive(ctx, roughCanvas, expr, expressions);

    ctx.restore();
  }
}

/**
 * Dispatch to the correct renderer by expression kind.
 *
 * Checks primitives first, then composite registry, then placeholder. [AC15]
 */
function renderPrimitive(
  ctx: CanvasRenderingContext2D,
  roughCanvas: RoughCanvas,
  expr: VisualExpression,
  expressions: Record<string, VisualExpression>,
): void {
  const { kind } = expr;

  switch (kind) {
    case 'rectangle':
      renderRectangle(ctx, roughCanvas, expr);
      break;
    case 'ellipse':
      renderEllipse(ctx, roughCanvas, expr);
      break;
    case 'diamond':
      renderDiamond(ctx, roughCanvas, expr);
      break;
    case 'line':
      renderLine(ctx, roughCanvas, expr);
      break;
    case 'arrow':
      renderArrow(ctx, roughCanvas, expr, expressions);
      break;
    case 'freehand':
      renderFreehand(ctx, expr);
      break;
    case 'text':
      renderText(ctx, expr);
      break;
    case 'sticky-note':
      renderStickyNote(ctx, expr);
      break;
    case 'image':
      renderImage(ctx, expr);
      break;
    default: {
      // Check composite renderer registry before falling back
      const compositeRenderer = getCompositeRenderer(kind);
      if (compositeRenderer) {
        compositeRenderer(ctx, expr, roughCanvas);
      } else {
        renderPlaceholder(ctx, expr);
      }
      break;
    }
  }
}

// ── Shape renderers (Rough.js) ───────────────────────────────

/** Render rectangle. [AC2] */
function renderRectangle(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;
  const options = mapStyleToRoughOptions(expr.style);

  const drawable = getOrCreateDrawable(expr, () =>
    rc.rectangle(x, y, width, height, options),
  );

  rc.draw(drawable);

  // Center label if present
  if (expr.data.kind === 'rectangle' && expr.data.label) {
    renderLabel(ctx, expr.data.label, x, y, width, height, expr.style);
  }
}

/** Render ellipse. [AC3] */
function renderEllipse(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const options = mapStyleToRoughOptions(expr.style);

  const drawable = getOrCreateDrawable(expr, () =>
    rc.ellipse(cx, cy, width, height, options),
  );

  rc.draw(drawable);

  if (expr.data.kind === 'ellipse' && expr.data.label) {
    renderLabel(ctx, expr.data.label, x, y, width, height, expr.style);
  }
}

/** Render diamond. [AC4] */
function renderDiamond(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const options = mapStyleToRoughOptions(expr.style);

  const points: [number, number][] = [
    [cx, y],           // top
    [x + width, cy],   // right
    [cx, y + height],  // bottom
    [x, cy],           // left
  ];

  const drawable = getOrCreateDrawable(expr, () =>
    rc.polygon(points, options),
  );

  rc.draw(drawable);

  if (expr.data.kind === 'diamond' && expr.data.label) {
    renderLabel(ctx, expr.data.label, x, y, width, height, expr.style);
  }
}

/** Render line. [AC5] */
function renderLine(
  _ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'line') return;
  const { points } = expr.data;
  const options = mapStyleToRoughOptions(expr.style);
  const offset = computePositionOffset(expr);

  if (offset.x !== 0 || offset.y !== 0) {
    _ctx.save();
    _ctx.translate(offset.x, offset.y);
  }

  const drawable = getOrCreateDrawable(expr, () =>
    rc.linearPath(points, options),
  );

  rc.draw(drawable);

  if (offset.x !== 0 || offset.y !== 0) {
    _ctx.restore();
  }
}

/** Render arrow with arrowheads and connector bindings. [AC6] */
function renderArrow(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
  expressions: Record<string, VisualExpression>,
): void {
  if (expr.data.kind !== 'arrow') return;
  const { startArrowhead, endArrowhead } = expr.data;
  const options = mapStyleToRoughOptions(expr.style);
  const offset = computePositionOffset(expr);

  // Resolve binding positions for connected arrows [CLEAN-CODE]
  const points = resolveBindings(expr, expressions);
  if (points.length < 2) return;

  if (offset.x !== 0 || offset.y !== 0) {
    ctx.save();
    ctx.translate(offset.x, offset.y);
  }

  const drawable = getOrCreateDrawable(expr, () =>
    rc.linearPath(points, options),
  );

  rc.draw(drawable);

  // Draw arrowheads
  ctx.fillStyle = expr.style.strokeColor;

  if (endArrowhead && points.length >= 2) {
    const last = points[points.length - 1]!;
    const prev = points[points.length - 2]!;
    const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    renderArrowhead(ctx, last[0], last[1], angle, ARROWHEAD_SIZE);
  }

  if (startArrowhead && points.length >= 2) {
    const first = points[0]!;
    const second = points[1]!;
    const angle = Math.atan2(first[1] - second[1], first[0] - second[0]);
    renderArrowhead(ctx, first[0], first[1], angle, ARROWHEAD_SIZE);
  }

  if (offset.x !== 0 || offset.y !== 0) {
    ctx.restore();
  }
}

// ── Non-Rough.js renderers ───────────────────────────────────

/** Render freehand stroke using perfect-freehand. [AC7] */
function renderFreehand(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'freehand') return;
  const { points } = expr.data;

  const outlinePoints = getStroke(points, {
    size: expr.style.strokeWidth * 4,
    smoothing: 0.5,
    thinning: 0.5,
    simulatePressure: false,
  });

  if (outlinePoints.length === 0) return;

  const offset = computePositionOffset(expr);

  if (offset.x !== 0 || offset.y !== 0) {
    ctx.save();
    ctx.translate(offset.x, offset.y);
  }

  const path = new Path2D();
  const [first, ...rest] = outlinePoints;
  path.moveTo(first![0], first![1]);
  for (const [px, py] of rest) {
    path.lineTo(px, py);
  }
  path.closePath();

  ctx.fillStyle = expr.style.strokeColor;
  ctx.fill(path);

  if (offset.x !== 0 || offset.y !== 0) {
    ctx.restore();
  }
}

/** Render text with word-wrap. [AC8] */
function renderText(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'text') return;
  const { text, fontSize, fontFamily, textAlign } = expr.data;
  const { x, y } = expr.position;
  const { width } = expr.size;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'top';
  ctx.fillStyle = expr.style.strokeColor;

  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
  const lines = wrapText(ctx, text, width);

  let textX = x;
  if (textAlign === 'center') textX = x + width / 2;
  else if (textAlign === 'right') textX = x + width;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, textX, y + i * lineHeight);
  }
}

/** Render sticky note with background, rotation, and text. [AC9] */
function renderStickyNote(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'sticky-note') return;
  const { text, color } = expr.data;
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  ctx.save();

  // Apply slight rotation at center
  const cx = x + width / 2;
  const cy = y + height / 2;
  ctx.translate(cx, cy);
  ctx.rotate(STICKY_NOTE_ROTATION);
  ctx.translate(-cx, -cy);

  // Draw colored background
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);

  // Draw text with padding
  const fontSize = expr.style.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = expr.style.fontFamily ?? DEFAULT_FONT_FAMILY;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';

  const textWidth = width - STICKY_NOTE_PADDING * 2;
  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
  const lines = wrapText(ctx, text, textWidth);

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(
      lines[i]!,
      x + STICKY_NOTE_PADDING,
      y + STICKY_NOTE_PADDING + i * lineHeight,
    );
  }

  ctx.restore();
}

/** Render image (async load + cache). [AC10] */
function renderImage(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'image') return;
  const { src } = expr.data;
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  const img = getCachedImage(src);

  if (img) {
    // Image loaded — draw it
    ctx.drawImage(img, x, y, width, height);
  } else {
    // Image loading or failed — draw placeholder
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#666666';
    ctx.font = `${Math.min(width, height) * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠', x + width / 2, y + height / 2);
  }
}

// ── Placeholder renderer ─────────────────────────────────────

/** Corner radius for placeholder rounded rectangle (px). */
const PLACEHOLDER_CORNER_RADIUS = 8;

/** Placeholder background color. */
const PLACEHOLDER_BG_COLOR = '#e8e8e8';

/** Placeholder border color. */
const PLACEHOLDER_BORDER_COLOR = '#999999';

/** Placeholder text color. */
const PLACEHOLDER_TEXT_COLOR = '#666666';

/**
 * Render a placeholder for unknown/unimplemented expression kinds. [AC3]
 *
 * Draws a gray rounded rectangle with the kind name centered inside,
 * providing a visible indicator that a renderer for this kind is needed.
 */
function renderPlaceholder(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;
  const r = Math.min(PLACEHOLDER_CORNER_RADIUS, width / 2, height / 2);

  ctx.save();

  // Draw rounded rectangle background
  ctx.fillStyle = PLACEHOLDER_BG_COLOR;
  ctx.strokeStyle = PLACEHOLDER_BORDER_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw kind name centered
  ctx.fillStyle = PLACEHOLDER_TEXT_COLOR;
  ctx.font = `14px ${DEFAULT_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(expr.kind, x + width / 2, y + height / 2);

  ctx.restore();
}

// ── Helpers (exported for testing) ───────────────────────────

/**
 * Render a centered label inside a bounding box.
 *
 * Sets font, textAlign='center', textBaseline='middle', and draws
 * the text at the center of the given rectangle.
 */
export function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  style: ExpressionStyle,
): void {
  if (!label) return;

  const fontSize = style.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.strokeColor;
  ctx.fillText(label, x + width / 2, y + height / 2);
}

/**
 * Draw a filled triangle arrowhead at the given point.
 *
 * The arrowhead points in the direction of `angle` (radians).
 * The triangle has a base of `size` and height of `size`.
 */
export function renderArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  size: number,
): void {
  const halfAngle = Math.PI / 6; // 30° half-angle

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - size * Math.cos(angle - halfAngle),
    tipY - size * Math.sin(angle - halfAngle),
  );
  ctx.lineTo(
    tipX - size * Math.cos(angle + halfAngle),
    tipY - size * Math.sin(angle + halfAngle),
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Word-wrap text to fit within a maximum width.
 *
 * Splits on word boundaries. Words wider than maxWidth are kept
 * on their own line (not broken mid-word).
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return [];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// ── Position offset for point-based shapes ───────────────────

/** Point-based expression kinds whose rendering uses data.points. */
const POINT_BASED_KINDS = new Set(['line', 'arrow', 'freehand']);

/**
 * Compute the rendering offset for point-based expressions.
 *
 * During a transient drag, only `expr.position` is updated while
 * `data.points` remain at their original absolute world coordinates.
 * This function returns the delta between the current `position` and
 * the bounding-box minimum of `data.points`, so the renderer can
 * apply a `ctx.translate(offset)` to keep the shape visually in sync
 * with the selection bounding box.
 *
 * For non-point-based shapes (rectangle, ellipse, etc.) this always
 * returns `{ x: 0, y: 0 }` because they render directly from
 * `expr.position`. [CLEAN-CODE]
 */
export function computePositionOffset(
  expr: VisualExpression,
): { x: number; y: number } {
  if (!POINT_BASED_KINDS.has(expr.kind)) {
    return { x: 0, y: 0 };
  }

  const data = expr.data as { points?: unknown[] };
  if (!data.points || data.points.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;

  for (const pt of data.points) {
    const point = pt as number[];
    const px = point[0];
    const py = point[1];
    if (px !== undefined && px < minX) minX = px;
    if (py !== undefined && py < minY) minY = py;
  }

  if (!isFinite(minX) || !isFinite(minY)) {
    return { x: 0, y: 0 };
  }

  return {
    x: expr.position.x - minX,
    y: expr.position.y - minY,
  };
}

// ── Drawable cache helper ────────────────────────────────────

/**
 * Get a cached drawable or create a new one. [AC14]
 *
 * Uses the module-level drawable cache keyed by expression ID + render hash
 * (style, position, size, and data).
 */
function getOrCreateDrawable(
  expr: VisualExpression,
  create: () => Drawable,
): Drawable {
  const ctx = { style: expr.style, position: expr.position, size: expr.size, data: expr.data };
  const cached = drawableCache.get(expr.id, ctx);
  if (cached) return cached;

  const drawable = create();
  drawableCache.set(expr.id, ctx, drawable);
  return drawable;
}

/**
 * Clear the drawable cache. Useful when resetting renderer state.
 */
export function clearDrawableCache(): void {
  drawableCache.clear();
}

/**
 * Clear the image cache. Useful for testing.
 */
export function clearImageCache(): void {
  imageCache.clear();
  imageLoading.clear();
  imageFailed.clear();
}
