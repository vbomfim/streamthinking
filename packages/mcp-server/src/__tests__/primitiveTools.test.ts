/**
 * Tests for primitive expression tools.
 *
 * Verifies that each primitive tool builds correct VisualExpression
 * objects and sends them to the gateway client.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  buildRectangle,
  buildEllipse,
  buildLine,
  buildArrow,
  buildText,
  buildStickyNote,
  executeDrawRectangle,
  executeDrawEllipse,
  executeDrawLine,
  executeDrawArrow,
  executeDrawText,
  executeAddStickyNote,
} from '../tools/primitiveTools.js';
import { DEFAULT_STYLE } from '../defaults.js';

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

// ── Rectangle ──────────────────────────────────────────────

describe('buildRectangle', () => {
  it('creates a rectangle with required params', () => {
    const expr = buildRectangle({ x: 100, y: 200, width: 300, height: 150 });

    expect(expr.kind).toBe('rectangle');
    expect(expr.position).toEqual({ x: 100, y: 200 });
    expect(expr.size).toEqual({ width: 300, height: 150 });
    expect(expr.data).toEqual({ kind: 'rectangle', label: undefined });
    expect(expr.id).toBeDefined();
    expect(expr.angle).toBe(0);
    expect(expr.meta.author.type).toBe('agent');
    expect(expr.meta.author.id).toMatch(/^mcp-/);
    expect(expr.meta.locked).toBe(false);
  });

  it('applies optional label', () => {
    const expr = buildRectangle({ x: 0, y: 0, width: 100, height: 100, label: 'My Box' });

    expect(expr.data).toEqual({ kind: 'rectangle', label: 'My Box' });
  });

  it('applies optional style overrides', () => {
    const expr = buildRectangle({
      x: 0, y: 0, width: 100, height: 100,
      strokeColor: '#FF0000',
      backgroundColor: '#00FF00',
      fillStyle: 'solid',
    });

    expect(expr.style.strokeColor).toBe('#FF0000');
    expect(expr.style.backgroundColor).toBe('#00FF00');
    expect(expr.style.fillStyle).toBe('solid');
    // Other defaults preserved
    expect(expr.style.strokeWidth).toBe(DEFAULT_STYLE.strokeWidth);
    expect(expr.style.roughness).toBe(DEFAULT_STYLE.roughness);
  });

  it('uses default style when no overrides provided', () => {
    const expr = buildRectangle({ x: 0, y: 0, width: 100, height: 100 });

    expect(expr.style.strokeColor).toBe(DEFAULT_STYLE.strokeColor);
    expect(expr.style.backgroundColor).toBe(DEFAULT_STYLE.backgroundColor);
    expect(expr.style.fillStyle).toBe(DEFAULT_STYLE.fillStyle);
  });
});

describe('executeDrawRectangle', () => {
  let client: IGatewayClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('sends create operation and returns confirmation', async () => {
    const result = await executeDrawRectangle(client, {
      x: 100, y: 200, width: 300, height: 150, label: 'Test',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    const sentExpr = (client.sendCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0] as VisualExpression;
    expect(sentExpr.kind).toBe('rectangle');
    expect(result).toContain('Created rectangle');
    expect(result).toContain("'Test'");
    expect(result).toContain('300×150');
  });

  it('omits label in message when not provided', async () => {
    const result = await executeDrawRectangle(client, {
      x: 0, y: 0, width: 100, height: 100,
    });

    expect(result).not.toContain("'");
    expect(result).toContain('Created rectangle');
  });
});

// ── Ellipse ────────────────────────────────────────────────

describe('buildEllipse', () => {
  it('creates an ellipse with required params', () => {
    const expr = buildEllipse({ x: 50, y: 50, width: 200, height: 200 });

    expect(expr.kind).toBe('ellipse');
    expect(expr.position).toEqual({ x: 50, y: 50 });
    expect(expr.size).toEqual({ width: 200, height: 200 });
    expect(expr.data).toEqual({ kind: 'ellipse', label: undefined });
  });

  it('applies optional label', () => {
    const expr = buildEllipse({ x: 0, y: 0, width: 100, height: 100, label: 'Circle' });

    expect(expr.data).toEqual({ kind: 'ellipse', label: 'Circle' });
  });
});

describe('executeDrawEllipse', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawEllipse(client, {
      x: 0, y: 0, width: 100, height: 100, label: 'O',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Created ellipse');
    expect(result).toContain("'O'");
  });
});

// ── Line ───────────────────────────────────────────────────

describe('buildLine', () => {
  it('creates a line from points', () => {
    const points: [number, number][] = [[0, 0], [100, 100], [200, 50]];
    const expr = buildLine({ points });

    expect(expr.kind).toBe('line');
    expect(expr.data).toEqual({ kind: 'line', points });
    expect(expr.position).toEqual({ x: 0, y: 0 });
    expect(expr.size).toEqual({ width: 200, height: 100 });
  });

  it('computes correct bounding box for non-origin points', () => {
    const points: [number, number][] = [[50, 100], [150, 300]];
    const expr = buildLine({ points });

    expect(expr.position).toEqual({ x: 50, y: 100 });
    expect(expr.size).toEqual({ width: 100, height: 200 });
  });

  it('throws error for fewer than 2 points', () => {
    expect(() => buildLine({ points: [[0, 0]] })).toThrow('Line requires at least 2 points');
  });

  it('throws error for empty points', () => {
    expect(() => buildLine({ points: [] })).toThrow('Line requires at least 2 points');
  });
});

describe('executeDrawLine', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawLine(client, {
      points: [[0, 0], [100, 100]],
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Created line');
    expect(result).toContain('2 points');
  });
});

// ── Arrow ──────────────────────────────────────────────────

describe('buildArrow', () => {
  it('creates an arrow with end arrowhead', () => {
    const points: [number, number][] = [[0, 0], [100, 100]];
    const expr = buildArrow({ points });

    expect(expr.kind).toBe('arrow');
    expect(expr.data).toEqual({
      kind: 'arrow',
      points,
      endArrowhead: 'triangle',
      startArrowhead: 'none',
      label: undefined,
    });
  });

  it('throws error for fewer than 2 points', () => {
    expect(() => buildArrow({ points: [[0, 0]] })).toThrow('Arrow requires at least 2 points');
  });
});

describe('executeDrawArrow', () => {
  it('sends create and returns confirmation with label', async () => {
    const client = createMockClient();
    const result = await executeDrawArrow(client, {
      points: [[0, 0], [100, 0]],
      label: 'Next',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Created arrow');
    expect(result).toContain("'Next'");
  });
});

// ── Text ───────────────────────────────────────────────────

describe('buildText', () => {
  it('creates a text expression with defaults', () => {
    const expr = buildText({ x: 10, y: 20, text: 'Hello World' });

    expect(expr.kind).toBe('text');
    expect(expr.position).toEqual({ x: 10, y: 20 });
    expect(expr.data).toEqual({
      kind: 'text',
      text: 'Hello World',
      fontSize: 14,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
  });

  it('applies custom font size and family', () => {
    const expr = buildText({
      x: 0, y: 0, text: 'Big text',
      fontSize: 32, fontFamily: 'monospace',
    });

    expect(expr.data).toEqual({
      kind: 'text',
      text: 'Big text',
      fontSize: 32,
      fontFamily: 'monospace',
      textAlign: 'left',
    });
  });

  it('estimates size based on text length', () => {
    const shortExpr = buildText({ x: 0, y: 0, text: 'Hi' });
    const longExpr = buildText({ x: 0, y: 0, text: 'This is a much longer text for testing' });

    expect(longExpr.size.width).toBeGreaterThan(shortExpr.size.width);
  });
});

describe('executeDrawText', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeDrawText(client, {
      x: 10, y: 20, text: 'Hello World',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Created text');
    expect(result).toContain("'Hello World'");
  });

  it('truncates long text in confirmation message', async () => {
    const client = createMockClient();
    const longText = 'A'.repeat(60);
    const result = await executeDrawText(client, {
      x: 0, y: 0, text: longText,
    });

    expect(result).toContain('…');
    expect(result.length).toBeLessThan(longText.length + 100);
  });
});

// ── Sticky Note ────────────────────────────────────────────

describe('buildStickyNote', () => {
  it('creates a sticky note with default color', () => {
    const expr = buildStickyNote({ x: 100, y: 100, text: 'Remember this' });

    expect(expr.kind).toBe('sticky-note');
    expect(expr.position).toEqual({ x: 100, y: 100 });
    expect(expr.size).toEqual({ width: 200, height: 200 });
    expect((expr.data as { kind: 'sticky-note'; text: string; color: string }).text).toBe('Remember this');
    expect((expr.data as { kind: 'sticky-note'; text: string; color: string }).color).toBeDefined();
    expect(expr.style.fillStyle).toBe('solid');
  });

  it('applies custom color', () => {
    const expr = buildStickyNote({
      x: 0, y: 0, text: 'Note', color: '#FF5722',
    });

    expect((expr.data as { kind: 'sticky-note'; text: string; color: string }).color).toBe('#FF5722');
    expect(expr.style.backgroundColor).toBe('#FF5722');
  });
});

describe('executeAddStickyNote', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeAddStickyNote(client, {
      x: 50, y: 50, text: 'TODO: Fix bug',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Created sticky note');
    expect(result).toContain("'TODO: Fix bug'");
  });
});

// ── Cross-cutting concerns ─────────────────────────────────

describe('primitive tools cross-cutting', () => {
  it('each built expression has a unique ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const expr = buildRectangle({ x: 0, y: 0, width: 100, height: 100 });
      ids.add(expr.id);
    }
    expect(ids.size).toBe(10);
  });

  it('all expressions have MCP author info', () => {
    const expressions = [
      buildRectangle({ x: 0, y: 0, width: 100, height: 100 }),
      buildEllipse({ x: 0, y: 0, width: 100, height: 100 }),
      buildLine({ points: [[0, 0], [100, 100]] }),
      buildArrow({ points: [[0, 0], [100, 100]] }),
      buildText({ x: 0, y: 0, text: 'test' }),
      buildStickyNote({ x: 0, y: 0, text: 'test' }),
    ];

    for (const expr of expressions) {
      expect(expr.meta.author.type).toBe('agent');
      expect(expr.meta.author.id).toMatch(/^mcp-/);
      expect(expr.meta.author.provider).toBe('mcp');
    }
  });

  it('all expressions have timestamps', () => {
    const before = Date.now();
    const expr = buildRectangle({ x: 0, y: 0, width: 100, height: 100 });
    const after = Date.now();

    expect(expr.meta.createdAt).toBeGreaterThanOrEqual(before);
    expect(expr.meta.createdAt).toBeLessThanOrEqual(after);
    expect(expr.meta.updatedAt).toBe(expr.meta.createdAt);
  });
});
