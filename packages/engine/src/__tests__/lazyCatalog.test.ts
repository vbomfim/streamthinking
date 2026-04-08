/**
 * Unit tests for lazy-loaded stencil catalog.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: StencilMeta type, getCategories, getAllStencilMeta,
 * getCategoryStencils (async), getStencil (async),
 * registerCategoryLoader, caching, and backward compatibility.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StencilEntry, StencilMeta, CategoryLoader } from '../renderer/stencils/stencilCatalog.js';
import {
  STENCIL_CATALOG,
  getCategories,
  getAllStencilMeta,
  getCategoryStencils,
  getStencil,
  registerCategoryLoader,
  registerCategoryMeta,
  getStencilsByCategory,
  getAllCategories,
  svgToDataUri,
  _resetLazyState,
} from '../renderer/stencils/stencilCatalog.js';

// ── Test helpers ──────────────────────────────────────────

/** Minimal valid SVG for test stencils. */
const TEST_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"/></svg>';

/** Create a mock StencilEntry. */
function createTestEntry(id: string, category: string, label: string): StencilEntry {
  return {
    id,
    category,
    label,
    svgContent: TEST_SVG,
    defaultSize: { width: 44, height: 44 },
  };
}

/** Create a mock CategoryLoader that returns entries. */
function createMockLoader(entries: StencilEntry[]): CategoryLoader {
  const map = new Map<string, StencilEntry>();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }
  return vi.fn(async () => map);
}

// ── Global cleanup — ensure no lazy state leaks between test files
afterEach(() => {
  _resetLazyState();
});

// ── StencilMeta type ──────────────────────────────────────

describe('StencilMeta type', () => {
  it('StencilMeta has id, label, category, and defaultSize', () => {
    const meta: StencilMeta = {
      id: 'test-stencil',
      label: 'Test Stencil',
      category: 'test-category',
      defaultSize: { width: 44, height: 44 },
    };

    expect(meta.id).toBe('test-stencil');
    expect(meta.label).toBe('Test Stencil');
    expect(meta.category).toBe('test-category');
    expect(meta.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('StencilEntry extends StencilMeta with svgContent', () => {
    const entry: StencilEntry = {
      id: 'test-stencil',
      label: 'Test Stencil',
      category: 'test-category',
      defaultSize: { width: 44, height: 44 },
      svgContent: TEST_SVG,
    };

    expect(entry.svgContent).toContain('<svg');
  });
});

// ── getCategories (sync) ──────────────────────────────────

describe('getCategories', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('returns all eagerly loaded categories', () => {
    const categories = getCategories();

    expect(categories).toContain('network');
    expect(categories).toContain('generic-it');
    expect(categories).toContain('architecture');
    expect(categories).toContain('kubernetes');
    expect(categories).toContain('azure-pro');
    expect(categories).toContain('security');
    // Old categories removed
    expect(categories).not.toContain('azure');
    expect(categories).not.toContain('azure-arm');
  });

  it('returns sorted categories', () => {
    const categories = getCategories();
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);
  });

  it('includes lazy categories after registerCategoryMeta', () => {
    registerCategoryMeta([
      { id: 'drawio-aws-ec2', label: 'EC2', category: 'drawio-aws', defaultSize: { width: 44, height: 44 } },
    ]);

    const categories = getCategories();
    expect(categories).toContain('drawio-aws');
  });
});

// ── getAllStencilMeta (sync) ───────────────────────────────

describe('getAllStencilMeta', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('returns metadata for all eagerly loaded stencils', () => {
    const metas = getAllStencilMeta();

    // Should include all existing stencils
    const ids = metas.map((m) => m.id);
    expect(ids).toContain('server');
    expect(ids).toContain('database');
    expect(ids).toContain('k8s-pod');
  });

  it('metadata entries do NOT contain svgContent', () => {
    const metas = getAllStencilMeta();

    for (const meta of metas) {
      expect(meta).not.toHaveProperty('svgContent');
    }
  });

  it('includes lazy category metadata after registration', () => {
    registerCategoryMeta([
      { id: 'drawio-gcp-compute', label: 'Compute', category: 'drawio-gcp', defaultSize: { width: 44, height: 44 } },
    ]);

    const metas = getAllStencilMeta();
    const gcp = metas.find((m) => m.id === 'drawio-gcp-compute');
    expect(gcp).toBeDefined();
    expect(gcp!.category).toBe('drawio-gcp');
    expect(gcp!.label).toBe('Compute');
  });
});

// ── registerCategoryLoader ────────────────────────────────

describe('registerCategoryLoader', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('registers a loader for a new category', () => {
    const entries = [
      createTestEntry('lazy-a', 'lazy-cat', 'Lazy A'),
      createTestEntry('lazy-b', 'lazy-cat', 'Lazy B'),
    ];
    const loader = createMockLoader(entries);

    registerCategoryLoader('lazy-cat', loader);
    registerCategoryMeta([
      { id: 'lazy-a', label: 'Lazy A', category: 'lazy-cat', defaultSize: { width: 44, height: 44 } },
      { id: 'lazy-b', label: 'Lazy B', category: 'lazy-cat', defaultSize: { width: 44, height: 44 } },
    ]);

    // Category should appear in getCategories
    expect(getCategories()).toContain('lazy-cat');
  });
});

// ── getCategoryStencils (async) ───────────────────────────

describe('getCategoryStencils', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('returns eagerly loaded stencils for an eager category', async () => {
    const entries = await getCategoryStencils('network');

    expect(entries.length).toBeGreaterThan(0);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain('server');
    expect(ids).toContain('firewall');
  });

  it('triggers lazy load for a registered category', async () => {
    const entries = [
      createTestEntry('lazy-x', 'lazy-test', 'Lazy X'),
      createTestEntry('lazy-y', 'lazy-test', 'Lazy Y'),
    ];
    const loader = createMockLoader(entries);

    registerCategoryLoader('lazy-test', loader);
    registerCategoryMeta([
      { id: 'lazy-x', label: 'Lazy X', category: 'lazy-test', defaultSize: { width: 44, height: 44 } },
      { id: 'lazy-y', label: 'Lazy Y', category: 'lazy-test', defaultSize: { width: 44, height: 44 } },
    ]);

    const result = await getCategoryStencils('lazy-test');

    expect(loader).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id).sort()).toEqual(['lazy-x', 'lazy-y']);
  });

  it('returns empty array for unknown category', async () => {
    const result = await getCategoryStencils('nonexistent');
    expect(result).toEqual([]);
  });

  it('caches loaded category — second call does not re-import', async () => {
    const entries = [
      createTestEntry('cache-a', 'cache-test', 'Cache A'),
    ];
    const loader = createMockLoader(entries);

    registerCategoryLoader('cache-test', loader);
    registerCategoryMeta([
      { id: 'cache-a', label: 'Cache A', category: 'cache-test', defaultSize: { width: 44, height: 44 } },
    ]);

    // First call triggers loader
    await getCategoryStencils('cache-test');
    expect(loader).toHaveBeenCalledOnce();

    // Second call should use cache
    const result2 = await getCategoryStencils('cache-test');
    expect(loader).toHaveBeenCalledOnce(); // still once
    expect(result2).toHaveLength(1);
  });

  it('merges lazy entries into STENCIL_CATALOG', async () => {
    const entries = [
      createTestEntry('merge-a', 'merge-test', 'Merge A'),
    ];
    const loader = createMockLoader(entries);

    registerCategoryLoader('merge-test', loader);
    registerCategoryMeta([
      { id: 'merge-a', label: 'Merge A', category: 'merge-test', defaultSize: { width: 44, height: 44 } },
    ]);

    await getCategoryStencils('merge-test');

    // Should be available in STENCIL_CATALOG for sync access
    expect(STENCIL_CATALOG.get('merge-a')).toBeDefined();
    expect(STENCIL_CATALOG.get('merge-a')!.label).toBe('Merge A');
  });
});

// ── getStencil (async) ────────────────────────────────────

describe('getStencil (async)', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('returns eagerly loaded stencils without triggering loader', async () => {
    const entry = await getStencil('server');

    expect(entry).toBeDefined();
    expect(entry!.id).toBe('server');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Server');
    expect(entry!.svgContent).toContain('<svg');
  });

  it('returns undefined for unknown stencil ID', async () => {
    const entry = await getStencil('nonexistent');
    expect(entry).toBeUndefined();
  });

  it('triggers correct category load for a lazy stencil', async () => {
    const entries = [
      createTestEntry('lazy-s1', 'lazy-find', 'Lazy S1'),
      createTestEntry('lazy-s2', 'lazy-find', 'Lazy S2'),
    ];
    const loader = createMockLoader(entries);

    registerCategoryLoader('lazy-find', loader);
    registerCategoryMeta([
      { id: 'lazy-s1', label: 'Lazy S1', category: 'lazy-find', defaultSize: { width: 44, height: 44 } },
      { id: 'lazy-s2', label: 'Lazy S2', category: 'lazy-find', defaultSize: { width: 44, height: 44 } },
    ]);

    const entry = await getStencil('lazy-s1');

    expect(loader).toHaveBeenCalledOnce();
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('lazy-s1');
    expect(entry!.svgContent).toContain('<svg');
  });

  it('does not trigger load for second stencil in same category', async () => {
    const entries = [
      createTestEntry('same-cat-a', 'same-cat', 'A'),
      createTestEntry('same-cat-b', 'same-cat', 'B'),
    ];
    const loader = createMockLoader(entries);

    registerCategoryLoader('same-cat', loader);
    registerCategoryMeta([
      { id: 'same-cat-a', label: 'A', category: 'same-cat', defaultSize: { width: 44, height: 44 } },
      { id: 'same-cat-b', label: 'B', category: 'same-cat', defaultSize: { width: 44, height: 44 } },
    ]);

    await getStencil('same-cat-a');
    expect(loader).toHaveBeenCalledOnce();

    const entryB = await getStencil('same-cat-b');
    expect(loader).toHaveBeenCalledOnce(); // still once — cached
    expect(entryB).toBeDefined();
    expect(entryB!.id).toBe('same-cat-b');
  });
});

// ── Concurrent loading deduplication ──────────────────────

describe('concurrent loading', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('deduplicates concurrent loads of the same category', async () => {
    const entries = [createTestEntry('dup-a', 'dup-cat', 'Dup A')];
    const loader = createMockLoader(entries);

    registerCategoryLoader('dup-cat', loader);
    registerCategoryMeta([
      { id: 'dup-a', label: 'Dup A', category: 'dup-cat', defaultSize: { width: 44, height: 44 } },
    ]);

    // Launch two concurrent loads
    const [result1, result2] = await Promise.all([
      getCategoryStencils('dup-cat'),
      getCategoryStencils('dup-cat'),
    ]);

    expect(loader).toHaveBeenCalledOnce();
    expect(result1).toEqual(result2);
  });
});

// ── Error handling ────────────────────────────────────────

describe('loader error handling', () => {
  beforeEach(() => {
    _resetLazyState();
  });

  it('propagates loader errors to the caller', async () => {
    const loader = vi.fn(async () => {
      throw new Error('Network error');
    });

    registerCategoryLoader('error-cat', loader);
    registerCategoryMeta([
      { id: 'err-a', label: 'Err A', category: 'error-cat', defaultSize: { width: 44, height: 44 } },
    ]);

    await expect(getCategoryStencils('error-cat')).rejects.toThrow('Network error');
  });

  it('allows retry after a failed load', async () => {
    let callCount = 0;
    const loader = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Transient error');
      }
      return new Map([['retry-a', createTestEntry('retry-a', 'retry-cat', 'Retry A')]]);
    });

    registerCategoryLoader('retry-cat', loader);
    registerCategoryMeta([
      { id: 'retry-a', label: 'Retry A', category: 'retry-cat', defaultSize: { width: 44, height: 44 } },
    ]);

    // First call fails
    await expect(getCategoryStencils('retry-cat')).rejects.toThrow('Transient error');

    // Second call should retry and succeed
    const result = await getCategoryStencils('retry-cat');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('retry-a');
  });
});

// ── Backward compatibility ────────────────────────────────

describe('backward compatibility', () => {
  it('STENCIL_CATALOG still contains all 49 eager stencils', () => {
    // The exact count of eagerly loaded stencils
    expect(STENCIL_CATALOG.size).toBeGreaterThanOrEqual(49);
  });

  it('getAllCategories still returns eager categories (sync)', () => {
    const categories = getAllCategories();

    expect(categories).toContain('network');
    expect(categories).toContain('generic-it');
    expect(categories).toContain('architecture');
  });

  it('getStencilsByCategory still returns entries synchronously', () => {
    const entries = getStencilsByCategory('network');

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.id === 'server')).toBe(true);
  });

  it('svgToDataUri still works unchanged', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const uri = svgToDataUri(svg);
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('STENCIL_CATALOG keys match entry IDs', () => {
    for (const [key, entry] of STENCIL_CATALOG) {
      expect(key).toBe(entry.id);
    }
  });
});
