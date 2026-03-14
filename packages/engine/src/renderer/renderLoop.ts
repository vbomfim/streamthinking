/**
 * requestAnimationFrame-based render loop.
 *
 * Each frame: clear canvas → apply camera transform → render grid.
 * Future: expression rendering will be added after the grid step.
 *
 * @module
 */

import type { Camera } from '../types/index.js';
import { applyTransform } from '../camera.js';
import { renderGrid } from './gridRenderer.js';

export interface RenderLoop {
  start(): void;
  stop(): void;
  updateSize(width: number, height: number): void;
}

/**
 * Create a render loop bound to a canvas context.
 *
 * Uses requestAnimationFrame for smooth 60fps rendering. [AC8]
 * The `getCamera` callback is called each frame to get the latest
 * camera state — this avoids stale closures and ensures synchronous
 * camera updates are reflected immediately.
 */
export function createRenderLoop(
  ctx: CanvasRenderingContext2D,
  getCamera: () => Camera,
  initialWidth: number,
  initialHeight: number,
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

    // 4. (Future: render expressions here)

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
