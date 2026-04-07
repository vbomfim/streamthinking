/**
 * Grid snap utility — pure math functions for snapping
 * coordinates to grid intersections.
 *
 * Used by manipulation interactions to align shapes during drag
 * when snap-to-grid is enabled. All functions are pure and
 * side-effect free. [CLEAN-CODE]
 *
 * @module
 */

/**
 * Snap a single value to the nearest grid intersection.
 *
 * @param value - The raw coordinate value to snap.
 * @param gridSize - The grid spacing in world units.
 * @returns The nearest grid-aligned value.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap an (x, y) coordinate pair to the nearest grid intersection.
 *
 * @param x - The raw x coordinate.
 * @param y - The raw y coordinate.
 * @param gridSize - The grid spacing in world units.
 * @returns The grid-aligned position.
 */
export function snapPosition(
  x: number,
  y: number,
  gridSize: number,
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}
