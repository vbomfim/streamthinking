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

import type { VisualExpression, ExpressionStyle, ArrowData } from '@infinicanvas/protocol';
import type { RoughCanvas } from 'roughjs/bin/canvas.js';
import type { Drawable } from 'roughjs/bin/core.js';
import getStroke from 'perfect-freehand';
import type { Camera } from '../types/index.js';
import { mapStyleToRoughOptions, idToSeed } from './styleMapper.js';
import { isVisible } from './viewportCulling.js';
import { createDrawableCache } from './drawableCache.js';
import type { DrawableCache } from './drawableCache.js';
import { getCompositeRenderer } from './compositeRegistry.js';
import { resolveBindings } from '../interaction/connectorHelpers.js';
import { getStencil, svgToDataUri } from './stencils/index.js';
import { resolveTextConfig } from '../text/textConfig.js';

// ── Constants ────────────────────────────────────────────────

/** Arrowhead size in world pixels. */
const ARROWHEAD_SIZE = 10;

/** Sticky note rotation in radians (2°). */
const STICKY_NOTE_ROTATION = (2 * Math.PI) / 180;

/** Default font family when not specified. */
const DEFAULT_FONT_FAMILY = 'Architects Daughter, cursive';

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
  editingId?: string | null,
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

    renderPrimitive(ctx, roughCanvas, expr, expressions, editingId, camera);

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
  editingId?: string | null,
  camera?: Camera,
): void {
  const { kind } = expr;
  const isEditing = expr.id === editingId;

  switch (kind) {
    case 'rectangle':
      renderRectangle(ctx, roughCanvas, expr, isEditing);
      break;
    case 'ellipse':
      renderEllipse(ctx, roughCanvas, expr, isEditing);
      break;
    case 'diamond':
      renderDiamond(ctx, roughCanvas, expr, isEditing);
      break;
    case 'line':
      renderLine(ctx, roughCanvas, expr);
      break;
    case 'arrow':
      renderArrow(ctx, roughCanvas, expr, expressions, camera);
      break;
    case 'freehand':
      renderFreehand(ctx, expr);
      break;
    case 'text':
      if (!isEditing) renderText(ctx, expr);
      break;
    case 'sticky-note':
      renderStickyNote(ctx, expr, isEditing);
      break;
    case 'image':
      renderImage(ctx, expr);
      break;
    case 'stencil':
      renderStencil(ctx, expr, isEditing);
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


/** Draw a shape with native canvas API (perfect geometry, no roughness). */
function drawCleanShape(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
  kind: 'rectangle' | 'ellipse' | 'diamond',
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;
  const style = expr.style;
  const noFill = style.fillStyle === 'none' || style.backgroundColor === 'transparent';
  const dash = style.strokeStyle === 'dashed' ? [style.strokeWidth * 4, style.strokeWidth * 3]
    : style.strokeStyle === 'dotted' ? [style.strokeWidth, style.strokeWidth * 2] : [];

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  // Native canvas draws single-pixel lines — scale up to match Rough.js visual weight
  ctx.lineWidth = Math.max(style.strokeWidth * 1.5, 1.5);
  ctx.setLineDash(dash);

  ctx.beginPath();
  if (kind === 'rectangle') {
    ctx.rect(x, y, width, height);
  } else if (kind === 'ellipse') {
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width, y + height / 2);
    ctx.lineTo(x + width / 2, y + height);
    ctx.lineTo(x, y + height / 2);
    ctx.closePath();
  }

  if (!noFill) {
    ctx.fillStyle = style.backgroundColor;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

/** Render rectangle. [AC2] */
function renderRectangle(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
  skipLabel = false,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  if ((expr.style.roughness ?? 0) < 0.1) {
    drawCleanShape(ctx, expr, 'rectangle');
  } else {
    const options = mapStyleToRoughOptions(expr.style, idToSeed(expr.id));
    const drawable = getOrCreateDrawable(expr, () =>
      rc.generator.rectangle(0, 0, width, height, options),
    );
    ctx.save();
    ctx.translate(x, y);
    rc.draw(drawable);
    ctx.restore();
  }

  // Center label if present (skip when editing in-place)
  if (!skipLabel && expr.data.kind === 'rectangle' && expr.data.label) {
    renderLabel(ctx, expr.data.label, x, y, width, height, expr.style);
  }
}

/** Render ellipse. [AC3] */
function renderEllipse(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
  skipLabel = false,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  if ((expr.style.roughness ?? 0) < 0.1) {
    drawCleanShape(ctx, expr, 'ellipse');
  } else {
    const options = mapStyleToRoughOptions(expr.style, idToSeed(expr.id));
    const drawable = getOrCreateDrawable(expr, () =>
      rc.generator.ellipse(width / 2, height / 2, width, height, options),
    );
    ctx.save();
    ctx.translate(x, y);
    rc.draw(drawable);
    ctx.restore();
  }

  if (!skipLabel && expr.data.kind === 'ellipse' && expr.data.label) {
    renderLabel(ctx, expr.data.label, x, y, width, height, expr.style);
  }
}

/** Render diamond. [AC4] */
function renderDiamond(
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  expr: VisualExpression,
  skipLabel = false,
): void {
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  if ((expr.style.roughness ?? 0) < 0.1) {
    drawCleanShape(ctx, expr, 'diamond');
  } else {
    const options = mapStyleToRoughOptions(expr.style, idToSeed(expr.id));
    const points: [number, number][] = [
      [width / 2, 0],
      [width, height / 2],
      [width / 2, height],
      [0, height / 2],
    ];
    const drawable = getOrCreateDrawable(expr, () =>
      rc.generator.polygon(points, options),
    );
    ctx.save();
    ctx.translate(x, y);
    rc.draw(drawable);
    ctx.restore();
  }

  if (!skipLabel && expr.data.kind === 'diamond' && expr.data.label) {
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
  const options = mapStyleToRoughOptions(expr.style, idToSeed(expr.id));
  const offset = computePositionOffset(expr);

  if (offset.x !== 0 || offset.y !== 0) {
    _ctx.save();
    _ctx.translate(offset.x, offset.y);
  }

  const drawable = getOrCreateDrawable(expr, () =>
    rc.generator.linearPath(points, options),
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
  camera?: Camera,
): void {
  if (expr.data.kind !== 'arrow') return;
  const data = expr.data as ArrowData;
  const startType = resolveArrowheadType(data.startArrowhead);
  const endType = resolveArrowheadType(data.endArrowhead);
  const options = mapStyleToRoughOptions(expr.style, idToSeed(expr.id));
  // Arrowhead must always be larger than the stroke width
  const zoom = camera?.zoom ?? 1;
  const baseArrowSize = 5 + ARROWHEAD_SIZE * (expr.style.strokeWidth / 2);
  const minArrowSize = Math.max(expr.style.strokeWidth * 4, 8 / zoom);
  const arrowSize = Math.max(baseArrowSize, minArrowSize);

  // Resolve binding positions for connected arrows
  const points = resolveBindings(expr, expressions);
  if (points.length < 2) return;

  // Skip position offset for bound arrows — resolveBindings returns absolute
  // world coordinates, so applying an offset would double-shift the arrow.
  const hasBound = data.startBinding || data.endBinding;
  const offset = hasBound ? { x: 0, y: 0 } : computePositionOffset(expr);

  if (offset.x !== 0 || offset.y !== 0) {
    ctx.save();
    ctx.translate(offset.x, offset.y);
  }

  // Self-loop detection: both ends bound to the same shape
  const isSelfLoop = data.startBinding && data.endBinding &&
    data.startBinding.expressionId === data.endBinding.expressionId;

  if (isSelfLoop) {
    // Draw a curved self-referencing arrow
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const target = expressions[data.startBinding!.expressionId];
    const loopSize = target ? Math.max(target.size.width, target.size.height) * 0.6 : 60;

    // Compute control points — curve outward from the shape
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;
    const cx = target ? target.position.x + target.size.width / 2 : midX;
    const cy = target ? target.position.y + target.size.height / 2 : midY;

    // Direction away from shape center
    const dx = midX - cx;
    const dy = midY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    const cp1x = start[0] + nx * loopSize;
    const cp1y = start[1] + ny * loopSize;
    const cp2x = end[0] + nx * loopSize;
    const cp2y = end[1] + ny * loopSize;

    ctx.save();
    ctx.strokeStyle = expr.style.strokeColor;
    ctx.lineWidth = expr.style.strokeWidth;
    ctx.globalAlpha = expr.style.opacity;
    const ss = expr.style.strokeStyle ?? 'solid';
    if (ss === 'dashed') ctx.setLineDash([expr.style.strokeWidth * 4, expr.style.strokeWidth * 3]);
    else if (ss === 'dotted') ctx.setLineDash([expr.style.strokeWidth, expr.style.strokeWidth * 2]);
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end[0], end[1]);
    ctx.stroke();
    ctx.restore();

    // Arrowheads for self-loop
    ctx.fillStyle = expr.style.strokeColor;
    if (endType !== 'none') {
      const angle = Math.atan2(end[1] - cp2y, end[0] - cp2x);
      renderArrowhead(ctx, end[0], end[1], angle, arrowSize, endType);
    }
    if (startType !== 'none') {
      const angle = Math.atan2(start[1] - cp1y, start[0] - cp1x);
      renderArrowhead(ctx, start[0], start[1], angle, arrowSize, startType);
    }
  } else {
    // Shorten line at ends where arrowheads exist so the line doesn't overlap the tip
    const drawPoints: [number, number][] = points.map(p => [p[0], p[1]]);
    if (endType !== 'none' && drawPoints.length >= 2) {
      const last = drawPoints[drawPoints.length - 1]!;
      const prev = drawPoints[drawPoints.length - 2]!;
      const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      const shorten = arrowSize * 0.8;
      drawPoints[drawPoints.length - 1] = [last[0] - shorten * Math.cos(angle), last[1] - shorten * Math.sin(angle)];
    }
    if (startType !== 'none' && drawPoints.length >= 2) {
      const first = drawPoints[0]!;
      const second = drawPoints[1]!;
      const angle = Math.atan2(first[1] - second[1], first[0] - second[0]);
      const shorten = arrowSize * 0.8;
      drawPoints[0] = [first[0] - shorten * Math.cos(angle), first[1] - shorten * Math.sin(angle)];
    }

    // Use shortened points for the line (not cached — depends on arrowSize)
    const drawable = getOrCreateDrawable(expr, () =>
      rc.generator.linearPath(drawPoints, options),
    );
    rc.draw(drawable);

    ctx.fillStyle = expr.style.strokeColor;

    if (endType !== 'none' && points.length >= 2) {
      const last = points[points.length - 1]!;
      const prev = points[points.length - 2]!;
      const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      renderArrowhead(ctx, last[0], last[1], angle, arrowSize, endType);
    }

    if (startType !== 'none' && points.length >= 2) {
      const first = points[0]!;
      const second = points[1]!;
      const angle = Math.atan2(first[1] - second[1], first[0] - second[0]);
      renderArrowhead(ctx, first[0], first[1], angle, arrowSize, startType);
    }
  }

  if (offset.x !== 0 || offset.y !== 0) {
    ctx.restore();
  }

  // Draw label at arrow midpoint
  if (data.label) {
    const midIdx = Math.floor(points.length / 2);
    const p1 = points[midIdx - 1] ?? points[0]!;
    const p2 = points[midIdx] ?? points[points.length - 1]!;
    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;

    ctx.save();
    const fontSize = expr.style.fontSize ?? 12;
    ctx.font = `${fontSize}px ${expr.style.fontFamily ?? 'sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const metrics = ctx.measureText(data.label);
    const pad = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      midX - metrics.width / 2 - pad,
      midY - fontSize - pad,
      metrics.width + pad * 2,
      fontSize + pad,
    );

    ctx.fillStyle = expr.style.strokeColor;
    ctx.fillText(data.label, midX, midY - 4);
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

/** Render text with word-wrap using unified text config. [AC8] */
function renderText(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
): void {
  if (expr.data.kind !== 'text') return;
  const config = resolveTextConfig(expr);
  if (!config) return;

  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  ctx.textAlign = (expr.data as { textAlign: string }).textAlign as CanvasTextAlign;
  ctx.textBaseline = 'top';
  ctx.fillStyle = config.color;

  const lineHeight = config.fontSize * LINE_HEIGHT_MULTIPLIER;
  const lines = wrapText(ctx, config.text, config.worldWidth);

  let textX = config.worldX;
  const textAlign = (expr.data as { textAlign: string }).textAlign;
  if (textAlign === 'center') textX = config.worldX + config.worldWidth / 2;
  else if (textAlign === 'right') textX = config.worldX + config.worldWidth;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i]!, textX, config.worldY + i * lineHeight);
  }
}

/** Render sticky note with background, rotation, and text. [AC9] */
function renderStickyNote(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
  skipText = false,
): void {
  if (expr.data.kind !== 'sticky-note') return;
  const { color } = expr.data;
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

  // Draw text with padding (skip when editing in-place)
  if (!skipText) {
    const config = resolveTextConfig(expr);
    if (config) {
      ctx.font = `${config.fontSize}px ${config.fontFamily}`;
      ctx.textAlign = config.textAlign;
      ctx.textBaseline = 'top';
      ctx.fillStyle = config.color;

      const lineHeight = config.fontSize * LINE_HEIGHT_MULTIPLIER;
      const lines = wrapText(ctx, config.text, config.worldWidth);

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(
          lines[i]!,
          config.worldX,
          config.worldY + i * lineHeight,
        );
      }
    }
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

/** Render stencil icon from catalog with optional label. */
function renderStencil(
  ctx: CanvasRenderingContext2D,
  expr: VisualExpression,
  skipLabel = false,
): void {
  if (expr.data.kind !== 'stencil') return;
  const { stencilId, label } = expr.data;
  const { x, y } = expr.position;
  const { width, height } = expr.size;

  const entry = getStencil(stencilId);

  if (!entry) {
    // Unknown stencil — render labeled placeholder box
    renderPlaceholder(ctx, expr);
    return;
  }

  // Apply expression style colors to the SVG
  const strokeColor = expr.style.strokeColor ?? '#1e1e1e';
  const bgColor = expr.style.backgroundColor ?? 'transparent';
  const fillStyle = expr.style.fillStyle ?? 'hachure';
  const opacity = expr.style.opacity ?? 1;
  
  // Replace currentColor with the expression's stroke color
  const styledSvg = entry.svgContent.replace(/currentColor/g, strokeColor);

  // Draw background fill behind the icon (clipped to bounding box)
  const isTransparent = bgColor === 'transparent' || bgColor === 'none' || bgColor === '#00000000';
  if (fillStyle !== 'none' && !isTransparent) {
    ctx.save();
    ctx.globalAlpha = opacity;

    // Clip all fill rendering to the stencil bounding box
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.clip();

    if (fillStyle === 'solid') {
      ctx.fillStyle = bgColor;
      ctx.fill();
    } else {
      // hachure / cross-hatch — diagonal lines only, no background fill (matches Rough.js)
      const roughness = expr.style.roughness ?? 0;

      ctx.globalAlpha = opacity * 0.6;
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 1.5;

      // Seeded pseudo-random for stable wobble across frames
      let seed = 0;
      for (let c = 0; c < expr.id.length; c++) seed = ((seed << 5) - seed + expr.id.charCodeAt(c)) | 0;
      const seededRandom = () => {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed & 0x7fffffff) / 2147483647;
      };

      // Hachure at -41° (matching Rough.js default) with roughness wobble
      const angle = -41 * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const step = Math.max(4, 8 - roughness * 2);
      const diagonal = Math.hypot(width, height);

      // Helper: draw a wobbly line segment
      const wobblyLine = (x1: number, y1: number, x2: number, y2: number) => {
        if (roughness < 0.3) {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          return;
        }
        const len = Math.hypot(x2 - x1, y2 - y1);
        const segments = Math.max(2, Math.ceil(len / 15));
        ctx.moveTo(x1 + (seededRandom() - 0.5) * roughness, y1 + (seededRandom() - 0.5) * roughness);
        for (let s = 1; s <= segments; s++) {
          const t = s / segments;
          const jx = (seededRandom() - 0.5) * roughness * 1.5;
          const jy = (seededRandom() - 0.5) * roughness * 1.5;
          ctx.lineTo(x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy);
        }
      };

      ctx.beginPath();
      const cx = x + width / 2;
      const cy = y + height / 2;
      for (let d = -diagonal; d < diagonal; d += step) {
        // Line perpendicular to hachure angle at offset d
        const px = cx + cos * 0 + sin * d;
        const py = cy + sin * 0 - cos * d;
        // Extend line in both directions
        const x1 = px - cos * diagonal;
        const y1 = py - sin * diagonal;
        const x2 = px + cos * diagonal;
        const y2 = py + sin * diagonal;
        wobblyLine(x1, y1, x2, y2);
      }
      ctx.stroke();

      if (fillStyle === 'cross-hatch') {
        const angle2 = 41 * Math.PI / 180;
        const cos2 = Math.cos(angle2);
        const sin2 = Math.sin(angle2);
        ctx.beginPath();
        for (let d = -diagonal; d < diagonal; d += step) {
          const px = cx + sin2 * d;
          const py = cy - cos2 * d;
          const x1 = px - cos2 * diagonal;
          const y1 = py - sin2 * diagonal;
          const x2 = px + cos2 * diagonal;
          const y2 = py + sin2 * diagonal;
          wobblyLine(x1, y1, x2, y2);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const dataUri = svgToDataUri(styledSvg);
  const img = getCachedImage(dataUri);

  if (img) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const isContainer = Math.min(width, height) > 80;
    if (isContainer) {
      // Container: draw dashed border + small icon at top-left
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
      // Draw icon small at top-left
      const iconSize = 32;
      ctx.drawImage(img, x + 6, y + 6, iconSize, iconSize);
    } else {
      // Icon stencil: expand slightly to compensate for SVG viewBox padding
      const inset = Math.min(width, height) * 0.12;
      ctx.drawImage(img, x - inset, y - inset, width + 2 * inset, height + 2 * inset);
    }
    ctx.restore();
  } else {
    // Loading placeholder
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = '#666666';
    ctx.font = `${Math.min(width, height) * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏳', x + width / 2, y + height / 2);
  }

  // Draw label below the icon if present (skip when editing in-place)
  if (!skipLabel && label) {
    const config = resolveTextConfig(expr);
    if (config) {
      ctx.font = `${config.fontSize}px ${config.fontFamily}`;
      ctx.textAlign = config.textAlign;
      ctx.textBaseline = 'top';
      ctx.fillStyle = config.color;
      ctx.fillText(label, expr.position.x + expr.size.width / 2, config.worldY);
    }
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

  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;

  // Use explicit fontSize if user has set one, otherwise auto-scale to shape
  let fontSize: number;
  if (style.fontSize) {
    fontSize = style.fontSize;
  } else {
    const autoSize = height * 0.2;
    fontSize = Math.max(8, Math.min(autoSize, 72));
  }

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.strokeColor;

  // Word-wrap if text is wider than the shape
  const maxWidth = width * 0.85;
  const measured = ctx.measureText(label);
  if (measured.width <= maxWidth) {
    ctx.fillText(label, x + width / 2, y + height / 2);
  } else {
    // Word wrap with newline support
    const allLines: string[] = [];
    const paragraphs = label.split('\n');
    for (const para of paragraphs) {
      if (!para) { allLines.push(''); continue; }
      const words = para.split(' ');
      let currentLine = '';
      for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && currentLine) {
          allLines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) allLines.push(currentLine);
    }
    const lines = allLines;

    const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
    const totalHeight = lines.length * lineHeight;
    const startY = y + height / 2 - totalHeight / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, x + width / 2, startY + i * lineHeight);
    }
  }
}

/**
 * Draw a filled triangle arrowhead at the given point.
 *
 * The arrowhead points in the direction of `angle` (radians).
 * The triangle has a base of `size` and height of `size`.
 */
/**
 * Resolve arrowhead value to a type string.
 * Handles backward compat: true → 'triangle', false/undefined → 'none'.
 */
function resolveArrowheadType(value: string | boolean | undefined): string {
  if (value === true) return 'triangle';
  if (value === false || value === undefined) return 'none';
  return value;
}

export function renderArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  size: number,
  type: string = 'triangle',
): void {
  if (type === 'none') return;

  const halfAngle = Math.PI / 6; // 30°

  switch (type) {
    case 'triangle':
    default: {
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
      break;
    }
    case 'chevron': {
      ctx.save();
      ctx.lineWidth = Math.max(ctx.lineWidth, 1.5);
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.beginPath();
      ctx.moveTo(
        tipX - size * Math.cos(angle - halfAngle),
        tipY - size * Math.sin(angle - halfAngle),
      );
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(
        tipX - size * Math.cos(angle + halfAngle),
        tipY - size * Math.sin(angle + halfAngle),
      );
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'diamond': {
      const hSize = size * 0.6;
      const cx = tipX - hSize * Math.cos(angle);
      const cy = tipY - hSize * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        cx - hSize * 0.5 * Math.cos(angle - Math.PI / 2),
        cy - hSize * 0.5 * Math.sin(angle - Math.PI / 2),
      );
      ctx.lineTo(cx - hSize * Math.cos(angle), cy - hSize * Math.sin(angle));
      ctx.lineTo(
        cx - hSize * 0.5 * Math.cos(angle + Math.PI / 2),
        cy - hSize * 0.5 * Math.sin(angle + Math.PI / 2),
      );
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'circle': {
      const r = size * 0.35;
      const cx = tipX - r * Math.cos(angle);
      const cy = tipY - r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
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

  const result: string[] = [];

  // Split on explicit newlines first
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      result.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result;
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
  // Shapes: cache ignores position and data. Size is included so resize
  // gets the correct geometry. Deterministic seed ensures identical
  // roughness pattern on regeneration — no visual flicker.
  const isShape = expr.kind === 'rectangle' || expr.kind === 'ellipse' || expr.kind === 'diamond';
  const cacheData = isShape ? undefined : expr.data;
  const cachePosition = isShape ? { x: 0, y: 0 } : expr.position;
  const ctx = { style: expr.style, position: cachePosition, size: expr.size, data: cacheData };
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
