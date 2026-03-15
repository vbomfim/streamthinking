/**
 * Unit tests for useSelectionInteraction hook.
 *
 * Covers: click select, click deselect, shift+click toggle,
 * marquee selection, drag threshold, and tool gating.
 *
 * @vitest-environment jsdom
 * @module
 */

import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { useSelectionInteraction } from '../hooks/useSelectionInteraction.js';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction.js';
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

/** Reset store to clean state before each test. */
function resetStore() {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
  });
}

/**
 * Set up store with test expressions.
 * Expression 'a' at (100, 100) 200×200
 * Expression 'b' at (400, 400) 100×100
 */
function setupExpressions() {
  const a = makeRect('a', 100, 100, 200, 200);
  const b = makeRect('b', 400, 400, 100, 100);
  useCanvasStore.setState({
    expressions: { a, b },
    expressionOrder: ['a', 'b'],
  });
}

/**
 * Wrapper component that renders a canvas and wires up both
 * canvas interaction and selection interaction hooks.
 */
function TestCanvas() {
  const { canvasRef, cursor } = useCanvasInteraction();
  useSelectionInteraction(canvasRef);
  return (
    <canvas
      ref={canvasRef}
      data-testid="canvas"
      data-cursor={cursor}
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
    ...opts,
  } as PointerEventInit);

  // PointerEvent doesn't support offsetX/offsetY in constructor
  // We need to override these readonly properties
  Object.defineProperty(event, 'offsetX', { value: opts.offsetX });
  Object.defineProperty(event, 'offsetY', { value: opts.offsetY });

  canvas.dispatchEvent(event);
}

// ── Tests ────────────────────────────────────────────────────

describe('useSelectionInteraction — click select', () => {
  beforeEach(() => {
    resetStore();
    setupExpressions();
  });

  afterEach(() => {
    cleanup();
  });

  it('selects an expression when clicked', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Click on expression 'a' (center at 200, 200)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 200 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(true);
    expect(selectedIds.size).toBe(1);
  });

  it('deselects when clicking empty space', () => {
    // Pre-select 'a'
    useCanvasStore.setState({ selectedIds: new Set(['a']) });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Click on empty space (0, 0) — no expression there
      firePointerEvent(canvas, 'pointerdown', { offsetX: 10, offsetY: 10 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 10, offsetY: 10 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.size).toBe(0);
  });

  it('selects different expression when clicking it', () => {
    useCanvasStore.setState({ selectedIds: new Set(['a']) });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Click on expression 'b' (center at 450, 450)
      firePointerEvent(canvas, 'pointerdown', { offsetX: 450, offsetY: 450 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 450, offsetY: 450 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('b')).toBe(true);
    expect(selectedIds.has('a')).toBe(false);
    expect(selectedIds.size).toBe(1);
  });
});

describe('useSelectionInteraction — shift+click', () => {
  beforeEach(() => {
    resetStore();
    setupExpressions();
  });

  afterEach(() => {
    cleanup();
  });

  it('adds to selection with shift+click', () => {
    useCanvasStore.setState({ selectedIds: new Set(['a']) });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Shift+click on 'b'
      firePointerEvent(canvas, 'pointerdown', { offsetX: 450, offsetY: 450, shiftKey: true });
      firePointerEvent(canvas, 'pointerup', { offsetX: 450, offsetY: 450, shiftKey: true });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(true);
    expect(selectedIds.has('b')).toBe(true);
    expect(selectedIds.size).toBe(2);
  });

  it('removes from selection with shift+click on already selected', () => {
    useCanvasStore.setState({ selectedIds: new Set(['a', 'b']) });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Shift+click on 'a' (already selected) → should remove it
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200, shiftKey: true });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 200, shiftKey: true });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(false);
    expect(selectedIds.has('b')).toBe(true);
    expect(selectedIds.size).toBe(1);
  });

  it('does not deselect when shift+clicking empty space', () => {
    useCanvasStore.setState({ selectedIds: new Set(['a']) });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 10, offsetY: 10, shiftKey: true });
      firePointerEvent(canvas, 'pointerup', { offsetX: 10, offsetY: 10, shiftKey: true });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(true);
    expect(selectedIds.size).toBe(1);
  });
});

describe('useSelectionInteraction — marquee selection', () => {
  beforeEach(() => {
    resetStore();
    setupExpressions();
  });

  afterEach(() => {
    cleanup();
  });

  it('selects expressions within marquee drag area', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Drag from (50, 50) to (350, 350) — should capture 'a' but not 'b'
      firePointerEvent(canvas, 'pointerdown', { offsetX: 50, offsetY: 50 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 350, offsetY: 350 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 350, offsetY: 350 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(true);
    expect(selectedIds.has('b')).toBe(false);
  });

  it('selects multiple expressions within marquee', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Drag from (50, 50) to (550, 550) — should capture both 'a' and 'b'
      firePointerEvent(canvas, 'pointerdown', { offsetX: 50, offsetY: 50 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 550, offsetY: 550 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 550, offsetY: 550 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(true);
    expect(selectedIds.has('b')).toBe(true);
  });

  it('drag < 5px diagonal is treated as a click', () => {
    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      // Small drag (2px) on expression 'a' — should be treated as click
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointermove', { offsetX: 201, offsetY: 201 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 201, offsetY: 201 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has('a')).toBe(true);
    expect(selectedIds.size).toBe(1);
  });
});

describe('useSelectionInteraction — tool gating', () => {
  beforeEach(() => {
    resetStore();
    setupExpressions();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not select when tool is not select', () => {
    useCanvasStore.setState({ activeTool: 'rectangle' });

    const { getByTestId } = render(<TestCanvas />);
    const canvas = getByTestId('canvas');

    act(() => {
      firePointerEvent(canvas, 'pointerdown', { offsetX: 200, offsetY: 200 });
      firePointerEvent(canvas, 'pointerup', { offsetX: 200, offsetY: 200 });
    });

    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.size).toBe(0);
  });
});
