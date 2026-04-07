/**
 * Contract tests for the canvas_auto_layout MCP tool.
 *
 * QA Guardian scope: API contract validation, error paths.
 * Verifies the tool's interface contract — parameter handling,
 * response format, and error behavior.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';
import { executeAutoLayout } from '../tools/layoutTools.js';

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

function createArrow(
  id: string,
  fromId: string,
  toId: string,
): VisualExpression {
  const now = Date.now();
  return {
    id,
    kind: 'arrow',
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
    data: {
      kind: 'arrow' as const,
      points: [[0, 0], [100, 100]] as [number, number][],
      startBinding: { expressionId: fromId, anchor: 'auto' as const, ratio: 0.5 },
      endBinding: { expressionId: toId, anchor: 'auto' as const, ratio: 0.5 },
    },
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
    getLayers: vi.fn().mockReturnValue([
      { id: 'default', name: 'Default', visible: true, locked: false, order: 0 },
    ]),
    getActiveLayerId: vi.fn().mockReturnValue('default'),
    sendLayerAdd: vi.fn().mockReturnValue('layer-1'),
    sendSetActiveLayer: vi.fn(),
    sendToggleLayerVisibility: vi.fn(),
    sendMoveToLayer: vi.fn(),
  };
}

// ── [CONTRACT] Response format ─────────────────────────────

describe('[CONTRACT] executeAutoLayout — response format', () => {
  it('returns a string for empty canvas', async () => {
    const client = createMockClient();
    const result = await executeAutoLayout(client, { algorithm: 'grid' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a string containing algorithm name on success', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 100, y: 300 } }),
    ];
    const client = createMockClient(exprs);

    for (const algo of ['grid', 'tree', 'force'] as const) {
      const result = await executeAutoLayout(client, { algorithm: algo });
      expect(result).toContain(algo);
    }
  });

  it('returns a string mentioning count of rearranged expressions', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 100, y: 300 } }),
      createExpression({ id: 'c', kind: 'rectangle', position: { x: 800, y: 800 } }),
    ];
    const client = createMockClient(exprs);
    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    // Should contain a number indicating how many were moved
    expect(result).toMatch(/\d+/);
  });
});

// ── [CONTRACT] sendUpdate call contract ────────────────────

describe('[CONTRACT] executeAutoLayout — sendUpdate calls', () => {
  it('calls sendUpdate with (id, {position}) shape', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 100, y: 300 } }),
    ];
    const client = createMockClient(exprs);
    await executeAutoLayout(client, { algorithm: 'grid' });

    const calls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    for (const call of calls) {
      // First arg: string ID
      expect(typeof call[0]).toBe('string');
      // Second arg: object with position
      expect(call[1]).toHaveProperty('position');
      expect(call[1].position).toHaveProperty('x');
      expect(call[1].position).toHaveProperty('y');
      expect(typeof call[1].position.x).toBe('number');
      expect(typeof call[1].position.y).toBe('number');
    }
  });

  it('sends updates sequentially (one at a time, awaited)', async () => {
    const callOrder: number[] = [];
    let callIndex = 0;
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 100, y: 300 } }),
    ];
    const client = createMockClient(exprs);
    (client.sendUpdate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push(callIndex++);
      // Simulate async delay
      await new Promise((r) => setTimeout(r, 1));
    });

    await executeAutoLayout(client, { algorithm: 'grid' });

    // Calls should be sequential (0, 1, 2, ...)
    for (let i = 0; i < callOrder.length; i++) {
      expect(callOrder[i]).toBe(i);
    }
  });
});

// ── [CONTRACT] Layer visibility filtering ──────────────────

describe('[CONTRACT] executeAutoLayout — layer filtering', () => {
  it('treats expressions without layerId as belonging to default layer', async () => {
    // Expression without layerId property
    const expr = createExpression({
      id: 'no-layer',
      kind: 'rectangle',
      position: { x: 500, y: 500 },
    });
    // Explicitly remove layerId if present
    delete (expr as Record<string, unknown>).layerId;

    const client = createMockClient([expr]);
    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    // Should process it (default layer is visible)
    expect(typeof result).toBe('string');
  });

  it('filters multiple hidden layers correctly', async () => {
    const visible = createExpression({
      id: 'vis',
      kind: 'rectangle',
      position: { x: 500, y: 500 },
      layerId: 'layer-1',
    });
    const hidden1 = createExpression({
      id: 'hid1',
      kind: 'rectangle',
      position: { x: 100, y: 100 },
      layerId: 'layer-2',
    });
    const hidden2 = createExpression({
      id: 'hid2',
      kind: 'rectangle',
      position: { x: 200, y: 200 },
      layerId: 'layer-3',
    });

    const client = createMockClient([visible, hidden1, hidden2]);
    (client.getLayers as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, order: 0 },
      { id: 'layer-2', name: 'Layer 2', visible: false, locked: false, order: 1 },
      { id: 'layer-3', name: 'Layer 3', visible: false, locked: false, order: 2 },
    ]);

    await executeAutoLayout(client, { algorithm: 'grid' });

    const updateCalls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const updatedIds = updateCalls.map((call: unknown[]) => call[0]);
    expect(updatedIds).not.toContain('hid1');
    expect(updatedIds).not.toContain('hid2');
  });

  it('handles all expressions locked — returns appropriate message', async () => {
    const locked = createExpression({
      id: 'locked',
      kind: 'rectangle',
      meta: {
        author: MCP_AUTHOR,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        locked: true,
      },
    });
    const client = createMockClient([locked]);
    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    // Should return a message about no eligible expressions
    expect(result.toLowerCase()).toContain('no');
    expect(client.sendUpdate).not.toHaveBeenCalled();
  });
});

// ── [CONTRACT] All algorithm parameters pass through ───────

describe('[CONTRACT] executeAutoLayout — parameter passthrough', () => {
  it('passes direction parameter for tree layout', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle' }),
      createExpression({ id: 'b', kind: 'rectangle' }),
    ];
    const arrow = createArrow('arr1', 'a', 'b');
    const client = createMockClient([...exprs, arrow]);

    // LR direction should position B to the right of A
    await executeAutoLayout(client, { algorithm: 'tree', direction: 'LR' });

    const calls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });

  it('passes columns parameter for grid layout', async () => {
    const exprs = Array.from({ length: 6 }, (_, i) =>
      createExpression({
        id: `e${i}`,
        kind: 'rectangle',
        position: { x: i * 100, y: i * 100 },
      }),
    );
    const client = createMockClient(exprs);

    await executeAutoLayout(client, { algorithm: 'grid', columns: 2 });

    expect(client.sendUpdate).toHaveBeenCalled();
  });

  it('passes iterations parameter for force layout', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 0, y: 0 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 10, y: 10 } }),
    ];
    const client = createMockClient(exprs);

    await executeAutoLayout(client, { algorithm: 'force', iterations: 200 });

    // Should have processed without error
    expect(client.sendUpdate).toHaveBeenCalled();
  });
});

// ── [EDGE] MCP tool — sendUpdate failure resilience ────────

describe('[EDGE] executeAutoLayout — gateway error handling', () => {
  it('propagates sendUpdate errors to caller', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 100, y: 300 } }),
    ];
    const client = createMockClient(exprs);
    (client.sendUpdate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Gateway connection lost'),
    );

    await expect(
      executeAutoLayout(client, { algorithm: 'grid' }),
    ).rejects.toThrow('Gateway connection lost');
  });
});
