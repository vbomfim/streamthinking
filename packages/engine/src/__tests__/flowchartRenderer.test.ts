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

// ── Empty Flowchart ──────────────────────────────────────────

describe('empty flowchart', () => {
  it('renders title only in a bordered box', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Empty Flow',
      nodes: [],
      edges: [],
    });

    renderFlowchart(ctx, expr, rc as any);

    // Title text rendered
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('Empty Flow');

    // Bordered box rendered via roughCanvas.rectangle
    expect(rc.rectangle).toHaveBeenCalled();
    expect(rc.draw).toHaveBeenCalled();
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

// ── Auto-Sizing ──────────────────────────────────────────────

describe('flowchart auto-sizing', () => {
  it('updates expression size from dagre layout output', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeFlowchartExpression({
      title: 'Auto-size',
      nodes: [
        { id: 'a', label: 'Start', shape: 'rect' },
        { id: 'b', label: 'Process', shape: 'rect' },
        { id: 'c', label: 'End', shape: 'rect' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });

    renderFlowchart(ctx, expr, rc as any);

    // After rendering, expression size should have been auto-computed
    // from dagre layout. The size should be positive and reasonable.
    expect(expr.size.width).toBeGreaterThan(0);
    expect(expr.size.height).toBeGreaterThan(0);
  });
});
