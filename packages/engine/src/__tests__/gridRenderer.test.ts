/**
 * Unit tests for grid renderer.
 *
 * Covers: adaptive dot spacing [AC6], viewport-bounded rendering,
 * dot styling, save/restore isolation, line grid rendering,
 * gridType/gridSize parameter support, max-element guard,
 * batched rendering, and spacing validation edge cases.
 *
 * @module
 */

import { renderGrid, getGridSpacing } from '../renderer/gridRenderer.js';
import type { Camera } from '../types/index.js';

// ── getGridSpacing [AC6] ─────────────────────────────────────

describe('getGridSpacing [AC6]', () => {
  it('returns 20px at zoom >= 0.5', () => {
    expect(getGridSpacing(1)).toBe(20);
    expect(getGridSpacing(0.5)).toBe(20);
    expect(getGridSpacing(2)).toBe(20);
    expect(getGridSpacing(5)).toBe(20);
  });

  it('returns 40px at zoom < 0.5 and >= 0.25', () => {
    expect(getGridSpacing(0.49)).toBe(40);
    expect(getGridSpacing(0.3)).toBe(40);
    expect(getGridSpacing(0.25)).toBe(40);
  });

  it('returns 80px at zoom < 0.25', () => {
    expect(getGridSpacing(0.24)).toBe(80);
    expect(getGridSpacing(0.1)).toBe(80);
    expect(getGridSpacing(0.01)).toBe(80);
  });

  it('returns 20px at exactly zoom 1.0', () => {
    expect(getGridSpacing(1.0)).toBe(20);
  });

  it('uses custom gridSize for adaptive spacing', () => {
    // gridSize 40 → base 40, zoom ≥ 0.5 → 40
    expect(getGridSpacing(1, 40)).toBe(40);
    // zoom < 0.5 → 80
    expect(getGridSpacing(0.3, 40)).toBe(80);
    // zoom < 0.25 → 160
    expect(getGridSpacing(0.1, 40)).toBe(160);
  });

  it('clamps gridSize 0 to minimum of 1', () => {
    expect(getGridSpacing(1, 0)).toBe(1);
  });

  it('clamps negative gridSize to minimum of 1', () => {
    expect(getGridSpacing(1, -10)).toBe(1);
  });
});

// ── renderGrid (dot mode — default) ─────────────────────────

describe('renderGrid (dot mode)', () => {
  function createMockCtx() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
  }

  it('isolates canvas state with save/restore', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 800, 600);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it('sets fillStyle to #e0e0e0', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 800, 600);
    expect(ctx.fillStyle).toBe('#e0e0e0');
  });

  it('renders dots within the visible viewport', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThan(0);
  });

  it('renders dots with 1.5px radius', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of arcCalls) {
      expect(call[2]).toBe(1.5); // third arg = radius
    }
  });

  it('renders dots using full circle arc (0 to 2π)', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of arcCalls) {
      expect(call[3]).toBe(0);                    // startAngle
      expect(call[4]).toBeCloseTo(Math.PI * 2);   // endAngle
    }
  });

  it('only renders dots within visible world area', () => {
    const ctx = createMockCtx();
    // Camera panned to x:500, y:500 — viewport is 100×100 at zoom 1
    // Visible world: [500, 600] × [500, 600]
    const camera: Camera = { x: 500, y: 500, zoom: 1 };
    renderGrid(ctx, camera, 100, 100);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of arcCalls) {
      const wx = call[0] as number;
      const wy = call[1] as number;
      // Dots should be within or slightly outside the visible range
      // (snapped to grid spacing boundaries — 20px)
      expect(wx).toBeGreaterThanOrEqual(480);
      expect(wx).toBeLessThanOrEqual(620);
      expect(wy).toBeGreaterThanOrEqual(480);
      expect(wy).toBeLessThanOrEqual(620);
    }
  });

  it('uses 40px spacing when zoom < 0.5', () => {
    const ctx = createMockCtx();
    const camera: Camera = { x: 0, y: 0, zoom: 0.3 };
    renderGrid(ctx, camera, 120, 120);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    // At zoom 0.3, the visible world is 120/0.3 = 400px wide
    // With 40px spacing, we expect dots at 0, 40, 80, ... 400
    // All X coordinates should be multiples of 40
    for (const call of arcCalls) {
      const wx = call[0] as number;
      const wy = call[1] as number;
      expect(wx % 40).toBe(0);
      expect(wy % 40).toBe(0);
    }
  });

  it('uses 80px spacing when zoom < 0.25', () => {
    const ctx = createMockCtx();
    const camera: Camera = { x: 0, y: 0, zoom: 0.2 };
    renderGrid(ctx, camera, 160, 160);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of arcCalls) {
      const wx = call[0] as number;
      const wy = call[1] as number;
      expect(wx % 80).toBe(0);
      expect(wy % 80).toBe(0);
    }
  });

  it('batches all dots into a single beginPath/fill (not per-dot)', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100);

    const arcCount = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(arcCount).toBeGreaterThan(1);
    // Batched: exactly 1 beginPath and 1 fill for all dots
    expect((ctx.beginPath as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('renders zero dots when viewport dimensions are zero', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 0, 0);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBe(0);
  });

  it('does not call lineTo/stroke in dot mode', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'dot');

    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('bails out when grid element count exceeds MAX_GRID_ELEMENTS', () => {
    const ctx = createMockCtx();
    // Extreme zoom-out: zoom 0.001, viewport 4000×3000
    // World size = 4000/0.001 × 3000/0.001 = 4,000,000 × 3,000,000
    // Even with adaptive spacing (80px at zoom<0.25), that's enormous
    const camera: Camera = { x: 0, y: 0, zoom: 0.001 };
    renderGrid(ctx, camera, 4000, 3000, 'dot');

    // Should bail out — no arcs drawn
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

// ── renderGrid (line mode) ──────────────────────────────────

describe('renderGrid (line mode)', () => {
  function createMockCtx() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
  }

  it('draws lines (moveTo/lineTo/stroke) instead of dots', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'line');

    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does not draw dots (arc) in line mode', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'line');

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('isolates canvas state with save/restore', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 800, 600, 'line');
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it('sets a thin line width', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'line');

    // lineWidth should be set to a thin value (0.5 or 1)
    expect(ctx.lineWidth).toBeLessThanOrEqual(1);
    expect(ctx.lineWidth).toBeGreaterThan(0);
  });

  it('renders zero lines when viewport dimensions are zero', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 0, 0, 'line');

    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it('draws lines at multiples of custom gridSize', () => {
    const ctx = createMockCtx();
    // gridSize 50 at zoom 1 → spacing 50
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'line', 50);

    const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;

    expect(moveToCalls.length).toBeGreaterThan(0);
    expect(lineToCalls.length).toBe(moveToCalls.length);

    // Vertical lines: moveTo(x, startY) where x is multiple of 50
    // Horizontal lines: moveTo(startX, y) where y is multiple of 50
    // All moveTo x-coords and y-coords should be multiples of 50
    for (const call of moveToCalls) {
      const x = call[0] as number;
      const y = call[1] as number;
      // One of x or y must be the grid-aligned coordinate (multiple of 50)
      const xAligned = x % 50 === 0;
      const yAligned = y % 50 === 0;
      expect(xAligned || yAligned).toBe(true);
    }
  });

  it('bails out when line count exceeds MAX_GRID_ELEMENTS', () => {
    const ctx = createMockCtx();
    // Extreme zoom-out
    const camera: Camera = { x: 0, y: 0, zoom: 0.001 };
    renderGrid(ctx, camera, 4000, 3000, 'line');

    // Should bail out — no lines drawn
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });
});
