/**
 * Unit tests for hit testing — pure geometry functions.
 *
 * Covers: point inside/outside/on-edge for each shape, tolerance scaling,
 * dispatch by kind, and edge cases (zero-size, negative coords).
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { PathSegment } from '../connectors/routerTypes.js';
import { describe, it, expect } from 'vitest';
import {
  hitTestRectangle,
  hitTestEllipse,
  hitTestDiamond,
  hitTestLine,
  hitTestArrow,
  hitTestFreehand,
  hitTestText,
  hitTestStickyNote,
  hitTestImage,
  hitTestExpression,
  hitTestBoundingBox,
  distanceToBezier,
  distanceToPathSegments,
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

/** Create a rectangle expression at (x, y) with given size. */
function makeRect(x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id: 'rect-1',
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'rectangle' },
  };
}

/** Create an ellipse expression at (x, y) with given size. */
function makeEllipse(x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id: 'ellipse-1',
    kind: 'ellipse',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'ellipse' },
  };
}

/** Create a diamond expression at (x, y) with given size. */
function makeDiamond(x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id: 'diamond-1',
    kind: 'diamond',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'diamond' },
  };
}

/** Create a line expression with given points. */
function makeLine(points: [number, number][]): VisualExpression {
  // Compute bounding box from points
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id: 'line-1',
    kind: 'line',
    position: { x: minX, y: minY },
    size: { width: maxX - minX || 1, height: maxY - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'line', points },
  };
}

/** Create an arrow expression with given points. */
function makeArrow(points: [number, number][]): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id: 'arrow-1',
    kind: 'arrow',
    position: { x: minX, y: minY },
    size: { width: maxX - minX || 1, height: maxY - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'arrow', points },
  };
}

/** Create a freehand expression with given points. */
function makeFreehand(points: [number, number, number][]): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id: 'freehand-1',
    kind: 'freehand',
    position: { x: minX, y: minY },
    size: { width: maxX - minX || 1, height: maxY - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'freehand', points },
  };
}

/** Create a text expression at (x, y) with given size. */
function makeText(x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id: 'text-1',
    kind: 'text',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'text', text: 'Hello', fontSize: 16, fontFamily: 'sans-serif', textAlign: 'left' },
  };
}

/** Create a sticky-note expression at (x, y) with given size. */
function makeStickyNote(x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id: 'sticky-1',
    kind: 'sticky-note',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'sticky-note', text: 'Note', color: '#ffeb3b' },
  };
}

/** Create an image expression at (x, y) with given size. */
function makeImage(x: number, y: number, w: number, h: number): VisualExpression {
  return {
    id: 'image-1',
    kind: 'image',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'image', src: 'test.png' },
  };
}

// ── hitTestRectangle ─────────────────────────────────────────

describe('hitTestRectangle', () => {
  const rect = makeRect(100, 100, 200, 150);

  it('returns true for point inside rectangle', () => {
    expect(hitTestRectangle({ x: 200, y: 175 }, rect, 0)).toBe(true);
  });

  it('returns true for point on the edge', () => {
    expect(hitTestRectangle({ x: 100, y: 100 }, rect, 0)).toBe(true);
  });

  it('returns true for point on bottom-right corner', () => {
    expect(hitTestRectangle({ x: 300, y: 250 }, rect, 0)).toBe(true);
  });

  it('returns false for point outside rectangle', () => {
    expect(hitTestRectangle({ x: 50, y: 50 }, rect, 0)).toBe(false);
  });

  it('returns false for point just outside right edge', () => {
    expect(hitTestRectangle({ x: 301, y: 175 }, rect, 0)).toBe(false);
  });

  it('returns true for point just outside with tolerance', () => {
    // Point is 5px to the right of the edge; tolerance = 10
    expect(hitTestRectangle({ x: 305, y: 175 }, rect, 10)).toBe(true);
  });

  it('returns false for point outside tolerance range', () => {
    // Point is 20px to the right; tolerance = 10
    expect(hitTestRectangle({ x: 320, y: 175 }, rect, 10)).toBe(false);
  });

  it('handles negative coordinates', () => {
    const negRect = makeRect(-100, -100, 50, 50);
    expect(hitTestRectangle({ x: -75, y: -75 }, negRect, 0)).toBe(true);
    expect(hitTestRectangle({ x: -200, y: -200 }, negRect, 0)).toBe(false);
  });
});

// ── hitTestEllipse ───────────────────────────────────────────

describe('hitTestEllipse', () => {
  // Ellipse at (100, 100) with size 200×150
  // Center: (200, 175), rx=100, ry=75
  const ellipse = makeEllipse(100, 100, 200, 150);

  it('returns true for point at center', () => {
    expect(hitTestEllipse({ x: 200, y: 175 }, ellipse, 0)).toBe(true);
  });

  it('returns true for point inside ellipse', () => {
    expect(hitTestEllipse({ x: 150, y: 175 }, ellipse, 0)).toBe(true);
  });

  it('returns true for point on the boundary', () => {
    // Point on the right: (300, 175) → ((300-200)/100)² + ((175-175)/75)² = 1
    expect(hitTestEllipse({ x: 300, y: 175 }, ellipse, 0)).toBe(true);
  });

  it('returns false for point outside ellipse', () => {
    // Corner of bounding box: (100, 100) → far outside ellipse
    expect(hitTestEllipse({ x: 100, y: 100 }, ellipse, 0)).toBe(false);
  });

  it('returns false for point well outside', () => {
    expect(hitTestEllipse({ x: 50, y: 50 }, ellipse, 0)).toBe(false);
  });

  it('returns true for point just outside with tolerance', () => {
    // Point at (310, 175), 10px to the right of boundary; tolerance=15
    expect(hitTestEllipse({ x: 310, y: 175 }, ellipse, 15)).toBe(true);
  });

  it('handles circle (equal width and height)', () => {
    const circle = makeEllipse(0, 0, 100, 100);
    // Center at (50, 50), radius 50
    expect(hitTestEllipse({ x: 50, y: 50 }, circle, 0)).toBe(true);
    expect(hitTestEllipse({ x: 100, y: 50 }, circle, 0)).toBe(true); // on boundary
    expect(hitTestEllipse({ x: 105, y: 50 }, circle, 0)).toBe(false); // outside
    expect(hitTestEllipse({ x: 105, y: 50 }, circle, 10)).toBe(true); // within tolerance
  });
});

// ── hitTestDiamond ───────────────────────────────────────────

describe('hitTestDiamond', () => {
  // Diamond at (100, 100) with size 200×200
  // Center: (200, 200), vertices: top(200,100), right(300,200), bottom(200,300), left(100,200)
  const diamond = makeDiamond(100, 100, 200, 200);

  it('returns true for point at center', () => {
    expect(hitTestDiamond({ x: 200, y: 200 }, diamond, 0)).toBe(true);
  });

  it('returns true for point inside diamond', () => {
    expect(hitTestDiamond({ x: 200, y: 150 }, diamond, 0)).toBe(true);
  });

  it('returns true for point on vertex', () => {
    // Top vertex: (200, 100)
    expect(hitTestDiamond({ x: 200, y: 100 }, diamond, 0)).toBe(true);
  });

  it('returns true for point on edge', () => {
    // Midpoint of top-right edge: (250, 150)
    expect(hitTestDiamond({ x: 250, y: 150 }, diamond, 0)).toBe(true);
  });

  it('returns false for point in bounding box corner (outside diamond)', () => {
    // Top-left corner of bounding box: (100, 100) is outside diamond
    expect(hitTestDiamond({ x: 101, y: 101 }, diamond, 0)).toBe(false);
  });

  it('returns false for point outside diamond', () => {
    expect(hitTestDiamond({ x: 50, y: 50 }, diamond, 0)).toBe(false);
  });

  it('returns true for point just outside with tolerance', () => {
    // Point slightly outside the top vertex
    expect(hitTestDiamond({ x: 200, y: 95 }, diamond, 10)).toBe(true);
  });

  it('handles non-square diamond', () => {
    const oblong = makeDiamond(0, 0, 200, 100);
    // Center: (100, 50), half-widths: 100, 50
    expect(hitTestDiamond({ x: 100, y: 50 }, oblong, 0)).toBe(true);
    expect(hitTestDiamond({ x: 200, y: 50 }, oblong, 0)).toBe(true); // right vertex
    expect(hitTestDiamond({ x: 0, y: 0 }, oblong, 0)).toBe(false); // corner
  });
});

// ── hitTestLine ──────────────────────────────────────────────

describe('hitTestLine', () => {
  // Horizontal line from (0, 0) to (100, 0)
  const hLine = makeLine([[0, 0], [100, 0]]);

  it('returns true for point on the line', () => {
    expect(hitTestLine({ x: 50, y: 0 }, hLine, 5)).toBe(true);
  });

  it('returns true for point within tolerance of line', () => {
    expect(hitTestLine({ x: 50, y: 3 }, hLine, 5)).toBe(true);
  });

  it('returns false for point outside tolerance', () => {
    expect(hitTestLine({ x: 50, y: 10 }, hLine, 5)).toBe(false);
  });

  it('returns true for point at line endpoint', () => {
    expect(hitTestLine({ x: 0, y: 0 }, hLine, 5)).toBe(true);
  });

  it('handles multi-segment line', () => {
    // L-shaped line: (0,0) → (100,0) → (100,100)
    const lLine = makeLine([[0, 0], [100, 0], [100, 100]]);
    expect(hitTestLine({ x: 50, y: 0 }, lLine, 5)).toBe(true);   // on first segment
    expect(hitTestLine({ x: 100, y: 50 }, lLine, 5)).toBe(true);  // on second segment
    expect(hitTestLine({ x: 50, y: 50 }, lLine, 5)).toBe(false);  // off both segments
  });

  it('handles diagonal line', () => {
    // Line from (0, 0) to (100, 100)
    const diagLine = makeLine([[0, 0], [100, 100]]);
    // Point on the line
    expect(hitTestLine({ x: 50, y: 50 }, diagLine, 5)).toBe(true);
    // Point just off the line (perpendicular distance ≈ 7.07)
    expect(hitTestLine({ x: 55, y: 45 }, diagLine, 5)).toBe(false);
  });
});

// ── hitTestArrow ─────────────────────────────────────────────

describe('hitTestArrow', () => {
  const arrow = makeArrow([[0, 0], [100, 0]]);

  it('returns true for point on the arrow path', () => {
    expect(hitTestArrow({ x: 50, y: 0 }, arrow, 5)).toBe(true);
  });

  it('returns true for point within tolerance', () => {
    expect(hitTestArrow({ x: 50, y: 3 }, arrow, 5)).toBe(true);
  });

  it('returns false for point outside tolerance', () => {
    expect(hitTestArrow({ x: 50, y: 10 }, arrow, 5)).toBe(false);
  });
});

// ── hitTestFreehand ──────────────────────────────────────────

describe('hitTestFreehand', () => {
  // Freehand stroke: simple horizontal line with pressure
  const freehand = makeFreehand([[0, 0, 0.5], [50, 0, 0.5], [100, 0, 0.5]]);

  it('returns true for point on the freehand path', () => {
    expect(hitTestFreehand({ x: 25, y: 0 }, freehand, 5)).toBe(true);
  });

  it('returns true for point within tolerance', () => {
    expect(hitTestFreehand({ x: 25, y: 3 }, freehand, 5)).toBe(true);
  });

  it('returns false for point outside tolerance', () => {
    expect(hitTestFreehand({ x: 25, y: 10 }, freehand, 5)).toBe(false);
  });

  it('handles curved freehand path', () => {
    const curve = makeFreehand([[0, 0, 0.5], [50, 50, 0.5], [100, 0, 0.5]]);
    // Point near the second segment
    expect(hitTestFreehand({ x: 75, y: 25 }, curve, 5)).toBe(true);
    // Point far from path
    expect(hitTestFreehand({ x: 0, y: 50 }, curve, 5)).toBe(false);
  });
});

// ── hitTestText ──────────────────────────────────────────────

describe('hitTestText', () => {
  const text = makeText(100, 100, 200, 50);

  it('returns true for point inside text bounds', () => {
    expect(hitTestText({ x: 200, y: 125 }, text)).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(hitTestText({ x: 100, y: 100 }, text)).toBe(true);
  });

  it('returns false for point outside text bounds', () => {
    expect(hitTestText({ x: 50, y: 50 }, text)).toBe(false);
  });
});

// ── hitTestStickyNote ────────────────────────────────────────

describe('hitTestStickyNote', () => {
  const sticky = makeStickyNote(100, 100, 200, 200);

  it('returns true for point inside sticky note bounds', () => {
    expect(hitTestStickyNote({ x: 200, y: 200 }, sticky)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(hitTestStickyNote({ x: 50, y: 50 }, sticky)).toBe(false);
  });
});

// ── hitTestImage ─────────────────────────────────────────────

describe('hitTestImage', () => {
  const img = makeImage(100, 100, 300, 200);

  it('returns true for point inside image bounds', () => {
    expect(hitTestImage({ x: 250, y: 200 }, img)).toBe(true);
  });

  it('returns false for point outside', () => {
    expect(hitTestImage({ x: 50, y: 50 }, img)).toBe(false);
  });
});

// ── hitTestExpression (dispatch) ─────────────────────────────

describe('hitTestExpression', () => {
  it('dispatches to rectangle hit test', () => {
    const rect = makeRect(0, 0, 100, 100);
    expect(hitTestExpression({ x: 50, y: 50 }, rect, 0)).toBe(true);
    expect(hitTestExpression({ x: 200, y: 200 }, rect, 0)).toBe(false);
  });

  it('dispatches to ellipse hit test', () => {
    const ellipse = makeEllipse(0, 0, 100, 100);
    // Center (50, 50), inside
    expect(hitTestExpression({ x: 50, y: 50 }, ellipse, 0)).toBe(true);
    // Corner of bounding box — outside ellipse
    expect(hitTestExpression({ x: 0, y: 0 }, ellipse, 0)).toBe(false);
  });

  it('dispatches to diamond hit test', () => {
    const diamond = makeDiamond(0, 0, 100, 100);
    expect(hitTestExpression({ x: 50, y: 50 }, diamond, 0)).toBe(true);
    // Corner — outside diamond
    expect(hitTestExpression({ x: 1, y: 1 }, diamond, 0)).toBe(false);
  });

  it('dispatches to line hit test', () => {
    const line = makeLine([[0, 0], [100, 0]]);
    expect(hitTestExpression({ x: 50, y: 0 }, line, 5)).toBe(true);
    expect(hitTestExpression({ x: 50, y: 20 }, line, 5)).toBe(false);
  });

  it('dispatches to arrow hit test', () => {
    const arrow = makeArrow([[0, 0], [100, 0]]);
    expect(hitTestExpression({ x: 50, y: 0 }, arrow, 5)).toBe(true);
  });

  it('dispatches to freehand hit test', () => {
    const fh = makeFreehand([[0, 0, 0.5], [100, 0, 0.5]]);
    expect(hitTestExpression({ x: 50, y: 0 }, fh, 5)).toBe(true);
  });

  it('dispatches to text hit test', () => {
    const text = makeText(0, 0, 100, 50);
    expect(hitTestExpression({ x: 50, y: 25 }, text, 0)).toBe(true);
  });

  it('dispatches to sticky-note hit test', () => {
    const sticky = makeStickyNote(0, 0, 100, 100);
    expect(hitTestExpression({ x: 50, y: 50 }, sticky, 0)).toBe(true);
  });

  it('dispatches to image hit test', () => {
    const img = makeImage(0, 0, 100, 100);
    expect(hitTestExpression({ x: 50, y: 50 }, img, 0)).toBe(true);
  });

  it('uses bounding-box fallback for unknown expression kind', () => {
    const unknown = { ...makeRect(0, 0, 100, 100), kind: 'unknown-widget' } as unknown as VisualExpression;
    // Inside bounding box → true (bounding-box fallback)
    expect(hitTestExpression({ x: 50, y: 50 }, unknown, 0)).toBe(true);
    // Outside bounding box → false
    expect(hitTestExpression({ x: 200, y: 200 }, unknown, 0)).toBe(false);
  });
});

// ── Tolerance scaling with zoom ──────────────────────────────

describe('tolerance scaling', () => {
  const rect = makeRect(100, 100, 100, 100);

  it('tolerance in world units narrows at higher zoom', () => {
    // At zoom 2, screen tolerance of 10px → world tolerance of 5
    const worldTolerance = 10 / 2;
    // Point 3px outside right edge in world coords: (203, 150)
    expect(hitTestRectangle({ x: 203, y: 150 }, rect, worldTolerance)).toBe(true);
  });

  it('tolerance in world units widens at lower zoom', () => {
    // At zoom 0.5, screen tolerance of 10px → world tolerance of 20
    const worldTolerance = 10 / 0.5;
    // Point 15px outside right edge in world coords: (215, 150)
    expect(hitTestRectangle({ x: 215, y: 150 }, rect, worldTolerance)).toBe(true);
  });
});

// ── hitTestBoundingBox ───────────────────────────────────────

describe('hitTestBoundingBox', () => {
  it('returns true for point inside bounds', () => {
    const rect = makeRect(100, 100, 200, 150);
    expect(hitTestBoundingBox({ x: 200, y: 175 }, rect)).toBe(true);
  });

  it('returns true for point on edge', () => {
    const rect = makeRect(100, 100, 200, 150);
    expect(hitTestBoundingBox({ x: 100, y: 100 }, rect)).toBe(true);
  });

  it('returns false for point outside bounds', () => {
    const rect = makeRect(100, 100, 200, 150);
    expect(hitTestBoundingBox({ x: 50, y: 50 }, rect)).toBe(false);
  });
});

// ── Composite expression hit testing (S6-2) ──────────────────

describe('composite expression hit testing (S6-2)', () => {
  /** Create a composite expression with known bounds. */
  function makeComposite(
    kind: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): VisualExpression {
    return {
      id: `composite-${kind}`,
      kind,
      position: { x, y },
      size: { width: w, height: h },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: { kind },
    } as unknown as VisualExpression;
  }

  it('hit tests flowchart expressions using bounding box', () => {
    const expr = makeComposite('flowchart', 100, 100, 400, 300);
    expect(hitTestExpression({ x: 300, y: 250 }, expr, 0)).toBe(true);
    expect(hitTestExpression({ x: 50, y: 50 }, expr, 0)).toBe(false);
  });

  it('hit tests sequence-diagram expressions using bounding box', () => {
    const expr = makeComposite('sequence-diagram', 50, 50, 500, 400);
    expect(hitTestExpression({ x: 200, y: 200 }, expr, 0)).toBe(true);
    expect(hitTestExpression({ x: 600, y: 500 }, expr, 0)).toBe(false);
  });

  it('hit tests mind-map expressions using bounding box', () => {
    const expr = makeComposite('mind-map', 0, 0, 600, 400);
    expect(hitTestExpression({ x: 300, y: 200 }, expr, 0)).toBe(true);
    expect(hitTestExpression({ x: 700, y: 500 }, expr, 0)).toBe(false);
  });

  it('hit tests reasoning-chain expressions using bounding box', () => {
    const expr = makeComposite('reasoning-chain', 200, 200, 400, 600);
    expect(hitTestExpression({ x: 400, y: 500 }, expr, 0)).toBe(true);
    expect(hitTestExpression({ x: 100, y: 100 }, expr, 0)).toBe(false);
  });

  it('hit tests any future composite kind using bounding box', () => {
    const expr = makeComposite('kanban', 0, 0, 300, 300);
    expect(hitTestExpression({ x: 150, y: 150 }, expr, 0)).toBe(true);
    expect(hitTestExpression({ x: 400, y: 400 }, expr, 0)).toBe(false);
  });
});

// ── distanceToBezier ─────────────────────────────────────────

describe('distanceToBezier', () => {
  it('returns zero for point on the start of the curve', () => {
    // Curve from (0,0) to (100,0) with control points forming a straight line
    const dist = distanceToBezier(0, 0, 0, 0, 33, 0, 66, 0, 100, 0);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('returns zero for point on the end of the curve', () => {
    const dist = distanceToBezier(100, 0, 0, 0, 33, 0, 66, 0, 100, 0);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('returns near-zero for point on a straight bezier midpoint', () => {
    // Straight bezier: control points collinear with endpoints
    const dist = distanceToBezier(50, 0, 0, 0, 33, 0, 66, 0, 100, 0);
    expect(dist).toBeLessThan(1);
  });

  it('returns correct distance for point away from curve', () => {
    // Point 50px above a horizontal straight bezier
    const dist = distanceToBezier(50, 50, 0, 0, 33, 0, 66, 0, 100, 0);
    expect(dist).toBeCloseTo(50, 0);
  });

  it('handles curved bezier — point near apex is close', () => {
    // Curve from (0,0) to (100,0) bowing upward (negative y)
    // Control points: (33, -50) and (66, -50) — apex around y=-37
    const dist = distanceToBezier(50, -37, 0, 0, 33, -50, 66, -50, 100, 0);
    expect(dist).toBeLessThan(5);
  });

  it('handles curved bezier — point far from apex is far', () => {
    // Point at (50, 50) — below horizontal, far from upward-bowing curve
    const dist = distanceToBezier(50, 50, 0, 0, 33, -50, 66, -50, 100, 0);
    expect(dist).toBeGreaterThan(30);
  });

  it('handles degenerate bezier (all same point)', () => {
    const dist = distanceToBezier(10, 10, 5, 5, 5, 5, 5, 5, 5, 5);
    expect(dist).toBeCloseTo(Math.hypot(5, 5), 1);
  });
});

// ── distanceToPathSegments ───────────────────────────────────

describe('distanceToPathSegments', () => {
  it('returns distance to single line segment', () => {
    const segments: PathSegment[] = [{ type: 'line', x: 100, y: 0 }];
    const dist = distanceToPathSegments(50, 5, 0, 0, segments);
    expect(dist).toBeCloseTo(5, 1);
  });

  it('returns distance to multi-segment L-shaped path', () => {
    const segments: PathSegment[] = [
      { type: 'line', x: 100, y: 0 },
      { type: 'line', x: 100, y: 100 },
    ];
    // Point near second segment
    const dist = distanceToPathSegments(97, 50, 0, 0, segments);
    expect(dist).toBeCloseTo(3, 1);
  });

  it('returns distance to bezier segment', () => {
    const segments: PathSegment[] = [
      {
        type: 'bezier',
        cp1x: 33, cp1y: 0,
        cp2x: 66, cp2y: 0,
        x: 100, y: 0,
      },
    ];
    // Point on the straight bezier path
    const dist = distanceToPathSegments(50, 0, 0, 0, segments);
    expect(dist).toBeLessThan(2);
  });

  it('returns Infinity for empty segments', () => {
    const dist = distanceToPathSegments(50, 50, 0, 0, []);
    expect(dist).toBe(Infinity);
  });

  it('handles mixed line and bezier segments', () => {
    const segments: PathSegment[] = [
      { type: 'line', x: 50, y: 0 },
      {
        type: 'bezier',
        cp1x: 60, cp1y: 0,
        cp2x: 90, cp2y: 0,
        x: 100, y: 0,
      },
    ];
    // Point near the line segment
    const dist = distanceToPathSegments(25, 3, 0, 0, segments);
    expect(dist).toBeCloseTo(3, 1);
  });

  it('handles arc segments by treating as line to endpoint', () => {
    const segments: PathSegment[] = [
      { type: 'arc', rx: 10, ry: 10, x: 100, y: 0 },
    ];
    // Arc treated as line segment for hit testing
    const dist = distanceToPathSegments(50, 0, 0, 0, segments);
    expect(dist).toBeLessThan(1);
  });
});

// ── hitTestArrow with routed paths ───────────────────────────

describe('hitTestArrow with routed paths', () => {
  /** Create an arrow with routing mode and optional bindings. */
  function makeRoutedArrow(
    points: [number, number][],
    routing: string,
    bindings?: { startAnchor?: string; endAnchor?: string },
  ): VisualExpression {
    const xs = points.map(([px]) => px);
    const ys = points.map(([, py]) => py);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      id: 'routed-arrow-1',
      kind: 'arrow',
      position: { x: minX, y: minY },
      size: { width: maxX - minX || 1, height: maxY - minY || 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points,
        routing,
        startBinding: bindings?.startAnchor
          ? { expressionId: 'src', anchor: bindings.startAnchor, gap: 0 }
          : undefined,
        endBinding: bindings?.endAnchor
          ? { expressionId: 'tgt', anchor: bindings.endAnchor, gap: 0 }
          : undefined,
      },
    };
  }

  it('straight arrow uses point-to-point segments (no router)', () => {
    const arrow = makeRoutedArrow([[0, 0], [100, 0]], 'straight');
    // Point on the line
    expect(hitTestArrow({ x: 50, y: 0 }, arrow, 5)).toBe(true);
    // Point off the line
    expect(hitTestArrow({ x: 50, y: 20 }, arrow, 5)).toBe(false);
  });

  it('orthogonal arrow hit tests against routed segments', () => {
    // Orthogonal arrow from (0,0) to (100,100) — router creates L/Z-shape
    const arrow = makeRoutedArrow([[0, 0], [100, 100]], 'orthogonal');
    // The orthogonal router will create waypoints — the point on the
    // straight diagonal should NOT hit if the route goes L-shaped
    // But a point along one of the orthogonal segments should hit
    // We test that the function doesn't crash and uses routing
    expect(hitTestArrow({ x: 0, y: 0 }, arrow, 8)).toBe(true);
    expect(hitTestArrow({ x: 100, y: 100 }, arrow, 8)).toBe(true);
  });

  it('curved arrow hit tests against bezier path', () => {
    // Curved arrow from (0,0) to (200,0)
    const arrow = makeRoutedArrow([[0, 0], [200, 0]], 'curved');
    // Point at start
    expect(hitTestArrow({ x: 0, y: 0 }, arrow, 8)).toBe(true);
    // Point at end
    expect(hitTestArrow({ x: 200, y: 0 }, arrow, 8)).toBe(true);
    // Point near the middle of the curve
    expect(hitTestArrow({ x: 100, y: 0 }, arrow, 8)).toBe(true);
  });

  it('curved arrow — point far from curve misses', () => {
    const arrow = makeRoutedArrow([[0, 0], [200, 0]], 'curved');
    // Point well away from the curve
    expect(hitTestArrow({ x: 100, y: 100 }, arrow, 8)).toBe(false);
  });

  it('elbow arrow hit tests against routed segments', () => {
    const arrow = makeRoutedArrow([[0, 0], [100, 100]], 'elbow');
    // Start and end should always hit
    expect(hitTestArrow({ x: 0, y: 0 }, arrow, 8)).toBe(true);
    expect(hitTestArrow({ x: 100, y: 100 }, arrow, 8)).toBe(true);
  });

  it('arrow with undefined routing works like straight', () => {
    const arrow = makeArrow([[0, 0], [100, 0]]);
    // Standard straight arrow behavior
    expect(hitTestArrow({ x: 50, y: 0 }, arrow, 5)).toBe(true);
    expect(hitTestArrow({ x: 50, y: 20 }, arrow, 5)).toBe(false);
  });
});

// ── hitTestArrow with self-loops ─────────────────────────────

describe('hitTestArrow with self-loops', () => {
  /** Create a self-loop arrow bound to a shape. */
  function makeSelfLoopArrow(
    points: [number, number][],
    routing: string | undefined,
    jettySize?: number,
  ): VisualExpression {
    const xs = points.map(([px]) => px);
    const ys = points.map(([, py]) => py);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      id: 'selfloop-arrow-1',
      kind: 'arrow',
      position: { x: minX, y: minY },
      size: { width: maxX - minX || 1, height: maxY - minY || 1 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: DEFAULT_META,
      data: {
        kind: 'arrow',
        points,
        routing,
        jettySize,
        startBinding: { expressionId: 'shape-1', anchor: 'right' as const },
        endBinding: { expressionId: 'shape-1', anchor: 'right' as const },
      },
    };
  }

  /** Target shape for self-loop — 100x80 at (200, 100). */
  const targetShape: VisualExpression = {
    id: 'shape-1',
    kind: 'rectangle',
    position: { x: 200, y: 100 },
    size: { width: 100, height: 80 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'rectangle' },
  };

  const expressions: Record<string, VisualExpression> = {
    'shape-1': targetShape,
  };

  it('orthogonal self-loop — point on outward segment hits', () => {
    // Start and end on right edge (x=300), loop extends rightward
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 30);
    // Point on the outward vertical segment at x=330 (300+30)
    expect(hitTestArrow({ x: 330, y: 140 }, arrow, 8, expressions)).toBe(true);
  });

  it('orthogonal self-loop — point on horizontal segment hits', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 30);
    // Point on the top horizontal segment (y=120, between x=300 and x=330)
    expect(hitTestArrow({ x: 315, y: 120 }, arrow, 8, expressions)).toBe(true);
  });

  it('orthogonal self-loop — point far from loop misses', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'orthogonal', 30);
    // Point well outside the loop path
    expect(hitTestArrow({ x: 200, y: 140 }, arrow, 8, expressions)).toBe(false);
  });

  it('elbow self-loop — hits on the loop path', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'elbow', 30);
    // Point on the outward segment
    expect(hitTestArrow({ x: 330, y: 140 }, arrow, 8, expressions)).toBe(true);
  });

  it('curved self-loop — point on start/end segment hits', () => {
    const arrow = makeSelfLoopArrow([[300, 120], [300, 160]], 'curved', 30);
    // Point near start should still hit (fallback to segment test)
    expect(hitTestArrow({ x: 300, y: 120 }, arrow, 8, expressions)).toBe(true);
  });
});
