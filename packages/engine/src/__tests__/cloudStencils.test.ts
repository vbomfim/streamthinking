/**
 * Unit tests for cloud stencil SVGs.
 *
 * Covers: Azure Pro (30), Kubernetes (10) stencil entries.
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

// ── Azure Pro stencil IDs ─────────────────────────────────

const AZURE_PRO_IDS = [
  // Compute
  'azure-pro-virtual-machines',
  'azure-pro-app-service',
  'azure-pro-functions',
  'azure-pro-aks',
  'azure-pro-container-instances',
  'azure-pro-vmss',
  // Storage
  'azure-pro-blob-storage',
  'azure-pro-file-storage',
  'azure-pro-disk-storage',
  'azure-pro-data-lake',
  // Database
  'azure-pro-sql-database',
  'azure-pro-cosmos-db',
  'azure-pro-mysql',
  'azure-pro-postgresql',
  'azure-pro-redis-cache',
  // Networking
  'azure-pro-virtual-network',
  'azure-pro-load-balancer',
  'azure-pro-application-gateway',
  'azure-pro-front-door',
  'azure-pro-dns-zone',
  'azure-pro-expressroute',
  // Security
  'azure-pro-key-vault',
  'azure-pro-active-directory',
  'azure-pro-sentinel',
  'azure-pro-ddos-protection',
  // Management
  'azure-pro-monitor',
  'azure-pro-log-analytics',
  'azure-pro-devops',
  'azure-pro-resource-group',
  // AI
  'azure-pro-cognitive-services',
  'azure-pro-openai-service',
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

// ── Container stencils with larger default sizes ──────────

const CONTAINER_SIZES: Record<string, { width: number; height: number }> = {
  'k8s-namespace': { width: 200, height: 150 },
  'k8s-cluster': { width: 250, height: 200 },
};

// ── All cloud stencil IDs ──────────────────────────────────

const ALL_CLOUD_IDS = [...AZURE_PRO_IDS, ...K8S_IDS];

// ── Azure Pro stencils ───────────────────────────────────

describe('Azure Pro stencils', () => {
  it.each(AZURE_PRO_IDS)('registers %s in the catalog', async (id) => {
    const entry = await getStencil(id);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(id);
    expect(entry!.category).toBe('azure-pro');
  });

  it('has exactly 31 azure-pro stencils', () => {
    const entries = getStencilsByCategory('azure-pro');
    expect(entries).toHaveLength(31);
  });

  it.each(AZURE_PRO_IDS)('%s has valid SVG content', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.svgContent).toContain('</svg>');
    expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(AZURE_PRO_IDS)('%s has 44×44 default size (ICON_SIZE)', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it.each(AZURE_PRO_IDS)('%s has a non-empty label', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.label.length).toBeGreaterThan(0);
  });

  it.each(AZURE_PRO_IDS)('%s has 64×64 viewBox', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
  });

  it.each(AZURE_PRO_IDS)('%s uses currentColor for theming', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.svgContent).toContain('currentColor');
  });

  it('old azure and azure-arm categories are removed', () => {
    const azureEntries = getStencilsByCategory('azure');
    const armEntries = getStencilsByCategory('azure-arm');
    expect(azureEntries).toHaveLength(0);
    expect(armEntries).toHaveLength(0);
  });
});

// ── Kubernetes stencils ───────────────────────────────────

describe('Kubernetes stencils', () => {
  it.each(K8S_IDS)('registers %s in the catalog', async (id) => {
    const entry = await getStencil(id);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(id);
    expect(entry!.category).toBe('kubernetes');
  });

  it('has exactly 10 kubernetes stencils', () => {
    const entries = getStencilsByCategory('kubernetes');
    expect(entries).toHaveLength(10);
  });

  it.each(K8S_IDS)('%s has valid SVG content', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.svgContent).toContain('<svg');
    expect(entry!.svgContent).toContain('</svg>');
    expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each(K8S_IDS)('%s has a non-empty label', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.label.length).toBeGreaterThan(0);
  });

  it('k8s-namespace has container dimensions', async () => {
    const entry = await getStencil('k8s-namespace');
    expect(entry!.defaultSize).toEqual({ width: 200, height: 150 });
  });

  it('k8s-cluster has container dimensions', async () => {
    const entry = await getStencil('k8s-cluster');
    expect(entry!.defaultSize).toEqual({ width: 250, height: 200 });
  });

  it('k8s-pod has 44×44 default size (ICON_SIZE)', async () => {
    const entry = await getStencil('k8s-pod');
    expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it.each(
    K8S_IDS.filter((id) => !['k8s-pod', 'k8s-namespace', 'k8s-cluster'].includes(id)),
  )('%s has 64×64 default size', async (id) => {
    const entry = await getStencil(id);
    expect(entry!.defaultSize).toEqual({ width: 64, height: 64 });
  });
});

// ── Container stencil sizes ───────────────────────────────

describe('Container stencil sizes', () => {
  it.each(Object.entries(CONTAINER_SIZES))(
    '%s has correct container dimensions %j',
    async (id, expectedSize) => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.defaultSize).toEqual(expectedSize);
    },
  );
});

// ── Cross-cutting catalog integrity ───────────────────────

describe('Cloud stencil catalog integrity', () => {
  it('all 41 cloud stencils exist in the catalog', async () => {
    for (const id of ALL_CLOUD_IDS) {
      expect(await getStencil(id)).toBeDefined();
    }
  });

  it('catalog map keys match entry IDs for cloud stencils', () => {
    for (const id of ALL_CLOUD_IDS) {
      const entry = STENCIL_CATALOG.get(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
    }
  });

  it('all cloud stencils have consistent viewBox in SVG', async () => {
    for (const id of ALL_CLOUD_IDS) {
      const entry = (await getStencil(id))!;
      expect(entry.svgContent).toMatch(/viewBox="0 0 \d+ \d+"/);
    }
  });

  it('all cloud SVGs use currentColor for theming', async () => {
    for (const id of ALL_CLOUD_IDS) {
      const entry = (await getStencil(id))!;
      expect(entry.svgContent).toContain('currentColor');
    }
  });

  it('k8s-pod is in kubernetes category (not placeholders)', async () => {
    const entry = await getStencil('k8s-pod');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('kubernetes');
  });
});
