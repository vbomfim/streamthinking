/**
 * Unit tests for grid snap store integration.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: snapToGrid toggle state, grid state fields (gridVisible,
 * gridType, gridSize), and toggleSnapToGrid action.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Store reset before each test ────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
    canUndo: false,
    canRedo: false,
    // Grid & snap state
    gridVisible: true,
    gridType: 'dot' as const,
    gridSize: 20,
    snapToGrid: true,
  });
  useCanvasStore.getState().clearHistory();
});

// ── Grid state defaults ──────────────────────────────────────

describe('grid state defaults', () => {
  it('has gridVisible defaulting to true', () => {
    expect(useCanvasStore.getState().gridVisible).toBe(true);
  });

  it('has gridType defaulting to "dot"', () => {
    expect(useCanvasStore.getState().gridType).toBe('dot');
  });

  it('has gridSize defaulting to 20', () => {
    expect(useCanvasStore.getState().gridSize).toBe(20);
  });
});

// ── Grid actions ─────────────────────────────────────────────

describe('grid actions', () => {
  it('toggleGrid toggles gridVisible', () => {
    useCanvasStore.getState().toggleGrid();
    expect(useCanvasStore.getState().gridVisible).toBe(false);
    useCanvasStore.getState().toggleGrid();
    expect(useCanvasStore.getState().gridVisible).toBe(true);
  });

  it('setGridType changes gridType', () => {
    useCanvasStore.getState().setGridType('line');
    expect(useCanvasStore.getState().gridType).toBe('line');
    useCanvasStore.getState().setGridType('dot');
    expect(useCanvasStore.getState().gridType).toBe('dot');
  });

  it('setGridSize changes gridSize', () => {
    useCanvasStore.getState().setGridSize(40);
    expect(useCanvasStore.getState().gridSize).toBe(40);
    useCanvasStore.getState().setGridSize(10);
    expect(useCanvasStore.getState().gridSize).toBe(10);
  });
});

// ── Snap to grid state ───────────────────────────────────────

describe('snapToGrid state', () => {
  it('defaults to true', () => {
    expect(useCanvasStore.getState().snapToGrid).toBe(true);
  });

  it('toggleSnapToGrid toggles the state', () => {
    useCanvasStore.getState().toggleSnapToGrid();
    expect(useCanvasStore.getState().snapToGrid).toBe(false);
    useCanvasStore.getState().toggleSnapToGrid();
    expect(useCanvasStore.getState().snapToGrid).toBe(true);
  });

  it('toggleSnapToGrid does not affect grid visibility', () => {
    useCanvasStore.getState().toggleSnapToGrid();
    expect(useCanvasStore.getState().gridVisible).toBe(true);
  });

  it('toggleSnapToGrid does not emit protocol operations', () => {
    const logBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().toggleSnapToGrid();
    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBe(logBefore);
  });

  it('toggleSnapToGrid does not push undo snapshots', () => {
    useCanvasStore.getState().toggleSnapToGrid();
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });
});
