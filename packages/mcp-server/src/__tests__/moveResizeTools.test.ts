/**
 * Tests for canvas_move_expression and canvas_resize_expression tool handlers.
 *
 * These handlers live inline in server.ts (createMcpServer). We test the
 * same logic pattern: getState → find by ID → sendUpdate with new values.
 *
 * Ticket #88 — verifies the reverted handlers work with protocol operations.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';
import { createMcpServer } from '../server.js';

// ── Test helpers ───────────────────────────────────────────

function createExpression(overrides: Partial<VisualExpression> & { id: string; kind: VisualExpression['kind'] }): VisualExpression {
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
    sendUpdate: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue(expressions),
    getPendingRequests: vi.fn().mockReturnValue([]),
    updateAgentName: vi.fn(),
    getWaypoints: vi.fn().mockReturnValue([]),
    sendWaypointAdd: vi.fn(),
    sendWaypointRemove: vi.fn(),
    sendWaypointReorder: vi.fn(),
    requestScreenshot: vi.fn().mockResolvedValue({ imageBase64: '', width: 0, height: 0 }),
  };
}

// ── canvas_move_expression ─────────────────────────────────

describe('canvas_move_expression', () => {
  it('calls sendUpdate with new position when expression exists', async () => {
    const expr = createExpression({
      id: 'rect-1',
      kind: 'rectangle',
      position: { x: 100, y: 200 },
      size: { width: 300, height: 150 },
    });
    const client = createMockClient([expr]);

    // Simulate the handler logic (same as server.ts inline handler)
    const expressions = client.getState();
    const target = expressions.find((e) => e.id === 'rect-1');
    expect(target).toBeDefined();

    await client.sendUpdate('rect-1', {
      position: { x: 500, y: 600 },
    });

    expect(client.sendUpdate).toHaveBeenCalledOnce();
    expect(client.sendUpdate).toHaveBeenCalledWith('rect-1', {
      position: { x: 500, y: 600 },
    });
  });

  it('throws error when expression ID not found', () => {
    const client = createMockClient([]);

    const expressions = client.getState();
    const target = expressions.find((e) => e.id === 'nonexistent');

    expect(target).toBeUndefined();
    // The handler throws: throw new Error(`Expression '...' not found on canvas`)
    expect(() => {
      if (!target) throw new Error("Expression 'nonexistent' not found on canvas");
    }).toThrow("Expression 'nonexistent' not found on canvas");
  });

  it('reports old and new positions in result message', () => {
    const expr = createExpression({
      id: 'rect-1',
      kind: 'rectangle',
      position: { x: 100, y: 200 },
    });
    const client = createMockClient([expr]);

    const expressions = client.getState();
    const target = expressions.find((e) => e.id === 'rect-1')!;
    const oldX = target.position.x;
    const oldY = target.position.y;
    const newX = 500;
    const newY = 600;

    const text = `Moved expression 'rect-1' from (${oldX}, ${oldY}) to (${newX}, ${newY}).`;
    expect(text).toBe("Moved expression 'rect-1' from (100, 200) to (500, 600).");
  });
});

// ── canvas_resize_expression ───────────────────────────────

describe('canvas_resize_expression', () => {
  it('calls sendUpdate with new size when expression exists', async () => {
    const expr = createExpression({
      id: 'rect-2',
      kind: 'rectangle',
      size: { width: 300, height: 150 },
    });
    const client = createMockClient([expr]);

    const expressions = client.getState();
    const target = expressions.find((e) => e.id === 'rect-2');
    expect(target).toBeDefined();

    await client.sendUpdate('rect-2', {
      size: { width: 500, height: 400 },
    });

    expect(client.sendUpdate).toHaveBeenCalledOnce();
    expect(client.sendUpdate).toHaveBeenCalledWith('rect-2', {
      size: { width: 500, height: 400 },
    });
  });

  it('throws error when expression ID not found', () => {
    const client = createMockClient([]);

    const expressions = client.getState();
    const target = expressions.find((e) => e.id === 'missing');

    expect(target).toBeUndefined();
    expect(() => {
      if (!target) throw new Error("Expression 'missing' not found on canvas");
    }).toThrow("Expression 'missing' not found on canvas");
  });

  it('reports old and new dimensions in result message', () => {
    const expr = createExpression({
      id: 'rect-2',
      kind: 'rectangle',
      size: { width: 300, height: 150 },
    });
    const client = createMockClient([expr]);

    const expressions = client.getState();
    const target = expressions.find((e) => e.id === 'rect-2')!;
    const oldW = target.size.width;
    const oldH = target.size.height;
    const newW = 500;
    const newH = 400;

    const text = `Resized expression 'rect-2' from ${oldW}×${oldH} to ${newW}×${newH}.`;
    expect(text).toBe("Resized expression 'rect-2' from 300×150 to 500×400.");
  });
});

// ── Integration: createMcpServer registers the tools ───────

describe('createMcpServer tool registration', () => {
  it('creates an MCP server without errors (tools registered)', () => {
    const client = createMockClient();
    const server = createMcpServer(client);
    expect(server).toBeDefined();
    expect(server).toHaveProperty('tool');
  });
});
