/**
 * Unit tests for manipulation helpers — pure functions.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers handle detection, resize computation, cursor mapping,
 * and minimum-size enforcement.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import {
  getHandlePositions,
  detectHandle,
  detectPointerTarget,
  getCursorForTarget,
  computeResize,
  getJettyHandlePosition,
  getPointHandlePositions,
  detectJettyHandle,
  isSelfLoopArrow,
  MIN_SIZE,
} from '../interaction/manipulationHelpers.js';
import type { HandleType, PointerTarget, JettyHandleHit } from '../interaction/manipulationHelpers.js';

// ── Test fixtures ──────────────────────────────────────────────

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
    meta: DEFAULT_META,
    data: { kind: 'rectangle' },
  };
}

/**
 * Create an arrow expression for testing jetty handle detection.
 *
 * Arrows must have `routing` set for jetty handles to appear.
 * Jetty handle position depends on anchor direction and jettySize.
 */
function makeArrow(
  id: string,
  points: [number, number][],
  opts?: {
    routing?: string;
    jettySize?: number | 'auto';
    startBinding?: { expressionId: string; anchor: string };
    endBinding?: { expressionId: string; anchor: string };
  },
): VisualExpression {
  const p0 = points[0] ?? [0, 0];
  const pN = points[points.length - 1] ?? p0;
  const minX = Math.min(p0[0], pN[0]);
  const minY = Math.min(p0[1], pN[1]);
  const maxX = Math.max(p0[0], pN[0]);
  const maxY = Math.max(p0[1], pN[1]);

  return {
    id,
    kind: 'arrow',
    position: { x: minX, y: minY },
    size: { width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: {
      kind: 'arrow',
      points,
      routing: opts?.routing ?? 'orthogonal',
      jettySize: opts?.jettySize,
      startBinding: opts?.startBinding
        ? { expressionId: opts.startBinding.expressionId, anchor: opts.startBinding.anchor }
        : undefined,
      endBinding: opts?.endBinding
        ? { expressionId: opts.endBinding.expressionId, anchor: opts.endBinding.anchor }
        : undefined,
    },
  };
}

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

// ── getHandlePositions ─────────────────────────────────────────

describe('getHandlePositions', () => {
  it('returns 8 handle positions in correct order', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const handles = getHandlePositions(expr);

    expect(handles).toHaveLength(8);
    expect(handles.map((h) => h.type)).toEqual([
      'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w',
    ]);
  });

  it('computes correct corner positions', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const handles = getHandlePositions(expr);

    // Corners
    expect(handles[0]).toEqual({ x: 100, y: 100, type: 'nw' }); // top-left
    expect(handles[1]).toEqual({ x: 300, y: 100, type: 'ne' }); // top-right
    expect(handles[2]).toEqual({ x: 300, y: 300, type: 'se' }); // bottom-right
    expect(handles[3]).toEqual({ x: 100, y: 300, type: 'sw' }); // bottom-left
  });

  it('computes correct edge midpoint positions', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const handles = getHandlePositions(expr);

    // Edge midpoints
    expect(handles[4]).toEqual({ x: 200, y: 100, type: 'n' }); // top-mid
    expect(handles[5]).toEqual({ x: 300, y: 200, type: 'e' }); // right-mid
    expect(handles[6]).toEqual({ x: 200, y: 300, type: 's' }); // bottom-mid
    expect(handles[7]).toEqual({ x: 100, y: 200, type: 'w' }); // left-mid
  });
});

// ── detectHandle ───────────────────────────────────────────────

describe('detectHandle', () => {
  it('detects a handle within tolerance', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);

    // Point at NW handle exactly
    const hit = detectHandle({ x: 100, y: 100 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(hit).toEqual({ type: 'nw', expressionId: 'a' });
  });

  it('detects handle within 8px tolerance', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);

    // 7px away from SE handle (300, 300) — within tolerance
    const hit = detectHandle({ x: 293, y: 293 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(hit).toEqual({ type: 'se', expressionId: 'a' });
  });

  it('returns null outside tolerance', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);

    // 10px away — outside 8px tolerance
    const hit = detectHandle({ x: 110, y: 110 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(hit).toBeNull();
  });

  it('scales tolerance by camera zoom', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);
    const zoomedCamera: Camera = { x: 0, y: 0, zoom: 2 };

    // 5 world units away = 10 screen pixels at zoom 2 → outside 8px tolerance
    const hit = detectHandle({ x: 105, y: 100 }, expressions, selectedIds, zoomedCamera);
    expect(hit).toBeNull();

    // 3 world units away = 6 screen pixels at zoom 2 → within tolerance
    const hit2 = detectHandle({ x: 103, y: 100 }, expressions, selectedIds, zoomedCamera);
    expect(hit2).toEqual({ type: 'nw', expressionId: 'a' });
  });

  it('ignores non-selected expressions', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set<string>(); // nothing selected

    const hit = detectHandle({ x: 100, y: 100 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(hit).toBeNull();
  });
});

// ── detectPointerTarget ────────────────────────────────────────

describe('detectPointerTarget', () => {
  it('detects handle target over body target', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);

    // Point at NW handle — also inside body
    const target = detectPointerTarget({ x: 100, y: 100 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(target.kind).toBe('handle');
  });

  it('detects body when inside selected shape but not on handle', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);

    // Center of shape — not near any handle
    const target = detectPointerTarget({ x: 200, y: 200 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(target).toEqual({ kind: 'body', expressionId: 'a' });
  });

  it('returns none when outside all shapes', () => {
    const expr = makeRect('a', 100, 100, 200, 200);
    const expressions = { a: expr };
    const selectedIds = new Set(['a']);

    const target = detectPointerTarget({ x: 50, y: 50 }, expressions, selectedIds, DEFAULT_CAMERA);
    expect(target).toEqual({ kind: 'none' });
  });
});

// ── getCursorForTarget ─────────────────────────────────────────

describe('getCursorForTarget [AC10]', () => {
  it('returns move cursor for body', () => {
    const target: PointerTarget = { kind: 'body', expressionId: 'a' };
    expect(getCursorForTarget(target)).toBe('move');
  });

  it('returns nwse-resize for NW corner', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'nw', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('nwse-resize');
  });

  it('returns nwse-resize for SE corner', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'se', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('nwse-resize');
  });

  it('returns nesw-resize for NE corner', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'ne', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('nesw-resize');
  });

  it('returns nesw-resize for SW corner', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'sw', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('nesw-resize');
  });

  it('returns ns-resize for N edge', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'n', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('ns-resize');
  });

  it('returns ns-resize for S edge', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 's', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('ns-resize');
  });

  it('returns ew-resize for E edge', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'e', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('ew-resize');
  });

  it('returns ew-resize for W edge', () => {
    const target: PointerTarget = { kind: 'handle', handle: { type: 'w', expressionId: 'a' } };
    expect(getCursorForTarget(target)).toBe('ew-resize');
  });

  it('returns default for no target', () => {
    const target: PointerTarget = { kind: 'none' };
    expect(getCursorForTarget(target)).toBe('default');
  });
});

// ── computeResize ──────────────────────────────────────────────

describe('computeResize [AC3, AC4, AC5]', () => {
  const original = {
    originalPosition: { x: 100, y: 100 },
    originalSize: { width: 200, height: 200 },
    shiftKey: false,
  };

  describe('corner resize (AC3)', () => {
    it('SE corner: increases size rightward/downward', () => {
      const result = computeResize({
        handleType: 'se',
        deltaX: 50,
        deltaY: 30,
        ...original,
      });

      expect(result.position).toEqual({ x: 100, y: 100 });
      expect(result.size).toEqual({ width: 250, height: 230 });
    });

    it('NW corner: increases size leftward/upward, moves position', () => {
      const result = computeResize({
        handleType: 'nw',
        deltaX: -50,
        deltaY: -30,
        ...original,
      });

      expect(result.position).toEqual({ x: 50, y: 70 });
      expect(result.size).toEqual({ width: 250, height: 230 });
    });

    it('NE corner: increases width rightward, increases height upward', () => {
      const result = computeResize({
        handleType: 'ne',
        deltaX: 50,
        deltaY: -30,
        ...original,
      });

      expect(result.position).toEqual({ x: 100, y: 70 });
      expect(result.size).toEqual({ width: 250, height: 230 });
    });

    it('SW corner: increases width leftward, increases height downward', () => {
      const result = computeResize({
        handleType: 'sw',
        deltaX: -50,
        deltaY: 30,
        ...original,
      });

      expect(result.position).toEqual({ x: 50, y: 100 });
      expect(result.size).toEqual({ width: 250, height: 230 });
    });
  });

  describe('edge resize (AC4)', () => {
    it('E edge: resizes width only', () => {
      const result = computeResize({
        handleType: 'e',
        deltaX: 50,
        deltaY: 999,
        ...original,
      });

      expect(result.position).toEqual({ x: 100, y: 100 });
      expect(result.size).toEqual({ width: 250, height: 200 });
    });

    it('W edge: resizes width only, moves position', () => {
      const result = computeResize({
        handleType: 'w',
        deltaX: -50,
        deltaY: 999,
        ...original,
      });

      expect(result.position).toEqual({ x: 50, y: 100 });
      expect(result.size).toEqual({ width: 250, height: 200 });
    });

    it('S edge: resizes height only', () => {
      const result = computeResize({
        handleType: 's',
        deltaX: 999,
        deltaY: 30,
        ...original,
      });

      expect(result.position).toEqual({ x: 100, y: 100 });
      expect(result.size).toEqual({ width: 200, height: 230 });
    });

    it('N edge: resizes height only, moves position', () => {
      const result = computeResize({
        handleType: 'n',
        deltaX: 999,
        deltaY: -30,
        ...original,
      });

      expect(result.position).toEqual({ x: 100, y: 70 });
      expect(result.size).toEqual({ width: 200, height: 230 });
    });
  });

  describe('minimum size (AC5)', () => {
    it('cannot resize below 10×10 on SE corner', () => {
      const result = computeResize({
        handleType: 'se',
        deltaX: -300,
        deltaY: -300,
        ...original,
      });

      expect(result.size.width).toBe(MIN_SIZE);
      expect(result.size.height).toBe(MIN_SIZE);
    });

    it('cannot resize below 10 width on E edge', () => {
      const result = computeResize({
        handleType: 'e',
        deltaX: -300,
        deltaY: 0,
        ...original,
      });

      expect(result.size.width).toBe(MIN_SIZE);
      expect(result.size.height).toBe(200); // Height unchanged
    });

    it('cannot resize below 10 height on S edge', () => {
      const result = computeResize({
        handleType: 's',
        deltaX: 0,
        deltaY: -300,
        ...original,
      });

      expect(result.size.width).toBe(200); // Width unchanged
      expect(result.size.height).toBe(MIN_SIZE);
    });

    it('adjusts position correctly when NW resize hits minimum', () => {
      const result = computeResize({
        handleType: 'nw',
        deltaX: 300,
        deltaY: 300,
        ...original,
      });

      // position.x = originalX + originalWidth - MIN_SIZE
      expect(result.position.x).toBe(100 + 200 - MIN_SIZE);
      expect(result.position.y).toBe(100 + 200 - MIN_SIZE);
      expect(result.size.width).toBe(MIN_SIZE);
      expect(result.size.height).toBe(MIN_SIZE);
    });
  });

  describe('aspect ratio constraint (Shift)', () => {
    it('constrains aspect ratio on SE corner with Shift', () => {
      const result = computeResize({
        handleType: 'se',
        deltaX: 100,
        deltaY: 20,
        originalPosition: { x: 100, y: 100 },
        originalSize: { width: 200, height: 100 }, // 2:1 ratio
        shiftKey: true,
      });

      // Width: 200+100=300, Height should be 300/2=150 to maintain 2:1
      expect(result.size.width / result.size.height).toBeCloseTo(2);
    });

    it('constrains aspect ratio on NW corner with Shift', () => {
      const result = computeResize({
        handleType: 'nw',
        deltaX: -100,
        deltaY: -20,
        originalPosition: { x: 100, y: 100 },
        originalSize: { width: 200, height: 100 }, // 2:1 ratio
        shiftKey: true,
      });

      expect(result.size.width / result.size.height).toBeCloseTo(2);
    });

    it('does not constrain aspect ratio on edge handles with Shift', () => {
      const result = computeResize({
        handleType: 'e',
        deltaX: 100,
        deltaY: 0,
        originalPosition: { x: 100, y: 100 },
        originalSize: { width: 200, height: 100 },
        shiftKey: true,
      });

      // Edge handles should NOT constrain — only width changes
      expect(result.size).toEqual({ width: 300, height: 100 });
    });
  });

  // ── Jetty handle detection ────────────────────────────────────

  describe('getJettyHandlePosition', () => {
    it('returns null for non-arrow expressions', () => {
      const rect = makeRect('r1', 100, 100, 200, 200);
      const result = getJettyHandlePosition(rect);
      expect(result).toBeNull();
    });

    it('returns null for arrows without routing', () => {
      const arrow = makeArrow('a1', [[100, 100], [300, 300]], { routing: undefined });
      // Overwrite routing to undefined (straight arrow)
      (arrow.data as Record<string, unknown>).routing = undefined;
      const result = getJettyHandlePosition(arrow);
      expect(result).toBeNull();
    });

    it('returns null for straight routing mode', () => {
      const arrow = makeArrow('a1', [[100, 100], [300, 300]], { routing: 'straight' });
      const result = getJettyHandlePosition(arrow);
      expect(result).toBeNull();
    });

    it('computes handle on Z-shape middle segment for right-anchored binding', () => {
      // Arrow starts at (100, 200), goes to (400, 200). Both on same y.
      // Binding anchor = 'right'. Default jettySize = 20, midpointOffset = 0.5.
      // exitStub = 120, entryStub = 380, midX = 250
      // Handle should be at (250, 200) — midpoint of middle segment.
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.position.x).toBeCloseTo(250, 0);
      expect(result!.position.y).toBeCloseTo(200, 0);
      expect(result!.direction).toEqual({ x: 1, y: 0 }); // drag horizontally
      expect(result!.end).toBe('start');
    });

    it('uses custom jettySize for Z-shape handle position', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        jettySize: 60,
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // exitStub = 100 + 60 = 160, entryStub = 400 - 60 = 340
      // midX = 160 + (340 - 160) * 0.5 = 250
      expect(result!.position.x).toBeCloseTo(250, 0);
      expect(result!.position.y).toBeCloseTo(200, 0);
    });

    it('computes handle on Z-shape middle segment for bottom-anchored binding (downward)', () => {
      const arrow = makeArrow('a1', [[200, 100], [200, 400]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'bottom' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // exitStub = 100 + 20 = 120, entryStub = 400 - 20 = 380
      // midY = 120 + (380 - 120) * 0.5 = 250
      expect(result!.position.x).toBeCloseTo(200, 0);
      expect(result!.position.y).toBeCloseTo(250, 0);
      expect(result!.direction).toEqual({ x: 0, y: 1 }); // drag vertically
    });

    it('infers direction from point delta when no binding', () => {
      // No binding — infer direction from start→end delta
      // Arrow goes from (100, 200) to (400, 200) — horizontal, so direction is right
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // Direction inferred: goes right
      expect(result!.direction.x).toBe(1);
      expect(result!.direction.y).toBe(0);
    });

    it('works with entityRelation routing mode', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'entityRelation',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.end).toBe('start');
    });

    it('works with orthogonalCurved routing mode', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonalCurved',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.end).toBe('start');
    });
  });

  describe('detectJettyHandle', () => {
    it('returns null when no selected arrows have routing', () => {
      const rect = makeRect('r1', 100, 100, 200, 200);
      const result = detectJettyHandle(
        { x: 110, y: 200 },
        { r1: rect },
        new Set(['r1']),
        DEFAULT_CAMERA,
      );
      expect(result).toBeNull();
    });

    it('detects click on jetty handle within tolerance', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      // Z-shape handle is at (250, 200). Click at (252, 201) — within 8px tolerance
      const result = detectJettyHandle(
        { x: 252, y: 201 },
        { a1: arrow },
        new Set(['a1']),
        DEFAULT_CAMERA,
      );
      expect(result).not.toBeNull();
      expect(result!.expressionId).toBe('a1');
      expect(result!.end).toBe('start');
    });

    it('returns null when click is outside tolerance', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      // Z-shape handle is at (250, 200). Click at (270, 200) — 20px away, outside tolerance
      const result = detectJettyHandle(
        { x: 270, y: 200 },
        { a1: arrow },
        new Set(['a1']),
        DEFAULT_CAMERA,
      );
      expect(result).toBeNull();
    });

    it('respects camera zoom for tolerance', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      // Z-shape handle at (250, 200). Click at (255, 200) — 5px away.
      // At zoom=2, tolerance = 8/2 = 4px — should miss.
      const zoomedCamera = { ...DEFAULT_CAMERA, zoom: 2 };
      const result = detectJettyHandle(
        { x: 255, y: 200 },
        { a1: arrow },
        new Set(['a1']),
        zoomedCamera,
      );
      expect(result).toBeNull();
    });

    it('only checks selected expressions', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      // Click on handle position (250, 200), but arrow is not selected
      const result = detectJettyHandle(
        { x: 250, y: 200 },
        { a1: arrow },
        new Set([]),
        DEFAULT_CAMERA,
      );
      expect(result).toBeNull();
    });
  });

  describe('detectPointerTarget with jetty handles', () => {
    it('detects jetty-handle target for routed arrows', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      // Z-shape handle is at (250, 200). Click there.
      const result = detectPointerTarget(
        { x: 250, y: 200 },
        { a1: arrow },
        new Set(['a1']),
        DEFAULT_CAMERA,
      );
      expect(result.kind).toBe('jetty-handle');
    });

    it('point-handles take priority over jetty-handles', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      // Click exactly on the start endpoint (100, 200) — point handle wins
      const result = detectPointerTarget(
        { x: 100, y: 200 },
        { a1: arrow },
        new Set(['a1']),
        DEFAULT_CAMERA,
      );
      expect(result.kind).toBe('point-handle');
    });
  });

  describe('getCursorForTarget with jetty-handle', () => {
    it('returns ew-resize for vertical segment (drag left/right)', () => {
      const target: PointerTarget = {
        kind: 'jetty-handle',
        handle: {
          expressionId: 'a1',
          end: 'start',
          position: { x: 110, y: 200 },
          direction: { x: 1, y: 0 },
          segmentOrientation: 'vertical',
        },
      };
      expect(getCursorForTarget(target)).toBe('ew-resize');
    });

    it('returns ns-resize for horizontal segment (drag up/down)', () => {
      const target: PointerTarget = {
        kind: 'jetty-handle',
        handle: {
          expressionId: 'a1',
          end: 'start',
          position: { x: 200, y: 110 },
          direction: { x: 0, y: 1 },
          segmentOrientation: 'horizontal',
        },
      };
      expect(getCursorForTarget(target)).toBe('ns-resize');
    });
  });

  // ── Issue 5: segmentOrientation on JettyHandleHit ────────────

  describe('getJettyHandlePosition — segmentOrientation', () => {
    it('sets segmentOrientation to vertical for horizontal flow Z-shape', () => {
      // Horizontal flow → vertical middle segment
      const arrow = makeArrow('a1', [[100, 200], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'left' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.segmentOrientation).toBe('vertical');
    });

    it('sets segmentOrientation to horizontal for vertical flow Z-shape', () => {
      // Vertical flow → horizontal middle segment
      const arrow = makeArrow('a1', [[100, 100], [300, 400]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'bottom' },
        endBinding: { expressionId: 'shape2', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.segmentOrientation).toBe('horizontal');
    });

    it('sets segmentOrientation for non-Z-shape exit stubs', () => {
      // L-shape: right exit → horizontal exit stub → handle is on horizontal segment
      const arrow = makeArrow('a1', [[100, 200], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.segmentOrientation).toBe('horizontal');
    });

    it('sets vertical segmentOrientation for vertical exit stubs', () => {
      // Exit from bottom → vertical exit stub
      const arrow = makeArrow('a1', [[200, 100], [300, 400]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'bottom' },
        endBinding: { expressionId: 'shape2', anchor: 'right' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.segmentOrientation).toBe('vertical');
    });
  });

  // ── midpointOffset-based handle positioning ──────────────────

  describe('getJettyHandlePosition — midpointOffset', () => {
    it('places handle on Z-shape middle segment for horizontal flow', () => {
      // Arrow exits right from (100, 200), enters left at (400, 300)
      // Default midpointOffset = 0.5, jettySize = 20
      // exitX = 120, entryX = 380, midX = 250
      // Handle should be at (250, 250) — midpoint of vertical middle segment
      const arrow = makeArrow('a1', [[100, 200], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'left' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.position.x).toBeCloseTo(250, 0);
      expect(result!.position.y).toBeCloseTo(250, 0);
      // Direction should be horizontal (ew-resize) — dragging moves the vertical bar
      expect(result!.direction).toEqual({ x: 1, y: 0 });
      // Segment orientation: vertical middle segment for horizontal flow
      expect(result!.segmentOrientation).toBe('vertical');
    });

    it('places handle on Z-shape middle segment for vertical flow', () => {
      // Arrow exits bottom from (100, 100), enters top at (300, 400)
      // Default midpointOffset = 0.5, jettySize = 20
      // exitY = 120, entryY = 380, midY = 250
      // Handle should be at (200, 250) — midpoint of horizontal middle segment
      const arrow = makeArrow('a1', [[100, 100], [300, 400]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'bottom' },
        endBinding: { expressionId: 'shape2', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.position.x).toBeCloseTo(200, 0);
      expect(result!.position.y).toBeCloseTo(250, 0);
      // Direction should be vertical (ns-resize) — dragging moves the horizontal bar
      expect(result!.direction).toEqual({ x: 0, y: 1 });
      // Segment orientation: horizontal middle segment for vertical flow
      expect(result!.segmentOrientation).toBe('horizontal');
    });

    it('uses custom midpointOffset for handle position', () => {
      // Arrow exits right from (100, 200), enters left at (400, 300)
      // midpointOffset = 0.25, jettySize = 20
      // exitX = 120, entryX = 380, midX = 120 + 260 * 0.25 = 185
      const arrow = makeArrow('a1', [[100, 200], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'left' },
      });
      (arrow.data as Record<string, unknown>).midpointOffset = 0.25;
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.position.x).toBeCloseTo(185, 0);
    });

    it('returns handle at exit stub midpoint for non-Z-shape routes', () => {
      // L-shape: right exit, top entry — no Z-shape middle segment
      // Falls back to exit stub midpoint behavior
      const arrow = makeArrow('a1', [[100, 200], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // Exit stub midpoint: (100 + 20/2, 200) = (110, 200)
      expect(result!.position.x).toBeCloseTo(110, 0);
      expect(result!.position.y).toBeCloseTo(200, 0);
    });
  });

  // ── isSelfLoopArrow helper ──────────────────────────────────

  describe('isSelfLoopArrow', () => {
    it('returns true when both bindings reference the same shape', () => {
      const arrow = makeArrow('a1', [[100, 100], [120, 80]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      expect(isSelfLoopArrow(arrow.data as { startBinding?: { expressionId: string }; endBinding?: { expressionId: string } })).toBe(true);
    });

    it('returns false when bindings reference different shapes', () => {
      const arrow = makeArrow('a1', [[100, 100], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'left' },
      });
      expect(isSelfLoopArrow(arrow.data as { startBinding?: { expressionId: string }; endBinding?: { expressionId: string } })).toBe(false);
    });

    it('returns false when no bindings exist', () => {
      const arrow = makeArrow('a1', [[100, 100], [400, 300]], {
        routing: 'orthogonal',
      });
      expect(isSelfLoopArrow(arrow.data as { startBinding?: { expressionId: string }; endBinding?: { expressionId: string } })).toBe(false);
    });

    it('returns false when only start binding exists', () => {
      const arrow = makeArrow('a1', [[100, 100], [400, 300]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
      });
      expect(isSelfLoopArrow(arrow.data as { startBinding?: { expressionId: string }; endBinding?: { expressionId: string } })).toBe(false);
    });
  });

  // ── Self-loop jetty handle ──────────────────────────────────

  describe('getJettyHandlePosition — self-loop', () => {
    it('returns a handle for a self-loop arrow with orthogonal routing', () => {
      // Self-loop: both bindings reference the same shape
      // Start at (200, 100) right edge, end at (150, 60) top edge of a shape at (100, 60, 100, 80)
      const arrow = makeArrow('a1', [[200, 100], [150, 60]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.expressionId).toBe('a1');
    });

    it('returns a handle for a self-loop arrow with elbow routing', () => {
      const arrow = makeArrow('a1', [[200, 100], [150, 60]], {
        routing: 'elbow',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.expressionId).toBe('a1');
    });

    it('places handle at midpoint of outer segment for horizontal self-loop', () => {
      // start right edge (200, 100), end top (150, 60) — midpoint of anchor
      // midX of points = (200+150)/2 = 175
      // shape center approx (150, 100) → dx = 175-150 = 25, dy = 80-100 = -20
      // |dx| >= |dy| → horizontal loop, extends right
      // outX = max(200, 150) + jetty (default 30 for self-loop in computeOrthogonalSelfLoopPoints)
      // loopPoints = [start, [outX, start.y], [outX, end.y], end]
      // Outer segment: from [outX, start.y] to [outX, end.y] — vertical segment
      // Handle midpoint: (outX, (start.y + end.y)/2)
      const arrow = makeArrow('a1', [[200, 100], [150, 60]], {
        routing: 'orthogonal',
        jettySize: 30,
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // Outer segment is vertical → orientation is vertical
      expect(result!.segmentOrientation).toBe('vertical');
    });

    it('uses jettySize from arrow data for self-loop handle position', () => {
      const arrow = makeArrow('a1', [[200, 100], [150, 60]], {
        routing: 'orthogonal',
        jettySize: 50,
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // With larger jetty, handle should be farther from shape
    });

    it('sets direction for dragging perpendicular to outer segment', () => {
      const arrow = makeArrow('a1', [[200, 100], [150, 60]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      // Direction should be non-zero (usable for drag)
      const dirLen = Math.hypot(result!.direction.x, result!.direction.y);
      expect(dirLen).toBeCloseTo(1, 5);
    });
  });

  // ── Elbow routing in JETTY_ROUTING_MODES ──────────────────────

  describe('getJettyHandlePosition — elbow routing', () => {
    it('returns a handle for non-self-loop elbow arrows', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'elbow',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'left' },
      });
      const result = getJettyHandlePosition(arrow);
      expect(result).not.toBeNull();
      expect(result!.expressionId).toBe('a1');
    });
  });

  // ── getPointHandlePositions — self-loop suppression ──────────

  describe('getPointHandlePositions — self-loop', () => {
    it('returns empty array for self-loop arrows', () => {
      const arrow = makeArrow('a1', [[200, 100], [150, 60]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape1', anchor: 'top' },
      });
      const result = getPointHandlePositions(arrow);
      expect(result).toEqual([]);
    });

    it('returns handles for non-self-loop arrows', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
        startBinding: { expressionId: 'shape1', anchor: 'right' },
        endBinding: { expressionId: 'shape2', anchor: 'left' },
      });
      const result = getPointHandlePositions(arrow);
      expect(result.length).toBe(2);
    });

    it('returns handles for unbound arrows', () => {
      const arrow = makeArrow('a1', [[100, 200], [400, 200]], {
        routing: 'orthogonal',
      });
      const result = getPointHandlePositions(arrow);
      expect(result.length).toBe(2);
    });
  });
});
