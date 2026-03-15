/**
 * Unit tests for the useAutoSave hook.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Tests auto-save behavior: debouncing, selective persistence, and error handling.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import { STORAGE_KEY } from '../persistence/localStorage.js';
import { subscribeAutoSave, DEBOUNCE_MS } from '../hooks/useAutoSave.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  return { ...builder.rectangle(100, 200, 300, 150).label('Rect').build(), id };
}

// ── Mock localStorage ──────────────────────────────────────

let storage: Record<string, string>;

function createMockStorage(): Storage {
  return {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      storage = {};
    }),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
  };
}

// ── Setup & teardown ───────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  storage = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockStorage(),
    writable: true,
    configurable: true,
  });
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

// ── AC1: Auto-save after 2s of inactivity ──────────────────

describe('subscribeAutoSave — debounced persistence', () => {
  it('[AC1] exports DEBOUNCE_MS as 2000', () => {
    expect(DEBOUNCE_MS).toBe(2000);
  });

  it('[AC1] saves to localStorage after debounce delay', () => {
    const unsubscribe = subscribeAutoSave();

    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));

    // Before debounce fires, nothing saved
    expect(localStorage.setItem).not.toHaveBeenCalled();

    // After debounce fires
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );

    unsubscribe();
  });

  it('[AC1] debounces multiple rapid changes into a single save', () => {
    const unsubscribe = subscribeAutoSave();

    // Make 3 rapid changes
    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    vi.advanceTimersByTime(500);
    useCanvasStore.getState().addExpression(makeRectangle('rect-2'));
    vi.advanceTimersByTime(500);
    useCanvasStore.getState().addExpression(makeRectangle('rect-3'));

    // Wait for the full debounce period from last change
    vi.advanceTimersByTime(DEBOUNCE_MS);

    // Should save only once with all 3 expressions
    const setCalls = vi.mocked(localStorage.setItem).mock.calls.filter(
      ([key]) => key === STORAGE_KEY,
    );
    expect(setCalls).toHaveLength(1);

    const saved = JSON.parse(setCalls[0]![1]!) as Record<string, unknown>;
    const expressions = saved.expressions as Record<string, unknown>;
    expect(Object.keys(expressions)).toHaveLength(3);

    unsubscribe();
  });

  it('does not save before debounce period elapses', () => {
    const unsubscribe = subscribeAutoSave();

    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);

    expect(localStorage.setItem).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('[AC4] saves camera changes', () => {
    const unsubscribe = subscribeAutoSave();

    useCanvasStore.getState().setCamera({ x: 100, y: 200, zoom: 2 });
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );

    const saved = JSON.parse(
      vi.mocked(localStorage.setItem).mock.calls[0]![1]!,
    ) as Record<string, unknown>;
    expect(saved.camera).toEqual({ x: 100, y: 200, zoom: 2 });

    unsubscribe();
  });
});

// ── AC9: Selective persistence ─────────────────────────────

describe('subscribeAutoSave — excludes transient state', () => {
  it('[AC9] does NOT persist selection, activeTool, operationLog, or undo state', () => {
    const unsubscribe = subscribeAutoSave();

    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));
    useCanvasStore.getState().setActiveTool('rectangle');

    vi.advanceTimersByTime(DEBOUNCE_MS);

    const raw = vi.mocked(localStorage.setItem).mock.calls.find(
      ([key]) => key === STORAGE_KEY,
    );
    expect(raw).toBeDefined();

    const saved = JSON.parse(raw![1]!) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('selectedIds');
    expect(saved).not.toHaveProperty('activeTool');
    expect(saved).not.toHaveProperty('operationLog');
    expect(saved).not.toHaveProperty('canUndo');
    expect(saved).not.toHaveProperty('canRedo');

    unsubscribe();
  });
});

// ── Unsubscribe ────────────────────────────────────────────

describe('subscribeAutoSave — cleanup', () => {
  it('stops saving after unsubscribe', () => {
    const unsubscribe = subscribeAutoSave();
    unsubscribe();

    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('clears pending debounce timer on unsubscribe', () => {
    const unsubscribe = subscribeAutoSave();

    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    vi.advanceTimersByTime(500); // Partial debounce

    unsubscribe();

    vi.advanceTimersByTime(DEBOUNCE_MS); // Full debounce after unsub

    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});

// ── Error handling ─────────────────────────────────────────

describe('subscribeAutoSave — error handling', () => {
  it('continues operating after a save error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = subscribeAutoSave();

    // First save fails
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    useCanvasStore.getState().addExpression(makeRectangle('rect-1'));
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(errorSpy).toHaveBeenCalled();

    // Restore normal behavior — next save should succeed
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      storage[key] = value;
    });

    useCanvasStore.getState().addExpression(makeRectangle('rect-2'));
    vi.advanceTimersByTime(DEBOUNCE_MS);

    expect(storage[STORAGE_KEY]).toBeDefined();

    unsubscribe();
  });
});
