/**
 * Edge case tests for persistence layer.
 *
 * Tests boundary conditions, special characters, and
 * structural validation that the existing unit tests don't cover.
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

// ── Fixtures ──────────────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

function makeRectangle(id: string, label = 'Rect'): VisualExpression {
  return { ...builder.rectangle(100, 200, 300, 150).label(label).build(), id };
}

// ── Mock localStorage ──────────────────────────────────────────

let storage: Record<string, string>;

function createMockStorage(): Storage {
  return {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
    clear: vi.fn(() => { storage = {}; }),
    get length() { return Object.keys(storage).length; },
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

// ── Tests ──────────────────────────────────────────────────────

describe('Unicode and special characters [EDGE][AC10 #9]', () => {
  it('preserves emoji in expression labels through roundtrip', () => {
    const expr = makeRectangle('emoji-1', '🎨 Canvas Art 🖌️');
    const state: PersistedCanvasState = {
      expressions: { 'emoji-1': expr },
      expressionOrder: ['emoji-1'],
      camera: { x: 0, y: 0, zoom: 1 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.expressions['emoji-1']!.data.label).toBe('🎨 Canvas Art 🖌️');
  });

  it('preserves CJK characters in expression data', () => {
    const expr = makeRectangle('cjk-1', '你好世界 こんにちは 안녕하세요');
    const state: PersistedCanvasState = {
      expressions: { 'cjk-1': expr },
      expressionOrder: ['cjk-1'],
      camera: { x: 0, y: 0, zoom: 1 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.expressions['cjk-1']!.data.label).toBe('你好世界 こんにちは 안녕하세요');
  });

  it('handles expressions with special JSON characters in labels', () => {
    const expr = makeRectangle('special-1', '"quotes" and \\backslashes\\ and \nnewlines');
    const state: PersistedCanvasState = {
      expressions: { 'special-1': expr },
      expressionOrder: ['special-1'],
      camera: { x: 0, y: 0, zoom: 1 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.expressions['special-1']!.data.label).toBe(
      '"quotes" and \\backslashes\\ and \nnewlines',
    );
  });
});

describe('Corrupted expression within valid JSON [EDGE][AC5 #9]', () => {
  it('loads state even when individual expression has extra/unknown fields', () => {
    // Valid structure but expression has extra fields
    const json = JSON.stringify({
      expressions: {
        'r1': {
          ...makeRectangle('r1'),
          unexpectedField: 'this should not cause a crash',
        },
      },
      expressionOrder: ['r1'],
      camera: { x: 0, y: 0, zoom: 1 },
    });
    storage[STORAGE_KEY] = json;

    const loaded = loadCanvasState();
    // Structural validation only checks top-level shape, not individual expressions
    expect(loaded).not.toBeNull();
    expect(loaded!.expressionOrder).toEqual(['r1']);
  });

  it('loads state when expression order references non-existent IDs', () => {
    // expressionOrder includes IDs not in expressions map
    const json = JSON.stringify({
      expressions: { 'r1': makeRectangle('r1') },
      expressionOrder: ['r1', 'ghost-id'],
      camera: { x: 0, y: 0, zoom: 1 },
    });
    storage[STORAGE_KEY] = json;

    const loaded = loadCanvasState();
    // [S7-2] Per-expression validation now filters expressionOrder to match valid expressions
    expect(loaded).not.toBeNull();
    expect(loaded!.expressionOrder).toEqual(['r1']);
  });
});

describe('Persisted state schema contract [CONTRACT][AC10 #9]', () => {
  it('saved state contains exactly the required fields', () => {
    const state: PersistedCanvasState = {
      expressions: { 'r1': makeRectangle('r1') },
      expressionOrder: ['r1'],
      camera: { x: 10, y: 20, zoom: 1.5 },
    };

    saveCanvasState(state);
    const parsed = JSON.parse(storage[STORAGE_KEY]);

    // Exactly these keys and no more
    expect(Object.keys(parsed).sort()).toEqual(['camera', 'expressionOrder', 'expressions']);
    expect(Object.keys(parsed.camera).sort()).toEqual(['x', 'y', 'zoom']);
  });

  it('camera values are finite numbers after roundtrip', () => {
    const state: PersistedCanvasState = {
      expressions: {},
      expressionOrder: [],
      camera: { x: -1000.5, y: 9999.99, zoom: 0.01 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(Number.isFinite(loaded!.camera.x)).toBe(true);
    expect(Number.isFinite(loaded!.camera.y)).toBe(true);
    expect(Number.isFinite(loaded!.camera.zoom)).toBe(true);
    expect(loaded!.camera).toEqual({ x: -1000.5, y: 9999.99, zoom: 0.01 });
  });

  it('rejects camera with NaN zoom', () => {
    const json = JSON.stringify({
      expressions: {},
      expressionOrder: [],
      camera: { x: 0, y: 0, zoom: NaN },
    });
    // NaN becomes null in JSON
    storage[STORAGE_KEY] = json;

    const loaded = loadCanvasState();
    // NaN serializes as null in JSON → camera validation fails
    expect(loaded).toBeNull();
  });

  it('rejects camera with Infinity', () => {
    // Infinity becomes null in JSON
    const json = JSON.stringify({
      expressions: {},
      expressionOrder: [],
      camera: { x: Infinity, y: 0, zoom: 1 },
    });
    storage[STORAGE_KEY] = json;

    const loaded = loadCanvasState();
    expect(loaded).toBeNull();
  });
});

describe('Empty and boundary states [EDGE]', () => {
  it('empty expressions map roundtrips correctly', () => {
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
  });

  it('many expressions roundtrip correctly', () => {
    const expressions: Record<string, VisualExpression> = {};
    const order: string[] = [];

    for (let i = 0; i < 100; i++) {
      const id = `rect-${i}`;
      expressions[id] = makeRectangle(id, `Label ${i}`);
      order.push(id);
    }

    const state: PersistedCanvasState = {
      expressions,
      expressionOrder: order,
      camera: { x: 0, y: 0, zoom: 1 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!.expressions)).toHaveLength(100);
    expect(loaded!.expressionOrder).toHaveLength(100);
    expect(loaded!.expressionOrder[0]).toBe('rect-0');
    expect(loaded!.expressionOrder[99]).toBe('rect-99');
  });

  it('camera at extreme zoom boundaries roundtrips', () => {
    const state: PersistedCanvasState = {
      expressions: {},
      expressionOrder: [],
      camera: { x: -99999, y: 99999, zoom: 0.001 },
    };

    saveCanvasState(state);
    const loaded = loadCanvasState();

    expect(loaded).not.toBeNull();
    expect(loaded!.camera.zoom).toBe(0.001);
  });
});

describe('Truncated/partial JSON [EDGE][AC5 #9]', () => {
  it('returns null for truncated JSON string', () => {
    storage[STORAGE_KEY] = '{"expressions":{"r1":';
    const loaded = loadCanvasState();
    expect(loaded).toBeNull();
  });

  it('returns null for JSON array instead of object', () => {
    storage[STORAGE_KEY] = '[1, 2, 3]';
    const loaded = loadCanvasState();
    expect(loaded).toBeNull();
  });

  it('returns null for JSON string value', () => {
    storage[STORAGE_KEY] = '"just a string"';
    const loaded = loadCanvasState();
    expect(loaded).toBeNull();
  });

  it('returns null for JSON number', () => {
    storage[STORAGE_KEY] = '42';
    const loaded = loadCanvasState();
    expect(loaded).toBeNull();
  });

  it('returns null for JSON null', () => {
    storage[STORAGE_KEY] = 'null';
    const loaded = loadCanvasState();
    expect(loaded).toBeNull();
  });
});
