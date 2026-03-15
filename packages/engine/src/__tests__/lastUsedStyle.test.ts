/**
 * Unit tests for drawing tools using lastUsedStyle.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Verifies that all drawing tools use store.lastUsedStyle instead of
 * DEFAULT_EXPRESSION_STYLE when creating new expressions.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { RectangleTool } from '../tools/RectangleTool.js';
import { EllipseTool } from '../tools/EllipseTool.js';
import { DiamondTool } from '../tools/DiamondTool.js';
import { LineTool } from '../tools/LineTool.js';
import { ArrowTool } from '../tools/ArrowTool.js';
import { FreehandTool } from '../tools/FreehandTool.js';
import { TextTool } from '../tools/TextTool.js';

// ── Test helpers ───────────────────────────────────────────

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
    lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE },
  });
  useCanvasStore.getState().clearHistory();
}

function stubPointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return { pressure: 0.5, ...overrides } as PointerEvent;
}

function simulateDraw(
  tool: { onPointerDown: Function; onPointerMove: Function; onPointerUp: Function },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const ev = stubPointerEvent();
  tool.onPointerDown(start.x, start.y, ev);
  tool.onPointerMove(end.x, end.y, ev);
  tool.onPointerUp(end.x, end.y, ev);
}

function getFirstExpression() {
  const state = useCanvasStore.getState();
  const id = state.expressionOrder[0];
  return id ? state.expressions[id] : undefined;
}

const CUSTOM_STYLE = {
  strokeColor: '#ff0000',
  backgroundColor: '#00ff00',
  fillStyle: 'solid' as const,
  strokeWidth: 4,
  roughness: 0,
  opacity: 0.7,
};

// ── Tests ──────────────────────────────────────────────────

describe('Drawing tools use lastUsedStyle', () => {
  beforeEach(() => resetStore());

  it('RectangleTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new RectangleTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
    expect(expr?.style.backgroundColor).toBe('#00ff00');
    expect(expr?.style.fillStyle).toBe('solid');
    expect(expr?.style.strokeWidth).toBe(4);
    expect(expr?.style.roughness).toBe(0);
    expect(expr?.style.opacity).toBe(0.7);
  });

  it('EllipseTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new EllipseTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
  });

  it('DiamondTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new DiamondTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
  });

  it('LineTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new LineTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
  });

  it('ArrowTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new ArrowTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
  });

  it('FreehandTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new FreehandTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
  });

  it('TextTool uses lastUsedStyle for new expressions', () => {
    useCanvasStore.getState().setLastUsedStyle(CUSTOM_STYLE);

    const tool = new TextTool();
    tool.onPointerUp(50, 50, stubPointerEvent());
    tool.commitText('Hello World');

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe('#ff0000');
  });

  it('uses DEFAULT_EXPRESSION_STYLE when lastUsedStyle is not changed', () => {
    const tool = new RectangleTool();
    simulateDraw(tool, { x: 0, y: 0 }, { x: 100, y: 100 });

    const expr = getFirstExpression();
    expect(expr?.style.strokeColor).toBe(DEFAULT_EXPRESSION_STYLE.strokeColor);
    expect(expr?.style.strokeWidth).toBe(DEFAULT_EXPRESSION_STYLE.strokeWidth);
  });
});
