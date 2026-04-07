/**
 * Unit tests for page/paper boundary state in canvasStore.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Covers: togglePage, setPageSize, default values.
 *
 * @module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Store reset before each test ───────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    gridVisible: true,
    gridType: 'dot',
    gridSize: 20,
    operationLog: [],
    canUndo: false,
    canRedo: false,
    pageVisible: true,
    pageSize: { width: 1122, height: 794 },
    pageMargin: 40,
  });
  useCanvasStore.getState().clearHistory();
});

// ── Page state defaults ──────────────────────────────────────

describe('page state defaults', () => {
  it('has pageVisible defaulting to true', () => {
    const state = useCanvasStore.getState();
    expect(state.pageVisible).toBe(true);
  });

  it('has pageSize defaulting to A4 landscape', () => {
    const state = useCanvasStore.getState();
    expect(state.pageSize).toEqual({ width: 1122, height: 794 });
  });

  it('has pageMargin defaulting to 40', () => {
    const state = useCanvasStore.getState();
    expect(state.pageMargin).toBe(40);
  });
});

// ── togglePage ───────────────────────────────────────────────

describe('togglePage', () => {
  it('toggles pageVisible from true to false', () => {
    useCanvasStore.getState().togglePage();
    expect(useCanvasStore.getState().pageVisible).toBe(false);
  });

  it('toggles pageVisible from false to true', () => {
    useCanvasStore.setState({ pageVisible: false });
    useCanvasStore.getState().togglePage();
    expect(useCanvasStore.getState().pageVisible).toBe(true);
  });

  it('does not emit protocol operations (UI-only)', () => {
    const logBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().togglePage();
    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBe(logBefore);
  });
});

// ── setPageSize ──────────────────────────────────────────────

describe('setPageSize', () => {
  it('updates pageSize to new dimensions', () => {
    useCanvasStore.getState().setPageSize({ width: 1587, height: 1122 });
    expect(useCanvasStore.getState().pageSize).toEqual({ width: 1587, height: 1122 });
  });

  it('accepts Letter portrait dimensions', () => {
    useCanvasStore.getState().setPageSize({ width: 850, height: 1100 });
    expect(useCanvasStore.getState().pageSize).toEqual({ width: 850, height: 1100 });
  });

  it('does not emit protocol operations (UI-only)', () => {
    const logBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().setPageSize({ width: 800, height: 600 });
    const logAfter = useCanvasStore.getState().operationLog.length;
    expect(logAfter).toBe(logBefore);
  });

  it('rejects non-positive width', () => {
    useCanvasStore.getState().setPageSize({ width: 0, height: 600 });
    // Should keep previous value
    expect(useCanvasStore.getState().pageSize.width).toBe(1122);
  });

  it('rejects non-positive height', () => {
    useCanvasStore.getState().setPageSize({ width: 800, height: -1 });
    expect(useCanvasStore.getState().pageSize.height).toBe(794);
  });

  it('rejects non-finite values', () => {
    useCanvasStore.getState().setPageSize({ width: Infinity, height: 600 });
    expect(useCanvasStore.getState().pageSize.width).toBe(1122);
  });
});
