/**
 * Unit tests for selection renderer.
 *
 * Verifies: bounding box drawn with correct style, 8 handles at correct
 * positions, camera transform applied, multiple selections rendered.
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import { describe, it, expect, vi } from 'vitest';
import { renderSelection } from '../renderer/selectionRenderer.js';

// ── Mock canvas context ──────────────────────────────────────

function createMockCtx() {
  const calls: { method: string; args: unknown[] }[] = [];

  const ctx = {
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    setTransform: vi.fn((...args: number[]) => calls.push({ method: 'setTransform', args })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    rect: vi.fn((...args: number[]) => calls.push({ method: 'rect', args })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    arc: vi.fn((...args: number[]) => calls.push({ method: 'arc', args })),
    fillRect: vi.fn((...args: number[]) => calls.push({ method: 'fillRect', args })),
    strokeRect: vi.fn((...args: number[]) => calls.push({ method: 'strokeRect', args })),
    setLineDash: vi.fn((pattern: number[]) => calls.push({ method: 'setLineDash', args: [pattern] })),
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    _calls: calls,
  };

  return ctx as unknown as CanvasRenderingContext2D & { _calls: typeof calls };
}

// ── Test helpers ─────────────────────────────────────────────

const DEFAULT_STYLE: ExpressionStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

const DEFAULT_META = {
  author: { type: 'agent' as const, id: 'test', name: 'Test', provider: 'test' },
  createdAt: 0,
  updatedAt: 0,
  tags: [],
  locked: false,
};

function makeRect(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'rectangle' },
  };
}

function makeArrow(
  id: string,
  points: [number, number][],
  opts?: { routing?: string; jettySize?: number; startBinding?: { expressionId: string; anchor: string } },
): VisualExpression {
  const p0 = points[0] ?? [0, 0];
  const pN = points[points.length - 1] ?? p0;
  const minX = Math.min(p0[0], pN[0]);
  const minY = Math.min(p0[1], pN[1]);
  const maxX = Math.max(p0[0], pN[0]);
  const maxY = Math.max(p0[1], pN[1]);

  return {
    id,
    kind: 'arrow',
    position: { x: minX, y: minY },
    size: { width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: {
      kind: 'arrow',
      points,
      routing: opts?.routing,
      jettySize: opts?.jettySize,
      startBinding: opts?.startBinding
        ? { expressionId: opts.startBinding.expressionId, anchor: opts.startBinding.anchor }
        : undefined,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('renderSelection', () => {
  const identityCamera: Camera = { x: 0, y: 0, zoom: 1 };

  it('does nothing when selectedIds is empty', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 0, 0, 100, 100),
    };

    renderSelection(ctx, new Set(), expressions, identityCamera);

    // Should not have drawn anything
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws dashed bounding box for a selected expression', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 50, 50, 200, 150),
    };

    renderSelection(ctx, new Set(['a']), expressions, identityCamera);

    // Should have set dashed line style
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);

    // Should have drawn a stroke rect at expression bounds
    expect(ctx.strokeRect).toHaveBeenCalledWith(50, 50, 200, 150);
  });

  it('draws 8 handles at correct positions', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 100, 100, 200, 100),
    };

    renderSelection(ctx, new Set(['a']), expressions, identityCamera);

    // 8 handles as fillRect calls (8 handles = 8 fillRect calls + potentially 8 strokeRect calls for borders)
    // Each handle is 8×8px, drawn centered on the handle point
    // Handle positions for rect at (100,100) with size (200,100):
    //   corners: (100,100), (300,100), (300,200), (100,200)
    //   edge midpoints: (200,100), (300,150), (200,200), (100,150)

    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBe(8);

    // Check corner handles (4px = half of 8px handle size)
    const handlePositions = fillRectCalls.map((c) => ({
      x: (c.args[0] as number) + 4, // center x
      y: (c.args[1] as number) + 4, // center y
    }));

    // All handles should be at expected positions
    expect(handlePositions).toContainEqual({ x: 100, y: 100 }); // top-left
    expect(handlePositions).toContainEqual({ x: 300, y: 100 }); // top-right
    expect(handlePositions).toContainEqual({ x: 300, y: 200 }); // bottom-right
    expect(handlePositions).toContainEqual({ x: 100, y: 200 }); // bottom-left
    expect(handlePositions).toContainEqual({ x: 200, y: 100 }); // top-mid
    expect(handlePositions).toContainEqual({ x: 300, y: 150 }); // right-mid
    expect(handlePositions).toContainEqual({ x: 200, y: 200 }); // bottom-mid
    expect(handlePositions).toContainEqual({ x: 100, y: 150 }); // left-mid
  });

  it('handles are 8×8 pixels in screen space', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 0, 0, 100, 100),
    };

    renderSelection(ctx, new Set(['a']), expressions, identityCamera);

    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    for (const call of fillRectCalls) {
      const w = call.args[2] as number;
      const h = call.args[3] as number;
      expect(w).toBe(8);
      expect(h).toBe(8);
    }
  });

  it('renders selection for multiple selected expressions', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 0, 0, 100, 100),
      b: makeRect('b', 200, 200, 50, 50),
    };

    renderSelection(ctx, new Set(['a', 'b']), expressions, identityCamera);

    // Should draw 2 bounding boxes and 16 handles
    const strokeRectCalls = ctx._calls.filter(
      (c) => c.method === 'strokeRect',
    );
    // 2 bounding box strokeRects + 16 handle border strokeRects = 18
    // But handle borders are optional — let's check at least 2 bounding boxes
    expect(strokeRectCalls.length).toBeGreaterThanOrEqual(2);

    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBe(16); // 8 handles × 2 expressions
  });

  it('skips selected IDs that do not exist in expressions map', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 0, 0, 100, 100),
    };

    // 'missing' is selected but not in expressions
    renderSelection(ctx, new Set(['a', 'missing']), expressions, identityCamera);

    // Should only render selection for 'a'
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBe(8); // 8 handles for 'a' only
  });

  it('uses correct selection color (#4A90D9)', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 0, 0, 100, 100),
    };

    renderSelection(ctx, new Set(['a']), expressions, identityCamera);

    // Stroke style should be set to selection color
    expect(ctx.strokeStyle).toBe('#4A90D9');
  });

  it('adjusts handle size for zoom level', () => {
    const ctx = createMockCtx();
    const expressions: Record<string, VisualExpression> = {
      a: makeRect('a', 0, 0, 100, 100),
    };

    // At zoom 2, handles should still be 8 screen pixels → 4 world pixels
    const zoomedCamera: Camera = { x: 0, y: 0, zoom: 2 };
    renderSelection(ctx, new Set(['a']), expressions, zoomedCamera);

    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    for (const call of fillRectCalls) {
      const w = call.args[2] as number;
      const h = call.args[3] as number;
      // In world coords: 8 / zoom = 4
      expect(w).toBe(4);
      expect(h).toBe(4);
    }
  });

  // ── Jetty handle rendering ─────────────────────────────────

  it('renders jetty handle for routed arrow with binding', () => {
    const ctx = createMockCtx();
    const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
      routing: 'orthogonal',
      startBinding: { expressionId: 'shape1', anchor: 'right' },
    });
    const expressions: Record<string, VisualExpression> = { a1: arrow };

    renderSelection(ctx, new Set(['a1']), expressions, identityCamera);

    // Should have arc calls: 2 for point handles (start + end)
    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls.length).toBe(2);

    // Jetty handle should now be drawn as a fillRect (square), not arc (circle)
    // 2 point-handle arcs + fillRects for jetty handle
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render jetty handle for arrow without routing', () => {
    const ctx = createMockCtx();
    const arrow = makeArrow('a1', [[100, 200], [400, 200]]);
    // No routing → no jetty handle
    const expressions: Record<string, VisualExpression> = { a1: arrow };

    renderSelection(ctx, new Set(['a1']), expressions, identityCamera);

    // Only 2 arc calls for point handles (start + end), no jetty
    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls.length).toBe(2);
    // No fillRect calls for jetty handle
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBe(0);
  });

  it('renders jetty handle with accent fill color as square', () => {
    const ctx = createMockCtx();
    const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
      routing: 'orthogonal',
      startBinding: { expressionId: 'shape1', anchor: 'right' },
    });
    const expressions: Record<string, VisualExpression> = { a1: arrow };

    renderSelection(ctx, new Set(['a1']), expressions, identityCamera);

    // Track fillStyle assignments — the jetty handle should use accent color (#4A90D9)
    expect(ctx.fillStyle).toBe('#4A90D9');
    // Jetty handle uses fillRect, not arc+fill
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(1);
  });
});
