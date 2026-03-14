/**
 * Unit tests for camera math functions.
 *
 * Covers: screenToWorld, worldToScreen, applyTransform, zoomAtPoint.
 * Acceptance criteria: [AC4] inverse functions, [AC5] correct setTransform,
 * [AC3] world point stays fixed during zoom.
 *
 * @module
 */

import {
  screenToWorld,
  worldToScreen,
  applyTransform,
  zoomAtPoint,
} from '../camera.js';
import type { Camera } from '../types/index.js';

// ── screenToWorld ────────────────────────────────────────────

describe('screenToWorld', () => {
  it('converts at identity camera (no pan, no zoom)', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    expect(screenToWorld(100, 200, camera)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for camera pan offset', () => {
    const camera: Camera = { x: 50, y: 100, zoom: 1 };
    expect(screenToWorld(100, 200, camera)).toEqual({ x: 150, y: 300 });
  });

  it('accounts for camera zoom', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 2 };
    expect(screenToWorld(100, 200, camera)).toEqual({ x: 50, y: 100 });
  });

  it('accounts for both pan and zoom', () => {
    const camera: Camera = { x: 50, y: 100, zoom: 2 };
    expect(screenToWorld(100, 200, camera)).toEqual({ x: 100, y: 200 });
  });

  it('handles fractional zoom levels', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 0.5 };
    expect(screenToWorld(100, 200, camera)).toEqual({ x: 200, y: 400 });
  });

  it('handles negative camera positions', () => {
    const camera: Camera = { x: -100, y: -200, zoom: 1 };
    expect(screenToWorld(50, 50, camera)).toEqual({ x: -50, y: -150 });
  });

  it('handles screen origin (0, 0)', () => {
    const camera: Camera = { x: 50, y: 100, zoom: 2 };
    expect(screenToWorld(0, 0, camera)).toEqual({ x: 50, y: 100 });
  });
});

// ── worldToScreen ────────────────────────────────────────────

describe('worldToScreen', () => {
  it('converts at identity camera (no pan, no zoom)', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    expect(worldToScreen(100, 200, camera)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for camera pan offset', () => {
    const camera: Camera = { x: 50, y: 100, zoom: 1 };
    expect(worldToScreen(150, 300, camera)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for camera zoom', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 2 };
    expect(worldToScreen(50, 100, camera)).toEqual({ x: 100, y: 200 });
  });

  it('accounts for both pan and zoom', () => {
    const camera: Camera = { x: 50, y: 100, zoom: 2 };
    expect(worldToScreen(100, 200, camera)).toEqual({ x: 100, y: 200 });
  });

  it('handles negative world coordinates', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    expect(worldToScreen(-100, -200, camera)).toEqual({ x: -100, y: -200 });
  });
});

// ── Roundtrip identity [AC4] ─────────────────────────────────

describe('screenToWorld ↔ worldToScreen roundtrip [AC4]', () => {
  const cameras: Camera[] = [
    { x: 0, y: 0, zoom: 1 },
    { x: 100, y: 200, zoom: 2 },
    { x: -500, y: 300, zoom: 0.5 },
    { x: 0, y: 0, zoom: 0.1 },
    { x: 1000, y: -1000, zoom: 5 },
  ];

  for (const camera of cameras) {
    it(`screen→world→screen for camera {x:${camera.x}, y:${camera.y}, zoom:${camera.zoom}}`, () => {
      const sx = 300;
      const sy = 400;
      const world = screenToWorld(sx, sy, camera);
      const screen = worldToScreen(world.x, world.y, camera);
      expect(screen.x).toBeCloseTo(sx, 10);
      expect(screen.y).toBeCloseTo(sy, 10);
    });
  }

  for (const camera of cameras) {
    it(`world→screen→world for camera {x:${camera.x}, y:${camera.y}, zoom:${camera.zoom}}`, () => {
      const wx = 500;
      const wy = 600;
      const screen = worldToScreen(wx, wy, camera);
      const world = screenToWorld(screen.x, screen.y, camera);
      expect(world.x).toBeCloseTo(wx, 10);
      expect(world.y).toBeCloseTo(wy, 10);
    });
  }
});

// ── applyTransform [AC5] ─────────────────────────────────────

describe('applyTransform [AC5]', () => {
  function mockCtx() {
    return { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
  }

  it('sets identity matrix for default camera', () => {
    const ctx = mockCtx();
    applyTransform(ctx, { x: 0, y: 0, zoom: 1 });
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
  });

  it('sets correct translation for panned camera', () => {
    const ctx = mockCtx();
    applyTransform(ctx, { x: 100, y: 200, zoom: 1 });
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, -100, -200);
  });

  it('sets correct scale for zoomed camera', () => {
    const ctx = mockCtx();
    applyTransform(ctx, { x: 0, y: 0, zoom: 2 });
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('sets correct combined matrix for panned + zoomed camera', () => {
    const ctx = mockCtx();
    applyTransform(ctx, { x: 100, y: 200, zoom: 2 });
    // tx = -camera.x * zoom = -100 * 2 = -200
    // ty = -camera.y * zoom = -200 * 2 = -400
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, -200, -400);
  });

  it('handles fractional zoom', () => {
    const ctx = mockCtx();
    applyTransform(ctx, { x: 50, y: 100, zoom: 0.5 });
    expect(ctx.setTransform).toHaveBeenCalledWith(0.5, 0, 0, 0.5, -25, -50);
  });
});

// ── zoomAtPoint [AC3] ────────────────────────────────────────

describe('zoomAtPoint [AC3]', () => {
  it('preserves world point under cursor after zoom in', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const sx = 400;
    const sy = 300;

    const worldBefore = screenToWorld(sx, sy, camera);
    const newCamera = zoomAtPoint(camera, sx, sy, 2);
    const worldAfter = screenToWorld(sx, sy, newCamera);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('preserves world point under cursor after zoom out', () => {
    const camera: Camera = { x: 100, y: 200, zoom: 2 };
    const sx = 300;
    const sy = 250;

    const worldBefore = screenToWorld(sx, sy, camera);
    const newCamera = zoomAtPoint(camera, sx, sy, 0.5);
    const worldAfter = screenToWorld(sx, sy, newCamera);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('preserves world point at screen origin', () => {
    const camera: Camera = { x: 50, y: 100, zoom: 1 };
    const sx = 0;
    const sy = 0;

    const worldBefore = screenToWorld(sx, sy, camera);
    const newCamera = zoomAtPoint(camera, sx, sy, 3);
    const worldAfter = screenToWorld(sx, sy, newCamera);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('returns new camera with the specified zoom', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const result = zoomAtPoint(camera, 400, 300, 2);
    expect(result.zoom).toBe(2);
  });

  it('does not mutate the input camera', () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const result = zoomAtPoint(camera, 400, 300, 2);
    expect(result).not.toBe(camera);
    expect(camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('works with fractional zoom levels', () => {
    const camera: Camera = { x: 200, y: 300, zoom: 1.5 };
    const sx = 500;
    const sy = 400;

    const worldBefore = screenToWorld(sx, sy, camera);
    const newCamera = zoomAtPoint(camera, sx, sy, 0.75);
    const worldAfter = screenToWorld(sx, sy, newCamera);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('preserves cursor point across multiple successive zooms', () => {
    let camera: Camera = { x: 0, y: 0, zoom: 1 };
    const sx = 400;
    const sy = 300;

    const worldOriginal = screenToWorld(sx, sy, camera);

    camera = zoomAtPoint(camera, sx, sy, 1.5);
    camera = zoomAtPoint(camera, sx, sy, 2.0);
    camera = zoomAtPoint(camera, sx, sy, 3.0);

    const worldFinal = screenToWorld(sx, sy, camera);
    expect(worldFinal.x).toBeCloseTo(worldOriginal.x, 10);
    expect(worldFinal.y).toBeCloseTo(worldOriginal.y, 10);
  });
});
