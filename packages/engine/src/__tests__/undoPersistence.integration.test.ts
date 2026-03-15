/**
 * Integration tests: Undo/Redo × Persistence
 *
 * Tests the cross-module interaction between the undo/redo system
 * and the auto-save persistence layer. These modules were developed
 * in separate tickets (#8 and #9) and never tested together.
 *
 * Key concerns:
 * - Undo triggers auto-save (expressions change → debounce → save)
 * - Redo triggers auto-save
 * - Load from localStorage → modify → undo reverts to loaded state
 * - Quota error during auto-save doesn't break undo
 * - Undo doesn't persist transient state (selection, operationLog)
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { subscribeAutoSave, DEBOUNCE_MS } from '../hooks/useAutoSave.js';
import {
  saveCanvasState,
  loadCanvasState,
  STORAGE_KEY,
} from '../persistence/localStorage.js';
import type { PersistedCanvasState } from '../persistence/localStorage.js';

// ── Fixtures ──────────────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string, label = 'Rect'): VisualExpression {
  return { ...builder.rectangle(100, 200, 300, 150).label(label).build(), id };
}

function makeEllipse(id: string, label = 'Ellipse'): VisualExpression {
  return { ...builder.ellipse(200, 300, 100, 80).label(label).build(), id };
}

// ── Mock localStorage ──────────────────────────────────────────

let storage: Record<string, string>;

function createMockStorage(options?: { throwOnSet?: boolean }): Storage {
  return {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      if (options?.throwOnSet) {
        const err = new DOMException('Storage quota exceeded', 'QuotaExceededError');
        throw err;
      }
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
    clear: vi.fn(() => { storage = {}; }),
    get length() { return Object.keys(storage).length; },
    key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
  };
}

// ── Setup / Teardown ──────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  storage = {};

  const mockStorage = createMockStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  // Reset store to pristine
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────

describe('Undo triggers auto-save [COVERAGE][AC1 #8, AC1 #9]', () => {
  it('auto-save fires after undo changes expressions', () => {
    const unsub = subscribeAutoSave();
    const store = useCanvasStore.getState();
    const rect = makeRectangle('r1');

    // Add expression → pushes snapshot
    store.addExpression(rect);
    expect(useCanvasStore.getState().canUndo).toBe(true);

    // Advance past debounce to save the "added" state
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);
    expect(storage[STORAGE_KEY]).toBeDefined();

    const savedAfterAdd = JSON.parse(storage[STORAGE_KEY]);
    expect(savedAfterAdd.expressions['r1']).toBeDefined();

    // Undo → removes expression
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['r1']).toBeUndefined();

    // Auto-save should fire after debounce
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);
    const savedAfterUndo = JSON.parse(storage[STORAGE_KEY]);
    expect(savedAfterUndo.expressions['r1']).toBeUndefined();
    expect(savedAfterUndo.expressionOrder).toEqual([]);

    unsub();
  });

  it('auto-save fires after redo restores expressions', () => {
    const unsub = subscribeAutoSave();
    const store = useCanvasStore.getState();
    const rect = makeRectangle('r1');

    store.addExpression(rect);
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);

    // Undo
    useCanvasStore.getState().undo();
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);
    expect(JSON.parse(storage[STORAGE_KEY]).expressionOrder).toEqual([]);

    // Redo → re-adds expression
    useCanvasStore.getState().redo();
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);

    const savedAfterRedo = JSON.parse(storage[STORAGE_KEY]);
    expect(savedAfterRedo.expressions['r1']).toBeDefined();
    expect(savedAfterRedo.expressionOrder).toEqual(['r1']);

    unsub();
  });
});

describe('Load → modify → undo cycle [COVERAGE][AC2 #9, AC1 #8]', () => {
  it('loads persisted state, modifies, then undo reverts to loaded state', () => {
    // Simulate previously saved state
    const rect = makeRectangle('r1', 'Persisted');
    const savedState: PersistedCanvasState = {
      expressions: { 'r1': rect },
      expressionOrder: ['r1'],
      camera: { x: 50, y: 100, zoom: 2 },
    };
    storage[STORAGE_KEY] = JSON.stringify(savedState);

    // Load it
    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();

    // Initialize store with loaded state (simulating app startup)
    useCanvasStore.setState({
      expressions: loaded!.expressions,
      expressionOrder: loaded!.expressionOrder,
      camera: loaded!.camera,
    });
    useCanvasStore.getState().clearHistory();

    // User adds a new expression
    const ellipse = makeEllipse('e1', 'New');
    useCanvasStore.getState().addExpression(ellipse);

    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(2);
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1', 'e1']);

    // Undo → should revert to loaded state (1 expression)
    useCanvasStore.getState().undo();
    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(1);
    expect(useCanvasStore.getState().expressions['r1']).toBeDefined();
    expect(useCanvasStore.getState().expressions['e1']).toBeUndefined();
    expect(useCanvasStore.getState().expressionOrder).toEqual(['r1']);
  });

  it('multiple operations after load can be fully undone', () => {
    // Preload with a rectangle
    const rect = makeRectangle('r1', 'Original');
    useCanvasStore.setState({
      expressions: { 'r1': rect },
      expressionOrder: ['r1'],
      camera: { x: 0, y: 0, zoom: 1 },
    });
    useCanvasStore.getState().clearHistory();

    // Add two expressions
    const e1 = makeEllipse('e1', 'First');
    const e2 = makeEllipse('e2', 'Second');
    useCanvasStore.getState().addExpression(e1);
    useCanvasStore.getState().addExpression(e2);

    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(3);

    // Undo twice → back to loaded state
    useCanvasStore.getState().undo();
    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(2);
    useCanvasStore.getState().undo();
    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(1);
    expect(useCanvasStore.getState().expressions['r1']).toBeDefined();
  });
});

describe('Undo does not persist transient state [CONTRACT][AC9 #9]', () => {
  it('auto-saved state after undo contains no selection or operationLog', () => {
    const unsub = subscribeAutoSave();
    const rect = makeRectangle('r1');

    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['r1']));

    // Undo
    useCanvasStore.getState().undo();
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);

    const saved = JSON.parse(storage[STORAGE_KEY]);
    // Should only have expressions, expressionOrder, camera
    expect(saved).toHaveProperty('expressions');
    expect(saved).toHaveProperty('expressionOrder');
    expect(saved).toHaveProperty('camera');
    expect(saved).not.toHaveProperty('selectedIds');
    expect(saved).not.toHaveProperty('operationLog');
    expect(saved).not.toHaveProperty('canUndo');
    expect(saved).not.toHaveProperty('canRedo');
    expect(saved).not.toHaveProperty('activeTool');

    unsub();
  });
});

describe('Quota error during auto-save does not break undo [EDGE][AC6 #9]', () => {
  it('undo still works even when auto-save fails with QuotaExceeded', () => {
    const rect = makeRectangle('r1');
    const ellipse = makeEllipse('e1');

    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().addExpression(ellipse);

    // Now make localStorage throw on write
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMockStorage({ throwOnSet: true }),
      writable: true,
      configurable: true,
    });

    const unsub = subscribeAutoSave();

    // Add another expression — auto-save will fail
    const r2 = makeRectangle('r2', 'Will fail save');
    useCanvasStore.getState().addExpression(r2);

    // Advance past debounce — save fails silently
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);

    // Undo should still work (uses in-memory history, not localStorage)
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['r2']).toBeUndefined();
    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(2);

    unsub();
  });
});

describe('Rapid undo/redo debounce coalescing [EDGE][AC1 #9, AC3 #8]', () => {
  it('rapid undo/redo saves only the final state after debounce', () => {
    const unsub = subscribeAutoSave();

    // Set up history: add 3 expressions
    const r1 = makeRectangle('r1', 'One');
    const r2 = makeRectangle('r2', 'Two');
    const r3 = makeRectangle('r3', 'Three');
    useCanvasStore.getState().addExpression(r1);
    useCanvasStore.getState().addExpression(r2);
    useCanvasStore.getState().addExpression(r3);
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);

    // Rapid undo × 3 then redo × 1 (all within debounce window)
    useCanvasStore.getState().undo();  // 3 → 2
    useCanvasStore.getState().undo();  // 2 → 1
    useCanvasStore.getState().undo();  // 1 → 0
    useCanvasStore.getState().redo();  // 0 → 1

    // Only 1 expression should be in the store
    expect(Object.keys(useCanvasStore.getState().expressions)).toHaveLength(1);

    // Advance debounce — should save with 1 expression
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);
    const saved = JSON.parse(storage[STORAGE_KEY]);
    expect(Object.keys(saved.expressions)).toHaveLength(1);

    unsub();
  });
});

describe('Camera persistence across undo [COVERAGE][AC4 #9, AC8 #8]', () => {
  it('camera is preserved when undo restores expressions (camera not snapshotted)', () => {
    const rect = makeRectangle('r1');
    useCanvasStore.getState().addExpression(rect);

    // Change camera
    useCanvasStore.getState().setCamera({ x: 500, y: 300, zoom: 2.5 });

    // Undo removes the expression, but camera should be preserved
    // (by design: AC8 says camera changes don't push snapshots)
    useCanvasStore.getState().undo();

    const state = useCanvasStore.getState();
    expect(state.expressions['r1']).toBeUndefined();
    // Camera is NOT snapshotted, so it stays at its current value
    expect(state.camera).toEqual({ x: 500, y: 300, zoom: 2.5 });
  });

  it('auto-save preserves camera even after undo', () => {
    const unsub = subscribeAutoSave();

    const rect = makeRectangle('r1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setCamera({ x: 100, y: 200, zoom: 3 });

    // Undo expression add
    useCanvasStore.getState().undo();
    vi.advanceTimersByTime(DEBOUNCE_MS + 100);

    const saved = JSON.parse(storage[STORAGE_KEY]);
    expect(saved.camera).toEqual({ x: 100, y: 200, zoom: 3 });
    expect(Object.keys(saved.expressions)).toHaveLength(0);

    unsub();
  });
});
