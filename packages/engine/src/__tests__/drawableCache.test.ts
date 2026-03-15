/**
 * Unit tests for Rough.js drawable cache.
 *
 * Covers: cache hit/miss, invalidation on style change,
 * invalidation on data change, cache clearing, and key computation.
 *
 * @module
 */

import { createDrawableCache } from '../renderer/drawableCache.js';
import type { ExpressionStyle } from '@infinicanvas/protocol';

// ── Helpers ──────────────────────────────────────────────────

function makeStyle(overrides: Partial<ExpressionStyle> = {}): ExpressionStyle {
  return {
    strokeColor: '#000000',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 1,
    opacity: 1,
    ...overrides,
  };
}

/** Fake Drawable for testing (shape matches Rough.js Drawable). */
function makeDrawable(shape = 'rectangle'): { shape: string; options: object; sets: unknown[] } {
  return { shape, options: {}, sets: [] };
}

// ── Tests ────────────────────────────────────────────────────

describe('createDrawableCache', () => {
  it('returns cached drawable on cache hit', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const style = makeStyle();

    cache.set('expr-1', style, drawable);
    const result = cache.get('expr-1', style);
    expect(result).toBe(drawable);
  });

  it('returns undefined on cache miss', () => {
    const cache = createDrawableCache();
    const style = makeStyle();

    const result = cache.get('nonexistent', style);
    expect(result).toBeUndefined();
  });

  it('invalidates when style changes', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const style1 = makeStyle({ strokeColor: '#000000' });
    const style2 = makeStyle({ strokeColor: '#ff0000' });

    cache.set('expr-1', style1, drawable);
    const result = cache.get('expr-1', style2);
    expect(result).toBeUndefined();
  });

  it('returns correct drawable after re-caching with new style', () => {
    const cache = createDrawableCache();
    const drawable1 = makeDrawable('rectangle');
    const drawable2 = makeDrawable('ellipse');
    const style1 = makeStyle({ strokeColor: '#000000' });
    const style2 = makeStyle({ strokeColor: '#ff0000' });

    cache.set('expr-1', style1, drawable1);
    cache.set('expr-1', style2, drawable2);

    expect(cache.get('expr-1', style2)).toBe(drawable2);
    // Old style entry should be gone (replaced by new)
    expect(cache.get('expr-1', style1)).toBeUndefined();
  });

  it('stores drawables for different expressions independently', () => {
    const cache = createDrawableCache();
    const drawable1 = makeDrawable('rectangle');
    const drawable2 = makeDrawable('ellipse');
    const style = makeStyle();

    cache.set('expr-1', style, drawable1);
    cache.set('expr-2', style, drawable2);

    expect(cache.get('expr-1', style)).toBe(drawable1);
    expect(cache.get('expr-2', style)).toBe(drawable2);
  });

  it('invalidate removes a specific expression from cache', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const style = makeStyle();

    cache.set('expr-1', style, drawable);
    cache.invalidate('expr-1');
    expect(cache.get('expr-1', style)).toBeUndefined();
  });

  it('invalidate does not affect other expressions', () => {
    const cache = createDrawableCache();
    const drawable1 = makeDrawable('rectangle');
    const drawable2 = makeDrawable('ellipse');
    const style = makeStyle();

    cache.set('expr-1', style, drawable1);
    cache.set('expr-2', style, drawable2);
    cache.invalidate('expr-1');

    expect(cache.get('expr-1', style)).toBeUndefined();
    expect(cache.get('expr-2', style)).toBe(drawable2);
  });

  it('clear removes all entries', () => {
    const cache = createDrawableCache();
    const style = makeStyle();

    cache.set('expr-1', style, makeDrawable());
    cache.set('expr-2', style, makeDrawable());
    cache.clear();

    expect(cache.get('expr-1', style)).toBeUndefined();
    expect(cache.get('expr-2', style)).toBeUndefined();
  });

  it('handles invalidation of nonexistent entry gracefully', () => {
    const cache = createDrawableCache();
    expect(() => cache.invalidate('nonexistent')).not.toThrow();
  });

  it('handles clear on empty cache gracefully', () => {
    const cache = createDrawableCache();
    expect(() => cache.clear()).not.toThrow();
  });
});
