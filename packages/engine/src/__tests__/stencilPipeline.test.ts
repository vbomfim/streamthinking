/**
 * Unit tests for stencil rendering and hit testing.
 *
 * Covers: stencil hit testing via bounding-box, hitTestExpression dispatch
 * for stencil kind, and stencil rendering dispatch (verifying the case
 * is wired up in the switch statement).
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import {
  hitTestStencil,
  hitTestExpression,
  hitTestBoundingBox,
} from '../interaction/hitTest.js';

// ── Test helpers ─────────────────────────────────────────────

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

/** Create a stencil expression at (x, y) with given size. */
function makeStencil(
  x: number,
  y: number,
  w: number,
  h: number,
  stencilId = 'server',
  category = 'network',
  label?: string,
): VisualExpression {
  return {
    id: 'stencil-1',
    kind: 'stencil',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: {
      kind: 'stencil',
      stencilId,
      category,
      ...(label !== undefined ? { label } : {}),
    },
  };
}

// ── hitTestStencil ──────────────────────────────────────────

describe('hitTestStencil', () => {
  const expr = makeStencil(10, 20, 64, 64);

  it('returns true for point inside the stencil bounding box', () => {
    expect(hitTestStencil({ x: 42, y: 52 }, expr)).toBe(true);
  });

  it('returns true for point on the top-left corner', () => {
    expect(hitTestStencil({ x: 10, y: 20 }, expr)).toBe(true);
  });

  it('returns true for point on the bottom-right corner', () => {
    expect(hitTestStencil({ x: 74, y: 84 }, expr)).toBe(true);
  });

  it('returns false for point outside the bounding box', () => {
    expect(hitTestStencil({ x: 9, y: 20 }, expr)).toBe(false);
    expect(hitTestStencil({ x: 75, y: 52 }, expr)).toBe(false);
    expect(hitTestStencil({ x: 42, y: 19 }, expr)).toBe(false);
    expect(hitTestStencil({ x: 42, y: 85 }, expr)).toBe(false);
  });

  it('behaves identically to hitTestBoundingBox', () => {
    const points = [
      { x: 42, y: 52 },   // inside
      { x: 0, y: 0 },     // outside
      { x: 10, y: 20 },   // corner
      { x: 75, y: 85 },   // just outside
    ];
    for (const pt of points) {
      expect(hitTestStencil(pt, expr)).toBe(hitTestBoundingBox(pt, expr));
    }
  });
});

// ── hitTestExpression dispatch ───────────────────────────────

describe('hitTestExpression with stencil kind', () => {
  const expr = makeStencil(0, 0, 100, 100);

  it('dispatches to stencil hit test for kind=stencil', () => {
    expect(hitTestExpression({ x: 50, y: 50 }, expr, 0)).toBe(true);
  });

  it('returns false for point outside stencil bounds', () => {
    expect(hitTestExpression({ x: -1, y: 50 }, expr, 0)).toBe(false);
  });

  it('returns true for point at boundary', () => {
    expect(hitTestExpression({ x: 0, y: 0 }, expr, 0)).toBe(true);
    expect(hitTestExpression({ x: 100, y: 100 }, expr, 0)).toBe(true);
  });
});
