/**
 * Unit tests for useManipulationInteraction hook.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: move single/multi, resize corner/edge, resize minimum,
 * delete, duplicate, locked guard, move preview, cursor feedback.
 *
 * @vitest-environment jsdom
 * @module
 */

import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { useManipulationInteraction } from '../hooks/useManipulationInteraction.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useCanvasStore } from '../store/canvasStore.js';
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

function makeRect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  locked = false,
): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META, locked },
    data: { kind: 'rectangle' },
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

/**
 * Set up store with test expressions.
 * Expression 'a' at (100, 100) 200×200 — selected
 * Expression 'b' at (400, 400) 100×100 — not selected
 */
function setupSingleSelected() {
  const a = makeRect('a', 100, 100, 200, 200);
  const b = makeRect('b', 400, 400, 100, 100);
  useCanvasStore.setState({
    expressions: { a, b },
    expressionOrder: ['a', 'b'],
    selectedIds: new Set(['a']),
  });
}

/**
 * Set up store with two selected expressions for multi-move tests.
 * Expression 'a' at (100, 100) 200×200 — selected
 * Expression 'b' at (400, 400) 100×100 — selected
 */
function setupMultiSelected() {
  const a = makeRect('a', 100, 100, 200, 200);
  const b = makeRect('b', 400, 400, 100, 100);
  useCanvasStore.setState({
    expressions: { a, b },
    expressionOrder: ['a', 'b'],
    selectedIds: new Set(['a', 'b']),
  });
}

/**
 * Wrapper component that renders a canvas and wires up hooks.
 */
let lastManipulationCursor = 'default';

function TestCanvas() {
  const { canvasRef, cursor: canvasCursor } = useCanvasInteraction();
  const { cursor: manipulationCursor } = useManipulationInteraction(canvasRef);
  // Keyboard shortcuts (delete, duplicate) are now centralized
  useKeyboardShortcuts({ cancelDraw: () => {} });
  lastManipulationCursor = manipulationCursor;
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas"
      data-cursor={manipulationCursor}
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

/** Fire a keyboard event on window. */
function fireKeydown(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
  });
  window.dispatchEvent(event);
}

// ── Tests ────────────────────────────────────────────────────

describe('useManipulationInteraction — Move single (AC1)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('moves a single selected shape on drag', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Start drag at center of shape 'a' (200, 200)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      // Move 50px right, 30px down
      firePointerEvent(canvas, 'pointermove', { offsetX: 250, offsetY: 230 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 250, offsetY: 230 });
    });

    const state = useCanvasStore.getState();
    const expr = state.expressions['a'];
    expect(expr?.position).toEqual({ x: 150, y: 130 });
  });

  it('emits move operations on pointerup', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 250, offsetY: 230 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 250, offsetY: 230 });
    });

    const state = useCanvasStore.getState();
    const moveOps = state.operationLog.filter((op) => op.type === 'move');
    expect(moveOps).toHaveLength(1);
    expect(moveOps[0]?.payload).toMatchObject({
      type: 'move',
      expressionId: 'a',
      from: { x: 100, y: 100 },
      to: { x: 150, y: 130 },
    });
  });

  it('does not emit operation if shape did not move (click without drag)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 200 });
    });

    const state = useCanvasStore.getState();
    const moveOps = state.operationLog.filter((op) => op.type === 'move');
    expect(moveOps).toHaveLength(0);
  });
});

describe('useManipulationInteraction — Move multi (AC2)', () => {
  beforeEach(() => {
    resetStore();
    setupMultiSelected();
  });

  afterEach(cleanup);

  it('moves all selected shapes maintaining relative positions', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    // Original relative offset: b is at (400-100, 400-100) = (300, 300) from a
    act(() => {
      // Start drag at center of 'a' (200, 200)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 260, offsetY: 240 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 260, offsetY: 240 });
    });

    const state = useCanvasStore.getState();
    const a = state.expressions['a'];
    const b = state.expressions['b'];

    // Both should move by +60, +40
    expect(a?.position).toEqual({ x: 160, y: 140 });
    expect(b?.position).toEqual({ x: 460, y: 440 });

    // Relative positions preserved
    expect(b!.position.x - a!.position.x).toBe(300);
    expect(b!.position.y - a!.position.y).toBe(300);
  });

  it('emits move operations for each selected shape', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 260, offsetY: 240 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 260, offsetY: 240 });
    });

    const state = useCanvasStore.getState();
    const moveOps = state.operationLog.filter((op) => op.type === 'move');
    expect(moveOps).toHaveLength(2);

    const movedIds = moveOps.map((op) => (op.payload as { expressionId: string }).expressionId);
    expect(movedIds).toContain('a');
    expect(movedIds).toContain('b');
  });
});

describe('useManipulationInteraction — Resize corner (AC3)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('resizes from SE corner handle', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // SE handle is at (300, 300). Camera zoom=1, so screen=world
      firePointerEvent(canvas, 'pointerdown', { offsetX: 300, offsetY: 300 });
      // Drag 50px right, 30px down
      firePointerEvent(canvas, 'pointermove', { offsetX: 350, offsetY: 330 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 350, offsetY: 330 });
    });

    const state = useCanvasStore.getState();
    const expr = state.expressions['a'];
    expect(expr?.size).toEqual({ width: 250, height: 230 });
    expect(expr?.position).toEqual({ x: 100, y: 100 }); // Position unchanged for SE
  });

  it('emits transform operation on pointerup', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 300, offsetY: 300 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 350, offsetY: 330 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 350, offsetY: 330 });
    });

    const state = useCanvasStore.getState();
    const transformOps = state.operationLog.filter((op) => op.type === 'transform');
    expect(transformOps).toHaveLength(1);
    expect(transformOps[0]?.payload).toMatchObject({
      type: 'transform',
      expressionId: 'a',
      size: { width: 250, height: 230 },
    });
  });

  it('constrains aspect ratio with shift key', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // SE handle at (300, 300)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 300, offsetY: 300 });
      // Drag asymmetrically with shift
      firePointerEvent(canvas, 'pointermove', { offsetX: 400, offsetY: 320, shiftKey: true });
      firePointerEvent(canvas, 'pointerup', { offsetX: 400, offsetY: 320, shiftKey: true });
    });

    const state = useCanvasStore.getState();
    const expr = state.expressions['a'];
    // Original aspect ratio was 1:1 (200x200)
    // With shift, should maintain 1:1
    expect(expr?.size.width).toBe(expr?.size.height);
  });
});

describe('useManipulationInteraction — Resize edge (AC4)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('resizes width only from E edge handle', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // E handle is at (300, 200) — right edge midpoint
      firePointerEvent(canvas, 'pointerdown', { offsetX: 300, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 350, offsetY: 250 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 350, offsetY: 250 });
    });

    const state = useCanvasStore.getState();
    const expr = state.expressions['a'];
    expect(expr?.size.width).toBe(250);
    expect(expr?.size.height).toBe(200); // Height unchanged
  });

  it('resizes height only from S edge handle', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // S handle is at (200, 300) — bottom edge midpoint
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 300 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 250, offsetY: 350 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 250, offsetY: 350 });
    });

    const state = useCanvasStore.getState();
    const expr = state.expressions['a'];
    expect(expr?.size.width).toBe(200); // Width unchanged
    expect(expr?.size.height).toBe(250);
  });
});

describe('useManipulationInteraction — Resize minimum (AC5)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('cannot resize below 10×10', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // SE handle at (300, 300) — drag far inward
      firePointerEvent(canvas, 'pointerdown', { offsetX: 300, offsetY: 300 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 50, offsetY: 50 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 50, offsetY: 50 });
    });

    const state = useCanvasStore.getState();
    const expr = state.expressions['a'];
    expect(expr?.size.width).toBeGreaterThanOrEqual(10);
    expect(expr?.size.height).toBeGreaterThanOrEqual(10);
  });
});

describe('useManipulationInteraction — Delete (AC6)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('deletes all selected on Delete key', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('Delete');
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['a']).toBeUndefined();
    expect(state.expressionOrder).not.toContain('a');
    // Shape 'b' should still exist
    expect(state.expressions['b']).toBeDefined();
  });

  it('deletes all selected on Backspace key', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('Backspace');
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['a']).toBeUndefined();
  });

  it('emits delete operation', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('Delete');
    });

    const state = useCanvasStore.getState();
    const deleteOps = state.operationLog.filter((op) => op.type === 'delete');
    expect(deleteOps).toHaveLength(1);
    expect(deleteOps[0]?.payload).toMatchObject({
      type: 'delete',
      expressionIds: ['a'],
    });
  });

  it('clears selection after delete', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('Delete');
    });

    const state = useCanvasStore.getState();
    expect(state.selectedIds.size).toBe(0);
  });

  it('does not delete when no tool is select', () => {
    useCanvasStore.setState({ activeTool: 'rectangle' });
    render(<TestCanvas />);

    act(() => {
      fireKeydown('Delete');
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['a']).toBeDefined();
  });
});

describe('useManipulationInteraction — Duplicate (AC7)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('duplicates selected with offset +20,+20', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('d', { ctrlKey: true });
    });

    const state = useCanvasStore.getState();
    // Original plus duplicate
    const ids = Object.keys(state.expressions);
    expect(ids.length).toBe(3); // a, b, + duplicate

    // Find the duplicate (not 'a' or 'b')
    const duplicateId = ids.find((id) => id !== 'a' && id !== 'b')!;
    const duplicate = state.expressions[duplicateId]!;

    expect(duplicate.position).toEqual({ x: 120, y: 120 }); // +20, +20
    expect(duplicate.size).toEqual({ width: 200, height: 200 });
    expect(duplicate.kind).toBe('rectangle');
  });

  it('generates new IDs for duplicates', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('d', { ctrlKey: true });
    });

    const state = useCanvasStore.getState();
    const ids = Object.keys(state.expressions);
    const newIds = ids.filter((id) => id !== 'a' && id !== 'b');
    expect(newIds).toHaveLength(1);
    expect(newIds[0]).not.toBe('a');
  });

  it('selects the new duplicates', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('d', { ctrlKey: true });
    });

    const state = useCanvasStore.getState();
    // The new selection should contain only the duplicated shape(s)
    expect(state.selectedIds.size).toBe(1);
    expect(state.selectedIds.has('a')).toBe(false);
  });

  it('emits create operation per copy', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('d', { ctrlKey: true });
    });

    const state = useCanvasStore.getState();
    const createOps = state.operationLog.filter((op) => op.type === 'create');
    expect(createOps).toHaveLength(1);
    expect(createOps[0]?.payload).toMatchObject({
      type: 'create',
      kind: 'rectangle',
    });
  });

  it('works with Cmd+D on Mac', () => {
    render(<TestCanvas />);

    act(() => {
      fireKeydown('d', { metaKey: true });
    });

    const state = useCanvasStore.getState();
    const ids = Object.keys(state.expressions);
    expect(ids.length).toBe(3);
  });
});

describe('useManipulationInteraction — Locked shapes (AC8)', () => {
  afterEach(cleanup);

  it('does not move locked shapes', () => {
    resetStore();
    const lockedExpr = makeRect('locked', 100, 100, 200, 200, true);
    useCanvasStore.setState({
      expressions: { locked: lockedExpr },
      expressionOrder: ['locked'],
      selectedIds: new Set(['locked']),
    });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 260, offsetY: 240 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 260, offsetY: 240 });
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['locked']?.position).toEqual({ x: 100, y: 100 });
  });

  it('does not resize locked shapes', () => {
    resetStore();
    const lockedExpr = makeRect('locked', 100, 100, 200, 200, true);
    useCanvasStore.setState({
      expressions: { locked: lockedExpr },
      expressionOrder: ['locked'],
      selectedIds: new Set(['locked']),
    });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // SE handle at (300, 300)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 300, offsetY: 300 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 350, offsetY: 350 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 350, offsetY: 350 });
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['locked']?.size).toEqual({ width: 200, height: 200 });
  });

  it('does not delete locked shapes', () => {
    resetStore();
    const lockedExpr = makeRect('locked', 100, 100, 200, 200, true);
    useCanvasStore.setState({
      expressions: { locked: lockedExpr },
      expressionOrder: ['locked'],
      selectedIds: new Set(['locked']),
    });

    render(<TestCanvas />);

    act(() => {
      fireKeydown('Delete');
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['locked']).toBeDefined();
  });
});

describe('useManipulationInteraction — Move preview (AC9)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('shapes move in real-time during drag (positions update during pointermove)', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 250, offsetY: 230 });
    });

    // Position should already be updated during drag (for real-time preview)
    const state = useCanvasStore.getState();
    expect(state.expressions['a']?.position).toEqual({ x: 150, y: 130 });

    // But no move operations emitted yet
    const moveOps = state.operationLog.filter((op) => op.type === 'move');
    expect(moveOps).toHaveLength(0);

    // Clean up drag state
    act(() => {
      firePointerEvent(canvas, 'pointerup', { offsetX: 250, offsetY: 230 });
    });
  });

  it('commits position and emits operation only on pointerup', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 250, offsetY: 230 });
    });

    // No operations yet
    expect(useCanvasStore.getState().operationLog.filter((op) => op.type === 'move')).toHaveLength(0);

    act(() => {
      firePointerEvent(canvas, 'pointerup', { offsetX: 250, offsetY: 230 });
    });

    // Now move operation should be emitted
    const moveOps = useCanvasStore.getState().operationLog.filter((op) => op.type === 'move');
    expect(moveOps).toHaveLength(1);
  });
});

describe('useManipulationInteraction — Cursor feedback (AC10)', () => {
  beforeEach(() => {
    resetStore();
    setupSingleSelected();
  });

  afterEach(cleanup);

  it('shows move cursor when hovering selected body', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Hover over center of selected shape 'a'
      firePointerEvent(canvas, 'pointermove', { offsetX: 200, offsetY: 200 });
    });

    expect(canvas.getAttribute('data-cursor')).toBe('move');
  });

  it('shows nwse-resize when hovering SE corner handle', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // SE handle at (300, 300)
      firePointerEvent(canvas, 'pointermove', { offsetX: 300, offsetY: 300 });
    });

    expect(canvas.getAttribute('data-cursor')).toBe('nwse-resize');
  });

  it('shows default cursor outside shapes', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointermove', { offsetX: 50, offsetY: 50 });
    });

    expect(canvas.getAttribute('data-cursor')).toBe('default');
  });
});
