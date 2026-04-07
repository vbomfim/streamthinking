/**
 * Tests for canvas query tools.
 *
 * Verifies structured query capabilities: filtering by kind, bounds,
 * tags, label text, combined filters, truncation, and single-expression lookup.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';
import {
  executeCanvasQuery,
  executeGetExpression,
  intersects,
} from '../tools/queryTools.js';

// ── Test helpers ───────────────────────────────────────────

function createExpression(
  overrides: Partial<VisualExpression> & { id: string; kind: VisualExpression['kind'] },
): VisualExpression {
  const now = Date.now();
  return {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: { ...DEFAULT_STYLE },
    meta: {
      author: MCP_AUTHOR,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle' as const, label: undefined },
    ...overrides,
  };
}

function createMockClient(expressions: VisualExpression[] = []): IGatewayClient {
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
    getState: vi.fn().mockReturnValue(expressions),
  };
}

// ── intersects (bounding box overlap) ──────────────────────

describe('intersects', () => {
  it('returns true when expression fully inside bounds', () => {
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 50, y: 50 },
      size: { width: 20, height: 20 },
    });
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    expect(intersects(expr, bounds)).toBe(true);
  });

  it('returns true when expression partially overlaps bounds', () => {
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 150, y: 150 },
      size: { width: 100, height: 100 },
    });
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    expect(intersects(expr, bounds)).toBe(true);
  });

  it('returns false when expression fully outside bounds', () => {
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 500, y: 500 },
      size: { width: 50, height: 50 },
    });
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    expect(intersects(expr, bounds)).toBe(false);
  });

  it('returns false when expression is to the left of bounds', () => {
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 0, y: 50 },
      size: { width: 50, height: 50 },
    });
    const bounds = { x: 100, y: 0, width: 200, height: 200 };
    expect(intersects(expr, bounds)).toBe(false);
  });

  it('returns false when expression is above bounds', () => {
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 50, y: 0 },
      size: { width: 50, height: 30 },
    });
    const bounds = { x: 0, y: 100, width: 200, height: 200 };
    expect(intersects(expr, bounds)).toBe(false);
  });

  it('returns true when bounds and expression share an edge', () => {
    // Expression right edge touches bounds left edge
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
    });
    const bounds = { x: 100, y: 0, width: 100, height: 100 };
    // Edge-touching: exprRight (100) == boundsLeft (100) — NOT overlapping
    expect(intersects(expr, bounds)).toBe(false);
  });

  it('returns true when expression fully contains bounds', () => {
    const expr = createExpression({
      id: 'r1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 500, height: 500 },
    });
    const bounds = { x: 100, y: 100, width: 50, height: 50 };
    expect(intersects(expr, bounds)).toBe(true);
  });
});

// ── executeCanvasQuery ─────────────────────────────────────

describe('executeCanvasQuery', () => {
  it('returns all expressions when no filters are provided', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle', data: { kind: 'rectangle', label: 'Box' } }),
      createExpression({ id: 't1', kind: 'text', data: { kind: 'text', text: 'Hello', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const } }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, {});
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(2);
    expect(parsed.truncated).toBe(false);
    expect(parsed.total).toBe(2);
    expect(parsed.expressions).toHaveLength(2);
  });

  it('returns empty result for empty canvas', async () => {
    const client = createMockClient([]);

    const result = await executeCanvasQuery(client, {});
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(0);
    expect(parsed.truncated).toBe(false);
    expect(parsed.total).toBe(0);
    expect(parsed.expressions).toHaveLength(0);
  });

  it('filters by kind', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle', data: { kind: 'rectangle', label: 'Box' } }),
      createExpression({ id: 't1', kind: 'text', data: { kind: 'text', text: 'Hello', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const } }),
      createExpression({ id: 'r2', kind: 'rectangle', data: { kind: 'rectangle', label: 'Box 2' } }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, { kind: 'rectangle' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(2);
    expect(parsed.expressions.every((e: { kind: string }) => e.kind === 'rectangle')).toBe(true);
  });

  it('filters by bounds (overlap)', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Inside' },
        position: { x: 50, y: 50 },
        size: { width: 50, height: 50 },
      }),
      createExpression({
        id: 'r2', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Outside' },
        position: { x: 500, y: 500 },
        size: { width: 50, height: 50 },
      }),
      createExpression({
        id: 'r3', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Partial' },
        position: { x: 150, y: 150 },
        size: { width: 100, height: 100 },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, {
      bounds: { x: 0, y: 0, width: 200, height: 200 },
    });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(2);
    const ids = parsed.expressions.map((e: { id: string }) => e.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r3');
    expect(ids).not.toContain('r2');
  });

  it('filters by tags', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Tagged' },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: ['important', 'ui'], locked: false },
      }),
      createExpression({
        id: 'r2', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Untagged' },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: [], locked: false },
      }),
      createExpression({
        id: 'r3', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Partial' },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: ['important'], locked: false },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, { tags: ['important'] });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(2);
    const ids = parsed.expressions.map((e: { id: string }) => e.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r3');
    expect(ids).not.toContain('r2');
  });

  it('filters by labelContains (case-insensitive)', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle', data: { kind: 'rectangle', label: 'Login Form' } }),
      createExpression({ id: 'r2', kind: 'rectangle', data: { kind: 'rectangle', label: 'Dashboard' } }),
      createExpression({ id: 't1', kind: 'text', data: { kind: 'text', text: 'login button', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const } }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, { labelContains: 'LOGIN' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(2);
    const ids = parsed.expressions.map((e: { id: string }) => e.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('t1');
    expect(ids).not.toContain('r2');
  });

  it('combines multiple filters with AND logic', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Login' },
        position: { x: 50, y: 50 },
        size: { width: 50, height: 50 },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: ['ui'], locked: false },
      }),
      createExpression({
        id: 'r2', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Login' },
        position: { x: 500, y: 500 },
        size: { width: 50, height: 50 },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: ['ui'], locked: false },
      }),
      createExpression({
        id: 't1', kind: 'text',
        data: { kind: 'text', text: 'Login', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const },
        position: { x: 50, y: 50 },
        size: { width: 50, height: 50 },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: ['ui'], locked: false },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, {
      kind: 'rectangle',
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      labelContains: 'login',
      tags: ['ui'],
    });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(1);
    expect(parsed.expressions[0].id).toBe('r1');
  });

  it('truncates at 100 results and sets truncated flag', async () => {
    const expressions = Array.from({ length: 150 }, (_, i) =>
      createExpression({
        id: `r${i}`,
        kind: 'rectangle',
        data: { kind: 'rectangle', label: `Box ${i}` },
      }),
    );
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, {});
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(100);
    expect(parsed.truncated).toBe(true);
    expect(parsed.total).toBe(150);
    expect(parsed.expressions).toHaveLength(100);
  });

  it('returns expression summary with id, kind, position, size, label, tags, author', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'My Box' },
        position: { x: 100, y: 200 },
        size: { width: 300, height: 150 },
        meta: { author: MCP_AUTHOR, createdAt: Date.now(), updatedAt: Date.now(), tags: ['test'], locked: false },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, {});
    const parsed = JSON.parse(result);
    const expr = parsed.expressions[0];

    expect(expr.id).toBe('r1');
    expect(expr.kind).toBe('rectangle');
    expect(expr.position).toEqual({ x: 100, y: 200 });
    expect(expr.size).toEqual({ width: 300, height: 150 });
    expect(expr.label).toBe('My Box');
    expect(expr.tags).toEqual(['test']);
    expect(expr.author).toEqual(MCP_AUTHOR);
  });

  it('handles expressions with no label gracefully', async () => {
    const expressions = [
      createExpression({
        id: 'l1', kind: 'line',
        data: { kind: 'line', points: [[0, 0], [100, 100]] },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, {});
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(1);
    expect(parsed.expressions[0].label).toBeUndefined();
  });

  it('excludes expressions with no label when labelContains is specified', async () => {
    const expressions = [
      createExpression({
        id: 'l1', kind: 'line',
        data: { kind: 'line', points: [[0, 0], [100, 100]] },
      }),
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Has Label' },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeCanvasQuery(client, { labelContains: 'label' });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(1);
    expect(parsed.expressions[0].id).toBe('r1');
  });
});

// ── executeGetExpression ───────────────────────────────────

describe('executeGetExpression', () => {
  it('returns full expression data as JSON when found', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Test Box' },
        position: { x: 100, y: 200 },
        size: { width: 300, height: 150 },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeGetExpression(client, { expressionId: 'r1' });
    const parsed = JSON.parse(result);

    expect(parsed.id).toBe('r1');
    expect(parsed.kind).toBe('rectangle');
    expect(parsed.position).toEqual({ x: 100, y: 200 });
    expect(parsed.size).toEqual({ width: 300, height: 150 });
    expect(parsed.data).toEqual({ kind: 'rectangle', label: 'Test Box' });
    expect(parsed.style).toBeDefined();
    expect(parsed.meta).toBeDefined();
  });

  it('throws when expression not found', async () => {
    const client = createMockClient([]);

    await expect(
      executeGetExpression(client, { expressionId: 'nonexistent' }),
    ).rejects.toThrow("Expression 'nonexistent' not found on canvas");
  });

  it('finds the correct expression among many', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle', data: { kind: 'rectangle', label: 'First' } }),
      createExpression({ id: 'r2', kind: 'rectangle', data: { kind: 'rectangle', label: 'Second' } }),
      createExpression({ id: 'r3', kind: 'rectangle', data: { kind: 'rectangle', label: 'Third' } }),
    ];
    const client = createMockClient(expressions);

    const result = await executeGetExpression(client, { expressionId: 'r2' });
    const parsed = JSON.parse(result);

    expect(parsed.id).toBe('r2');
    expect(parsed.data.label).toBe('Second');
  });
});
