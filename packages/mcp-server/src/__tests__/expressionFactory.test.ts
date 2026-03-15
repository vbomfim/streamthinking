/**
 * Integration tests for the shared expression factory.
 *
 * Validates that buildExpression produces valid VisualExpressions
 * that pass schema validation, uses correct defaults, and merges
 * style overrides. [R7] [COVERAGE]
 *
 * These tests guard the extraction of buildExpression from three
 * separate tool files into a shared module — they ensure the
 * factory behaves identically regardless of which tool invokes it.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { visualExpressionSchema } from '@infinicanvas/protocol';
import { buildExpression } from '../expressionFactory.js';
import { DEFAULT_STYLE, MCP_AUTHOR } from '../defaults.js';

// ── R7: Shared expression factory [COVERAGE] ────────────────

describe('buildExpression factory (R7)', () => {
  it('[COVERAGE] produces a valid VisualExpression per schema', () => {
    const expr = buildExpression(
      'rectangle',
      { x: 10, y: 20 },
      { width: 200, height: 100 },
      { kind: 'rectangle' },
    );

    const result = visualExpressionSchema.safeParse(expr);
    expect(result.success).toBe(true);
  });

  it('[COVERAGE] generates unique IDs for each call', () => {
    const a = buildExpression('rectangle', { x: 0, y: 0 }, { width: 1, height: 1 }, { kind: 'rectangle' });
    const b = buildExpression('rectangle', { x: 0, y: 0 }, { width: 1, height: 1 }, { kind: 'rectangle' });

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('[COVERAGE] sets angle to 0 by default', () => {
    const expr = buildExpression(
      'ellipse',
      { x: 0, y: 0 },
      { width: 50, height: 50 },
      { kind: 'ellipse' },
    );

    expect(expr.angle).toBe(0);
  });

  it('[COVERAGE] uses MCP_AUTHOR for meta.author', () => {
    const expr = buildExpression(
      'rectangle',
      { x: 0, y: 0 },
      { width: 100, height: 100 },
      { kind: 'rectangle' },
    );

    expect(expr.meta.author).toEqual(MCP_AUTHOR);
  });

  it('[COVERAGE] uses DEFAULT_STYLE when no overrides provided', () => {
    const expr = buildExpression(
      'rectangle',
      { x: 0, y: 0 },
      { width: 100, height: 100 },
      { kind: 'rectangle' },
    );

    expect(expr.style).toEqual(DEFAULT_STYLE);
  });

  it('[COVERAGE] merges styleOverrides with DEFAULT_STYLE', () => {
    const expr = buildExpression(
      'rectangle',
      { x: 0, y: 0 },
      { width: 100, height: 100 },
      { kind: 'rectangle' },
      { strokeColor: '#ff0000', opacity: 0.5 },
    );

    // Overridden fields
    expect(expr.style.strokeColor).toBe('#ff0000');
    expect(expr.style.opacity).toBe(0.5);

    // Non-overridden fields retain defaults
    expect(expr.style.backgroundColor).toBe(DEFAULT_STYLE.backgroundColor);
    expect(expr.style.fillStyle).toBe(DEFAULT_STYLE.fillStyle);
    expect(expr.style.strokeWidth).toBe(DEFAULT_STYLE.strokeWidth);
    expect(expr.style.roughness).toBe(DEFAULT_STYLE.roughness);
  });

  it('[COVERAGE] sets createdAt equal to updatedAt', () => {
    const expr = buildExpression(
      'rectangle',
      { x: 0, y: 0 },
      { width: 100, height: 100 },
      { kind: 'rectangle' },
    );

    expect(expr.meta.createdAt).toBe(expr.meta.updatedAt);
    expect(expr.meta.createdAt).toBeGreaterThan(0);
  });

  it('[COVERAGE] sets meta.tags to empty array and locked to false', () => {
    const expr = buildExpression(
      'rectangle',
      { x: 0, y: 0 },
      { width: 100, height: 100 },
      { kind: 'rectangle' },
    );

    expect(expr.meta.tags).toEqual([]);
    expect(expr.meta.locked).toBe(false);
  });

  it('[COVERAGE] preserves position and size exactly', () => {
    const pos = { x: 42, y: 99 };
    const size = { width: 300, height: 150 };

    const expr = buildExpression(
      'rectangle',
      pos,
      size,
      { kind: 'rectangle' },
    );

    expect(expr.position).toEqual(pos);
    expect(expr.size).toEqual(size);
  });

  it('[COVERAGE] works with different expression kinds', () => {
    const kinds: Array<{ kind: string; data: Record<string, unknown> }> = [
      { kind: 'rectangle', data: { kind: 'rectangle' } },
      { kind: 'ellipse', data: { kind: 'ellipse' } },
      { kind: 'text', data: { kind: 'text', text: 'hello', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' } },
      { kind: 'sticky-note', data: { kind: 'sticky-note', text: 'note', color: '#FFEB3B' } },
    ];

    for (const { kind, data } of kinds) {
      const expr = buildExpression(
        kind as Parameters<typeof buildExpression>[0],
        { x: 0, y: 0 },
        { width: 100, height: 100 },
        data as Parameters<typeof buildExpression>[3],
      );
      expect(expr.kind).toBe(kind);
      expect(expr.data).toEqual(data);

      const result = visualExpressionSchema.safeParse(expr);
      expect(result.success).toBe(true);
    }
  });
});
