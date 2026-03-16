/**
 * Unit tests for point-based handle detection and dragging.
 *
 * Lines, arrows, and freehand shapes use `data.points` for geometry.
 * These tests verify:
 * - Point handle positions are computed from data.points
 * - Point handles are detected within tolerance
 * - Point drag computes new points and bounding box
 * - Type guard identifies point-based expression kinds
 * - Freehand shows handles at first and last point only
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import type { Camera } from '../types/index.js';
import {
  isPointBasedKind,
  getPointHandlePositions,
  detectPointHandle,
  computePointDrag,
  detectPointerTarget,
  getCursorForTarget,
} from '../interaction/manipulationHelpers.js';
import type { PointHandleHit } from '../interaction/manipulationHelpers.js';

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

const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

/** Create a line expression with given points. */
function makeLine(
  id: string,
  points: [number, number][],
): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id,
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
function makeArrow(
  id: string,
  points: [number, number][],
): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id,
    kind: 'arrow',
    position: { x: minX, y: minY },
    size: { width: maxX - minX || 1, height: maxY - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'arrow', points, endArrowhead: true },
  };
}

/** Create a freehand expression with given points (including pressure). */
function makeFreehand(
  id: string,
  points: [number, number, number][],
): VisualExpression {
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id,
    kind: 'freehand',
    position: { x: minX, y: minY },
    size: { width: maxX - minX || 1, height: maxY - minY || 1 },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: DEFAULT_META,
    data: { kind: 'freehand', points },
  };
}

function makeRect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): VisualExpression {
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

// ── isPointBasedKind ───────────────────────────────────────────

describe('isPointBasedKind', () => {
  it('returns true for line', () => {
    expect(isPointBasedKind('line')).toBe(true);
  });

  it('returns true for arrow', () => {
    expect(isPointBasedKind('arrow')).toBe(true);
  });

  it('returns true for freehand', () => {
    expect(isPointBasedKind('freehand')).toBe(true);
  });

  it('returns false for rectangle', () => {
    expect(isPointBasedKind('rectangle')).toBe(false);
  });

  it('returns false for ellipse', () => {
    expect(isPointBasedKind('ellipse')).toBe(false);
  });

  it('returns false for text', () => {
    expect(isPointBasedKind('text')).toBe(false);
  });
});

// ── getPointHandlePositions ────────────────────────────────────

describe('getPointHandlePositions', () => {
  it('returns handles at each point for a line', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const handles = getPointHandlePositions(line);

    expect(handles).toHaveLength(2);
    expect(handles[0]).toEqual({ x: 100, y: 100, pointIndex: 0 });
    expect(handles[1]).toEqual({ x: 300, y: 200, pointIndex: 1 });
  });

  it('returns handles at each point for an arrow', () => {
    const arrow = makeArrow('a1', [[50, 50], [200, 100], [350, 50]]);
    const handles = getPointHandlePositions(arrow);

    expect(handles).toHaveLength(3);
    expect(handles[0]).toEqual({ x: 50, y: 50, pointIndex: 0 });
    expect(handles[1]).toEqual({ x: 200, y: 100, pointIndex: 1 });
    expect(handles[2]).toEqual({ x: 350, y: 50, pointIndex: 2 });
  });

  it('returns handles at first and last point only for freehand', () => {
    const freehand = makeFreehand('f1', [
      [10, 10, 0.5],
      [20, 15, 0.6],
      [30, 20, 0.7],
      [40, 25, 0.8],
      [50, 30, 0.5],
    ]);
    const handles = getPointHandlePositions(freehand);

    // Only first and last point for freehand
    expect(handles).toHaveLength(2);
    expect(handles[0]).toEqual({ x: 10, y: 10, pointIndex: 0 });
    expect(handles[1]).toEqual({ x: 50, y: 30, pointIndex: 4 });
  });

  it('returns empty array for non-point-based expression', () => {
    const rect = makeRect('r1', 100, 100, 200, 200);
    const handles = getPointHandlePositions(rect);

    expect(handles).toHaveLength(0);
  });

  it('returns handles for a single-point freehand', () => {
    const freehand = makeFreehand('f1', [[10, 10, 0.5]]);
    const handles = getPointHandlePositions(freehand);

    // Single point → 1 handle (first === last)
    expect(handles).toHaveLength(1);
    expect(handles[0]).toEqual({ x: 10, y: 10, pointIndex: 0 });
  });
});

// ── detectPointHandle ──────────────────────────────────────────

describe('detectPointHandle', () => {
  it('detects a point handle at exact position', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);

    const hit = detectPointHandle(
      { x: 100, y: 100 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(hit).toEqual({ pointIndex: 0, expressionId: 'l1' });
  });

  it('detects a point handle within 8px tolerance', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);

    // 7px away from endpoint (300,200)
    const hit = detectPointHandle(
      { x: 293, y: 200 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(hit).toEqual({ pointIndex: 1, expressionId: 'l1' });
  });

  it('returns null outside tolerance', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);

    // 10px away — outside 8px tolerance
    const hit = detectPointHandle(
      { x: 110, y: 110 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(hit).toBeNull();
  });

  it('scales tolerance by camera zoom', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);
    const zoomedCamera: Camera = { x: 0, y: 0, zoom: 2 };

    // 5 world units away = 10 screen pixels at zoom 2 → outside 8px tolerance
    const hit = detectPointHandle(
      { x: 105, y: 100 },
      expressions,
      selectedIds,
      zoomedCamera,
    );
    expect(hit).toBeNull();

    // 3 world units away = 6 screen pixels at zoom 2 → within tolerance
    const hit2 = detectPointHandle(
      { x: 103, y: 100 },
      expressions,
      selectedIds,
      zoomedCamera,
    );
    expect(hit2).toEqual({ pointIndex: 0, expressionId: 'l1' });
  });

  it('returns null for non-point-based expressions', () => {
    const rect = makeRect('r1', 100, 100, 200, 200);
    const expressions = { r1: rect };
    const selectedIds = new Set(['r1']);

    const hit = detectPointHandle(
      { x: 100, y: 100 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(hit).toBeNull();
  });

  it('ignores non-selected expressions', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set<string>();

    const hit = detectPointHandle(
      { x: 100, y: 100 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(hit).toBeNull();
  });

  it('detects handles for arrow expressions', () => {
    const arrow = makeArrow('a1', [[50, 50], [250, 150]]);
    const expressions = { a1: arrow };
    const selectedIds = new Set(['a1']);

    const hit = detectPointHandle(
      { x: 250, y: 150 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(hit).toEqual({ pointIndex: 1, expressionId: 'a1' });
  });

  it('detects only first/last handles for freehand', () => {
    const freehand = makeFreehand('f1', [
      [10, 10, 0.5],
      [20, 15, 0.6],
      [30, 20, 0.7],
      [40, 25, 0.8],
      [50, 30, 0.5],
    ]);
    const expressions = { f1: freehand };
    const selectedIds = new Set(['f1']);

    // Click on first point — should hit
    const hit1 = detectPointHandle(
      { x: 10, y: 10 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );
    expect(hit1).toEqual({ pointIndex: 0, expressionId: 'f1' });

    // Click on last point — should hit
    const hit2 = detectPointHandle(
      { x: 50, y: 30 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );
    expect(hit2).toEqual({ pointIndex: 4, expressionId: 'f1' });

    // Click on middle point — should NOT hit (freehand only shows first/last)
    const hit3 = detectPointHandle(
      { x: 30, y: 20 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );
    expect(hit3).toBeNull();
  });
});

// ── computePointDrag ───────────────────────────────────────────

describe('computePointDrag', () => {
  it('moves a single endpoint and recalculates bounding box', () => {
    const result = computePointDrag({
      pointIndex: 1,
      originalPoints: [[100, 100], [300, 200]],
      newPointPosition: { x: 400, y: 50 },
    });

    expect(result.points[0]).toEqual([100, 100]);
    expect(result.points[1]).toEqual([400, 50]);
    expect(result.position).toEqual({ x: 100, y: 50 });
    expect(result.size).toEqual({ width: 300, height: 50 });
  });

  it('moves the first endpoint of a line', () => {
    const result = computePointDrag({
      pointIndex: 0,
      originalPoints: [[100, 100], [300, 200]],
      newPointPosition: { x: 50, y: 250 },
    });

    expect(result.points[0]).toEqual([50, 250]);
    expect(result.points[1]).toEqual([300, 200]);
    expect(result.position).toEqual({ x: 50, y: 200 });
    expect(result.size).toEqual({ width: 250, height: 50 });
  });

  it('recalculates bounding box for multi-segment line', () => {
    const result = computePointDrag({
      pointIndex: 1,
      originalPoints: [[0, 0], [100, 100], [200, 0]],
      newPointPosition: { x: 100, y: 200 },
    });

    expect(result.points).toEqual([[0, 0], [100, 200], [200, 0]]);
    expect(result.position).toEqual({ x: 0, y: 0 });
    expect(result.size).toEqual({ width: 200, height: 200 });
  });

  it('handles horizontal line (zero height → minimum 1)', () => {
    const result = computePointDrag({
      pointIndex: 1,
      originalPoints: [[100, 100], [300, 100]],
      newPointPosition: { x: 400, y: 100 },
    });

    expect(result.points).toEqual([[100, 100], [400, 100]]);
    expect(result.position).toEqual({ x: 100, y: 100 });
    // Height is 0, but minimum bounding box dimension is 1
    expect(result.size).toEqual({ width: 300, height: 1 });
  });

  it('handles vertical line (zero width → minimum 1)', () => {
    const result = computePointDrag({
      pointIndex: 1,
      originalPoints: [[100, 100], [100, 300]],
      newPointPosition: { x: 100, y: 400 },
    });

    expect(result.points).toEqual([[100, 100], [100, 400]]);
    expect(result.position).toEqual({ x: 100, y: 100 });
    expect(result.size).toEqual({ width: 1, height: 300 });
  });

  it('preserves other points when dragging one', () => {
    const original: [number, number][] = [[0, 0], [50, 50], [100, 0], [150, 50]];
    const result = computePointDrag({
      pointIndex: 2,
      originalPoints: original,
      newPointPosition: { x: 120, y: -20 },
    });

    expect(result.points[0]).toEqual([0, 0]);
    expect(result.points[1]).toEqual([50, 50]);
    expect(result.points[2]).toEqual([120, -20]);
    expect(result.points[3]).toEqual([150, 50]);
  });

  it('does not mutate original points array', () => {
    const original: [number, number][] = [[100, 100], [300, 200]];
    const originalCopy = original.map(p => [...p]);

    computePointDrag({
      pointIndex: 1,
      originalPoints: original,
      newPointPosition: { x: 400, y: 50 },
    });

    // Original should not be modified
    expect(original).toEqual(originalCopy);
  });
});

// ── detectPointerTarget with point-based shapes ────────────────

describe('detectPointerTarget with point-based shapes', () => {
  it('detects point handle over body for line', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);

    const target = detectPointerTarget(
      { x: 100, y: 100 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(target.kind).toBe('point-handle');
    if (target.kind === 'point-handle') {
      expect(target.handle.pointIndex).toBe(0);
      expect(target.handle.expressionId).toBe('l1');
    }
  });

  it('detects body when inside line bounding box but not on point handle', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);

    // Inside bounding box but not near any endpoint
    const target = detectPointerTarget(
      { x: 200, y: 150 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(target.kind).toBe('body');
  });

  it('does not return bbox handle for line (uses point handles instead)', () => {
    const line = makeLine('l1', [[100, 100], [300, 200]]);
    const expressions = { l1: line };
    const selectedIds = new Set(['l1']);

    // At bounding-box NW corner (same as first point) — should be point-handle, not handle
    const target = detectPointerTarget(
      { x: 100, y: 100 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(target.kind).toBe('point-handle');
  });

  it('still returns bbox handle for rectangles', () => {
    const rect = makeRect('r1', 100, 100, 200, 200);
    const expressions = { r1: rect };
    const selectedIds = new Set(['r1']);

    const target = detectPointerTarget(
      { x: 100, y: 100 },
      expressions,
      selectedIds,
      DEFAULT_CAMERA,
    );

    expect(target.kind).toBe('handle');
  });
});

// ── getCursorForTarget with point handles ──────────────────────

describe('getCursorForTarget with point handles', () => {
  it('returns crosshair cursor for point handle', () => {
    const target = {
      kind: 'point-handle' as const,
      handle: { pointIndex: 0, expressionId: 'l1' },
    };
    expect(getCursorForTarget(target)).toBe('crosshair');
  });
});
