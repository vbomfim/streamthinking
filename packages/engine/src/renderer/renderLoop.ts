/**
 * requestAnimationFrame-based render loop.
 *
 * Each frame: clear canvas → apply camera transform → render grid →
 * render primitives in z-order.
 *
 * @module
 */

import type { VisualExpression } from '@infinicanvas/protocol';
import type { RoughCanvas } from 'roughjs/bin/canvas.js';
import type { Camera } from '../types/index.js';
import type { DrawPreview } from '../tools/BaseTool.js';
import { applyTransform } from '../camera.js';
import { renderGrid } from './gridRenderer.js';
import { renderExpressions } from './primitiveRenderer.js';
import { renderSelection } from './selectionRenderer.js';
import { renderDrawPreview } from './drawPreviewRenderer.js';
import * as dragSnapState from '../hooks/useManipulationInteraction.js';

/** Marquee overlay visual styles (matches useSelectionInteraction constants). */
const MARQUEE_STROKE_COLOR = '#4A90D9';
const MARQUEE_FILL_COLOR = 'rgba(74, 144, 217, 0.1)';
const MARQUEE_DASH_PATTERN: readonly number[] = [6, 3];

export interface RenderLoop {
  start(): void;
  stop(): void;
  updateSize(width: number, height: number): void;
}

/** Callback that returns the current expression state for rendering. */
export interface ExpressionProvider {
  /** All expressions on the canvas, keyed by ID. */
  getExpressions(): Record<string, VisualExpression>;
  /** Ordered list of expression IDs representing z-order (back to front). */
  getExpressionOrder(): string[];
}

/** Callback that returns the current selection state for rendering. */
export interface SelectionProvider {
  /** Set of currently selected expression IDs. */
  getSelectedIds(): Set<string>;
}

/** Callback that returns the current draw preview for rendering. */
export interface DrawPreviewProvider {
  /** Current draw preview from the active tool, or null. */
  getDrawPreview(): DrawPreview | null;
}

/** Callback that returns the current marquee rectangle for rendering. */
export interface MarqueeProvider {
  /** Screen-space marquee rectangle during drag, or null when idle. */
  getMarquee(): { x: number; y: number; width: number; height: number } | null;
}

/** Callback that returns the ID of the expression currently being inline-edited. */
export interface EditingProvider {
  /** ID of the expression being edited, or null. */
  getEditingId(): string | null;
}

/**
 * Create a render loop bound to a canvas context.
 *
 * Uses requestAnimationFrame for smooth 60fps rendering. [AC8]
 * The `getCamera` callback is called each frame to get the latest
 * camera state — this avoids stale closures and ensures synchronous
 * camera updates are reflected immediately.
 *
 * The optional `roughCanvas` and `expressionProvider` enable primitive
 * rendering. When provided, expressions are rendered in z-order after
 * the grid, with viewport culling applied.
 */
export function createRenderLoop(
  ctx: CanvasRenderingContext2D,
  getCamera: () => Camera,
  initialWidth: number,
  initialHeight: number,
  roughCanvas?: RoughCanvas,
  expressionProvider?: ExpressionProvider,
  selectionProvider?: SelectionProvider,
  drawPreviewProvider?: DrawPreviewProvider,
  dpr: number = 1,
  marqueeProvider?: MarqueeProvider,
  editingProvider?: EditingProvider,
): RenderLoop {
  let width = initialWidth;
  let height = initialHeight;
  let frameId: number | null = null;
  let running = false;

  function renderFrame() {
    if (!running) return;

    const camera = getCamera();

    // 1. Clear canvas — use DPR-scaled identity for full clear
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 2. Apply camera transform (includes DPR scaling)
    applyTransform(ctx, camera, dpr);

    // 3. Render grid (in world coordinates)
    // Grid removed — true infinite canvas with no visual boundaries

    // 4. Render expressions in z-order [AC1]
    if (roughCanvas && expressionProvider) {
      renderExpressions(
        ctx,
        roughCanvas,
        expressionProvider.getExpressions(),
        expressionProvider.getExpressionOrder(),
        camera,
        width,
        height,
        editingProvider?.getEditingId() ?? null,
      );
    }

    // 5. Render selection UI (bounding boxes + handles)
    if (expressionProvider && selectionProvider) {
      renderSelection(
        ctx,
        selectionProvider.getSelectedIds(),
        expressionProvider.getExpressions(),
        camera,
      );
    }

    // 6. Render draw preview (transient dashed outline during tool drag)
    if (drawPreviewProvider) {
      const preview = drawPreviewProvider.getDrawPreview();
      if (preview) {
        renderDrawPreview(ctx, preview, camera.zoom);
      }
    }

    // 6b. Render drag snap indicator (blue circle during arrow endpoint drag)
    if (dragSnapState.currentDragSnapPoint) {
      const sp = dragSnapState.currentDragSnapPoint;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 10 / camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#4A90D9';
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / camera.zoom;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Render marquee overlay (screen-space, after all world-space rendering)
    if (marqueeProvider) {
      const marquee = marqueeProvider.getMarquee();
      if (marquee) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = MARQUEE_FILL_COLOR;
        ctx.fillRect(marquee.x, marquee.y, marquee.width, marquee.height);
        ctx.strokeStyle = MARQUEE_STROKE_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash(MARQUEE_DASH_PATTERN as number[]);
        ctx.strokeRect(marquee.x, marquee.y, marquee.width, marquee.height);
        ctx.setLineDash([]);
      }
    }

    // Schedule next frame
    frameId = requestAnimationFrame(renderFrame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      frameId = requestAnimationFrame(renderFrame);
    },

    stop() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },

    updateSize(newWidth: number, newHeight: number) {
      width = newWidth;
      height = newHeight;
    },
  };
}
