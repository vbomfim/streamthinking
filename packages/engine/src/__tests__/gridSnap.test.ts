/**
 * Unit tests for grid snap store integration.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: snapEnabled toggle state, grid state fields (gridVisible,
 * gridType, gridSize), and toggleSnapEnabled action.
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
    snapEnabled: true,
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

  it('setGridSize rejects zero', () => {
    useCanvasStore.getState().setGridSize(0);
    expect(useCanvasStore.getState().gridSize).toBe(20);
  });

  it('setGridSize rejects negative values', () => {
    useCanvasStore.getState().setGridSize(-10);
    expect(useCanvasStore.getState().gridSize).toBe(20);
  });

  it('setGridSize rejects Infinity', () => {
    useCanvasStore.getState().setGridSize(Infinity);
    expect(useCanvasStore.getState().gridSize).toBe(20);
  });

  it('setGridSize rejects NaN', () => {
    useCanvasStore.getState().setGridSize(NaN);
    expect(useCanvasStore.getState().gridSize).toBe(20);
  });
});

// ── Snap enabled state ───────────────────────────────────────

describe('snapEnabled state', () => {
  it('defaults to true', () => {
    expect(useCanvasStore.getState().snapEnabled).toBe(true);
  });

  it('toggleSnapEnabled toggles the state', () => {
    useCanvasStore.getState().toggleSnapEnabled();
    expect(useCanvasStore.getState().snapEnabled).toBe(false);
    useCanvasStore.getState().toggleSnapEnabled();
    expect(useCanvasStore.getState().snapEnabled).toBe(true);
  });

  it('toggleSnapEnabled does not affect grid visibility', () => {
    useCanvasStore.getState().toggleSnapEnabled();
    expect(useCanvasStore.getState().gridVisible).toBe(true);
  });

  it('toggleSnapEnabled does not emit protocol operations', () => {
    const logBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().toggleSnapEnabled();
    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBe(logBefore);
  });

  it('toggleSnapEnabled does not push undo snapshots', () => {
    useCanvasStore.getState().toggleSnapEnabled();
    expect(useCanvasStore.getState().canUndo).toBe(false);
  });
});
