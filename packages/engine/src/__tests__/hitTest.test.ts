/**
 * Unit tests for hit testing — pure geometry functions.
 *
 * Covers: point inside/outside/on-edge for each shape, tolerance scaling,
 * dispatch by kind, and edge cases (zero-size, negative coords).
 *
 * @module
 */

import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
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

  it('returns false for unknown expression kind', () => {
    const unknown = { ...makeRect(0, 0, 100, 100), kind: 'unknown-widget' } as unknown as VisualExpression;
    expect(hitTestExpression({ x: 50, y: 50 }, unknown, 0)).toBe(false);
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
