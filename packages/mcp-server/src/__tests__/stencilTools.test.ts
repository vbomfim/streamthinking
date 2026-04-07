/**
 * Tests for stencil expression tools.
 *
 * Verifies that stencil tools correctly look up catalog entries,
 * build VisualExpression objects, and list available stencils.
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
      label: 'Kubernetes Pod',
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
    const result = await executeListStencils({});

    // Should contain stencils from multiple categories
    expect(result).toContain('server');
    expect(result).toContain('database');
    expect(result).toContain('k8s-pod');
  });

  it('groups stencils by category when no filter', async () => {
    const result = await executeListStencils({});

    // Should contain category headers
    expect(result).toContain('network');
    expect(result).toContain('generic-it');
    expect(result).toContain('kubernetes');
  });

  it('filters by category when provided', async () => {
    const result = await executeListStencils({ category: 'network' });

    expect(result).toContain('server');
    expect(result).not.toContain('database');
    expect(result).not.toContain('k8s-pod');
  });

  it('returns empty message for unknown category', async () => {
    const result = await executeListStencils({ category: 'nonexistent' });

    expect(result).toContain('No stencils found');
  });

  it('includes stencil label and defaultSize', async () => {
    const result = await executeListStencils({ category: 'network' });

    expect(result).toContain('Server');
    expect(result).toContain('44');
  });

  it('returns kubernetes stencils when filtered', async () => {
    const result = await executeListStencils({ category: 'kubernetes' });

    expect(result).toContain('k8s-pod');
    expect(result).toContain('Kubernetes Pod');
    expect(result).not.toContain('server');
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
