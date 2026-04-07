/**
 * Unit tests for canvas_apply_theme MCP tool.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: theme application via MCP, listing themes, error cases.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import type { IGatewayClient } from '../gatewayClient.js';
import {
  executeApplyTheme,
  executeListThemes,
} from '../tools/themeTools.js';

// ── Test helpers ───────────────────────────────────────────

const testAuthor = {
  type: 'agent' as const,
  id: 'mcp-test',
  name: 'Test Agent',
  provider: 'mcp',
};

function createExpression(
  overrides: Partial<VisualExpression> & { id: string; kind: VisualExpression['kind'] },
): VisualExpression {
  const now = Date.now();
  return {
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: testAuthor,
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
    getState: vi.fn().mockReturnValue(expressions),
  } as unknown as IGatewayClient;
}

// ── executeListThemes ─────────────────────────────────────

describe('executeListThemes', () => {
  it('returns a formatted list of available themes', () => {
    const result = executeListThemes();
    expect(result).toContain('corporate');
    expect(result).toContain('Corporate');
    expect(result).toContain('technical');
    expect(result).toContain('dark');
    expect(result).toContain('blueprint');
    expect(result).toContain('colorful');
  });

  it('includes theme descriptions', () => {
    const result = executeListThemes();
    expect(result).toContain('Professional blues and grays');
    expect(result).toContain('Clean monochrome');
  });
});

// ── executeApplyTheme ─────────────────────────────────────

describe('executeApplyTheme', () => {
  it('applies theme to all expressions on the canvas', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle' }),
      createExpression({
        id: 'e1',
        kind: 'ellipse',
        data: { kind: 'ellipse' as const, label: 'Circle' },
      }),
    ];
    const client = createMockClient(expressions);

    const result = await executeApplyTheme(client, {
      themeId: 'corporate',
    });

    expect(result).toContain('Applied');
    expect(result).toContain('Corporate');
    expect(result).toContain('2');
    expect(client.sendStyle).toHaveBeenCalled();
  });

  it('returns error message for unknown theme', async () => {
    const client = createMockClient([]);

    const result = await executeApplyTheme(client, {
      themeId: 'nonexistent',
    });

    expect(result).toContain('not found');
    expect(client.sendStyle).not.toHaveBeenCalled();
  });

  it('returns message when canvas is empty', async () => {
    const client = createMockClient([]);

    const result = await executeApplyTheme(client, {
      themeId: 'corporate',
    });

    expect(result).toContain('No expressions');
    expect(client.sendStyle).not.toHaveBeenCalled();
  });

  it('sends style operations grouped by expression kind', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle' }),
      createExpression({
        id: 't1',
        kind: 'text',
        data: { kind: 'text' as const, text: 'Hello', fontSize: 14, fontFamily: 'sans-serif', textAlign: 'left' as const },
      }),
    ];
    const client = createMockClient(expressions);

    await executeApplyTheme(client, {
      themeId: 'corporate',
    });

    // Rectangles and text get different styles, so multiple calls expected
    expect(client.sendStyle).toHaveBeenCalled();
  });

  it('always applies to all expressions (MCP has no selection)', async () => {
    const expressions = [
      createExpression({ id: 'r1', kind: 'rectangle' }),
      createExpression({ id: 'r2', kind: 'rectangle' }),
    ];
    const client = createMockClient(expressions);

    const result = await executeApplyTheme(client, {
      themeId: 'corporate',
    });

    expect(result).toContain('Applied');
    expect(result).toContain('2');
  });
});
