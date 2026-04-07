/**
 * Tests for container and swimlane MCP tools.
 *
 * Verifies that container/swimlane tools build correct VisualExpression
 * objects with proper data payloads, sizing, and positioning.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import type { VisualExpression, ContainerData } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  buildContainer,
  buildSwimlanes,
  executeCreateContainer,
  executeCreateSwimlanes,
} from '../tools/containerTools.js';

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
  };
}

// ── buildContainer ──────────────────────────────────────────

describe('buildContainer', () => {
  it('creates a container with correct kind and data', () => {
    const expr = buildContainer({
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      title: 'Development',
    });

    expect(expr.kind).toBe('container');
    expect(expr.id).toBeTruthy();

    const data = expr.data as ContainerData;
    expect(data.kind).toBe('container');
    expect(data.title).toBe('Development');
    expect(data.headerHeight).toBe(40);
    expect(data.padding).toBe(20);
    expect(data.collapsed).toBe(false);
  });

  it('applies position and size correctly', () => {
    const expr = buildContainer({
      x: 50,
      y: 75,
      width: 500,
      height: 400,
      title: 'Test',
    });

    expect(expr.position).toEqual({ x: 50, y: 75 });
    expect(expr.size).toEqual({ width: 500, height: 400 });
  });

  it('applies custom headerHeight and padding', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Custom',
      headerHeight: 50,
      padding: 30,
    });

    const data = expr.data as ContainerData;
    expect(data.headerHeight).toBe(50);
    expect(data.padding).toBe(30);
  });

  it('applies collapsed state', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Collapsed',
      collapsed: true,
    });

    const data = expr.data as ContainerData;
    expect(data.collapsed).toBe(true);
  });

  it('applies style overrides', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Styled',
      strokeColor: '#FF0000',
      backgroundColor: '#00FF00',
      fillStyle: 'hachure',
    });

    expect(expr.style.strokeColor).toBe('#FF0000');
    expect(expr.style.backgroundColor).toBe('#00FF00');
    expect(expr.style.fillStyle).toBe('hachure');
  });

  it('uses default style when no overrides', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Default',
    });

    // Should have default stroke color (from DEFAULT_STYLE)
    expect(expr.style.strokeColor).toBeTruthy();
    expect(expr.style.strokeWidth).toBeGreaterThan(0);
  });
});

// ── buildSwimlanes ──────────────────────────────────────────

describe('buildSwimlanes', () => {
  it('creates N containers for N lanes', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [
        { title: 'Dev' },
        { title: 'QA' },
        { title: 'Ops' },
      ],
    });

    expect(lanes).toHaveLength(3);
    expect(lanes.every((l) => l.kind === 'container')).toBe(true);
  });

  it('arranges horizontal lanes side-by-side', () => {
    const lanes = buildSwimlanes({
      x: 100,
      y: 200,
      lanes: [
        { title: 'Lane A' },
        { title: 'Lane B' },
      ],
      orientation: 'horizontal',
      laneWidth: 300,
      laneHeight: 400,
    });

    expect(lanes[0]!.position).toEqual({ x: 100, y: 200 });
    expect(lanes[1]!.position).toEqual({ x: 400, y: 200 }); // 100 + 300
  });

  it('arranges vertical lanes stacked', () => {
    const lanes = buildSwimlanes({
      x: 100,
      y: 200,
      lanes: [
        { title: 'Lane A' },
        { title: 'Lane B' },
      ],
      orientation: 'vertical',
      laneWidth: 300,
      laneHeight: 400,
    });

    expect(lanes[0]!.position).toEqual({ x: 100, y: 200 });
    expect(lanes[1]!.position).toEqual({ x: 100, y: 600 }); // 200 + 400
  });

  it('uses default dimensions when not specified', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [{ title: 'Default' }],
    });

    expect(lanes[0]!.size.width).toBe(300);
    expect(lanes[0]!.size.height).toBe(400);
  });

  it('assigns correct titles to each lane', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [
        { title: 'Design' },
        { title: 'Build' },
        { title: 'Test' },
      ],
    });

    const titles = lanes.map((l) => (l.data as ContainerData).title);
    expect(titles).toEqual(['Design', 'Build', 'Test']);
  });

  it('gives each lane a unique ID', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [
        { title: 'A' },
        { title: 'B' },
      ],
    });

    expect(lanes[0]!.id).not.toBe(lanes[1]!.id);
  });
});

// ── executeCreateContainer ──────────────────────────────────

describe('executeCreateContainer', () => {
  it('sends container to gateway and returns success message', async () => {
    const client = createMockClient();
    const result = await executeCreateContainer(client, {
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      title: 'My Container',
    });

    expect(client.sendCreate).toHaveBeenCalledTimes(1);
    const sent = (client.sendCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as VisualExpression;
    expect(sent.kind).toBe('container');
    expect(result).toContain('My Container');
    expect(result).toContain('400×300');
    expect(result).toContain('id:');
  });
});

// ── executeCreateSwimlanes ──────────────────────────────────

describe('executeCreateSwimlanes', () => {
  it('sends all lanes via sendBatchCreate and returns success message', async () => {
    const client = createMockClient();
    const result = await executeCreateSwimlanes(client, {
      x: 0,
      y: 0,
      lanes: [
        { title: 'Dev' },
        { title: 'QA' },
      ],
    });

    // Fix #8: should use batch create, not sequential sendCreate
    expect(client.sendBatchCreate).toHaveBeenCalledTimes(1);
    const batchArg = (client.sendBatchCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as VisualExpression[];
    expect(batchArg).toHaveLength(2);
    expect(batchArg[0]!.kind).toBe('container');
    expect(batchArg[1]!.kind).toBe('container');
    // Sequential sendCreate should NOT be called
    expect(client.sendCreate).not.toHaveBeenCalled();
    expect(result).toContain('2');
    expect(result).toContain('Dev');
    expect(result).toContain('QA');
    expect(result).toContain('horizontal');
  });

  it('reports vertical orientation in message', async () => {
    const client = createMockClient();
    const result = await executeCreateSwimlanes(client, {
      x: 0,
      y: 0,
      lanes: [{ title: 'A' }],
      orientation: 'vertical',
    });

    expect(result).toContain('vertical');
  });
});
