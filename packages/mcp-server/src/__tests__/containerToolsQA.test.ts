/**
 * Container MCP tools — QA contract & edge-case tests (#112).
 *
 * Tests that verify the MCP tool layer integrates correctly
 * with the protocol validation layer: built expressions pass
 * Zod schema validation, swimlane geometry is correct, and
 * edge cases in tool parameters are handled properly.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import {
  visualExpressionSchema,
  containerDataSchema,
} from '@infinicanvas/protocol';
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
    getSessionId: vi.fn().mockReturnValue('qa-session'),
    sendCreate: vi.fn().mockResolvedValue(undefined),
    sendBatchCreate: vi.fn().mockResolvedValue(undefined),
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue([]),
  };
}

// ── [CONTRACT] buildContainer → protocol validation ──────────

describe('[CONTRACT] buildContainer passes protocol validation', () => {
  it('buildContainer output passes visualExpressionSchema', () => {
    const expr = buildContainer({
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      title: 'Dev Lane',
    });

    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('buildContainer with all optional overrides passes schema', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 500,
      height: 400,
      title: 'Full Options',
      headerHeight: 60,
      padding: 30,
      collapsed: true,
      strokeColor: '#FF0000',
      backgroundColor: '#00FF00',
      fillStyle: 'hachure',
    });

    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);

    const data = expr.data as ContainerData;
    expect(data.headerHeight).toBe(60);
    expect(data.padding).toBe(30);
    expect(data.collapsed).toBe(true);
  });

  it('buildContainer data matches containerDataSchema', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Schema check',
    });

    const result = containerDataSchema.safeParse(expr.data);
    expect(result.success).toBe(true);
  });

  it('buildContainer kind matches data.kind', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Consistency',
    });

    expect(expr.kind).toBe('container');
    expect(expr.data.kind).toBe('container');
  });
});

// ── [CONTRACT] buildSwimlanes → protocol validation ──────────

describe('[CONTRACT] buildSwimlanes passes protocol validation', () => {
  it('all swimlane expressions pass visualExpressionSchema', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [
        { title: 'Design' },
        { title: 'Build' },
        { title: 'Test' },
        { title: 'Deploy' },
      ],
    });

    for (const lane of lanes) {
      const result = visualExpressionSchema.safeParse(lane);
      expect(result.success).toBe(true);
    }
  });

  it('swimlane lane data passes containerDataSchema', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [{ title: 'Single' }],
    });

    const result = containerDataSchema.safeParse(lanes[0]!.data);
    expect(result.success).toBe(true);
  });
});

// ── [EDGE] Swimlane geometry edge cases ──────────────────────

describe('[EDGE] swimlane geometry', () => {
  it('single lane positioned at exact origin', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [{ title: 'Solo' }],
    });

    expect(lanes).toHaveLength(1);
    expect(lanes[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it('horizontal lanes with custom dimensions are flush (no gaps)', () => {
    const lanes = buildSwimlanes({
      x: 100,
      y: 50,
      lanes: [
        { title: 'A' },
        { title: 'B' },
        { title: 'C' },
      ],
      orientation: 'horizontal',
      laneWidth: 200,
      laneHeight: 300,
    });

    // Lane A: x=100, Lane B: x=300, Lane C: x=500 (gap=0)
    expect(lanes[0]!.position).toEqual({ x: 100, y: 50 });
    expect(lanes[1]!.position).toEqual({ x: 300, y: 50 });
    expect(lanes[2]!.position).toEqual({ x: 500, y: 50 });

    // All same height
    for (const lane of lanes) {
      expect(lane.size.height).toBe(300);
      expect(lane.size.width).toBe(200);
    }
  });

  it('vertical lanes stacked correctly', () => {
    const lanes = buildSwimlanes({
      x: 50,
      y: 100,
      lanes: [
        { title: 'Top' },
        { title: 'Middle' },
        { title: 'Bottom' },
      ],
      orientation: 'vertical',
      laneWidth: 400,
      laneHeight: 150,
    });

    expect(lanes[0]!.position).toEqual({ x: 50, y: 100 });
    expect(lanes[1]!.position).toEqual({ x: 50, y: 250 }); // 100 + 150
    expect(lanes[2]!.position).toEqual({ x: 50, y: 400 }); // 100 + 300
  });

  it('10 horizontal lanes are correctly spaced', () => {
    const titles = Array.from({ length: 10 }, (_, i) => ({ title: `Lane ${i}` }));
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: titles,
      laneWidth: 100,
    });

    expect(lanes).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(lanes[i]!.position.x).toBe(i * 100);
      expect(lanes[i]!.position.y).toBe(0);
    }
  });

  it('negative starting position works', () => {
    const lanes = buildSwimlanes({
      x: -500,
      y: -300,
      lanes: [{ title: 'Neg' }, { title: 'Pos' }],
      laneWidth: 200,
    });

    expect(lanes[0]!.position).toEqual({ x: -500, y: -300 });
    expect(lanes[1]!.position).toEqual({ x: -300, y: -300 });
  });

  it('default orientation is horizontal', () => {
    const lanes = buildSwimlanes({
      x: 0,
      y: 0,
      lanes: [{ title: 'A' }, { title: 'B' }],
      laneWidth: 200,
    });

    // Horizontal → different x, same y
    expect(lanes[0]!.position.y).toBe(lanes[1]!.position.y);
    expect(lanes[0]!.position.x).not.toBe(lanes[1]!.position.x);
  });
});

// ── [CONTRACT] executeCreateContainer response format ────────

describe('[CONTRACT] executeCreateContainer response', () => {
  it('response contains title, dimensions, position, and id', async () => {
    const client = createMockClient();
    const result = await executeCreateContainer(client, {
      x: 42,
      y: 84,
      width: 500,
      height: 400,
      title: 'Response Check',
    });

    expect(result).toContain('Response Check');
    expect(result).toContain('500×400');
    expect(result).toContain('42');
    expect(result).toContain('84');
    expect(result).toMatch(/id: .+/);
  });

  it('sends exactly one expression to the gateway', async () => {
    const client = createMockClient();
    await executeCreateContainer(client, {
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Single',
    });

    expect(client.sendCreate).toHaveBeenCalledTimes(1);
    const sent = (client.sendCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as VisualExpression;
    expect(sent.kind).toBe('container');
  });
});

// ── [CONTRACT] executeCreateSwimlanes response format ────────

describe('[CONTRACT] executeCreateSwimlanes response', () => {
  it('response includes lane count, titles, and orientation', async () => {
    const client = createMockClient();
    const result = await executeCreateSwimlanes(client, {
      x: 0,
      y: 0,
      lanes: [
        { title: 'Alpha' },
        { title: 'Beta' },
        { title: 'Gamma' },
      ],
      orientation: 'vertical',
    });

    expect(result).toContain('3');
    expect(result).toContain('Alpha');
    expect(result).toContain('Beta');
    expect(result).toContain('Gamma');
    expect(result).toContain('vertical');
  });

  it('sends one create per lane', async () => {
    const client = createMockClient();
    await executeCreateSwimlanes(client, {
      x: 0,
      y: 0,
      lanes: [
        { title: 'A' },
        { title: 'B' },
        { title: 'C' },
        { title: 'D' },
      ],
    });

    expect(client.sendCreate).toHaveBeenCalledTimes(4);
  });

  it('each sent expression is a valid container', async () => {
    const client = createMockClient();
    await executeCreateSwimlanes(client, {
      x: 0,
      y: 0,
      lanes: [{ title: 'X' }, { title: 'Y' }],
    });

    const calls = (client.sendCreate as ReturnType<typeof vi.fn>).mock.calls;
    for (const [expr] of calls) {
      expect(expr.kind).toBe('container');
      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    }
  });
});

// ── [EDGE] Container style edge cases ────────────────────────

describe('[EDGE] buildContainer style edge cases', () => {
  it('transparent backgroundColor works', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Transparent',
      backgroundColor: 'transparent',
    });

    expect(expr.style.backgroundColor).toBe('transparent');
    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('no style overrides uses defaults', () => {
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: 'Defaults',
    });

    expect(expr.style.strokeColor).toBeTruthy();
    expect(expr.style.fillStyle).toBeTruthy();
    expect(expr.style.strokeWidth).toBeGreaterThan(0);
    expect(expr.style.opacity).toBeGreaterThan(0);
  });
});

// ── [EDGE] Title edge cases ──────────────────────────────────

describe('[EDGE] container title edge cases', () => {
  it('buildContainer with very long title (500 chars)', () => {
    const longTitle = 'A'.repeat(500);
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: longTitle,
    });

    const data = expr.data as ContainerData;
    expect(data.title).toBe(longTitle);

    const result = containerDataSchema.safeParse(expr.data);
    expect(result.success).toBe(true);
  });

  it('buildContainer with unicode/emoji title', () => {
    const emojiTitle = '🚀 Development 开发';
    const expr = buildContainer({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      title: emojiTitle,
    });

    expect((expr.data as ContainerData).title).toBe(emojiTitle);
  });
});
