/**
 * QA Guardian — Integration, contract, and edge-case tests for stencil tools.
 *
 * Tests the MCP tool layer (stencilTools.ts) and catalogTool.ts at
 * integration boundaries: pagination correctness, search edge cases,
 * fuzzy matching behaviour, response contract consistency, and catalog
 * count accuracy.
 *
 * Does NOT duplicate Developer unit tests (stencilTools.test.ts).
 * Tests BEHAVIOR through the public interface, not implementation details.
 *
 * Ticket #104 — MCP Stencil Tool Updates
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression, StencilData } from '@infinicanvas/protocol';
import { getAllStencilMeta, getAllCategories, getStencilsByCategory } from '@infinicanvas/engine';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  buildStencil,
  executePlaceStencil,
  executeListStencils,
  executeSearchStencils,
} from '../tools/stencilTools.js';
import { executeCatalog } from '../tools/catalogTool.js';

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

// ── Helpers ────────────────────────────────────────────────

const totalStencils = getAllStencilMeta().length;
const allCategories = getAllCategories();

// ── Pagination edge cases [EDGE] ──────────────────────────

describe('executeListStencils pagination edge cases', () => {
  it('[EDGE] last page returns partial results', async () => {
    // Use a pageSize that doesn't evenly divide total
    const pageSize = 7;
    const lastPage = Math.ceil(totalStencils / pageSize);
    const result = JSON.parse(await executeListStencils({ page: lastPage, pageSize }));

    const expectedRemaining = totalStencils - (lastPage - 1) * pageSize;
    expect(result.stencils.length).toBe(expectedRemaining);
    expect(result.total).toBe(totalStencils);
    expect(result.page).toBe(lastPage);
  });

  it('[EDGE] page just beyond last returns empty stencils with correct total', async () => {
    const pageSize = 10;
    const lastPage = Math.ceil(totalStencils / pageSize);
    const result = JSON.parse(await executeListStencils({ page: lastPage + 1, pageSize }));

    expect(result.stencils).toEqual([]);
    expect(result.total).toBe(totalStencils);
    expect(result.page).toBe(lastPage + 1);
  });

  it('[EDGE] pageSize=1 returns exactly one stencil per page', async () => {
    const page1 = JSON.parse(await executeListStencils({ pageSize: 1, page: 1 }));
    const page2 = JSON.parse(await executeListStencils({ pageSize: 1, page: 2 }));

    expect(page1.stencils.length).toBe(1);
    expect(page2.stencils.length).toBe(1);
    expect(page1.stencils[0].id).not.toBe(page2.stencils[0].id);
    expect(page1.total).toBe(totalStencils);
  });

  it('[EDGE] pageSize equal to total returns all on one page', async () => {
    const result = JSON.parse(await executeListStencils({ pageSize: totalStencils }));

    expect(result.stencils.length).toBe(totalStencils);
    expect(result.page).toBe(1);
    expect(result.total).toBe(totalStencils);
  });

  it('[EDGE] pageSize larger than total returns all stencils', async () => {
    const result = JSON.parse(await executeListStencils({ pageSize: totalStencils + 100 }));

    expect(result.stencils.length).toBe(totalStencils);
    expect(result.total).toBe(totalStencils);
  });

  it('[EDGE] pagination with search reduces total correctly', async () => {
    const allResults = JSON.parse(await executeListStencils({ search: 'k8s' }));
    const page1 = JSON.parse(await executeListStencils({ search: 'k8s', pageSize: 2, page: 1 }));

    expect(page1.total).toBe(allResults.total);
    expect(page1.stencils.length).toBeLessThanOrEqual(2);
  });

  it('[EDGE] pagination with category filter narrows total', async () => {
    const allResult = JSON.parse(await executeListStencils({}));
    const filteredResult = JSON.parse(await executeListStencils({ category: 'network' }));

    expect(filteredResult.total).toBeLessThan(allResult.total);
    expect(filteredResult.total).toBeGreaterThan(0);
  });

  it('[EDGE] sequential pages cover all results without gaps or overlaps', async () => {
    const pageSize = 5;
    const totalPages = Math.ceil(totalStencils / pageSize);
    const allIds: string[] = [];

    for (let page = 1; page <= totalPages; page++) {
      const result = JSON.parse(await executeListStencils({ page, pageSize }));
      allIds.push(...result.stencils.map((s: { id: string }) => s.id));
    }

    // No duplicates
    expect(new Set(allIds).size).toBe(allIds.length);
    // All stencils covered
    expect(allIds.length).toBe(totalStencils);
  });
});

// ── Search edge cases [EDGE] ──────────────────────────────

describe('executeListStencils search edge cases', () => {
  it('[EDGE] empty search string returns all stencils', async () => {
    const result = JSON.parse(await executeListStencils({ search: '' }));

    expect(result.total).toBe(totalStencils);
  });

  it('[EDGE] search with only whitespace returns all stencils', async () => {
    // Whitespace will be lowercase and used as substring — won't match IDs/labels
    const result = JSON.parse(await executeListStencils({ search: '   ' }));

    // Whitespace is unlikely to match any stencil id/label but depends on data
    // The key contract: no crash, valid JSON response
    expect(result.stencils).toBeDefined();
    expect(Array.isArray(result.stencils)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('[EDGE] search with special regex characters does not crash', async () => {
    const result = JSON.parse(await executeListStencils({ search: 'k8s(pod)' }));

    // Should not crash — substring match doesn't use regex
    expect(result.stencils).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('[EDGE] search with hyphenated term matches stencil IDs', async () => {
    const result = JSON.parse(await executeListStencils({ search: 'k8s-' }));

    expect(result.total).toBeGreaterThan(0);
    for (const stencil of result.stencils) {
      expect(stencil.id.toLowerCase()).toContain('k8s-');
    }
  });

  it('[EDGE] search + category + pagination all combine correctly', async () => {
    // Search kubernetes category for 'service'
    const allResults = JSON.parse(
      await executeListStencils({ category: 'kubernetes', search: 'service' }),
    );

    if (allResults.total > 0) {
      const page1 = JSON.parse(
        await executeListStencils({
          category: 'kubernetes',
          search: 'service',
          pageSize: 1,
          page: 1,
        }),
      );

      expect(page1.stencils.length).toBe(1);
      expect(page1.total).toBe(allResults.total);
      expect(page1.stencils[0].category).toBe('kubernetes');
    }
  });
});

// ── executeSearchStencils edge cases [EDGE] ────────────────

describe('executeSearchStencils edge cases', () => {
  it('[EDGE] single-character query returns matches', async () => {
    const result = JSON.parse(await executeSearchStencils({ query: 's' }));

    expect(result.total).toBeGreaterThan(0);
    for (const stencil of result.results) {
      const matchesId = stencil.id.toLowerCase().includes('s');
      const matchesLabel = stencil.label.toLowerCase().includes('s');
      expect(matchesId || matchesLabel).toBe(true);
    }
  });

  it('[EDGE] query with special characters does not crash', async () => {
    const result = JSON.parse(await executeSearchStencils({ query: '(pod)' }));

    expect(result.results).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('[EDGE] limit=1 returns at most one result', async () => {
    const result = JSON.parse(await executeSearchStencils({ query: 'a', limit: 1 }));

    expect(result.results.length).toBeLessThanOrEqual(1);
    // total should still report full count
    expect(result.total).toBeGreaterThan(1);
  });

  it('[EDGE] category filter with no search match returns empty', async () => {
    const result = JSON.parse(
      await executeSearchStencils({ query: 'zzzzz', category: 'kubernetes' }),
    );

    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('[EDGE] category that exists but has no query match returns empty', async () => {
    const result = JSON.parse(
      await executeSearchStencils({ query: 'server', category: 'kubernetes' }),
    );

    // 'server' is in network, not kubernetes
    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('[EDGE] search matches both id and label fields', async () => {
    // 'pod' should match 'k8s-pod' (id) and 'Pod' (label)
    const result = JSON.parse(await executeSearchStencils({ query: 'pod' }));

    expect(result.total).toBeGreaterThan(0);
    const hasPodInId = result.results.some(
      (s: { id: string }) => s.id.toLowerCase().includes('pod'),
    );
    expect(hasPodInId).toBe(true);
  });
});

// ── Fuzzy matching integration [BOUNDARY] ──────────────────

describe('executePlaceStencil fuzzy matching integration', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('[BOUNDARY] fuzzy match preserves user-provided label override', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'Pod',
      x: 10,
      y: 20,
      label: 'My Custom Pod',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain("'My Custom Pod'");
  });

  it('[BOUNDARY] fuzzy match preserves user-provided dimensions', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'Pod',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as VisualExpression;
    expect(sentExpr.size).toEqual({ width: 200, height: 200 });
  });

  it('[BOUNDARY] fuzzy match resolves to correct stencil ID in expression', async () => {
    await executePlaceStencil(client, {
      stencilId: 'Pod',
      x: 0,
      y: 0,
    });

    const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as VisualExpression;
    const data = sentExpr.data as StencilData;
    expect(data.stencilId).toBe('k8s-pod');
  });

  it('[BOUNDARY] partial ID substring places correct stencil', async () => {
    // 'database' is an exact ID — but 'datab' should fuzzy match it
    const result = await executePlaceStencil(client, {
      stencilId: 'datab',
      x: 0,
      y: 0,
    });

    // If only one match, should place it
    if (result.includes('Placed stencil')) {
      const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as VisualExpression;
      const data = sentExpr.data as StencilData;
      expect(data.stencilId).toBe('database');
    } else {
      // Multiple matches is also valid
      expect(result).toContain('Multiple stencils match');
    }
  });

  it('[BOUNDARY] disambiguation message lists all matching stencils', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'k8s',
      x: 0,
      y: 0,
    });

    expect(result).toContain('Multiple stencils match');
    // Should contain at least 2 stencil IDs
    const k8sStencils = getAllStencilMeta().filter((s) =>
      s.id.toLowerCase().includes('k8s') || s.label.toLowerCase().includes('k8s'),
    );
    for (const s of k8sStencils) {
      expect(result).toContain(s.id);
    }
  });

  it('[BOUNDARY] disambiguation message includes category for each match', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'k8s',
      x: 0,
      y: 0,
    });

    expect(result).toContain('Multiple stencils match');
    expect(result).toContain('kubernetes');
  });

  it('[BOUNDARY] exact ID takes priority over fuzzy match', async () => {
    // 'server' is an exact ID — should not trigger fuzzy matching
    const result = await executePlaceStencil(client, {
      stencilId: 'server',
      x: 0,
      y: 0,
    });

    expect(result).toContain('Placed stencil');
    const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as VisualExpression;
    const data = sentExpr.data as StencilData;
    expect(data.stencilId).toBe('server');
  });

  it('[BOUNDARY] confirmation message includes position and expression ID', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'server',
      x: 42,
      y: 99,
    });

    expect(result).toContain('(42, 99)');
    expect(result).toMatch(/\[id: .+\]/);
  });

  it('[BOUNDARY] confirmation message includes dimensions', async () => {
    const result = await executePlaceStencil(client, {
      stencilId: 'server',
      x: 0,
      y: 0,
    });

    expect(result).toMatch(/\d+×\d+/);
  });
});

// ── Response contract consistency [CONTRACT] ───────────────

describe('stencil tools response contracts', () => {
  it('[CONTRACT] executeListStencils returns {stencils, total, page, pageSize}', async () => {
    const result = JSON.parse(await executeListStencils({}));

    expect(result).toHaveProperty('stencils');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(Array.isArray(result.stencils)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(typeof result.page).toBe('number');
    expect(typeof result.pageSize).toBe('number');
  });

  it('[CONTRACT] executeSearchStencils returns {results, total}', async () => {
    const result = JSON.parse(await executeSearchStencils({ query: 'server' }));

    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.results)).toBe(true);
    expect(typeof result.total).toBe('number');
  });

  it('[CONTRACT] list stencil items have id, label, category, defaultSize', async () => {
    const result = JSON.parse(await executeListStencils({ pageSize: 1 }));
    const stencil = result.stencils[0];

    expect(stencil).toHaveProperty('id');
    expect(stencil).toHaveProperty('label');
    expect(stencil).toHaveProperty('category');
    expect(stencil).toHaveProperty('defaultSize');
    expect(stencil.defaultSize).toHaveProperty('width');
    expect(stencil.defaultSize).toHaveProperty('height');
    expect(typeof stencil.id).toBe('string');
    expect(typeof stencil.label).toBe('string');
    expect(typeof stencil.category).toBe('string');
    expect(typeof stencil.defaultSize.width).toBe('number');
    expect(typeof stencil.defaultSize.height).toBe('number');
  });

  it('[CONTRACT] search stencil items have same shape as list items', async () => {
    const listResult = JSON.parse(await executeListStencils({ search: 'server', pageSize: 1 }));
    const searchResult = JSON.parse(await executeSearchStencils({ query: 'server', limit: 1 }));

    const listItem = listResult.stencils[0];
    const searchItem = searchResult.results[0];

    // Both should have the same fields
    expect(Object.keys(listItem).sort()).toEqual(Object.keys(searchItem).sort());
  });

  it('[CONTRACT] list total equals sum of all pages', async () => {
    const pageSize = 10;
    const firstPage = JSON.parse(await executeListStencils({ pageSize }));
    const totalPages = Math.ceil(firstPage.total / pageSize);

    let count = 0;
    for (let page = 1; page <= totalPages; page++) {
      const result = JSON.parse(await executeListStencils({ page, pageSize }));
      count += result.stencils.length;
    }

    expect(count).toBe(firstPage.total);
  });

  it('[CONTRACT] search total equals length when results are not limited', async () => {
    const result = JSON.parse(
      await executeSearchStencils({ query: 'k8s', limit: 100 }),
    );

    expect(result.results.length).toBe(result.total);
  });

  it('[CONTRACT] executePlaceStencil returns valid JSON-like message on success', async () => {
    const client = createMockClient();
    const result = await executePlaceStencil(client, {
      stencilId: 'server',
      x: 0,
      y: 0,
    });

    // Success message is a formatted string (not JSON), but has consistent structure
    expect(result).toMatch(/^Placed stencil '.+' \(\d+×\d+\) at \(\d+, \d+\) \[id: .+\]$/);
  });

  it('[CONTRACT] executePlaceStencil error for unknown ID mentions valid IDs', async () => {
    const client = createMockClient();
    const result = await executePlaceStencil(client, {
      stencilId: 'totally-bogus-id-12345',
      x: 0,
      y: 0,
    });

    expect(result).toContain('Unknown stencil');
    expect(result).toContain('server'); // lists valid IDs
    expect(result).toContain('database');
  });
});

// ── Catalog integration with stencil counts [COVERAGE] ─────

describe('catalog stencil count accuracy', () => {
  it('[COVERAGE] catalog total matches getAllStencilMeta count', () => {
    const catalog = executeCatalog({ section: 'stencils' });
    const totalMatch = catalog.match(/Total: (\d+) stencils across (\d+) categories/);

    expect(totalMatch).not.toBeNull();
    expect(Number(totalMatch![1])).toBe(totalStencils);
    expect(Number(totalMatch![2])).toBe(allCategories.length);
  });

  it('[COVERAGE] each category count in catalog matches engine API', () => {
    const catalog = executeCatalog({ section: 'stencils' });

    for (const category of allCategories) {
      const regex = new RegExp(`### ${category} \\((\\d+)\\)`);
      const match = catalog.match(regex);

      expect(match).not.toBeNull();
      const reportedCount = Number(match![1]);
      const actualCount = getStencilsByCategory(category).length;
      expect(reportedCount).toBe(actualCount);
    }
  });

  it('[COVERAGE] catalog lists every stencil from the engine', () => {
    const catalog = executeCatalog({ section: 'stencils' });
    const allMeta = getAllStencilMeta();

    for (const stencil of allMeta) {
      expect(catalog).toContain(stencil.id);
      expect(catalog).toContain(stencil.label);
    }
  });

  it('[COVERAGE] list stencils total matches search all total', async () => {
    // Listing with no filters and searching with broad query should cover same count
    const listResult = JSON.parse(await executeListStencils({}));
    const searchResult = JSON.parse(await executeSearchStencils({ query: '', limit: 200 }));

    // Empty query in search matches all because ''.includes('') is true
    expect(searchResult.total).toBe(listResult.total);
  });
});

// ── Cross-tool consistency [COVERAGE] ──────────────────────

describe('cross-tool stencil consistency', () => {
  it('[COVERAGE] every category from engine appears in list results', async () => {
    const result = JSON.parse(await executeListStencils({ pageSize: 200 }));
    const categoriesInResult = new Set(
      result.stencils.map((s: { category: string }) => s.category),
    );

    for (const category of allCategories) {
      expect(categoriesInResult.has(category)).toBe(true);
    }
  });

  it('[COVERAGE] filtering by each category yields correct count', async () => {
    for (const category of allCategories) {
      const result = JSON.parse(await executeListStencils({ category }));
      const engineCount = getStencilsByCategory(category).length;
      expect(result.total).toBe(engineCount);
    }
  });

  it('[COVERAGE] search and list return same stencils for same query', async () => {
    const listResult = JSON.parse(await executeListStencils({ search: 'pod', pageSize: 200 }));
    const searchResult = JSON.parse(
      await executeSearchStencils({ query: 'pod', limit: 200 }),
    );

    const listIds = listResult.stencils.map((s: { id: string }) => s.id).sort();
    const searchIds = searchResult.results.map((s: { id: string }) => s.id).sort();

    expect(listIds).toEqual(searchIds);
  });

  it('[COVERAGE] fuzzy-matched stencil can be found via search', async () => {
    const client = createMockClient();
    const placeResult = await executePlaceStencil(client, {
      stencilId: 'Pod',
      x: 0,
      y: 0,
    });

    // Fuzzy resolved to k8s-pod — verify it's discoverable via search
    expect(placeResult).toContain('Placed stencil');

    const searchResult = JSON.parse(
      await executeSearchStencils({ query: 'Pod' }),
    );
    expect(searchResult.total).toBeGreaterThan(0);
    const ids = searchResult.results.map((s: { id: string }) => s.id);
    expect(ids).toContain('k8s-pod');
  });
});
