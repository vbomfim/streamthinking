// @vitest-environment jsdom
/**
 * Unit tests for useUndoRedoShortcuts hook — keyboard shortcuts.
 *
 * Tests written FIRST following TDD [Red → Green → Refactor].
 * Acceptance criteria from Issue #8.
 *
 * @module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoRedoShortcuts } from '../hooks/useUndoRedoShortcuts.js';
import { useCanvasStore } from '../store/canvasStore.js';

// ── Store reset ────────────────────────────────────────────

beforeEach(() => {
  useCanvasStore.setState({
    expressions: {},
    expressionOrder: [],
    selectedIds: new Set<string>(),
    activeTool: 'select',
    camera: { x: 0, y: 0, zoom: 1 },
    operationLog: [],
  });
  useCanvasStore.getState().clearHistory?.();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helper to dispatch keyboard events ─────────────────────

function fireKeydown(key: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
  return event;
}

// ── Tests ──────────────────────────────────────────────────

describe('useUndoRedoShortcuts', () => {
  it('registers keydown listener on mount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { unmount } = renderHook(() => useUndoRedoShortcuts());

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    unmount();
  });

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useUndoRedoShortcuts());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  describe('Ctrl+Z triggers undo', () => {
    it('calls undo on Ctrl+Z', () => {
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('z', { ctrlKey: true });

      expect(undoSpy).toHaveBeenCalledTimes(1);
    });

    it('calls undo on Cmd+Z (Mac)', () => {
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('z', { metaKey: true });

      expect(undoSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ctrl+Shift+Z / Ctrl+Y triggers redo', () => {
    it('calls redo on Ctrl+Shift+Z', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('z', { ctrlKey: true, shiftKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('calls redo on Cmd+Shift+Z (Mac)', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('z', { metaKey: true, shiftKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('calls redo on Ctrl+Y', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('y', { ctrlKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });

    it('calls redo on Cmd+Y (Mac)', () => {
      const redoSpy = vi.fn();
      useCanvasStore.setState({ redo: redoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('y', { metaKey: true });

      expect(redoSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('prevents default browser behavior', () => {
    it('prevents default on Ctrl+Z', () => {
      renderHook(() => useUndoRedoShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('prevents default on Ctrl+Shift+Z', () => {
      renderHook(() => useUndoRedoShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('prevents default on Ctrl+Y', () => {
      renderHook(() => useUndoRedoShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });
  });

  describe('does NOT trigger on unrelated keys', () => {
    it('does not call undo/redo on plain Z', () => {
      const undoSpy = vi.fn();
      const redoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy, redo: redoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('z');

      expect(undoSpy).not.toHaveBeenCalled();
      expect(redoSpy).not.toHaveBeenCalled();
    });

    it('does not call undo/redo on Ctrl+A', () => {
      const undoSpy = vi.fn();
      const redoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy, redo: redoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('a', { ctrlKey: true });

      expect(undoSpy).not.toHaveBeenCalled();
      expect(redoSpy).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+Shift+Z is redo, NOT undo', () => {
    it('does not call undo when Shift is also pressed', () => {
      const undoSpy = vi.fn();
      useCanvasStore.setState({ undo: undoSpy } as any);

      renderHook(() => useUndoRedoShortcuts());

      fireKeydown('z', { ctrlKey: true, shiftKey: true });

      expect(undoSpy).not.toHaveBeenCalled();
    });
  });
});
