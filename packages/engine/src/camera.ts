/**
 * Camera math — pure coordinate-transform functions.
 *
 * All functions are side-effect free. The camera model uses:
 *   screen = (world - camera) × zoom
 *   world  = screen / zoom + camera
 *
 * Transform matrix (applied via setTransform):
 *   [zoom, 0, 0, zoom, -camera.x × zoom, -camera.y × zoom]
 *
 * @module
 */

import type { Camera } from './types/index.js';

/**
 * Convert screen (pixel) coordinates to world coordinates.
 *
 * Inverse of {@link worldToScreen}. [AC4]
 */
export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: sx / camera.zoom + camera.x,
    y: sy / camera.zoom + camera.y,
  };
}

/**
 * Convert world coordinates to screen (pixel) coordinates.
 *
 * Inverse of {@link screenToWorld}. [AC4]
 */
export function worldToScreen(
  wx: number,
  wy: number,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: (wx - camera.x) * camera.zoom,
    y: (wy - camera.y) * camera.zoom,
  };
}

/**
 * Apply camera transform to a canvas 2D context.
 *
 * After this call, all drawing operations use world coordinates. [AC5]
 */
export function applyTransform(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
): void {
  // The `|| 0` normalizes -0 → 0 (JavaScript quirk: -0 * 1 === -0)
  ctx.setTransform(
    camera.zoom,
    0,
    0,
    camera.zoom,
    -camera.x * camera.zoom || 0,
    -camera.y * camera.zoom || 0,
  );
}

/**
 * Calculate new camera after zooming at a specific screen point.
 *
 * The world point under the cursor stays fixed after the zoom. [AC3]
 * Algorithm: compute the world point under the cursor, then solve for
 * the new camera offset so that same world point maps back to the
 * same screen position at the new zoom level.
 */
export function zoomAtPoint(
  camera: Camera,
  screenX: number,
  screenY: number,
  newZoom: number,
): Camera {
  // World point under cursor before zoom
  const worldPoint = screenToWorld(screenX, screenY, camera);

  // New camera offset: world = screen / newZoom + newCamera
  // → newCamera = world - screen / newZoom
  return {
    x: worldPoint.x - screenX / newZoom,
    y: worldPoint.y - screenY / newZoom,
    zoom: newZoom,
  };
}
