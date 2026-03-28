/**
 * Unit tests for the stencil catalog.
 *
 * Covers: lookup by ID, unknown ID handling, category filtering,
 * getAllCategories listing, SVG to data URI conversion, and
 * STENCIL_CATALOG integrity.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  STENCIL_CATALOG,
  getStencil,
  getStencilsByCategory,
  getAllCategories,
  svgToDataUri,
} from '../renderer/stencils/index.js';

// ── getStencil ────────────────────────────────────────────

describe('getStencil', () => {
  it('returns the server stencil entry by ID', () => {
    const entry = getStencil('server');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('server');
    expect(entry!.category).toBe('network');
    expect(entry!.label).toBe('Server');
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.defaultSize.width).toBe(64);
    expect(entry!.defaultSize.height).toBe(64);
  });

  it('returns the database stencil entry by ID', () => {
    const entry = getStencil('database');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('database');
    expect(entry!.category).toBe('generic-it');
  });

  it('returns the k8s-pod stencil entry by ID', () => {
    const entry = getStencil('k8s-pod');
    expect(entry).toBeDefined();
    expect(entry!.id).toBe('k8s-pod');
    expect(entry!.category).toBe('kubernetes');
  });

  it('returns undefined for an unknown stencil ID', () => {
    expect(getStencil('nonexistent')).toBeUndefined();
  });

  it('returns undefined for an empty string ID', () => {
    expect(getStencil('')).toBeUndefined();
  });
});

// ── getStencilsByCategory ─────────────────────────────────

describe('getStencilsByCategory', () => {
  it('returns stencils in the network category', () => {
    const entries = getStencilsByCategory('network');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe('server');
  });

  it('returns stencils in the kubernetes category', () => {
    const entries = getStencilsByCategory('kubernetes');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe('k8s-pod');
  });

  it('returns stencils in the generic-it category', () => {
    const entries = getStencilsByCategory('generic-it');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe('database');
  });

  it('returns empty array for unknown category', () => {
    expect(getStencilsByCategory('nonexistent')).toEqual([]);
  });

  it('returns empty array for empty string category', () => {
    expect(getStencilsByCategory('')).toEqual([]);
  });
});

// ── getAllCategories ───────────────────────────────────────

describe('getAllCategories', () => {
  it('returns all unique categories sorted alphabetically', () => {
    const categories = getAllCategories();
    expect(categories).toEqual(['generic-it', 'kubernetes', 'network']);
  });

  it('returns the correct number of categories', () => {
    expect(getAllCategories()).toHaveLength(3);
  });
});

// ── STENCIL_CATALOG integrity ─────────────────────────────

describe('STENCIL_CATALOG', () => {
  it('contains exactly 3 entries', () => {
    expect(STENCIL_CATALOG.size).toBe(3);
  });

  it('has map keys matching entry IDs', () => {
    for (const [key, entry] of STENCIL_CATALOG) {
      expect(key).toBe(entry.id);
    }
  });

  it('all entries have non-empty SVG content', () => {
    for (const entry of STENCIL_CATALOG.values()) {
      expect(entry.svgContent).toContain('<svg');
      expect(entry.svgContent).toContain('</svg>');
    }
  });

  it('all entries have positive default dimensions', () => {
    for (const entry of STENCIL_CATALOG.values()) {
      expect(entry.defaultSize.width).toBeGreaterThan(0);
      expect(entry.defaultSize.height).toBeGreaterThan(0);
    }
  });
});

// ── svgToDataUri ──────────────────────────────────────────

describe('svgToDataUri', () => {
  it('converts SVG content to a data URI', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const uri = svgToDataUri(svg);
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('encodes special characters correctly', () => {
    const svg = '<svg><text>Hello & World</text></svg>';
    const uri = svgToDataUri(svg);
    expect(uri).toContain(encodeURIComponent('&'));
    expect(uri).not.toContain('&');
  });

  it('produces a URI that can be decoded back to original SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16"/></svg>';
    const uri = svgToDataUri(svg);
    const prefix = 'data:image/svg+xml;charset=utf-8,';
    const decoded = decodeURIComponent(uri.slice(prefix.length));
    expect(decoded).toBe(svg);
  });

  it('works with catalog stencil SVG content', () => {
    const entry = getStencil('server');
    expect(entry).toBeDefined();
    const uri = svgToDataUri(entry!.svgContent);
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(uri.length).toBeGreaterThan(50);
  });
});
