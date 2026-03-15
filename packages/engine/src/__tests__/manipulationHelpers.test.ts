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
  MIN_SIZE,
} from '../interaction/manipulationHelpers.js';
import type { HandleType, PointerTarget } from '../interaction/manipulationHelpers.js';

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
});
