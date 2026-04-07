/**
 * Unit tests for waypoint MCP tools.
 *
 * Tests executeAddWaypoint, executeListWaypoints, and executeRemoveWaypoint
 * using a mock IGatewayClient.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeAddWaypoint,
  executeListWaypoints,
  executeRemoveWaypoint,
} from '../tools/waypointTools.js';
import type { IGatewayClient, CameraWaypoint } from '../gatewayClient.js';

// ── Mock Gateway Client ────────────────────────────────────

function createMockClient(options: {
  connected?: boolean;
  waypoints?: CameraWaypoint[];
} = {}): IGatewayClient {
  const waypoints = [...(options.waypoints ?? [])];
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
    getState: () => [],
    getPendingRequests: () => [],
    updateAgentName: vi.fn(),
    getWaypoints: () => [...waypoints],
    sendWaypointAdd: vi.fn((wp: CameraWaypoint) => {
      waypoints.push(wp);
    }),
    sendWaypointRemove: vi.fn((index: number) => {
      if (index >= 0 && index < waypoints.length) waypoints.splice(index, 1);
    }),
    sendWaypointReorder: vi.fn(),
  };
}

// ── Tests ──────────────────────────────────────────────────

describe('executeAddWaypoint', () => {
  it('sends waypoint-add and returns confirmation with label', () => {
    const client = createMockClient();

    const result = executeAddWaypoint(client, {
      x: 100, y: 200, zoom: 1.5, label: 'Overview',
    });

    expect(result).toContain('Waypoint');
    expect(result).toContain('"Overview"');
    expect(result).toContain('(100, 200)');
    expect(result).toContain('zoom 1.5');
    expect(client.sendWaypointAdd).toHaveBeenCalledWith({
      x: 100, y: 200, zoom: 1.5, label: 'Overview',
    });
  });

  it('sends waypoint-add without label', () => {
    const client = createMockClient();

    const result = executeAddWaypoint(client, { x: 0, y: 0, zoom: 1 });

    expect(result).toContain('Waypoint');
    expect(result).toContain('(0, 0)');
    expect(result).not.toContain('"');
    expect(client.sendWaypointAdd).toHaveBeenCalledWith({
      x: 0, y: 0, zoom: 1, label: undefined,
    });
  });

  it('returns error when not connected', () => {
    const client = createMockClient({ connected: false });

    const result = executeAddWaypoint(client, { x: 0, y: 0, zoom: 1 });

    expect(result).toContain('Not connected');
    expect(client.sendWaypointAdd).not.toHaveBeenCalled();
  });
});

describe('executeListWaypoints', () => {
  it('returns empty message when no waypoints', () => {
    const client = createMockClient({ waypoints: [] });

    const result = executeListWaypoints(client);

    expect(result).toContain('No waypoints');
  });

  it('lists waypoints with labels and positions', () => {
    const client = createMockClient({
      waypoints: [
        { x: 0, y: 0, zoom: 1, label: 'Start' },
        { x: 500, y: 500, zoom: 2, label: 'Detail View' },
      ],
    });

    const result = executeListWaypoints(client);

    expect(result).toContain('2 waypoint(s)');
    expect(result).toContain('1. "Start"');
    expect(result).toContain('position (0, 0)');
    expect(result).toContain('2. "Detail View"');
    expect(result).toContain('position (500, 500)');
    expect(result).toContain('zoom 2');
  });

  it('lists waypoints without labels', () => {
    const client = createMockClient({
      waypoints: [{ x: 100, y: 200, zoom: 1 }],
    });

    const result = executeListWaypoints(client);

    expect(result).toContain('1.');
    expect(result).toContain('position (100, 200)');
  });
});

describe('executeRemoveWaypoint', () => {
  it('removes waypoint by 1-based index', () => {
    const client = createMockClient({
      waypoints: [
        { x: 0, y: 0, zoom: 1, label: 'First' },
        { x: 100, y: 100, zoom: 2, label: 'Second' },
      ],
    });

    const result = executeRemoveWaypoint(client, { index: 1 });

    expect(result).toContain('Waypoint 1');
    expect(result).toContain('"First"');
    expect(result).toContain('removed');
    expect(client.sendWaypointRemove).toHaveBeenCalledWith(0); // 0-based
  });

  it('returns error for out-of-bounds index', () => {
    const client = createMockClient({ waypoints: [{ x: 0, y: 0, zoom: 1 }] });

    const result = executeRemoveWaypoint(client, { index: 5 });

    expect(result).toContain('Invalid waypoint index');
    expect(client.sendWaypointRemove).not.toHaveBeenCalled();
  });

  it('returns error for zero index', () => {
    const client = createMockClient({ waypoints: [{ x: 0, y: 0, zoom: 1 }] });

    const result = executeRemoveWaypoint(client, { index: 0 });

    expect(result).toContain('Invalid waypoint index');
  });

  it('returns error when not connected', () => {
    const client = createMockClient({ connected: false });

    const result = executeRemoveWaypoint(client, { index: 1 });

    expect(result).toContain('Not connected');
  });
});
