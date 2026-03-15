// @vitest-environment jsdom
/**
 * Unit tests for Sprint 7 review findings — engine package.
 *
 * S7-1: replaceState() validates each expression with Zod.
 * S7-2: loadCanvasState() validates each expression with Zod.
 * S7-5: styleExpressions() validates style partial before applying.
 * S7-6: Keyboard handlers skip editable targets.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExpressionBuilder } from '@infinicanvas/protocol';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';
import { useCanvasStore } from '../store/canvasStore.js';
import {
  saveCanvasState,
  loadCanvasState,
  STORAGE_KEY,
} from '../persistence/localStorage.js';
import type { PersistedCanvasState } from '../persistence/localStorage.js';
import { isEditableTarget } from '../utils/isEditableTarget.js';

// ── Test fixtures ──────────────────────────────────────────

const testAuthor = { type: 'human' as const, id: 'user-1', name: 'Test User' };
const builder = new ExpressionBuilder(testAuthor);

const DEFAULT_STYLE: ExpressionStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

function makeRectangle(id: string): VisualExpression {
  return { ...builder.rectangle(100, 200, 300, 150).label('Rect').build(), id };
}

function makeInvalidExpression(): Record<string, unknown> {
  return {
    id: 'bad-expr',
    kind: 'rectangle',
    position: { x: 0, y: 0 },
    size: { width: -1, height: -1 }, // Invalid: negative dimensions
    angle: 0,
    style: DEFAULT_STYLE,
    meta: {
      author: testAuthor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: [],
      locked: false,
    },
    data: { kind: 'rectangle' },
  };
}

// ── Store reset ────────────────────────────────────────────

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
  });
  useCanvasStore.getState().clearHistory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════
// S7-1: replaceState() validates each expression
// ═══════════════════════════════════════════════════════════

describe('S7-1: replaceState() per-expression Zod validation', () => {
  it('inserts valid expressions into state', () => {
    const rect1 = makeRectangle('rect-1');
    const rect2 = makeRectangle('rect-2');

    useCanvasStore.getState().replaceState(
      [rect1, rect2],
      ['rect-1', 'rect-2'],
    );

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(2);
    expect(state.expressions['rect-1']).toBeDefined();
    expect(state.expressions['rect-2']).toBeDefined();
    expect(state.expressionOrder).toEqual(['rect-1', 'rect-2']);
  });

  it('rejects invalid expressions with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid = makeRectangle('rect-1');
    const invalid = makeInvalidExpression() as unknown as VisualExpression;

    useCanvasStore.getState().replaceState(
      [valid, invalid],
      ['rect-1', 'bad-expr'],
    );

    const state = useCanvasStore.getState();
    expect(Object.keys(state.expressions)).toHaveLength(1);
    expect(state.expressions['rect-1']).toBeDefined();
    expect(state.expressions['bad-expr']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[canvasStore] replaceState'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('filters expressionOrder to only include validated IDs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid = makeRectangle('rect-1');
    const invalid = makeInvalidExpression() as unknown as VisualExpression;

    useCanvasStore.getState().replaceState(
      [valid, invalid],
      ['rect-1', 'bad-expr'],
    );

    const state = useCanvasStore.getState();
    expect(state.expressionOrder).toEqual(['rect-1']);
    expect(state.expressionOrder).not.toContain('bad-expr');
    warnSpy.mockRestore();
  });

  it('uses Zod-stripped data (result.data) to prevent prototype pollution', () => {
    // Create a valid expression with an extra prototype-polluting field
    const rect = makeRectangle('rect-1');
    const polluted = {
      ...rect,
      __proto__: { isAdmin: true },
      extraField: 'should-be-stripped',
    };

    useCanvasStore.getState().replaceState(
      [polluted as unknown as VisualExpression],
      ['rect-1'],
    );

    const state = useCanvasStore.getState();
    const stored = state.expressions['rect-1'];
    expect(stored).toBeDefined();
    // Extra fields not in schema should be stripped by Zod
    expect((stored as Record<string, unknown>).extraField).toBeUndefined();
  });

  it('clears operationLog and selectedIds on replaceState', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    useCanvasStore.getState().setSelectedIds(new Set(['rect-1']));

    const newRect = makeRectangle('rect-2');
    useCanvasStore.getState().replaceState([newRect], ['rect-2']);

    const state = useCanvasStore.getState();
    expect(state.operationLog).toHaveLength(0);
    expect(state.selectedIds.size).toBe(0);
  });

  it('clears undo history so undo is unavailable after replaceState', () => {
    const rect1 = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect1);
    expect(useCanvasStore.getState().canUndo).toBe(true);

    const rect2 = makeRectangle('rect-2');
    useCanvasStore.getState().replaceState([rect2], ['rect-2']);

    const state = useCanvasStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);

    // Undo should be a no-op
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().expressions['rect-2']).toBeDefined();
    expect(useCanvasStore.getState().expressions['rect-1']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════
// S7-2: loadCanvasState() per-expression validation
// ═══════════════════════════════════════════════════════════

describe('S7-2: loadCanvasState() per-expression Zod validation', () => {
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

  it('loads valid expressions successfully', () => {
    const rect = makeRectangle('rect-1');
    const state: PersistedCanvasState = {
      expressions: { 'rect-1': rect },
      expressionOrder: ['rect-1'],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    storage[STORAGE_KEY] = JSON.stringify(state);

    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();
    expect(loaded!.expressions['rect-1']).toBeDefined();
    expect(loaded!.expressionOrder).toEqual(['rect-1']);
  });

  it('filters out invalid expressions with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid = makeRectangle('rect-1');
    const invalid = makeInvalidExpression();
    const state = {
      expressions: { 'rect-1': valid, 'bad-expr': invalid },
      expressionOrder: ['rect-1', 'bad-expr'],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    storage[STORAGE_KEY] = JSON.stringify(state);

    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();
    expect(loaded!.expressions['rect-1']).toBeDefined();
    expect(loaded!.expressions['bad-expr']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[persistence] Invalid expression'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('filters expressionOrder to match validated expressions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid = makeRectangle('rect-1');
    const invalid = makeInvalidExpression();
    const state = {
      expressions: { 'rect-1': valid, 'bad-expr': invalid },
      expressionOrder: ['rect-1', 'bad-expr'],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    storage[STORAGE_KEY] = JSON.stringify(state);

    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();
    expect(loaded!.expressionOrder).toEqual(['rect-1']);
    expect(loaded!.expressionOrder).not.toContain('bad-expr');
    warnSpy.mockRestore();
  });

  it('returns state with empty expressions if all are invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invalid = makeInvalidExpression();
    const state = {
      expressions: { 'bad-expr': invalid },
      expressionOrder: ['bad-expr'],
      camera: { x: 0, y: 0, zoom: 1 },
    };
    storage[STORAGE_KEY] = JSON.stringify(state);

    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!.expressions)).toHaveLength(0);
    expect(loaded!.expressionOrder).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('preserves camera state even when expressions are filtered', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invalid = makeInvalidExpression();
    const state = {
      expressions: { 'bad-expr': invalid },
      expressionOrder: ['bad-expr'],
      camera: { x: 42, y: 99, zoom: 2.5 },
    };
    storage[STORAGE_KEY] = JSON.stringify(state);

    const loaded = loadCanvasState();
    expect(loaded).not.toBeNull();
    expect(loaded!.camera).toEqual({ x: 42, y: 99, zoom: 2.5 });
    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════
// S7-5: styleExpressions() validates style partial
// ═══════════════════════════════════════════════════════════

describe('S7-5: styleExpressions() validates style partial', () => {
  it('applies valid style to expressions', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: '#ff0000',
      opacity: 0.5,
    });

    const state = useCanvasStore.getState();
    expect(state.expressions['rect-1']?.style.strokeColor).toBe('#ff0000');
    expect(state.expressions['rect-1']?.style.opacity).toBe(0.5);
  });

  it('rejects invalid style with console.warn and does not mutate', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);

    const originalStroke = rect.style.strokeColor;

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: 'not-a-hex-color',
    } as Partial<ExpressionStyle>);

    const state = useCanvasStore.getState();
    // Style should NOT have changed
    expect(state.expressions['rect-1']?.style.strokeColor).toBe(originalStroke);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[canvasStore] styleExpressions'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('skips locked expressions', () => {
    const rect = makeRectangle('rect-1');
    rect.meta.locked = true;
    useCanvasStore.getState().addExpression(rect);

    const originalStroke = rect.style.strokeColor;

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: '#ff0000',
    });

    const state = useCanvasStore.getState();
    // Locked expression should NOT have changed
    expect(state.expressions['rect-1']?.style.strokeColor).toBe(originalStroke);
  });

  it('emits a style ProtocolOperation', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);
    const logBefore = useCanvasStore.getState().operationLog.length;

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: '#ff0000',
    });

    const state = useCanvasStore.getState();
    const newOps = state.operationLog.slice(logBefore);
    expect(newOps).toHaveLength(1);
    expect(newOps[0]!.type).toBe('style');
    expect(newOps[0]!.payload).toMatchObject({
      type: 'style',
      expressionIds: ['rect-1'],
    });
  });

  it('supports undo after styleExpressions', () => {
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);

    const originalStroke = rect.style.strokeColor;

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeColor: '#ff0000',
    });

    expect(useCanvasStore.getState().expressions['rect-1']?.style.strokeColor).toBe('#ff0000');

    useCanvasStore.getState().undo();

    expect(useCanvasStore.getState().expressions['rect-1']?.style.strokeColor).toBe(originalStroke);
  });

  it('does nothing for empty ids array', () => {
    const logBefore = useCanvasStore.getState().operationLog.length;
    useCanvasStore.getState().styleExpressions([], { strokeColor: '#ff0000' });
    expect(useCanvasStore.getState().operationLog.length).toBe(logBefore);
  });

  it('rejects invalid style property types', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rect = makeRectangle('rect-1');
    useCanvasStore.getState().addExpression(rect);

    useCanvasStore.getState().styleExpressions(['rect-1'], {
      strokeWidth: -5, // Invalid: must be >= 1
    } as Partial<ExpressionStyle>);

    // Should be rejected, no mutation
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════
// S7-6: isEditableTarget guard
// ═══════════════════════════════════════════════════════════

describe('S7-6: isEditableTarget guard', () => {
  it('returns false for null target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it('returns false for non-HTMLElement target', () => {
    const target = { tagName: 'INPUT' } as EventTarget;
    expect(isEditableTarget(target)).toBe(false);
  });

  it('returns true for INPUT element', () => {
    const input = document.createElement('input');
    expect(isEditableTarget(input)).toBe(true);
  });

  it('returns true for TEXTAREA element', () => {
    const textarea = document.createElement('textarea');
    expect(isEditableTarget(textarea)).toBe(true);
  });

  it('returns true for SELECT element', () => {
    const select = document.createElement('select');
    expect(isEditableTarget(select)).toBe(true);
  });

  it('returns true for contentEditable element', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns false for regular div', () => {
    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);
  });

  it('returns false for canvas element', () => {
    const canvas = document.createElement('canvas');
    expect(isEditableTarget(canvas)).toBe(false);
  });
});
