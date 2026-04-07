/**
 * Tests for canvas_auto_layout MCP tool.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies layout computation and position update dispatching.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';
import { executeAutoLayout } from '../tools/layoutTools.js';
import type { AutoLayoutParams } from '../tools/layoutTools.js';

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
  fromId?: string,
  toId?: string,
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
      startBinding: fromId
        ? { expressionId: fromId, anchor: 'auto' as const, ratio: 0.5 }
        : undefined,
      endBinding: toId
        ? { expressionId: toId, anchor: 'auto' as const, ratio: 0.5 }
        : undefined,
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

// ── Tests ──────────────────────────────────────────────────

describe('executeAutoLayout', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('returns message when canvas is empty', async () => {
    const result = await executeAutoLayout(client, { algorithm: 'grid' });
    expect(result).toContain('No expressions');
  });

  it('applies grid layout and sends position updates', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 100, y: 300 } }),
    ];
    client = createMockClient(exprs);

    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    expect(result).toContain('2');
    expect(result).toContain('grid');
    // Should have sent updates for each repositioned expression
    expect(client.sendUpdate).toHaveBeenCalled();
  });

  it('applies tree layout with direction parameter', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle' }),
      createExpression({ id: 'b', kind: 'rectangle' }),
    ];
    const arrow = createArrow('arr1', 'a', 'b');
    client = createMockClient([...exprs, arrow]);

    const result = await executeAutoLayout(client, {
      algorithm: 'tree',
      direction: 'LR',
    });

    expect(result).toContain('tree');
    expect(client.sendUpdate).toHaveBeenCalled();
  });

  it('applies force layout with iterations', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 0, y: 0 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 10, y: 10 } }),
    ];
    client = createMockClient(exprs);

    const result = await executeAutoLayout(client, {
      algorithm: 'force',
      iterations: 50,
    });

    expect(result).toContain('force');
  });

  it('skips locked expressions', async () => {
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
    const normal = createExpression({ id: 'normal', kind: 'rectangle' });
    client = createMockClient([locked, normal]);

    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    // Should only have sent update for 'normal', not 'locked'
    const updateCalls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const updatedIds = updateCalls.map((call: unknown[]) => call[0]);
    expect(updatedIds).not.toContain('locked');
  });

  it('skips expressions on hidden layers', async () => {
    const visible = createExpression({
      id: 'visible',
      kind: 'rectangle',
      layerId: 'default',
    });
    const hidden = createExpression({
      id: 'hidden',
      kind: 'rectangle',
      layerId: 'hidden-layer',
    });
    client = createMockClient([visible, hidden]);
    (client.getLayers as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: 'default', name: 'Default', visible: true, locked: false, order: 0 },
      { id: 'hidden-layer', name: 'Hidden', visible: false, locked: false, order: 1 },
    ]);

    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    const updateCalls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const updatedIds = updateCalls.map((call: unknown[]) => call[0]);
    expect(updatedIds).not.toContain('hidden');
  });

  it('skips expressions on locked layers', async () => {
    const unlocked = createExpression({
      id: 'unlocked',
      kind: 'rectangle',
      layerId: 'default',
      position: { x: 500, y: 500 },
    });
    const onLockedLayer = createExpression({
      id: 'on-locked-layer',
      kind: 'rectangle',
      layerId: 'locked-layer',
      position: { x: 300, y: 300 },
    });
    client = createMockClient([unlocked, onLockedLayer]);
    (client.getLayers as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: 'default', name: 'Default', visible: true, locked: false, order: 0 },
      { id: 'locked-layer', name: 'Locked', visible: true, locked: true, order: 1 },
    ]);

    await executeAutoLayout(client, { algorithm: 'grid' });

    const updateCalls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const updatedIds = updateCalls.map((call: unknown[]) => call[0]);
    expect(updatedIds).not.toContain('on-locked-layer');
  });

  it('does not send update for expressions that did not move', async () => {
    // Single expression at origin — grid layout will place it at origin too
    const expr = createExpression({
      id: 'only',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
    });
    client = createMockClient([expr]);

    await executeAutoLayout(client, { algorithm: 'grid' });

    // For a single expression, grid puts it at (0,0) — same position
    // Should not send pointless update
    const updateCalls = (client.sendUpdate as ReturnType<typeof vi.fn>).mock.calls;
    const movedIds = updateCalls
      .filter((call: unknown[]) => {
        const changes = call[1] as { position: { x: number; y: number } };
        return changes.position.x !== 0 || changes.position.y !== 0;
      })
      .map((call: unknown[]) => call[0]);
    // Should either not be called or only called with the same position
    expect(movedIds).not.toContain('only');
  });

  it('accepts custom spacing parameter', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle' }),
      createExpression({ id: 'b', kind: 'rectangle' }),
    ];
    client = createMockClient(exprs);

    const result = await executeAutoLayout(client, {
      algorithm: 'grid',
      spacing: { horizontal: 100, vertical: 100 },
    });

    expect(result).toContain('grid');
    expect(client.sendUpdate).toHaveBeenCalled();
  });

  it('returns summary with count of rearranged expressions', async () => {
    const exprs = [
      createExpression({ id: 'a', kind: 'rectangle', position: { x: 500, y: 500 } }),
      createExpression({ id: 'b', kind: 'rectangle', position: { x: 300, y: 100 } }),
      createExpression({ id: 'c', kind: 'rectangle', position: { x: 100, y: 800 } }),
    ];
    client = createMockClient(exprs);

    const result = await executeAutoLayout(client, { algorithm: 'grid' });

    // Should mention some count of rearranged expressions
    expect(result).toMatch(/\d+/);
    expect(result).toContain('grid');
  });
});
