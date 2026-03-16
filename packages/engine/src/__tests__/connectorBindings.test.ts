/**
 * Unit tests for arrow connector bindings.
 *
 * Tests the ArrowTool snap/bind behavior, canvasStore bound arrow
 * updates on move/transform/delete, and binding data integrity.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';
import { ArrowTool } from '../tools/ArrowTool.js';
import type { VisualExpression, ArrowData } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

function stubPointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return { pressure: 0.5, ...overrides } as PointerEvent;
}

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

function makeRectExpression(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): VisualExpression {
  const now = Date.now();
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human', id: 'test', name: 'Test' },
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle', label: 'Test' },
  };
}

function makeEllipseExpression(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): VisualExpression {
  const now = Date.now();
  return {
    id,
    kind: 'ellipse',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: { type: 'human', id: 'test', name: 'Test' },
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data: { kind: 'ellipse', label: 'Test' },
  };
}

function getExpressionById(id: string): VisualExpression | undefined {
  return useCanvasStore.getState().expressions[id];
}

function getAllArrows(): VisualExpression[] {
  const { expressions } = useCanvasStore.getState();
  return Object.values(expressions).filter((e) => e.kind === 'arrow');
}

function getArrowData(expr: VisualExpression): ArrowData {
  return expr.data as ArrowData;
}

// ── ArrowTool binding tests ──────────────────────────────────

describe('ArrowTool — snap binding', () => {
  let tool: ArrowTool;

  beforeEach(() => {
    resetStore();
    tool = new ArrowTool();
  });

  it('creates a binding when arrow starts on a shape edge', () => {
    // Add a rectangle at (100, 100) size (200, 100)
    // Right edge center: (300, 150)
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    // Draw arrow starting at right edge of rect → far away
    tool.onPointerDown(300, 150, stubPointerEvent());
    tool.onPointerMove(500, 300, stubPointerEvent());
    tool.onPointerUp(500, 300, stubPointerEvent());

    const arrows = getAllArrows();
    expect(arrows.length).toBe(1);
    const data = getArrowData(arrows[0]!);
    expect(data.startBinding).toBeDefined();
    expect(data.startBinding!.expressionId).toBe('rect1');
    expect(data.startBinding!.anchor).toBe('right');
  });

  it('creates a binding when arrow ends on a shape edge', () => {
    const rect = makeRectExpression('rect1', 400, 100, 200, 100);
    // Left edge center: (400, 150)
    useCanvasStore.getState().addExpression(rect);

    // Draw arrow from far away → ending at left edge of rect
    tool.onPointerDown(100, 150, stubPointerEvent());
    tool.onPointerMove(400, 150, stubPointerEvent());
    tool.onPointerUp(400, 150, stubPointerEvent());

    const arrows = getAllArrows();
    expect(arrows.length).toBe(1);
    const data = getArrowData(arrows[0]!);
    expect(data.endBinding).toBeDefined();
    expect(data.endBinding!.expressionId).toBe('rect1');
    expect(data.endBinding!.anchor).toBe('left');
  });

  it('creates bindings on both ends when drawing between two shapes', () => {
    const rect1 = makeRectExpression('rect1', 100, 100, 200, 100);
    const rect2 = makeRectExpression('rect2', 500, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect1);
    useCanvasStore.getState().addExpression(rect2);

    // Draw from right edge of rect1 (300, 150) to left edge of rect2 (500, 150)
    tool.onPointerDown(300, 150, stubPointerEvent());
    tool.onPointerMove(500, 150, stubPointerEvent());
    tool.onPointerUp(500, 150, stubPointerEvent());

    const arrows = getAllArrows();
    expect(arrows.length).toBe(1);
    const data = getArrowData(arrows[0]!);
    expect(data.startBinding).toBeDefined();
    expect(data.startBinding!.expressionId).toBe('rect1');
    expect(data.endBinding).toBeDefined();
    expect(data.endBinding!.expressionId).toBe('rect2');
  });

  it('does not create binding when arrow start is far from any shape', () => {
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    // Draw arrow far from any shape
    tool.onPointerDown(500, 500, stubPointerEvent());
    tool.onPointerMove(700, 700, stubPointerEvent());
    tool.onPointerUp(700, 700, stubPointerEvent());

    const arrows = getAllArrows();
    expect(arrows.length).toBe(1);
    const data = getArrowData(arrows[0]!);
    expect(data.startBinding).toBeUndefined();
    expect(data.endBinding).toBeUndefined();
  });

  it('snaps start point to the anchor position when binding', () => {
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    // Start near right edge but not exactly on it: (295, 155)
    // Right edge center is (300, 150)
    tool.onPointerDown(295, 155, stubPointerEvent());
    tool.onPointerMove(600, 400, stubPointerEvent());
    tool.onPointerUp(600, 400, stubPointerEvent());

    const arrows = getAllArrows();
    const data = getArrowData(arrows[0]!);
    expect(data.startBinding).toBeDefined();
    // The start point should be snapped to the anchor position
    expect(data.points[0]).toEqual([300, 150]);
  });

  it('snaps end point to the anchor position when binding', () => {
    const rect = makeRectExpression('rect1', 400, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    // End near left edge but not exactly: (405, 155)
    // Left edge center is (400, 150)
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(405, 155, stubPointerEvent());
    tool.onPointerUp(405, 155, stubPointerEvent());

    const arrows = getAllArrows();
    const data = getArrowData(arrows[0]!);
    expect(data.endBinding).toBeDefined();
    // The end point should be snapped to the anchor position
    expect(data.points[data.points.length - 1]).toEqual([400, 150]);
  });

  it('does not bind arrow to itself', () => {
    // This test verifies that binding only targets shapes, not arrows
    // Arrows are non-bindable by kind check
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(200, 200, stubPointerEvent());
    tool.onPointerUp(200, 200, stubPointerEvent());

    const arrows = getAllArrows();
    expect(arrows.length).toBe(1);
    const data = getArrowData(arrows[0]!);
    expect(data.startBinding).toBeUndefined();
    expect(data.endBinding).toBeUndefined();
  });

  it('preserves existing arrow behavior when no shapes are nearby', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(300, 200, stubPointerEvent());
    tool.onPointerUp(300, 200, stubPointerEvent());

    const arrows = getAllArrows();
    expect(arrows.length).toBe(1);
    const data = getArrowData(arrows[0]!);
    expect(data.endArrowhead).toBe(true);
    expect(data.startBinding).toBeUndefined();
    expect(data.endBinding).toBeUndefined();
    expect(data.points.length).toBe(2);
  });

  it('provides snap preview info during drawing', () => {
    const rect = makeRectExpression('rect1', 400, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    tool.onPointerDown(100, 100, stubPointerEvent());
    // Move near left edge of rect (400, 150)
    tool.onPointerMove(405, 155, stubPointerEvent());

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    // Preview should have snap info
    expect(preview!.snapPoint).toBeDefined();
    expect(preview!.snapPoint!.x).toBe(400);
    expect(preview!.snapPoint!.y).toBe(150);
    expect(preview!.snapTargetId).toBe('rect1');
  });

  it('clears snap preview when endpoint moves away from shape', () => {
    const rect = makeRectExpression('rect1', 400, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(405, 155, stubPointerEvent()); // near rect
    tool.onPointerMove(250, 250, stubPointerEvent()); // far away

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.snapPoint).toBeUndefined();
    expect(preview!.snapTargetId).toBeUndefined();
  });
});

// ── Canvas store — bound arrow updates ───────────────────────

describe('canvasStore — bound arrow updates', () => {
  beforeEach(() => {
    resetStore();
  });

  it('updates arrow endpoint when bound shape is moved', () => {
    // Setup: rect1 at (100,100) size (200,100), arrow bound to right edge (300, 150)
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    const now = Date.now();
    const arrow: VisualExpression = {
      id: 'arrow1',
      kind: 'arrow',
      position: { x: 300, y: 150 },
      size: { width: 200, height: 150 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'test', name: 'Test' },
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points: [[300, 150], [500, 300]] as [number, number][],
        endArrowhead: true,
        startBinding: { expressionId: 'rect1', anchor: 'right' as const },
      },
    };
    useCanvasStore.getState().addExpression(arrow);

    // Move rect1 by (50, 50) → new right edge center: (350, 200)
    useCanvasStore.getState().moveExpressions([
      { id: 'rect1', from: { x: 100, y: 100 }, to: { x: 150, y: 150 } },
    ]);

    const updatedArrow = getExpressionById('arrow1')!;
    const data = getArrowData(updatedArrow);
    // Start point should follow to new anchor position (350, 200)
    expect(data.points[0]).toEqual([350, 200]);
    // End point should remain unchanged
    expect(data.points[1]).toEqual([500, 300]);
  });

  it('updates arrow both endpoints when both bound shapes move', () => {
    const rect1 = makeRectExpression('rect1', 100, 100, 100, 100);
    const rect2 = makeRectExpression('rect2', 400, 100, 100, 100);
    useCanvasStore.getState().addExpression(rect1);
    useCanvasStore.getState().addExpression(rect2);

    const now = Date.now();
    const arrow: VisualExpression = {
      id: 'arrow1',
      kind: 'arrow',
      position: { x: 200, y: 150 },
      size: { width: 200, height: 1 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'test', name: 'Test' },
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points: [[200, 150], [400, 150]] as [number, number][],
        endArrowhead: true,
        startBinding: { expressionId: 'rect1', anchor: 'right' as const },
        endBinding: { expressionId: 'rect2', anchor: 'left' as const },
      },
    };
    useCanvasStore.getState().addExpression(arrow);

    // Move both rects down by 100
    useCanvasStore.getState().moveExpressions([
      { id: 'rect1', from: { x: 100, y: 100 }, to: { x: 100, y: 200 } },
      { id: 'rect2', from: { x: 400, y: 100 }, to: { x: 400, y: 200 } },
    ]);

    const updatedArrow = getExpressionById('arrow1')!;
    const data = getArrowData(updatedArrow);
    // Start: right edge of rect1 at (100,200) size (100,100) → (200, 250)
    expect(data.points[0]).toEqual([200, 250]);
    // End: left edge of rect2 at (400,200) size (100,100) → (400, 250)
    expect(data.points[1]).toEqual([400, 250]);
  });

  it('updates arrow endpoint when bound shape is resized', () => {
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    const now = Date.now();
    const arrow: VisualExpression = {
      id: 'arrow1',
      kind: 'arrow',
      position: { x: 300, y: 150 },
      size: { width: 200, height: 150 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'test', name: 'Test' },
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points: [[300, 150], [500, 300]] as [number, number][],
        endArrowhead: true,
        startBinding: { expressionId: 'rect1', anchor: 'right' as const },
      },
    };
    useCanvasStore.getState().addExpression(arrow);

    // Resize rect1: position stays same, width doubles to 400
    useCanvasStore.getState().transformExpression(
      'rect1',
      { position: { x: 100, y: 100 }, size: { width: 200, height: 100 } },
      { position: { x: 100, y: 100 }, size: { width: 400, height: 100 } },
    );

    const updatedArrow = getExpressionById('arrow1')!;
    const data = getArrowData(updatedArrow);
    // Right edge of resized rect: x(100) + width(400) = 500, cy = 150
    expect(data.points[0]).toEqual([500, 150]);
  });

  it('clears binding when bound shape is deleted', () => {
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    const now = Date.now();
    const arrow: VisualExpression = {
      id: 'arrow1',
      kind: 'arrow',
      position: { x: 300, y: 150 },
      size: { width: 200, height: 150 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'test', name: 'Test' },
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points: [[300, 150], [500, 300]] as [number, number][],
        endArrowhead: true,
        startBinding: { expressionId: 'rect1', anchor: 'right' as const },
      },
    };
    useCanvasStore.getState().addExpression(arrow);

    // Delete rect1
    useCanvasStore.getState().deleteExpressions(['rect1']);

    const updatedArrow = getExpressionById('arrow1')!;
    const data = getArrowData(updatedArrow);
    // Binding should be cleared
    expect(data.startBinding).toBeUndefined();
    // Arrow still exists with its endpoint preserved
    expect(data.points[0]).toEqual([300, 150]);
    expect(data.points.length).toBe(2);
  });

  it('preserves arrow position when bound shape is deleted', () => {
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    const now = Date.now();
    const arrow: VisualExpression = {
      id: 'arrow1',
      kind: 'arrow',
      position: { x: 200, y: 100 },
      size: { width: 200, height: 200 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'test', name: 'Test' },
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points: [[200, 100], [400, 300]] as [number, number][],
        endArrowhead: true,
        startBinding: { expressionId: 'rect1', anchor: 'top' as const },
        endBinding: { expressionId: 'rect1', anchor: 'bottom' as const },
      },
    };
    useCanvasStore.getState().addExpression(arrow);

    // Delete rect1 — arrow should survive
    useCanvasStore.getState().deleteExpressions(['rect1']);

    const updatedArrow = getExpressionById('arrow1');
    expect(updatedArrow).toBeDefined();
    const data = getArrowData(updatedArrow!);
    expect(data.startBinding).toBeUndefined();
    expect(data.endBinding).toBeUndefined();
  });

  it('does not update unbound arrows when a shape moves', () => {
    const rect = makeRectExpression('rect1', 100, 100, 200, 100);
    useCanvasStore.getState().addExpression(rect);

    const now = Date.now();
    // Free-standing arrow (no bindings)
    const arrow: VisualExpression = {
      id: 'arrow1',
      kind: 'arrow',
      position: { x: 0, y: 0 },
      size: { width: 50, height: 50 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: {
        author: { type: 'human', id: 'test', name: 'Test' },
        createdAt: now,
        updatedAt: now,
        tags: [],
        locked: false,
      },
      data: {
        kind: 'arrow',
        points: [[0, 0], [50, 50]] as [number, number][],
        endArrowhead: true,
      },
    };
    useCanvasStore.getState().addExpression(arrow);

    // Move the rect
    useCanvasStore.getState().moveExpressions([
      { id: 'rect1', from: { x: 100, y: 100 }, to: { x: 200, y: 200 } },
    ]);

    // Arrow should be completely unchanged (its points don't move)
    const updatedArrow = getExpressionById('arrow1')!;
    const data = getArrowData(updatedArrow);
    expect(data.points[0]).toEqual([0, 0]);
    expect(data.points[1]).toEqual([50, 50]);
  });
});
