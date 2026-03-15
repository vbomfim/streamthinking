// @vitest-environment jsdom
/**
 * Unit tests for useKeyboardShortcuts hook — centralized keyboard shortcut system.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Acceptance criteria from Issue #10.
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useCanvasStore } from '../store/canvasStore.js';
import type { VisualExpression, ExpressionStyle } from '@infinicanvas/protocol';

// ── Test fixtures ──────────────────────────────────────────

const DEFAULT_STYLE: ExpressionStyle = {
  strokeColor: '#000000',
  backgroundColor: 'transparent',
  fillStyle: 'none',
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
};

const DEFAULT_META = {
  author: { type: 'agent' as const, id: 'test', name: 'Test', provider: 'test' },
  createdAt: 0,
  updatedAt: 0,
  tags: [],
  locked: false,
};

function makeRect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  locked = false,
): VisualExpression {
  return {
    id,
    kind: 'rectangle',
    position: { x, y },
    size: { width: w, height: h },
    angle: 0,
    style: DEFAULT_STYLE,
    meta: { ...DEFAULT_META, locked },
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

// ── Helper to dispatch keyboard events ─────────────────────

function fireKeydown(
  key: string,
  options: Partial<KeyboardEventInit> & { target?: EventTarget } = {},
): KeyboardEvent {
  const { target, ...eventOptions } = options;
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...eventOptions,
  });
  // If a target is specified, dispatch on that element; otherwise on window
  (target ?? window).dispatchEvent(event);
  return event;
}

/** Create a text input element to simulate typing focus. */
function createTextInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  document.body.appendChild(input);
  return input;
}

/** Create a textarea element to simulate typing focus. */
function createTextarea(): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  return textarea;
}

/** Create a contenteditable div to simulate rich-text editing. */
function createContentEditable(): HTMLDivElement {
  const div = document.createElement('div');
  div.contentEditable = 'true';
  document.body.appendChild(div);
  return div;
}

/** Default cancelDraw no-op for tests that don't test drawing cancellation. */
const noopCancelDraw = vi.fn();

// ── Tests ──────────────────────────────────────────────────

describe('useKeyboardShortcuts', () => {
  // ── Lifecycle ────────────────────────────────────────────

  describe('lifecycle', () => {
    it('registers keydown listener on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      unmount();
    });

    it('removes keydown listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // ── Tool switching shortcuts ─────────────────────────────

  describe('tool switching', () => {
    const toolMappings: Array<{ keys: string[]; tool: string }> = [
      { keys: ['v', '1'], tool: 'select' },
      { keys: ['r', '2'], tool: 'rectangle' },
      { keys: ['o', '3'], tool: 'ellipse' },
      { keys: ['d', '4'], tool: 'diamond' },
      { keys: ['l', '5'], tool: 'line' },
      { keys: ['a', '6'], tool: 'arrow' },
      { keys: ['p', '7'], tool: 'freehand' },
      { keys: ['t', '8'], tool: 'text' },
    ];

    for (const { keys, tool } of toolMappings) {
      for (const key of keys) {
        it(`pressing '${key}' switches to ${tool} tool`, () => {
          // Start with a different tool
          useCanvasStore.setState({ activeTool: 'select' });
          renderHook(() =>
            useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
          );

          fireKeydown(key);

          expect(useCanvasStore.getState().activeTool).toBe(tool);
        });
      }
    }

    it('handles uppercase letters for tool switching', () => {
      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('R');

      expect(useCanvasStore.getState().activeTool).toBe('rectangle');
    });

    it('does not switch tools when modifier key is held', () => {
      useCanvasStore.setState({ activeTool: 'select' });
      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      // Ctrl+D should NOT switch to diamond — it's duplicate
      fireKeydown('d', { ctrlKey: true });

      expect(useCanvasStore.getState().activeTool).toBe('select');
    });
  });

  // ── Undo / Redo (consolidated from useUndoRedoShortcuts) ─

  describe('undo / redo', () => {
    it('Ctrl+Z triggers undo', () => {
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('z', { ctrlKey: true });

      expect(undoSpy).toHaveBeenCalledTimes(1);
    });

    it('Cmd+Z triggers undo (Mac)', () => {
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('z', { metaKey: true });

      expect(undoSpy).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Shift+Z triggers redo', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('z', { ctrlKey: true, shiftKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('Cmd+Shift+Z triggers redo (Mac)', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('z', { metaKey: true, shiftKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Y triggers redo', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('y', { ctrlKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+Shift+Z is redo, NOT undo', () => {
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('z', { ctrlKey: true, shiftKey: true });

      expect(undoSpy).not.toHaveBeenCalled();
    });
  });

  // ── Delete selected ──────────────────────────────────────

  describe('delete selected', () => {
    it('Delete key removes selected expressions', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('Delete');

      const state = useCanvasStore.getState();
      expect(state.expressions['a']).toBeUndefined();
    });

    it('Backspace key removes selected expressions', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('Backspace');

      const state = useCanvasStore.getState();
      expect(state.expressions['a']).toBeUndefined();
    });

    it('does not delete locked expressions', () => {
      const lockedRect = makeRect('a', 100, 100, 200, 200, true);
      useCanvasStore.setState({
        expressions: { a: lockedRect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('Delete');

      const state = useCanvasStore.getState();
      expect(state.expressions['a']).toBeDefined();
    });

    it('does nothing when no selection', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set<string>(),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('Delete');

      const state = useCanvasStore.getState();
      expect(state.expressions['a']).toBeDefined();
    });
  });

  // ── Duplicate selected ───────────────────────────────────

  describe('duplicate selected (Ctrl+D / Cmd+D)', () => {
    it('Ctrl+D duplicates selected expression with offset', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('d', { ctrlKey: true });

      const state = useCanvasStore.getState();
      // Should have 2 expressions now
      expect(Object.keys(state.expressions)).toHaveLength(2);

      // New expression should be offset by +20, +20
      const newId = Object.keys(state.expressions).find((id) => id !== 'a');
      expect(newId).toBeDefined();
      const newExpr = state.expressions[newId!];
      expect(newExpr?.position).toEqual({ x: 120, y: 120 });
    });

    it('Cmd+D duplicates selected expression (Mac)', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('d', { metaKey: true });

      const state = useCanvasStore.getState();
      expect(Object.keys(state.expressions)).toHaveLength(2);
    });

    it('selects the duplicated expressions after duplication', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('d', { ctrlKey: true });

      const state = useCanvasStore.getState();
      // Original should NOT be selected; new one should
      expect(state.selectedIds.has('a')).toBe(false);
      expect(state.selectedIds.size).toBe(1);
    });
  });

  // ── Select All ───────────────────────────────────────────

  describe('select all (Ctrl+A / Cmd+A)', () => {
    it('Ctrl+A selects all expressions', () => {
      const a = makeRect('a', 100, 100, 200, 200);
      const b = makeRect('b', 400, 400, 100, 100);
      useCanvasStore.setState({
        expressions: { a, b },
        expressionOrder: ['a', 'b'],
        selectedIds: new Set<string>(),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('a', { ctrlKey: true });

      const state = useCanvasStore.getState();
      expect(state.selectedIds).toEqual(new Set(['a', 'b']));
    });

    it('Cmd+A selects all expressions (Mac)', () => {
      const a = makeRect('a', 100, 100, 200, 200);
      const b = makeRect('b', 400, 400, 100, 100);
      useCanvasStore.setState({
        expressions: { a, b },
        expressionOrder: ['a', 'b'],
        selectedIds: new Set<string>(),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('a', { metaKey: true });

      const state = useCanvasStore.getState();
      expect(state.selectedIds).toEqual(new Set(['a', 'b']));
    });

    it('prevents default browser select-all behavior', () => {
      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const event = fireKeydown('a', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });
  });

  // ── Escape ───────────────────────────────────────────────

  describe('escape', () => {
    it('deselects all expressions', () => {
      useCanvasStore.setState({
        selectedIds: new Set(['a', 'b']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('Escape');

      expect(useCanvasStore.getState().selectedIds.size).toBe(0);
    });

    it('switches back to select tool', () => {
      useCanvasStore.setState({ activeTool: 'rectangle' });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('Escape');

      expect(useCanvasStore.getState().activeTool).toBe('select');
    });

    it('calls cancelDraw callback', () => {
      const cancelDraw = vi.fn();
      renderHook(() => useKeyboardShortcuts({ cancelDraw }));

      fireKeydown('Escape');

      expect(cancelDraw).toHaveBeenCalledTimes(1);
    });
  });

  // ── Help panel toggle ────────────────────────────────────

  describe('help panel toggle (?)', () => {
    it('toggles showShortcutsHelp on ? key', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      expect(result.current.showShortcutsHelp).toBe(false);

      act(() => {
        fireKeydown('?');
      });

      expect(result.current.showShortcutsHelp).toBe(true);

      act(() => {
        fireKeydown('?');
      });

      expect(result.current.showShortcutsHelp).toBe(false);
    });

    it('closes help panel on Escape', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      // Open the panel
      act(() => {
        fireKeydown('?');
      });
      expect(result.current.showShortcutsHelp).toBe(true);

      // Close with Escape
      act(() => {
        fireKeydown('Escape');
      });
      expect(result.current.showShortcutsHelp).toBe(false);
    });
  });

  // ── Text input guard ─────────────────────────────────────

  describe('text input guard', () => {
    it('ignores shortcuts when focus is on an <input>', () => {
      useCanvasStore.setState({ activeTool: 'select' });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const input = createTextInput();
      input.focus();

      // Simulate keydown with target = input
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      // Tool should NOT change
      expect(useCanvasStore.getState().activeTool).toBe('select');
      input.remove();
    });

    it('ignores shortcuts when focus is on a <textarea>', () => {
      useCanvasStore.setState({ activeTool: 'select' });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const textarea = createTextarea();
      textarea.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'r',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: textarea });
      window.dispatchEvent(event);

      expect(useCanvasStore.getState().activeTool).toBe('select');
      textarea.remove();
    });

    it('ignores shortcuts when focus is on a contenteditable', () => {
      useCanvasStore.setState({ activeTool: 'select' });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const div = createContentEditable();
      div.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'r',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: div });
      window.dispatchEvent(event);

      expect(useCanvasStore.getState().activeTool).toBe('select');
      div.remove();
    });

    it('allows modifier shortcuts (Ctrl+Z) even in text inputs', () => {
      // Undo should still work in text inputs since users expect Ctrl+Z
      // to undo canvas operations even when a text overlay is open.
      // Actually, when typing in text input, Ctrl+Z should be native browser undo.
      // So we should SKIP it too.
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const input = createTextInput();
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      // Undo should NOT fire — let the input handle its own undo
      expect(undoSpy).not.toHaveBeenCalled();
      input.remove();
    });
  });

  // ── Prevents default browser behavior ────────────────────

  describe('prevents default browser behavior', () => {
    it('prevents default on Ctrl+Z', () => {
      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const event = fireKeydown('z', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });

    it('prevents default on Ctrl+D', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const event = fireKeydown('d', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });

    it('prevents default on Ctrl+A', () => {
      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const event = fireKeydown('a', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });

    it('prevents default on Delete when selection exists', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const event = fireKeydown('Delete');

      expect(event.defaultPrevented).toBe(true);
    });

    it('prevents default on Backspace when selection exists', () => {
      const rect = makeRect('a', 100, 100, 200, 200);
      useCanvasStore.setState({
        expressions: { a: rect },
        expressionOrder: ['a'],
        selectedIds: new Set(['a']),
      });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      const event = fireKeydown('Backspace');

      expect(event.defaultPrevented).toBe(true);
    });
  });

  // ── Edge: does NOT trigger on unrelated keys ─────────────

  describe('does NOT trigger on unrelated keys', () => {
    it('does not switch tools on random letters', () => {
      useCanvasStore.setState({ activeTool: 'select' });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('x');
      fireKeydown('z'); // z without Ctrl is not a tool shortcut
      fireKeydown('q');

      expect(useCanvasStore.getState().activeTool).toBe('select');
    });

    it('does not trigger actions on plain number keys beyond 8', () => {
      useCanvasStore.setState({ activeTool: 'select' });

      renderHook(() =>
        useKeyboardShortcuts({ cancelDraw: noopCancelDraw }),
      );

      fireKeydown('9');
      fireKeydown('0');

      expect(useCanvasStore.getState().activeTool).toBe('select');
    });
  });
});
