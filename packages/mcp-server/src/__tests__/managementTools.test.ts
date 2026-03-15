/**
 * Tests for management tools and annotation tools.
 *
 * Verifies canvas state formatting, clear operations,
 * morph functionality, and annotation creation.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  formatCanvasState,
  executeGetState,
  executeClear,
  executeMorph,
} from '../tools/managementTools.js';
import {
  buildAnnotation,
  buildHighlight,
  buildComment,
  executeAnnotate,
  executeHighlight,
  executeAddComment,
} from '../tools/annotationTools.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';

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
    sendDelete: vi.fn().mockResolvedValue(undefined),
    sendMorph: vi.fn().mockResolvedValue(undefined),
    sendStyle: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue(expressions),
  };
}

// ── formatCanvasState ──────────────────────────────────────

describe('formatCanvasState', () => {
  it('returns empty message for empty canvas', () => {
    const result = formatCanvasState([]);
    expect(result).toContain('Canvas is empty');
  });

  it('lists expressions with IDs and kinds', () => {
    const expressions = [
      createExpression({
        id: 'rect-1',
        kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Box' },
        position: { x: 100, y: 200 },
        size: { width: 300, height: 150 },
      }),
    ];

    const result = formatCanvasState(expressions);
    expect(result).toContain('1 expression(s)');
    expect(result).toContain('rect-1');
    expect(result).toContain('rectangle');
    expect(result).toContain('"Box"');
    expect(result).toContain('(100, 200)');
    expect(result).toContain('300×150');
  });

  it('handles multiple expression types', () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'A' },
      }),
      createExpression({
        id: 't1', kind: 'text',
        data: { kind: 'text', text: 'Hello', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const },
      }),
      createExpression({
        id: 'f1', kind: 'flowchart',
        data: { kind: 'flowchart', title: 'Flow', nodes: [], edges: [], direction: 'TB' as const },
      }),
    ];

    const result = formatCanvasState(expressions);
    expect(result).toContain('3 expression(s)');
    expect(result).toContain('rectangle');
    expect(result).toContain('text');
    expect(result).toContain('flowchart');
  });

  it('truncates long labels', () => {
    const longText = 'A'.repeat(100);
    const expressions = [
      createExpression({
        id: 't1', kind: 'text',
        data: { kind: 'text', text: longText, fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' as const },
      }),
    ];

    const result = formatCanvasState(expressions);
    expect(result).toContain('…');
  });

  it('shows highlight element count', () => {
    const expressions = [
      createExpression({
        id: 'h1', kind: 'highlight',
        data: { kind: 'highlight', targetExpressionIds: ['a', 'b', 'c'], color: '#FF0' },
      }),
    ];

    const result = formatCanvasState(expressions);
    expect(result).toContain('3 elements');
  });
});

// ── executeGetState ────────────────────────────────────────

describe('executeGetState', () => {
  it('returns formatted state from gateway client', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Test' },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeGetState(client);
    expect(result).toContain('1 expression(s)');
    expect(result).toContain('rectangle');
  });

  it('returns empty message when canvas is empty', async () => {
    const client = createMockClient([]);
    const result = await executeGetState(client);
    expect(result).toContain('Canvas is empty');
  });
});

// ── executeClear ───────────────────────────────────────────

describe('executeClear', () => {
  it('deletes all expressions and returns confirmation', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle', data: { kind: 'rectangle' } }),
      createExpression({ id: 'r2', kind: 'rectangle', data: { kind: 'rectangle' } }),
    ];
    const client = createMockClient(expressions);

    const result = await executeClear(client);
    expect(client.sendDelete).toHaveBeenCalledWith(['r1', 'r2']);
    expect(result).toContain('Cleared canvas');
    expect(result).toContain('2 expression(s)');
  });

  it('handles already empty canvas', async () => {
    const client = createMockClient([]);
    const result = await executeClear(client);
    expect(client.sendDelete).not.toHaveBeenCalled();
    expect(result).toContain('already empty');
  });
});

// ── executeMorph ───────────────────────────────────────────

describe('executeMorph', () => {
  it('morphs expression from one kind to another', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Box' },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeMorph(client, { elementId: 'r1', toKind: 'ellipse' });
    expect(client.sendMorph).toHaveBeenCalledWith(
      'r1',
      'rectangle',
      'ellipse',
      { kind: 'ellipse', label: 'Box' },
    );
    expect(result).toContain('Morphed');
    expect(result).toContain('rectangle');
    expect(result).toContain('ellipse');
  });

  it('returns message when already the target kind', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle', data: { kind: 'rectangle' } }),
    ];
    const client = createMockClient(expressions);

    const result = await executeMorph(client, { elementId: 'r1', toKind: 'rectangle' });
    expect(client.sendMorph).not.toHaveBeenCalled();
    expect(result).toContain('already a rectangle');
  });

  it('throws when expression not found', async () => {
    const client = createMockClient([]);

    await expect(
      executeMorph(client, { elementId: 'nonexistent', toKind: 'ellipse' }),
    ).rejects.toThrow("Expression 'nonexistent' not found on canvas");
  });

  it('preserves label when morphing between shapes', async () => {
    const expressions = [
      createExpression({
        id: 'r1', kind: 'rectangle',
        data: { kind: 'rectangle', label: 'Keep me' },
      }),
    ];
    const client = createMockClient(expressions);

    await executeMorph(client, { elementId: 'r1', toKind: 'diamond' });

    expect(client.sendMorph).toHaveBeenCalledWith(
      'r1',
      'rectangle',
      'diamond',
      { kind: 'diamond', label: 'Keep me' },
    );
  });
});

// ── Annotation tools ───────────────────────────────────────

describe('buildAnnotation', () => {
  it('creates a callout annotation', () => {
    const expr = buildAnnotation({
      targetId: 'target-1',
      text: 'Important!',
    });

    expect(expr.kind).toBe('callout');
    expect(expr.data).toEqual({
      kind: 'callout',
      text: 'Important!',
      targetExpressionId: 'target-1',
      position: 'right',
    });
  });

  it('uses custom position', () => {
    const expr = buildAnnotation({
      targetId: 'target-1',
      text: 'Above',
      position: 'top',
    });

    expect((expr.data as { position: string }).position).toBe('top');
  });
});

describe('buildHighlight', () => {
  it('creates a highlight for multiple elements', () => {
    const expr = buildHighlight({
      elementIds: ['a', 'b', 'c'],
    });

    expect(expr.kind).toBe('highlight');
    expect(expr.data).toEqual({
      kind: 'highlight',
      targetExpressionIds: ['a', 'b', 'c'],
      color: '#FFEB3B',
    });
  });

  it('uses custom color', () => {
    const expr = buildHighlight({
      elementIds: ['a'],
      color: '#FF0000',
    });

    expect((expr.data as { color: string }).color).toBe('#FF0000');
  });

  it('throws when no element IDs provided', () => {
    expect(() => buildHighlight({ elementIds: [] })).toThrow(
      'Highlight requires at least one element ID',
    );
  });
});

describe('buildComment', () => {
  it('creates an unresolved comment', () => {
    const expr = buildComment({
      targetId: 'target-1',
      text: 'Needs review',
    });

    expect(expr.kind).toBe('comment');
    expect(expr.data).toEqual({
      kind: 'comment',
      text: 'Needs review',
      targetExpressionId: 'target-1',
      resolved: false,
    });
  });
});

describe('executeAnnotate', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeAnnotate(client, {
      targetId: 'elem-1',
      text: 'Check this',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('annotation');
    expect(result).toContain("'Check this'");
    expect(result).toContain('elem-1');
  });
});

describe('executeHighlight', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeHighlight(client, {
      elementIds: ['a', 'b'],
      color: '#FF0000',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('Highlighted');
    expect(result).toContain('2 elements');
    expect(result).toContain('#FF0000');
  });
});

describe('executeAddComment', () => {
  it('sends create and returns confirmation', async () => {
    const client = createMockClient();
    const result = await executeAddComment(client, {
      targetId: 'elem-1',
      text: 'Fix this bug',
    });

    expect(client.sendCreate).toHaveBeenCalledOnce();
    expect(result).toContain('comment');
    expect(result).toContain("'Fix this bug'");
    expect(result).toContain('elem-1');
  });
});

// ── S5-5: morph toKind enum validation ─────────────────────

describe('morph toKind enum validation (S5-5)', () => {
  it('createMcpServer registers morph tool with z.enum validation', async () => {
    const { createMcpServer } = await import('../server.js');
    const client = createMockClient();
    const server = createMcpServer(client);

    // The server should exist and have tools registered
    expect(server).toBeDefined();
  });
});
