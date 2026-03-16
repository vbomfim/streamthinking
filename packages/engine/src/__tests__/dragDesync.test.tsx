/**
 * Unit tests for drag desync fix — issue #74.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * Bug: Dragging a selected shape sometimes moves the selection bounding
 * box but not the actual expression. Root cause: point-based shapes
 * (line, arrow, freehand) render from `data.points` (absolute world
 * coordinates) while the selection renderer reads `expr.position`.
 * During drag, only `position` is updated → desync.
 *
 * Covers:
 * - Renderer position offset for point-based shapes
 * - Store translates data.points on move commit
 * - Full drag cycle for point-based shapes
 * - Edge cases: zero-length points, single-point, etc.
 *
 * @vitest-environment jsdom
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';
import { useManipulationInteraction } from '../hooks/useManipulationInteraction.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useCanvasStore } from '../store/canvasStore.js';
import { computePositionOffset } from '../renderer/primitiveRenderer.js';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';

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

function makeLine(
  id: string,
  points: [number, number][],
): VisualExpression {
  const { position, size } = computeBBox(points);
  return {
    id,
    kind: 'line',
    position,
    size,
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'line', points },
  };
}

function makeArrow(
  id: string,
  points: [number, number][],
): VisualExpression {
  const { position, size } = computeBBox(points);
  return {
    id,
    kind: 'arrow',
    position,
    size,
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
    data: { kind: 'arrow', points, startArrowhead: false, endArrowhead: true },
  };
}

function makeFreehand(
  id: string,
  points: [number, number, number][],
): VisualExpression {
  const points2D: [number, number][] = points.map(([x, y]) => [x, y]);
  const { position, size } = computeBBox(points2D);
  return {
    id,
    kind: 'freehand',
    position,
    size,
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META },
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
    meta: { ...DEFAULT_META },
    data: { kind: 'rectangle' },
  };
}

/** Compute bounding box from 2D points. */
function computeBBox(points: [number, number][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of points) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return {
    position: { x: minX, y: minY },
    size: { width: maxX - minX, height: maxY - minY },
  };
}

/** Reset store to clean state before each test. */
function resetStore() {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
  });
  useCanvasStore.getState().clearHistory();
}

/** Test canvas component wiring hooks. */
function TestCanvas() {
  const { canvasRef } = useCanvasInteraction();
  useManipulationInteraction(canvasRef);
  useKeyboardShortcuts({ cancelDraw: () => {} });
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas"
      width={800}
      height={600}
    />
  );
}

/** Fire a pointer event on the canvas element. */
function firePointerEvent(
  canvas: HTMLElement,
  type: string,
  opts: { offsetX: number; offsetY: number; shiftKey?: boolean },
) {
  const event = new PointerEvent(type, {
    bubbles: true,
    button: 0,
    shiftKey: opts.shiftKey ?? false,
  } as PointerEventInit);
  Object.defineProperty(event, 'offsetX', { value: opts.offsetX });
  Object.defineProperty(event, 'offsetY', { value: opts.offsetY });
  canvas.dispatchEvent(event);
}

// ── Tests: computePositionOffset ─────────────────────────────

describe('computePositionOffset — position offset for point-based shapes', () => {
  it('returns zero offset when position matches bounding box min (initial state)', () => {
    const line = makeLine('l1', [[10, 20], [50, 60]]);
    // position is (10, 20), bbox min is (10, 20) → offset = (0, 0)
    const offset = computePositionOffset(line);
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it('returns non-zero offset when position diverges from points bbox', () => {
    const line = makeLine('l1', [[10, 20], [50, 60]]);
    // Simulate a drag that moved position but not data.points
    line.position = { x: 30, y: 40 };
    const offset = computePositionOffset(line);
    expect(offset).toEqual({ x: 20, y: 20 });
  });

  it('returns zero offset for non-point-based shapes (rectangle)', () => {
    const rect = makeRect('r1', 100, 100, 200, 200);
    const offset = computePositionOffset(rect);
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it('returns zero offset for non-point-based shapes (ellipse)', () => {
    const ellipse: VisualExpression = {
      id: 'e1',
      kind: 'ellipse',
      position: { x: 100, y: 100 },
      size: { width: 200, height: 200 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: { ...DEFAULT_META },
      data: { kind: 'ellipse' },
    };
    const offset = computePositionOffset(ellipse);
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it('handles arrow shapes correctly', () => {
    const arrow = makeArrow('a1', [[0, 0], [100, 100]]);
    arrow.position = { x: 50, y: 50 };
    const offset = computePositionOffset(arrow);
    expect(offset).toEqual({ x: 50, y: 50 });
  });

  it('handles freehand shapes correctly', () => {
    const freehand = makeFreehand('f1', [[10, 10, 0.5], [20, 20, 0.5], [30, 15, 0.5]]);
    freehand.position = { x: 20, y: 20 };
    const offset = computePositionOffset(freehand);
    expect(offset).toEqual({ x: 10, y: 10 });
  });

  it('handles empty points array gracefully', () => {
    const line: VisualExpression = {
      id: 'l-empty',
      kind: 'line',
      position: { x: 50, y: 50 },
      size: { width: 0, height: 0 },
      angle: 0,
      style: DEFAULT_STYLE,
      meta: { ...DEFAULT_META },
      data: { kind: 'line', points: [] },
    };
    const offset = computePositionOffset(line);
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it('handles single-point array', () => {
    const line = makeLine('l1', [[10, 20]]);
    line.position = { x: 30, y: 40 };
    const offset = computePositionOffset(line);
    expect(offset).toEqual({ x: 20, y: 20 });
  });
});

// ── Tests: moveExpressions translates data.points ────────────

describe('moveExpressions — translates data.points for point-based shapes', () => {
  beforeEach(resetStore);

  it('translates line points by move delta on commit', () => {
    const line = makeLine('l1', [[10, 20], [50, 60]]);
    useCanvasStore.setState({
      expressions: { l1: line },
      expressionOrder: ['l1'],
      selectedIds: new Set(['l1']),
    });

    useCanvasStore.getState().moveExpressions([
      { id: 'l1', from: { x: 10, y: 20 }, to: { x: 30, y: 40 } },
    ]);

    const expr = useCanvasStore.getState().expressions['l1']!;
    expect(expr.position).toEqual({ x: 30, y: 40 });

    // Points should be translated by (+20, +20)
    const data = expr.data as { kind: 'line'; points: [number, number][] };
    expect(data.points).toEqual([[30, 40], [70, 80]]);
  });

  it('translates arrow points by move delta on commit', () => {
    const arrow = makeArrow('a1', [[0, 0], [100, 100]]);
    useCanvasStore.setState({
      expressions: { a1: arrow },
      expressionOrder: ['a1'],
      selectedIds: new Set(['a1']),
    });

    useCanvasStore.getState().moveExpressions([
      { id: 'a1', from: { x: 0, y: 0 }, to: { x: 50, y: 50 } },
    ]);

    const expr = useCanvasStore.getState().expressions['a1']!;
    const data = expr.data as { kind: 'arrow'; points: [number, number][] };
    expect(data.points).toEqual([[50, 50], [150, 150]]);
  });

  it('translates freehand points by move delta on commit', () => {
    const freehand = makeFreehand('f1', [[10, 10, 0.5], [20, 20, 0.5], [30, 15, 0.5]]);
    useCanvasStore.setState({
      expressions: { f1: freehand },
      expressionOrder: ['f1'],
      selectedIds: new Set(['f1']),
    });

    useCanvasStore.getState().moveExpressions([
      { id: 'f1', from: { x: 10, y: 10 }, to: { x: 50, y: 50 } },
    ]);

    const expr = useCanvasStore.getState().expressions['f1']!;
    const data = expr.data as { kind: 'freehand'; points: [number, number, number][] };
    // Points translated by (+40, +40), pressure preserved
    expect(data.points).toEqual([[50, 50, 0.5], [60, 60, 0.5], [70, 55, 0.5]]);
  });

  it('does not modify data.points for rectangle (non-point-based)', () => {
    const rect = makeRect('r1', 100, 100, 200, 200);
    useCanvasStore.setState({
      expressions: { r1: rect },
      expressionOrder: ['r1'],
      selectedIds: new Set(['r1']),
    });

    useCanvasStore.getState().moveExpressions([
      { id: 'r1', from: { x: 100, y: 100 }, to: { x: 150, y: 150 } },
    ]);

    const expr = useCanvasStore.getState().expressions['r1']!;
    expect(expr.position).toEqual({ x: 150, y: 150 });
    expect(expr.data).toEqual({ kind: 'rectangle' });
  });

  it('handles multi-move with mixed shape types', () => {
    const rect = makeRect('r1', 100, 100, 200, 200);
    const line = makeLine('l1', [[10, 20], [50, 60]]);
    useCanvasStore.setState({
      expressions: { r1: rect, l1: line },
      expressionOrder: ['r1', 'l1'],
      selectedIds: new Set(['r1', 'l1']),
    });

    useCanvasStore.getState().moveExpressions([
      { id: 'r1', from: { x: 100, y: 100 }, to: { x: 120, y: 120 } },
      { id: 'l1', from: { x: 10, y: 20 }, to: { x: 30, y: 40 } },
    ]);

    // Rectangle: position updated, data unchanged
    const r = useCanvasStore.getState().expressions['r1']!;
    expect(r.position).toEqual({ x: 120, y: 120 });
    expect(r.data).toEqual({ kind: 'rectangle' });

    // Line: position AND points updated
    const l = useCanvasStore.getState().expressions['l1']!;
    expect(l.position).toEqual({ x: 30, y: 40 });
    const lData = l.data as { kind: 'line'; points: [number, number][] };
    expect(lData.points).toEqual([[30, 40], [70, 80]]);
  });

  it('preserves undo snapshot with original points', () => {
    const line = makeLine('l1', [[10, 20], [50, 60]]);
    useCanvasStore.setState({
      expressions: { l1: line },
      expressionOrder: ['l1'],
      selectedIds: new Set(['l1']),
    });

    useCanvasStore.getState().moveExpressions([
      { id: 'l1', from: { x: 10, y: 20 }, to: { x: 30, y: 40 } },
    ]);

    // Points are translated after commit
    const after = useCanvasStore.getState().expressions['l1']!;
    expect((after.data as { points: [number, number][] }).points).toEqual([[30, 40], [70, 80]]);

    // Undo should restore original points
    useCanvasStore.getState().undo();
    const restored = useCanvasStore.getState().expressions['l1']!;
    expect(restored.position).toEqual({ x: 10, y: 20 });
    expect((restored.data as { points: [number, number][] }).points).toEqual([[10, 20], [50, 60]]);
  });
});

// ── Tests: Full drag cycle for point-based shapes ────────────

describe('Drag cycle — line shape stays in sync with selection (#74)', () => {
  beforeEach(() => {
    resetStore();
    // Line from (100, 100) to (200, 200)
    // Position = (100, 100), size = (100, 100)
    const line = makeLine('l1', [[100, 100], [200, 200]]);
    useCanvasStore.setState({
      expressions: { l1: line },
      expressionOrder: ['l1'],
      selectedIds: new Set(['l1']),
    });
  });

  afterEach(cleanup);

  it('transient drag updates position (selection follows pointer)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Click inside the line's bounding box (150, 150)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 150, offsetY: 150 });
      // Move 50px right, 30px down
      firePointerEvent(canvas, 'pointermove', { offsetX: 200, offsetY: 180 });
    });

    // Position should update for selection rendering
    const state = useCanvasStore.getState();
    expect(state.expressions['l1']?.position).toEqual({ x: 150, y: 130 });

    // No operations emitted during drag
    const moveOps = state.operationLog.filter((op) => op.type === 'move');
    expect(moveOps).toHaveLength(0);

    // Clean up
    act(() => {
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 180 });
    });
  });

  it('on pointerup, both position and data.points are committed', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 150, offsetY: 150 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 200, offsetY: 180 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 180 });
    });

    const expr = useCanvasStore.getState().expressions['l1']!;
    // Position moved by (50, 30)
    expect(expr.position).toEqual({ x: 150, y: 130 });
    // Points also translated by (50, 30)
    const data = expr.data as { kind: 'line'; points: [number, number][] };
    expect(data.points).toEqual([[150, 130], [250, 230]]);
  });

  it('position offset is zero after commit (position matches points bbox)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 150, offsetY: 150 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 200, offsetY: 180 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 180 });
    });

    const expr = useCanvasStore.getState().expressions['l1']!;
    const offset = computePositionOffset(expr);
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it('during transient drag, computePositionOffset returns the drag delta', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 150, offsetY: 150 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 200, offsetY: 180 });
    });

    const expr = useCanvasStore.getState().expressions['l1']!;
    // Position moved to (150, 130), points still at original [(100,100),(200,200)]
    // bbox min of points = (100, 100)
    // offset = (150 - 100, 130 - 100) = (50, 30)
    const offset = computePositionOffset(expr);
    expect(offset).toEqual({ x: 50, y: 30 });

    // Clean up
    act(() => {
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 180 });
    });
  });
});

describe('Drag cycle — arrow shape stays in sync with selection (#74)', () => {
  beforeEach(() => {
    resetStore();
    const arrow = makeArrow('a1', [[100, 100], [200, 200]]);
    useCanvasStore.setState({
      expressions: { a1: arrow },
      expressionOrder: ['a1'],
      selectedIds: new Set(['a1']),
    });
  });

  afterEach(cleanup);

  it('commits both position and points on pointerup', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 150, offsetY: 150 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 200, offsetY: 180 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 180 });
    });

    const expr = useCanvasStore.getState().expressions['a1']!;
    expect(expr.position).toEqual({ x: 150, y: 130 });
    const data = expr.data as { kind: 'arrow'; points: [number, number][] };
    expect(data.points).toEqual([[150, 130], [250, 230]]);
  });
});

describe('Drag cycle — freehand shape stays in sync with selection (#74)', () => {
  beforeEach(() => {
    resetStore();
    // Use a larger freehand bounding box so click doesn't hit a resize handle.
    // Bounding box: (100,100)-(300,300) — handles are well separated.
    const freehand = makeFreehand('f1', [
      [100, 100, 0.5],
      [200, 200, 0.6],
      [300, 300, 0.5],
    ]);
    useCanvasStore.setState({
      expressions: { f1: freehand },
      expressionOrder: ['f1'],
      selectedIds: new Set(['f1']),
    });
  });

  afterEach(cleanup);

  it('commits both position and points on pointerup, preserving pressure', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Click well inside the body — away from all handles (200, 200 is center)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 220, offsetY: 220 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 220, offsetY: 220 });
    });

    const expr = useCanvasStore.getState().expressions['f1']!;
    // Moved by (20, 20)
    expect(expr.position).toEqual({ x: 120, y: 120 });
    const data = expr.data as { kind: 'freehand'; points: [number, number, number][] };
    // All points translated by (20, 20), pressure preserved
    expect(data.points).toEqual([
      [120, 120, 0.5],
      [220, 220, 0.6],
      [320, 320, 0.5],
    ]);
  });
});
