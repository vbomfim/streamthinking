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

    renderPrimitive(ctx, roughCanvas, expr);

    ctx.restore();
  }
}

/**
 * Dispatch to the correct renderer by expression kind.
 *
 * Unknown kinds emit a console.warn and are skipped. [AC15]
 */
function renderPrimitive(
  ctx: CanvasRenderingContext2D,
  roughCanvas: RoughCanvas,
  expr: VisualExpression,
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
      renderArrow(ctx, roughCanvas, expr);
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
    default:
      console.warn(`[PrimitiveRenderer] Unknown expression kind: "${kind}" (id: ${expr.id}). Skipping.`);
      break;
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

  const drawable = getOrCreateDrawable(expr, () =>
    rc.linearPath(points, options),
  );

  rc.draw(drawable);
}

/** Render arrow with arrowheads. [AC6] */
function renderArrow(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'arrow') return;
  const { points, startArrowhead, endArrowhead } = expr.data;
  const options = mapStyleToRoughOptions(expr.style);

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

  const path = new Path2D();
  const [first, ...rest] = outlinePoints;
  path.moveTo(first![0], first![1]);
  for (const [px, py] of rest) {
    path.lineTo(px, py);
  }
  path.closePath();

  ctx.fillStyle = expr.style.strokeColor;
  ctx.fill(path);
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
