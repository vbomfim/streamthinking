/**
 * Unit tests for stencilPaletteUtils — pure utility functions for
 * StencilPalette search, sorting, and filtering.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @vitest-environment jsdom
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { StencilMeta } from '@infinicanvas/engine';
import {
  filterStencilsBySearch,
  sortCategories,
  getCategoryCounts,
  getCategoryDisplayName,
  INITIAL_RENDER_LIMIT,
  SEARCH_DEBOUNCE_MS,
} from '../components/toolbar/stencilPaletteUtils.js';

// ── Test fixtures ──────────────────────────────────────────

const MOCK_META: StencilMeta[] = [
  { id: 'server', category: 'network', label: 'Server', defaultSize: { width: 44, height: 44 } },
  { id: 'firewall', category: 'network', label: 'Firewall', defaultSize: { width: 44, height: 44 } },
  { id: 'router', category: 'network', label: 'Router', defaultSize: { width: 44, height: 44 } },
  { id: 'database', category: 'generic-it', label: 'Database', defaultSize: { width: 44, height: 44 } },
  { id: 'k8s-pod', category: 'kubernetes', label: 'Kubernetes Pod', defaultSize: { width: 44, height: 44 } },
  { id: 'k8s-service', category: 'kubernetes', label: 'Kubernetes Service', defaultSize: { width: 44, height: 44 } },
  { id: 'azure-aks', category: 'azure', label: 'AKS', defaultSize: { width: 44, height: 44 } },
  { id: 'microservice', category: 'architecture', label: 'Microservice', defaultSize: { width: 44, height: 44 } },
  { id: 'drawio-ec2', category: 'drawio-aws', label: 'EC2 Instance', defaultSize: { width: 44, height: 44 } },
  { id: 'drawio-s3', category: 'drawio-aws', label: 'S3 Bucket', defaultSize: { width: 44, height: 44 } },
  { id: 'drawio-gce', category: 'drawio-gcp', label: 'GCE Instance', defaultSize: { width: 44, height: 44 } },
];

// ── filterStencilsBySearch ─────────────────────────────────

describe('filterStencilsBySearch', () => {
  it('returns all stencils grouped by category when query is empty', () => {
    const result = filterStencilsBySearch(MOCK_META, '');
    const totalCount = [...result.values()].reduce((sum, arr) => sum + arr.length, 0);
    expect(totalCount).toBe(MOCK_META.length);
  });

  it('returns empty map when no stencils match', () => {
    const result = filterStencilsBySearch(MOCK_META, 'nonexistent-xyz');
    expect(result.size).toBe(0);
  });

  it('matches case-insensitively', () => {
    const result = filterStencilsBySearch(MOCK_META, 'SERVER');
    expect(result.has('network')).toBe(true);
    expect(result.get('network')![0]!.id).toBe('server');
  });

  it('matches partial substrings', () => {
    const result = filterStencilsBySearch(MOCK_META, 'serv');
    expect(result.has('network')).toBe(true);
    expect(result.get('network')!.some((m) => m.id === 'server')).toBe(true);
    // Also matches 'Kubernetes Service'
    expect(result.has('kubernetes')).toBe(true);
    expect(result.get('kubernetes')!.some((m) => m.id === 'k8s-service')).toBe(true);
  });

  it('searches across all categories', () => {
    // 'a' appears in Server, Firewall, Database, AKS, Microservice, EC2 Instance, S3 Bucket, GCE Instance
    const result = filterStencilsBySearch(MOCK_META, 'a');
    expect(result.size).toBeGreaterThan(1);
  });

  it('groups results by category', () => {
    const result = filterStencilsBySearch(MOCK_META, 'kubernetes');
    expect(result.has('kubernetes')).toBe(true);
    expect(result.get('kubernetes')!.length).toBe(2);
    // Should not include other categories
    expect(result.has('network')).toBe(false);
  });

  it('trims whitespace from query', () => {
    const result = filterStencilsBySearch(MOCK_META, '  server  ');
    expect(result.has('network')).toBe(true);
    expect(result.get('network')![0]!.id).toBe('server');
  });

  it('returns categories in sorted order', () => {
    const result = filterStencilsBySearch(MOCK_META, '');
    const keys = [...result.keys()];
    // Priority categories should come first
    const networkIdx = keys.indexOf('network');
    const drawioIdx = keys.indexOf('drawio-aws');
    expect(networkIdx).toBeLessThan(drawioIdx);
  });
});

// ── sortCategories ────────────────────────────────────────

describe('sortCategories', () => {
  it('puts hand-crafted categories before drawio categories', () => {
    const input = ['drawio-aws', 'network', 'kubernetes'];
    const sorted = sortCategories(input);
    expect(sorted.indexOf('network')).toBeLessThan(sorted.indexOf('drawio-aws'));
    expect(sorted.indexOf('kubernetes')).toBeLessThan(sorted.indexOf('drawio-aws'));
  });

  it('preserves priority order among hand-crafted categories', () => {
    const input = ['generic-it', 'azure', 'network', 'architecture', 'kubernetes'];
    const sorted = sortCategories(input);
    expect(sorted).toEqual([
      'network',
      'architecture',
      'kubernetes',
      'azure',
      'generic-it',
    ]);
  });

  it('sorts drawio categories alphabetically', () => {
    const input = ['drawio-gcp', 'drawio-aws', 'drawio-azure'];
    const sorted = sortCategories(input);
    expect(sorted).toEqual(['drawio-aws', 'drawio-azure', 'drawio-gcp']);
  });

  it('handles empty input', () => {
    expect(sortCategories([])).toEqual([]);
  });

  it('handles single category', () => {
    expect(sortCategories(['network'])).toEqual(['network']);
  });

  it('does not mutate the input array', () => {
    const input = ['drawio-aws', 'network'];
    const inputCopy = [...input];
    sortCategories(input);
    expect(input).toEqual(inputCopy);
  });

  it('handles mix of known and unknown categories', () => {
    const input = ['custom-category', 'network', 'drawio-aws', 'azure'];
    const sorted = sortCategories(input);
    // network, azure (priority), then custom-category, drawio-aws (alpha)
    expect(sorted[0]).toBe('network');
    expect(sorted[1]).toBe('azure');
    expect(sorted.indexOf('custom-category')).toBeLessThan(sorted.indexOf('drawio-aws'));
  });
});

// ── getCategoryCounts ─────────────────────────────────────

describe('getCategoryCounts', () => {
  it('returns correct count per category', () => {
    const counts = getCategoryCounts(MOCK_META);
    expect(counts.get('network')).toBe(3);
    expect(counts.get('kubernetes')).toBe(2);
    expect(counts.get('generic-it')).toBe(1);
    expect(counts.get('azure')).toBe(1);
    expect(counts.get('drawio-aws')).toBe(2);
    expect(counts.get('drawio-gcp')).toBe(1);
  });

  it('returns empty map for empty input', () => {
    const counts = getCategoryCounts([]);
    expect(counts.size).toBe(0);
  });
});

// ── getCategoryDisplayName ────────────────────────────────

describe('getCategoryDisplayName', () => {
  it('returns mapped name for known categories', () => {
    expect(getCategoryDisplayName('network')).toBe('Network');
    expect(getCategoryDisplayName('azure-arm')).toBe('Azure ARM');
    expect(getCategoryDisplayName('generic-it')).toBe('Generic IT');
  });

  it('title-cases unknown categories', () => {
    expect(getCategoryDisplayName('drawio-aws')).toBe('Drawio Aws');
    expect(getCategoryDisplayName('my-custom-cat')).toBe('My Custom Cat');
  });

  it('handles single word', () => {
    expect(getCategoryDisplayName('misc')).toBe('Misc');
  });
});

// ── Constants ─────────────────────────────────────────────

describe('Constants', () => {
  it('INITIAL_RENDER_LIMIT is 50', () => {
    expect(INITIAL_RENDER_LIMIT).toBe(50);
  });

  it('SEARCH_DEBOUNCE_MS is 200', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(200);
  });
});
