/**
 * Unit tests for styleExpressions store action and lastUsedStyle state.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: applying styles to selected expressions, emitting style operations,
 * remembering last-used style, undo/redo, edge cases.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionBuilder, DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';
import type { ExpressionStyle, StylePayload } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Test helpers ───────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string) {
  const expr = builder.rectangle(100, 200, 300, 150).label('Test').build();
  return { ...expr, id };
}

function makeEllipse(id: string) {
  const expr = builder.ellipse(50, 50, 100, 100).label('Test').build();
  return { ...expr, id };
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
    lastUsedStyle: { ...DEFAULT_EXPRESSION_STYLE },
  });
  useCanvasStore.getState().clearHistory();
}

// ── Tests ──────────────────────────────────────────────────

describe('styleExpressions', () => {
  beforeEach(() => resetStore());

  it('updates stroke color on a single expression', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#ff0000' });

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.style.strokeColor).toBe('#ff0000');
  });

  it('updates multiple style properties at once', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: '#ff0000',
      backgroundColor: '#00ff00',
      strokeWidth: 4,
      fillStyle: 'solid',
      roughness: 0,
      opacity: 0.5,
    });

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.strokeColor).toBe('#ff0000');
    expect(style?.backgroundColor).toBe('#00ff00');
    expect(style?.strokeWidth).toBe(4);
    expect(style?.fillStyle).toBe('solid');
    expect(style?.roughness).toBe(0);
    expect(style?.opacity).toBe(0.5);
  });

  it('applies style to multiple expressions at once', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    useCanvasStore.getState().addExpression(makeEllipse('ellipse-1'));

    useCanvasStore.getState().styleExpressions(
      ['rect-1', 'ellipse-1'],
      { strokeColor: '#0000ff' },
    );

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.style.strokeColor).toBe('#0000ff');
    expect(state.expressions['ellipse-1']?.style.strokeColor).toBe('#0000ff');
  });

  it('emits a style ProtocolOperation', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    const logBefore = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#ff0000' });

    const log = useCanvasStore.getState().operationLog;
    expect(log.length).toBe(logBefore + 1);

    const op = log[log.length - 1]!;
    expect(op.type).toBe('style');
    const payload = op.payload as StylePayload;
    expect(payload.expressionIds).toEqual(['rect-1']);
    expect(payload.style).toEqual({ strokeColor: '#ff0000' });
  });

  it('preserves other style properties not being changed', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);
    const originalStyle = { ...useCanvasStore.getState().expressions['rect-1']!.style };

    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#ff0000' });

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.strokeColor).toBe('#ff0000');
    expect(style?.backgroundColor).toBe(originalStyle.backgroundColor);
    expect(style?.fillStyle).toBe(originalStyle.fillStyle);
    expect(style?.strokeWidth).toBe(originalStyle.strokeWidth);
    expect(style?.roughness).toBe(originalStyle.roughness);
    expect(style?.opacity).toBe(originalStyle.opacity);
  });

  it('skips non-existent expression IDs without error', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));

    useCanvasStore.getState().styleExpressions(
      ['rect-1', 'nonexistent'],
      { strokeColor: '#ff0000' },
    );

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.style.strokeColor).toBe('#ff0000');
  });

  it('does nothing when given empty IDs array', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    const logBefore = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().styleExpressions([], { strokeColor: '#ff0000' });

    expect(useCanvasStore.getState().operationLog.length).toBe(logBefore);
  });

  it('skips locked expressions', () => {
    const expr = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(expr);

    // Lock the expression
    useCanvasStore.setState((state) => {
      const e = state.expressions['rect-1'];
      if (e) e.meta.locked = true;
    });

    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#ff0000' });

    const style = useCanvasStore.getState().expressions['rect-1']?.style;
    expect(style?.strokeColor).not.toBe('#ff0000');
  });

  it('supports undo after styling', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    const originalColor = useCanvasStore.getState().expressions['rect-1']!.style.strokeColor;

    useCanvasStore.getState().styleExpressions(['rect-1'], { strokeColor: '#ff0000' });
    expect(useCanvasStore.getState().expressions['rect-1']?.style.strokeColor).toBe('#ff0000');
    expect(useCanvasStore.getState().canUndo).toBe(true);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['rect-1']?.style.strokeColor).toBe(originalColor);
  });
});

describe('lastUsedStyle', () => {
  beforeEach(() => resetStore());

  it('initializes to DEFAULT_EXPRESSION_STYLE', () => {
    const { lastUsedStyle } = useCanvasStore.getState();
    expect(lastUsedStyle).toEqual(DEFAULT_EXPRESSION_STYLE);
  });

  it('updates when styleExpressions is called', () => {
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: '#ff0000',
      opacity: 0.7,
    });

    const { lastUsedStyle } = useCanvasStore.getState();
    expect(lastUsedStyle.strokeColor).toBe('#ff0000');
    expect(lastUsedStyle.opacity).toBe(0.7);
    // Other properties preserved from default
    expect(lastUsedStyle.fillStyle).toBe(DEFAULT_EXPRESSION_STYLE.fillStyle);
  });

  it('can be set directly via setLastUsedStyle', () => {
    useCanvasStore.getState().setLastUsedStyle({ strokeColor: '#abcdef' });

    const { lastUsedStyle } = useCanvasStore.getState();
    expect(lastUsedStyle.strokeColor).toBe('#abcdef');
    // Other properties preserved
    expect(lastUsedStyle.backgroundColor).toBe(DEFAULT_EXPRESSION_STYLE.backgroundColor);
  });

  it('setLastUsedStyle does not emit operations', () => {
    const logBefore = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().setLastUsedStyle({ strokeColor: '#abcdef' });

    expect(useCanvasStore.getState().operationLog.length).toBe(logBefore);
  });

  it('merges partial style into existing lastUsedStyle', () => {
    useCanvasStore.getState().setLastUsedStyle({ strokeColor: '#ff0000' });
    useCanvasStore.getState().setLastUsedStyle({ backgroundColor: '#00ff00' });

    const { lastUsedStyle } = useCanvasStore.getState();
    expect(lastUsedStyle.strokeColor).toBe('#ff0000');
    expect(lastUsedStyle.backgroundColor).toBe('#00ff00');
  });
});
