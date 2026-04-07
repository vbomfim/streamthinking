/**
 * Unit tests for layer MCP tools.
 *
 * Tests executeListLayers, executeAddLayer, executeSetActiveLayer,
 * executeToggleLayerVisibility, and executeMoveToLayer using a mock IGatewayClient.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeListLayers,
  executeAddLayer,
  executeSetActiveLayer,
  executeToggleLayerVisibility,
  executeMoveToLayer,
} from '../tools/layerTools.js';
import type { IGatewayClient, CameraWaypoint } from '../gatewayClient.js';
import type { Layer } from '@infinicanvas/protocol';

// ── Mock Gateway Client ────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────

describe('executeListLayers', () => {
  it('returns all layers with their properties', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'layer-2', name: 'Annotations', visible: false, locked: true, order: 1 },
      ],
    });

    const result = executeListLayers(client);

    expect(result).toContain('2 layer(s)');
    expect(result).toContain('Layer 1');
    expect(result).toContain('Annotations');
    expect(result).toContain('visible');
    expect(result).toContain('hidden');
    expect(result).toContain('locked');
  });

  it('indicates the active layer', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'layer-2', name: 'Active One', visible: true, locked: false, order: 1 },
      ],
      activeLayerId: 'layer-2',
    });

    const result = executeListLayers(client);

    expect(result).toContain('active');
  });

  it('returns message when only default layer exists', () => {
    const client = createMockClient();

    const result = executeListLayers(client);

    expect(result).toContain('1 layer(s)');
    expect(result).toContain('Layer 1');
  });
});

describe('executeAddLayer', () => {
  it('adds a layer with custom name', () => {
    const client = createMockClient();

    const result = executeAddLayer(client, { name: 'Background' });

    expect(result).toContain('Background');
    expect(result).toContain('created');
    expect(client.sendLayerAdd).toHaveBeenCalledWith('Background');
  });

  it('adds a layer with default name when no name provided', () => {
    const client = createMockClient();

    const result = executeAddLayer(client, {});

    expect(result).toContain('created');
    expect(client.sendLayerAdd).toHaveBeenCalledWith(undefined);
  });

  it('returns error when not connected', () => {
    const client = createMockClient({ connected: false });

    const result = executeAddLayer(client, { name: 'Test' });

    expect(result).toContain('Not connected');
    expect(client.sendLayerAdd).not.toHaveBeenCalled();
  });
});

describe('executeSetActiveLayer', () => {
  it('sets the active layer', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'layer-2', name: 'Second', visible: true, locked: false, order: 1 },
      ],
    });

    const result = executeSetActiveLayer(client, { layerId: 'layer-2' });

    expect(result).toContain('Active layer set');
    expect(result).toContain('Second');
    expect(client.sendSetActiveLayer).toHaveBeenCalledWith('layer-2');
  });

  it('returns error for non-existent layer', () => {
    const client = createMockClient();

    const result = executeSetActiveLayer(client, { layerId: 'non-existent' });

    expect(result).toContain('not found');
    expect(client.sendSetActiveLayer).not.toHaveBeenCalled();
  });
});

describe('executeToggleLayerVisibility', () => {
  it('toggles layer visibility', () => {
    const client = createMockClient();

    const result = executeToggleLayerVisibility(client, { layerId: 'default' });

    expect(result).toContain('Layer 1');
    expect(result).toMatch(/hidden|visible/);
    expect(client.sendToggleLayerVisibility).toHaveBeenCalledWith('default');
  });

  it('returns error for non-existent layer', () => {
    const client = createMockClient();

    const result = executeToggleLayerVisibility(client, { layerId: 'fake' });

    expect(result).toContain('not found');
    expect(client.sendToggleLayerVisibility).not.toHaveBeenCalled();
  });
});

describe('executeMoveToLayer', () => {
  it('moves expressions to a layer', () => {
    const client = createMockClient({
      layers: [
        { id: 'default', name: 'Layer 1', visible: true, locked: false, order: 0 },
        { id: 'layer-2', name: 'Target', visible: true, locked: false, order: 1 },
      ],
    });

    const result = executeMoveToLayer(client, {
      expressionIds: ['expr-1', 'expr-2'],
      layerId: 'layer-2',
    });

    expect(result).toContain('Moved 2');
    expect(result).toContain('Target');
    expect(client.sendMoveToLayer).toHaveBeenCalledWith(['expr-1', 'expr-2'], 'layer-2');
  });

  it('returns error for non-existent layer', () => {
    const client = createMockClient();

    const result = executeMoveToLayer(client, {
      expressionIds: ['expr-1'],
      layerId: 'fake-layer',
    });

    expect(result).toContain('not found');
    expect(client.sendMoveToLayer).not.toHaveBeenCalled();
  });

  it('returns error when not connected', () => {
    const client = createMockClient({ connected: false });

    const result = executeMoveToLayer(client, {
      expressionIds: ['expr-1'],
      layerId: 'default',
    });

    expect(result).toContain('Not connected');
  });
});
