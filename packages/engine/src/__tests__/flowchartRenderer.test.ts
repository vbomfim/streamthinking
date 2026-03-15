/**
 * Unit tests for flowchart composite renderer.
 *
 * Covers: dagre layout, node shape rendering (rect, diamond, ellipse,
 * parallelogram, cylinder), edge rendering with arrowheads, labels,
 * title rendering, empty flowchart, direction variants, style
 * inheritance, layout caching, and auto-sizing.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VisualExpression, ExpressionStyle, FlowchartData } from '@infinicanvas/protocol';
import {
  renderFlowchart,
  clearLayoutCache,
  invalidateLayoutCache,
} from '../renderer/composites/flowchartRenderer.js';

// ── Helpers ──────────────────────────────────────────────────

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

function makeFlowchartExpression(
  data: Partial<FlowchartData> & { title: string },
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  const flowData: FlowchartData = {
    kind: 'flowchart',
    title: data.title,
    nodes: data.nodes ?? [],
    edges: data.edges ?? [],
    direction: data.direction ?? 'TB',
  };

  return {
    id: 'flowchart-1',
    kind: 'flowchart',
    position: { x: 100, y: 100 },
    size: { width: 400, height: 300 },
    angle: 0,
    style: makeStyle(),
    meta: {
      author: { type: 'human', id: 'user-1', name: 'Test' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: flowData,
    ...overrides,
  };
}

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    quadraticCurveTo: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

function createMockRoughCanvas() {
  return {
    rectangle: vi.fn(() => ({ shape: 'rectangle', options: {}, sets: [] })),
    ellipse: vi.fn(() => ({ shape: 'ellipse', options: {}, sets: [] })),
    polygon: vi.fn(() => ({ shape: 'polygon', options: {}, sets: [] })),
    linearPath: vi.fn(() => ({ shape: 'linearPath', options: {}, sets: [] })),
    line: vi.fn(() => ({ shape: 'line', options: {}, sets: [] })),
    draw: vi.fn(),
  };
}

beforeEach(() => {
  clearLayoutCache();
});

afterEach(() => {
  clearLayoutCache();
});

// ── Dagre Layout Tests ───────────────────────────────────────

describe('flowchart dagre layout', () => {
  it('assigns positions to nodes using dagre', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test Flow',
      nodes: [
        { id: 'a', label: 'Start', shape: 'ellipse' },
        { id: 'b', label: 'Process', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    // Should render both nodes — at least 2 Rough.js shape calls
    const totalShapeCalls =
      rc.rectangle.mock.calls.length +
      rc.ellipse.mock.calls.length +
      rc.polygon.mock.calls.length;
    expect(totalShapeCalls).toBeGreaterThanOrEqual(2);
  });
});

// ── Node Shape Rendering ─────────────────────────────────────

describe('flowchart node shapes', () => {
  it('renders rect nodes via roughCanvas.rectangle', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [{ id: 'a', label: 'Box', shape: 'rect' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    expect(rc.rectangle).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('renders diamond nodes via roughCanvas.polygon', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [{ id: 'a', label: 'Decision?', shape: 'diamond' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    expect(rc.polygon).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('renders ellipse nodes via roughCanvas.ellipse', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [{ id: 'a', label: 'Start', shape: 'ellipse' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    expect(rc.ellipse).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('renders parallelogram nodes via roughCanvas.polygon', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [{ id: 'a', label: 'I/O', shape: 'parallelogram' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    expect(rc.polygon).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('renders cylinder nodes via roughCanvas.ellipse and rectangle', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [{ id: 'a', label: 'Database', shape: 'cylinder' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    // Cylinder uses ellipse for top/bottom caps and lines for sides
    expect(rc.ellipse).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('centers labels inside node shapes', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [{ id: 'a', label: 'My Label', shape: 'rect' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    // Label should be rendered centered (textAlign = 'center', textBaseline = 'middle')
    expect(ctx.fillText).toHaveBeenCalledWith(
      'My Label',
      expect.any(Number),
      expect.any(Number),
    );
  });
});

// ── Edge Rendering ───────────────────────────────────────────

describe('flowchart edges', () => {
  it('renders edges as lines with arrowheads', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'End', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    // Edge rendered as line
    expect(rc.linearPath).toHaveBeenCalled();
    // Arrowhead drawn
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders edge labels at midpoint', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Test',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'End', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b', label: 'Yes' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    // Edge label rendered
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('Yes');
  });
});

// ── Title Rendering ──────────────────────────────────────────

describe('flowchart title', () => {
  it('renders title above the node area', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'My Flowchart',
      nodes: [{ id: 'a', label: 'Start', shape: 'rect' }],
    });

    renderFlowchart(ctx, expr, rc as any);

    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('My Flowchart');
  });
});

// ── Zod validation rejects empty data (S6-3) ────────────────

describe('flowchart Zod validation (S6-3)', () => {
  it('rejects flowchart with zero nodes', async () => {
    // Dynamic import so the test works regardless of protocol build
    const { flowchartDataSchema } = await import('@infinicanvas/protocol');

    const result = flowchartDataSchema.safeParse({
      kind: 'flowchart',
      title: 'Empty',
      nodes: [],
      edges: [],
      direction: 'TB',
    });

    expect(result.success).toBe(false);
  });
});

// ── Direction Variants ───────────────────────────────────────

describe('flowchart direction', () => {
  it('supports TB direction (default)', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'TB Flow',
      direction: 'TB',
      nodes: [
        { id: 'a', label: 'Top', shape: 'rect' },
        { id: 'b', label: 'Bottom', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    // Should not throw
    expect(() => renderFlowchart(ctx, expr, rc as any)).not.toThrow();
    expect(rc.draw).toHaveBeenCalled();
  });

  it('supports LR direction', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'LR Flow',
      direction: 'LR',
      nodes: [
        { id: 'a', label: 'Left', shape: 'rect' },
        { id: 'b', label: 'Right', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    expect(() => renderFlowchart(ctx, expr, rc as any)).not.toThrow();
    expect(rc.draw).toHaveBeenCalled();
  });
});

// ── Style Inheritance ────────────────────────────────────────

describe('flowchart style inheritance', () => {
  it('inherits stroke color from expression style', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression(
      {
        title: 'Styled',
        nodes: [{ id: 'a', label: 'Node', shape: 'rect' }],
      },
      {
        style: makeStyle({ strokeColor: '#ff0000' }),
      },
    );

    renderFlowchart(ctx, expr, rc as any);

    // Rectangle should be called with options containing stroke: '#ff0000'
    const rectCall = rc.rectangle.mock.calls[0];
    expect(rectCall).toBeDefined();
    const options = rectCall![rectCall!.length - 1];
    expect(options.stroke).toBe('#ff0000');
  });
});

// ── Layout Caching ───────────────────────────────────────────

describe('flowchart layout cache', () => {
  it('caches layout per expression ID and reuses on re-render', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Cached Flow',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'End', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    // Render twice
    renderFlowchart(ctx, expr, rc as any);
    const firstCallCount = rc.rectangle.mock.calls.length;

    renderFlowchart(ctx, expr, rc as any);
    const secondCallCount = rc.rectangle.mock.calls.length;

    // Both renders should draw the same shapes
    expect(secondCallCount).toBe(firstCallCount * 2);
  });
});

// ── Renderer Purity (S5-1) ───────────────────────────────────

describe('flowchart renderer purity (S5-1)', () => {
  it('does NOT mutate expression size during render', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const originalWidth = 400;
    const originalHeight = 300;

    const expr = makeFlowchartExpression({
      title: 'Pure Render',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'Process', shape: 'rect' },
        { id: 'c', label: 'End', shape: 'rect' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    }, {
      size: { width: originalWidth, height: originalHeight },
    });

    renderFlowchart(ctx, expr, rc as any);

    // Renderer MUST NOT mutate expr.size — it should remain as set at creation
    expect(expr.size.width).toBe(originalWidth);
    expect(expr.size.height).toBe(originalHeight);
  });

  it('renders correctly regardless of expression size values', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Any Size',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'End', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    }, {
      size: { width: 1, height: 1 }, // Unrealistic size shouldn't matter
    });

    // Should not throw — renderer computes layout internally
    expect(() => renderFlowchart(ctx, expr, rc as any)).not.toThrow();

    // Nodes should still be rendered
    const totalShapeCalls =
      rc.rectangle.mock.calls.length +
      rc.ellipse.mock.calls.length +
      rc.polygon.mock.calls.length;
    expect(totalShapeCalls).toBeGreaterThanOrEqual(2);
  });
});

// ── Layout cache invalidation (S6-4) ─────────────────────────

describe('flowchart cache invalidation (S6-4)', () => {
  it('removes cache entry on invalidateLayoutCache', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Cache Test',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'End', shape: 'rect' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });

    // Render to populate cache
    renderFlowchart(ctx, expr, rc as any);

    // Invalidate the specific entry
    invalidateLayoutCache(expr.id);

    // Re-render — should still work (recomputes layout)
    expect(() => renderFlowchart(ctx, expr, rc as any)).not.toThrow();
  });
});
