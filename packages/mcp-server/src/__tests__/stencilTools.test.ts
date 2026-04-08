/**
 * Tests for stencil expression tools.
 *
 * Verifies that stencil tools correctly look up catalog entries,
 * build VisualExpression objects, list available stencils, and
 * search/paginate the stencil catalog.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  buildStencil,
  executePlaceStencil,
  executeListStencils,
  executeSearchStencils,
} from '../tools/stencilTools.js';

// ── Mock gateway client ────────────────────────────────────

function createMockClient(): IGatewayClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getSessionId: vi.fn().mockReturnValue('test-session'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendBatchCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue([]),
    getPendingRequests: vi.fn().mockReturnValue([]),
    updateAgentName: vi.fn(),
  };
}

// ── buildStencil ───────────────────────────────────────────

describe('buildStencil', () => {
  it('creates a stencil expression for a valid stencil ID', async () => {
    const expr = await buildStencil({ stencilId: 'server', x: 100, y: 200 });

    expect(expr.kind).toBe('stencil');
    expect(expr.position).toEqual({ x: 100, y: 200 });
    expect(expr.data).toEqual({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'Server',
    });
    expect(expr.id).toBeDefined();
    expect(expr.angle).toBe(0);
    expect(expr.meta.author.type).toBe('agent');
    expect(expr.meta.author.id).toMatch(/^mcp-/);
    expect(expr.meta.locked).toBe(false);
  });

  it('uses catalog defaultSize when width/height not provided', async () => {
    const expr = await buildStencil({ stencilId: 'server', x: 0, y: 0 });

    expect(expr.size).toEqual({ width: 44, height: 44 });
  });

  it('overrides width and height when provided', async () => {
    const expr = await buildStencil({ stencilId: 'server', x: 0, y: 0, width: 128, height: 96 });

    expect(expr.size).toEqual({ width: 128, height: 96 });
  });

  it('overrides label when provided', async () => {
    const expr = await buildStencil({ stencilId: 'server', x: 0, y: 0, label: 'API Gateway' });

    expect(expr.data).toEqual({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'API Gateway',
    });
  });

  it('rejects with error for unknown stencil ID', async () => {
    await expect(buildStencil({ stencilId: 'nonexistent', x: 0, y: 0 }))
      .rejects.toThrow(/Unknown stencil 'nonexistent'/);
  });

  it('error message lists valid stencil IDs', async () => {
    await expect(buildStencil({ stencilId: 'bad-id', x: 0, y: 0 }))
      .rejects.toThrow(/server/);
  });

  it('works with database stencil', async () => {
    const expr = await buildStencil({ stencilId: 'database', x: 50, y: 50 });

    expect(expr.kind).toBe('stencil');
    expect(expr.data).toEqual({
      kind: 'stencil',
      stencilId: 'database',
      category: 'generic-it',
      label: 'Database',
    });
  });

  it('works with k8s-pod stencil', async () => {
    const expr = await buildStencil({ stencilId: 'k8s-pod', x: 0, y: 0 });

    expect(expr.kind).toBe('stencil');
    expect(expr.data).toEqual({
      kind: 'stencil',
      stencilId: 'k8s-pod',
      category: 'kubernetes',
      label: 'Pod',
    });
  });
});

// ── executePlaceStencil ────────────────────────────────────

describe('executePlaceStencil', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('sends create operation and returns confirmation', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'server', x: 100, y: 200,
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as VisualExpression;
    expect(sentExpr.kind).toBe('stencil');
    expect(sentExpr.data).toEqual({
      kind: 'stencil',
      stencilId: 'server',
      category: 'network',
      label: 'Server',
    });
    expect(result).toContain('Placed stencil');
    expect(result).toContain("'Server'");
    expect(result).toContain('(100, 200)');
  });

  it('returns error message for unknown stencil ID', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'nonexistent', x: 0, y: 0,
    });

    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Unknown stencil');
    expect(result).toContain('nonexistent');
    expect(result).toContain('server');
  });

  it('uses overridden label in confirmation message', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'server', x: 0, y: 0, label: 'Load Balancer',
    });

    expect(result).toContain("'Load Balancer'");
  });

  it('uses overridden dimensions', async () => {
    await executePlaceStencil(client, {
      stencilId: 'database', x: 10, y: 20, width: 128, height: 128,
    });

    const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as VisualExpression;
    expect(sentExpr.size).toEqual({ width: 128, height: 128 });
  });
});

// ── executeListStencils ────────────────────────────────────

describe('executeListStencils', () => {
  it('returns all stencils when no category is provided', async () => {
    const result = await executeListStencils({ pageSize: 300 });
    const parsed = JSON.parse(result);

    // Should contain stencils from multiple categories
    const ids = parsed.stencils.map((s: { id: string }) => s.id);
    expect(ids).toContain('server');
    expect(ids).toContain('database');
    expect(ids).toContain('k8s-pod');
  });

  it('groups stencils by category when no filter', async () => {
    const result = await executeListStencils({ pageSize: 300 });
    const parsed = JSON.parse(result);

    // Should contain stencils from multiple categories
    const categories = new Set(parsed.stencils.map((s: { category: string }) => s.category));
    expect(categories).toContain('network');
    expect(categories).toContain('generic-it');
    expect(categories).toContain('kubernetes');
  });

  it('filters by category when provided', async () => {
    const result = await executeListStencils({ category: 'network' });
    const parsed = JSON.parse(result);

    const ids = parsed.stencils.map((s: { id: string }) => s.id);
    expect(ids).toContain('server');
    expect(ids).not.toContain('database');
    expect(ids).not.toContain('k8s-pod');
  });

  it('returns empty result for unknown category', async () => {
    const result = await executeListStencils({ category: 'nonexistent' });
    const parsed = JSON.parse(result);

    expect(parsed.stencils).toEqual([]);
    expect(parsed.total).toBe(0);
  });

  it('includes stencil label and defaultSize', async () => {
    const result = await executeListStencils({ category: 'network' });
    const parsed = JSON.parse(result);

    const server = parsed.stencils.find((s: { id: string }) => s.id === 'server');
    expect(server).toBeDefined();
    expect(server.label).toBe('Server');
    expect(server.defaultSize).toEqual({ width: 44, height: 44 });
  });

  it('returns kubernetes stencils when filtered', async () => {
    const result = await executeListStencils({ category: 'kubernetes' });
    const parsed = JSON.parse(result);

    const ids = parsed.stencils.map((s: { id: string }) => s.id);
    const labels = parsed.stencils.map((s: { label: string }) => s.label);
    expect(ids).toContain('k8s-pod');
    expect(labels).toContain('Pod');
    expect(ids).not.toContain('server');
  });
});

// ── executeListStencils (enhanced: search, pagination) ─────

describe('executeListStencils enhanced', () => {
  it('returns JSON with total count when no filters applied', async () => {
    const result = await executeListStencils({});
    const parsed = JSON.parse(result);

    expect(parsed.stencils).toBeDefined();
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
    expect(Array.isArray(parsed.stencils)).toBe(true);
  });

  it('includes category in each stencil result', async () => {
    const result = await executeListStencils({});
    const parsed = JSON.parse(result);

    for (const stencil of parsed.stencils) {
      expect(stencil.category).toBeDefined();
      expect(typeof stencil.category).toBe('string');
    }
  });

  it('filters by category', async () => {
    const result = await executeListStencils({ category: 'network' });
    const parsed = JSON.parse(result);

    expect(parsed.total).toBeGreaterThan(0);
    for (const stencil of parsed.stencils) {
      expect(stencil.category).toBe('network');
    }
  });

  it('filters by search term (case-insensitive) on label', async () => {
    const result = await executeListStencils({ search: 'server' });
    const parsed = JSON.parse(result);

    expect(parsed.total).toBeGreaterThan(0);
    for (const stencil of parsed.stencils) {
      const matchesId = stencil.id.toLowerCase().includes('server');
      const matchesLabel = stencil.label.toLowerCase().includes('server');
      expect(matchesId || matchesLabel).toBe(true);
    }
  });

  it('filters by search term on stencil id', async () => {
    const result = await executeListStencils({ search: 'k8s' });
    const parsed = JSON.parse(result);

    expect(parsed.total).toBeGreaterThan(0);
    for (const stencil of parsed.stencils) {
      const matchesId = stencil.id.toLowerCase().includes('k8s');
      const matchesLabel = stencil.label.toLowerCase().includes('k8s');
      expect(matchesId || matchesLabel).toBe(true);
    }
  });

  it('combines category and search filters', async () => {
    const result = await executeListStencils({ category: 'azure', search: 'storage' });
    const parsed = JSON.parse(result);

    expect(parsed.total).toBeGreaterThan(0);
    for (const stencil of parsed.stencils) {
      expect(stencil.category).toBe('azure');
    }
  });

  it('paginates correctly with page and pageSize', async () => {
    const page1 = JSON.parse(await executeListStencils({ pageSize: 3, page: 1 }));
    const page2 = JSON.parse(await executeListStencils({ pageSize: 3, page: 2 }));

    expect(page1.stencils.length).toBe(3);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(3);
    expect(page1.totalPages).toBe(Math.ceil(page1.total / 3));
    expect(page1.hasNextPage).toBe(true);
    expect(page2.page).toBe(2);

    // Pages should not overlap
    const page1Ids = page1.stencils.map((s: { id: string }) => s.id);
    const page2Ids = page2.stencils.map((s: { id: string }) => s.id);
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });

  it('returns empty stencils array for out-of-bounds page', async () => {
    const result = await executeListStencils({ page: 9999, pageSize: 50 });
    const parsed = JSON.parse(result);

    expect(parsed.stencils).toEqual([]);
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.page).toBe(9999);
    expect(parsed.hasNextPage).toBe(false);
  });

  it('returns error for unknown category', async () => {
    const result = await executeListStencils({ category: 'nonexistent' });
    const parsed = JSON.parse(result);

    expect(parsed.stencils).toEqual([]);
    expect(parsed.total).toBe(0);
  });

  it('uses default pageSize of 50 and page of 1', async () => {
    const result = await executeListStencils({});
    const parsed = JSON.parse(result);

    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
  });

  it('search returns no results for non-matching query', async () => {
    const result = await executeListStencils({ search: 'zzzznonexistent' });
    const parsed = JSON.parse(result);

    expect(parsed.stencils).toEqual([]);
    expect(parsed.total).toBe(0);
  });
});

// ── executePlaceStencil (enhanced: fuzzy name matching) ────

describe('executePlaceStencil fuzzy matching', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('places stencil by fuzzy name when exact ID not found', async () => {
    // "Pod" is the label of k8s-pod — not an exact ID, so triggers fuzzy matching
    const result = await executePlaceStencil(client, {
      stencilId: 'Pod', x: 0, y: 0,
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Placed stencil');
  });

  it('returns disambiguation list when multiple fuzzy matches found', async () => {
    // 'azure' matches many stencils
    const result = await executePlaceStencil(client, {
      stencilId: 'Azure', x: 0, y: 0,
    });

    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Multiple stencils match');
  });

  it('still works with exact ID (backward compatible)', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'server', x: 100, y: 200,
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Placed stencil');
    expect(result).toContain("'Server'");
  });

  it('returns error when no fuzzy match found', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'zzzznonexistent', x: 0, y: 0,
    });

    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('Unknown stencil');
  });
});

// ── executeSearchStencils ──────────────────────────────────

describe('executeSearchStencils', () => {
  it('returns matching stencils for a query', async () => {
    const result = await executeSearchStencils({ query: 'server' });
    const parsed = JSON.parse(result);

    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
    for (const stencil of parsed.results) {
      const matchesId = stencil.id.toLowerCase().includes('server');
      const matchesLabel = stencil.label.toLowerCase().includes('server');
      expect(matchesId || matchesLabel).toBe(true);
    }
  });

  it('includes id, label, category, defaultSize in results', async () => {
    const result = await executeSearchStencils({ query: 'database' });
    const parsed = JSON.parse(result);

    expect(parsed.results.length).toBeGreaterThan(0);
    const first = parsed.results[0];
    expect(first.id).toBeDefined();
    expect(first.label).toBeDefined();
    expect(first.category).toBeDefined();
    expect(first.defaultSize).toBeDefined();
    expect(first.defaultSize.width).toBeDefined();
    expect(first.defaultSize.height).toBeDefined();
  });

  it('filters by category when provided', async () => {
    const result = await executeSearchStencils({ query: 'service', category: 'kubernetes' });
    const parsed = JSON.parse(result);

    expect(parsed.results.length).toBeGreaterThan(0);
    for (const stencil of parsed.results) {
      expect(stencil.category).toBe('kubernetes');
    }
  });

  it('respects limit parameter', async () => {
    const result = await executeSearchStencils({ query: 'a', limit: 3 });
    const parsed = JSON.parse(result);

    expect(parsed.results.length).toBeLessThanOrEqual(3);
  });

  it('defaults to limit of 10', async () => {
    const result = await executeSearchStencils({ query: 'a' });
    const parsed = JSON.parse(result);

    expect(parsed.results.length).toBeLessThanOrEqual(10);
  });

  it('returns total match count alongside results', async () => {
    const result = await executeSearchStencils({ query: 'a', limit: 2 });
    const parsed = JSON.parse(result);

    expect(parsed.total).toBeDefined();
    expect(parsed.total).toBeGreaterThanOrEqual(parsed.results.length);
  });

  it('returns empty results for non-matching query', async () => {
    const result = await executeSearchStencils({ query: 'zzzznonexistent' });
    const parsed = JSON.parse(result);

    expect(parsed.results).toEqual([]);
    expect(parsed.total).toBe(0);
  });

  it('search is case-insensitive', async () => {
    const lower = JSON.parse(await executeSearchStencils({ query: 'pod' }));
    const upper = JSON.parse(await executeSearchStencils({ query: 'POD' }));

    expect(lower.total).toBe(upper.total);
    expect(lower.results.length).toBe(upper.results.length);
  });
});

// ── Cross-cutting concerns ─────────────────────────────────

describe('stencil tools cross-cutting', () => {
  it('each built stencil has a unique ID', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const expr = await buildStencil({ stencilId: 'server', x: 0, y: 0 });
      ids.add(expr.id);
    }
    expect(ids.size).toBe(10);
  });

  it('stencil expressions have MCP author info', async () => {
    const expr = await buildStencil({ stencilId: 'server', x: 0, y: 0 });

    expect(expr.meta.author.type).toBe('agent');
    expect(expr.meta.author.id).toMatch(/^mcp-/);
    expect(expr.meta.author.provider).toBe('mcp');
  });

  it('stencil expressions have timestamps', async () => {
    const before = Date.now();
    const expr = await buildStencil({ stencilId: 'server', x: 0, y: 0 });
    const after = Date.now();

    expect(expr.meta.createdAt).toBeGreaterThanOrEqual(before);
    expect(expr.meta.createdAt).toBeLessThanOrEqual(after);
    expect(expr.meta.updatedAt).toBe(expr.meta.createdAt);
  });
});
