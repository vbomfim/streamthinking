/**
 * Unit tests for drawing tool handlers.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test corresponds to acceptance criteria from Issue #6.
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';
import { RectangleTool } from '../tools/RectangleTool.js';
import { EllipseTool } from '../tools/EllipseTool.js';
import { DiamondTool } from '../tools/DiamondTool.js';
import { LineTool } from '../tools/LineTool.js';
import { ArrowTool } from '../tools/ArrowTool.js';
import { FreehandTool } from '../tools/FreehandTool.js';
import { TextTool } from '../tools/TextTool.js';
import type { ToolHandler, DrawPreview } from '../tools/BaseTool.js';

// ── Test helpers ───────────────────────────────────────────

/** Stub PointerEvent for testing (jsdom doesn't fully support it). */
function stubPointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return { pressure: 0.5, ...overrides } as PointerEvent;
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

/** Simulate a full draw gesture: pointerdown → pointermove → pointerup */
function simulateDraw(
  tool: ToolHandler,
  start: { x: number; y: number },
  end: { x: number; y: number },
  ev?: Partial<PointerEvent>,
) {
  tool.onPointerDown(start.x, start.y, stubPointerEvent(ev));
  tool.onPointerMove(end.x, end.y, stubPointerEvent(ev));
  tool.onPointerUp(end.x, end.y, stubPointerEvent(ev));
}

/** Get the number of expressions in the store. */
function expressionCount(): number {
  return Object.keys(useCanvasStore.getState().expressions).length;
}

/** Get the first expression from the store. */
function firstExpression() {
  const exprs = useCanvasStore.getState().expressions;
  const id = useCanvasStore.getState().expressionOrder[0];
  return id ? exprs[id] : undefined;
}

// ── RectangleTool ────────────────────────────────────────────

describe('RectangleTool', () => {
  let tool: RectangleTool;

  beforeEach(() => {
    resetStore();
    tool = new RectangleTool();
  });

  it('creates a rectangle expression on valid draw (>10×10) [AC1]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('rectangle');
    expect(expr.data.kind).toBe('rectangle');
    expect(expr.position.x).toBe(100);
    expect(expr.position.y).toBe(100);
    expect(expr.size.width).toBe(100);
    expect(expr.size.height).toBe(100);
  });

  it('does not create expression when draw is too small (<10×10) [AC2]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 105, y: 105 });
    expect(expressionCount()).toBe(0);
  });

  it('shows dashed preview during drag [AC4]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    expect(tool.getPreview()).toBeNull();

    tool.onPointerMove(200, 200, stubPointerEvent());
    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.kind).toBe('rectangle');
    expect(preview!.x).toBe(100);
    expect(preview!.y).toBe(100);
    expect(preview!.width).toBe(100);
    expect(preview!.height).toBe(100);
  });

  it('handles negative drag direction (bottom-right to top-left)', () => {
    simulateDraw(tool, { x: 200, y: 200 }, { x: 100, y: 100 });

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.position.x).toBe(100);
    expect(expr.position.y).toBe(100);
    expect(expr.size.width).toBe(100);
    expect(expr.size.height).toBe(100);
  });

  it('auto-switches to Select tool after creation [AC10]', () => {
    useCanvasStore.getState().setActiveTool('rectangle');
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });
    expect(useCanvasStore.getState().activeTool).toBe('select');
  });

  it('cancel clears preview and does not create expression [AC12]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(200, 200, stubPointerEvent());
    expect(tool.getPreview()).not.toBeNull();

    tool.onCancel();
    expect(tool.getPreview()).toBeNull();
    expect(expressionCount()).toBe(0);
  });

  it('sets human author on created expression [AC11]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });
    const expr = firstExpression()!;
    expect(expr.meta.author.type).toBe('human');
    expect(expr.meta.author.id).toBe('local-user');
  });

  it('uses DEFAULT_EXPRESSION_STYLE [AC11]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });
    const expr = firstExpression()!;
    expect(expr.style.strokeColor).toBe('#1e1e1e');
    expect(expr.style.fillStyle).toBe('hachure');
    expect(expr.style.opacity).toBe(1);
  });

  it('selects the newly created expression', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });
    const expr = firstExpression()!;
    const { selectedIds } = useCanvasStore.getState();
    expect(selectedIds.has(expr.id)).toBe(true);
  });
});

// ── EllipseTool ──────────────────────────────────────────────

describe('EllipseTool', () => {
  let tool: EllipseTool;

  beforeEach(() => {
    resetStore();
    tool = new EllipseTool();
  });

  it('creates an ellipse expression on valid draw [AC1]', () => {
    simulateDraw(tool, { x: 50, y: 50 }, { x: 200, y: 150 });

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('ellipse');
    expect(expr.data.kind).toBe('ellipse');
  });

  it('does not create expression when draw is too small [AC2]', () => {
    simulateDraw(tool, { x: 50, y: 50 }, { x: 55, y: 55 });
    expect(expressionCount()).toBe(0);
  });

  it('shows preview with kind ellipse during drag [AC4]', () => {
    tool.onPointerDown(50, 50, stubPointerEvent());
    tool.onPointerMove(200, 150, stubPointerEvent());

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.kind).toBe('ellipse');
  });

  it('auto-switches to Select after creation [AC10]', () => {
    useCanvasStore.getState().setActiveTool('ellipse');
    simulateDraw(tool, { x: 50, y: 50 }, { x: 200, y: 150 });
    expect(useCanvasStore.getState().activeTool).toBe('select');
  });
});

// ── DiamondTool ──────────────────────────────────────────────

describe('DiamondTool', () => {
  let tool: DiamondTool;

  beforeEach(() => {
    resetStore();
    tool = new DiamondTool();
  });

  it('creates a diamond expression on valid draw [AC1]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 250, y: 250 });

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('diamond');
    expect(expr.data.kind).toBe('diamond');
  });

  it('does not create expression when draw is too small [AC2]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 108, y: 108 });
    expect(expressionCount()).toBe(0);
  });

  it('shows preview with kind diamond during drag [AC4]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(250, 250, stubPointerEvent());

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.kind).toBe('diamond');
  });

  it('auto-switches to Select after creation [AC10]', () => {
    useCanvasStore.getState().setActiveTool('diamond');
    simulateDraw(tool, { x: 100, y: 100 }, { x: 250, y: 250 });
    expect(useCanvasStore.getState().activeTool).toBe('select');
  });
});

// ── LineTool ─────────────────────────────────────────────────

describe('LineTool', () => {
  let tool: LineTool;

  beforeEach(() => {
    resetStore();
    tool = new LineTool();
  });

  it('creates a line expression on valid draw (length >5px) [AC5]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('line');
    expect(expr.data.kind).toBe('line');
    if (expr.data.kind === 'line') {
      expect(expr.data.points.length).toBeGreaterThanOrEqual(2);
      expect(expr.data.points[0]).toEqual([100, 100]);
      expect(expr.data.points[expr.data.points.length - 1]).toEqual([200, 200]);
    }
  });

  it('does not create line when too short (<5px) [AC5]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 103, y: 103 });
    expect(expressionCount()).toBe(0);
  });

  it('shows line preview during drag [AC4]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(200, 200, stubPointerEvent());

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.kind).toBe('line');
    expect(preview!.points).toBeDefined();
    expect(preview!.points!.length).toBe(2);
  });

  it('auto-switches to Select after creation [AC10]', () => {
    useCanvasStore.getState().setActiveTool('line');
    simulateDraw(tool, { x: 100, y: 100 }, { x: 200, y: 200 });
    expect(useCanvasStore.getState().activeTool).toBe('select');
  });

  it('computes bounding box from line points', () => {
    simulateDraw(tool, { x: 100, y: 50 }, { x: 300, y: 250 });

    const expr = firstExpression()!;
    expect(expr.position.x).toBe(100);
    expect(expr.position.y).toBe(50);
    expect(expr.size.width).toBe(200);
    expect(expr.size.height).toBe(200);
  });
});

// ── ArrowTool ────────────────────────────────────────────────

describe('ArrowTool', () => {
  let tool: ArrowTool;

  beforeEach(() => {
    resetStore();
    tool = new ArrowTool();
  });

  it('creates an arrow expression with endArrowhead: true [AC6]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 300, y: 200 });

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('arrow');
    expect(expr.data.kind).toBe('arrow');
    if (expr.data.kind === 'arrow') {
      expect(expr.data.endArrowhead).toBe('triangle');
      expect(expr.data.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not create arrow when too short (<5px) [AC6]', () => {
    simulateDraw(tool, { x: 100, y: 100 }, { x: 102, y: 102 });
    expect(expressionCount()).toBe(0);
  });

  it('shows arrow preview during drag [AC4]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(300, 200, stubPointerEvent());

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.kind).toBe('arrow');
  });

  it('auto-switches to Select after creation [AC10]', () => {
    useCanvasStore.getState().setActiveTool('arrow');
    simulateDraw(tool, { x: 100, y: 100 }, { x: 300, y: 200 });
    expect(useCanvasStore.getState().activeTool).toBe('select');
  });
});

// ── FreehandTool ─────────────────────────────────────────────

describe('FreehandTool', () => {
  let tool: FreehandTool;

  beforeEach(() => {
    resetStore();
    tool = new FreehandTool();
  });

  it('creates a freehand expression capturing pressure points [AC7]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent({ pressure: 0.5 }));
    tool.onPointerMove(120, 130, stubPointerEvent({ pressure: 0.6 }));
    tool.onPointerMove(140, 160, stubPointerEvent({ pressure: 0.7 }));
    tool.onPointerUp(160, 190, stubPointerEvent({ pressure: 0.8 }));

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('freehand');
    expect(expr.data.kind).toBe('freehand');
    if (expr.data.kind === 'freehand') {
      expect(expr.data.points.length).toBeGreaterThanOrEqual(2);
      // Points should include pressure as 3rd element
      expect(expr.data.points[0]!.length).toBe(3);
    }
  });

  it('does not create freehand with fewer than 2 points [AC7]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerUp(100, 100, stubPointerEvent());

    expect(expressionCount()).toBe(0);
  });

  it('does NOT auto-switch to Select (stays in freehand) [AC10]', () => {
    useCanvasStore.getState().setActiveTool('freehand');

    tool.onPointerDown(100, 100, stubPointerEvent({ pressure: 0.5 }));
    tool.onPointerMove(120, 130, stubPointerEvent({ pressure: 0.6 }));
    tool.onPointerMove(140, 160, stubPointerEvent({ pressure: 0.7 }));
    tool.onPointerUp(160, 190, stubPointerEvent({ pressure: 0.8 }));

    expect(useCanvasStore.getState().activeTool).toBe('freehand');
  });

  it('shows freehand preview during draw [AC4]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent({ pressure: 0.5 }));
    tool.onPointerMove(120, 130, stubPointerEvent({ pressure: 0.6 }));

    const preview = tool.getPreview();
    expect(preview).not.toBeNull();
    expect(preview!.kind).toBe('freehand');
    expect(preview!.points).toBeDefined();
    expect(preview!.points!.length).toBeGreaterThanOrEqual(2);
  });

  it('computes bounding box from freehand points', () => {
    tool.onPointerDown(100, 200, stubPointerEvent({ pressure: 0.5 }));
    tool.onPointerMove(150, 100, stubPointerEvent({ pressure: 0.6 }));
    tool.onPointerMove(200, 300, stubPointerEvent({ pressure: 0.7 }));
    tool.onPointerUp(250, 250, stubPointerEvent({ pressure: 0.8 }));

    const expr = firstExpression()!;
    expect(expr.position.x).toBe(100);
    expect(expr.position.y).toBe(100);
    expect(expr.size.width).toBe(150);
    expect(expr.size.height).toBe(200);
  });
});

// ── TextTool ─────────────────────────────────────────────────

describe('TextTool', () => {
  let tool: TextTool;

  beforeEach(() => {
    resetStore();
    tool = new TextTool();
  });

  it('creates a text expression when commitText is called [AC8]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerUp(100, 100, stubPointerEvent());

    // Simulate text input commitment
    tool.commitText('Hello World');

    expect(expressionCount()).toBe(1);
    const expr = firstExpression()!;
    expect(expr.kind).toBe('text');
    expect(expr.data.kind).toBe('text');
    if (expr.data.kind === 'text') {
      expect(expr.data.text).toBe('Hello World');
      expect(expr.data.fontSize).toBe(16);
      expect(expr.data.fontFamily).toBe('sans-serif');
      expect(expr.data.textAlign).toBe('left');
    }
  });

  it('does not create text expression when text is empty [AC8]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerUp(100, 100, stubPointerEvent());
    tool.commitText('');

    expect(expressionCount()).toBe(0);
  });

  it('auto-switches to Select after text creation [AC10]', () => {
    useCanvasStore.getState().setActiveTool('text');
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerUp(100, 100, stubPointerEvent());
    tool.commitText('Hello');

    expect(useCanvasStore.getState().activeTool).toBe('select');
  });

  it('cancel clears text input position [AC12]', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerUp(100, 100, stubPointerEvent());
    expect(tool.getInputPosition()).not.toBeNull();

    tool.onCancel();
    expect(tool.getInputPosition()).toBeNull();
    expect(expressionCount()).toBe(0);
  });

  it('returns input position after click [AC8]', () => {
    tool.onPointerDown(150, 250, stubPointerEvent());
    tool.onPointerUp(150, 250, stubPointerEvent());

    const pos = tool.getInputPosition();
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(150);
    expect(pos!.y).toBe(250);
  });
});

// ── Cross-cutting concerns ───────────────────────────────────

describe('Tool cancel via ESC', () => {
  it('cancels rectangle draw on ESC [AC12]', () => {
    resetStore();
    const tool = new RectangleTool();
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(200, 200, stubPointerEvent());

    tool.onCancel();

    expect(tool.getPreview()).toBeNull();
    expect(expressionCount()).toBe(0);
  });

  it('cancels line draw on ESC [AC12]', () => {
    resetStore();
    const tool = new LineTool();
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(200, 200, stubPointerEvent());

    tool.onCancel();

    expect(tool.getPreview()).toBeNull();
    expect(expressionCount()).toBe(0);
  });

  it('cancels freehand draw on ESC [AC12]', () => {
    resetStore();
    const tool = new FreehandTool();
    tool.onPointerDown(100, 100, stubPointerEvent({ pressure: 0.5 }));
    tool.onPointerMove(150, 150, stubPointerEvent({ pressure: 0.6 }));

    tool.onCancel();

    expect(tool.getPreview()).toBeNull();
    expect(expressionCount()).toBe(0);
  });
});
