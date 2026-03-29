/**
 * Unit tests for cloud stencil SVGs (Sub-ticket C).
 *
 * Covers: Azure (6), Kubernetes (10), Azure ARM (10) stencil entries.
 * Verifies catalog registration, category counts, SVG validity,
 * default sizes, and container-type dimensions.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  STENCIL_CATALOG,
  getStencil,
  getStencilsByCategory,
} from '../renderer/stencils/index.js';

// ── Azure stencil IDs ─────────────────────────────────────

const AZURE_IDS = [
  'azure-app-gateway',
  'azure-aks',
  'azure-storage',
  'azure-sql',
  'azure-functions',
  'azure-vnet',
] as const;

// ── Kubernetes stencil IDs ────────────────────────────────

const K8S_IDS = [
  'k8s-pod',
  'k8s-deployment',
  'k8s-service',
  'k8s-ingress',
  'k8s-configmap',
  'k8s-secret',
  'k8s-namespace',
  'k8s-persistent-volume',
  'k8s-node',
  'k8s-cluster',
] as const;

// ── Azure ARM stencil IDs ─────────────────────────────────

const ARM_IDS = [
  'arm-resource-group',
  'arm-subscription',
  'arm-management-group',
  'arm-virtual-machine',
  'arm-vnet',
  'arm-subnet',
  'arm-nsg',
  'arm-key-vault',
  'arm-app-service',
  'arm-container-registry',
] as const;

// ── Container stencils with larger default sizes ──────────

const CONTAINER_SIZES: Record<string, { width: number; height: number }> = {
  'k8s-namespace': { width: 200, height: 150 },
  'k8s-cluster': { width: 250, height: 200 },
  'arm-resource-group': { width: 200, height: 150 },
  'arm-subscription': { width: 250, height: 200 },
  'arm-management-group': { width: 300, height: 200 },
};

// ── All 26 cloud stencil IDs ──────────────────────────────

const ALL_CLOUD_IDS = [...AZURE_IDS, ...K8S_IDS, ...ARM_IDS];

// ── Azure stencils ────────────────────────────────────────

describe('Azure stencils', () => {
  it.each(AZURE_IDS)('registers %s in the catalog', (id) => {
    const entry = getStencil(id);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(id);
    expect(entry!.category).toBe('azure');
  });

  it('has exactly 6 azure stencils', () => {
    const entries = getStencilsByCategory('azure');
    expect(entries).toHaveLength(6);
  });

  it.each(AZURE_IDS)('%s has valid SVG content', (id) => {
    const entry = getStencil(id);
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.svgContent).toContain('</svg>');
    expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(AZURE_IDS)('%s has 64×64 default size', (id) => {
    const entry = getStencil(id);
    expect(entry!.defaultSize).toEqual({ width: 64, height: 64 });
  });

  it.each(AZURE_IDS)('%s has a non-empty label', (id) => {
    const entry = getStencil(id);
    expect(entry!.label.length).toBeGreaterThan(0);
  });
});

// ── Kubernetes stencils ───────────────────────────────────

describe('Kubernetes stencils', () => {
  it.each(K8S_IDS)('registers %s in the catalog', (id) => {
    const entry = getStencil(id);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(id);
    expect(entry!.category).toBe('kubernetes');
  });

  it('has exactly 10 kubernetes stencils', () => {
    const entries = getStencilsByCategory('kubernetes');
    expect(entries).toHaveLength(10);
  });

  it.each(K8S_IDS)('%s has valid SVG content', (id) => {
    const entry = getStencil(id);
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.svgContent).toContain('</svg>');
    expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(K8S_IDS)('%s has a non-empty label', (id) => {
    const entry = getStencil(id);
    expect(entry!.label.length).toBeGreaterThan(0);
  });

  it('k8s-namespace has container dimensions', () => {
    const entry = getStencil('k8s-namespace');
    expect(entry!.defaultSize).toEqual({ width: 200, height: 150 });
  });

  it('k8s-cluster has container dimensions', () => {
    const entry = getStencil('k8s-cluster');
    expect(entry!.defaultSize).toEqual({ width: 250, height: 200 });
  });

  it.each(
    K8S_IDS.filter((id) => !['k8s-namespace', 'k8s-cluster'].includes(id)),
  )('%s has 64×64 default size', (id) => {
    const entry = getStencil(id);
    expect(entry!.defaultSize).toEqual({ width: 64, height: 64 });
  });
});

// ── Azure ARM stencils ────────────────────────────────────

describe('Azure ARM stencils', () => {
  it.each(ARM_IDS)('registers %s in the catalog', (id) => {
    const entry = getStencil(id);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(id);
    expect(entry!.category).toBe('azure-arm');
  });

  it('has exactly 10 azure-arm stencils', () => {
    const entries = getStencilsByCategory('azure-arm');
    expect(entries).toHaveLength(10);
  });

  it.each(ARM_IDS)('%s has valid SVG content', (id) => {
    const entry = getStencil(id);
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.svgContent).toContain('</svg>');
    expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(ARM_IDS)('%s has a non-empty label', (id) => {
    const entry = getStencil(id);
    expect(entry!.label.length).toBeGreaterThan(0);
  });

  it('arm-resource-group has container dimensions', () => {
    const entry = getStencil('arm-resource-group');
    expect(entry!.defaultSize).toEqual({ width: 200, height: 150 });
  });

  it('arm-subscription has container dimensions', () => {
    const entry = getStencil('arm-subscription');
    expect(entry!.defaultSize).toEqual({ width: 250, height: 200 });
  });

  it('arm-management-group has container dimensions', () => {
    const entry = getStencil('arm-management-group');
    expect(entry!.defaultSize).toEqual({ width: 300, height: 200 });
  });

  it.each(
    ARM_IDS.filter(
      (id) =>
        !['arm-resource-group', 'arm-subscription', 'arm-management-group'].includes(id),
    ),
  )('%s has 64×64 default size', (id) => {
    const entry = getStencil(id);
    expect(entry!.defaultSize).toEqual({ width: 64, height: 64 });
  });
});

// ── Container stencil sizes ───────────────────────────────

describe('Container stencil sizes', () => {
  it.each(Object.entries(CONTAINER_SIZES))(
    '%s has correct container dimensions %j',
    (id, expectedSize) => {
      const entry = getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.defaultSize).toEqual(expectedSize);
    },
  );
});

// ── Cross-cutting catalog integrity ───────────────────────

describe('Cloud stencil catalog integrity', () => {
  it('all 26 cloud stencils exist in the catalog', () => {
    for (const id of ALL_CLOUD_IDS) {
      expect(getStencil(id)).toBeDefined();
    }
  });

  it('catalog map keys match entry IDs for cloud stencils', () => {
    for (const id of ALL_CLOUD_IDS) {
      const entry = STENCIL_CATALOG.get(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
    }
  });

  it('all cloud stencils have consistent viewBox in SVG', () => {
    for (const id of ALL_CLOUD_IDS) {
      const entry = getStencil(id)!;
      expect(entry.svgContent).toMatch(/viewBox="0 0 \d+ \d+"/);
    }
  });

  it('all cloud SVGs use currentColor or #333333 for strokes', () => {
    for (const id of ALL_CLOUD_IDS) {
      const entry = getStencil(id)!;
      const hasCurrentColor = entry.svgContent.includes('currentColor');
      const hasStandardColor = entry.svgContent.includes('#333333');
      expect(hasCurrentColor || hasStandardColor).toBe(true);
    }
  });

  it('k8s-pod is no longer in placeholders (moved to kubernetes.ts)', () => {
    // k8s-pod should still be in the catalog, but from kubernetes.ts, not placeholders
    const entry = getStencil('k8s-pod');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('kubernetes');
  });
});
