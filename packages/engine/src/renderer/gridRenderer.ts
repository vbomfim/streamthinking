/**
 * Dot-grid background renderer.
 *
 * Renders a subtle dot grid in world coordinates. Dot spacing adapts
 * to zoom level so the grid never becomes too dense or too sparse.
 *
 * @module
 */

import type { Camera } from '../types/index.js';

/** Base dot spacing in world units. */
const BASE_SPACING = 20;

/** Dot color — subtle gray. */
const DOT_COLOR = '#e0e0e0';

/** Dot radius in world units. */
const DOT_RADIUS = 1.5;

/**
 * Get adaptive grid spacing based on current zoom level. [AC6]
 *
 * - zoom ≥ 0.5  → 20px (base)
 * - zoom ≥ 0.25 → 40px (2× base)
 * - zoom < 0.25 → 80px (4× base)
 */
export function getGridSpacing(zoom: number): number {
  if (zoom < 0.25) return BASE_SPACING * 4;
  if (zoom < 0.5) return BASE_SPACING * 2;
  return BASE_SPACING;
}

/**
 * Render dot grid within the visible viewport.
 *
 * Only draws dots that fall inside the visible world area,
 * snapped to grid-spacing boundaries for alignment.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  if (viewportWidth <= 0 || viewportHeight <= 0) return;

  const spacing = getGridSpacing(camera.zoom);

  // Calculate visible world bounds from camera and viewport
  const worldLeft = camera.x;
  const worldTop = camera.y;
  const worldRight = camera.x + viewportWidth / camera.zoom;
  const worldBottom = camera.y + viewportHeight / camera.zoom;

  // Snap to grid boundaries (one spacing outside to avoid edge gaps)
  const startX = Math.floor(worldLeft / spacing) * spacing;
  const startY = Math.floor(worldTop / spacing) * spacing;
  const endX = Math.ceil(worldRight / spacing) * spacing;
  const endY = Math.ceil(worldBottom / spacing) * spacing;

  ctx.save();
  ctx.fillStyle = DOT_COLOR;

  for (let x = startX; x <= endX; x += spacing) {
    for (let y = startY; y <= endY; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
