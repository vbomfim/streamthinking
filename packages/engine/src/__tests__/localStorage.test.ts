/**
 * Unit tests for localStorage persistence module.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Each test maps to an acceptance criterion from Issue #9.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression } from '@infinicanvas/protocol';
import {
  saveCanvasState,
  loadCanvasState,
  STORAGE_KEY,
} from '../persistence/localStorage.js';
import type { PersistedCanvasState } from '../persistence/localStorage.js';
import type { Camera } from '../types/index.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string): VisualExpression {
  return { ...builder.rectangle(100, 200, 300, 150).label('Rect').build(), id };
}

function makeTestState(): PersistedCanvasState {
  const expr = makeRectangle('rect-1');
  return {
    expressions: { 'rect-1': expr },
    expressionOrder: ['rect-1'],
    camera: { x: 10, y: 20, zoom: 1.5 },
  };
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

beforeEach(() => {
  storage = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockStorage(),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── AC8: Storage key ───────────────────────────────────────

describe('STORAGE_KEY', () => {
  it('[AC8] uses the key "infinicanvas:state"', () => {
    expect(STORAGE_KEY).toBe('infinicanvas:state');
  });
});

// ── AC10: Serialize / deserialize roundtrip ────────────────

describe('saveCanvasState + loadCanvasState roundtrip', () => {
  it('[AC10] serializes and deserializes state correctly', () => {
    const state = makeTestState();

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.expressionOrder).toEqual(['rect-1']);
    expect(loaded!.expressions['rect-1']!.id).toBe('rect-1');
    expect(loaded!.expressions['rect-1']!.kind).toBe('rectangle');
  });

  it('[AC4] preserves camera state through roundtrip', () => {
    const state = makeTestState();

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.camera).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it('preserves expression data through roundtrip', () => {
    const state = makeTestState();

    saveCanvasState(state);
    const loaded = loadCanvasState();

    const original = state.expressions['rect-1']!;
    const restored = loaded!.expressions['rect-1']!;
    expect(restored.position).toEqual(original.position);
    expect(restored.size).toEqual(original.size);
    expect(restored.style).toEqual(original.style);
  });

  it('handles multiple expressions', () => {
    const rect1 = makeRectangle('rect-1');
    const rect2 = makeRectangle('rect-2');
    const state: PersistedCanvasState = {
      expressions: { 'rect-1': rect1, 'rect-2': rect2 },
      expressionOrder: ['rect-1', 'rect-2'],
      camera: { x: 0, y: 0, zoom: 1 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!.expressions)).toHaveLength(2);
    expect(loaded!.expressionOrder).toEqual(['rect-1', 'rect-2']);
  });

  it('handles empty state', () => {
    const state: PersistedCanvasState = {
      expressions: {},
      expressionOrder: [],
      camera: { x: 0, y: 0, zoom: 1 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.expressions).toEqual({});
    expect(loaded!.expressionOrder).toEqual([]);
    expect(loaded!.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

// ── AC9: Undo/redo NOT persisted ───────────────────────────

describe('AC9: excludes transient state', () => {
  it('[AC9] does NOT persist undo/redo history, selection, or operationLog', () => {
    const state = makeTestState();
    saveCanvasState(state);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('selectedIds');
    expect(parsed).not.toHaveProperty('activeTool');
    expect(parsed).not.toHaveProperty('operationLog');
    expect(parsed).not.toHaveProperty('canUndo');
    expect(parsed).not.toHaveProperty('canRedo');
  });
});

// ── AC8: Storage key used correctly ────────────────────────

describe('saveCanvasState', () => {
  it('[AC8] writes to the correct storage key', () => {
    const state = makeTestState();
    saveCanvasState(state);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'infinicanvas:state',
      expect.any(String),
    );
  });
});

// ── AC3 + AC10: Missing key → null ─────────────────────────

describe('loadCanvasState — missing key', () => {
  it('[AC3] returns null when no saved state exists', () => {
    const result = loadCanvasState();
    expect(result).toBeNull();
  });

  it('[AC3] returns null when storage contains empty string', () => {
    storage[STORAGE_KEY] = '';
    const result = loadCanvasState();
    expect(result).toBeNull();
  });
});

// ── AC5: Corrupt data → warn + null ────────────────────────

describe('loadCanvasState — corrupt data', () => {
  it('[AC5] returns null for invalid JSON and logs warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage[STORAGE_KEY] = '{not valid json!!!';

    const result = loadCanvasState();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[persistence]'),
      expect.anything(),
    );
  });

  it('[AC5] returns null when parsed data is not an object', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage[STORAGE_KEY] = '"just a string"';

    const result = loadCanvasState();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('[AC5] returns null when expressions field is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage[STORAGE_KEY] = JSON.stringify({ camera: { x: 0, y: 0, zoom: 1 } });

    const result = loadCanvasState();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('[AC5] returns null when expressionOrder is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage[STORAGE_KEY] = JSON.stringify({
      expressions: {},
      camera: { x: 0, y: 0, zoom: 1 },
    });

    const result = loadCanvasState();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('[AC5] returns null when camera is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage[STORAGE_KEY] = JSON.stringify({
      expressions: {},
      expressionOrder: [],
    });

    const result = loadCanvasState();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('[AC5] returns null when camera has invalid zoom', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage[STORAGE_KEY] = JSON.stringify({
      expressions: {},
      expressionOrder: [],
      camera: { x: 0, y: 0, zoom: 'invalid' },
    });

    const result = loadCanvasState();

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ── AC6: Quota exceeded → error, continue ──────────────────

describe('saveCanvasState — quota exceeded', () => {
  it('[AC6] logs error and does not throw when quota is exceeded', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const quotaError = new DOMException('quota exceeded', 'QuotaExceededError');
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw quotaError;
    });

    expect(() => saveCanvasState(makeTestState())).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[persistence]'),
      expect.anything(),
    );
  });
});

// ── AC7: localStorage unavailable → catch, continue ────────

describe('saveCanvasState — localStorage unavailable', () => {
  it('[AC7] does not throw when localStorage is unavailable on save', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('localStorage is disabled');
      },
      configurable: true,
    });

    expect(() => saveCanvasState(makeTestState())).not.toThrow();
  });
});

describe('loadCanvasState — localStorage unavailable', () => {
  it('[AC7] returns null when localStorage is unavailable on load', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('localStorage is disabled');
      },
      configurable: true,
    });

    const result = loadCanvasState();
    expect(result).toBeNull();
  });
});
