/**
 * Unit tests for point-based selection rendering.
 *
 * Verifies that lines, arrows, and freehand shapes render point handles
 * instead of the 8 bounding-box handles.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import { renderSelection } from '../renderer/selectionRenderer.js';

// ── Mock canvas context ──────────────────────────────────────

function createMockCtx() {
  const calls: { method: string; args: unknown[] }[] = [];

  const ctx = {
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    arc: vi.fn((...args: number[]) => calls.push({ method: 'arc', args })),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
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

const identityCamera: Camera = { x: 0, y: 0, zoom: 1 };

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

function makeLine(id: string, points: [number, number][]): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    kind: 'line',
    position: { x: minX, y: minY },
    size: { width: Math.max(...xs) - minX || 1, height: Math.max(...ys) - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'line', points },
  };
}

function makeArrow(id: string, points: [number, number][]): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    kind: 'arrow',
    position: { x: minX, y: minY },
    size: { width: Math.max(...xs) - minX || 1, height: Math.max(...ys) - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'arrow', points, endArrowhead: true },
  };
}

function makeFreehand(id: string, points: [number, number, number][]): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    id,
    kind: 'freehand',
    position: { x: minX, y: minY },
    size: { width: Math.max(...xs) - minX || 1, height: Math.max(...ys) - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'freehand', points },
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('renderSelection — point-based shapes', () => {
  it('renders circular handles at endpoints for a line (not 8 bbox handles)', () => {
    const ctx = createMockCtx();
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };

    renderSelection(ctx, new Set(['l1']), expressions, identityCamera);

    // Should render circular handles (arc calls) instead of square handles (fillRect)
    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls).toHaveLength(2); // 2 endpoints

    // Should NOT render 8 square bbox handles
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls).toHaveLength(0);
  });

  it('renders circular handles at each point for an arrow', () => {
    const ctx = createMockCtx();
    const arrow = makeArrow('a1', [[50, 50], [200, 100], [350, 50]]);
    const expressions = { a1: arrow };

    renderSelection(ctx, new Set(['a1']), expressions, identityCamera);

    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls).toHaveLength(3); // 3 points
  });

  it('renders circular handles at first and last point only for freehand', () => {
    const ctx = createMockCtx();
    const freehand = makeFreehand('f1', [
      [10, 10, 0.5],
      [20, 15, 0.6],
      [30, 20, 0.7],
      [40, 25, 0.8],
      [50, 30, 0.5],
    ]);
    const expressions = { f1: freehand };

    renderSelection(ctx, new Set(['f1']), expressions, identityCamera);

    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls).toHaveLength(2); // Only first and last
  });

  it('renders point handles at correct positions for a line', () => {
    const ctx = createMockCtx();
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };

    renderSelection(ctx, new Set(['l1']), expressions, identityCamera);

    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');

    // arc(cx, cy, radius, startAngle, endAngle)
    // First handle at (100, 100)
    expect(arcCalls[0]!.args[0]).toBe(100); // cx
    expect(arcCalls[0]!.args[1]).toBe(100); // cy

    // Second handle at (300, 200)
    expect(arcCalls[1]!.args[0]).toBe(300); // cx
    expect(arcCalls[1]!.args[1]).toBe(200); // cy
  });

  it('still renders 8 bbox handles for rectangles', () => {
    const ctx = createMockCtx();
    const rect = makeRect('r1', 100, 100, 200, 200);
    const expressions = { r1: rect };

    renderSelection(ctx, new Set(['r1']), expressions, identityCamera);

    // Should render 8 square handles
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls).toHaveLength(8);

    // Should NOT render circular handles
    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls).toHaveLength(0);
  });

  it('still draws dashed bounding box for lines', () => {
    const ctx = createMockCtx();
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };

    renderSelection(ctx, new Set(['l1']), expressions, identityCamera);

    // Should set dash pattern
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 4]);
  });

  it('adjusts point handle radius for zoom level', () => {
    const ctx = createMockCtx();
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const zoomedCamera: Camera = { x: 0, y: 0, zoom: 2 };

    renderSelection(ctx, new Set(['l1']), expressions, zoomedCamera);

    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    // Handle radius should be HANDLE_SIZE_PX / 2 / zoom = 8 / 2 / 2 = 2
    for (const call of arcCalls) {
      expect(call.args[2]).toBe(2); // radius
    }
  });

  it('renders mixed selection: rect gets bbox handles, line gets point handles', () => {
    const ctx = createMockCtx();
    const rect = makeRect('r1', 0, 0, 100, 100);
    const line = makeLine('l1', [[200, 200], [400, 300]]);
    const expressions = { r1: rect, l1: line };

    renderSelection(ctx, new Set(['r1', 'l1']), expressions, identityCamera);

    // 8 fillRect for rect bbox handles
    const fillRectCalls = ctx._calls.filter((c) => c.method === 'fillRect');
    expect(fillRectCalls).toHaveLength(8);

    // 2 arc calls for line point handles
    const arcCalls = ctx._calls.filter((c) => c.method === 'arc');
    expect(arcCalls).toHaveLength(2);
  });
});
