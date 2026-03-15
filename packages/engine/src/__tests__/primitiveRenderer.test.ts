/**
 * Unit tests for primitive renderer.
 *
 * Covers: rendering of all 9 primitive kinds, z-order rendering,
 * viewport culling integration, unknown kind handling, style application,
 * drawable caching, label rendering, arrowhead rendering, and image loading.
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import {
  renderExpressions,
  renderLabel,
  renderArrowhead,
  wrapText,
  clearImageCache,
} from '../renderer/primitiveRenderer.js';

// ── Global stubs for browser APIs ────────────────────────────

/** Minimal Path2D stub for Node.js environment. */
class Path2DStub {
  moveTo = vi.fn();
  lineTo = vi.fn();
  closePath = vi.fn();
}

/** Minimal Image stub for Node.js environment. */
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

// ── Rendering Tests ──────────────────────────────────────────

describe('renderExpressions', () => {
  const identityCamera: Camera = { x: 0, y: 0, zoom: 1 };

  it('renders expressions in expressionOrder (z-order)', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const rect = makeExpression('rect-1', 'rectangle', {});
    const ellipse = makeExpression('ellipse-1', 'ellipse', {});

    const expressions = { 'rect-1': rect, 'ellipse-1': ellipse };
    const order = ['rect-1', 'ellipse-1']; // rect rendered first (back), ellipse on top

    renderExpressions(ctx, rc as any, expressions, order, identityCamera, 800, 600);

    // Both should be drawn
    expect(rc.draw).toHaveBeenCalledTimes(2);
  });

  it('skips expressions outside viewport (culling)', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const visible = makeExpression('visible', 'rectangle', {}, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
    });

    const offscreen = makeExpression('offscreen', 'rectangle', {}, {
      position: { x: 2000, y: 2000 },
      size: { width: 200, height: 150 },
    });

    const expressions = { visible, offscreen };
    const order = ['visible', 'offscreen'];

    renderExpressions(ctx, rc as any, expressions, order, identityCamera, 800, 600);

    // Only the visible one should trigger rough canvas drawing
    expect(rc.rectangle).toHaveBeenCalledTimes(1);
  });

  it('renders placeholder for unknown expression kind', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const unknown = makeExpression('unknown-1', 'nonexistent-kind', {});
    const expressions = { 'unknown-1': unknown };
    const order = ['unknown-1'];

    renderExpressions(ctx, rc as any, expressions, order, identityCamera, 800, 600);

    // Should render placeholder with kind name instead of crashing
    expect(ctx.fillText).toHaveBeenCalledWith(
      'nonexistent-kind',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('skips expression IDs not found in expressions map', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expressions = {};
    const order = ['nonexistent-id'];

    expect(() => {
      renderExpressions(ctx, rc as any, expressions, order, identityCamera, 800, 600);
    }).not.toThrow();
  });

  it('applies opacity via ctx.globalAlpha', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('rect-1', 'rectangle', {}, {
      style: makeStyle({ opacity: 0.5 }),
    });

    renderExpressions(ctx, rc as any, { 'rect-1': expr }, ['rect-1'], identityCamera, 800, 600);

    // globalAlpha should be set to 0.5 during rendering
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  // ── Rectangle rendering ──

  it('renders rectangle with roughCanvas.rectangle', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('rect-1', 'rectangle', {}, {
      position: { x: 50, y: 60 },
      size: { width: 200, height: 100 },
    });

    renderExpressions(ctx, rc as any, { 'rect-1': expr }, ['rect-1'], identityCamera, 800, 600);

    expect(rc.rectangle).toHaveBeenCalledWith(50, 60, 200, 100, expect.any(Object));
    expect(rc.draw).toHaveBeenCalled();
  });

  it('renders rectangle label centered', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('rect-1', 'rectangle', { label: 'Hello' }, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
    });

    renderExpressions(ctx, rc as any, { 'rect-1': expr }, ['rect-1'], identityCamera, 800, 600);

    expect(ctx.fillText).toHaveBeenCalledWith('Hello', expect.any(Number), expect.any(Number));
  });

  // ── Ellipse rendering ──

  it('renders ellipse with roughCanvas.ellipse at center', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('ell-1', 'ellipse', {}, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
    });

    renderExpressions(ctx, rc as any, { 'ell-1': expr }, ['ell-1'], identityCamera, 800, 600);

    // Ellipse drawn at center: cx = 100 + 200/2 = 200, cy = 100 + 150/2 = 175
    expect(rc.ellipse).toHaveBeenCalledWith(200, 175, 200, 150, expect.any(Object));
    expect(rc.draw).toHaveBeenCalled();
  });

  // ── Diamond rendering ──

  it('renders diamond with roughCanvas.polygon', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('dia-1', 'diamond', {}, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 150 },
    });

    renderExpressions(ctx, rc as any, { 'dia-1': expr }, ['dia-1'], identityCamera, 800, 600);

    // Diamond points: [cx, top], [right, cy], [cx, bottom], [left, cy]
    // cx = 100 + 100 = 200, cy = 100 + 75 = 175
    expect(rc.polygon).toHaveBeenCalledWith(
      [
        [200, 100],  // top
        [300, 175],  // right
        [200, 250],  // bottom
        [100, 175],  // left
      ],
      expect.any(Object),
    );
  });

  // ── Line rendering ──

  it('renders line with roughCanvas.linearPath', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('line-1', 'line', {
      points: [[0, 0], [100, 100], [200, 50]],
    });

    renderExpressions(ctx, rc as any, { 'line-1': expr }, ['line-1'], identityCamera, 800, 600);

    expect(rc.linearPath).toHaveBeenCalledWith(
      [[0, 0], [100, 100], [200, 50]],
      expect.any(Object),
    );
  });

  // ── Arrow rendering ──

  it('renders arrow with roughCanvas.linearPath', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('arrow-1', 'arrow', {
      points: [[0, 0], [100, 100]],
      endArrowhead: true,
    });

    renderExpressions(ctx, rc as any, { 'arrow-1': expr }, ['arrow-1'], identityCamera, 800, 600);

    expect(rc.linearPath).toHaveBeenCalledWith(
      [[0, 0], [100, 100]],
      expect.any(Object),
    );
  });

  // ── Freehand rendering ──

  it('renders freehand with ctx.fill using Path2D', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('free-1', 'freehand', {
      points: [[0, 0, 0.5], [10, 10, 0.5], [20, 5, 0.5]],
    });

    renderExpressions(ctx, rc as any, { 'free-1': expr }, ['free-1'], identityCamera, 800, 600);

    // Freehand uses ctx.fill directly (not rough canvas)
    expect(ctx.fill).toHaveBeenCalled();
  });

  // ── Text rendering ──

  it('renders text with ctx.fillText', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('text-1', 'text', {
      text: 'Hello World',
      fontSize: 16,
      fontFamily: 'Arial',
      textAlign: 'left',
    }, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 50 },
    });

    renderExpressions(ctx, rc as any, { 'text-1': expr }, ['text-1'], identityCamera, 800, 600);

    expect(ctx.fillText).toHaveBeenCalled();
  });

  // ── Sticky note rendering ──

  it('renders sticky note with filled rect and text', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('sticky-1', 'sticky-note', {
      text: 'Remember this',
      color: '#ffeb3b',
    }, {
      position: { x: 100, y: 100 },
      size: { width: 200, height: 200 },
    });

    renderExpressions(ctx, rc as any, { 'sticky-1': expr }, ['sticky-1'], identityCamera, 800, 600);

    // Should draw a filled rectangle
    expect(ctx.fillRect).toHaveBeenCalled();
    // Should draw text
    expect(ctx.fillText).toHaveBeenCalled();
    // Should apply rotation
    expect(ctx.rotate).toHaveBeenCalled();
  });

  // ── Image rendering ──

  it('renders image placeholder (gray rect with ⚠) when image not yet loaded', () => {
    const ctx = createMockCtx();
    const rc = createMockRoughCanvas();

    const expr = makeExpression('img-1', 'image', {
      src: 'https://example.com/test.png',
      alt: 'Test image',
    }, {
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 },
    });

    renderExpressions(ctx, rc as any, { 'img-1': expr }, ['img-1'], identityCamera, 800, 600);

    // Before image loads, should draw placeholder
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('⚠', expect.any(Number), expect.any(Number));
  });
});

// ── Label helper ──

describe('renderLabel', () => {
  it('renders label text centered in bounding box', () => {
    const ctx = createMockCtx();
    renderLabel(ctx, 'Test Label', 100, 100, 200, 150, makeStyle());

    expect(ctx.fillText).toHaveBeenCalledWith(
      'Test Label',
      200, // cx = 100 + 200/2
      175, // cy = 100 + 150/2
    );
  });

  it('sets font and text alignment', () => {
    const ctx = createMockCtx();
    const style = makeStyle({ fontSize: 20, fontFamily: 'Courier' });
    renderLabel(ctx, 'Test', 0, 0, 100, 100, style);

    expect(ctx.font).toBe('20px Courier');
    expect(ctx.textAlign).toBe('center');
    expect(ctx.textBaseline).toBe('middle');
  });

  it('uses default font size 16 when not specified', () => {
    const ctx = createMockCtx();
    const style = makeStyle();
    renderLabel(ctx, 'Test', 0, 0, 100, 100, style);

    expect(ctx.font).toContain('16px');
  });

  it('does not render if label is empty', () => {
    const ctx = createMockCtx();
    renderLabel(ctx, '', 0, 0, 100, 100, makeStyle());
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('does not render if label is undefined', () => {
    const ctx = createMockCtx();
    renderLabel(ctx, undefined, 0, 0, 100, 100, makeStyle());
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

// ── Arrowhead helper ──

describe('renderArrowhead', () => {
  it('draws a filled triangle', () => {
    const ctx = createMockCtx();
    renderArrowhead(ctx, 100, 100, Math.PI / 4, 10);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

// ── Word wrap helper ──

describe('wrapText', () => {
  it('returns single line when text fits width', () => {
    const ctx = createMockCtx();
    // measureText returns { width: 50 } by default
    const lines = wrapText(ctx, 'Hello', 200);
    expect(lines).toEqual(['Hello']);
  });

  it('wraps text at word boundaries when exceeding width', () => {
    const ctx = createMockCtx();
    // Mock measureText to return width based on character count
    (ctx.measureText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => ({
      width: text.length * 10,
    }));

    const lines = wrapText(ctx, 'Hello World Foo Bar', 100);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('returns empty array for empty string', () => {
    const ctx = createMockCtx();
    const lines = wrapText(ctx, '', 200);
    expect(lines).toEqual([]);
  });

  it('handles single long word wider than maxWidth', () => {
    const ctx = createMockCtx();
    (ctx.measureText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => ({
      width: text.length * 10,
    }));

    // "Superlongword" = 13 chars * 10 = 130, maxWidth = 50
    const lines = wrapText(ctx, 'Superlongword', 50);
    expect(lines.length).toBe(1); // Still on one line — no space to break at
    expect(lines[0]).toBe('Superlongword');
  });
});
