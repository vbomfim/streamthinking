/**
 * Contract tests for layer MCP tools.
 *
 * [CONTRACT] — validates tool output format, error messages, and
 * parameter handling.  Tests verify the public interface contract
 * of each executor function — they survive any internal refactor
 * that preserves the response text shape.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import {
  executeListLayers,
  executeAddLayer,
  executeSetActiveLayer,
  executeToggleLayerVisibility,
  executeMoveToLayer,
} from '../tools/layerTools.js';
import type { IGatewayClient, CameraWaypoint } from '../gatewayClient.js';
import type { Layer } from '@infinicanvas/protocol';

// ── Mock Factory ───────────────────────────────────────────

function createMockClient(options: {
  connected?: boolean;
  layers?: Layer[];
  activeLayerId?: string;
} = {}): IGatewayClient & {
  getLayers: () => Layer[];
  getActiveLayerId: () => string;
  sendLayerAdd: ReturnType<typeof vi.fn>;
  sendSetActiveLayer: ReturnType<typeof vi.fn>;
  sendToggleLayerVisibility: ReturnType<typeof vi.fn>;
  sendMoveToLayer: ReturnType<typeof vi.fn>;
} {
  const layers = [...(options.layers ?? [
    { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
  ])];
  let activeLayerId = options.activeLayerId ?? 'default';
  const connected = options.connected ?? true;

  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => connected,
    getSessionId: () => connected ? 'test-session' : null,
    sendCreate: vi.fn(),
    sendBatchCreate: vi.fn(),
    sendDelete: vi.fn(),
    sendMorph: vi.fn(),
    sendStyle: vi.fn(),
    sendUpdate: vi.fn(),
    getState: () => [],
    getPendingRequests: () => [],
    updateAgentName: vi.fn(),
    getWaypoints: () => [],
    sendWaypointAdd: vi.fn(),
    sendWaypointRemove: vi.fn(),
    sendWaypointReorder: vi.fn(),
    requestScreenshot: vi.fn(),
    getLayers: () => [...layers],
    getActiveLayerId: () => activeLayerId,
    sendLayerAdd: vi.fn((name?: string) => {
      const id = `layer-${layers.length}`;
      layers.push({
        id,
        name: name ?? `Layer ${layers.length + 1}`,
        visible: true,
        locked: false,
        order: layers.length,
      });
      return id;
    }),
    sendSetActiveLayer: vi.fn((layerId: string) => {
      activeLayerId = layerId;
    }),
    sendToggleLayerVisibility: vi.fn((layerId: string) => {
      const layer = layers.find((l) => l.id === layerId);
      if (layer) layer.visible = !layer.visible;
    }),
    sendMoveToLayer: vi.fn(),
  };
}

// ── executeListLayers contract ─────────────────────────────

describe('[CONTRACT] executeListLayers output format', () => {
  it('includes layer count in header', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Second', visible: true, locked: false, order: 1 },
        { id: 'l3', name: 'Third', visible: false, locked: true, order: 2 },
      ],
    });

    const result = executeListLayers(client);
    expect(result).toContain('3 layer(s)');
  });

  it('lists visibility status for each layer', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Hidden One', visible: false, locked: false, order: 1 },
      ],
    });

    const result = executeListLayers(client);
    // Should show 'visible' for Layer 1, 'hidden' for Hidden One
    expect(result).toContain('visible');
    expect(result).toContain('hidden');
  });

  it('lists lock status for locked layers', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Protected', visible: true, locked: true, order: 1 },
      ],
    });

    const result = executeListLayers(client);
    expect(result).toContain('locked');
  });

  it('marks the active layer', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Active', visible: true, locked: false, order: 1 },
      ],
      activeLayerId: 'l2',
    });

    const result = executeListLayers(client);
    expect(result).toContain('active');
  });

  it('shows all layer names', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Background', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Annotations', visible: true, locked: false, order: 1 },
        { id: 'l3', name: 'UI Elements', visible: true, locked: false, order: 2 },
      ],
    });

    const result = executeListLayers(client);
    expect(result).toContain('Background');
    expect(result).toContain('Annotations');
    expect(result).toContain('UI Elements');
  });
});

// ── executeAddLayer contract ───────────────────────────────

describe('[CONTRACT] executeAddLayer response contract', () => {
  it('response contains "created" for successful add', () => {
    const client = createMockClient();
    const result = executeAddLayer(client, { name: 'NewLayer' });
    expect(result.toLowerCase()).toContain('created');
  });

  it('response contains the layer name', () => {
    const client = createMockClient();
    const result = executeAddLayer(client, { name: 'My Custom Layer' });
    expect(result).toContain('My Custom Layer');
  });

  it('response contains the generated layer ID', () => {
    const client = createMockClient();
    const result = executeAddLayer(client, { name: 'Test' });
    // Mock generates 'layer-1' for the second layer
    expect(result).toContain('layer-1');
  });

  it('calls sendLayerAdd with undefined when no name given', () => {
    const client = createMockClient();
    executeAddLayer(client, {});
    expect(client.sendLayerAdd).toHaveBeenCalledWith(undefined);
  });

  it('error message for disconnected client is actionable', () => {
    const client = createMockClient({ connected: false });
    const result = executeAddLayer(client, { name: 'Test' });
    expect(result).toContain('Not connected');
    expect(client.sendLayerAdd).not.toHaveBeenCalled();
  });
});

// ── executeSetActiveLayer contract ─────────────────────────

describe('[CONTRACT] executeSetActiveLayer response contract', () => {
  it('response confirms the active layer change', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Target', visible: true, locked: false, order: 1 },
      ],
    });

    const result = executeSetActiveLayer(client, { layerId: 'l2' });
    expect(result).toContain('Active layer set');
    expect(result).toContain('Target');
  });

  it('calls sendSetActiveLayer with exact layerId', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'layer-xyz', name: 'Exact', visible: true, locked: false, order: 1 },
      ],
    });

    executeSetActiveLayer(client, { layerId: 'layer-xyz' });
    expect(client.sendSetActiveLayer).toHaveBeenCalledWith('layer-xyz');
  });

  it('error for non-existent layer includes "not found"', () => {
    const client = createMockClient();
    const result = executeSetActiveLayer(client, { layerId: 'ghost' });
    expect(result.toLowerCase()).toContain('not found');
  });

  it('does not call gateway for non-existent layer', () => {
    const client = createMockClient();
    executeSetActiveLayer(client, { layerId: 'ghost' });
    expect(client.sendSetActiveLayer).not.toHaveBeenCalled();
  });

  it('setting active to already-active layer succeeds', () => {
    const client = createMockClient({ activeLayerId: 'default' });

    const result = executeSetActiveLayer(client, { layerId: 'default' });
    // Should succeed without error
    expect(result).toContain('Active layer set');
    expect(client.sendSetActiveLayer).toHaveBeenCalledWith('default');
  });
});

// ── executeToggleLayerVisibility contract ──────────────────

describe('[CONTRACT] executeToggleLayerVisibility response contract', () => {
  it('response contains visibility state word (hidden or visible)', () => {
    const client = createMockClient(); // default is visible
    const result = executeToggleLayerVisibility(client, { layerId: 'default' });
    // Response must indicate the new state — exact word depends on
    // whether sendToggleLayerVisibility mutates synchronously (mock)
    // or asynchronously (production gateway).  We verify the contract
    // shape: the message includes a state indicator.
    expect(result).toMatch(/hidden|visible/i);
  });

  it('response format is consistent for initially hidden layer', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: false, locked: false, order: 0 },
      ],
    });

    const result = executeToggleLayerVisibility(client, { layerId: 'default' });
    // Same contract: response includes a visibility state
    expect(result).toMatch(/hidden|visible/i);
    expect(result).toContain('Layer 1');
  });

  it('round-trip: toggle twice returns to original state', () => {
    const client = createMockClient();

    executeToggleLayerVisibility(client, { layerId: 'default' });
    const afterFirst = client.getLayers().find((l) => l.id === 'default')!;
    expect(afterFirst.visible).toBe(false);

    executeToggleLayerVisibility(client, { layerId: 'default' });
    const afterSecond = client.getLayers().find((l) => l.id === 'default')!;
    expect(afterSecond.visible).toBe(true);
  });

  it('includes layer name in response', () => {
    const client = createMockClient();
    const result = executeToggleLayerVisibility(client, { layerId: 'default' });
    expect(result).toContain('Layer 1');
  });

  it('error for non-existent layer includes "not found"', () => {
    const client = createMockClient();
    const result = executeToggleLayerVisibility(client, { layerId: 'no-such-layer' });
    expect(result.toLowerCase()).toContain('not found');
    expect(client.sendToggleLayerVisibility).not.toHaveBeenCalled();
  });
});

// ── executeMoveToLayer contract ────────────────────────────

describe('[CONTRACT] executeMoveToLayer response contract', () => {
  it('response includes count of moved expressions', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'target', name: 'Target', visible: true, locked: false, order: 1 },
      ],
    });

    const result = executeMoveToLayer(client, {
      expressionIds: ['e1', 'e2', 'e3'],
      layerId: 'target',
    });
    expect(result).toContain('3');
    expect(result).toContain('Target');
  });

  it('response includes target layer name', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'dest', name: 'Destination Layer', visible: true, locked: false, order: 1 },
      ],
    });

    const result = executeMoveToLayer(client, {
      expressionIds: ['e1'],
      layerId: 'dest',
    });
    expect(result).toContain('Destination Layer');
  });

  it('calls gateway with exact expression IDs and layer ID', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'L2', visible: true, locked: false, order: 1 },
      ],
    });

    executeMoveToLayer(client, {
      expressionIds: ['alpha', 'beta'],
      layerId: 'l2',
    });
    expect(client.sendMoveToLayer).toHaveBeenCalledWith(['alpha', 'beta'], 'l2');
  });

  it('error for non-existent target layer', () => {
    const client = createMockClient();
    const result = executeMoveToLayer(client, {
      expressionIds: ['e1'],
      layerId: 'fake',
    });
    expect(result.toLowerCase()).toContain('not found');
    expect(client.sendMoveToLayer).not.toHaveBeenCalled();
  });

  it('error when not connected', () => {
    const client = createMockClient({ connected: false });
    const result = executeMoveToLayer(client, {
      expressionIds: ['e1'],
      layerId: 'default',
    });
    expect(result).toContain('Not connected');
    expect(client.sendMoveToLayer).not.toHaveBeenCalled();
  });

  it('single expression move succeeds', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'l2', name: 'Solo', visible: true, locked: false, order: 1 },
      ],
    });

    const result = executeMoveToLayer(client, {
      expressionIds: ['single-expr'],
      layerId: 'l2',
    });
    expect(result).toContain('1');
    expect(client.sendMoveToLayer).toHaveBeenCalledWith(['single-expr'], 'l2');
  });
});
