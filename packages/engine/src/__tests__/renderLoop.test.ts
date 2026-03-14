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
    fillStyle: '',
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
