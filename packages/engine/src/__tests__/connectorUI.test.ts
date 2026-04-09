/**
 * Unit tests for connector UI features (ticket #151).
 *
 * Tests cover:
 * - updateArrowData store action
 * - defaultArrowStyle state management
 * - ArrowTool reading defaultArrowStyle
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';
import { ArrowTool } from '../tools/ArrowTool.js';
import type { VisualExpression, ArrowData, RoutingMode, ArrowheadType } from '@infinicanvas/protocol';
import { DEFAULT_EXPRESSION_STYLE } from '@infinicanvas/protocol';

// ── Test helpers ───────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'test', name: 'Test' };

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
    defaultArrowStyle: {
      routing: 'straight',
      startArrowhead: 'none',
      endArrowhead: 'triangle',
    },
  });
  useCanvasStore.getState().clearHistory();
}

function makeArrowExpression(
  id: string,
  overrides: Partial<ArrowData> = {},
): VisualExpression {
  const now = Date.now();
  return {
    id,
    kind: 'arrow',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    angle: 0,
    style: { ...DEFAULT_EXPRESSION_STYLE },
    meta: {
      author: testAuthor,
      createdAt: now,
      updatedAt: now,
      tags: [],
      locked: false,
    },
    data: {
      kind: 'arrow',
      points: [[0, 0], [100, 100]] as [number, number][],
      startArrowhead: 'none',
      endArrowhead: 'triangle',
      ...overrides,
    },
  };
}

function stubPointerEvent(): PointerEvent {
  return { pressure: 0.5 } as PointerEvent;
}

beforeEach(() => {
  resetStore();
});

// ── updateArrowData ────────────────────────────────────────

describe('updateArrowData', () => {
  it('updates routing mode on an existing arrow', () => {
    const arrow = makeArrowExpression('arrow-1');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-1', { routing: 'orthogonal' });

    const updated = useCanvasStore.getState().expressions['arrow-1'];
    expect((updated?.data as ArrowData).routing).toBe('orthogonal');
  });

  it('updates arrowhead types', () => {
    const arrow = makeArrowExpression('arrow-2');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-2', {
      startArrowhead: 'diamond',
      endArrowhead: 'ERmany',
    });

    const updated = useCanvasStore.getState().expressions['arrow-2'];
    const data = updated?.data as ArrowData;
    expect(data.startArrowhead).toBe('diamond');
    expect(data.endArrowhead).toBe('ERmany');
  });

  it('updates curved and rounded flags', () => {
    const arrow = makeArrowExpression('arrow-3', { routing: 'orthogonal' });
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-3', { curved: true, rounded: false });

    const data = useCanvasStore.getState().expressions['arrow-3']?.data as ArrowData;
    expect(data.curved).toBe(true);
    expect(data.rounded).toBe(false);
  });

  it('updates startFill and endFill', () => {
    const arrow = makeArrowExpression('arrow-4');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-4', { startFill: false, endFill: true });

    const data = useCanvasStore.getState().expressions['arrow-4']?.data as ArrowData;
    expect(data.startFill).toBe(false);
    expect(data.endFill).toBe(true);
  });

  it('preserves existing data fields when partially updating', () => {
    const arrow = makeArrowExpression('arrow-5', {
      startArrowhead: 'chevron',
      endArrowhead: 'triangle',
      routing: 'curved',
    });
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    // Only update routing — arrowheads should stay
    store.updateArrowData('arrow-5', { routing: 'orthogonal' });

    const data = useCanvasStore.getState().expressions['arrow-5']?.data as ArrowData;
    expect(data.routing).toBe('orthogonal');
    expect(data.startArrowhead).toBe('chevron');
    expect(data.endArrowhead).toBe('triangle');
  });

  it('pushes undo snapshot on update', () => {
    const arrow = makeArrowExpression('arrow-6');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-6', { routing: 'elbow' });

    expect(useCanvasStore.getState().canUndo).toBe(true);
  });

  it('emits protocol operation on update', () => {
    const arrow = makeArrowExpression('arrow-7');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    const logBefore = useCanvasStore.getState().operationLog.length;
    store.updateArrowData('arrow-7', { routing: 'curved' });

    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBeGreaterThan(logBefore);
  });

  it('is a no-op for non-existent expression', () => {
    const store = useCanvasStore.getState();
    const logBefore = store.operationLog.length;

    store.updateArrowData('non-existent', { routing: 'curved' });

    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBe(logBefore);
  });

  it('is a no-op for non-arrow expressions', () => {
    const now = Date.now();
    const rect: VisualExpression = {
      id: 'rect-1',
      kind: 'rectangle',
      position: { x: 0, y: 0 },
      size: { width: 50, height: 50 },
      angle: 0,
      style: { ...DEFAULT_EXPRESSION_STYLE },
      meta: { author: testAuthor, createdAt: now, updatedAt: now, tags: [], locked: false },
      data: { kind: 'rectangle', label: 'Test' },
    };
    const store = useCanvasStore.getState();
    store.addExpression(rect);

    const logBefore = useCanvasStore.getState().operationLog.length;
    store.updateArrowData('rect-1', { routing: 'curved' });

    // Should not have changed
    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBe(logBefore);
  });

  it('updates defaultArrowStyle when routing changes', () => {
    const arrow = makeArrowExpression('arrow-8');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-8', { routing: 'entityRelation' });

    const defaultStyle = useCanvasStore.getState().defaultArrowStyle;
    expect(defaultStyle.routing).toBe('entityRelation');
  });

  it('updates defaultArrowStyle when arrowheads change', () => {
    const arrow = makeArrowExpression('arrow-9');
    const store = useCanvasStore.getState();
    store.addExpression(arrow);

    store.updateArrowData('arrow-9', {
      startArrowhead: 'ERone',
      endArrowhead: 'ERmany',
    });

    const defaultStyle = useCanvasStore.getState().defaultArrowStyle;
    expect(defaultStyle.startArrowhead).toBe('ERone');
    expect(defaultStyle.endArrowhead).toBe('ERmany');
  });
});

// ── defaultArrowStyle ──────────────────────────────────────

describe('defaultArrowStyle', () => {
  it('has sensible defaults', () => {
    const state = useCanvasStore.getState();
    expect(state.defaultArrowStyle).toBeDefined();
    expect(state.defaultArrowStyle.routing).toBe('straight');
    expect(state.defaultArrowStyle.startArrowhead).toBe('none');
    expect(state.defaultArrowStyle.endArrowhead).toBe('triangle');
  });

  it('can be updated via setDefaultArrowStyle', () => {
    const store = useCanvasStore.getState();
    store.setDefaultArrowStyle({
      routing: 'orthogonal',
      endArrowhead: 'classic',
    });

    const updated = useCanvasStore.getState().defaultArrowStyle;
    expect(updated.routing).toBe('orthogonal');
    expect(updated.endArrowhead).toBe('classic');
    // startArrowhead should remain default
    expect(updated.startArrowhead).toBe('none');
  });
});

// ── ArrowTool + defaultArrowStyle ──────────────────────────

describe('ArrowTool respects defaultArrowStyle', () => {
  it('creates arrow with default routing mode', () => {
    // Set default routing to orthogonal
    useCanvasStore.getState().setDefaultArrowStyle({ routing: 'orthogonal' });

    const tool = new ArrowTool();
    const ev = stubPointerEvent();

    tool.onPointerDown(0, 0, ev);
    tool.onPointerMove(200, 200, ev);
    tool.onPointerUp(200, 200, ev);

    const state = useCanvasStore.getState();
    const ids = Object.keys(state.expressions);
    expect(ids.length).toBe(1);
    const arrow = state.expressions[ids[0]!];
    expect((arrow?.data as ArrowData).routing).toBe('orthogonal');
  });

  it('creates arrow with default arrowhead types', () => {
    useCanvasStore.getState().setDefaultArrowStyle({
      startArrowhead: 'diamond',
      endArrowhead: 'ERmany',
    });

    const tool = new ArrowTool();
    const ev = stubPointerEvent();

    tool.onPointerDown(0, 0, ev);
    tool.onPointerMove(200, 200, ev);
    tool.onPointerUp(200, 200, ev);

    const state = useCanvasStore.getState();
    const ids = Object.keys(state.expressions);
    const arrow = state.expressions[ids[0]!];
    const data = arrow?.data as ArrowData;
    expect(data.startArrowhead).toBe('diamond');
    expect(data.endArrowhead).toBe('ERmany');
  });

  it('uses straight routing by default when no override set', () => {
    const tool = new ArrowTool();
    const ev = stubPointerEvent();

    tool.onPointerDown(0, 0, ev);
    tool.onPointerMove(200, 200, ev);
    tool.onPointerUp(200, 200, ev);

    const state = useCanvasStore.getState();
    const ids = Object.keys(state.expressions);
    const arrow = state.expressions[ids[0]!];
    const data = arrow?.data as ArrowData;
    // straight = undefined or 'straight' (renderer treats both as straight)
    expect(data.routing === undefined || data.routing === 'straight').toBe(true);
  });
});
