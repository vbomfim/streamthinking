/**
 * Integration & edge-case tests for grid rendering.
 *
 * QA Guardian — tests the grid feature across component boundaries
 * and at extreme/boundary input values. These complement the
 * Developer's unit tests by testing behaviors the unit tests miss.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderGrid, getGridSpacing } from '../renderer/gridRenderer.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { createRenderLoop } from '../renderer/renderLoop.js';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { Camera, GridType } from '../types/index.js';
import type { GridProvider } from '../renderer/renderLoop.js';

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

// ── Helpers ────────────────────────────────────────────────────

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
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

function createRafMock() {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();

  const requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  });

  const cancelAnimationFrame = vi.fn((id: number): void => {
    callbacks.delete(id);
  });

  function tick(timestamp = performance.now()) {
    const entries = [...callbacks.entries()];
    const last = entries[entries.length - 1];
    if (last) {
      callbacks.delete(last[0]);
      last[1](timestamp);
    }
  }

  return { requestAnimationFrame, cancelAnimationFrame, tick, callbacks };
}

// ── Store reset ────────────────────────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    gridVisible: true,
    gridType: 'dot',
    gridSize: 20,
    operationLog: [],
    canUndo: false,
    canRedo: false,
  });
  useCanvasStore.getState().clearHistory();
});

// ══════════════════════════════════════════════════════════════
// INTEGRATION: Store → GridProvider → RenderLoop → GridRenderer
// ══════════════════════════════════════════════════════════════

describe('Grid integration: store → renderLoop → gridRenderer [BOUNDARY]', () => {
  let raf: ReturnType<typeof createRafMock>;

  beforeEach(() => {
    raf = createRafMock();
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame);
    if (typeof window === 'undefined') {
      vi.stubGlobal('window', {});
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function storeGridProvider(): GridProvider {
    return {
      getGridVisible: () => useCanvasStore.getState().gridVisible,
      getGridType: () => useCanvasStore.getState().gridType,
      getGridSize: () => useCanvasStore.getState().gridSize,
    };
  }

  it('toggleGrid in store stops grid rendering in renderLoop', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const gridProvider = storeGridProvider();

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, undefined, undefined, gridProvider,
    );

    loop.start();
    raf.tick();
    expect(ctx.arc).toHaveBeenCalled(); // grid renders (dot mode)

    // Toggle grid off through store
    (ctx.arc as ReturnType<typeof vi.fn>).mockClear();
    useCanvasStore.getState().toggleGrid();

    raf.tick();
    expect(ctx.arc).not.toHaveBeenCalled(); // grid hidden
    loop.stop();
  });

  it('setGridType in store switches render mode in renderLoop', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const gridProvider = storeGridProvider();

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, undefined, undefined, gridProvider,
    );

    loop.start();
    raf.tick();
    // Default: dot mode — arcs drawn, no lineTo
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();

    // Switch to line mode via store
    (ctx.arc as ReturnType<typeof vi.fn>).mockClear();
    (ctx.lineTo as ReturnType<typeof vi.fn>).mockClear();
    (ctx.moveTo as ReturnType<typeof vi.fn>).mockClear();
    useCanvasStore.getState().setGridType('line');

    raf.tick();
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    loop.stop();
  });

  it('setGridSize in store changes spacing used by renderer', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const gridProvider = storeGridProvider();

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, undefined, undefined, gridProvider,
    );

    // Render with default gridSize=20
    loop.start();
    raf.tick();
    const dotCountDefault = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length;

    // Change to gridSize=40 — should produce fewer dots
    (ctx.arc as ReturnType<typeof vi.fn>).mockClear();
    useCanvasStore.getState().setGridSize(40);

    raf.tick();
    const dotCountLarger = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length;

    // Larger spacing → fewer dots
    expect(dotCountLarger).toBeLessThan(dotCountDefault);
    loop.stop();
  });
});

// ══════════════════════════════════════════════════════════════
// EDGE CASES: getGridSpacing
// ══════════════════════════════════════════════════════════════

describe('getGridSpacing edge cases [EDGE]', () => {
  it('clamps gridSize 0 to minimum of 1 (guard prevents infinite loops)', () => {
    // getGridSpacing now clamps to Math.max(1, gridSize).
    const result = getGridSpacing(1, 0);
    expect(result).toBe(1);
  });

  it('clamps negative gridSize to minimum of 1', () => {
    const result = getGridSpacing(1, -10);
    expect(result).toBe(1);
  });

  it('handles zoom=0 without crashing', () => {
    // zoom=0 → zoom < 0.25 → base * 4
    expect(() => getGridSpacing(0)).not.toThrow();
    expect(getGridSpacing(0)).toBe(80); // 20 * 4
  });

  it('handles zoom=NaN', () => {
    // NaN < 0.25 is false, NaN < 0.5 is false, so falls through to base
    const result = getGridSpacing(NaN);
    expect(result).toBe(20); // Falls through to base
  });

  it('handles zoom=Infinity', () => {
    // Infinity >= 0.5 → base spacing
    const result = getGridSpacing(Infinity);
    expect(result).toBe(20);
  });

  it('handles zoom=-1 (negative zoom)', () => {
    // -1 < 0.25 → base * 4
    const result = getGridSpacing(-1);
    expect(result).toBe(80);
  });

  it('handles gridSize=Infinity', () => {
    const result = getGridSpacing(1, Infinity);
    expect(result).toBe(Infinity);
  });
});

// ══════════════════════════════════════════════════════════════
// EDGE CASES: renderGrid
// ══════════════════════════════════════════════════════════════

describe('renderGrid edge cases [EDGE]', () => {
  it('handles negative viewport width gracefully (no dots drawn)', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, -100, 600);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('handles negative viewport height gracefully (no dots drawn)', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 800, -100);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('bails out for very large viewport that exceeds MAX_GRID_ELEMENTS', () => {
    const ctx = createMockCtx();
    const startTime = Date.now();
    // 10000x10000 at zoom 1, spacing 20 → 501*501 = 251,001 dots — exceeds MAX_GRID_ELEMENTS
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 10000, 10000);
    const elapsed = Date.now() - startTime;

    // MAX_GRID_ELEMENTS guard bails out — no arcs drawn
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(arcCalls).toBe(0);
    // Should complete nearly instantly due to early bail-out
    expect(elapsed).toBeLessThan(100);
  });

  it('renders grid with camera at very large coordinates', () => {
    const ctx = createMockCtx();
    const camera: Camera = { x: 1_000_000, y: 1_000_000, zoom: 1 };
    renderGrid(ctx, camera, 100, 100);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThan(0);

    // All dots should be near the camera position
    for (const call of arcCalls) {
      const wx = call[0] as number;
      const wy = call[1] as number;
      expect(wx).toBeGreaterThanOrEqual(999_980);
      expect(wx).toBeLessThanOrEqual(1_000_120);
      expect(wy).toBeGreaterThanOrEqual(999_980);
      expect(wy).toBeLessThanOrEqual(1_000_120);
    }
  });

  it('renders grid with camera at negative coordinates', () => {
    const ctx = createMockCtx();
    const camera: Camera = { x: -500, y: -500, zoom: 1 };
    renderGrid(ctx, camera, 100, 100);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThan(0);

    for (const call of arcCalls) {
      const wx = call[0] as number;
      const wy = call[1] as number;
      expect(wx).toBeGreaterThanOrEqual(-520);
      expect(wx).toBeLessThanOrEqual(-380);
      expect(wy).toBeGreaterThanOrEqual(-520);
      expect(wy).toBeLessThanOrEqual(-380);
    }
  });

  it('defaults to dot grid when gridType is undefined', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, undefined);
    expect(ctx.arc).toHaveBeenCalled();
    // Dot mode does not use lineTo or stroke
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('handles viewport with width=1, height=1 (minimum visible area)', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 1, 1);
    // Should still render — at least one grid intersection is visible
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThan(0);
  });

  it('renders dot grid with gridSize=0 (degenerate — may loop or bail)', () => {
    const ctx = createMockCtx();
    // gridSize=0 → spacing=0 → infinite loop risk in for-loops
    // This tests whether the renderer handles it safely.
    // NOTE: We guard with a timeout to prevent test hangs.
    const timeout = setTimeout(() => {
      throw new Error('renderGrid with gridSize=0 caused an infinite loop');
    }, 1000);

    try {
      renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'dot', 0);
    } finally {
      clearTimeout(timeout);
    }
    // If we got here, it didn't hang — that's the key assertion
  });
});

// ══════════════════════════════════════════════════════════════
// EDGE CASES: canvasStore grid actions
// ══════════════════════════════════════════════════════════════

describe('canvasStore grid edge cases [EDGE]', () => {
  it('setGridSize(5) — exact minimum boundary is accepted', () => {
    useCanvasStore.getState().setGridSize(5);
    expect(useCanvasStore.getState().gridSize).toBe(5);
  });

  it('setGridSize(200) — exact maximum boundary is accepted', () => {
    useCanvasStore.getState().setGridSize(200);
    expect(useCanvasStore.getState().gridSize).toBe(200);
  });

  it('setGridSize(4) — just below minimum clamps to 5', () => {
    useCanvasStore.getState().setGridSize(4);
    expect(useCanvasStore.getState().gridSize).toBe(5);
  });

  it('setGridSize(201) — just above maximum clamps to 200', () => {
    useCanvasStore.getState().setGridSize(201);
    expect(useCanvasStore.getState().gridSize).toBe(200);
  });

  it('setGridSize(0) — zero clamps to minimum', () => {
    useCanvasStore.getState().setGridSize(0);
    expect(useCanvasStore.getState().gridSize).toBe(5);
  });

  it('setGridSize(-50) — negative clamps to minimum', () => {
    useCanvasStore.getState().setGridSize(-50);
    expect(useCanvasStore.getState().gridSize).toBe(5);
  });

  it('setGridSize(NaN) — rejected by guard, preserves previous value', () => {
    // setGridSize now guards against NaN with Number.isFinite check
    useCanvasStore.getState().setGridSize(NaN);
    const size = useCanvasStore.getState().gridSize;
    // NaN is rejected — default value (20) preserved
    expect(size).toBe(20);
  });

  it('rapid toggle maintains consistent state', () => {
    for (let i = 0; i < 100; i++) {
      useCanvasStore.getState().toggleGrid();
    }
    // 100 toggles from true → ends at true (even number of toggles)
    expect(useCanvasStore.getState().gridVisible).toBe(true);
  });

  it('rapid toggle with odd count ends at false', () => {
    for (let i = 0; i < 101; i++) {
      useCanvasStore.getState().toggleGrid();
    }
    expect(useCanvasStore.getState().gridVisible).toBe(false);
  });

  it('grid state is NOT affected by undo/redo (UI-only)', () => {
    // Add a proper expression to create an undoable action
    const expr = builder
      .rectangle(100, 200, 300, 150)
      .label('Test Rectangle')
      .build();
    useCanvasStore.getState().addExpression({ ...expr, id: 'test-rect-1' });

    // Change grid state
    useCanvasStore.getState().toggleGrid(); // false
    useCanvasStore.getState().setGridType('line');
    useCanvasStore.getState().setGridSize(50);

    // Undo the expression add
    useCanvasStore.getState().undo();

    // Grid state should be unchanged
    expect(useCanvasStore.getState().gridVisible).toBe(false);
    expect(useCanvasStore.getState().gridType).toBe('line');
    expect(useCanvasStore.getState().gridSize).toBe(50);

    // Expression should be removed (undo worked)
    expect(useCanvasStore.getState().expressions['test-rect-1']).toBeUndefined();
  });

  it('setGridType with same value is idempotent', () => {
    useCanvasStore.getState().setGridType('dot');
    useCanvasStore.getState().setGridType('dot');
    useCanvasStore.getState().setGridType('dot');
    expect(useCanvasStore.getState().gridType).toBe('dot');
  });

  it('setGridSize with same value is idempotent', () => {
    useCanvasStore.getState().setGridSize(20);
    useCanvasStore.getState().setGridSize(20);
    expect(useCanvasStore.getState().gridSize).toBe(20);
  });
});

// ══════════════════════════════════════════════════════════════
// CONTRACT: Line grid geometry verification
// ══════════════════════════════════════════════════════════════

describe('Line grid geometry verification [CONTRACT]', () => {
  it('renders correct number of vertical and horizontal lines for known viewport', () => {
    const ctx = createMockCtx();
    // viewport 100x100, zoom 1, gridSize 50 → spacing 50
    // world coords: [0, 100] x [0, 100]
    // vertical lines at x = 0, 50, 100 → 3 lines
    // horizontal lines at y = 0, 50, 100 → 3 lines
    // total moveTo calls = 3 + 3 = 6
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 100, 100, 'line', 50);

    const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;

    // Each line = 1 moveTo + 1 lineTo
    expect(moveToCalls.length).toBe(lineToCalls.length);
    // 3 vertical + 3 horizontal = 6 total lines
    expect(moveToCalls.length).toBe(6);
  });

  it('vertical line x-coords are all multiples of spacing', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 200, 200, 'line', 40);

    const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;

    // Vertical lines: moveTo(x, startY) → lineTo(x, endY) — same x
    // Horizontal lines: moveTo(startX, y) → lineTo(endX, y) — same y
    // We identify vertical lines as pairs where moveTo.x === lineTo.x
    for (let i = 0; i < moveToCalls.length; i++) {
      const mx = moveToCalls[i][0] as number;
      const my = moveToCalls[i][1] as number;
      const lx = lineToCalls[i][0] as number;
      const ly = lineToCalls[i][1] as number;

      if (mx === lx) {
        // Vertical line — x should be multiple of 40
        expect(mx % 40).toBe(0);
      }
      if (my === ly) {
        // Horizontal line — y should be multiple of 40
        expect(my % 40).toBe(0);
      }
    }
  });

  it('dot grid dot coordinates are all multiples of spacing', () => {
    const ctx = createMockCtx();
    renderGrid(ctx, { x: 0, y: 0, zoom: 1 }, 200, 200, 'dot', 25);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of arcCalls) {
      const x = call[0] as number;
      const y = call[1] as number;
      expect(x % 25).toBe(0);
      expect(y % 25).toBe(0);
    }
  });

  it('line grid with panned camera still produces aligned lines', () => {
    const ctx = createMockCtx();
    const camera: Camera = { x: 73, y: 137, zoom: 1 };
    renderGrid(ctx, camera, 200, 200, 'line', 30);

    const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;

    for (let i = 0; i < moveToCalls.length; i++) {
      const mx = moveToCalls[i][0] as number;
      const my = moveToCalls[i][1] as number;
      const lx = lineToCalls[i][0] as number;
      const ly = lineToCalls[i][1] as number;

      if (mx === lx) {
        // Vertical line — x should be multiple of spacing (30)
        expect(mx % 30).toBe(0);
      }
      if (my === ly) {
        // Horizontal line — y should be multiple of spacing (30)
        expect(my % 30).toBe(0);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════
// EDGE: zoom threshold boundaries
// ══════════════════════════════════════════════════════════════

describe('getGridSpacing zoom threshold boundaries [EDGE]', () => {
  it('zoom exactly at 0.25 returns 2× base (boundary is inclusive)', () => {
    expect(getGridSpacing(0.25)).toBe(40); // 20 * 2
  });

  it('zoom at 0.2499 returns 4× base', () => {
    expect(getGridSpacing(0.2499)).toBe(80); // 20 * 4
  });

  it('zoom at 0.2501 returns 2× base', () => {
    expect(getGridSpacing(0.2501)).toBe(40); // 20 * 2
  });

  it('zoom exactly at 0.5 returns 1× base (boundary is inclusive)', () => {
    expect(getGridSpacing(0.5)).toBe(20); // 20 * 1
  });

  it('zoom at 0.4999 returns 2× base', () => {
    expect(getGridSpacing(0.4999)).toBe(40); // 20 * 2
  });

  it('zoom at 0.5001 returns 1× base', () => {
    expect(getGridSpacing(0.5001)).toBe(20); // 20 * 1
  });
});
