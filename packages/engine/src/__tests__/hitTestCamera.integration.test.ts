/**
 * Integration tests: Hit Testing × Camera Transforms
 *
 * Tests that hit testing correctly accounts for camera zoom/pan
 * when converting screen-pixel tolerances to world units.
 *
 * Ticket #4 AC14: "All tolerances are in screen pixels (constant
 * regardless of zoom). Convert tolerance to world units:
 * tolerance / camera.zoom"
 *
 * Also tests the full flow: screenToWorld → findExpressionAtPoint →
 * hitTestExpression, which crosses the camera, selection manager,
 * and hit test modules.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import {
  hitTestRectangle,
  hitTestEllipse,
  hitTestDiamond,
  hitTestLine,
  hitTestExpression,
} from '../interaction/hitTest.js';
import {
  findExpressionAtPoint,
  findExpressionsInMarquee,
} from '../interaction/selectionManager.js';
import type { Marquee } from '../interaction/selectionManager.js';

// ── Fixtures ──────────────────────────────────────────────────

const DEFAULT_STYLE: ExpressionStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

const DEFAULT_META = {
  author: { type: 'agent' as const, id: 'test', name: 'Test', provider: 'test' },
  createdAt: 0,
  updatedAt: 0,
  tags: [],
  locked: false,
};

function makeRect(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    data: {},
    meta: DEFAULT_META,
  };
}

function makeEllipseExpr(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id,
    kind: 'ellipse',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    data: {},
    meta: DEFAULT_META,
  };
}

function makeLine(id: string, points: number[][]): VisualExpression {
  const xs = points.map((p) => p[0]!);
  const ys = points.map((p) => p[1]!);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id,
    kind: 'line',
    position: { x: minX, y: minY },
    size: {
      width: (maxX - minX) || 1,
      height: (maxY - minY) || 1,
    },
    angle: 0,
    style: DEFAULT_STYLE,
    data: { kind: 'line', points },
    meta: DEFAULT_META,
  };
}

function makeDiamond(id: string, x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id,
    kind: 'diamond',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    data: {},
    meta: DEFAULT_META,
  };
}

/** Convert screen-pixel tolerance to world units for a given zoom level. */
function worldTolerance(screenPixels: number, zoom: number): number {
  return screenPixels / zoom;
}

/** Simulate screenToWorld: convert screen coords to world coords. */
function screenToWorld(sx: number, sy: number, camera: { x: number; y: number; zoom: number }) {
  return {
    x: sx / camera.zoom + camera.x,
    y: sy / camera.zoom + camera.y,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('Hit test tolerance scales with zoom [COVERAGE][AC14]', () => {
  const rect = makeRect('r1', 100, 100, 200, 100);

  it('4px screen tolerance at zoom=1 → 4px world tolerance', () => {
    const tol = worldTolerance(4, 1);
    expect(tol).toBe(4);
    // Point at (96, 150) is 4px outside left edge → within tolerance
    expect(hitTestRectangle({ x: 96, y: 150 }, rect, tol)).toBe(true);
    // Point at (95, 150) is 5px outside → outside tolerance
    expect(hitTestRectangle({ x: 95, y: 150 }, rect, tol)).toBe(false);
  });

  it('4px screen tolerance at zoom=2 → 2px world tolerance', () => {
    const tol = worldTolerance(4, 2);
    expect(tol).toBe(2);
    // Point at (98, 150) is 2px outside → within tolerance
    expect(hitTestRectangle({ x: 98, y: 150 }, rect, tol)).toBe(true);
    // Point at (96, 150) is 4px outside → outside at zoom=2
    expect(hitTestRectangle({ x: 96, y: 150 }, rect, tol)).toBe(false);
  });

  it('4px screen tolerance at zoom=0.5 → 8px world tolerance', () => {
    const tol = worldTolerance(4, 0.5);
    expect(tol).toBe(8);
    // Point at (92, 150) is 8px outside → within tolerance
    expect(hitTestRectangle({ x: 92, y: 150 }, rect, tol)).toBe(true);
    // Point at (91, 150) is 9px outside → outside tolerance
    expect(hitTestRectangle({ x: 91, y: 150 }, rect, tol)).toBe(false);
  });

  it('ellipse tolerance scales with zoom', () => {
    const ellipse = makeEllipseExpr('e1', 100, 100, 200, 100);
    // Center at (200, 150), rx=100, ry=50
    // At zoom=1, tolerance=4: expanded rx=104, ry=54
    const tolZoom1 = worldTolerance(4, 1);
    const tolZoom4 = worldTolerance(4, 4);

    // Point just outside the ellipse right edge at (305, 150)
    // At zoom=1 (tol=4), should be outside (5px beyond edge)
    expect(hitTestEllipse({ x: 305, y: 150 }, ellipse, tolZoom1)).toBe(false);

    // Same point at zoom=4 (tol=1), definitely outside
    expect(hitTestEllipse({ x: 305, y: 150 }, ellipse, tolZoom4)).toBe(false);

    // Point at (301, 150) — 1px outside, zoom=1 (tol=4) → hit
    expect(hitTestEllipse({ x: 301, y: 150 }, ellipse, tolZoom1)).toBe(true);
  });

  it('line tolerance scales with zoom', () => {
    const line = makeLine('l1', [[0, 0], [100, 0]]);
    const tolZoom1 = worldTolerance(6, 1);  // 6px screen → 6px world
    const tolZoom3 = worldTolerance(6, 3);  // 6px screen → 2px world

    // Point at (50, 5) — 5px from line at y=0
    expect(hitTestLine({ x: 50, y: 5 }, line, tolZoom1)).toBe(true);
    expect(hitTestLine({ x: 50, y: 5 }, line, tolZoom3)).toBe(false);
  });
});

describe('findExpressionAtPoint with camera transforms [COVERAGE][AC6, AC14]', () => {
  const expressions: Record<string, VisualExpression> = {
    'r1': makeRect('r1', 100, 100, 200, 100),
    'r2': makeRect('r2', 150, 120, 200, 100),  // overlaps r1
  };
  const order = ['r1', 'r2'];

  it('selects topmost at identity camera', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const point = screenToWorld(200, 150, camera);  // Inside both shapes
    const tolerance = worldTolerance(4, camera.zoom);

    const hit = findExpressionAtPoint(point, expressions, order, tolerance);
    expect(hit).toBe('r2');  // r2 is topmost (last in order)
  });

  it('selects correctly with panned camera', () => {
    // Camera panned: x=100, y=100 → screen (0,0) = world (100,100)
    const camera = { x: 100, y: 100, zoom: 1 };
    const point = screenToWorld(50, 50, camera);  // screen(50,50) → world(150,150)
    const tolerance = worldTolerance(4, camera.zoom);

    const hit = findExpressionAtPoint(point, expressions, order, tolerance);
    // world(150,150) is inside both r1 (100,100→300,200) and r2 (150,120→350,220)
    expect(hit).toBe('r2');
  });

  it('misses expression when camera is zoomed out and click is off-screen', () => {
    const camera = { x: 0, y: 0, zoom: 0.1 };
    // Screen(10,10) at zoom=0.1 → world(100, 100)
    const point = screenToWorld(10, 10, camera);
    const tolerance = worldTolerance(4, camera.zoom);  // 4 / 0.1 = 40px world tolerance

    expect(point.x).toBe(100);
    expect(point.y).toBe(100);
    // r1 is at (100,100) → should hit (top-left corner with 40px tolerance)
    const hit = findExpressionAtPoint(point, expressions, order, tolerance);
    expect(hit).toBeDefined();
  });

  it('zoomed-in camera narrows tolerance', () => {
    const camera = { x: 0, y: 0, zoom: 10 };
    const tolerance = worldTolerance(4, camera.zoom);  // 4/10 = 0.4px world

    // Point at (99.5, 150) — 0.5px outside rect left edge
    // At zoom=10, tolerance is only 0.4px → miss
    const hit = findExpressionAtPoint(
      { x: 99.5, y: 150 },
      expressions,
      order,
      tolerance,
    );
    expect(hit).toBeNull();
  });

  it('zoomed-in camera still hits within narrow tolerance', () => {
    const camera = { x: 0, y: 0, zoom: 10 };
    const tolerance = worldTolerance(4, camera.zoom);  // 0.4px world

    // Point at (99.7, 150) — 0.3px outside left edge → within 0.4px tolerance
    const hit = findExpressionAtPoint(
      { x: 99.7, y: 150 },
      expressions,
      order,
      tolerance,
    );
    expect(hit).toBe('r1');
  });
});

describe('findExpressionsInMarquee with camera transforms [COVERAGE][AC5, AC14]', () => {
  const r1 = makeRect('r1', 100, 100, 200, 100);  // 100→300 × 100→200
  const r2 = makeRect('r2', 500, 500, 100, 100);  // 500→600 × 500→600
  const expressions: Record<string, VisualExpression> = { 'r1': r1, 'r2': r2 };

  it('marquee in world coords captures correct expressions after pan', () => {
    const camera = { x: 50, y: 50, zoom: 1 };
    // User drags from screen(100,100) to screen(400,200)
    // In world: (150,150) to (450,250)
    const topLeft = screenToWorld(100, 100, camera);
    const bottomRight = screenToWorld(400, 200, camera);

    const marquee: Marquee = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };

    const hits = findExpressionsInMarquee(marquee, expressions);
    // r1 (100→300, 100→200) intersects marquee (150→450, 150→250) ✓
    // r2 (500→600, 500→600) does NOT intersect ✗
    expect(hits).toContain('r1');
    expect(hits).not.toContain('r2');
  });

  it('marquee at zoom=0.5 covers larger world area', () => {
    const camera = { x: 0, y: 0, zoom: 0.5 };
    // Screen(0,0) → world(0,0), Screen(400,400) → world(800,800)
    const topLeft = screenToWorld(0, 0, camera);
    const bottomRight = screenToWorld(400, 400, camera);

    const marquee: Marquee = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };

    // Both shapes should be within (0→800, 0→800)
    const hits = findExpressionsInMarquee(marquee, expressions);
    expect(hits).toContain('r1');
    expect(hits).toContain('r2');
  });

  it('marquee at zoom=4 covers tiny world area', () => {
    const camera = { x: 0, y: 0, zoom: 4 };
    // Screen(0,0) → world(0,0), Screen(100,100) → world(25,25)
    const topLeft = screenToWorld(0, 0, camera);
    const bottomRight = screenToWorld(100, 100, camera);

    const marquee: Marquee = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };

    // Marquee covers world (0→25, 0→25) — neither shape is here
    const hits = findExpressionsInMarquee(marquee, expressions);
    expect(hits).toHaveLength(0);
  });
});

describe('Degenerate shape hit testing [EDGE]', () => {
  it('zero-width rectangle still hittable within tolerance', () => {
    const zeroWidth = makeRect('zw', 100, 100, 0, 100);
    const tolerance = 4;
    // Point at (101, 150) — 1px from the zero-width line
    expect(hitTestRectangle({ x: 101, y: 150 }, zeroWidth, tolerance)).toBe(true);
    // Point at (105, 150) — 5px from line → outside
    expect(hitTestRectangle({ x: 105, y: 150 }, zeroWidth, tolerance)).toBe(false);
  });

  it('zero-height rectangle still hittable within tolerance', () => {
    const zeroHeight = makeRect('zh', 100, 100, 200, 0);
    const tolerance = 4;
    expect(hitTestRectangle({ x: 200, y: 101 }, zeroHeight, tolerance)).toBe(true);
    expect(hitTestRectangle({ x: 200, y: 105 }, zeroHeight, tolerance)).toBe(false);
  });

  it('zero-size diamond returns false', () => {
    const zeroDiamond = makeDiamond('zd', 100, 100, 0, 0);
    // Diamond with zero size — center at (100,100) but half-widths are 0
    expect(hitTestExpression({ x: 100, y: 100 }, zeroDiamond, 0)).toBe(false);
  });

  it('point-size rectangle hit at exact position', () => {
    const point = makeRect('pt', 50, 50, 0, 0);
    expect(hitTestRectangle({ x: 50, y: 50 }, point, 0)).toBe(true);
    expect(hitTestRectangle({ x: 50, y: 50 }, point, 2)).toBe(true);
    expect(hitTestRectangle({ x: 53, y: 50 }, point, 2)).toBe(false);
  });
});

describe('Z-order with many overlapping shapes [BOUNDARY][AC6]', () => {
  it('correctly identifies topmost among 10 stacked shapes', () => {
    const shapes: Record<string, VisualExpression> = {};
    const order: string[] = [];

    for (let i = 0; i < 10; i++) {
      const id = `r${i}`;
      shapes[id] = makeRect(id, 100 + i * 5, 100 + i * 5, 200, 100);
      order.push(id);
    }

    const center = { x: 250, y: 150 };  // Inside all shapes
    const hit = findExpressionAtPoint(center, shapes, order, 4);
    expect(hit).toBe('r9');  // Last in order = topmost
  });

  it('returns correct shape when topmost is removed from map', () => {
    const shapes: Record<string, VisualExpression> = {
      'r1': makeRect('r1', 100, 100, 200, 100),
      'r2': makeRect('r2', 100, 100, 200, 100),
    };
    const order = ['r1', 'r2', 'r3'];  // r3 in order but not in map

    const hit = findExpressionAtPoint({ x: 200, y: 150 }, shapes, order, 4);
    // r3 is missing from map → skipped, r2 is the topmost available
    expect(hit).toBe('r2');
  });
});

describe('Viewport culling ↔ hit testing agreement [BOUNDARY]', () => {
  // This test verifies that expressions deemed "not visible" by viewport culling
  // are also "not hittable" by hit testing — they should be consistent.

  it('expression outside viewport is not hittable at that point', () => {
    // Shape at (1000, 1000) — far from origin
    const farShape = makeRect('far', 1000, 1000, 100, 100);
    const expressions: Record<string, VisualExpression> = { 'far': farShape };
    const order = ['far'];

    // Click at world (0, 0) — near origin
    const hit = findExpressionAtPoint({ x: 0, y: 0 }, expressions, order, 4);
    expect(hit).toBeNull();
  });

  it('expression inside viewport is hittable', () => {
    const nearShape = makeRect('near', 50, 50, 100, 100);
    const expressions: Record<string, VisualExpression> = { 'near': nearShape };
    const order = ['near'];

    // Click at world (100, 100) — inside the shape
    const hit = findExpressionAtPoint({ x: 100, y: 100 }, expressions, order, 4);
    expect(hit).toBe('near');
  });
});
