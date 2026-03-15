/**
 * Style mapping — ExpressionStyle → Rough.js Options.
 *
 * Converts the protocol's `ExpressionStyle` to the options accepted by
 * Rough.js drawing methods. Opacity is handled separately via
 * `ctx.globalAlpha` and is not included in the Rough.js options.
 *
 * @module
 */

import type { ExpressionStyle } from '@infinicanvas/protocol';
import type { Options } from 'roughjs/bin/core.js';

/**
 * Map an ExpressionStyle to Rough.js drawing options. [AC11]
 *
 * - `strokeColor` → `stroke`
 * - `backgroundColor` → `fill` (undefined when 'transparent')
 * - `fillStyle` → `fillStyle` (undefined when 'none')
 * - `strokeWidth` → `strokeWidth`
 * - `roughness` → `roughness`
 * - `opacity` is NOT mapped (handled via `ctx.globalAlpha`)
 */
export function mapStyleToRoughOptions(style: ExpressionStyle): Options {
  return {
    stroke: style.strokeColor,
    fill: style.backgroundColor === 'transparent' ? undefined : style.backgroundColor,
    fillStyle: style.fillStyle === 'none' ? undefined : style.fillStyle,
    strokeWidth: style.strokeWidth,
    roughness: style.roughness,
  };
}

/**
 * Compute a deterministic hash string for caching Rough.js drawables.
 *
 * The hash includes all style fields that affect rendering. Two identical
 * styles produce the same hash; any change produces a different hash.
 *
 * @deprecated Use computeRenderHash for cache keys that include position/size/data.
 */
export function computeStyleHash(style: ExpressionStyle): string {
  return [
    style.strokeColor,
    style.backgroundColor,
    style.fillStyle,
    style.strokeWidth,
    style.roughness,
    style.opacity,
    style.fontSize ?? '',
    style.fontFamily ?? '',
  ].join('|');
}

/**
 * Compute a deterministic hash for caching Rough.js drawables.
 *
 * Includes style, position, size, and data fields — any change to the
 * visual representation of the expression will produce a different hash,
 * triggering a cache miss and drawable regeneration.
 */
export function computeRenderHash(
  style: ExpressionStyle,
  position: { x: number; y: number },
  size: { width: number; height: number },
  data: unknown,
): string {
  return [
    style.strokeColor,
    style.backgroundColor,
    style.fillStyle,
    style.strokeWidth,
    style.roughness,
    style.opacity,
    style.fontSize ?? '',
    style.fontFamily ?? '',
    position.x,
    position.y,
    size.width,
    size.height,
    JSON.stringify(data),
  ].join('|');
}
