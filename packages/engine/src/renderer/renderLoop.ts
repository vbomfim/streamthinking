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
import { applyTransform } from '../camera.js';
import { renderGrid } from './gridRenderer.js';
import { renderExpressions } from './primitiveRenderer.js';
import { renderSelection } from './selectionRenderer.js';

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
): RenderLoop {
  let width = initialWidth;
  let height = initialHeight;
  let frameId: number | null = null;
  let running = false;

  function renderFrame() {
    if (!running) return;

    const camera = getCamera();

    // 1. Clear canvas — use identity transform for full clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 2. Apply camera transform
    applyTransform(ctx, camera);

    // 3. Render grid (in world coordinates)
    renderGrid(ctx, camera, width, height);

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
