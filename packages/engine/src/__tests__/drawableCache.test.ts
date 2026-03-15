/**
 * Unit tests for Rough.js drawable cache.
 *
 * Covers: cache hit/miss, invalidation on style change,
 * invalidation on position/size/data change, cache clearing,
 * and render hash computation.
 *
 * @module
 */

import { createDrawableCache } from '../renderer/drawableCache.js';
import type { RenderContext } from '../renderer/drawableCache.js';
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

function makeContext(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    style: overrides.style ?? makeStyle(),
    position: overrides.position ?? { x: 0, y: 0 },
    size: overrides.size ?? { width: 100, height: 100 },
    data: overrides.data ?? { kind: 'rectangle' },
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
    const ctx = makeContext();

    cache.set('expr-1', ctx, drawable);
    const result = cache.get('expr-1', ctx);
    expect(result).toBe(drawable);
  });

  it('returns undefined on cache miss', () => {
    const cache = createDrawableCache();
    const ctx = makeContext();

    const result = cache.get('nonexistent', ctx);
    expect(result).toBeUndefined();
  });

  it('invalidates when style changes', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const ctx1 = makeContext({ style: makeStyle({ strokeColor: '#000000' }) });
    const ctx2 = makeContext({ style: makeStyle({ strokeColor: '#ff0000' }) });

    cache.set('expr-1', ctx1, drawable);
    const result = cache.get('expr-1', ctx2);
    expect(result).toBeUndefined();
  });

  it('returns correct drawable after re-caching with new style', () => {
    const cache = createDrawableCache();
    const drawable1 = makeDrawable('rectangle');
    const drawable2 = makeDrawable('ellipse');
    const ctx1 = makeContext({ style: makeStyle({ strokeColor: '#000000' }) });
    const ctx2 = makeContext({ style: makeStyle({ strokeColor: '#ff0000' }) });

    cache.set('expr-1', ctx1, drawable1);
    cache.set('expr-1', ctx2, drawable2);

    expect(cache.get('expr-1', ctx2)).toBe(drawable2);
    // Old style entry should be gone (replaced by new)
    expect(cache.get('expr-1', ctx1)).toBeUndefined();
  });

  it('stores drawables for different expressions independently', () => {
    const cache = createDrawableCache();
    const drawable1 = makeDrawable('rectangle');
    const drawable2 = makeDrawable('ellipse');
    const ctx = makeContext();

    cache.set('expr-1', ctx, drawable1);
    cache.set('expr-2', ctx, drawable2);

    expect(cache.get('expr-1', ctx)).toBe(drawable1);
    expect(cache.get('expr-2', ctx)).toBe(drawable2);
  });

  it('invalidate removes a specific expression from cache', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const ctx = makeContext();

    cache.set('expr-1', ctx, drawable);
    cache.invalidate('expr-1');
    expect(cache.get('expr-1', ctx)).toBeUndefined();
  });

  it('invalidate does not affect other expressions', () => {
    const cache = createDrawableCache();
    const drawable1 = makeDrawable('rectangle');
    const drawable2 = makeDrawable('ellipse');
    const ctx = makeContext();

    cache.set('expr-1', ctx, drawable1);
    cache.set('expr-2', ctx, drawable2);
    cache.invalidate('expr-1');

    expect(cache.get('expr-1', ctx)).toBeUndefined();
    expect(cache.get('expr-2', ctx)).toBe(drawable2);
  });

  it('clear removes all entries', () => {
    const cache = createDrawableCache();
    const ctx = makeContext();

    cache.set('expr-1', ctx, makeDrawable());
    cache.set('expr-2', ctx, makeDrawable());
    cache.clear();

    expect(cache.get('expr-1', ctx)).toBeUndefined();
    expect(cache.get('expr-2', ctx)).toBeUndefined();
  });

  it('handles invalidation of nonexistent entry gracefully', () => {
    const cache = createDrawableCache();
    expect(() => cache.invalidate('nonexistent')).not.toThrow();
  });

  it('handles clear on empty cache gracefully', () => {
    const cache = createDrawableCache();
    expect(() => cache.clear()).not.toThrow();
  });

  // ── R1: Position/size/data change triggers cache miss ──────

  it('invalidates when position changes (R1)', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const ctx1 = makeContext({ position: { x: 10, y: 20 } });
    const ctx2 = makeContext({ position: { x: 50, y: 60 } });

    cache.set('expr-1', ctx1, drawable);
    expect(cache.get('expr-1', ctx2)).toBeUndefined();
  });

  it('invalidates when size changes (R1)', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const ctx1 = makeContext({ size: { width: 100, height: 50 } });
    const ctx2 = makeContext({ size: { width: 200, height: 50 } });

    cache.set('expr-1', ctx1, drawable);
    expect(cache.get('expr-1', ctx2)).toBeUndefined();
  });

  it('invalidates when data changes (R1)', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const ctx1 = makeContext({ data: { kind: 'rectangle', label: 'A' } });
    const ctx2 = makeContext({ data: { kind: 'rectangle', label: 'B' } });

    cache.set('expr-1', ctx1, drawable);
    expect(cache.get('expr-1', ctx2)).toBeUndefined();
  });

  it('returns hit when position, size, data all match (R1)', () => {
    const cache = createDrawableCache();
    const drawable = makeDrawable();
    const ctx = makeContext({
      position: { x: 42, y: 99 },
      size: { width: 300, height: 150 },
      data: { kind: 'rectangle', label: 'same' },
    });

    cache.set('expr-1', ctx, drawable);
    expect(cache.get('expr-1', ctx)).toBe(drawable);
  });
});
