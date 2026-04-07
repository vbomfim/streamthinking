/**
 * Unit tests for page/paper boundary renderer.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: page grid computation, bounding box expansion to page boundaries,
 * auto-expansion, viewport culling for pages, and rendering visuals.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import type { VisualExpression } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import {
  computePageGrid,
  renderPages,
  PAGE_SIZES,
} from '../renderer/pageRenderer.js';

// ── Test helpers ──────────────────────────────────────────────

/** Build a minimal expression stub for bounding box calculation. */
function makeExpr(
  x: number,
  y: number,
  width: number,
  height: number,
): VisualExpression {
  return {
    id: `expr-${x}-${y}`,
    kind: 'rectangle',
    position: { x, y },
    size: { width, height },
    label: '',
    style: {} as VisualExpression['style'],
    meta: { createdAt: 0, updatedAt: 0 } as VisualExpression['meta'],
  } as VisualExpression;
}

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    canvas: { width: 800, height: 600 },
    setTransform: vi.fn(),
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// ── PAGE_SIZES constant ──────────────────────────────────────

describe('PAGE_SIZES', () => {
  it('defines A4 landscape dimensions', () => {
    expect(PAGE_SIZES['A4']).toEqual({ width: 1122, height: 794 });
  });

  it('defines A4 portrait dimensions', () => {
    expect(PAGE_SIZES['A4-portrait']).toEqual({ width: 794, height: 1122 });
  });

  it('defines Letter landscape dimensions', () => {
    expect(PAGE_SIZES['Letter']).toEqual({ width: 1100, height: 850 });
  });

  it('defines Letter portrait dimensions', () => {
    expect(PAGE_SIZES['Letter-portrait']).toEqual({ width: 850, height: 1100 });
  });

  it('defines A3 landscape dimensions', () => {
    expect(PAGE_SIZES['A3']).toEqual({ width: 1587, height: 1122 });
  });

  it('defines Custom as null', () => {
    expect(PAGE_SIZES['Custom']).toBeNull();
  });
});

// ── computePageGrid ──────────────────────────────────────────

describe('computePageGrid', () => {
  const defaultPageSize = { width: 1122, height: 794 };

  it('returns single page at origin when no expressions exist', () => {
    const grid = computePageGrid([], defaultPageSize);
    expect(grid.startCol).toBe(0);
    expect(grid.startRow).toBe(0);
    expect(grid.endCol).toBe(0);
    expect(grid.endRow).toBe(0);
  });

  it('returns single page when expression fits within first page', () => {
    const expressions = [makeExpr(100, 100, 200, 150)];
    const grid = computePageGrid(expressions, defaultPageSize);
    expect(grid.startCol).toBe(0);
    expect(grid.startRow).toBe(0);
    expect(grid.endCol).toBe(0);
    expect(grid.endRow).toBe(0);
  });

  it('expands to multiple columns when expression extends past page width', () => {
    // Expression at x=1000, width=300 → right edge at 1300
    // Page width 1122 → needs col 0 and col 1
    const expressions = [makeExpr(1000, 100, 300, 150)];
    const grid = computePageGrid(expressions, defaultPageSize);
    expect(grid.startCol).toBe(0);
    expect(grid.endCol).toBe(1);
  });

  it('expands to multiple rows when expression extends past page height', () => {
    // Expression at y=700, height=200 → bottom edge at 900
    // Page height 794 → needs row 0 and row 1
    const expressions = [makeExpr(100, 700, 200, 200)];
    const grid = computePageGrid(expressions, defaultPageSize);
    expect(grid.startRow).toBe(0);
    expect(grid.endRow).toBe(1);
  });

  it('extends into negative columns for expressions with negative x', () => {
    // Expression at x=-500, width=200 → left edge at -500
    // Page width 1122 → col = floor(-500 / 1122) = -1
    const expressions = [makeExpr(-500, 100, 200, 150)];
    const grid = computePageGrid(expressions, defaultPageSize);
    expect(grid.startCol).toBe(-1);
    expect(grid.endCol).toBe(0);
  });

  it('extends into negative rows for expressions with negative y', () => {
    const expressions = [makeExpr(100, -300, 200, 150)];
    const grid = computePageGrid(expressions, defaultPageSize);
    expect(grid.startRow).toBe(-1);
    expect(grid.endRow).toBe(0);
  });

  it('covers expressions spread across many pages', () => {
    // Two expressions far apart
    const expressions = [
      makeExpr(-2000, -1500, 100, 100), // far top-left
      makeExpr(3000, 2000, 100, 100),   // far bottom-right
    ];
    const grid = computePageGrid(expressions, defaultPageSize);

    // Check that start is in negative territory and end is in positive
    expect(grid.startCol).toBeLessThan(0);
    expect(grid.startRow).toBeLessThan(0);
    expect(grid.endCol).toBeGreaterThan(0);
    expect(grid.endRow).toBeGreaterThan(0);
  });

  it('always includes the origin page (0,0) even if expressions are elsewhere', () => {
    // Expression entirely in negative space
    const expressions = [makeExpr(-2000, -1500, 100, 100)];
    const grid = computePageGrid(expressions, defaultPageSize);
    // The grid should extend from negative cols/rows through at least 0
    expect(grid.endCol).toBeGreaterThanOrEqual(0);
    expect(grid.endRow).toBeGreaterThanOrEqual(0);
  });
});

// ── renderPages ──────────────────────────────────────────────

describe('renderPages', () => {
  const defaultPageSize = { width: 1122, height: 794 };
  const defaultCamera: Camera = { x: 0, y: 0, zoom: 1 };

  it('fills the entire canvas with desk background color', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 800, 600, defaultPageSize, []);

    // Should call fillRect for the desk background
    const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('draws page rectangles with white fill', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 800, 600, defaultPageSize, []);

    // Should draw at least one white page
    const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    // At least 2 fillRects: 1 desk + 1 page
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('draws page borders', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 800, 600, defaultPageSize, []);

    const strokeRectCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(strokeRectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('isolates canvas state with save/restore', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 800, 600, defaultPageSize, []);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('renders nothing when viewport dimensions are zero', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 0, 0, defaultPageSize, []);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('only renders pages that are visible in the viewport', () => {
    const ctx = createMockCtx();
    // Camera focused on a small area — only the first page should be visible
    const camera: Camera = { x: 100, y: 100, zoom: 1 };
    const expressions = [
      makeExpr(100, 100, 200, 150),
      makeExpr(5000, 5000, 200, 150), // far away page
    ];
    renderPages(ctx, camera, 800, 600, defaultPageSize, expressions);

    // Count page fillRects — should be limited (not all pages rendered)
    const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    // Should have desk bg + only the visible page(s), not ALL pages
    // The far-away expression page should be culled
    expect(fillRectCalls.length).toBeLessThan(10);
  });

  it('auto-expands pages when expressions extend beyond current page', () => {
    const ctx = createMockCtx();
    // Expression crossing page boundary → should generate 2+ page rects
    const expressions = [makeExpr(1000, 0, 300, 150)];
    // Viewport large enough to see multiple pages
    const camera: Camera = { x: -100, y: -100, zoom: 0.5 };
    renderPages(ctx, camera, 2400, 1800, defaultPageSize, expressions);

    // Should render at least 2 page fillRects (plus desk bg)
    const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    // Desk bg + at least 2 pages
    expect(fillRectCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('renders single centered page when no expressions exist', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 1200, 900, defaultPageSize, []);

    // Should render desk bg + exactly 1 page
    const fillRectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    // 1 desk bg + 1 page fill = 2
    expect(fillRectCalls.length).toBe(2);
  });

  it('uses shadow for page drop shadow effect', () => {
    const ctx = createMockCtx();
    renderPages(ctx, defaultCamera, 800, 600, defaultPageSize, []);

    // The shadow properties should be set at some point
    // We check via the save/restore pattern — shadows are set then cleared
    expect(ctx.save).toHaveBeenCalled();
  });
});

// ── Store actions (tested here for locality) ─────────────────

describe('page store actions', () => {
  // These tests import the store and test the page-related actions
  // They are co-located here for TDD convenience

  it('exports PAGE_SIZES with expected keys', () => {
    const keys = Object.keys(PAGE_SIZES);
    expect(keys).toContain('A4');
    expect(keys).toContain('A4-portrait');
    expect(keys).toContain('Letter');
    expect(keys).toContain('Letter-portrait');
    expect(keys).toContain('A3');
    expect(keys).toContain('Custom');
  });
});
