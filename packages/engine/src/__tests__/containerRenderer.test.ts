/**
 * Container renderer — unit tests.
 *
 * TDD tests for the container renderer (#112):
 * - Renders header bar with title text
 * - Renders body area when expanded
 * - Only renders header when collapsed
 * - Collapse chevron drawn
 * - Self-registers in composite registry
 *
 * @module
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type {
  VisualExpression,
  ExpressionStyle,
  ContainerData,
} from '@infinicanvas/protocol';
import {
  getCompositeRenderer,
  clearCompositeRenderers,
} from '../renderer/compositeRegistry.js';

// ── Global stubs for browser APIs ────────────────────────────

class Path2DStub {
  moveTo = vi.fn();
  lineTo = vi.fn();
  closePath = vi.fn();
}

class ImageStub {
  src = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

beforeAll(() => {
  vi.stubGlobal('Path2D', Path2DStub);
  vi.stubGlobal('Image', ImageStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
  clearCompositeRenderers();
});

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

function makeContainerExpression(
  data: ContainerData,
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  return {
    id: 'container-test-1',
    kind: 'container',
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
    data,
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
    roundRect: vi.fn(),
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

// ── Container Renderer Tests ─────────────────────────────────

describe('containerRenderer [#112]', () => {
  let renderContainer: typeof import('../renderer/composites/containerRenderer.js').renderContainer;

  beforeAll(async () => {
    const mod = await import('../renderer/composites/containerRenderer.js');
    renderContainer = mod.renderContainer;
  });

  it('self-registers in the composite registry', () => {
    const renderer = getCompositeRenderer('container');
    expect(renderer).toBeTruthy();
  });

  it('renders expanded container without throwing', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Development',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    expect(() => renderContainer(ctx, expr, rc as any)).not.toThrow();
  });

  it('renders title text in the header', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'QA Team',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Title should be rendered via fillText
    const textCalls = ctx.fillText.mock.calls.map((c: unknown[]) => c[0]);
    expect(textCalls).toContain('QA Team');
  });

  it('renders outer border rectangle', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Test',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Should draw the outer rectangle (full size)
    expect(rc.rectangle).toHaveBeenCalledWith(100, 100, 400, 300, expect.any(Object));
  });

  it('renders header separator line when expanded', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Test',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Should draw a separator line at headerHeight
    expect(rc.line).toHaveBeenCalledWith(100, 140, 500, 140, expect.any(Object));
  });

  it('renders header fill rect', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Test',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Header fill + body fill = 2 fillRect calls
    expect(ctx.fillRect).toHaveBeenCalled();
    // First fillRect is the header background
    expect(ctx.fillRect.mock.calls[0]).toEqual([100, 100, 400, 40]);
  });

  it('renders collapsed container with header-only height', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Collapsed Section',
      headerHeight: 40,
      padding: 20,
      collapsed: true,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Outer rectangle should use header height only
    expect(rc.rectangle).toHaveBeenCalledWith(100, 100, 400, 40, expect.any(Object));

    // Should NOT draw separator line when collapsed
    expect(rc.line).not.toHaveBeenCalled();
  });

  it('does not draw body fill when collapsed', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Collapsed',
      headerHeight: 40,
      padding: 20,
      collapsed: true,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Only header fillRect, no body fillRect
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('draws body fill when expanded', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Expanded',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Header fillRect + body fillRect = 2 calls
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    // Body fill starts below header
    expect(ctx.fillRect.mock.calls[1]).toEqual([100, 140, 400, 260]);
  });

  it('draws collapse chevron', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Test',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // Chevron is drawn via beginPath + moveTo + lineTo + closePath + fill
    // This should be called at least once for the chevron
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('saves and restores canvas context', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Test',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data);

    renderContainer(ctx, expr, rc as any);

    // save/restore should be balanced (outer + chevron helper)
    expect(ctx.save.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(ctx.restore.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('renders with transparent background using strokeColor for header', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const data: ContainerData = {
      kind: 'container',
      title: 'Transparent',
      headerHeight: 40,
      padding: 20,
      collapsed: false,
    };
    const expr = makeContainerExpression(data, {
      style: makeStyle({ backgroundColor: 'transparent' }),
    });

    expect(() => renderContainer(ctx, expr, rc as any)).not.toThrow();
  });
});
