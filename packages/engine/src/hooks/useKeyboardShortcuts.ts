/**
 * useKeyboardShortcuts — centralized keyboard shortcut system.
 *
 * Consolidates all global keyboard shortcuts into a single hook:
 *
 * **Tool switching (single keys, no modifier):**
 * - `V` / `1` → Select
 * - `R` / `2` → Rectangle
 * - `O` / `3` → Ellipse
 * - `D` / `4` → Diamond
 * - `L` / `5` → Line
 * - `A` / `6` → Arrow
 * - `P` / `7` → Freehand/Pen
 * - `T` / `8` → Text
 *
 * **Actions (with modifiers):**
 * - `Ctrl+Z` / `Cmd+Z` → Undo
 * - `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y` → Redo
 * - `Ctrl+D` / `Cmd+D` → Duplicate selected
 * - `Ctrl+A` / `Cmd+A` → Select all
 * - `Delete` / `Backspace` → Delete selected
 * - `Escape` → Cancel current operation / deselect
 * - `?` → Toggle shortcuts help panel
 *
 * **Guards:**
 * - Shortcuts are disabled when typing in input/textarea/contentEditable
 * - Default browser behavior is prevented for captured shortcuts
 * - Mac Cmd key is treated as Ctrl
 *
 * @module
 */

import { useEffect, useCallback, useState } from 'react';
import { nanoid } from 'nanoid';
import { useCanvasStore } from '../store/canvasStore.js';
import type { ToolType } from '../types/index.js';

// ── Constants ──────────────────────────────────────────────

/** Duplicate offset in world units. */
const DUPLICATE_OFFSET = 20;

/** Map of single keys (lowercase) to tool types. */
const KEY_TO_TOOL: Readonly<Record<string, ToolType>> = {
  v: 'select',
  '1': 'select',
  r: 'rectangle',
  '2': 'rectangle',
  o: 'ellipse',
  '3': 'ellipse',
  d: 'diamond',
  '4': 'diamond',
  l: 'line',
  '5': 'line',
  a: 'arrow',
  '6': 'arrow',
  p: 'freehand',
  '7': 'freehand',
  t: 'text',
  '8': 'text',
};

// ── Types ──────────────────────────────────────────────────

/** Options for the keyboard shortcuts hook. */
export interface UseKeyboardShortcutsOptions {
  /**
   * Callback to cancel an active drawing operation.
   * Provided by useDrawingInteraction to cancel mid-draw state.
   */
  cancelDraw: () => void;
}

/** Return value of the keyboard shortcuts hook. */
export interface KeyboardShortcutsState {
  /** Whether the shortcuts help panel is currently visible. */
  showShortcutsHelp: boolean;
  /** Toggle or set the help panel visibility. */
  setShowShortcutsHelp: (show: boolean) => void;
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Check whether the event target is a text input element.
 *
 * Shortcuts should be suppressed when the user is typing in a
 * form control or contentEditable element.
 */
function isTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.contentEditable === 'true';
}

// ── Hook ───────────────────────────────────────────────────

/**
 * Centralized keyboard shortcut hook.
 *
 * Call in the root Canvas/App component. Registers a single global
 * `keydown` listener that dispatches to all shortcut handlers.
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions,
): KeyboardShortcutsState {
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // ── Guard: skip when typing in text inputs ──
      if (isTextInput(event.target)) return;

      const key = event.key;
      const keyLower = key.toLowerCase();
      const isModifier = event.ctrlKey || event.metaKey;

      // ── Help panel toggle: ? ──
      if (key === '?') {
        setShowShortcutsHelp((prev) => !prev);
        return;
      }

      // ── Escape: cancel / deselect / close help ──
      if (key === 'Escape') {
        // Close help panel if open
        setShowShortcutsHelp(false);

        // Cancel active draw operation
        options.cancelDraw();

        // Deselect all
        useCanvasStore.getState().setSelectedIds(new Set());

        // Switch to select tool
        useCanvasStore.getState().setActiveTool('select');
        return;
      }

      // ── Modifier-based shortcuts ──
      if (isModifier) {
        // Ctrl+Shift+Z / Cmd+Shift+Z → redo (check shift FIRST)
        if (keyLower === 'z' && event.shiftKey) {
          event.preventDefault();
          useCanvasStore.getState().redo();
          return;
        }

        // Ctrl+Z / Cmd+Z → undo
        if (keyLower === 'z' && !event.shiftKey) {
          event.preventDefault();
          useCanvasStore.getState().undo();
          return;
        }

        // Ctrl+Y / Cmd+Y → redo
        if (keyLower === 'y') {
          event.preventDefault();
          useCanvasStore.getState().redo();
          return;
        }

        // Ctrl+A / Cmd+A → select all
        if (keyLower === 'a') {
          event.preventDefault();
          const { expressionOrder } = useCanvasStore.getState();
          useCanvasStore.getState().setSelectedIds(new Set(expressionOrder));
          return;
        }

        // Ctrl+D / Cmd+D → duplicate selected
        if (keyLower === 'd') {
          event.preventDefault();
          duplicateSelected();
          return;
        }

        // Other modifier combos — not handled, let browser process
        return;
      }

      // ── Delete / Backspace → delete selected ──
      if (key === 'Delete' || key === 'Backspace') {
        const state = useCanvasStore.getState();
        if (state.activeTool !== 'select') return;

        const { selectedIds, expressions } = state;
        if (selectedIds.size === 0) return;

        event.preventDefault();
        const deletableIds = Array.from(selectedIds).filter(
          (id) => !expressions[id]?.meta.locked,
        );
        if (deletableIds.length > 0) {
          useCanvasStore.getState().deleteExpressions(deletableIds);
        }
        return;
      }

      // ── Tool switching (single key, no modifier) ──
      if (!event.shiftKey && !event.altKey) {
        const tool = KEY_TO_TOOL[keyLower];
        if (tool) {
          useCanvasStore.getState().setActiveTool(tool);
          return;
        }
      }
    },
    [options],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showShortcutsHelp, setShowShortcutsHelp };
}

// ── Private helpers ────────────────────────────────────────

/**
 * Duplicate all selected (unlocked) expressions with a +20,+20 offset.
 * Selects the new duplicates after creation.
 */
function duplicateSelected(): void {
  const { selectedIds, expressions } = useCanvasStore.getState();
  if (selectedIds.size === 0) return;

  const newIds: string[] = [];

  for (const id of selectedIds) {
    const expr = expressions[id];
    if (!expr) continue;

    const newId = nanoid();
    const duplicate = structuredClone(expr);
    duplicate.id = newId;
    duplicate.position = {
      x: expr.position.x + DUPLICATE_OFFSET,
      y: expr.position.y + DUPLICATE_OFFSET,
    };
    duplicate.meta = {
      ...duplicate.meta,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    useCanvasStore.getState().addExpression(duplicate);
    newIds.push(newId);
  }

  // Select the new duplicates
  useCanvasStore.getState().setSelectedIds(new Set(newIds));
}
