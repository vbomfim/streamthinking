/**
 * Unit tests for Ctrl-constrain shapes to square/circle.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Acceptance criteria from Issue #73.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';
import { RectangleTool } from '../tools/RectangleTool.js';
import { EllipseTool } from '../tools/EllipseTool.js';
import { DiamondTool } from '../tools/DiamondTool.js';
import type { ToolHandler } from '../tools/BaseTool.js';

// ── Test helpers ───────────────────────────────────────────

/** Stub PointerEvent for testing (jsdom doesn't fully support it). */
function stubPointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return { pressure: 0.5, ctrlKey: false, metaKey: false, ...overrides } as PointerEvent;
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

/** Get the first expression from the store. */
function firstExpression() {
  const exprs = useCanvasStore.getState().expressions;
  const id = useCanvasStore.getState().expressionOrder[0];
  return id ? exprs[id] : undefined;
}

// ── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
});

// ── Ctrl+drag rectangle → square ───────────────────────────

describe('RectangleTool with Ctrl constrain', () => {
  let tool: RectangleTool;

  beforeEach(() => {
    tool = new RectangleTool();
  });

  it('creates a square when Ctrl is held during drag', () => {
    const ctrlEvent = stubPointerEvent({ ctrlKey: true });
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(250, 200, ctrlEvent); // width=150, height=100 → constrained to 150×150
    tool.onPointerUp(250, 200, ctrlEvent);

    const expr = firstExpression()!;
    expect(expr).toBeDefined();
    expect(expr.size.width).toBe(expr.size.height);
    expect(expr.size.width).toBe(150); // max(150, 100) = 150
  });

  it('creates a square when Meta (Cmd) is held during drag', () => {
    const metaEvent = stubPointerEvent({ metaKey: true });
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(300, 180, metaEvent); // width=200, height=80 → 200×200
    tool.onPointerUp(300, 180, metaEvent);

    const expr = firstExpression()!;
    expect(expr).toBeDefined();
    expect(expr.size.width).toBe(expr.size.height);
    expect(expr.size.width).toBe(200);
  });

  it('preview shows constrained dimensions during Ctrl+drag', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(250, 200, stubPointerEvent({ ctrlKey: true }));

    const preview = tool.getPreview()!;
    expect(preview).not.toBeNull();
    expect(preview.width).toBe(preview.height);
    expect(preview.width).toBe(150);
  });

  it('returns to free aspect ratio when Ctrl is released mid-drag', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());

    // Drag with Ctrl: constrained
    tool.onPointerMove(250, 200, stubPointerEvent({ ctrlKey: true }));
    const constrained = tool.getPreview()!;
    expect(constrained.width).toBe(constrained.height);

    // Continue drag without Ctrl: unconstrained
    tool.onPointerMove(250, 200, stubPointerEvent({ ctrlKey: false }));
    const free = tool.getPreview()!;
    expect(free.width).toBe(150);
    expect(free.height).toBe(100);
  });

  it('without Ctrl, drag produces free aspect ratio (baseline)', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(250, 200, stubPointerEvent());
    tool.onPointerUp(250, 200, stubPointerEvent());

    const expr = firstExpression()!;
    expect(expr.size.width).toBe(150);
    expect(expr.size.height).toBe(100);
  });

  it('handles negative drag direction with Ctrl', () => {
    const ctrlEvent = stubPointerEvent({ ctrlKey: true });
    tool.onPointerDown(250, 200, stubPointerEvent());
    tool.onPointerMove(100, 100, ctrlEvent); // dragging top-left
    tool.onPointerUp(100, 100, ctrlEvent);

    const expr = firstExpression()!;
    expect(expr.size.width).toBe(expr.size.height);
    expect(expr.size.width).toBe(150); // max(150, 100)
  });
});

// ── Ctrl+drag ellipse → circle ─────────────────────────────

describe('EllipseTool with Ctrl constrain', () => {
  let tool: EllipseTool;

  beforeEach(() => {
    tool = new EllipseTool();
  });

  it('creates a circle when Ctrl is held during drag', () => {
    const ctrlEvent = stubPointerEvent({ ctrlKey: true });
    tool.onPointerDown(50, 50, stubPointerEvent());
    tool.onPointerMove(250, 150, ctrlEvent); // width=200, height=100 → 200×200
    tool.onPointerUp(250, 150, ctrlEvent);

    const expr = firstExpression()!;
    expect(expr).toBeDefined();
    expect(expr.kind).toBe('ellipse');
    expect(expr.size.width).toBe(expr.size.height);
    expect(expr.size.width).toBe(200);
  });

  it('preview shows constrained dimensions for ellipse', () => {
    tool.onPointerDown(50, 50, stubPointerEvent());
    tool.onPointerMove(250, 150, stubPointerEvent({ ctrlKey: true }));

    const preview = tool.getPreview()!;
    expect(preview.kind).toBe('ellipse');
    expect(preview.width).toBe(preview.height);
  });
});

// ── Ctrl+drag diamond → equilateral ───────────────────────

describe('DiamondTool with Ctrl constrain', () => {
  let tool: DiamondTool;

  beforeEach(() => {
    tool = new DiamondTool();
  });

  it('creates equilateral diamond when Ctrl is held during drag', () => {
    const ctrlEvent = stubPointerEvent({ ctrlKey: true });
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(300, 200, ctrlEvent); // width=200, height=100 → 200×200
    tool.onPointerUp(300, 200, ctrlEvent);

    const expr = firstExpression()!;
    expect(expr).toBeDefined();
    expect(expr.kind).toBe('diamond');
    expect(expr.size.width).toBe(expr.size.height);
    expect(expr.size.width).toBe(200);
  });

  it('preview shows constrained dimensions for diamond', () => {
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(300, 200, stubPointerEvent({ ctrlKey: true }));

    const preview = tool.getPreview()!;
    expect(preview.kind).toBe('diamond');
    expect(preview.width).toBe(preview.height);
  });
});

// ── Edge cases ─────────────────────────────────────────────

describe('Ctrl-constrain edge cases', () => {
  it('constrains when height > width (takes height)', () => {
    const tool = new RectangleTool();
    const ctrlEvent = stubPointerEvent({ ctrlKey: true });
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(150, 300, ctrlEvent); // width=50, height=200 → 200×200
    tool.onPointerUp(150, 300, ctrlEvent);

    const expr = firstExpression()!;
    expect(expr.size.width).toBe(200);
    expect(expr.size.height).toBe(200);
  });

  it('constrains correctly when width equals height', () => {
    const tool = new RectangleTool();
    const ctrlEvent = stubPointerEvent({ ctrlKey: true });
    tool.onPointerDown(100, 100, stubPointerEvent());
    tool.onPointerMove(200, 200, ctrlEvent); // width=100, height=100 → 100×100
    tool.onPointerUp(200, 200, ctrlEvent);

    const expr = firstExpression()!;
    expect(expr.size.width).toBe(100);
    expect(expr.size.height).toBe(100);
  });
});
