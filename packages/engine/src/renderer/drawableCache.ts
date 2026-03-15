/**
 * Rough.js drawable cache.
 *
 * Caches `Drawable` objects per expression to avoid regenerating them
 * every frame. The cache key combines the expression ID with a style hash.
 * When the style or data changes, the old cache entry is automatically
 * invalidated because the style hash won't match.
 *
 * @module
 */

import type { ExpressionStyle } from '@infinicanvas/protocol';
import type { Drawable } from 'roughjs/bin/core.js';
import { computeStyleHash } from './styleMapper.js';

/** Entry stored in the drawable cache. */
interface CacheEntry {
  styleHash: string;
  drawable: Drawable;
}

/** Drawable cache interface. */
export interface DrawableCache {
  /** Get a cached drawable if the style hash matches. */
  get(id: string, style: ExpressionStyle): Drawable | undefined;
  /** Store a drawable for an expression with the given style. */
  set(id: string, style: ExpressionStyle, drawable: Drawable): void;
  /** Remove a specific expression from the cache. */
  invalidate(id: string): void;
  /** Remove all entries from the cache. */
  clear(): void;
}

/**
 * Create a new drawable cache. [AC14]
 *
 * Stores one drawable per expression ID. When `get` is called with a
 * different style hash, it returns `undefined` (cache miss), prompting
 * the caller to regenerate and re-cache.
 */
export function createDrawableCache(): DrawableCache {
  const entries = new Map<string, CacheEntry>();

  return {
    get(id: string, style: ExpressionStyle): Drawable | undefined {
      const entry = entries.get(id);
      if (!entry) return undefined;

      const hash = computeStyleHash(style);
      if (entry.styleHash !== hash) return undefined;

      return entry.drawable;
    },

    set(id: string, style: ExpressionStyle, drawable: Drawable): void {
      entries.set(id, {
        styleHash: computeStyleHash(style),
        drawable,
      });
    },

    invalidate(id: string): void {
      entries.delete(id);
    },

    clear(): void {
      entries.clear();
    },
  };
}
