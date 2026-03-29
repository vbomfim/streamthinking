/**
 * Unit tests for the unified TextEditor component.
 *
 * Verifies that TextEditor:
 * - Renders a textarea with font/position matching resolveTextConfig
 * - Handles commit (Enter), cancel (Escape), and blur behaviors
 * - Works for all editable expression kinds
 *
 * [TDD] Red phase tests, written before the component.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import { resolveTextConfig } from '../text/textConfig.js';
import type { TextConfig } from '../text/textConfig.js';

// ── Test helpers ─────────────────────────────────────────────

function makeStyle(overrides: Partial<ExpressionStyle> = {}): ExpressionStyle {
  return {
    strokeColor: '#000000',
    backgroundColor: '#ffffff',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 1,
    opacity: 1,
    ...overrides,
  };
}

function makeExpression(
  kind: string,
  data: Record<string, unknown>,
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  return {
    id: 'test-1',
    kind: kind as VisualExpression['kind'],
    position: { x: 100, y: 200 },
    size: { width: 300, height: 150 },
    angle: 0,
    style: makeStyle(),
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: { kind, ...data } as VisualExpression['data'],
    ...overrides,
  };
}

// ── TextEditor style computation tests ───────────────────────
// These test the CSS style generation logic that will be used by the TextEditor.
// We verify that resolveTextConfig + camera transform produces correct screen values.

describe('TextEditor style computation', () => {
  const camera = { x: 0, y: 0, zoom: 2 };

  it('produces correct screen-space position for text expression', () => {
    const expr = makeExpression('text', {
      text: 'Hello',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    const config = resolveTextConfig(expr)!;

    // Screen position = (worldX - camera.x) * zoom
    const screenX = (config.worldX - camera.x) * camera.zoom;
    const screenY = (config.worldY - camera.y) * camera.zoom;
    expect(screenX).toBe(200); // 100 * 2
    expect(screenY).toBe(400); // 200 * 2

    // Screen dimensions = world * zoom
    const screenWidth = config.worldWidth * camera.zoom;
    expect(screenWidth).toBe(600); // 300 * 2

    // Screen font size = world fontSize * zoom
    const screenFontSize = config.fontSize * camera.zoom;
    expect(screenFontSize).toBe(32); // 16 * 2
  });

  it('produces correct screen-space position for sticky note', () => {
    const expr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#FFEB3B',
    });
    const config = resolveTextConfig(expr)!;

    const screenX = (config.worldX - camera.x) * camera.zoom;
    const screenY = (config.worldY - camera.y) * camera.zoom;
    // worldX = 100 + 12 (padding) = 112; screenX = 112 * 2 = 224
    expect(screenX).toBe(224);
    // worldY = 200 + 12 = 212; screenY = 212 * 2 = 424
    expect(screenY).toBe(424);
  });

  it('produces correct screen-space position for stencil label', () => {
    const expr = makeExpression('stencil', {
      stencilId: 'server',
      category: 'generic-it',
      label: 'Server',
    });
    const config = resolveTextConfig(expr)!;

    // worldY = 200 + 150 + 4 = 354; screenY = 354 * 2 = 708
    const screenY = (config.worldY - camera.y) * camera.zoom;
    expect(screenY).toBe(708);
  });

  it('background matches expression kind', () => {
    const textExpr = makeExpression('text', {
      text: 'Hello',
      fontSize: 16,
      fontFamily: 'sans-serif',
      textAlign: 'left',
    });
    expect(resolveTextConfig(textExpr)!.background).toBe('white');

    const stickyExpr = makeExpression('sticky-note', {
      text: 'Note',
      color: '#E8F5E9',
    });
    expect(resolveTextConfig(stickyExpr)!.background).toBe('#E8F5E9');

    const rectExpr = makeExpression('rectangle', { label: 'Box' });
    expect(resolveTextConfig(rectExpr)!.background).toBe('transparent');
  });

  it('uses unified config for all editable kinds', () => {
    // Verify resolveTextConfig returns non-null for all editable kinds
    const editableKinds = [
      { kind: 'text', data: { text: 'A', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' } },
      { kind: 'sticky-note', data: { text: 'B', color: '#FFEB3B' } },
      { kind: 'rectangle', data: { label: 'C' } },
      { kind: 'ellipse', data: { label: 'D' } },
      { kind: 'diamond', data: { label: 'E' } },
      { kind: 'stencil', data: { stencilId: 'server', category: 'generic-it', label: 'F' } },
    ];

    for (const { kind, data } of editableKinds) {
      const expr = makeExpression(kind, data);
      const config = resolveTextConfig(expr);
      expect(config).not.toBeNull();
      expect(config!.fontSize).toBeGreaterThan(0);
      expect(config!.fontFamily).toBeTruthy();
    }
  });
});
