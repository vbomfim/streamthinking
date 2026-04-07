/**
 * Unit tests for the render loop.
 *
 * Covers: frame lifecycle (clear → transform → grid), start/stop,
 * dirty-flag optimization, and cleanup.
 *
 * @module
 */

import { createRenderLoop } from '../renderer/renderLoop.js';
import type { Camera } from '../types/index.js';

// ── Mocks ────────────────────────────────────────────────────

/** Capture requestAnimationFrame callbacks for manual stepping. */
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

  /** Advance one frame by calling the latest scheduled callback. */
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

function createMockCtx() {
  return {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

// ── Tests ────────────────────────────────────────────────────

describe('createRenderLoop', () => {
  let raf: ReturnType<typeof createRafMock>;

  beforeEach(() => {
    raf = createRafMock();
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame);
    // Stub window for global screenshot request handling in renderFrame
    if (typeof window === 'undefined') {
      vi.stubGlobal('window', {});
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules a frame via requestAnimationFrame on start', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    expect(raf.requestAnimationFrame).toHaveBeenCalledOnce();
    loop.stop();
  });

  it('clears the canvas on each frame', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    raf.tick();
    expect(ctx.clearRect).toHaveBeenCalled();
    loop.stop();
  });

  it('applies camera transform on each frame', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 100, y: 200, zoom: 2 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    raf.tick();
    // applyTransform: setTransform(zoom, 0, 0, zoom, -x*zoom, -y*zoom)
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, -200, -400);
    loop.stop();
  });

  it('renders grid dots on each frame', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    raf.tick();
    // Grid rendering should have drawn dots (arcs)
    expect(ctx.arc).toHaveBeenCalled();
    loop.stop();
  });

  it('cancels animation frame on stop', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    loop.stop();
    expect(raf.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('schedules the next frame after rendering', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    expect(raf.requestAnimationFrame).toHaveBeenCalledTimes(1);

    raf.tick();
    // After the frame renders, it should schedule the next one
    expect(raf.requestAnimationFrame).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it('uses latest camera state each frame', () => {
    const ctx = createMockCtx();
    let camera: Camera = { x: 0, y: 0, zoom: 1 };
    const getCamera = (): Camera => camera;
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    raf.tick();
    expect(ctx.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);

    camera = { x: 50, y: 100, zoom: 2 };
    raf.tick();
    expect(ctx.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, -100, -200);
    loop.stop();
  });

  it('does not render after stop', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    loop.stop();

    const callCountBeforeTick = (ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls.length;
    // Manually tick — callback should be cancelled so nothing happens
    raf.tick();
    expect((ctx.clearRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountBeforeTick);
  });

  it('allows updateSize to change viewport dimensions', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.updateSize(1920, 1080);
    loop.start();
    raf.tick();
    // Canvas should be cleared with new dimensions
    expect(ctx.clearRect).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    loop.stop();
  });
});

// ── #68: Marquee rendering in render loop ────────────────────

describe('createRenderLoop — marquee rendering (#68)', () => {
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

  it('calls marqueeProvider.getMarquee() each frame', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const marqueeProvider = { getMarquee: vi.fn().mockReturnValue(null) };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, marqueeProvider,
    );

    loop.start();
    raf.tick();
    expect(marqueeProvider.getMarquee).toHaveBeenCalledOnce();

    raf.tick();
    expect(marqueeProvider.getMarquee).toHaveBeenCalledTimes(2);
    loop.stop();
  });

  it('renders marquee fill and stroke when marquee is non-null', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const marqueeProvider = {
      getMarquee: vi.fn().mockReturnValue({ x: 10, y: 20, width: 100, height: 50 }),
    };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, marqueeProvider,
    );

    loop.start();
    raf.tick();

    // Should have drawn filled rect
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 50);
    // Should have drawn stroked rect
    expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 100, 50);
    // Should have set dashed line
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
    // Should have cleared dash pattern after
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    loop.stop();
  });

  it('does not render marquee when getMarquee returns null', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const marqueeProvider = {
      getMarquee: vi.fn().mockReturnValue(null),
    };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, marqueeProvider,
    );

    loop.start();
    raf.tick();

    // fillRect is called once for clearRect; marquee should NOT add another fillRect
    // strokeRect should NOT be called at all (no grid/expressions = no world-space strokes)
    expect(ctx.strokeRect).not.toHaveBeenCalled();
    expect(ctx.setLineDash).not.toHaveBeenCalled();
    loop.stop();
  });

  it('renders marquee in DPR-scaled screen coordinates', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const dpr = 2;
    const marqueeProvider = {
      getMarquee: vi.fn().mockReturnValue({ x: 5, y: 10, width: 200, height: 100 }),
    };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      dpr, marqueeProvider,
    );

    loop.start();
    raf.tick();

    // The setTransform call before marquee should use DPR-scaled identity
    const setTransformCalls = (ctx.setTransform as ReturnType<typeof vi.fn>).mock.calls;
    // Last setTransform before marquee drawing should be DPR identity: (2, 0, 0, 2, 0, 0)
    // Find the call that sets DPR identity for marquee (should be after camera transform)
    const dprIdentityCalls = setTransformCalls.filter(
      (args: number[]) => args[0] === dpr && args[1] === 0 && args[2] === 0
        && args[3] === dpr && args[4] === 0 && args[5] === 0,
    );
    // At least 2: one for clear, one for marquee
    expect(dprIdentityCalls.length).toBeGreaterThanOrEqual(2);
    loop.stop();
  });
});

// ── Grid provider rendering ──────────────────────────────────

describe('createRenderLoop — grid provider', () => {
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

  it('renders grid when gridProvider.getGridVisible() returns true', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const gridProvider = {
      getGridVisible: vi.fn().mockReturnValue(true),
      getGridType: vi.fn().mockReturnValue('dot' as const),
      getGridSize: vi.fn().mockReturnValue(20),
    };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, undefined, undefined, gridProvider,
    );

    loop.start();
    raf.tick();
    // Dot grid should draw arcs
    expect(ctx.arc).toHaveBeenCalled();
    loop.stop();
  });

  it('does NOT render grid when gridProvider.getGridVisible() returns false', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const gridProvider = {
      getGridVisible: vi.fn().mockReturnValue(false),
      getGridType: vi.fn().mockReturnValue('dot' as const),
      getGridSize: vi.fn().mockReturnValue(20),
    };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, undefined, undefined, gridProvider,
    );

    loop.start();
    raf.tick();
    // No arcs or lines should be drawn
    expect(ctx.arc).not.toHaveBeenCalled();
    loop.stop();
  });

  it('renders line grid when gridType is line', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const gridProvider = {
      getGridVisible: vi.fn().mockReturnValue(true),
      getGridType: vi.fn().mockReturnValue('line' as const),
      getGridSize: vi.fn().mockReturnValue(20),
    };

    const loop = createRenderLoop(
      ctx, getCamera, 800, 600,
      undefined, undefined, undefined, undefined,
      1, undefined, undefined, gridProvider,
    );

    loop.start();
    raf.tick();
    // Line grid should use moveTo/lineTo, not arcs
    expect((ctx as unknown as Record<string, { mock: { calls: unknown[] } }>).moveTo.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.arc).not.toHaveBeenCalled();
    loop.stop();
  });

  it('renders grid by default when no gridProvider is given', () => {
    const ctx = createMockCtx();
    const getCamera = (): Camera => ({ x: 0, y: 0, zoom: 1 });
    const loop = createRenderLoop(ctx, getCamera, 800, 600);

    loop.start();
    raf.tick();
    // Default behavior: grid is visible with dot type
    expect(ctx.arc).toHaveBeenCalled();
    loop.stop();
  });
});
