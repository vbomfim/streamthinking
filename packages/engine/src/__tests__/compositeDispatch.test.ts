/**
 * Unit tests for composite render dispatch and placeholder rendering.
 *
 * Covers: delegation to composite renderers for known composite kinds,
 * placeholder rendering for unknown kinds.
 *
 * @module
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import { renderExpressions, clearImageCache } from '../renderer/primitiveRenderer.js';
import {
  registerCompositeRenderer,
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
});

afterEach(() => {
  clearImageCache();
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

function makeExpression(
  id: string,
  kind: string,
  data: Record<string, unknown>,
  overrides: Partial<VisualExpression> = {},
): VisualExpression {
  return {
    id,
    kind: kind as VisualExpression['kind'],
    position: { x: 100, y: 100 },
    size: { width: 200, height: 150 },
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
    draw: vi.fn(),
  };
}

// ── Composite Dispatch Tests ─────────────────────────────────

describe('composite renderer dispatch', () => {
  const identityCamera: Camera = { x: 0, y: 0, zoom: 1 };

  it('delegates to composite renderer for a registered composite kind', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();
    const compositeRenderer = vi.fn();

    registerCompositeRenderer('flowchart', compositeRenderer);

    const expr = makeExpression('fc-1', 'flowchart', {
      title: 'Test',
      nodes: [],
      edges: [],
      direction: 'TB',
    });

    renderExpressions(ctx, rc as any, { 'fc-1': expr }, ['fc-1'], identityCamera, 800, 600);

    expect(compositeRenderer).toHaveBeenCalledWith(ctx, expr, rc);
  });

  it('renders placeholder for unknown kind with no composite renderer', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const expr = makeExpression('unknown-1', 'some-future-kind', {});

    renderExpressions(ctx, rc as any, { 'unknown-1': expr }, ['unknown-1'], identityCamera, 800, 600);

    // Should render placeholder (gray rounded rect with kind name)
    // Instead of just warning, it renders a placeholder
    expect(ctx.fillText).toHaveBeenCalledWith(
      expect.stringContaining('some-future-kind'),
      expect.any(Number),
      expect.any(Number),
    );

    warnSpy.mockRestore();
  });

  it('placeholder renders gray rounded rectangle with kind name', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const expr = makeExpression('unk-1', 'sequence-diagram', {}, {
      position: { x: 50, y: 50 },
      size: { width: 300, height: 200 },
    });

    renderExpressions(ctx, rc as any, { 'unk-1': expr }, ['unk-1'], identityCamera, 800, 600);

    // Should render the kind name as text
    const fillTextCalls = ctx.fillText.mock.calls.map((c: any[]) => c[0]);
    expect(fillTextCalls).toContain('sequence-diagram');

    warnSpy.mockRestore();
  });
});
